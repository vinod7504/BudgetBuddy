// import "dotenv/config";
// import express from "express";
// import cors from "cors";
// import connectDB from "./lib/db.js";
// import authRoutes from "./routes/auth.js";
// import { verifyMailer } from './utils/mailer.js';
// import expenseRoutes from "./routes/expenses.js";

// const app = express();


// // origin: process.env.CORS_ORIGIN,
// //     methods: "GET,POST,PUT,DELETE,PATCH",
// //     credentials: true,


// app.use(
//   cors()
// );
// app.use(express.json());

// app.get("/api/health", (req, res) => res.json({ ok: true }));
// app.use("/api/auth", authRoutes);
// app.use("/api/expenses", expenseRoutes);

// const PORT = process.env.PORT || 5000;
// connectDB().then(() => {
//   app.listen(PORT, () =>
//     console.log(`API running on http://localhost:${PORT}`)
//   );
// });




// Changed

import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./lib/db.js";
import authRoutes from "./routes/auth.js";
import expenseRoutes from "./routes/expenses.js";
import otpRoutes from "./routes/otp.js";   // ✅ add this import
import { verifyMailer } from "./utils/mailer.js";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: "GET,POST,PUT,DELETE,PATCH",
  credentials: true,
}));
app.use(express.json());

// health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/otp", otpRoutes);   // ✅ add this line

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await verifyMailer(); // test mailer connection on startup

  app.listen(PORT, () =>
    console.log(`API running on http://localhost:${PORT}`)
  );
});
