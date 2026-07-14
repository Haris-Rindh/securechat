# SecureChat

SecureChat is a privacy-first messaging app built with React + Vite. Messages and media are encrypted in the browser before they are stored in Firebase, so the backend cannot read plaintext chat content.

## What it does

- End-to-end encrypted text, files, images, and voice messages
- Local key management with Web Crypto (PBKDF2, ECDH, AES-GCM)
- Stealth/privacy controls (auto-lock PIN, duress mode, panic redirect)
- Disappearing messages and unread indicators
- PWA-ready frontend for installable web usage

## Architecture at a glance

SecureChat follows a client-side zero-trust model:

1. A password-derived key (PBKDF2) is generated locally from user input.
2. The user’s ECDH private key is encrypted client-side and stored encrypted in Firebase.
3. A shared key is derived per conversation (ECDH).
4. Messages/media are encrypted/decrypted locally with AES-GCM.
5. Firebase Realtime Database + Storage are used only for sync/storage of encrypted payloads.

## Runtime requirements

- Node.js + npm (for local development/build)
- A Firebase project with:
  - Authentication
  - Realtime Database
  - Cloud Storage

## Local setup

1. **Install dependencies**

   ```bash
   npm ci
   ```

2. **Create environment file**

   Create a `.env` file in the project root:

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

   These values are read in `src/firebase.js`. Use your own Firebase project values for local development.

3. **Start development server**

   ```bash
   npm run dev
   ```

4. **Open the app**

   Vite prints a local URL (typically `http://localhost:5173`).

## Available scripts

Defined in `package.json`:

- `npm run dev` – start local Vite dev server
- `npm run build` – create production build in `dist/`
- `npm run preview` – preview the built app locally
- `npm run lint` – run ESLint

## Project structure

```text
securechat/
├── src/
│   ├── App.jsx                # Top-level app shell and global state
│   ├── firebase.js            # Firebase initialization/config
│   ├── crypto.js              # Web Crypto helpers (key derivation, E2EE ops)
│   ├── audio.js               # Stealth notification sounds
│   └── components/
│       ├── Auth.jsx
│       ├── Chat.jsx
│       ├── Sidebar.jsx
│       ├── SettingsModal.jsx
│       ├── AdminMonitor.jsx
│       ├── BrowserPanel.jsx
│       └── DuressGame.jsx
├── public/                    # Static assets
├── dist/                      # Production build output
└── vite.config.js             # Vite + PWA configuration
```

## Firebase security rules (recommended baseline)

Apply strict Firebase rules in production so users can only read/write permitted paths.

### Realtime Database

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

### Cloud Storage

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

## Contributor quick check

Before opening a PR, run:

```bash
npm run lint
npm run build
```
