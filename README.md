# SecureClip Project to Scan Links or Messages with Security

SecureClip is a privacy-first clipboard sharing application that allows users to securely transfer text or links between devices using temporary access codes, QR pairing, and end-to-end encryption.

The application is designed to minimize data exposure by enforcing short-lived access, one-time retrieval, and strict client-side encryption.

---

## Live Application

**Main Application (Generate Secure QR / Send Data)**
[https://secureclip-21.netlify.app/](https://secureclip-21.netlify.app/)

**Desktop QR Scanner (Scan and Copy Data)**
[https://secureclip-21.netlify.app/](https://secureclip-21.netlify.app/)

Open the application on a desktop or laptop to scan the QR code and securely retrieve the transferred content.

---

## Features

* AES-256-GCM client-side encryption
* 6-digit ephemeral access codes
* QR-based device pairing
* Redis-backed auto-expiring storage
* One-time access enforcement
* Rate-limiting against brute-force attacks
* Progressive Web App (PWA) support

---

## Security Model

* Zero-trust backend architecture
* No plaintext data stored or transmitted
* Automatic expiration after 30 seconds
* HTTPS enforced across all connections

---

## Tech Stack

* Node.js
* Express
* Redis
* Web Crypto API
* Progressive Web App (PWA)

---

## Threat Mitigation

SecureClip mitigates common security risks including replay attacks, brute-force access attempts, and data persistence after retrieval.

See the security report for detailed threat modeling and mitigation strategies.

---

## Use Cases

* Securely transferring links between mobile and desktop devices
* Sharing passwords or API keys temporarily
* Sending sensitive text without using cloud clipboard services

---

## License

This project is intended for educational and demonstration purposes.
Review and audit the code before using in production environments.


Just say the word.
