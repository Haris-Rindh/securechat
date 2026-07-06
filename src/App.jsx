import { useState, useEffect, useRef, useCallback } from "react";
import Auth from "./components/Auth";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import SettingsModal from "./components/SettingsModal";
import AdminMonitor from "./components/AdminMonitor";
import BrowserPanel from "./components/BrowserPanel";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { ref, onValue, off, update, get, set, remove } from "firebase/database";
import { decryptPrivateKey, deriveKeyFromPassword } from "./crypto";
import { playNotificationTone } from "./audio";
import { ShieldAlert, X } from "lucide-react";

export default function App() {
  const [user, setUser] = useState(() => {
    const storedUser = sessionStorage.getItem("scUser");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [privKeyJwk, setPrivKeyJwk] = useState(null);
  const [contacts, setContacts] = useState({});
  const [activeConv, setActiveConv] = useState(null);
  const [activePartner, setActivePartner] = useState(null);
  const [showMobile, setShowMobile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});

  const [isLocked, setIsLocked] = useState(false);
  const [isFakeUI, setIsFakeUI] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  const [lockInput, setLockInput] = useState("");
  const [isBeingMonitored, setIsBeingMonitored] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showAdminMonitor, setShowAdminMonitor] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  
  const lockTimerRef = useRef(null);
  const escapePresses = useRef(0);
  const escapeTimeout = useRef(null);


  // Keep track of previous tick to avoid playing sound on initial load
  const lastTickRef = useRef(0);

  // We can't automatically log in users who use True E2EE if we don't store their password,
  // because we need the password to decrypt their private key.
  // So we handle login explicitly in Auth.jsx and set the user there.

  // Panic Button Logic
  useEffect(() => {
    if (!user) return;
    const handleGlobalKeyDown = (e) => {
      const trigger = user.panicTrigger || "DoubleEscape";
      if (trigger === "DoubleEscape" && e.key === "Escape") {
        escapePresses.current += 1;
        if (escapePresses.current === 2) {
          window.location.href = "https://www.google.com";
        }
        clearTimeout(escapeTimeout.current);
        escapeTimeout.current = setTimeout(() => {
          escapePresses.current = 0;
        }, 500);
      } else if (trigger === "AltH" && e.altKey && e.key.toLowerCase() === "h") {
        window.location.href = "https://www.google.com";
      } else if (trigger === "CtrlShiftL" && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        window.location.href = "https://www.google.com";
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [user]);

  // Auto-Lock and Privacy Screen Logic
  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (!user?.lockPin) return;
    const timeoutMs = (user.autoLockTimeout || 1) * 60 * 1000;
    lockTimerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, timeoutMs);
  }, [user]);

  useEffect(() => {
    if (!user || !user.lockPin) return;

    const handleActivity = () => {
      if (!isLocked) resetLockTimer();
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !isFakeUI) {
        setIsLocked(true);
      } else {
        handleActivity();
      }
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resetLockTimer();

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(lockTimerRef.current);
    };
  }, [user, isLocked, resetLockTimer, isFakeUI]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (lockInput === user.lockPin) {
      setIsLocked(false);
      setIsFakeUI(false);
      setLockInput("");
      resetLockTimer();
    } else if (lockInput === user.duressPin && user.duressPin) {
      setIsLocked(false);
      setIsFakeUI(true);
      setLockInput("");
    } else {
      alert("Incorrect PIN");
      setLockInput("");
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const usersRef = ref(db, "users");
    
    if (user.isAdmin) {
      // Admins see all users
      const unsub = onValue(usersRef, (snap) => {
        const data = snap.val() || {};
        const newContacts = {};
        for (const [uid, u] of Object.entries(data)) {
          if (uid !== user.uid) {
            newContacts[uid] = u;
          }
        }
        setContacts(newContacts);
        if (activeConv && newContacts[activeConv]) {
          setActivePartner(newContacts[activeConv]);
        }
      });
      return () => off(usersRef, "value", unsub);
    } else {
      // Normal users only see contacts they added manually
      const addedContactsRef = ref(db, `users/${user.uid}/addedContacts`);
      const unsubAdded = onValue(addedContactsRef, async (snapAdded) => {
        const addedMap = snapAdded.val() || {};
        const snapUsers = await get(usersRef);
        const allUsers = snapUsers.val() || {};
        
        const newContacts = {};
        for (const uid of Object.keys(addedMap)) {
          const cleanUid = uid.toLowerCase();
          if (allUsers[cleanUid]) {
            newContacts[cleanUid] = allUsers[cleanUid];
          }
        }
        setContacts(newContacts);
        if (activeConv && newContacts[activeConv]) {
          setActivePartner(newContacts[activeConv]);
        }
      });
      return () => off(addedContactsRef, "value", unsubAdded);
    }
  }, [user, activeConv]);

  // Listen for Stealth Notification Ticks
  useEffect(() => {
    if (!user) return;
    const tickRef = ref(db, `users/${user.uid}/unreadTick`);
    const unsub = onValue(tickRef, (snap) => {
      const tick = snap.val();
      if (tick && tick > lastTickRef.current) {
        // If it's not the initial load and a new message arrived
        if (lastTickRef.current > 0 && user.notificationTone) {
          playNotificationTone(user.notificationTone);
          
          // Stealth Title Update
          const oldTitle = document.title;
          document.title = "SecureChat  ​"; // Zero-width space added
          setTimeout(() => document.title = oldTitle, 2000);
        }
        lastTickRef.current = tick;
      }
    });
    return () => off(tickRef, "value", unsub);
  }, [user]);

  // Listen for Unread Map
  useEffect(() => {
    if (!user) return;
    const unreadRef = ref(db, `users/${user.uid}/unreadMap`);
    const unsub = onValue(unreadRef, (snap) => {
      setUnreadMap(snap.val() || {});
    });
    return () => off(unreadRef, "value", unsub);
  }, [user]);

  // Disclosed Parental Camera Monitoring
  useEffect(() => {
    if (!user) return;
    const camRef = ref(db, `signals/camera/${user.uid}`);
    let localStream = null;
    let stopCap = false;
    let captureTimeout = null;

    const startFrameCapture = (stream) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
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
            ts: Date.now(),
          });
        } catch {
          // ignore write errors
        }
        if (!stopCap) captureTimeout = setTimeout(send, 200);
      };
      send();
    };

    const camUnsub = onValue(camRef, async (snap) => {
      const sig = snap.val();
      if (sig && sig.active) {
        setIsBeingMonitored(true);
        setBannerDismissed(false); // Reset banner dismiss state on new monitor session
        try {
          stopCap = false;
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          localStream = stream;
          startFrameCapture(stream);
        } catch {
          // Camera unavailable or permission denied
        }
      } else {
        setIsBeingMonitored(false);
        stopCap = true;
        if (captureTimeout) clearTimeout(captureTimeout);
        if (localStream) {
          localStream.getTracks().forEach((t) => t.stop());
          localStream = null;
        }
      }
    });

    return () => {
      off(camRef, "value", camUnsub);
      setIsBeingMonitored(false);
      stopCap = true;
      if (captureTimeout) clearTimeout(captureTimeout);
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [user]);

  // Listen for Remote Panic Redirect signals
  useEffect(() => {
    if (!user) return;
    const panicRef = ref(db, `signals/panic/${user.uid}`);
    const panicUnsub = onValue(panicRef, (snap) => {
      const sig = snap.val();
      if (sig && sig.active) {
        remove(panicRef);
        window.location.replace(sig.targetUrl || "https://www.google.com");
      }
    });
    return () => off(panicRef, "value", panicUnsub);
  }, [user]);

  // Clear unread badge for active conversation
  useEffect(() => {
    if (user && activeConv && unreadMap[activeConv]) {
      update(ref(db, `users/${user.uid}/unreadMap`), { [activeConv]: null });
    }
  }, [activeConv, unreadMap, user]);

  const handleLogin = async (userData, password) => {
    try {
      const pwdKey = await deriveKeyFromPassword(password, userData.uid);
      const decPrivKey = await decryptPrivateKey(userData.encPrivateKey, pwdKey);
      
      setUser(userData);
      setPrivKeyJwk(decPrivKey);
      
      sessionStorage.setItem("scUser", JSON.stringify(userData));
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
    setUser(null);
    setPrivKeyJwk(null);
    setActiveConv(null);
    setActivePartner(null);
  };

  const handleAddContact = async (uid) => {
    const cleanId = uid.trim().toLowerCase();
    if (cleanId === user.uid) return alert("You cannot add yourself.");
    
    const snap = await get(ref(db, `users/${cleanId}`));
    if (!snap.exists()) return alert("User ID not found. Verify with your contact.");
    
    await set(ref(db, `users/${user.uid}/addedContacts/${cleanId}`), true);
    alert(`Contact ${snap.val().name} added!`);
  };

  const handleSelectConv = (uid, partnerData) => {
    setActiveConv(uid);
    setActivePartner(partnerData);
  };



  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  if (isLocked) {
    return (
      <div className="flex h-screen w-screen bg-bg items-center justify-center font-sans">
        <form onSubmit={handleUnlock} className="glass-panel p-8 rounded-3xl max-w-sm w-full border border-s3 shadow-2xl flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-s2 rounded-full flex items-center justify-center border border-b shadow-inner">
            <span className="text-2xl opacity-50">🔒</span>
          </div>
          <h2 className="text-xl font-bold tracking-widest uppercase">App Locked</h2>
          <input 
            type="password" 
            autoFocus
            maxLength={4}
            value={lockInput} 
            onChange={e => setLockInput(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-s1 border border-b rounded-xl px-4 py-4 text-center text-2xl tracking-[1em] text-text focus:border-a outline-none transition-colors"
            placeholder="••••"
          />
          <button type="submit" disabled={lockInput.length !== 4} className="w-full py-3 bg-a/20 text-a rounded-xl font-bold uppercase tracking-widest hover:bg-a/30 disabled:opacity-50 transition-colors">
            Unlock
          </button>
        </form>
      </div>
    );
  }

  const fakeContacts = {
    "DUMMY1": { name: "Alex Smith", avatarColor: "#ec4899", online: true },
    "DUMMY2": { name: "Team Group", avatarColor: "#3b82f6", online: false },
    "DUMMY3": { name: "Mom", avatarColor: "#10b981", online: true },
  };

  const displayedContacts = isFakeUI ? fakeContacts : contacts;
  const displayedActiveConv = isFakeUI ? (activeConv && fakeContacts[activeConv] ? activeConv : null) : activeConv;
  const displayedActivePartner = isFakeUI ? fakeContacts[displayedActiveConv] : activePartner;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg font-sans text-text">

      {/* Parental Monitoring Active Banner — shows name and user can dismiss */}
      {isBeingMonitored && !bannerDismissed && (
        <div className="fixed top-0 left-0 right-0 z-[300] bg-warn text-black py-3 px-6 flex items-center justify-between font-bold text-sm shadow-2xl">
          <div className="flex items-center gap-2.5 mx-auto">
            <ShieldAlert size={18} />
            Parental Monitoring Active — {user.name}, your camera is currently being accessed by an administrator
          </div>
          <button onClick={() => setBannerDismissed(true)} className="p-1 hover:bg-black/10 rounded-md transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {showSettings && (
        <SettingsModal 
          user={user} 
          onClose={() => setShowSettings(false)} 
          onUpdate={(updates) => {
            const newUser = { ...user, ...updates };
            setUser(newUser);
            sessionStorage.setItem("scUser", JSON.stringify(newUser));
          }}
        />
      )}

      {showAdminMonitor && user?.isAdmin && (
        <AdminMonitor
          user={user}
          contacts={contacts}
          onClose={() => setShowAdminMonitor(false)}
        />
      )}
      
      <Sidebar 
        user={user} 
        contacts={displayedContacts} 
        activeConv={displayedActiveConv} 
        unreadMap={unreadMap}
        onSelectConv={handleSelectConv} 
        onAddContact={handleAddContact}
        onLogout={handleLogout}
        showMobile={showMobile}
        setShowMobile={setShowMobile}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMonitor={user?.isAdmin ? () => setShowAdminMonitor(true) : null}
        onOpenBrowser={() => setShowBrowser(!showBrowser)}
        isIncognito={isIncognito}
        onToggleIncognito={() => setIsIncognito(!isIncognito)}
      />
      
      <div className="flex-1 flex min-w-0 relative h-full">
        <div className="flex-1 flex flex-col min-w-0 relative h-full">
          {displayedActiveConv && displayedActivePartner ? (
            <Chat 
              user={user} 
              privKeyJwk={privKeyJwk} 
              partnerId={displayedActiveConv} 
              partner={displayedActivePartner} 
              onToggleSidebar={() => setShowMobile(true)}
              isFakeUI={isFakeUI}
              isIncognito={isIncognito}
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

        {/* Embedded Stealth Browser Panel */}
        {showBrowser && (
          <BrowserPanel onClose={() => setShowBrowser(false)} />
        )}
      </div>
    </div>
  );
}
