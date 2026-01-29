require("dotenv").config();
const express = require("express");
const cors = require("cors");
const redis = require("./redis");
const limiter = require("./ratelimit");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(limiter);

/* ================= HEALTH CHECK ================= */
// 🔥 Keeps Render awake
app.get("/health", async (_, res) => {
  try {
    await redis.ping();
    res.send("OK");
  } catch {
    res.status(503).send("Redis unavailable");
  }
});

/* ================= STORE ================= */
app.post("/store", async (req, res) => {
  try {
    const { code, payload } = req.body;

    if (!code || !payload) {
      return res.status(400).json({ error: "Invalid request" });
    }

    // ⏱ Increased TTL (more reliable)
    await redis.set(code, payload, { ex: 90 });

    res.json({ success: true });

  } catch (err) {
    console.error("STORE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= FETCH ================= */
app.get("/fetch/:code", async (req, res) => {
  try {
    const code = req.params.code;

    const payload = await redis.get(code);
    if (!payload) {
      return res.status(404).json({ error: "Expired or invalid" });
    }

    // 🔐 One-time access
    await redis.del(code);

    res.json({ payload });

  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on ${PORT}`);
});
