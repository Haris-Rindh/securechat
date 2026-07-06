import { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set, get, update } from "firebase/database";
import { generateKeyPair, exportPublicKey, exportPrivateKey, encryptPrivateKey, deriveKeyFromPassword } from "../crypto";
import { AlertCircle, Lock, ShieldCheck, Eye, EyeOff, Clipboard, Check, X } from "lucide-react";

// Change this secret before deploying. Only the admin should know it.
const ADMIN_SECRET = "SECURECHAT-ADMIN-2024";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [consentMonitoring, setConsentMonitoring] = useState(false);

  // Hidden admin access — logo click counter
  const [logoClicks, setLogoClicks] = useState(0);
  const [showAdminField, setShowAdminField] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");

  // Registration success modal state
  const [regSuccessId, setRegSuccessId] = useState("");
  const [savedUserData, setSavedUserData] = useState(null);
  const [savedPassword, setSavedPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const handleLogoClick = () => {
    const next = logoClicks + 1;
    setLogoClicks(next);
    if (next >= 5) {
      setShowAdminField(true);
      setLogoClicks(0);
    }
  };

  const genUID = () => {
    const adjs = ["RED", "BLUE", "NEON", "DARK", "FAST", "WILD", "NOVA", "CYBER", "GHOST", "ZERO"];
    const nouns = ["WOLF", "FOX", "HAWK", "BEAR", "LION", "OWL", "VIPER", "RAVEN", "STORM", "WAVE"];
    const adj = adjs[Math.floor(Math.random() * adjs.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 99) + 1;
    return `${adj}-${noun}-${num}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ── LOGIN ──────────────────────────────────────────────────────────────
      if (mode === "login") {
        if (!id || !password) throw new Error("Please enter your User ID and password.");
        const cleanId = id.trim().toLowerCase();
        const email = `${cleanId}@securechat.local`;
        await signInWithEmailAndPassword(auth, email, password);

        const userRef = ref(db, `users/${cleanId}`);
        const snap = await get(userRef);
        if (!snap.exists()) throw new Error("User not found. Check your User ID.");

        const userData = snap.val();
        await update(userRef, { online: true });
        onLogin(userData, password);
      }

      // ── REGISTER ───────────────────────────────────────────────────────────
      else if (mode === "register") {
        if (!name.trim()) throw new Error("Please enter a display name.");
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (!consentMonitoring) throw new Error("You must agree to the monitoring disclosure.");

        // Check if admin secret is provided and correct
        const isAdminRegistration = showAdminField && adminSecret.trim() !== "";
        if (isAdminRegistration && adminSecret !== ADMIN_SECRET) {
          throw new Error("Incorrect admin secret key.");
        }

        const uid = genUID().toLowerCase();
        const email = `${uid}@securechat.local`;
        await createUserWithEmailAndPassword(auth, email, password);

        const keyPair = await generateKeyPair();
        const pubKeyJwk = await exportPublicKey(keyPair.publicKey);
        const privKeyJwk = await exportPrivateKey(keyPair.privateKey);
        const pwdKey = await deriveKeyFromPassword(password, uid);
        const encryptedPrivKey = await encryptPrivateKey(privKeyJwk, pwdKey);

        const AV_COLORS = ["#00d4ff","#ff6b35","#a855f7","#00e676","#ff3b5c","#ffaa00","#3b82f6","#ec4899","#10b981","#f59e0b"];
        const col = AV_COLORS[Math.floor(Math.random() * AV_COLORS.length)];

        const userData = {
          name: name.trim(),
          uid: uid,
          isAdmin: isAdminRegistration,
          createdAt: Date.now(),
          online: true,
          avatarColor: col,
          bio: isAdminRegistration ? "Administrator" : "",
          publicKey: pubKeyJwk,
          encPrivateKey: encryptedPrivKey,
          monitoringConsent: true
        };

        await set(ref(db, `users/${uid}`), userData);
        
        // Save state to proceed to chat after they close the success modal
        setSavedUserData(userData);
        setSavedPassword(password);
        setRegSuccessId(uid.toUpperCase());
      }

    } catch (err) {
      // Translate Firebase error codes into plain English
      let msg = err.message.replace("Firebase: ", "");
      if (msg.includes("auth/configuration-not-found") || msg.includes("configuration-not-found")) {
        msg = "Firebase Authentication is not enabled. Go to Firebase Console → Authentication → Sign-in method → Enable Email/Password.";
      } else if (msg.includes("auth/user-not-found") || msg.includes("auth/invalid-credential")) {
        msg = "Incorrect User ID or password. Please try again.";
      } else if (msg.includes("auth/email-already-in-use")) {
        msg = "An account with this ID already exists. Please log in instead.";
      } else if (msg.includes("auth/weak-password")) {
        msg = "Password is too weak. Use at least 8 characters.";
      } else if (msg.includes("auth/network-request-failed")) {
        msg = "Network error. Check your internet connection and try again.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(regSuccessId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseSuccessModal = () => {
    if (savedUserData) {
      onLogin(savedUserData, savedPassword);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#0a1a2e,var(--color-bg)_70%)] p-4">
      {/* Registration Success Custom Modal Popup */}
      {regSuccessId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-s1 border border-b rounded-3xl w-full max-w-sm p-6 shadow-2xl overflow-hidden flex flex-col text-center items-center relative border-a/20 animate-scale-up">
            <div className="w-12 h-12 bg-a/10 border border-a/30 rounded-full flex items-center justify-center mb-4">
              <Check size={24} className="text-a" />
            </div>
            <h2 className="font-bold text-lg text-text">Account Created!</h2>
            <p className="text-xs text-t2 mt-2 leading-relaxed px-2">
              Write down your unique User ID below. You must use this ID (not your Display Name) to log in next time. Keep it safe!
            </p>
            
            <div className="w-full bg-s2 border border-b rounded-xl p-4 my-4 flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-base text-a tracking-wider select-all">
                {regSuccessId}
              </span>
              <button 
                onClick={copyToClipboard}
                className="p-2 hover:bg-s3 rounded-lg transition-colors text-t2 hover:text-text shrink-0"
                title="Copy User ID"
              >
                {copied ? <Check size={16} className="text-ok" /> : <Clipboard size={16} />}
              </button>
            </div>

            <button
              onClick={handleCloseSuccessModal}
              className="w-full bg-a text-bg font-bold py-3 rounded-xl uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform shadow-[0_4px_16px_rgba(0,212,255,0.3)] mt-2"
            >
              Start Chatting
            </button>
          </div>
        </div>
      )}

      <div className="max-w-sm w-full glass-panel rounded-3xl p-8 shadow-2xl relative z-10 border border-s3">

        {/* Branding — clicking the icon 5 times reveals hidden admin field */}
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 bg-a/10 border border-a/30 rounded-2xl flex items-center justify-center mx-auto mb-3 cursor-pointer select-none"
            onClick={handleLogoClick}
            title=""
          >
            <Lock size={22} className="text-a" />
          </div>
          <h1 className="text-xl font-bold text-text tracking-wide">SecureChat</h1>
          <p className="text-[0.65rem] text-t3 mt-1">End-to-End Encrypted Messaging</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-s1 rounded-xl p-1 mb-6 border border-b gap-1">
          <button
            type="button"
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${mode === "login" ? "bg-s3 text-text shadow-md" : "text-t3 hover:text-t2"}`}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${mode === "register" ? "bg-s3 text-text shadow-md" : "text-t3 hover:text-t2"}`}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Login — User ID */}
          {mode === "login" && (
            <div>
              <label className="block text-xs text-t2 mb-1.5 ml-1">Your User ID</label>
              <input
                type="text"
                value={id}
                onChange={e => setId(e.target.value.toUpperCase())}
                className="w-full bg-s1 border border-b rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-a transition-all uppercase"
                placeholder="e.g. NEON-HAWK-72"
                autoComplete="username"
              />
              <p className="text-[0.6rem] text-t3 mt-1 ml-1">This was shown to you when you registered.</p>
            </div>
          )}

          {/* Sign Up — Display Name */}
          {mode === "register" && (
            <div>
              <label className="block text-xs text-t2 mb-1.5 ml-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-s1 border border-b rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-a transition-all"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          {/* Hidden Admin Secret Field — only visible after 5 logo clicks, on Sign Up tab */}
          {showAdminField && mode === "register" && (
            <div>
              <label className="block text-xs text-warn mb-1.5 ml-1 flex items-center gap-1">
                <ShieldCheck size={12} /> Admin Key (optional)
              </label>
              <input
                type="password"
                value={adminSecret}
                onChange={e => setAdminSecret(e.target.value)}
                className="w-full bg-warn/5 border border-warn/20 rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-warn transition-all"
                placeholder="Leave blank for regular account"
              />
            </div>
          )}

          {/* Password — all modes, with eye show/hide option */}
          <div>
            <label className="block text-xs text-t2 mb-1.5 ml-1">Password</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-s1 border border-b rounded-xl pl-4 pr-11 py-3 text-text text-sm focus:outline-none focus:border-a transition-all"
                placeholder={mode === "login" ? "Your password" : "Min. 8 characters"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-t2 hover:text-text transition-colors p-1"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Parental Monitoring Consent — Sign Up only */}
          {mode === "register" && (
            <div className="p-3.5 bg-warn/5 border border-warn/20 rounded-xl space-y-2.5">
              <p className="text-[0.6rem] font-bold text-warn uppercase tracking-wider">Parental Monitoring Disclosure</p>
              <p className="text-[0.65rem] text-t2 leading-relaxed">
                An administrator (parent or guardian) may remotely activate your device camera for safety monitoring. A visible banner will always be shown on your screen whenever your camera is being accessed.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentMonitoring}
                  onChange={e => setConsentMonitoring(e.target.checked)}
                  className="mt-0.5 accent-warn w-4 h-4 shrink-0"
                />
                <span className="text-[0.65rem] text-t2 leading-relaxed">
                  I understand and agree to parental camera monitoring.
                </span>
              </label>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-danger text-xs bg-danger/10 p-3 rounded-lg border border-danger/20">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mode === "register" && !consentMonitoring)}
            className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-2 bg-s2 border border-s3 text-text hover:bg-s3"
          >
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

      </div>
    </div>
  );
}
