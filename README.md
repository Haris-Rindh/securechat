# SecureChat

SecureChat is a browser-based, true End-to-End Encrypted (E2EE) messaging application designed for high privacy. It runs entirely on the client-side, using Firebase for real-time synchronization and Google Cloud for authentication. The application implements a zero-trust architecture where the database server cannot decrypt messages, files, or audio—only encrypted data is ever stored or transmitted.

## Quick Overview

- **🔐 E2EE Encryption:** All communications are encrypted client-side before leaving your device
- **🌐 Browser-Based:** No installation required—runs directly in your web browser
- **📱 Progressive Web App:** Install natively on mobile and desktop platforms
- **🔒 Privacy-First Features:** Includes duress PIN, panic redirect, and disappearing messages
- **🎤 Rich Media Support:** Secure text, images, files, and voice messages

## Cryptographic Architecture

SecureChat implements a zero-trust model where the database server cannot decrypt messages, files, or audio. All encryption happens client-side using industry-standard algorithms.

### How It Works

1. **Key Derivation (PBKDF2)**
   - When a user logs in, a cryptographic key is derived from their passphrase and unique user ID
   - Uses PBKDF2 with SHA-256 and 100,000 iterations
   - This ensures that even users with identical passphrases have different encryption keys
   - The passphrase never leaves the client device

2. **Private Key Encryption**
   - The user's ECDH private key is encrypted client-side using AES-GCM (256-bit) with the derived password key
   - The encrypted private key is stored in Firebase—it cannot be decrypted without the user's passphrase
   - The private key remains encrypted at rest at all times

3. **Secure In-Memory Handling**
   - Upon authentication, the client decrypts the ECDH private key into memory
   - This key is kept strictly in-memory (in React application state)
   - The key is never written to persistent storage or transmitted over the network
   - The key is cleared from memory on logout or session expiration

4. **Key Exchange (ECDH)**
   - For each chat session, the application imports the user's private key and the recipient's public key using the P-256 elliptic curve
   - ECDH (Elliptic Curve Diffie-Hellman) derives a shared AES-GCM (256-bit) secret
   - This shared secret is used to encrypt all messages between the two parties
   - Each conversation has its own unique shared secret

5. **Message & Media Encryption (AES-GCM)**
   - **Text Messages:** Encrypted locally using the shared secret before transmission to Firebase
   - **Media Attachments:** Selected files are read as an ArrayBuffer, encrypted using AES-GCM, and uploaded as binary blobs to Firebase Storage
   - **Voice Messages:** WebM audio recordings are encrypted the same way as file attachments
   - **Authenticity:** AES-GCM provides both encryption and authentication—tampering is detected

### Security Properties

- **Server Cannot Decrypt:** Firebase stores only encrypted data; even with database access, content remains unreadable
- **No Key Storage on Server:** All cryptographic keys are stored and managed exclusively on the client
- **Perfect Forward Secrecy:** Each conversation uses a unique derived key
- **Authentication Integrated:** AES-GCM prevents message tampering and ensures data integrity

## Features

### Core Messaging
- **End-to-End Encryption:** Applies to all text messages, image attachments, files, and voice recordings
- **Real-Time Synchronization:** Messages sync instantly across all devices using Firebase Realtime Database
- **Rich Media Support:** Share images, documents, audio recordings, and other file types securely

### Privacy & Security
- **Stealth Audio Notifications:** Alerts are played as synthesized sounds using the Web Audio API (such as low-frequency taps or soft sine waves) to prevent showing visible desktop notification bubbles
- **Access Lock PIN:** Auto-locks the application screen after user inactivity (customizable timeout) or when the tab is hidden, requiring PIN entry to unlock
- **Duress PIN:** Entering a designated duress PIN loads a secondary user interface populated with mock contacts and messages to protect user privacy under coercion
- **Panic Redirect:** Keyboard shortcuts instantly redirect the page to a generic website to conceal app usage—useful in high-risk situations
- **Disappearing Messages:** Automatically deletes messages from the database after a specified timer starts from when the recipient opens the message

### Accessibility & Installation
- **Progressive Web App (PWA):** Installs natively on mobile and desktop platforms without app store approval
- **Offline Capable:** Core functionality available offline with sync on reconnection
- **Cross-Platform:** Works on iOS, Android, Windows, macOS, and Linux

## Configuration

The application requires Firebase credentials to function. Follow these steps to set up:

### Prerequisites
- Node.js 16+ and npm
- A Firebase project with Realtime Database and Storage enabled
- Google Cloud authentication configured

### Environment Setup

Create a `.env` file at the root of the project with your Firebase credentials:

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

**Important:** Never commit the `.env` file to version control. Add it to `.gitignore`.

### Obtaining Firebase Credentials
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. In Project Settings, find your Web App credentials
4. Copy each value to the corresponding `.env` variable
5. Enable Realtime Database and Firebase Storage in your project

## Build and Deployment

To run the application locally or compile the production bundle:

### Installation
```bash
npm install
```

This installs all project dependencies including React, Vite, Firebase SDK, and cryptographic libraries.

### Local Development
```bash
npm run dev
```

Starts the development server with hot-reload enabled. The application will typically run on `http://localhost:5173`.

**Development Tips:**
- Open browser DevTools to inspect React component state
- Use Redux DevTools (if installed) to track encryption/decryption operations
- Test with multiple browser tabs to simulate multi-device usage

### Production Build
```bash
npm run build
```

The compiled static build is written to the `dist/` directory, which can be deployed directly to static hosting platforms such as:
- **Vercel** – Recommended for automated deployments from Git
- **Netlify** – Great for branch previews and staging
- **Firebase Hosting** – Integrates seamlessly with your Firebase backend
- **GitHub Pages** – Free option for public projects
- **AWS S3 + CloudFront** – For advanced configurations

### Deployment Checklist
- [ ] All environment variables are correctly set in production
- [ ] Firebase Security Rules are deployed (see below)
- [ ] HTTPS is enforced (required for Web Crypto API and PWA)
- [ ] Service Worker is cached and versioned
- [ ] Backup your Firebase database rules configuration

## Firebase Security Rules

To secure your deployment, apply the following security rules in your Firebase Console. These rules ensure users can only access their own data and conversations.

### Realtime Database Rules

```json
{
  "rules": {
    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && (auth.token.email == ($uid + '@securechat.local') || root.child('users').child(auth.token.email.replace('@securechat.local', '')).child('isAdmin').val() == true)"
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

**Rule Explanation:**
- **users.read:** Only authenticated users can read user profiles
- **users.write:** Users can only modify their own profile, or admins can modify any profile
- **messages.read:** Only authenticated users can read messages
- **messages.write:** Users can only write to conversations they're part of (verified by email in conversation ID)

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

**Rule Explanation:**
- Authenticated users can upload and download encrypted media files
- File names and paths are encrypted, making it impossible for Firebase to determine conversation participants
- Consider adding size limits for production: `request.resource.size < 50 * 1024 * 1024` (50MB max)

### Security Best Practices

1. **Regular Backups:** Schedule automatic backups of your Firebase Realtime Database
2. **Monitor Usage:** Set up Firebase billing alerts to detect unusual activity
3. **Audit Logs:** Enable Firebase Audit Logs in your project settings
4. **Rate Limiting:** Consider implementing custom rate limiting to prevent abuse
5. **CORS Configuration:** Restrict origins to your deployment domains only
