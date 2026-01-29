/* ================= CONFIG ================= */
const API = "https://secureclip.onrender.com";

/* ================= STATE ================= */
let scannedCode = null;
let scanner = null;
let scanned = false;

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
    iv: [...iv],
    data: [...new Uint8Array(encrypted)]
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

  if (!text && !file) return alert("Add text or file");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  let payload, meta;

  if (file) {
    payload = await encrypt(await file.arrayBuffer(), code);
    meta = { type: "file", name: file.name, mime: file.type };
  } else {
    payload = await encrypt(new TextEncoder().encode(text), code);
    meta = { type: "text" };
  }

  const res = await fetch(`${API}/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, payload, meta })
  });

  if (!res.ok) return alert("Backend unavailable");

  $("code").innerText = `Code: ${code}`;
  QRCode.toCanvas($("qr"), `${location.origin}?code=${code}`, { width: 240 });
}

/* ================= SCAN ================= */
function startScan() {
  if (scanner) return;

  scanned = false;
  scanner = new Html5Qrcode("reader");

  scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    async (decodedText) => {
      if (scanned) return;
      scanned = true;

      await scanner.stop();
      scanner = null;

      const url = new URL(decodedText);
      scannedCode = url.searchParams.get("code");
      if (!scannedCode) return alert("Invalid QR");

      showAction("Processing…");
    }
  );
}

/* ================= ACTION ================= */
function showAction(text) {
  const btn = $("actionBtn");
  btn.style.display = "block";
  btn.innerText = text;
  btn.disabled = false;
}

$("actionBtn").onclick = async () => {
  const btn = $("actionBtn");
  btn.disabled = true;

  const res = await fetch(`${API}/fetch/${scannedCode}`);
  if (!res.ok) {
    btn.innerText = "Expired ❌";
    return;
  }

  const { payload, meta } = await res.json();
  const decrypted = await decrypt(payload, scannedCode);

  if (meta.type === "file") {
    btn.innerText = `Download ${meta.name}`;
    const blob = new Blob([decrypted], { type: meta.mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = meta.name;
    a.click();
  } else {
    btn.innerText = "Copy Text";
    await navigator.clipboard.writeText(
      new TextDecoder().decode(decrypted)
    );
  }

  setTimeout(() => {
    btn.style.display = "none";
    scannedCode = null;
  }, 3000);
};
