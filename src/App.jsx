import { useState, useEffect, useRef, useCallback } from "react";
import Auth from "./components/Auth";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import SettingsModal from "./components/SettingsModal";
import AdminMonitor from "./components/AdminMonitor";
import BrowserPanel from "./components/BrowserPanel";
import DuressGame from "./components/DuressGame";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import { ref, onValue, off, update, get, set, remove } from "firebase/database";
import { decryptPrivateKey, deriveKeyFromPassword } from "./crypto";
import { playNotificationTone } from "./audio";
import { ShieldAlert, X } from "lucide-react";

export default function App() {
  const [user, setUser] = useState(null);
  const [privKeyJwk, setPrivKeyJwk] = useState(null);
  const [passwordKey, setPasswordKey] = useState(null);
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
  
  // Custom Alert (Toast) & Confirmation Modal states
  const [toasts, setToasts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const showToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const showConfirm = useCallback((message, onConfirm) => {
    setConfirmConfig({ message, onConfirm });
  }, []);
  
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
      const targetUrl = user.panicUrl || "https://www.google.com";

      const executePanic = () => {
        // Clear all state to force login on next load
        setUser(null);
        setPrivKeyJwk(null);
        setActiveConv(null);
        setActivePartner(null);
        window.location.replace(targetUrl);
      };

      if (trigger === "DoubleEscape" && e.key === "Escape") {
        escapePresses.current += 1;
        if (escapePresses.current === 2) {
          executePanic();
        }
        clearTimeout(escapeTimeout.current);
        escapeTimeout.current = setTimeout(() => {
          escapePresses.current = 0;
        }, 500);
      } else if (trigger === "AltH" && e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        executePanic();
      } else if (trigger === "CtrlShiftL" && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        executePanic();
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
      showToast("Incorrect PIN. Access Denied.", "danger");
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

  // Anti-Screenshot and Anti-Copy Protection for Normal Users
  useEffect(() => {
    if (!user || user.isAdmin) return;

    const handleCopyCut = (e) => {
      e.preventDefault();
      showToast("Copying text is disabled for security.", "warn");
    };

    const handleKeyDown = (e) => {
      // Block PrintScreen key, Ctrl+P (Print), and Cmd+Shift+4 (Mac shot shortcut, though browser block is limited)
      if (
        e.key === "PrintScreen" || 
        (e.key === "p" && (e.ctrlKey || e.metaKey)) ||
        (e.key === "s" && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault();
        showToast("Screenshots are blocked on this page.", "danger");
      }
    };

    window.addEventListener("copy", handleCopyCut);
    window.addEventListener("cut", handleCopyCut);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("copy", handleCopyCut);
      window.removeEventListener("cut", handleCopyCut);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [user]);

  // Clear unread badge for active conversation
  useEffect(() => {
    if (user && activeConv && unreadMap[activeConv]) {
      update(ref(db, `users/${user.uid}/unreadMap`), { [activeConv]: null });
    }
  }, [activeConv, unreadMap, user]);

  const handleLogin = async (userData, password, isDuress = false) => {
    if (isDuress) {
      setUser(userData);
      setIsFakeUI(true);
      setIsLocked(false);
      showToast("Duress UI initialized successfully.", "warn");
      return;
    }

    try {
      const pwdKey = await deriveKeyFromPassword(password, userData.uid);
      const decPrivKey = await decryptPrivateKey(userData.encPrivateKey, pwdKey);
      
      setUser(userData);
      setPrivKeyJwk(decPrivKey);
      setPasswordKey(pwdKey);
    } catch (err) {
      console.error("Failed to decrypt private key:", err);
      showToast("Key decryption failed. E2EE messaging is disabled.", "danger");
      setUser(userData);
    }
  };

  const handleLogout = async () => {
    if (user) {
      await update(ref(db, `users/${user.uid}`), { online: false });
    }
    await signOut(auth);
    setUser(null);
    setPrivKeyJwk(null);
    setPasswordKey(null);
    setActiveConv(null);
    setActivePartner(null);
  };

  const handleAddContact = async (uid) => {
    const cleanId = uid.trim().toLowerCase();
    if (cleanId === user.uid) return showToast("You cannot add yourself.", "warn");
    
    const snap = await get(ref(db, `users/${cleanId}`));
    if (!snap.exists()) return showToast("User ID not found.", "danger");
    
    await set(ref(db, `users/${user.uid}/addedContacts/${cleanId}`), true);
    showToast(`Contact ${snap.val().name} added!`, "success");
  };

  const handleSelectConv = (uid, partnerData) => {
    setActiveConv(uid);
    setActivePartner(partnerData);
  };



  if (!user) {
    return <Auth onLogin={handleLogin} showToast={showToast} />;
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

  // ── Duress Mode: Show full-screen game instead of chat ──
  if (isFakeUI) {
    return (
      <DuressGame onExit={() => {
        setIsFakeUI(false);
        handleLogout();
      }} />
    );
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-bg font-sans text-text ${!user?.isAdmin ? 'no-screenshot' : ''}`}>

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
          passwordKey={passwordKey}
          onClose={() => setShowSettings(false)} 
          onUpdate={(updates) => {
            const newUser = { ...user, ...updates };
            setUser(newUser);
          }}
          showToast={showToast}
        />
      )}

      {showAdminMonitor && user?.isAdmin && (
        <AdminMonitor
          user={user}
          contacts={contacts}
          onClose={() => setShowAdminMonitor(false)}
          showToast={showToast}
          showConfirm={showConfirm}
        />
      )}
      
      <Sidebar 
        user={user} 
        contacts={contacts} 
        activeConv={activeConv} 
        unreadMap={unreadMap}
        onSelectConv={(uid, partnerData) => {
          handleSelectConv(uid, partnerData);
          setShowMobile(false); // Hide sidebar on mobile when selecting a chat
        }}
        onAddContact={handleAddContact}
        onLogout={handleLogout}
        showMobile={!activeConv || showMobile}
        setShowMobile={setShowMobile}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMonitor={user?.isAdmin ? () => setShowAdminMonitor(true) : null}
        onOpenBrowser={() => setShowBrowser(!showBrowser)}
        isIncognito={isIncognito}
        onToggleIncognito={() => setIsIncognito(!isIncognito)}
        showToast={showToast}
      />
      
      <div className={`flex-1 flex min-w-0 relative h-full ${activeConv ? 'flex' : 'hidden md:flex'}`}>
        <div className="flex-1 flex flex-col min-w-0 relative h-full">
          {activeConv && activePartner ? (
            <Chat 
              user={user} 
              privKeyJwk={privKeyJwk} 
              partnerId={activeConv} 
              partner={activePartner} 
              onToggleSidebar={() => {
                setActiveConv(null);
                setActivePartner(null);
                setShowMobile(true);
              }}
              isFakeUI={false}
              isIncognito={isIncognito}
              showToast={showToast}
              showConfirm={showConfirm}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-t3">
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

      {/* Global Toast Notifications Container */}
      <div className="fixed bottom-4 left-4 z-[400] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`p-3.5 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 pointer-events-auto transition-all duration-300
              ${t.type === "danger" ? "bg-danger/10 border-danger/25 text-danger" : 
                t.type === "warn" ? "bg-warn/10 border-warn/25 text-warn" : 
                t.type === "success" ? "bg-ok/10 border-ok/25 text-ok" : 
                "bg-s2 border-b text-text"}`}
          >
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Global Custom Confirmation Dialog Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-s1 border border-b rounded-3xl w-full max-w-xs p-6 shadow-2xl text-center items-center flex flex-col border-warn/20">
            <div className="w-10 h-10 bg-warn/15 border border-warn/30 rounded-full flex items-center justify-center mb-4 text-warn text-sm">
              ⚠️
            </div>
            <h3 className="font-bold text-sm text-text">Confirmation</h3>
            <p className="text-xs text-t2 mt-2 leading-relaxed px-1">
              {confirmConfig.message}
            </p>
            <div className="flex gap-3 w-full mt-5">
              <button 
                onClick={() => setConfirmConfig(null)}
                className="flex-1 py-2 rounded-xl border border-b text-xs font-semibold text-t2 hover:text-text hover:bg-s3 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                className="flex-1 py-2 rounded-xl bg-warn text-black hover:scale-[1.02] transition-transform text-xs font-bold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
