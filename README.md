# SecureChat

SecureChat is a browser-based, true End-to-End Encrypted (E2EE) messaging application designed for high privacy. It runs entirely on the client-side, using Firebase for real-time synchronization and storage. No server has access to unencrypted messages, files, or audio recordings.

## Table of Contents

- [Key Features](#key-features)
- [Cryptographic Architecture](#cryptographic-architecture)
- [Security Features](#security-features)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Build and Deployment](#build-and-deployment)
- [Firebase Security Rules](#firebase-security-rules)

## Key Features

- **End-to-End Encryption:** All text messages, image attachments, files, and voice recordings are encrypted locally before transmission and can only be decrypted by the intended recipient.
- **Zero-Trust Model:** The server cannot decrypt any data. All cryptographic operations occur entirely on the client-side.
- **Stealth Audio Notifications:** Alerts are played as synthesized sounds using the Web Audio API (such as low-frequency taps or soft sine waves) to prevent showing visible desktop notifications.
- **Access Lock PIN:** Auto-locks the application after user inactivity or when the browser tab is hidden, requiring PIN re-entry.
- **Duress PIN:** Entering a designated duress PIN loads a secondary user interface populated with mock contacts and messages to protect user privacy under coercion.
- **Panic Redirect:** Keyboard shortcuts instantly redirect the page to a generic website to conceal app usage.
- **Disappearing Messages:** Automatically deletes messages from the database after a specified timer, starting from when the recipient opens the message.
- **Progressive Web App (PWA):** Installs natively on mobile and desktop platforms, offering offline capability and app-like experience.
- **Voice Messages:** Record and send encrypted audio messages with real-time playback.
- **File Sharing:** Securely share files with automatic encryption and decryption.
- **Multi-Platform Support:** Works on all modern browsers and as a PWA on iOS and Android.

## Cryptographic Architecture

SecureChat implements a zero-trust model where the database server cannot decrypt messages, files, or audio.

1. **Key Derivation (PBKDF2):** When a user logs in, a cryptographic key is derived from their passphrase and unique user ID using PBKDF2 with SHA-256 and 100,000 iterations. This ensures strong key generation even with moderate passphrases.

2. **Private Key Encryption:** The user's ECDH private key is encrypted client-side using AES-GCM (256-bit) with the derived password key before being stored in Firebase. The private key remains encrypted at rest and is never transmitted unencrypted.

3. **Secure In-Memory Handling:** Upon authentication, the client decrypts the ECDH private key. This key is kept strictly in-memory (in React application state) and is never written to persistent storage or transmitted. It is cleared from memory on logout.

4. **Key Exchange (ECDH):** For each chat session, the application imports the user's private key and the recipient's public key (P-256 curve) to derive a shared AES-GCM (256-bit) secret using Elliptic Curve Diffie-Hellman key agreement.

5. **Message & Media Encryption (AES-GCM):**
   - **Text Messages:** Encrypted locally using the derived session key before transmission to Firebase.
   - **Media Attachments & Voice Messages:** Selected files and recorded WebM audio are read as an ArrayBuffer, encrypted using the derived shared key, and uploaded as encrypted binary blobs to Firebase Storage.
   - **Integrity Verification:** AES-GCM provides authenticated encryption, ensuring both confidentiality and integrity of all transmitted data.

## Security Features

- **No Server-Side Decryption:** Firebase servers store only encrypted data; they cannot decrypt any messages or files.
- **Client-Side Key Management:** All keys are generated, stored, and managed on the client. No keys are transmitted to the server.
- **Forward Secrecy:** Each message uses a unique encryption context, preventing compromise of a single key from exposing the entire conversation.
- **Authenticated Encryption:** AES-GCM provides both encryption and authentication, preventing tampering and ensuring data integrity.
- **Secure Authentication:** User authentication is handled via Firebase Authentication with email/password or OAuth providers.
- **Access Control:** Messages and files are accessible only to authorized participants in the conversation.

## Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- A Firebase project with Realtime Database and Cloud Storage enabled

### Installation

```bash
npm install
```

### Local Development

```bash
npm run dev
```

The application will start on `http://localhost:5173` (or another available port).

### Production Build

```bash
npm run build
```

The compiled static build is written to the `dist/` directory, which can be deployed directly to static hosting platforms such as Vercel, Netlify, or Firebase Hosting.

## Configuration

The application requires Firebase credentials. Create a `.env` file at the root of the project with the following configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Environment Variables

- `VITE_FIREBASE_API_KEY`: Your Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Your Firebase authentication domain
- `VITE_FIREBASE_DATABASE_URL`: Your Realtime Database URL
- `VITE_FIREBASE_PROJECT_ID`: Your Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Your Cloud Storage bucket name
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your messaging sender ID
- `VITE_FIREBASE_APP_ID`: Your Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID`: Your Google Analytics measurement ID (optional)

## Build and Deployment

### Deployment Options

SecureChat can be deployed to various static hosting platforms:

- **Firebase Hosting:** Native Firebase integration
- **Vercel:** One-click deployment with Git integration
- **Netlify:** Automated builds and deployment
- **GitHub Pages:** Free hosting for static sites
- **AWS S3 + CloudFront:** Scalable hosting with CDN

### Deployment Steps

1. Build the production bundle: `npm run build`
2. Deploy the `dist/` directory to your chosen hosting platform
3. Configure your Firebase security rules (see below)
4. Ensure HTTPS is enabled on your hosting platform

## Firebase Security Rules

To secure your deployment, apply the following security rules in your Firebase Console.

### Realtime Database Rules

```json
{
  "rules": {
    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && (auth.token.email == ($uid + '@securechat.local') || root.child('users').child(auth.uid).child('isAdmin').val() == true)"
      }
    },
    "messages": {
      ".read": "auth != null",
      "$convId": {
        ".write": "auth != null && $convId.contains(auth.token.email.replace('@securechat.local', ''))"
      }
    }
  }
}
```

### Firebase Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /chat_media/{convId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

**SecureChat** - Privacy-First Encrypted Messaging
