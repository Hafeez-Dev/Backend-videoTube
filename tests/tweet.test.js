import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Tweet } from "../src/models/tweet.model.js";
import { createTestUser, useIntegrationDatabase, withAuth } from "./test-helpers.js";

const baseUrl = "/api/v1/tweets";

describe("tweet routes", () => {
  useIntegrationDatabase("tweet_integration");
  let user;

  beforeEach(async () => {
    user = await createTestUser();
  });

  it("creates a tweet in MongoDB", async () => {
    const response = await withAuth(request(app).post(baseUrl), user).send({
      content: "Integration test tweet",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.content).toBe("Integration test tweet");
    expect(await Tweet.countDocuments({ owner: user.id })).toBe(1);
  });

  it("lists a user's tweets with like metadata", async () => {
    await Tweet.create({ content: "A saved tweet", owner: user.id });

    const response = await withAuth(
      request(app).get(`${baseUrl}/user/${user.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(response.body.data[0].content).toBe("A saved tweet");
    expect(response.body.data[0].likesCount).toBe(0);
  });

  it("updates a tweet owned by the authenticated user", async () => {
    const tweet = await Tweet.create({ content: "Before", owner: user.id });

    const response = await withAuth(
      request(app).patch(`${baseUrl}/${tweet.id}`),
      user,
    ).send({ content: "After" });

    expect(response.status).toBe(200);
    expect((await Tweet.findById(tweet.id)).content).toBe("After");
  });

  it("deletes a tweet owned by the authenticated user", async () => {
    const tweet = await Tweet.create({ content: "Remove me", owner: user.id });

    const response = await withAuth(
      request(app).delete(`${baseUrl}/${tweet.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(await Tweet.findById(tweet.id)).toBeNull();
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).post(baseUrl).send({ content: "No token" });

    expect(response.status).toBe(401);
  });
});
