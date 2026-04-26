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

function connectOptions(): { serverSelectionTimeoutMS: number } {
  const ms = Number.parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? "10000", 10);
  return { serverSelectionTimeoutMS: Number.isFinite(ms) && ms > 0 ? ms : 10_000 };
}

function connectPromise(): Promise<typeof mongoose> {
  return (async () => {
    const url = await getMongoConnectionString();
    mongoose.set("strictQuery", true);
    return mongoose.connect(url, connectOptions());
  })();
}

/**
 * Caches a single in-flight/resolved connection on `globalThis` (dev hot reloads + serverless
 * request reuse in production) so we do not open parallel connections on every call.
 * Clears the cache on failure so a later attempt can succeed after fixing `MONGODB_URI` etc.
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
      globalForMongoose.mongooseConn = null;
      throw err;
    });
  globalForMongoose.mongooseConn = p;
  return p;
}
