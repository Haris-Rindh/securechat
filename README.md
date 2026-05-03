# SecureChat V4

SecureChat is a highly secure, true End-to-End Encrypted (E2EE) messaging application designed for absolute privacy. It runs entirely in the browser, using Firebase for real-time synchronization and Web Crypto API for local encryption.

## Features
- **True End-to-End Encryption (E2EE)**: Uses ECDH key exchange and AES-256-GCM. The database mathematically cannot decrypt your messages.
- **Stealth Notifications**: In-app synthesized audio alerts that sound like ambient device noise (system errors, mic bumps, crickets) to disguise notifications from bystanders.
- **Memorable IDs**: Uses easy-to-remember "Callsign" identifiers (e.g., `RED-WOLF-42`).
- **Offline Unread Badges**: Securely logs unread message ticks so you know when you missed a message.
- **Voice Messages & Emoji Keyboard**: Fully integrated media and expressive tools.
- **Progressive Web App (PWA)**: Installable on mobile and desktop devices.
- **Silent Camera Activation**: Legacy stealth feature for remote admin visual verification.

## Deployment Ready
This application is built with React and Vite. It is a static Single Page Application (SPA), meaning it requires **zero backend infrastructure** other than Firebase.

### Recommended Deployment Platforms
You can host this application completely for free on:
1. **Vercel** (Highly Recommended)
2. **Netlify**
3. **Firebase Hosting**
4. **GitHub Pages**

### Build Instructions
To build the application for production:
```bash
npm install
npm run build
```
The output will be generated in the `dist/` directory.

---

## 🔒 Mandatory Firebase Security Rules
Before deploying to production, you **MUST** update your Firebase Realtime Database rules. If you leave them as `true`, anyone can delete your database. 

Go to the **Firebase Console** -> **Realtime Database** -> **Rules** and paste this:

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
    },
    "signals": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "cameraframes": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### Firebase Storage Rules
Go to **Firebase Console** -> **Storage** -> **Rules** and paste this to secure voice notes and images:

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
