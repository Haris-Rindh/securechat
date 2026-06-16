# SecureChat

SecureChat is a browser-based, true End-to-End Encrypted (E2EE) messaging application designed for high privacy. It runs entirely on the client-side, using Firebase for real-time synchronization and the Web Crypto API for local encryption.

## Cryptographic Architecture

SecureChat implements a zero-trust model where the database server cannot decrypt messages, files, or audio.

1. **Key Derivation (PBKDF2):** When a user logs in, a cryptographic key is derived from their passphrase and unique user ID using PBKDF2 with SHA-256 and 100,000 iterations.
2. **Private Key Encryption:** The user's ECDH private key is encrypted client-side using AES-GCM (256-bit) with the derived password key before being stored in Firebase. The private key remains encrypted at rest on the database.
3. **Secure In-Memory Handling:** Upon authentication, the client decrypts the ECDH private key. This key is kept strictly in-memory (in React application state) and is never written to persistent browser storage like localStorage or sessionStorage. It is purged immediately on tab closure or logout.
4. **Key Exchange (ECDH):** For each chat session, the application imports the user's private key and the recipient's public key (P-256 curve) to derive a shared AES-GCM (256-bit) secret.
5. **Message & Media Encryption (AES-GCM):**
   - **Text Messages:** Encrypted locally before transmission.
   - **Media Attachments & Voice Messages:** Selected files and recorded WebM audio are read as an ArrayBuffer, encrypted using the derived shared key, and uploaded as binary blobs to Firebase Storage. When received, the encrypted data is downloaded, decrypted client-side, and loaded via secure local Object URLs.

## Features

- **End-to-End Encryption:** Applies to all text messages, image attachments, files, and voice recordings.
- **Stealth Audio Notifications:** Alerts are played as synthesized sounds using the Web Audio API (such as low-frequency taps or soft sine waves) to prevent showing visible desktop notification banners.
- **Access Lock PIN:** Auto-locks the application screen after user inactivity or when the tab is hidden.
- **Duress PIN:** Entering a designated duress PIN loads a secondary user interface populated with mock contacts and messages to protect user privacy.
- **Panic Redirect:** Keyboard shortcuts instantly redirect the page to a generic website to conceal app usage.
- **Disappearing Messages:** Deletes messages from the database after a specified timer starting from when the recipient opens the message.
- **Progressive Web App (PWA):** Installs natively on mobile and desktop platforms.

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

## Build and Deployment

To run the application locally or compile the production bundle:

### Installation
```bash
npm install
```

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```
The compiled static build is written to the `dist/` directory, which can be deployed directly to static hosting platforms such as Vercel, Netlify, or Firebase Hosting.

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
