export function dbErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = String((err as { message: string }).message);
    if (/buffering timed out|bufferCommands is enabled/i.test(m)) {
      return "MongoDB did not become ready in time. Check MONGODB_URI/network access and ensure MongoDB is running.";
    }
    if (/connect ECONNREFUSED|127\.0\.0\.1:27017/i.test(m) || /ECONNREFUSED.*27017/.test(m)) {
      return "Cannot connect to MongoDB. Start MongoDB locally or set MONGODB_URI correctly.";
    }
    if (/authentication failed|bad auth/i.test(m)) {
      return "MongoDB authentication failed. Check MONGODB_URI user/password.";
    }
    if (m.includes("MONGODB_URI") || m.toLowerCase().includes("mongodb")) {
      return m;
    }
    return m;
  }
  return "Database operation failed";
}
