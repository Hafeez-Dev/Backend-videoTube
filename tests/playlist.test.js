import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Playlist } from "../src/models/playlist.model.js";
import {
  createTestUser,
  createTestVideo,
  useIntegrationDatabase,
  withAuth,
} from "./test-helpers.js";

const baseUrl = "/api/v1/playlist";

describe("playlist routes", () => {
  useIntegrationDatabase("playlist_integration");
  let user;

  beforeEach(async () => {
    user = await createTestUser();
  });

  it("creates and updates a playlist", async () => {
    const created = await withAuth(request(app).post(baseUrl), user).send({
      name: "Favorites",
      description: "Saved videos",
    });

    expect(created.status).toBe(200);
    expect(await Playlist.countDocuments({ owner: user.id })).toBe(1);

    const updated = await withAuth(
      request(app).patch(`${baseUrl}/${created.body.data._id}`),
      user,
    ).send({ name: "Watch later", description: "Queue" });

    expect(updated.status).toBe(200);
    expect((await Playlist.findById(created.body.data._id)).name).toBe("Watch later");
  });

  it("adds and removes a video from a playlist", async () => {
    const playlist = await Playlist.create({
      name: "Favorites",
      description: "Saved videos",
      owner: user.id,
    });
    const video = await createTestVideo(user);

    const added = await withAuth(
      request(app).patch(`${baseUrl}/add/${video.id}/${playlist.id}`),
      user,
    );
    expect(added.status).toBe(200);
    expect((await Playlist.findById(playlist.id)).videos.map(String)).toContain(video.id);

    const removed = await withAuth(
      request(app).patch(`${baseUrl}/remove/${video.id}/${playlist.id}`),
      user,
    );
    expect(removed.status).toBe(200);
    expect((await Playlist.findById(playlist.id)).videos).toHaveLength(0);
  });

  it("fetches a playlist and the user's playlist summaries", async () => {
    const video = await createTestVideo(user, { views: 7 });
    const playlist = await Playlist.create({
      name: "Favorites",
      description: "Saved videos",
      owner: user.id,
      videos: [video.id],
    });

    const byId = await withAuth(
      request(app).get(`${baseUrl}/${playlist.id}`),
      user,
    );
    expect(byId.status).toBe(200);
    expect(byId.body.data.totalVideos).toBe(1);
    expect(byId.body.data.videos[0].title).toBe("Test Video");

    const byUser = await withAuth(
      request(app).get(`${baseUrl}/user/${user.id}`),
      user,
    );
    expect(byUser.status).toBe(200);
    expect(byUser.body.data[0].totalViews).toBe(7);
  });

  it("deletes a playlist from MongoDB", async () => {
    const playlist = await Playlist.create({
      name: "Favorites",
      description: "Saved videos",
      owner: user.id,
    });

    const response = await withAuth(
      request(app).delete(`${baseUrl}/${playlist.id}`),
      user,
    );

    expect(response.status).toBe(200);
    expect(await Playlist.findById(playlist.id)).toBeNull();
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).post(baseUrl);

    expect(response.status).toBe(401);
  });
});
