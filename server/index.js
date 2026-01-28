require("dotenv").config();
const express = require("express");
const cors = require("cors");
const redis = require("./redis");
const limiter = require("./ratelimit");

const app = express();

app.use(cors());
app.use(express.json());

/* only protect store */
app.use("/store", limiter);
app.use("/health", limiter);

/* health */
app.get("/health", async (_, res) => {
  try {
    await redis.ping();
    res.send("OK");
  } catch {
    res.status(503).send("Redis unavailable");
  }
});

/* store */
app.post("/store", async (req, res) => {
  const { code, payload, meta } = req.body;
  if (!code || !payload) {
    return res.status(400).json({ error: "Invalid request" });
  }

  await redis.set(
    code,
    JSON.stringify({ payload, meta }),
    { ex: 120 } // 2 minutes
  );

  res.json({ success: true });
});

/* fetch (NO RATE LIMIT) */
app.get("/fetch/:code", async (req, res) => {
  const data = await redis.get(req.params.code);
  if (!data) {
    return res.status(404).json({ error: "Expired or invalid" });
  }

  await redis.del(req.params.code);
  res.json(JSON.parse(data));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SecureClip API running on ${PORT}`);
});
