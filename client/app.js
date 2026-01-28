/* ================= CONFIG ================= */
const API = "https://secureclip.onrender.com";

/* ================= HELPERS ================= */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ================= WAKE BACKEND ================= */
// 🔥 Prevent Render cold-start failures
fetch(`${API}/health`).catch(() => {});

/* ================= RETRY FETCH ================= */
async function retryFetch(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch {}
    await sleep(3000); // wait before retry
  }
  throw new Error("Backend unavailable");
}

/* ================= CRYPTO ================= */
async function encrypt(text, password) {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("secureclip"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  return btoa(JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  }));
}

async function decrypt(payload, password) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const parsed = JSON.parse(atob(payload));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("secureclip"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(parsed.iv) },
    key,
    new Uint8Array(parsed.data)
  );

  return dec.decode(decrypted);
}

/* ================= SEND + QR ================= */
async function send() {
  const text = $("text").value.trim();
  if (!text) return alert("Paste something first!");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const payload = await encrypt(text, code);

  let stored = false;

  try {
    await retryFetch(`${API}/store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, payload })
    });
    stored = true;
  } catch {
    console.warn("Backend sleeping, QR still generated");
  }

  $("code").innerText = stored
    ? `Code: ${code}`
    : `⚠ Backend waking up… retry in a few seconds`;

  QRCode.toCanvas(
    $("qr"),
    `${location.origin}/?code=${code}`,
    { width: 240 }
  );
}

/* ================= QR SCAN ================= */
let scanner = null;

function startScan() {
  if (scanner) return;

  scanner = new Html5Qrcode("reader");

  scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    async (decodedText) => {
      await scanner.stop();
      scanner = null;

      try {
        const url = new URL(decodedText);
        const code = url.searchParams.get("code");
        if (!code) throw "Invalid QR";

        const res = await retryFetch(`${API}/fetch/${code}`);
        const { payload } = await res.json();

        const text = await decrypt(payload, code);
        await navigator.clipboard.writeText(text);

        alert("✅ SecureClip copied to clipboard");
      } catch {
        alert("❌ Code expired or backend unavailable");
      }
    }
  );
}

/* ================= AUTO FETCH ================= */
(async () => {
  const code = new URLSearchParams(location.search).get("code");
  if (!code) return;

  try {
    const res = await retryFetch(`${API}/fetch/${code}`);
    const { payload } = await res.json();

    const text = await decrypt(payload, code);
    await navigator.clipboard.writeText(text);

    alert("✅ SecureClip copied to clipboard");
  } catch {
    alert("❌ Code expired or backend unavailable");
  }
})();
