import mongoose from "mongoose";

export default async function connectDB() {
  const uri = process.env.ATLASDB || process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "KHATABOOK";
  if (!uri) {
    throw new Error("ATLASDB (or MONGODB_URI) is missing in server/.env");
  }

  // Catch common placeholder before trying DNS lookup.
  if (/@cluster\.mongodb\.net\b/i.test(uri)) {
    throw new Error(
      "MongoDB URI uses placeholder host 'cluster.mongodb.net'. Replace it with your real Atlas cluster host."
    );
  }

  try {
    await mongoose.connect(uri, { dbName });
    console.log(`✅ MongoDB connected successfully (db: ${dbName})`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error?.message || error);
    throw error;
  }
}
