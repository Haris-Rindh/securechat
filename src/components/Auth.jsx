import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, set, get, update } from "firebase/database";
import { generateKeyPair, exportPublicKey, exportPrivateKey, encryptPrivateKey, deriveKeyFromPassword } from "../crypto";
import { KeyRound, ShieldCheck, UserPlus, LogIn, AlertCircle } from "lucide-react";

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const genUID = () => {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        if (!id || !password) throw new Error("Please fill in all fields");
        const email = `${id.toUpperCase()}@securechat.local`;
        await signInWithEmailAndPassword(auth, email, password);
        
        // Fetch user data
        const userRef = ref(db, `users/${id.toUpperCase()}`);
        const snap = await get(userRef);
        if (!snap.exists()) throw new Error("User data not found");
        
        const userData = snap.val();
        await update(userRef, { online: true });
        
        onLogin(userData, password);
      } else {
        if (!name || password.length < 8) throw new Error("Name required and password min 8 chars");
        const uid = genUID();
        const email = `${uid}@securechat.local`;
        
        // Create auth user
        await createUserWithEmailAndPassword(auth, email, password);
        
        // Generate E2EE Keys
        const keyPair = await generateKeyPair();
        const pubKeyJwk = await exportPublicKey(keyPair.publicKey);
        const privKeyJwk = await exportPrivateKey(keyPair.privateKey);
        
        const pwdKey = await deriveKeyFromPassword(password, uid);
        const encryptedPrivKey = await encryptPrivateKey(privKeyJwk, pwdKey);
        
        const AV_COLORS = ["#00d4ff","#ff6b35","#a855f7","#00e676","#ff3b5c","#ffaa00","#3b82f6","#ec4899","#10b981","#f59e0b"];
        const col = AV_COLORS[Math.floor(Math.random() * AV_COLORS.length)];
        
        const userData = {
          name,
          uid,
          isAdmin: false,
          createdAt: Date.now(),
          online: true,
          avatarColor: col,
          bio: "",
          publicKey: pubKeyJwk,
          encPrivateKey: encryptedPrivKey
        };
        
        await set(ref(db, `users/${uid}`), userData);
        
        alert(`Account created successfully! Your unique ID is: ${uid}. Please save it!`);
        onLogin(userData, password);
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#0a1a2e,var(--color-bg)_70%)] p-4">
      <div className="max-w-md w-full glass-panel rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gradient mb-2 tracking-tight">SecureChat</h1>
          <p className="text-t3 text-xs uppercase tracking-[0.3em] font-semibold">End-to-End Encrypted</p>
        </div>

        <div className="flex bg-s1 rounded-xl p-1 mb-6 border border-b">
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isLogin ? 'bg-s3 text-a shadow-md' : 'text-t2 hover:text-white'}`}
            onClick={() => setIsLogin(true)}
          >
            LOGIN
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isLogin ? 'bg-s3 text-a shadow-md' : 'text-t2 hover:text-white'}`}
            onClick={() => setIsLogin(false)}
          >
            SIGN UP
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-[0.65rem] uppercase tracking-wider text-t2 mb-1.5 ml-1">Display Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full bg-s1 border border-b rounded-xl px-4 py-3 text-text focus:outline-none focus:border-a focus:ring-1 focus:ring-a transition-all"
                placeholder="Your name"
              />
            </div>
          )}
          
          {isLogin && (
            <div>
              <label className="block text-[0.65rem] uppercase tracking-wider text-t2 mb-1.5 ml-1">Your Unique ID</label>
              <input 
                type="text" 
                value={id} 
                onChange={e => setId(e.target.value.toUpperCase())}
                className="w-full bg-s1 border border-b rounded-xl px-4 py-3 text-text focus:outline-none focus:border-a focus:ring-1 focus:ring-a transition-all uppercase"
                placeholder="e.g. HK4R7BNP"
              />
            </div>
          )}

          <div>
            <label className="block text-[0.65rem] uppercase tracking-wider text-t2 mb-1.5 ml-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-s1 border border-b rounded-xl px-4 py-3 text-text focus:outline-none focus:border-a focus:ring-1 focus:ring-a transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-danger text-sm mt-2 bg-danger/10 p-3 rounded-lg border border-danger/20">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full bg-gradient-to-r from-a to-a2 text-black font-bold py-3.5 rounded-xl uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? "Processing..." : (isLogin ? "Login to SecureChat" : "Create Account")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-t2 flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-a" /> 
            Messages are <span className="text-a font-semibold">true end-to-end encrypted</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
