require("dotenv").config();
const express = require("express");
const cors = require("cors");
const redis = require("./redis");
const limiter = require("./ratelimit");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(limiter);

/* ================= HEALTH ================= */
app.get("/health", (_, res) => {
  res.json({ ok: true });
});

/* ================= STORE ================= */
app.post("/store", async (req, res) => {
  try {
    const { code, payload, meta } = req.body;

    if (!code || !payload || !meta) {
      return res.status(400).json({ error: "Invalid request" });
    }

    // ✅ FIX: always stringify before storing
    await redis.set(
      code,
      JSON.stringify({ payload, meta }),
      { ex: 300 } // 5 minutes (recommended)
    );

    res.json({ success: true });
  } catch (err) {
    console.error("STORE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= FETCH (ONE-TIME) ================= */
app.get("/fetch/:code", async (req, res) => {
  try {
    const raw = await redis.get(req.params.code);

    if (!raw) {
      return res.status(404).json({ error: "Expired or invalid" });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("CORRUPTED REDIS DATA:", raw);
      await redis.del(req.params.code);
      return res.status(500).json({ error: "Corrupted payload" });
    }

    // 🔐 one-time access
    await redis.del(req.params.code);

    res.json(parsed);
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
