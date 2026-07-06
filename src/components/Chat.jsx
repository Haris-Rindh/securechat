import { useState, useEffect, useRef } from "react";
import { Send, Paperclip, Smile, Image as ImageIcon, File, Lock, Trash2, X, Mic, Square, Timer } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { ref, push, onValue, off, remove } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { encryptMessage, decryptMessage, deriveSharedSecret, importPublicKey, importPrivateKey, encryptBuffer, decryptBuffer } from "../crypto";

export default function Chat({ user, privKeyJwk, partnerId, partner, onToggleSidebar, isFakeUI, isIncognito }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sharedKey, setSharedKey] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [decryptedUrls, setDecryptedUrls] = useState({});
  
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

  // Initialize E2EE Shared Key
  useEffect(() => {
    async function initCrypto() {
      if (!partner.publicKey || !privKeyJwk) return;
      try {
        const myPrivKey = await importPrivateKey(privKeyJwk);
        const theirPubKey = await importPublicKey(partner.publicKey);
        const derivedKey = await deriveSharedSecret(myPrivKey, theirPubKey);
        setSharedKey(derivedKey);
      } catch (err) {
        console.error("Crypto init error:", err);
      }
    }
    initCrypto();
  }, [partner, privKeyJwk]);

  // Decrypt media attachments in the background
  useEffect(() => {
    if (isFakeUI || !sharedKey || messages.length === 0) return;

    messages.forEach(async (m) => {
      if ((m.type === "image" || m.type === "file" || m.type === "audio") && m.url && !decryptedUrls[m.id]) {
        try {
          const { ref: sRef, getBlob } = await import("firebase/storage");
          const storageRefInstance = sRef(storage, m.url);
          const encryptedBlob = await getBlob(storageRefInstance);
          
          const encryptedBuffer = await encryptedBlob.arrayBuffer();
          const decryptedBuffer = await decryptBuffer(encryptedBuffer, sharedKey);
          
          let mimeType = "application/octet-stream";
          if (m.type === "image") mimeType = "image/jpeg";
          else if (m.type === "audio") mimeType = "audio/webm";
          
          const decryptedBlob = new Blob([decryptedBuffer], { type: mimeType });
          const localUrl = URL.createObjectURL(decryptedBlob);
          
          setDecryptedUrls(prev => ({ ...prev, [m.id]: localUrl }));
        } catch (err) {
          console.error("Failed to decrypt media:", m.id, err);
        }
      }
    });
  }, [messages, sharedKey, decryptedUrls, isFakeUI]);

  // Subscribe to messages
  useEffect(() => {
    if (isFakeUI) {
      const timer = setTimeout(() => {
        setMessages([
          { id: "1", sender: partnerId, senderName: partner.name, ts: Date.now() - 100000, type: "text", text: "Hey, are you there?" },
          { id: "2", sender: user.uid, senderName: user.name, ts: Date.now() - 50000, type: "text", text: "Yes, what's up?" }
        ]);
      }, 0);
      return () => clearTimeout(timer);
    }

    if (!sharedKey || !partnerId) return;
    
    const convId = [user.uid, partnerId].sort().join("__");
    const msgsRef = ref(db, `messages/${convId}`);
    
    const unsub = onValue(msgsRef, async (snap) => {
      const data = snap.val() || {};
      const msgList = [];
      const now = Date.now();
      
      for (const [key, val] of Object.entries(data)) {
        if (val.expiresIn) {
          if (!val.readAt && val.sender !== user.uid) {
            import("firebase/database").then(({ update }) => {
              update(ref(db, `messages/${convId}/${key}`), { readAt: now });
            });
            val.readAt = now;
          }
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
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: user.uid, senderName: user.name, ts: Date.now(), type: "text", text: inputText.trim() }]);
      setInputText("");
      setFile(null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return;
    }

    if (!sharedKey) return alert("Establishing secure connection... Please wait.");
    
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
        const fileRef = storageRef(storage, `chat_media/${convId}/${Date.now()}_${file.name}`);
        
        // Read file as ArrayBuffer and encrypt it using E2EE
        const arrayBuffer = await file.arrayBuffer();
        const encryptedBuffer = await encryptBuffer(arrayBuffer, sharedKey);
        const encryptedBlob = new Blob([encryptedBuffer], { type: "application/octet-stream" });
        
        await uploadBytes(fileRef, encryptedBlob);
        const url = await getDownloadURL(fileRef);
        
        await push(ref(db, `messages/${convId}`), {
          ...baseMsg,
          type: file.type.startsWith("image/") ? "image" : "file",
          url,
          fileName: file.name
        });
        setFile(null);
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
      alert("Failed to send message");
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
      alert("Microphone access denied or unavailable.");
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
      const fileRef = storageRef(storage, `chat_media/${convId}/${Date.now()}_audio.webm`);
      
      // Read audio blob as ArrayBuffer and encrypt it using E2EE
      const arrayBuffer = await blob.arrayBuffer();
      const encryptedBuffer = await encryptBuffer(arrayBuffer, sharedKey);
      const encryptedBlob = new Blob([encryptedBuffer], { type: "application/octet-stream" });
      
      await uploadBytes(fileRef, encryptedBlob);
      const url = await getDownloadURL(fileRef);
      await push(ref(db, `messages/${convId}`), {
        ...baseMsg,
        type: "audio",
        url,
        fileName: "Voice Message"
      });

      // Trigger notification for partner
      import("firebase/database").then(({ update }) => {
        update(ref(db, `users/${partnerId}`), { unreadTick: Date.now() });
        update(ref(db, `users/${partnerId}/unreadMap`), { [user.uid]: true });
      });
      
    } catch (e) {
      console.error(e);
      alert("Failed to send audio");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (msgId) => {
    const convId = [user.uid, partnerId].sort().join("__");
    await remove(ref(db, `messages/${convId}/${msgId}`));
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

  const displayPartnerName = isIncognito ? "Hidden Contact" : partner.name;
  const displayPartnerColor = isIncognito ? "#6b7280" : partner.avatarColor;

  return (
    <div className="flex-1 flex flex-col h-full bg-bg relative min-w-0">
      {/* Header */}
      <div className="h-14 border-b border-b bg-s2 flex items-center px-4 gap-3 shrink-0">
        <button className="md:hidden text-t2 hover:text-text p-1" onClick={onToggleSidebar}>
          ☰
        </button>
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
          style={{ backgroundColor: `${displayPartnerColor}22`, color: displayPartnerColor, border: `1px solid ${displayPartnerColor}33` }}
        >
          {displayPartnerName.substring(0,2).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">{displayPartnerName}</div>
          <div className="text-[0.6rem] text-t3 flex items-center gap-1">
            {partner.online && !isIncognito ? <span className="w-1.5 h-1.5 rounded-full bg-ok inline-block"></span> : <span className="w-1.5 h-1.5 rounded-full bg-t3 inline-block"></span>}
            {partner.online && !isIncognito ? "Online" : "Offline"}
          </div>
        </div>
        {user.disappearingTimer > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-warn/10 border border-warn/20 rounded-md text-[0.65rem] text-warn uppercase tracking-wider font-semibold mr-2">
            <Timer size={12} /> {user.disappearingTimer >= 3600 ? `${user.disappearingTimer/3600}h` : user.disappearingTimer >= 60 ? `${user.disappearingTimer/60}m` : `${user.disappearingTimer}s`}
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-ok/10 border border-ok/20 rounded-md text-[0.65rem] text-ok uppercase tracking-wider font-semibold">
          <Lock size={12} /> True E2EE
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const isMe = m.sender === user.uid;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] group relative ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`
                  px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words relative
                  ${isMe ? 'bg-a/10 border border-a/20 rounded-tr-sm' : 'bg-s2 border border-b rounded-tl-sm'}
                `}>
                  {!isMe && <div className="text-[0.6rem] mb-1 font-semibold" style={{color: displayPartnerColor}}>{isIncognito ? "Hidden Contact" : m.senderName}</div>}
                  
                  {m.type === "image" ? (
                    decryptedUrls[m.id] ? (
                      <img src={decryptedUrls[m.id]} alt="attached" className="max-w-full max-h-60 rounded-lg object-contain cursor-pointer" onClick={() => window.open(decryptedUrls[m.id], "_blank")} />
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

                  {isMe && (
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="absolute -top-3 -right-2 bg-danger text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="text-[0.6rem] text-t3 mt-1 px-1 flex items-center gap-1">
                  {m.expiresIn && m.readAt && (
                    <span className="text-warn flex items-center gap-0.5 mr-1">
                      <Timer size={8} /> {Math.max(0, Math.ceil((m.readAt + m.expiresIn - now) / 1000))}s
                    </span>
                  )}
                  <Lock size={8} className="text-ok" />
                  {new Date(m.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
          <div className="absolute bottom-full right-4 mb-2 z-50 shadow-2xl">
            <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
          </div>
        )}

        {file && (
          <div className="mb-2 flex items-center gap-2 bg-s2 border border-b px-3 py-2 rounded-lg max-w-sm">
            {file.type.startsWith('image/') ? <ImageIcon size={16} className="text-a" /> : <File size={16} className="text-a" />}
            <span className="text-xs truncate flex-1">{file.name}</span>
            <button onClick={() => setFile(null)} className="text-t2 hover:text-danger"><X size={16} /></button>
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
    </div>
  );
}
