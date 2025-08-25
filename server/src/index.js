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
import { verifyMailer } from "./utils/mailer.js";

const app = express();

app.use(cors());
// app.set("trust proxy", true);

app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    await verifyMailer();

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err?.message || err);
    process.exit(1);
  });
