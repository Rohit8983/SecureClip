require("dotenv").config();
const express = require("express");
const cors = require("cors");
const redis = require("./redis");
const limiter = require("./ratelimit");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json({ limit: "1mb" })); // protect against large uploads
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
    const { code, payload, meta } = req.body;

    if (!code || !payload || !meta) {
      return res.status(400).json({ error: "Invalid request" });
    }

    // Optional hard limit (defense-in-depth)
    if (payload.length > 800000) {
      return res.status(413).json({ error: "Payload too large" });
    }

    // ⏱ TTL (seconds)
    await redis.set(
      code,
      JSON.stringify({ payload, meta }),
      { ex: 90 }
    );

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

    const raw = await redis.get(code);
    if (!raw) {
      return res.status(404).json({ error: "Expired or invalid" });
    }

    // 🔐 One-time access
    await redis.del(code);

    res.json(JSON.parse(raw));

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
