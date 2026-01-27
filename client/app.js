const API = "https://secureclip.onrender.com/";

/* ------------------ ENCRYPT ------------------ */
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

/* ------------------ DECRYPT ------------------ */
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

/* ------------------ SEND + QR ------------------ */
async function send() {
  const text = document.getElementById("text").value.trim();
  if (!text) return alert("Paste something first!");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const payload = await encrypt(text, code);

  await fetch(`${API}/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, payload })
  });

  document.getElementById("code").innerText = `Code: ${code}`;

  QRCode.toCanvas(
    document.getElementById("qr"),
    `${location.origin}/#code=${code}`,
    { width: 220 },
    (err) => {
      if (err) {
        console.error(err);
        alert("QR generation failed");
      } else {
        console.log("QR generated");
      }
    }
  );
}

/* ------------------ AUTO FETCH ------------------ */
(async () => {
  const code = new URLSearchParams(location.hash.substring(1)).get("code");
  if (!code) return;

  const res = await fetch(`${API}/fetch/${code}`);
  if (!res.ok) return alert("Code expired or invalid");

  const data = await res.json();
  const text = await decrypt(data.payload, code);

  await navigator.clipboard.writeText(text);
  alert("✅ Securely copied to clipboard");
})();
