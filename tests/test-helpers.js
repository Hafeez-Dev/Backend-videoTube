import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../src/models/user.model.js";
import { Video } from "../src/models/video.model.js";

export function useIntegrationDatabase(databaseName) {
  beforeAll(async () => {
    await mongoose.connect(inject("mongoUri"), { dbName: databaseName });
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });
}

export function createTestUser(overrides = {}) {
  const suffix = overrides.username ?? "test-user";

  return User.create({
    username: suffix,
    email: `${suffix}@example.com`,
    fullName: "Test User",
    avatar: {
      url: "https://cdn.test/avatar.png",
      public_id: "test/avatar",
    },
    coverImage: {
      url: "https://cdn.test/cover.png",
      public_id: "test/cover",
    },
    password: "password123",
    ...overrides,
  });
}

export function createAccessToken(user) {
  return jwt.sign(
    { _id: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1h" },
  );
}

export function withAuth(testRequest, user) {
  return testRequest.set("Authorization", `Bearer ${createAccessToken(user)}`);
}

export function createTestVideo(owner, overrides = {}) {
  return Video.create({
    videoFile: {
      url: "https://cdn.test/video.mp4",
      public_id: "test/video",
    },
    thumbnail: {
      url: "https://cdn.test/thumbnail.png",
      public_id: "test/thumbnail",
    },
    title: "Test Video",
    description: "A video for integration tests",
    duration: 123,
    owner: owner._id,
    ...overrides,
  });
}