import mongoose from "mongoose";

export default async function connectDB() {
  // const uri = process.env.MONGODB_URI;

  const uri=process.env.ATLASDB;
  if (!uri) throw new Error("MONGODB_URI missing in .env");

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1); 
  }
}
