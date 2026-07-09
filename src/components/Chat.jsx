import { useState, useEffect, useRef } from "react";
import { Send, Paperclip, Smile, Image as ImageIcon, File, Lock, Trash2, X, Mic, Square, Timer, ShieldAlert, SmilePlus } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { ref, push, onValue, off, remove, update, get, set as dbSet } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { encryptMessage, decryptMessage, deriveSharedSecret, importPublicKey, importPrivateKey, encryptBuffer, decryptBuffer } from "../crypto";

export default function Chat({ user, privKeyJwk, partnerId, partner, onToggleSidebar, isFakeUI, isIncognito, showToast, showConfirm }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sharedKey, setSharedKey] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [decryptedUrls, setDecryptedUrls] = useState({});
  const [viewOnce, setViewOnce] = useState(false);
  const [activeReactMenu, setActiveReactMenu] = useState(null);
  
  // Game state for Duress Text Adventure Mode
  const [gameState, setGameState] = useState(0);
  const [showAdminClearMenu, setShowAdminClearMenu] = useState(false);
  const [longPressMenu, setLongPressMenu] = useState(null); // { id, x, y }
  const longPressTimerRef = useRef(null);
  const [localNickname, setLocalNickname] = useState('');
  const [showNicknameEdit, setShowNicknameEdit] = useState(false);
  
  const [decryptedAvatar, setDecryptedAvatar] = useState("");

  useEffect(() => {
    setDecryptedAvatar("");
    if (partner?.avatarData && partnerId) {
      const decrypt = async () => {
        const { decryptAvatar } = await import("../crypto");
        const dec = await decryptAvatar(partner.avatarData, partnerId);
        if (dec) setDecryptedAvatar(dec);
      };
      decrypt();
    }
  }, [partner?.avatarData, partnerId]);

  // Safe conversion helpers for E2EE storage in database
  const arrayBufferToBase64 = (buffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };
  
  useEffect(() => {
    // Reset decrypted URLs when partner changes to maintain absolute privacy isolation
    setDecryptedUrls({});
  }, [partnerId]);
  
  useEffect(() => {
    const int = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(int);
  }, []);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);

  // Cache to store derived shared keys to make switching chats instantaneous
  const derivedKeysCache = useRef({});

  // Initialize E2EE Shared Key
  useEffect(() => {
    if (isFakeUI) return;
    if (!partner?.publicKey || !privKeyJwk || !partnerId) {
      setSharedKey(null);
      return;
    }

    const cleanPartnerId = partnerId.toLowerCase();
    if (derivedKeysCache.current[cleanPartnerId]) {
      setSharedKey(derivedKeysCache.current[cleanPartnerId]);
      return;
    }

    async function initCrypto() {
      try {
        const myPrivKey = await importPrivateKey(privKeyJwk);
        const theirPubKey = await importPublicKey(partner.publicKey);
        const derivedKey = await deriveSharedSecret(myPrivKey, theirPubKey);
        derivedKeysCache.current[cleanPartnerId] = derivedKey;
        setSharedKey(derivedKey);
      } catch (err) {
        console.error("Crypto init error:", err);
      }
    }
    initCrypto();
  }, [partnerId, partner?.publicKey, privKeyJwk, isFakeUI]);

  // Decrypt media attachments in the background
  useEffect(() => {
    if (isFakeUI || !sharedKey || messages.length === 0) return;

    messages.forEach(async (m) => {
      if (m.type === "image" && m.viewOnce && m.opened) {
        return; // skip decrypted loading if opened/deleted
      }
      if ((m.type === "image" || m.type === "file" || m.type === "audio") && !decryptedUrls[m.id]) {
        try {
          let decryptedBuffer;
          if (m.fileData) {
            const encryptedBuffer = base64ToArrayBuffer(m.fileData);
            decryptedBuffer = await decryptBuffer(encryptedBuffer, sharedKey);
          } else if (m.url) {
            const { ref: sRef, getBlob } = await import("firebase/storage");
            const storageRefInstance = sRef(storage, m.url);
            const encryptedBlob = await getBlob(storageRefInstance);
            const encryptedBuffer = await encryptedBlob.arrayBuffer();
            decryptedBuffer = await decryptBuffer(encryptedBuffer, sharedKey);
          } else {
            return;
          }
          
          let mimeType = m.mimeType || "application/octet-stream";
          if (m.type === "image" && !m.mimeType) mimeType = "image/jpeg";
          else if (m.type === "audio" && !m.mimeType) mimeType = "audio/webm";
          
          const decryptedBlob = new Blob([decryptedBuffer], { type: mimeType });
          const localUrl = URL.createObjectURL(decryptedBlob);
          
          setDecryptedUrls(prev => ({ ...prev, [m.id]: localUrl }));
        } catch (err) {
          console.error("Failed to decrypt media:", m.id, err);
        }
      }
    });
  }, [messages, sharedKey, decryptedUrls, isFakeUI]);

  // Subscribe to messages or handle game simulation
  useEffect(() => {
    if (isFakeUI) {
      setGameState(0);
      setMessages([
        { 
          id: "game-init", 
          sender: partnerId, 
          senderName: partner.name || "Agent Shadow", 
          ts: Date.now() - 60000, 
          type: "text", 
          text: "SYSTEM: Safe-house terminal online. Welcome, Agent. You have a new message from Handler 'Agent Shadow'." 
        },
        { 
          id: "game-intro", 
          sender: partnerId, 
          senderName: partner.name || "Agent Shadow", 
          ts: Date.now() - 30000, 
          type: "text", 
          text: "Agent, the stolen ledger has been traced to a vault in Zurich. Your mission is to infiltrate and retrieve it. Are you ready? Reply 'ACCEPT' or 'DECLINE'." 
        }
      ]);
      return;
    }

    if (!sharedKey || !partnerId) return;
    
    const convId = [user.uid, partnerId].sort().join("__");
    const msgsRef = ref(db, `messages/${convId}`);
    
    const unsub = onValue(msgsRef, async (snap) => {
      const data = snap.val() || {};
      const msgList = [];
      const now = Date.now();
      
      for (const [key, val] of Object.entries(data)) {
        if (val.deletedForUser && !user.isAdmin) {
          continue; // skip rendering deleted messages for normal users
        }

        // Mark all incoming messages as read when decrypted/loaded by recipient
        if (!val.readAt && val.sender !== user.uid) {
          import("firebase/database").then(({ update }) => {
            update(ref(db, `messages/${convId}/${key}`), { readAt: now });
          });
          val.readAt = now;
        }

        if (val.expiresIn) {
          if (val.readAt && now > val.readAt + val.expiresIn) {
            remove(ref(db, `messages/${convId}/${key}`));
            continue;
          }
        }

        try {
          const text = val.type === "text" ? await decryptMessage(val.cipher, sharedKey) : val.url;
          msgList.push({ id: key, ...val, text });
        } catch {
          msgList.push({ id: key, ...val, text: "[Decryption Failed]" });
        }
      }
      
      msgList.sort((a, b) => a.ts - b.ts);
      setMessages(msgList);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    
    return () => off(msgsRef, "value", unsub);
  }, [sharedKey, partnerId, user.uid, isFakeUI, partner.name]);

  useEffect(() => {
    if (isFakeUI) return;
    const interval = setInterval(() => {
      setMessages(prev => {
        const now = Date.now();
        const convId = [user.uid, partnerId].sort().join("__");
        let changed = false;
        const filtered = prev.filter(m => {
          if (m.expiresIn && m.readAt && now > m.readAt + m.expiresIn) {
            remove(ref(db, `messages/${convId}/${m.id}`));
            changed = true;
            return false;
          }
          return true;
        });
        return changed ? filtered : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [user.uid, partnerId, isFakeUI]);

  const handleSend = async () => {
    if (!inputText.trim() && !file) return;

    if (isFakeUI) {
      const userText = inputText.trim();
      const userMsg = { id: Date.now().toString(), sender: user.uid, senderName: user.name, ts: Date.now(), type: "text", text: userText };
      setMessages(prev => [...prev, userMsg]);
      setInputText("");
      setFile(null);
      
      // Progress the text adventure game simulation
      setTimeout(() => {
        setGameState(prev => {
          let nextState = prev;
          let replyText = "";
          const cleanInput = userText.toUpperCase().trim();
          
          if (cleanInput === "RESET") {
            nextState = 0;
            replyText = "System Reset. Zurich operation ready. Retrieve the ledger. Reply 'ACCEPT' or 'DECLINE'.";
          } else {
            switch (prev) {
              case 0:
                if (cleanInput.includes("ACCEPT")) {
                  nextState = 1;
                  replyText = "Excellent. Infiltration options: entry via ventilation shaft ('SHAFT') or security door override ('DOOR'). Type SHAFT or DOOR to choose.";
                } else if (cleanInput.includes("DECLINE")) {
                  nextState = 99;
                  replyText = "Mission declined. Operation aborted. Reply 'RESET' to restart simulator.";
                } else {
                  replyText = "Invalid command. Reply 'ACCEPT' or 'DECLINE'.";
                }
                break;
              case 1:
                if (cleanInput.includes("SHAFT")) {
                  nextState = 2;
                  replyText = "In shaft. A grate blocks the end. Do you kick the grate open noisily ('KICK') or use a laser torch quietly ('TORCH')?";
                } else if (cleanInput.includes("DOOR")) {
                  nextState = 3;
                  replyText = "Security console reached. Do you cut the power supply 'RED' wire or override the bypass 'BLUE' wire?";
                } else {
                  replyText = "Entry point required: Type 'SHAFT' or 'DOOR'.";
                }
                break;
              case 2:
                if (cleanInput.includes("KICK")) {
                  nextState = 99;
                  replyText = "Guard heard the crash! You were spotted and detained. Mission Failed. Reply 'RESET' to try again.";
                } else if (cleanInput.includes("TORCH")) {
                  nextState = 99;
                  replyText = "Grate removed silently. Ledger retrieved from vault! Escape vehicle secure. Success! Mission Accomplished. Reply 'RESET' to play again.";
                } else {
                  replyText = "Invalid action. Type 'KICK' or 'TORCH'.";
                }
                break;
              case 3:
                if (cleanInput.includes("RED")) {
                  nextState = 99;
                  replyText = "Power cut triggered back-up alarm. Guards deployed! Mission Failed. Reply 'RESET' to try again.";
                } else if (cleanInput.includes("BLUE")) {
                  nextState = 99;
                  replyText = "Override succeeded. Vault unlocked silently. Ledger secured. Success! Mission Accomplished. Reply 'RESET' to play again.";
                } else {
                  replyText = "Invalid wire color. Choose 'RED' or 'BLUE'.";
                }
                break;
              case 99:
              default:
                replyText = "Operation concluded. Reply 'RESET' to restart the Zurich simulation again.";
                break;
            }
          }
          
          setMessages(messagesPrev => [...messagesPrev, {
            id: (Date.now() + 1).toString(),
            sender: partnerId,
            senderName: partner.name || "Agent Shadow",
            ts: Date.now(),
            type: "text",
            text: replyText
          }]);
          
          return nextState;
        });
      }, 800);
      
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
      return;
    }

    if (!sharedKey) {
      if (showToast) showToast("Establishing secure E2EE connection... Please wait.", "warn");
      return;
    }
    
    const convId = [user.uid, partnerId].sort().join("__");
    const baseMsg = {
      sender: user.uid,
      senderName: user.name,
      ts: Date.now()
    };

    if (user.disappearingTimer > 0) {
      baseMsg.expiresIn = user.disappearingTimer * 1000;
    }

    setUploading(true);

    try {
      if (file) {
        // Read file as ArrayBuffer, encrypt it using E2EE, and convert to Base64
        const arrayBuffer = await file.arrayBuffer();
        const encryptedBuffer = await encryptBuffer(arrayBuffer, sharedKey);
        const base64Data = arrayBufferToBase64(encryptedBuffer);
        
        await push(ref(db, `messages/${convId}`), {
          ...baseMsg,
          type: file.type.startsWith("image/") ? "image" : "file",
          fileData: base64Data,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          viewOnce: file.type.startsWith("image/") ? viewOnce : false
        });
        setFile(null);
        setViewOnce(false);
      }

      if (inputText.trim()) {
        const cipher = await encryptMessage(inputText.trim(), sharedKey);
        await push(ref(db, `messages/${convId}`), {
          ...baseMsg,
          type: "text",
          cipher
        });
        setInputText("");
      }

      // Trigger notification for partner
      import("firebase/database").then(({ update }) => {
        update(ref(db, `users/${partnerId}`), { unreadTick: Date.now() });
        update(ref(db, `users/${partnerId}/unreadMap`), { [user.uid]: true });
      });

    } catch (err) {
      console.error("Send error", err);
      if (showToast) showToast("Failed to encrypt or send message.", "danger");
    } finally {
      setUploading(false);
      setShowEmoji(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAndSendAudio(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      if (showToast) showToast("Microphone access denied or unavailable.", "danger");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAndSendAudio = async (blob) => {
    if (isFakeUI) return;
    if (!sharedKey) return;
    setUploading(true);
    const convId = [user.uid, partnerId].sort().join("__");
    const baseMsg = { sender: user.uid, senderName: user.name, ts: Date.now() };
    if (user.disappearingTimer > 0) {
      baseMsg.expiresIn = user.disappearingTimer * 1000;
    }
    try {
      // Read audio blob as ArrayBuffer, encrypt it using E2EE, and convert to Base64
      const arrayBuffer = await blob.arrayBuffer();
      const encryptedBuffer = await encryptBuffer(arrayBuffer, sharedKey);
      const base64Data = arrayBufferToBase64(encryptedBuffer);
      
      await push(ref(db, `messages/${convId}`), {
        ...baseMsg,
        type: "audio",
        fileData: base64Data,
        fileName: "Voice Message",
        mimeType: "audio/webm"
      });

      // Trigger notification for partner
      import("firebase/database").then(({ update }) => {
        update(ref(db, `users/${partnerId}`), { unreadTick: Date.now() });
        update(ref(db, `users/${partnerId}/unreadMap`), { [user.uid]: true });
      });
      
    } catch (e) {
      console.error(e);
      if (showToast) showToast("Failed to encrypt or send voice note.", "danger");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (msgId) => {
    const convId = [user.uid, partnerId].sort().join("__");
    if (user.isAdmin) {
      // Mark as deleted for user, but keep in database for admin
      await update(ref(db, `messages/${convId}/${msgId}`), { deletedForUser: true });
    } else {
      // Normal users delete completely
      await remove(ref(db, `messages/${convId}/${msgId}`));
    }
  };

  const handleReact = async (msgId, emoji) => {
    const convId = [user.uid, partnerId].sort().join("__");
    const reactionRef = ref(db, `messages/${convId}/${msgId}/reactions/${user.uid}`);
    await set(reactionRef, emoji);
    setActiveReactMenu(null);
  };

  const handlePanic = async () => {
    if (user.isAdmin) {
      // Admin Panic button: closes target user's chat screen remotely
      await set(ref(db, `signals/panic/${partnerId}`), {
        active: true,
        targetUrl: "https://www.google.com",
        ts: Date.now()
      });
      if (showToast) showToast(`Force-closed chat on user's screen.`, "success");
    } else {
      // Normal user Panic: instantly redirect themselves without warning
      const target = user.panicUrl || "https://www.google.com";
      window.location.replace(target);
    }
  };

  const handleClearChat = () => {
    if (isFakeUI) {
      setMessages([]);
      return;
    }

    if (user.isAdmin) {
      // Show admin clear options modal
      setShowAdminClearMenu(true);
    } else {
      // Normal users delete for both sides
      showConfirm("Are you sure you want to permanently delete the entire chat history on both sides?", async () => {
        try {
          const convId = [user.uid, partnerId].sort().join("__");
          await remove(ref(db, `messages/${convId}`));
          if (showToast) showToast("Conversation history cleared.", "success");
        } catch {
          if (showToast) showToast("Failed to clear chat.", "danger");
        }
      });
    }
  };

  const onEmojiClick = (emojiObj) => {
    setInputText(prev => prev + emojiObj.emoji);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Long press handlers for mobile
  const handleTouchStart = (e, msgId) => {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      setLongPressMenu({ id: msgId, x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Load local nickname for this contact
  useEffect(() => {
    if (!user || !partnerId) return;
    get(ref(db, `users/${user.uid}/nicknames/${partnerId}`)).then(snap => {
      setLocalNickname(snap.val() || '');
    });
  }, [user, partnerId]);

  const saveNickname = async () => {
    if (!user || !partnerId) return;
    const clean = localNickname.trim();
    if (clean) {
      await dbSet(ref(db, `users/${user.uid}/nicknames/${partnerId}`), clean);
    } else {
      await remove(ref(db, `users/${user.uid}/nicknames/${partnerId}`));
    }
    setShowNicknameEdit(false);
    if (showToast) showToast(clean ? `Renamed to "${clean}"` : 'Nickname removed', 'success');
  };

  const displayPartnerName = isIncognito ? "Hidden Contact" : (localNickname || partner.name);
  const displayPartnerColor = isIncognito ? "#6b7280" : partner.avatarColor;

  return (
    <div className="flex-1 flex flex-col h-full bg-bg relative min-w-0">
      {/* Header */}
      <div className="border-b border-b bg-s2 flex items-center px-3 py-2 gap-2 shrink-0">
        <button className="md:hidden text-t2 hover:text-text p-1.5" onClick={onToggleSidebar}>
          ←
        </button>
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden"
          style={{ backgroundColor: `${displayPartnerColor}22`, color: displayPartnerColor, border: `1px solid ${displayPartnerColor}33` }}
        >
          {decryptedAvatar && !isIncognito ? (
            <img src={decryptedAvatar} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            displayPartnerName.substring(0,2).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0" onClick={() => setShowNicknameEdit(true)}>
          <div className="font-semibold text-sm truncate">{displayPartnerName}</div>
          <div className="text-[0.6rem] text-t3 flex items-center gap-1">
            {partner.online && !isIncognito ? <span className="w-1.5 h-1.5 rounded-full bg-ok inline-block"></span> : <span className="w-1.5 h-1.5 rounded-full bg-t3 inline-block"></span>}
            {partner.online && !isIncognito ? "Online" : "Offline"}
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="p-1.5 hover:bg-danger/20 hover:text-danger rounded-md transition-colors text-t2"
          title="Clear chat"
        >
          <Trash2 size={16} />
        </button>
        <button 
          onClick={handlePanic}
          className="p-1.5 bg-danger/10 border border-danger/25 text-danger rounded-md hover:bg-danger/20 transition-all shrink-0"
          title={user.isAdmin ? "Force Close User Screen" : "Panic"}
        >
          <ShieldAlert size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const isMe = m.sender === user.uid;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] sm:max-w-[75%] group relative ${isMe ? 'items-end' : 'items-start'} flex flex-col`}
                onTouchStart={(e) => handleTouchStart(e, m.id)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onContextMenu={(e) => { e.preventDefault(); setLongPressMenu({ id: m.id, x: e.clientX, y: e.clientY }); }}
              >
                <div className={`
                  px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-sm leading-relaxed break-words relative
                  ${isMe ? 'bg-a/10 border border-a/20 rounded-tr-sm' : 'bg-s2 border border-b rounded-tl-sm'}
                `}>
                  {!isMe && <div className="text-[0.6rem] mb-1 font-semibold" style={{color: displayPartnerColor}}>{isIncognito ? "Hidden Contact" : m.senderName}</div>}
                  {m.deletedForUser && user.isAdmin && <div className="text-[0.55rem] uppercase tracking-wider text-danger font-bold mb-1">[Deleted for User]</div>}
                  
                  {m.type === "image" ? (
                    m.viewOnce && m.opened ? (
                      <div className="text-xs text-t3 p-3 italic flex items-center gap-1.5 animate-pulse">
                        📷 Disappearing image opened & deleted
                      </div>
                    ) : decryptedUrls[m.id] ? (
                      <img 
                        src={decryptedUrls[m.id]} 
                        alt="attached" 
                        className="max-w-full max-h-60 rounded-lg object-contain cursor-pointer border border-b/20 shadow" 
                        onClick={() => window.open(decryptedUrls[m.id], "_blank")}
                        onLoad={() => {
                          if (m.viewOnce && m.sender !== user.uid && !m.opened) {
                            const convId = [user.uid, partnerId].sort().join("__");
                            update(ref(db, `messages/${convId}/${m.id}`), {
                              opened: true,
                              fileData: null
                            });
                          }
                        }}
                      />
                    ) : (
                      <div className="text-xs text-t3 animate-pulse p-4">Decrypting image...</div>
                    )
                  ) : m.type === "file" ? (
                    decryptedUrls[m.id] ? (
                      <a href={decryptedUrls[m.id]} download={m.fileName} className="flex items-center gap-2 text-a hover:underline bg-bg/50 p-2 rounded-lg border border-b">
                        <File size={16} /> {m.fileName || "Download File"}
                      </a>
                    ) : (
                      <div className="text-xs text-t3 animate-pulse p-2">Decrypting file...</div>
                    )
                  ) : m.type === "audio" ? (
                    decryptedUrls[m.id] ? (
                      <audio src={decryptedUrls[m.id]} controls className="h-10 max-w-[220px]" />
                    ) : (
                      <div className="text-xs text-t3 animate-pulse p-2">Decrypting audio...</div>
                    )
                  ) : (
                    <div>{m.text}</div>
                  )}

                  {/* Desktop hover action overlay */}
                  <div className="absolute -top-3.5 -right-2 hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg bg-s3 border border-b rounded-lg p-0.5 z-10">
                    <button 
                      onClick={() => setActiveReactMenu(activeReactMenu === m.id ? null : m.id)}
                      className="text-t2 hover:text-warn p-1 rounded hover:bg-s2"
                      title="React"
                    >
                      <SmilePlus size={11} />
                    </button>
                    {(isMe || user.isAdmin) && (
                      <button 
                        onClick={() => handleDelete(m.id)}
                        className="text-t2 hover:text-danger p-1 rounded hover:bg-s2"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>

                  {/* Reaction Toolbar */}
                  {activeReactMenu === m.id && (
                    <div className="absolute bottom-full mb-1 left-0 bg-s3 border border-b rounded-full px-2 py-1 flex items-center gap-1.5 shadow-2xl z-20 animate-scale-up">
                      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                        <button 
                          key={emoji}
                          onClick={() => handleReact(m.id, emoji)}
                          className="hover:scale-125 transition-transform p-0.5 text-base"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reactions Display */}
                {m.reactions && (
                  <div className="flex flex-wrap gap-0.5 mt-1 bg-s3 px-2 py-0.5 rounded-full border border-b/20 w-fit text-[0.6rem]">
                    {Object.entries(m.reactions).map(([ruid, emoji]) => (
                      <span key={ruid} title={ruid === user.uid ? "You" : "Other"}>{emoji}</span>
                    ))}
                  </div>
                )}
                <div className="text-[0.55rem] text-t3 mt-0.5 px-1 flex items-center gap-1">
                  {m.expiresIn && m.readAt && (
                    <span className="text-warn flex items-center gap-0.5 mr-1">
                      <Timer size={8} /> {Math.max(0, Math.ceil((m.readAt + m.expiresIn - now) / 1000))}s
                    </span>
                  )}
                  {new Date(m.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  {isMe && (
                    <span className={`ml-1 text-[0.7rem] ${m.readAt ? "text-ok font-bold" : "text-t3"}`}>
                      {m.readAt ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-s1 border-t border-b shrink-0 relative">
        {showEmoji && (
          <div className="absolute bottom-full right-2 left-2 sm:left-auto sm:right-4 mb-2 z-50 shadow-2xl max-w-full sm:w-[350px]">
            <EmojiPicker 
              onEmojiClick={onEmojiClick} 
              theme="dark" 
              width="100%" 
              height={300} 
            />
          </div>
        )}

        {file && (
          <div className="mb-2 flex items-center gap-3 bg-s2 border border-b px-3 py-2 rounded-lg max-w-sm">
            {file.type.startsWith('image/') ? <ImageIcon size={16} className="text-a" /> : <File size={16} className="text-a" />}
            <span className="text-xs truncate flex-1">{file.name}</span>
            {file.type.startsWith("image/") && (
              <label className="flex items-center gap-1 text-[0.65rem] text-warn select-none bg-s3 px-2 py-1 rounded border border-warn/20 cursor-pointer shrink-0">
                <input 
                  type="checkbox"
                  checked={viewOnce}
                  onChange={(e) => setViewOnce(e.target.checked)}
                  className="accent-warn w-3 h-3"
                />
                <span>View Once</span>
              </label>
            )}
            <button onClick={() => { setFile(null); setViewOnce(false); }} className="text-t2 hover:text-danger shrink-0"><X size={16} /></button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          
          <button 
            className="w-10 h-10 rounded-xl bg-s2 border border-b flex items-center justify-center text-t2 hover:text-a hover:border-a transition-colors shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={18} />
          </button>

            {isRecording ? (
              <div className="flex-1 bg-danger/10 border border-danger/30 rounded-xl flex items-center px-3 py-2 animate-pulse text-danger text-sm">
                Recording audio...
              </div>
            ) : (
              <div className="flex-1 bg-s2 border border-b focus-within:border-a rounded-xl flex items-end px-3 py-1 transition-colors min-w-0">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a secure message..."
                  className="flex-1 bg-transparent border-none text-text text-sm resize-none outline-none py-2 max-h-32 min-h-[40px] leading-snug"
                  rows={1}
                  style={{height: "auto", minHeight: "40px"}}
                  onInput={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
                  }}
                />
                <button 
                  className="p-2 text-t2 hover:text-warn transition-colors mb-0.5"
                  onClick={() => setShowEmoji(!showEmoji)}
                >
                  <Smile size={20} />
                </button>
              </div>
            )}

          {isRecording ? (
            <button 
              className="w-10 h-10 rounded-xl bg-danger text-white flex items-center justify-center hover:scale-105 hover:shadow-[0_4px_16px_rgba(255,59,92,0.3)] transition-all shrink-0"
              onClick={stopRecording}
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (!inputText.trim() && !file) ? (
            <button 
              className="w-10 h-10 rounded-xl bg-s3 border border-b text-a flex items-center justify-center hover:bg-a/10 transition-all shrink-0 disabled:opacity-50"
              onClick={startRecording}
              disabled={uploading}
            >
              <Mic size={18} />
            </button>
          ) : (
            <button 
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-a to-a2 text-bg flex items-center justify-center hover:scale-105 hover:shadow-[0_4px_16px_rgba(0,212,255,0.3)] transition-all shrink-0 disabled:opacity-50"
              onClick={handleSend}
              disabled={uploading}
            >
              <Send size={18} className="ml-1" />
            </button>
          )}
        </div>
      </div>
      {/* Admin Clear Chat Custom Modal Options */}
      {showAdminClearMenu && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-s1 border border-b rounded-3xl w-full max-w-xs p-6 shadow-2xl text-center items-center flex flex-col border-danger/25 animate-scale-up">
            <div className="w-10 h-10 bg-danger/10 border border-danger/30 rounded-full flex items-center justify-center mb-4 text-danger text-sm">
              🗑️
            </div>
            <h3 className="font-bold text-sm text-text">Clear Conversation</h3>
            <p className="text-xs text-t2 mt-2 leading-relaxed px-1">
              Choose how you want to delete this chat history:
            </p>
            <div className="flex flex-col gap-2.5 w-full mt-5">
              <button 
                onClick={async () => {
                  try {
                    const convId = [user.uid, partnerId].sort().join("__");
                    const msgsSnap = await get(ref(db, `messages/${convId}`));
                    const data = msgsSnap.val() || {};
                    const updates = {};
                    for (const key of Object.keys(data)) {
                      updates[`messages/${convId}/${key}/deletedForUser`] = true;
                    }
                    await update(ref(db), updates);
                    setShowAdminClearMenu(false);
                    if (showToast) showToast("Chat cleared from user screen.", "success");
                  } catch {
                    if (showToast) showToast("Failed to delete chat.", "danger");
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-s2 border border-b text-xs font-semibold text-text hover:bg-s3 transition-colors"
              >
                Delete for User only (Save for Admin)
              </button>
              <button 
                onClick={async () => {
                  try {
                    const convId = [user.uid, partnerId].sort().join("__");
                    await remove(ref(db, `messages/${convId}`));
                    setShowAdminClearMenu(false);
                    if (showToast) showToast("Chat deleted from both sides.", "success");
                  } catch {
                    if (showToast) showToast("Failed to delete chat.", "danger");
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-danger text-white hover:scale-[1.02] transition-transform text-xs font-bold"
              >
                Delete for Both sides completely
              </button>
              <button 
                onClick={() => setShowAdminClearMenu(false)}
                className="w-full py-2.5 rounded-xl border border-b text-xs font-semibold text-t2 hover:text-text hover:bg-s3 transition-colors mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Long-Press Context Menu */}
      {longPressMenu && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={() => setLongPressMenu(null)} />
          <div 
            className="fixed z-[195] bg-s1 border border-b rounded-2xl shadow-2xl p-1.5 min-w-[160px] animate-scale-up"
            style={{ top: Math.min(longPressMenu.y, window.innerHeight - 180), left: Math.min(longPressMenu.x, window.innerWidth - 180) }}
          >
            <button
              onClick={() => { setActiveReactMenu(longPressMenu.id); setLongPressMenu(null); }}
              className="w-full text-left px-3 py-2.5 text-sm text-text hover:bg-s3 rounded-xl flex items-center gap-2.5 transition-colors"
            >
              <SmilePlus size={14} /> React
            </button>
            {(messages.find(m => m.id === longPressMenu.id)?.sender === user.uid || user.isAdmin) && (
              <button
                onClick={() => { handleDelete(longPressMenu.id); setLongPressMenu(null); }}
                className="w-full text-left px-3 py-2.5 text-sm text-danger hover:bg-danger/10 rounded-xl flex items-center gap-2.5 transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </>
      )}

      {/* Nickname Edit Modal */}
      {showNicknameEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-s1 border border-b rounded-3xl w-full max-w-xs p-6 shadow-2xl">
            <h3 className="font-bold text-sm text-text text-center mb-4">Set Local Nickname</h3>
            <p className="text-xs text-t2 text-center mb-3">This rename is only visible to you, not to the other person.</p>
            <input 
              type="text"
              value={localNickname}
              onChange={(e) => setLocalNickname(e.target.value)}
              placeholder={partner.name}
              className="w-full bg-s2 border border-b rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-a transition-all mb-4"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowNicknameEdit(false)}
                className="flex-1 py-2.5 rounded-xl border border-b text-xs font-semibold text-t2 hover:text-text hover:bg-s3 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveNickname}
                className="flex-1 py-2.5 rounded-xl bg-a text-black hover:scale-[1.02] transition-transform text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
