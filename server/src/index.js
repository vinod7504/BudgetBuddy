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

/** CORS */
const FRONTEND = process.env.CORS_ORIGIN; 
const WHITELIST = [
  FRONTEND,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);
console.log("CORS whitelist:", WHITELIST);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/Postman
    if (WHITELIST.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors());
app.options("*", cors(corsOptions)); // handle preflight globally
/** end CORS */

app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await verifyMailer(); // log readiness at startup
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
});
