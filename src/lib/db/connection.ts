import mongoose from "mongoose";
import { runDataBootstrap } from "@/lib/db/bootstrap";

const globalForMongoose = globalThis as unknown as {
  mongooseConn: Promise<typeof mongoose> | null;
  ifbMongoMemory?: { uri: string };
};

async function getMongoConnectionString(): Promise<string> {
  const fromEnv = process.env.MONGODB_URI?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    if (process.env.MONGODB_DISABLE_MEMORY === "1") {
      throw new Error(
        "MONGODB_URI is not set. Add MONGODB_URI to .env.local, or remove MONGODB_DISABLE_MEMORY=1 to use the embedded dev database."
      );
    }
    if (!globalForMongoose.ifbMongoMemory) {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const server = await MongoMemoryServer.create();
      globalForMongoose.ifbMongoMemory = { uri: server.getUri() };
    }
    return globalForMongoose.ifbMongoMemory.uri;
  }
  throw new Error("MONGODB_URI is not set. Set it in your production environment.");
}

function connectPromise(): Promise<typeof mongoose> {
  return (async () => {
    const url = await getMongoConnectionString();
    mongoose.set("strictQuery", true);
    return mongoose.connect(url);
  })();
}

/**
 * Caches the connection in dev to survive hot reloads.
 * Clears the cache on failure so a later retry (e.g. after fixing `MONGODB_URI`) can succeed.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (globalForMongoose.mongooseConn) {
    return globalForMongoose.mongooseConn;
  }
  const p = connectPromise()
    .then(async (m) => {
      await runDataBootstrap();
      return m;
    })
    .catch((err: unknown) => {
      if (process.env.NODE_ENV === "development") {
        globalForMongoose.mongooseConn = null;
      }
      throw err;
    });
  if (process.env.NODE_ENV === "development") {
    globalForMongoose.mongooseConn = p;
  }
  return p;
}
