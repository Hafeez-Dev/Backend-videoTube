import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Comment } from "../src/models/comment.model.js";
import { Like } from "../src/models/like.model.js";
import { Tweet } from "../src/models/tweet.model.js";
import {
  createTestUser,
  createTestVideo,
  useIntegrationDatabase,
  withAuth,
} from "./test-helpers.js";

const baseUrl = "/api/v1/likes";

describe("like routes", () => {
  useIntegrationDatabase("like_integration");
  let user;

  beforeEach(async () => {
    user = await createTestUser();
  });

  it("toggles a video like on and off in MongoDB", async () => {
    const video = await createTestVideo(user);
    const route = `${baseUrl}/toggle/v/${video.id}`;

    const liked = await withAuth(request(app).post(route), user);
    expect(liked.status).toBe(200);
    expect(liked.body.data.liked).toBe(true);
    expect(await Like.countDocuments({ video: video.id, likeBy: user.id })).toBe(1);

    const unliked = await withAuth(request(app).post(route), user);
    expect(unliked.body.data.liked).toBe(false);
    expect(await Like.countDocuments({ video: video.id, likeBy: user.id })).toBe(0);
  });

  it("toggles a comment like", async () => {
    const video = await createTestVideo(user);
    const comment = await Comment.create({
      content: "A comment",
      video: video.id,
      owner: user.id,
    });

    const response = await withAuth(
      request(app).post(`${baseUrl}/toggle/c/${comment.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.liked).toBe(true);
    expect(await Like.exists({ comment: comment.id, likeBy: user.id })).toBeTruthy();
  });

  it("toggles a tweet like", async () => {
    const tweet = await Tweet.create({ content: "A tweet", owner: user.id });

    const response = await withAuth(
      request(app).post(`${baseUrl}/toggle/t/${tweet.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.liked).toBe(true);
    expect(await Like.exists({ tweet: tweet.id, likeBy: user.id })).toBeTruthy();
  });

  it("lists liked videos with owner details", async () => {
    const video = await createTestVideo(user);
    await Like.create({ video: video.id, likeBy: user.id });

    const response = await withAuth(request(app).get(`${baseUrl}/videos`), user);

    expect(response.status).toBe(200);
    expect(response.body.data[0].likedVideos.title).toBe("Test Video");
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).get(`${baseUrl}/videos`);

    expect(response.status).toBe(401);
  });
});
