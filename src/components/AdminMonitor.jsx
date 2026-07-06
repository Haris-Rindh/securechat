import { useState, useEffect } from "react";
import { ref, onValue, off, set, remove } from "firebase/database";
import { db } from "../firebase";
import { Camera, CameraOff, X, ShieldAlert, Minimize2, Maximize2, Power } from "lucide-react";

export default function AdminMonitor({ user, contacts, onClose }) {
  const [activeMonitor, setActiveMonitor] = useState(null);
  const [frame, setFrame] = useState(null);
  const [frameTs, setFrameTs] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Draggable Window State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Initialize position to bottom right corner
  useEffect(() => {
    const initialX = window.innerWidth - 370;
    const initialY = window.innerHeight - 510;
    setPosition({
      x: Math.max(16, initialX),
      y: Math.max(16, initialY),
    });
  }, []);

  // Handle dragging
  const handleMouseDown = (e) => {
    if (e.target.closest("button")) return; // Don't drag when clicking buttons
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      // Constraint drag inside browser viewport boundaries
      const newX = Math.max(10, Math.min(window.innerWidth - 360, e.clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 60, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // When a user is being monitored, listen to their camera frames
  useEffect(() => {
    if (!activeMonitor) {
      setFrame(null);
      return;
    }
    const frameRef = ref(db, `cameraframes/${activeMonitor}`);
    const unsub = onValue(frameRef, (snap) => {
      const data = snap.val();
      if (data?.frame) {
        setFrame(data.frame);
        setFrameTs(data.ts);
      }
    });
    return () => off(frameRef, "value", unsub);
  }, [activeMonitor]);

  const startMonitoring = async (uid) => {
    // Stop any previous active session first
    if (activeMonitor && activeMonitor !== uid) {
      await set(ref(db, `signals/camera/${activeMonitor}`), { active: false });
    }
    await set(ref(db, `signals/camera/${uid}`), {
      active: true,
      activatedBy: user.uid,
      ts: Date.now(),
    });
    setActiveMonitor(uid);
    setFrame(null);
  };

  const stopMonitoring = async (uid) => {
    await set(ref(db, `signals/camera/${uid}`), { active: false });
    await remove(ref(db, `cameraframes/${uid}`));
    setActiveMonitor(null);
    setFrame(null);
    setFrameTs(null);
  };

  // Close Chat / Panic Redirect trigger
  const triggerPanicClose = async (uid) => {
    const confirmClose = window.confirm("Are you sure you want to force close this user's chat and redirect them to Google?");
    if (!confirmClose) return;

    // Send panic command
    await set(ref(db, `signals/panic/${uid}`), {
      active: true,
      targetUrl: "https://www.google.com",
      ts: Date.now()
    });

    // Clean up monitoring signals
    await set(ref(db, `signals/camera/${uid}`), { active: false });
    await remove(ref(db, `cameraframes/${uid}`));
    if (activeMonitor === uid) {
      setActiveMonitor(null);
      setFrame(null);
      setFrameTs(null);
    }
  };

  // On unmount, always stop any active monitoring session
  useEffect(() => {
    return () => {
      if (activeMonitor) {
        set(ref(db, `signals/camera/${activeMonitor}`), { active: false });
      }
    };
  }, [activeMonitor]);

  const handleClose = () => {
    if (activeMonitor) {
      stopMonitoring(activeMonitor);
    }
    onClose();
  };

  return (
    <div 
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className={`fixed z-[150] w-[350px] max-w-[calc(100vw-32px)] shadow-[0_20px_50px_rgba(0,0,0,0.55)] border border-b rounded-2xl overflow-hidden flex flex-col bg-s1 transition-shadow duration-300 ${
        isMinimized ? "h-14" : "h-[480px]"
      } ${isDragging ? "shadow-2xl opacity-95 cursor-grabbing" : ""}`}
    >
      {/* Header — drag handle */}
      <div 
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-4 border-b border-b bg-s2 shrink-0 cursor-grab select-none active:cursor-grabbing"
      >
        <h2 className="font-bold text-xs text-warn flex items-center gap-1.5 uppercase tracking-wider">
          <Camera size={16} /> Parental Monitor
        </h2>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsMinimized(!isMinimized)} 
            className="p-1.5 hover:bg-s3 rounded-md transition-colors text-t2 hover:text-text"
            title={isMinimized ? "Expand" : "Collapse"}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button 
            onClick={handleClose} 
            className="p-1.5 hover:bg-danger/20 hover:text-danger rounded-md transition-colors text-t2"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Body (hidden when minimized) */}
      {!isMinimized && (
        <>
          {/* Transparency Notice */}
          <div className="p-2.5 bg-warn/5 border-b border-warn/15 shrink-0">
            <div className="flex items-start gap-2">
              <ShieldAlert size={12} className="text-warn mt-0.5 shrink-0" />
              <p className="text-[0.62rem] text-warn leading-snug">
                A visible banner is displayed on the user's screen whenever their camera is active.
              </p>
            </div>
          </div>

          {/* Live Feed */}
          {activeMonitor && (
            <div className="p-3 border-b border-b shrink-0 bg-bg/40">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[0.6rem] text-warn uppercase tracking-wider font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-warn rounded-full animate-pulse inline-block" />
                  Live: {contacts[activeMonitor]?.name || activeMonitor}
                </span>
                {frameTs && (
                  <span className="text-[0.55rem] text-t3 font-mono">
                    {new Date(frameTs).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {frame ? (
                <img
                  src={frame}
                  alt="Live camera feed"
                  className="w-full h-36 object-contain rounded-lg border border-warn/25 bg-black"
                />
              ) : (
                <div className="w-full h-36 rounded-lg border border-b bg-black/50 flex items-center justify-center text-[0.7rem] text-t3 animate-pulse">
                  Waiting for camera feed...
                </div>
              )}
            </div>
          )}

          {/* User List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 select-none">
            <p className="text-[0.6rem] uppercase tracking-wider text-t3 font-bold mb-2">Select User</p>
            {Object.entries(contacts).length === 0 ? (
              <div className="text-center text-t3 text-xs py-8">No users registered yet.</div>
            ) : (
              Object.entries(contacts).map(([uid, c]) => (
                <div key={uid} className="flex items-center gap-2.5 p-2 bg-s2 rounded-xl border border-b hover:bg-s2/80 transition-colors">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[0.65rem] shrink-0"
                    style={{ backgroundColor: `${c.avatarColor}22`, color: c.avatarColor, border: `1px solid ${c.avatarColor}22` }}
                  >
                    {c.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-text truncate">{c.name}</div>
                    <div className="text-[0.6rem] text-t3 flex items-center gap-1">
                      {c.online
                        ? <><span className="w-1.5 h-1.5 bg-ok rounded-full inline-block animate-pulse" /> Online</>
                        : <><span className="w-1.5 h-1.5 bg-t3 rounded-full inline-block" /> Offline</>
                      }
                      <span className="text-t3 truncate max-w-[80px]">({uid.toUpperCase()})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Remote Panic Close Button */}
                    <button
                      onClick={() => triggerPanicClose(uid)}
                      disabled={!c.online}
                      className="p-1.5 bg-danger/10 border border-danger/25 text-danger rounded-lg hover:bg-danger/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Force Close & Redirect"
                    >
                      <Power size={11} />
                    </button>
                    
                    {activeMonitor === uid ? (
                      <button
                        onClick={() => stopMonitoring(uid)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-danger/10 border border-danger/25 text-danger rounded-lg text-[0.65rem] font-bold hover:bg-danger/20 transition-all"
                      >
                        <CameraOff size={11} /> Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => startMonitoring(uid)}
                        disabled={!c.online}
                        className="flex items-center gap-1 px-2.5 py-1 bg-warn/10 border border-warn/25 text-warn rounded-lg text-[0.65rem] font-bold hover:bg-warn/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Camera size={11} /> View
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
