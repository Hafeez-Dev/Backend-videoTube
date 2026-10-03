import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Like } from "../src/models/like.model.js";
import { Subscription } from "../src/models/subscription.model.js";
import { Video } from "../src/models/video.model.js";
import {
  createTestUser,
  createTestVideo,
  useIntegrationDatabase,
  withAuth,
} from "./test-helpers.js";

const baseUrl = "/api/v1/dashboard";

describe("dashboard routes", () => {
  useIntegrationDatabase("dashboard_integration");
  let user;

  beforeEach(async () => {
    user = await createTestUser();
  });

  it("calculates channel totals from videos, likes, and subscriptions", async () => {
    const video = await createTestVideo(user, { views: 12 });
    const subscriber = await createTestUser({ username: "subscriber" });
    await Like.create({ video: video.id, likeBy: subscriber.id });
    await Subscription.create({ subscriber: subscriber.id, channel: user.id });

    const response = await withAuth(
      request(app).get(`${baseUrl}/stats`),
      user,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      totalSubscribers: 1,
      totalVideos: 1,
      totalLikes: 1,
      totalViews: 12,
    });
  });

  it("lists channel videos with dashboard fields", async () => {
    await createTestVideo(user, { title: "Dashboard clip", views: 4 });
    await createTestVideo(await createTestUser({ username: "other-owner" }));

    const response = await withAuth(
      request(app).get(`${baseUrl}/videos`),
      user,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ title: "Dashboard clip", views: 4 });
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).get(`${baseUrl}/stats`);

    expect(response.status).toBe(401);
  });
});
