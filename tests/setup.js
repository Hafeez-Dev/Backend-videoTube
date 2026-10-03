import { vi } from "vitest";

process.env.ACCESS_TOKEN_SECRET = "integration-access-secret";
process.env.REFRESH_TOKEN_SECRET = "integration-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRY = "1h";
process.env.REFRESH_TOKEN_EXPIRY = "7d";

vi.mock("../src/utils/cloudinary.js", async () => {
  const { unlink } = await import("node:fs/promises");

  return {
    uploadOnCloudinary: vi.fn(async (filePath) => {
      if (!filePath) return null;

      await unlink(filePath).catch(() => {});
      const fileName = filePath.split(/[\\/]/).pop();

      return {
        url: `https://cloudinary.test/${fileName}`,
        public_id: `integration/${fileName}`,
        duration: 123,
      };
    }),
    deleteFromCloudinary: vi.fn(async () => ({ result: "ok" })),
  };
});