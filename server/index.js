require("dotenv").config();
const express = require("express");
const cors = require("cors");
const redis = require("./redis");
const limiter = require("./ratelimit");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(limiter);

/* Root */
app.get("/", (_, res) => {
  res.send("SecureClip API running");
});

/* Health */
app.get("/health", (_, res) => {
  res.json({ ok: true });
});

/* Store */
app.post("/store", async (req, res) => {
  try {
    const { code, payload, meta } = req.body;
    if (!code || !payload || !meta) {
      return res.status(400).json({ error: "Invalid request" });
    }

    await redis.set(
      code,
      JSON.stringify({ payload, meta }),
      { ex: 300 } // 5 minutes
    );

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* Fetch (one-time) */
app.get("/fetch/:code", async (req, res) => {
  try {
    const raw = await redis.get(req.params.code);
    if (!raw) return res.status(404).json({ error: "Expired" });

    await redis.del(req.params.code);
    res.json(JSON.parse(raw));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on", PORT));
