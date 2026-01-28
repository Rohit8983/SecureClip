const API = "https://secureclip.onrender.com"; // change to production URL when deploying
const $ = (id) => document.getElementById(id);

let scannedCode = null;
let scanner = null;

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

  let ok = true;
  try {
    const res = await fetch(`${API}/store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, payload, meta })
    });
    if (!res.ok) ok = false;
  } catch {
    ok = false;
  }

  $("code").innerText = ok
    ? `Code: ${code}`
    : `⚠ QR generated (backend offline)`;

  QRCode.toCanvas(
    $("qr"),
    `${location.origin}?code=${code}`,
    { width: 240 }
  );
}

/* ================= SCAN ================= */
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
        scannedCode = url.searchParams.get("code");
        if (!scannedCode) throw new Error();

        const btn = $("actionBtn");
        btn.style.display = "block";
        btn.disabled = false;
        btn.textContent = "🔓 Fetch secure content";
      } catch {
        alert("Invalid QR code");
      }
    }
  );
}

/* ================= USER ACTION ================= */
$("actionBtn").onclick = async () => {
  const btn = $("actionBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Decrypting…";

  try {
    const res = await fetch(`${API}/fetch/${scannedCode}`);
    if (!res.ok) throw new Error();

    const { payload, meta } = await res.json();
    const decrypted = await decrypt(payload, scannedCode);

    if (meta.type === "text") {
      btn.textContent = "📋 Copy text to clipboard";
      btn.disabled = false;

      btn.onclick = async () => {
        await navigator.clipboard.writeText(
          new TextDecoder().decode(decrypted)
        );
        btn.textContent = "✅ Text copied";
        btn.disabled = true;
      };
    } else {
      const sizeKB = Math.round(decrypted.byteLength / 1024);
      btn.textContent = `📥 Download ${meta.name} (${sizeKB} KB)`;
      btn.disabled = false;

      btn.onclick = () => {
        const blob = new Blob([decrypted], { type: meta.mime });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = meta.name;
        a.click();
        URL.revokeObjectURL(a.href);

        btn.textContent = "✅ Downloaded";
        btn.disabled = true;
      };
    }
  } catch {
    btn.textContent = "❌ QR expired or invalid";
  }
};
