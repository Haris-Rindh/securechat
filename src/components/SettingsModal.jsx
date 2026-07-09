<<<<<<< HEAD
import { useState, useEffect } from "react";
import { X, Volume2, ShieldAlert, Lock, Timer, Zap, Link, Camera, Key } from "lucide-react";
=======
import { useState } from "react";
import { X, Volume2, ShieldAlert, Lock, Timer, Zap, Link } from "lucide-react";
>>>>>>> af7619453dffa22c175d0c4d612abf4a293056ab
import { ref, update, get, set, remove } from "firebase/database";
import { updateEmail } from "firebase/auth";
import { auth, db } from "../firebase";
import { playNotificationTone } from "../audio";
import { encryptAvatar, decryptAvatar, generateKeyPair, exportPublicKey, exportPrivateKey, encryptPrivateKey } from "../crypto";

const TONES = [
  { id: "none", name: "Silent (No Sound)" },
  { id: "subtle_tap", name: "Subtle Tap (Like a mic bump)" },
  { id: "system_error", name: "System Error (Generic OS sound)" },
  { id: "soft_sine", name: "Soft Sine (Gentle wave)" },
  { id: "cricket", name: "Cricket (Tiny chirp)" }
];

const PANIC_TRIGGERS = [
  { id: "DoubleEscape", name: "Double-tap Escape" },
  { id: "AltH", name: "Alt + H" },
  { id: "CtrlShiftL", name: "Ctrl + Shift + L" }
];

const DISAPPEARING_TIMERS = [
  { id: 0, name: "Off" },
  { id: 30, name: "30 Seconds" },
  { id: 300, name: "5 Minutes" },
  { id: 3600, name: "1 Hour" }
];

export default function SettingsModal({ user, passwordKey, onClose, onUpdate, showToast }) {
  const [tone, setTone] = useState(user.notificationTone || "none");
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || "");
  const [newUid, setNewUid] = useState(user.uid.toUpperCase());
  const [lockPin, setLockPin] = useState(user.lockPin || "");
  const [duressPin, setDuressPin] = useState(user.duressPin || "");
  const [autoLockTimeout, setAutoLockTimeout] = useState(user.autoLockTimeout || 1);
  const [disappearingTimer, setDisappearingTimer] = useState(user.disappearingTimer || 0);
  const [panicTrigger, setPanicTrigger] = useState(user.panicTrigger || "DoubleEscape");
  const [panicUrl, setPanicUrl] = useState(user.panicUrl || "https://www.google.com");
  
<<<<<<< HEAD
  const [avatarB64, setAvatarB64] = useState("");
  const [newPublicKey, setNewPublicKey] = useState(null);
  const [newEncPrivateKey, setNewEncPrivateKey] = useState(null);
  const [keyRotated, setKeyRotated] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (user.avatarData) {
      const decrypt = async () => {
        const decrypted = await decryptAvatar(user.avatarData, user.uid);
        if (decrypted) setAvatarB64(decrypted);
      };
      decrypt();
    }
  }, [user.avatarData, user.uid]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 96, 96);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setAvatarB64(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRotateKeys = async () => {
    if (!passwordKey) {
      setErrorMsg("E2EE key rotation requires an active session key. Please re-login.");
      return;
    }
    try {
      setLoading(true);
      const keyPair = await generateKeyPair();
      const pubKeyJwk = await exportPublicKey(keyPair.publicKey);
      const privKeyJwkNew = await exportPrivateKey(keyPair.privateKey);
      
      const encryptedPrivKey = await encryptPrivateKey(privKeyJwkNew, passwordKey);
      setNewPublicKey(pubKeyJwk);
      setNewEncPrivateKey(encryptedPrivKey);
      setKeyRotated(true);
      if (showToast) showToast("New encryption keys generated. Save settings to apply.", "success");
    } catch (err) {
      setErrorMsg("Failed to rotate keys: " + err.message);
    } finally {
      setLoading(false);
    }
  };
=======
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
>>>>>>> af7619453dffa22c175d0c4d612abf4a293056ab

  const handleTestTone = (selectedTone) => {
    setTone(selectedTone);
    playNotificationTone(selectedTone);
  };

  const handleSave = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const cleanNewUid = newUid.trim().toLowerCase();
      const oldUid = user.uid.toLowerCase();
      let finalUid = user.uid;

<<<<<<< HEAD
      // Encrypt avatar if changed/set
      let encryptedAvatarData = user.avatarData || "";
      if (avatarB64) {
        encryptedAvatarData = await encryptAvatar(avatarB64, cleanNewUid);
      }

      // Format custom Panic URL prefix if missing protocol
      let formattedPanicUrl = panicUrl.trim();
      if (formattedPanicUrl && !/^https?:\/\//i.test(formattedPanicUrl)) {
        formattedPanicUrl = "https://" + formattedPanicUrl;
      }

=======
>>>>>>> af7619453dffa22c175d0c4d612abf4a293056ab
      // Handle User ID Change
      if (cleanNewUid !== oldUid) {
        if (cleanNewUid.length < 3) {
          throw new Error("User ID must be at least 3 characters.");
        }
        if (!/^[a-z0-9_-]+$/.test(cleanNewUid)) {
          throw new Error("User ID can only contain letters, numbers, hyphens, and underscores.");
        }

        // Check if new User ID already exists in database
        const snap = await get(ref(db, `users/${cleanNewUid}`));
        if (snap.exists()) {
          throw new Error("This User ID is already taken. Try another.");
        }

        // Update email in Firebase Auth
        const newEmail = `${cleanNewUid}@securechat.local`;
        await updateEmail(auth.currentUser, newEmail);

        // Fetch old user profile data to migrate
        const oldUserSnap = await get(ref(db, `users/${oldUid}`));
        const oldUserData = oldUserSnap.val() || {};

        // Migrate profile node to new ID
        const migratedUserData = {
          ...oldUserData,
          uid: cleanNewUid,
<<<<<<< HEAD
          name: name.trim() || oldUserData.name,
          avatarData: encryptedAvatarData
        };

        if (keyRotated && newPublicKey && newEncPrivateKey) {
          migratedUserData.publicKey = newPublicKey;
          migratedUserData.encPrivateKey = newEncPrivateKey;
        }

        await set(ref(db, `users/${cleanNewUid}`), migratedUserData);
        await remove(ref(db, `users/${oldUid}`));
        finalUid = cleanNewUid;
      } else {
        // Standard save
        const updates = { 
          name: name.trim(), 
          bio, 
          uid: finalUid,
          notificationTone: tone,
          lockPin,
          duressPin,
          autoLockTimeout: Number(autoLockTimeout),
          disappearingTimer: Number(disappearingTimer),
          panicTrigger,
          panicUrl: formattedPanicUrl || "https://www.google.com",
          avatarData: encryptedAvatarData
        };

        if (keyRotated && newPublicKey && newEncPrivateKey) {
          updates.publicKey = newPublicKey;
          updates.encPrivateKey = newEncPrivateKey;
        }

        await update(ref(db, `users/${finalUid}`), updates);
      }

      const updatePayload = { 
=======
          name: name.trim() || oldUserData.name
        };
        await set(ref(db, `users/${cleanNewUid}`), migratedUserData);
        
        // Delete old user node
        await remove(ref(db, `users/${oldUid}`));

        finalUid = cleanNewUid;
      }

      // Format custom Panic URL prefix if missing protocol
      let formattedPanicUrl = panicUrl.trim();
      if (formattedPanicUrl && !/^https?:\/\//i.test(formattedPanicUrl)) {
        formattedPanicUrl = "https://" + formattedPanicUrl;
      }

      const updates = { 
>>>>>>> af7619453dffa22c175d0c4d612abf4a293056ab
        name: name.trim(), 
        bio, 
        uid: finalUid,
        notificationTone: tone,
        lockPin,
        duressPin,
        autoLockTimeout: Number(autoLockTimeout),
        disappearingTimer: Number(disappearingTimer),
        panicTrigger,
<<<<<<< HEAD
        panicUrl: formattedPanicUrl || "https://www.google.com",
        avatarData: encryptedAvatarData
      };
      if (keyRotated && newPublicKey && newEncPrivateKey) {
        updatePayload.publicKey = newPublicKey;
        updatePayload.encPrivateKey = newEncPrivateKey;
      }

      onUpdate(updatePayload);
=======
        panicUrl: formattedPanicUrl || "https://www.google.com"
      };

      await update(ref(db, `users/${finalUid}`), updates);
      onUpdate(updates);
>>>>>>> af7619453dffa22c175d0c4d612abf4a293056ab
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-s1 border border-b rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-b bg-s2 shrink-0">
          <h2 className="font-bold text-lg text-text">Profile & Security</h2>
          <button onClick={onClose} className="p-1 hover:bg-danger/20 hover:text-danger rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger flex items-center gap-2">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          
          {/* Profile Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-t3 uppercase tracking-wider">Profile</h3>
            
<<<<<<< HEAD
            {/* E2EE Display Picture (DP) Upload */}
            <div className="flex items-center gap-4 bg-s2 p-3.5 border border-b rounded-2xl">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-s3 border border-b flex items-center justify-center font-bold text-lg text-t2 overflow-hidden">
                  {avatarB64 ? (
                    <img src={avatarB64} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-a flex items-center justify-center text-black cursor-pointer shadow hover:scale-105 transition-transform">
                  <Camera size={12} />
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">Profile Photo (E2EE)</div>
                <div className="text-[0.65rem] text-t3 mt-0.5 leading-relaxed">
                  Compressed & encrypted locally. Only added contacts can view it.
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-t2 mb-1.5 ml-1">Display Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-t2 mb-1.5 ml-1">Unique User ID</label>
                <input 
                  type="text" 
                  value={newUid} 
                  onChange={e => setNewUid(e.target.value)}
                  className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors font-mono uppercase"
                  placeholder="USER-ID"
                />
              </div>
            </div>
            
=======
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-t2 mb-1.5 ml-1">Display Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-t2 mb-1.5 ml-1">Unique User ID</label>
                <input 
                  type="text" 
                  value={newUid} 
                  onChange={e => setNewUid(e.target.value)}
                  className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors font-mono uppercase"
                  placeholder="USER-ID"
                />
              </div>
            </div>
            
>>>>>>> af7619453dffa22c175d0c4d612abf4a293056ab
            <div>
              <label className="block text-xs text-t2 mb-1.5 ml-1">Bio (Optional)</label>
              <textarea 
                value={bio} 
                onChange={e => setBio(e.target.value)}
                maxLength={120}
                rows={2}
                className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors resize-none"
              />
              <div className="text-right text-[0.6rem] text-t3 mt-1">{bio.length}/120</div>
            </div>
          </div>

          {/* Advanced Security Section */}
          <div className="space-y-4 pt-4 border-t border-b">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={16} className="text-a" />
              <h3 className="text-xs font-bold text-a uppercase tracking-wider">Access Security</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-t2 mb-1.5 ml-1">Lock PIN (4 digits)</label>
                <input 
                  type="password" 
                  maxLength={4}
                  value={lockPin} 
                  onChange={e => setLockPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors"
                  placeholder="e.g. 1234"
                />
              </div>
              <div>
                <label className="block text-xs text-danger mb-1.5 ml-1">Duress PIN (Dummy UI)</label>
                <input 
                  type="password" 
                  maxLength={4}
                  value={duressPin} 
                  onChange={e => setDuressPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-danger/5 border border-danger/20 rounded-xl px-4 py-2.5 text-sm text-danger focus:border-danger outline-none transition-colors"
                  placeholder="e.g. 9999"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-t2 mb-1.5 ml-1">Auto-Lock Timeout (Minutes)</label>
              <input 
                type="number" 
                min={1}
                max={60}
                value={autoLockTimeout} 
                onChange={e => setAutoLockTimeout(e.target.value)}
                className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors"
              />
            </div>

            {/* Key Rotation Control */}
            <div className="bg-s2 border border-b p-3.5 rounded-2xl flex items-center justify-between gap-3 mt-4">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Key size={12} className="text-a" /> Key Pair Management
                </div>
                <p className="text-[0.6rem] text-t3 mt-1 leading-relaxed">
                  {keyRotated ? "✓ New P-256 Key pair ready to save" : "Rotate ECDH encryption keys for forward secrecy."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRotateKeys}
                disabled={loading}
                className="px-3 py-1.5 bg-a/10 border border-a/20 text-a rounded-xl hover:bg-a/20 transition-all text-xs font-bold shrink-0 disabled:opacity-50"
              >
                Rotate Keys
              </button>
            </div>
          </div>

          {/* Privacy Features Section */}
          <div className="space-y-4 pt-4 border-t border-b">
            <div className="flex items-center gap-2 mb-1">
              <Timer size={16} className="text-a" />
              <h3 className="text-xs font-bold text-a uppercase tracking-wider">Privacy Settings</h3>
            </div>
            
            <div>
              <label className="block text-xs text-t2 mb-1.5 ml-1">Disappearing Messages</label>
              <select 
                value={disappearingTimer} 
                onChange={e => setDisappearingTimer(e.target.value)}
                className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors appearance-none"
              >
                {DISAPPEARING_TIMERS.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-t2 mb-1.5 ml-1 flex items-center gap-1">
                  <Zap size={12} /> Panic Trigger
                </label>
                <select 
                  value={panicTrigger} 
                  onChange={e => setPanicTrigger(e.target.value)}
                  className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors appearance-none"
                >
                  {PANIC_TRIGGERS.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-t2 mb-1.5 ml-1 flex items-center gap-1">
                  <Link size={12} /> Panic Website
                </label>
                <input 
                  type="text" 
                  value={panicUrl}
                  onChange={(e) => setPanicUrl(e.target.value)}
                  className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-xs text-text focus:border-a outline-none transition-colors"
                  placeholder="e.g. google.com"
                />
              </div>
            </div>
          </div>

          {/* Secure Notifications Section */}
          <div className="space-y-4 pt-4 border-t border-b">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={16} className="text-warn" />
              <h3 className="text-xs font-bold text-warn uppercase tracking-wider">Stealth Notifications</h3>
            </div>
            <p className="text-[0.65rem] text-t2 leading-relaxed bg-warn/5 p-3 border border-warn/10 rounded-lg">
              To keep your privacy absolute, notifications do not show banners on your screen. 
              Instead, pick a generic background sound that only you recognize.
            </p>
            
            <div className="space-y-2 mt-4">
              {TONES.map(t => (
                <label key={t.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${tone === t.id ? 'bg-s3 border-a' : 'bg-bg border-b hover:border-t3'}`}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="tone" 
                      value={t.id} 
                      checked={tone === t.id}
                      onChange={() => handleTestTone(t.id)}
                      className="accent-a"
                    />
                    <span className="text-sm">{t.name}</span>
                  </div>
                  {tone === t.id && t.id !== "none" && <Volume2 size={16} className="text-a" />}
                </label>
              ))}
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-b bg-s2 flex gap-3 shrink-0">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-b text-t2 hover:text-text hover:bg-s3 transition-colors text-sm font-semibold disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-a to-a2 text-black hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all text-sm font-bold disabled:opacity-50">
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>

      </div>
    </div>
  );
}
