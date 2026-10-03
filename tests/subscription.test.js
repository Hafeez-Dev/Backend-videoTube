import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Subscription } from "../src/models/subscription.model.js";
import { createTestUser, useIntegrationDatabase, withAuth } from "./test-helpers.js";

const baseUrl = "/api/v1/subscriptions";

describe("subscription routes", () => {
  useIntegrationDatabase("subscription_integration");
  let subscriber;
  let channel;

  beforeEach(async () => {
    subscriber = await createTestUser();
    channel = await createTestUser({ username: "channel-user" });
  });

  it("subscribes and unsubscribes through the toggle route", async () => {
    const route = `${baseUrl}/c/${channel.id}`;

    const subscribed = await withAuth(request(app).post(route), subscriber);
    expect(subscribed.status).toBe(200);
    expect(subscribed.body.data.subscribed).toBe(true);
    expect(await Subscription.countDocuments({ subscriber: subscriber.id, channel: channel.id })).toBe(1);

    const unsubscribed = await withAuth(request(app).post(route), subscriber);
    expect(unsubscribed.body.data.subscribed).toBe(false);
    expect(await Subscription.countDocuments({ subscriber: subscriber.id, channel: channel.id })).toBe(0);
  });

  it("lists a channel's subscribers", async () => {
    await Subscription.create({ subscriber: subscriber.id, channel: channel.id });

    const response = await withAuth(
      request(app).get(`${baseUrl}/c/${channel.id}`),
      subscriber,
    );

    expect(response.status).toBe(200);
    expect(response.body.data[0].username).toBe(subscriber.username);
  });

  it("lists channels subscribed to by a user", async () => {
    await Subscription.create({ subscriber: subscriber.id, channel: channel.id });

    const response = await withAuth(
      request(app).get(`${baseUrl}/u/${subscriber.id}`),
      subscriber,
    );

    expect(response.status).toBe(200);
    expect(response.body.data[0].username).toBe(channel.username);
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app).get(`${baseUrl}/c/${channel.id}`);

    expect(response.status).toBe(401);
  });
});
