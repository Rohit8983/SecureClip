# SecureClip Project to Scan Links or Message with Security

SecureClip is a privacy-first clipboard sharing application that allows users
to securely transfer text or links between devices using temporary access codes,
QR pairing, and end-to-end encryption.

## Features
- AES-256-GCM client-side encryption
- 6-digit ephemeral access codes
- QR-based device pairing
- Redis-backed auto-expiring storage
- One-time access enforcement
- Rate-limiting against brute-force attacks
- Progressive Web App (PWA)

## Security Model
- Zero-trust backend
- No plaintext storage
- Auto expiry (30 seconds)
- HTTPS enforced

## Tech Stack
- Node.js, Express
- Redis
- Web Crypto API
- PWA

## Threat Mitigation
See security report for details.
