import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Subscription } from "../src/models/subscription.model.js";
import { User } from "../src/models/user.model.js";
import {
	createTestUser,
	createTestVideo,
	useIntegrationDatabase,
	withAuth,
} from "./test-helpers.js";

const baseUrl = "/api/v1/users";

describe("user routes", () => {
	useIntegrationDatabase("user_integration");
	let user;

	beforeEach(async () => {
		user = await createTestUser();
	});

	it("validates registration fields", async () => {
		const response = await request(app)
			.post(`${baseUrl}/register`)
			.send({ username: "", fullName: "", email: "", password: "" });

		expect(response.status).toBe(400);
	});

	it("requires a username or email to log in", async () => {
		const response = await request(app).post(`${baseUrl}/login`).send({});

		expect(response.status).toBe(400);
	});

	it("requires a refresh token", async () => {
		const response = await request(app)
			.post(`${baseUrl}/refresh-token`)
			.send({});

		expect(response.status).toBe(401);
	});

	it("registers a user and stores the uploaded avatar", async () => {
		const response = await request(app)
			.post(`${baseUrl}/register`)
			.field("username", "new-user")
			.field("fullName", "New User")
			.field("email", "new-user@example.com")
			.field("password", "password123")
			.attach("avatar", Buffer.from("avatar"), "new-avatar.png");

		expect(response.status).toBe(201);
		expect(response.body.data.username).toBe("new-user");
		expect(response.body.data.avatar.url).toContain("cloudinary.test");
		expect(await User.countDocuments()).toBe(2);
	});

	it("logs in and returns access and refresh cookies", async () => {
		const response = await request(app).post(`${baseUrl}/login`).send({
			username: user.username,
			password: "password123",
		});

		expect(response.status).toBe(200);
		expect(response.body.data.user._id).toBe(user.id);
		expect(response.headers["set-cookie"]).toEqual(
			expect.arrayContaining([
				expect.stringContaining("accessToken="),
				expect.stringContaining("refreshToken="),
			]),
		);
	});

	it("rejects incorrect login credentials", async () => {
		const response = await request(app).post(`${baseUrl}/login`).send({
			username: user.username,
			password: "incorrect",
		});

		expect(response.status).toBe(401);
	});

	it("refreshes tokens and persists the refresh token", async () => {
		const refreshToken = user.generateRefreshToken();
		user.refreshToken = refreshToken;
		await user.save();

		const response = await request(app)
			.post(`${baseUrl}/refresh-token`)
			.send({ refreshToken });

		expect(response.status).toBe(200);
		expect(response.body.data.accessToken).toBeTruthy();
		expect((await User.findById(user.id)).refreshToken).toBe(
			response.body.data.refreshToken,
		);
	});

	it("logs out and removes the stored refresh token", async () => {
		user.refreshToken = user.generateRefreshToken();
		await user.save();

		const response = await withAuth(
			request(app).post(`${baseUrl}/logout`),
			user,
		);

		expect(response.status).toBe(200);
		expect((await User.findById(user.id)).refreshToken).toBeUndefined();
	});

	it("changes the current user's password", async () => {
		const response = await withAuth(
			request(app).post(`${baseUrl}/change-password`),
			user,
		).send({ oldPassword: "password123", newPassword: "new-password" });

		expect(response.status).toBe(200);
		expect(await (await User.findById(user.id)).isPasswordCorrect("new-password")).toBe(true);
	});

	it("returns the authenticated user", async () => {
		const response = await withAuth(
			request(app).get(`${baseUrl}/current-user`),
			user,
		);

		expect(response.status).toBe(200);
		expect(response.body.data._id).toBe(user.id);
		expect(response.body.data.password).toBeUndefined();
	});

	it("updates account details in MongoDB", async () => {
		const response = await withAuth(
			request(app).patch(`${baseUrl}/update-account`),
			user,
		).send({ fullName: "Updated Name", email: "updated@example.com" });

		expect(response.status).toBe(200);
		expect(response.body.data.fullName).toBe("Updated Name");
		expect((await User.findById(user.id)).email).toBe("updated@example.com");
	});

	it("updates the avatar using a multipart upload", async () => {
		const response = await withAuth(
			request(app).patch(`${baseUrl}/avatar`),
			user,
		).attach("avatar", Buffer.from("avatar"), "updated-avatar.png");

		expect(response.status).toBe(200);
		expect((await User.findById(user.id)).avatar.url).toContain("updated-avatar.png");
	});

	it("updates the cover image using a multipart upload", async () => {
		const response = await withAuth(
			request(app).patch(`${baseUrl}/cover-image`),
			user,
		).attach("coverImage", Buffer.from("cover"), "updated-cover.png");

		expect(response.status).toBe(200);
		expect((await User.findById(user.id)).coverImage.url).toContain("updated-cover.png");
	});

	it("returns channel stats from MongoDB", async () => {
		const subscriber = await createTestUser({ username: "subscriber" });
		await Subscription.create({ subscriber: subscriber.id, channel: user.id });

		const response = await withAuth(
			request(app).get(`${baseUrl}/channel/${user.username}`),
			user,
		);

		expect(response.status).toBe(200);
		expect(response.body.data.subscribersCount).toBe(1);
		expect(response.body.data.isSubscribed).toBe(false);
	});

	it("returns watch history populated with video owner details", async () => {
		const video = await createTestVideo(user);
		user.watchHistory.push(video.id);
		await user.save();

		const response = await withAuth(
			request(app).get(`${baseUrl}/history`),
			user,
		);

		expect(response.status).toBe(200);
		expect(response.body.data[0]._id).toBe(video.id);
		expect(response.body.data[0].owner.username).toBe(user.username);
	});

	it.each([
		["post", "/logout"],
		["post", "/change-password"],
		["get", "/current-user"],
		["patch", "/update-account"],
		["patch", "/avatar"],
		["patch", "/cover-image"],
		["get", "/channel/test-user"],
		["get", "/history"],
	])("protects %s %s", async (method, path) => {
		const response = await request(app)[method](`${baseUrl}${path}`);

		expect(response.status).toBe(401);
	});
});
