/* ================= CONFIG ================= */
const API = "https://secureclip.onrender.com";

/* ================= GLOBAL GUARD ================= */
let alreadyFetched = false;

/* ================= HELPERS ================= */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ================= WAKE BACKEND ================= */
fetch(`${API}/health`).catch(() => {});

/* ================= RETRY FETCH ================= */
async function retryFetch(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch {}
    await sleep(3000);
  }
  throw new Error("Backend unavailable");
}

/* ================= CRYPTO ================= */
async function deriveKey(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("secureclip"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(buffer, password) {
  const key = await deriveKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    buffer
  );

  return btoa(JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  }));
}

async function decrypt(payload, password) {
  const parsed = JSON.parse(atob(payload));
  const key = await deriveKey(password);

  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(parsed.iv) },
    key,
    new Uint8Array(parsed.data)
  );
}

/* ================= SEND + QR ================= */
async function send() {
  const text = $("text").value.trim();
  const file = $("file")?.files?.[0];

  if (!text && !file) return alert("Paste text or upload a file");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  let payload, meta;

  if (file) {
    if (file.size > 500 * 1024) return alert("Max file size: 500KB");
    const buffer = await file.arrayBuffer();
    payload = await encrypt(buffer, code);
    meta = { type: "file", name: file.name, mime: file.type };
  } else {
    payload = await encrypt(new TextEncoder().encode(text), code);
    meta = { type: "text" };
  }

  await retryFetch(`${API}/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, payload, meta })
  });

  $("code").innerText = `Code: ${code}`;

  QRCode.toCanvas(
    $("qr"),
    `https://secureclip-21.netlify.app/?code=${code}`,
    { width: 240 }
  );
}

/* ================= HANDLE PAYLOAD ================= */
async function handlePayload(decrypted, meta) {
  if (meta.type === "file") {
    const blob = new Blob([decrypted], { type: meta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = meta.name || "secureclip-file";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } else {
    const text = new TextDecoder().decode(decrypted);
    try {
      await navigator.clipboard.writeText(text);
      alert("✅ Text copied to clipboard");
    } catch {
      prompt("SecureClip Text:", text);
    }
  }
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
        if (alreadyFetched) return;
        alreadyFetched = true;

        const url = new URL(decodedText);
        const code = url.searchParams.get("code");
        if (!code) throw "Invalid QR";

        const res = await retryFetch(`${API}/fetch/${code}`);
        const { payload, meta } = await res.json();

        const decrypted = await decrypt(payload, code);
        await handlePayload(decrypted, meta);
      } catch {
        alert("❌ Code expired or invalid");
      }
    }
  );
}

/* ================= AUTO FETCH ================= */
(async () => {
  const code = new URLSearchParams(location.search).get("code");
  if (!code) return;

  if (alreadyFetched) return;
  alreadyFetched = true;

  try {
    const res = await retryFetch(`${API}/fetch/${code}`);
    const { payload, meta } = await res.json();

    const decrypted = await decrypt(payload, code);
    await handlePayload(decrypted, meta);
  } catch {
    alert("❌ Code expired or invalid");
  }
})();
