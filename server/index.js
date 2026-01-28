require("dotenv").config();
const express = require("express");
const cors = require("cors");
const redis = require("./redis");
const limiter = require("./ratelimit");

const app = express();

app.use(cors());
app.use(express.json());

/* protect only store + health */
app.use("/store", limiter);
app.use("/health", limiter);

/* health */
app.get("/health", async (_, res) => {
  try {
    await redis.ping();
    res.send("OK");
  } catch (err) {
    console.error("HEALTH ERROR:", err);
    res.status(503).send("Redis unavailable");
  }
});

/* store */
app.post("/store", async (req, res) => {
  try {
    const { code, payload, meta } = req.body;

    if (!code || !payload || !meta) {
      return res.status(400).json({ error: "Invalid request" });
    }

    await redis.set(
      code,
      JSON.stringify({ payload, meta }),
      { ex: 300 } // 5 minutes for testing
    );

    res.json({ success: true });
  } catch (err) {
    console.error("STORE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* fetch (NO RATE LIMIT) */
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
      console.error("REDIS PARSE ERROR:", raw);
      await redis.del(req.params.code);
      return res.status(500).json({ error: "Corrupted payload" });
    }

    // one-time access
    await redis.del(req.params.code);
    res.json(parsed);

  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SecureClip API running on ${PORT}`);
});
