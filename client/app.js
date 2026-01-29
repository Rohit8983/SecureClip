const API = "https://secureclip.onrender.com"; // change if needed
const $ = (id) => document.getElementById(id);

/* ================= MODE ================= */
const params = new URLSearchParams(location.search);
const MODE = params.get("mode");
const CODE = params.get("code");

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

/* ================= SENDER ================= */
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

  await fetch(`${API}/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, payload, meta })
  });

  $("code").innerText = `Code: ${code}`;

  const qrURL =
    `${location.origin}${location.pathname}?mode=receive&code=${code}`;

  QRCode.toCanvas($("qr"), qrURL, { width: 240 });
}

/* ================= RECEIVER ================= */
if (MODE === "receive" && CODE) {
  $("sender").style.display = "none";
  $("receiver").style.display = "block";
  $("status").innerText = "Checking availability…";

  // SAFE CHECK (NO DELETE)
  fetch(`${API}/peek/${CODE}`)
    .then(res => {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then(() => {
      $("status").innerText = "Ready to receive";
    })
    .catch(() => {
      $("status").innerText = "❌ Expired or invalid";
      $("actionBtn").disabled = true;
    });

  // USER CONFIRMED CONSUME
  $("actionBtn").onclick = async () => {
    $("actionBtn").disabled = true;
    $("status").innerText = "Decrypting…";

    const res = await fetch(`${API}/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: CODE })
    });

    if (!res.ok) {
      $("status").innerText = "❌ Expired or already used";
      return;
    }

    const { payload, meta } = await res.json();
    const decrypted = await decrypt(payload, CODE);

    if (meta.type === "file") {
      const blob = new Blob([decrypted], { type: meta.mime });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = meta.name;
      a.click();
      $("status").innerText = "✅ File downloaded";
    } else {
      const text = new TextDecoder().decode(decrypted);
      await navigator.clipboard.writeText(text);
      $("status").innerText = "✅ Text copied";
    }
  };
}
