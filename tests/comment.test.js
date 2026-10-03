import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Comment } from "../src/models/comment.model.js";
import { Like } from "../src/models/like.model.js";
import {
  createTestUser,
  createTestVideo,
  useIntegrationDatabase,
  withAuth,
} from "./test-helpers.js";

const baseUrl = "/api/v1/comments";

describe("comment routes", () => {
  useIntegrationDatabase("comment_integration");
  let user;
  let video;

  beforeEach(async () => {
    user = await createTestUser();
    video = await createTestVideo(user);
  });

  it("adds a comment to a video", async () => {
    const response = await withAuth(
      request(app).post(`${baseUrl}/${video.id}`),
      user,
    ).send({ content: "A useful comment" });

    expect(response.status).toBe(200);
    expect(response.body.data.content).toBe("A useful comment");
    expect(await Comment.countDocuments({ video: video.id, owner: user.id })).toBe(1);
  });

  it("rejects a blank comment", async () => {
    const response = await withAuth(
      request(app).post(`${baseUrl}/${video.id}`),
      user,
    ).send({ content: "   " });

    expect(response.status).toBe(400);
  });

  it("lists comments with like metadata", async () => {
    await Comment.create({ content: "Listed comment", video: video.id, owner: user.id });

    const response = await withAuth(
      request(app).get(`${baseUrl}/${video.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.docs[0].content).toBe("Listed comment");
    expect(response.body.data.docs[0].likesCount).toBe(0);
  });

  it("updates a comment and returns the updated document", async () => {
    const comment = await Comment.create({
      content: "Before",
      video: video.id,
      owner: user.id,
    });

    const response = await withAuth(
      request(app).patch(`${baseUrl}/c/${comment.id}`),
      user,
    ).send({ content: "After" });

    expect(response.status).toBe(200);
    expect(response.body.data.content).toBe("After");
    expect((await Comment.findById(comment.id)).content).toBe("After");
  });

  it("deletes a comment and its likes", async () => {
    const comment = await Comment.create({
      content: "Remove me",
      video: video.id,
      owner: user.id,
    });
    await Like.create({ comment: comment.id, likeBy: user.id });

    const response = await withAuth(
      request(app).delete(`${baseUrl}/c/${comment.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(await Comment.findById(comment.id)).toBeNull();
    expect(await Like.countDocuments({ comment: comment.id })).toBe(0);
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).get(`${baseUrl}/${video.id}`);

    expect(response.status).toBe(401);
  });
});
