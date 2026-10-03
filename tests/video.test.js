import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { User } from "../src/models/user.model.js";
import { Video } from "../src/models/video.model.js";
import {
  createTestUser,
  createTestVideo,
  useIntegrationDatabase,
  withAuth,
} from "./test-helpers.js";

const baseUrl = "/api/v1/videos";

describe("video routes", () => {
  useIntegrationDatabase("video_integration");
  let user;

  beforeEach(async () => {
    user = await createTestUser();
  });

  it("lists published videos with pagination", async () => {
    await createTestVideo(user, { title: "Published clip" });
    await createTestVideo(user, { title: "Draft clip", isPublished: false });

    const response = await withAuth(request(app).get(baseUrl), user);

    expect(response.status).toBe(200);
    expect(response.body.data.docs).toHaveLength(1);
    expect(response.body.data.docs[0].title).toBe("Published clip");
  });

  it("publishes an uploaded video and thumbnail", async () => {
    const response = await withAuth(request(app).post(baseUrl), user)
      .field("title", "Uploaded clip")
      .field("description", "A multipart upload")
      .attach("videoFile", Buffer.from("video"), "uploaded-video.mp4")
      .attach("thumbnail", Buffer.from("thumbnail"), "uploaded-thumbnail.png");

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Uploaded clip");
    expect(await Video.countDocuments({ owner: user.id })).toBe(1);
  });

  it("fetches a video, increments views, and records watch history", async () => {
    const video = await createTestVideo(user);

    const response = await withAuth(
      request(app).get(`${baseUrl}/${video.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Test Video");
    expect((await Video.findById(video.id)).views).toBe(1);
    expect((await User.findById(user.id)).watchHistory.map(String)).toContain(video.id);
  });

  it("updates video details and its thumbnail", async () => {
    const video = await createTestVideo(user);

    const response = await withAuth(
      request(app).patch(`${baseUrl}/${video.id}`),
      user,
    )
      .field("title", "Updated clip")
      .field("description", "Updated description")
      .attach("thumbnail", Buffer.from("new thumbnail"), "new-thumbnail.png");

    expect(response.status).toBe(200);
    const storedVideo = await Video.findById(video.id);
    expect(storedVideo.title).toBe("Updated clip");
    expect(storedVideo.thumbnail.url).toContain("new-thumbnail.png");
  });

  it("deletes a video from MongoDB", async () => {
    const video = await createTestVideo(user);

    const response = await withAuth(
      request(app).delete(`${baseUrl}/${video.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(await Video.findById(video.id)).toBeNull();
  });

  it("toggles the published state", async () => {
    const video = await createTestVideo(user, { isPublished: true });

    const response = await withAuth(
      request(app).patch(`${baseUrl}/toggle/publish/${video.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect((await Video.findById(video.id)).isPublished).toBe(false);
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).get(baseUrl);

    expect(response.status).toBe(401);
  });
});
