import { MongoMemoryServer } from "mongodb-memory-server";

export default async function globalSetup({ provide }) {
  const mongoServer = await MongoMemoryServer.create();
  provide("mongoUri", mongoServer.getUri());

  return async () => {
    await mongoServer.stop();
  };
}