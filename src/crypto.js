// Crypto utilities for True End-to-End Encryption
export async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
}

// Derive AES key from a password to encrypt/decrypt the user's private key
export async function deriveKeyFromPassword(password, uid) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode(uid), iterations: 100000, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPrivateKey(privateKeyJwkT, passwordKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(privateKeyJwkT));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, passwordKey, data);
  return btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(enc)));
}

export async function decryptPrivateKey(cipherBase64, passwordKey) {
  const raw = atob(cipherBase64);
  const iv = new Uint8Array([...raw].slice(0, 12).map(c => c.charCodeAt(0)));
  const data = new Uint8Array([...raw].slice(12).map(c => c.charCodeAt(0)));
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, passwordKey, data);
  return JSON.parse(new TextDecoder().decode(dec));
}

// Generate ECDH Key Pair
export async function generateKeyPair() {
  return await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

export async function exportPublicKey(key) {
  const exported = await crypto.subtle.exportKey("jwk", key);
  return exported;
}

export async function exportPrivateKey(key) {
  const exported = await crypto.subtle.exportKey("jwk", key);
  return exported;
}

export async function importPublicKey(jwk) {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

export async function importPrivateKey(jwk) {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// Derive Shared Secret between my private key and their public key
export async function deriveSharedSecret(myPrivateKey, theirPublicKey) {
  return await crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt Message using Shared Secret
export async function encryptMessage(text, sharedKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...iv) + String.fromCharCode(...new Uint8Array(enc)));
}

// Decrypt Message using Shared Secret
export async function decryptMessage(cipher, sharedKey) {
  try {
    const raw = atob(cipher);
    const iv = new Uint8Array([...raw].slice(0, 12).map(c => c.charCodeAt(0)));
    const data = new Uint8Array([...raw].slice(12).map(c => c.charCodeAt(0)));
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, data);
    return new TextDecoder().decode(dec);
  } catch {
    return "[Encrypted message - could not decrypt]";
  }
}
