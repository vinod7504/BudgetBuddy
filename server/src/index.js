import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./lib/db.js";
import authRoutes from "./routes/auth.js";
import expenseRoutes from "./routes/expenses.js";
import bankRoutes from "./routes/banks.js";
import { verifyMailer } from "./utils/mailer.js";

const app = express();
let dbConnected = false;
let dbConnectInProgress = false;

app.use(cors());
// app.set("trust proxy", true);

app.use(express.json());

app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    dbConnected,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/banks", bankRoutes);

const PORT = process.env.PORT || 5000;
const DB_RETRY_MS = Number(process.env.DB_RETRY_MS || 20000);

async function connectDbWithRetry() {
  if (dbConnectInProgress || dbConnected) return;
  dbConnectInProgress = true;
  try {
    await connectDB();
    dbConnected = true;
  } catch (err) {
    dbConnected = false;
    console.error("DB connection failed:", err?.message || err);
    console.log(`Retrying DB connection in ${Math.round(DB_RETRY_MS / 1000)}s...`);
    setTimeout(() => {
      connectDbWithRetry();
    }, DB_RETRY_MS);
  } finally {
    dbConnectInProgress = false;
  }
}

app.listen(PORT, async () => {
  console.log(`API running on http://localhost:${PORT}`);
  await connectDbWithRetry();
  try {
    await verifyMailer();
  } catch (err) {
    console.error("Mailer verify failed:", err?.message || err);
  }
});
