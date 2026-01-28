/* ================= CONFIG ================= */
const API = "https://secureclip.onrender.com";

/* ================= GLOBAL ================= */
let alreadyFetched = false;
let pendingPayload = null;
let pendingMeta = null;

/* ================= HELPERS ================= */
const $ = (id) => document.getElementById(id);

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

/* ================= SEND ================= */
async function send() {
  const text = $("text").value.trim();
  const file = $("file").files[0];

  if (!text && !file) {
    return alert("Enter text or upload a file");
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  let payload, meta;

  if (file) {
    if (file.size > 500 * 1024) {
      return alert("Max file size is 500KB");
    }
    payload = await encrypt(await file.arrayBuffer(), code);
    meta = { type: "file", name: file.name, mime: file.type };
  } else {
    payload = await encrypt(new TextEncoder().encode(text), code);
    meta = { type: "text" };
  }

  await fetch(`${API}/store`, {
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

/* ================= HANDLE PAYLOAD (SAFE) ================= */
function prepareAction(decrypted, meta) {
  pendingPayload = decrypted;
  pendingMeta = meta;

  const btn = $("actionBtn");
  btn.style.display = "block";

  btn.onclick = async () => {
    btn.style.display = "none";

    if (pendingMeta.type === "file") {
      const blob = new Blob([pendingPayload], { type: pendingMeta.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pendingMeta.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const text = new TextDecoder().decode(pendingPayload);
      await navigator.clipboard.writeText(text);
      alert("✅ Text copied");
    }

    pendingPayload = null;
    pendingMeta = null;
  };
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

      if (alreadyFetched) return;
      alreadyFetched = true;

      const url = new URL(decodedText);
      const code = url.searchParams.get("code");
      if (!code) return alert("Invalid QR");

      const res = await fetch(`${API}/fetch/${code}`);
      const { payload, meta } = await res.json();

      const decrypted = await decrypt(payload, code);
      prepareAction(decrypted, meta);
    }
  );
}

/* ================= AUTO FETCH ================= */
(async () => {
  const code = new URLSearchParams(location.search).get("code");
  if (!code || alreadyFetched) return;

  alreadyFetched = true;

  const res = await fetch(`${API}/fetch/${code}`);
  const { payload, meta } = await res.json();

  const decrypted = await decrypt(payload, code);
  prepareAction(decrypted, meta);
})();
