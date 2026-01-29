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

    await redis.set(
      code,
      JSON.stringify({ payload, meta }),
      { ex: 300 } // 5 minutes TTL
    );

    res.json({ success: true });
  } catch (err) {
    console.error("STORE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= SAFE CHECK (NO DELETE) ================= */
app.get("/peek/:code", async (req, res) => {
  try {
    const raw = await redis.get(req.params.code);

    if (!raw) {
      return res.status(404).json({ error: "Expired or invalid" });
    }

    const { meta } = JSON.parse(raw);
    res.json({ ready: true, meta });
  } catch (err) {
    console.error("PEEK ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= ONE-TIME CONSUME ================= */
app.post("/consume", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    const raw = await redis.get(code);

    if (!raw) {
      return res.status(404).json({ error: "Expired or already used" });
    }

    const parsed = JSON.parse(raw);

    // 🔐 destroy immediately
    await redis.del(code);

    res.json(parsed);
  } catch (err) {
    console.error("CONSUME ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on ${PORT}`);
});
