import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("healthcheck route", () => {
  it("returns the API health status", async () => {
    const response = await request(app).get("/api/v1/healthcheck/");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      statusCode: 200,
      data: { message: "Everything is O.K!" },
      message: "OK",
      success: true,
    });
  });
});
