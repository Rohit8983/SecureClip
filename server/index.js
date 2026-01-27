require("dotenv").config();
const express = require("express");
const cors = require("cors");
const redis = require("./redis");
const limiter = require("./ratelimit");

const app = express();

// ✅ REQUIRED
app.use(cors());
app.use(express.json());
app.use(limiter);

// Store encrypted payload
app.post("/store", async (req, res) => {
  try {
    const { code, payload } = req.body;
    if (!code || !payload) {
      return res.status(400).json({ error: "Invalid request" });
    }

    await redis.set(code, payload, { ex: 30 });
    res.json({ success: true });

  } catch (err) {
    console.error("STORE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Fetch one-time payload
app.get("/fetch/:code", async (req, res) => {
  try {
    const payload = await redis.get(req.params.code);

    if (!payload) {
      return res.status(404).json({ error: "Expired or invalid" });
    }

    await redis.del(req.params.code);
    res.json({ payload });

  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on ${PORT}`);
});
