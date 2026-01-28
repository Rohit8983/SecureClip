/* ================= CONFIG ================= */
const API = "https://secureclip.onrender.com";

/* ================= STATE ================= */
let scannedCode = null;

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

  if (!text && !file) {
    alert("Add text or file");
    return;
  }

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

  if (!res.ok) {
    alert("Failed to store data");
    return;
  }

  $("code").innerText = `Code: ${code}`;
  QRCode.toCanvas(
    $("qr"),
    `${location.origin}/?code=${code}`,
    { width: 240 }
  );
}

/* ================= QR SCAN (IN-APP CAMERA) ================= */
function startScan() {
  const scanner = new Html5Qrcode("reader");

  scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    decodedText => {
      scanner.stop();

      const url = new URL(decodedText);
      scannedCode = url.searchParams.get("code");

      if (!scannedCode) {
        alert("Invalid QR");
        return;
      }

      showActionButton();
    }
  );
}

/* ================= READ CODE FROM URL ================= */
document.addEventListener("DOMContentLoaded", () => {
  const codeFromUrl = new URLSearchParams(location.search).get("code");
  if (codeFromUrl) {
    scannedCode = codeFromUrl;
    showActionButton();
  }
});

/* ================= USER ACTION ================= */
function showActionButton() {
  const btn = $("actionBtn");
  btn.style.display = "block";
  btn.disabled = false;
  btn.innerText = "Tap to Copy / Download";
}

$("actionBtn").onclick = async () => {
  if (!scannedCode) return;

  const btn = $("actionBtn");
  btn.disabled = true;
  btn.innerText = "Processing…";

  const res = await fetch(`${API}/fetch/${scannedCode}`);

  if (!res.ok) {
    btn.innerText = "Expired or invalid ❌";
    setTimeout(reset, 2000);
    return;
  }

  const { payload, meta } = await res.json();
  const decrypted = await decrypt(payload, scannedCode);

  if (meta.type === "file") {
    btn.innerText = "Downloading…";

    const blob = new Blob([decrypted], { type: meta.mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = meta.name;
    a.click();

    btn.innerText = "Downloaded ✓";
  } else {
    btn.innerText = "Copying…";

    const text = new TextDecoder().decode(decrypted);
    await navigator.clipboard.writeText(text);

    btn.innerText = "Copied ✓";
  }

  setTimeout(reset, 2000);
};

/* ================= RESET ================= */
function reset() {
  const btn = $("actionBtn");
  btn.style.display = "none";
  btn.innerText = "Tap to Copy / Download";
  btn.disabled = false;
  scannedCode = null;
}
