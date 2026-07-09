import { useState, useEffect } from "react";
import { Search, Plus, UserPlus, LogOut, Copy, Settings, Eye, EyeOff, Camera, Globe } from "lucide-react";

export default function Sidebar({ user, contacts, activeConv, unreadMap = {}, onSelectConv, onAddContact, onLogout, showMobile, setShowMobile, onOpenSettings, onOpenMonitor, onOpenBrowser, isIncognito, onToggleIncognito, showToast }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addId, setAddId] = useState("");
  const [decryptedAvatars, setDecryptedAvatars] = useState({});

  useEffect(() => {
    // Decrypt my own avatar
    if (user.avatarData && !decryptedAvatars["me"]) {
      const decrypt = async () => {
        const { decryptAvatar } = await import("../crypto");
        const dec = await decryptAvatar(user.avatarData, user.uid);
        if (dec) {
          setDecryptedAvatars(prev => ({ ...prev, me: dec }));
        }
      };
      decrypt();
    }
  }, [user.avatarData, user.uid]);

  useEffect(() => {
    // Decrypt all contact avatars in background
    Object.entries(contacts).forEach(async ([uid, c]) => {
      if (c.avatarData && !decryptedAvatars[uid]) {
        const { decryptAvatar } = await import("../crypto");
        const dec = await decryptAvatar(c.avatarData, uid);
        if (dec) {
          setDecryptedAvatars(prev => ({ ...prev, [uid]: dec }));
        }
      }
    });
  }, [contacts]);

  const filteredContacts = Object.entries(contacts).filter(([uid, c]) => {
    if (isIncognito) return true; // Show all dummy users when searching in incognito
    return c.name?.toLowerCase().includes(search.toLowerCase()) || uid.includes(search.toUpperCase());
  });

  const copyId = () => {
    navigator.clipboard.writeText(user.uid.toUpperCase());
    if (showToast) showToast("Your User ID has been copied to clipboard!", "success");
  };

  const handleAdd = () => {
    if (!addId) return;
    onAddContact(addId.toUpperCase());
    setAddId("");
    setShowAdd(false);
  };

  return (
    <div className={`w-full md:w-80 bg-s1 border-r border-b flex flex-col h-full ${showMobile ? 'flex' : 'hidden md:flex'}`}>
      {/* Current User Header */}
      <div className="p-4 border-b border-b flex items-center gap-3 bg-s2">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm overflow-hidden shrink-0"
          style={{ backgroundColor: `${user.avatarColor}22`, color: user.avatarColor, border: `1px solid ${user.avatarColor}44` }}
        >
          {decryptedAvatars.me && !isIncognito ? (
            <img src={decryptedAvatars.me} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            user.name.substring(0,2).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text truncate">{isIncognito ? "Incognito Active" : user.name}</div>
          <div className="text-[0.65rem] text-t3 flex items-center gap-1 cursor-pointer hover:text-a transition-colors" onClick={copyId}>
            ID: {isIncognito ? "HIDDEN" : user.uid.toUpperCase()} <Copy size={10} />
          </div>
        </div>
        <div className="flex items-center">
          <button onClick={onToggleIncognito} className={`p-2 rounded-lg transition-colors ${isIncognito ? 'text-a bg-a/10' : 'text-t2 hover:text-text'}`} title="Toggle Incognito">
            {isIncognito ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          {onOpenMonitor && (
            <button onClick={onOpenMonitor} className="p-2 text-warn hover:text-warn hover:bg-warn/10 rounded-lg transition-colors" title="Parental Monitor">
              <Camera size={18} />
            </button>
          )}
          {onOpenBrowser && (
            <button onClick={onOpenBrowser} className="p-2 text-t2 hover:text-a rounded-lg transition-colors" title="Web Viewer">
              <Globe size={18} />
            </button>
          )}
          <button onClick={onOpenSettings} className="p-2 text-t2 hover:text-text rounded-lg transition-colors" title="Settings">
            <Settings size={18} />
          </button>
          <button onClick={onLogout} className="p-2 text-t2 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Logout">
            <LogOut size={18} />
          </button>
        </div>

      </div>

      <div className="p-3 border-b border-b flex items-center justify-between">
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-t3 font-semibold ml-1">Conversations</span>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="w-7 h-7 rounded-lg bg-s2 hover:bg-s3 border border-b flex items-center justify-center text-a transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {showAdd && (
        <div className="p-3 bg-s2 border-b border-b flex gap-2">
          <input 
            type="text" 
            placeholder="Paste User ID..." 
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            className="flex-1 bg-bg border border-b rounded-lg px-3 py-2 text-xs uppercase focus:border-a outline-none transition-colors"
          />
          <button onClick={handleAdd} className="bg-a/10 text-a px-3 rounded-lg hover:bg-a/20 transition-colors">
            <UserPlus size={16} />
          </button>
        </div>
      )}

      <div className="p-3 border-b border-b">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t3" />
          <input 
            type="text" 
            placeholder="Search contacts..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg border border-b rounded-xl pl-9 pr-3 py-2 text-xs text-text focus:border-a outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredContacts.length === 0 ? (
          <div className="text-center text-t3 text-xs mt-8">No contacts found</div>
        ) : (
          filteredContacts.map(([uid, c], idx) => {
            const isActive = activeConv === uid;
            const displayName = isIncognito ? `Hidden Contact ${idx + 1}` : c.name;
            const displayId = isIncognito ? "HIDDEN-ID" : uid;
            const displayColor = isIncognito ? "#6b7280" : c.avatarColor;
            
            return (
              <div 
                key={uid}
                onClick={() => {
                  onSelectConv(uid, c);
                  setShowMobile(false);
                }}
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-s3 border border-b' : 'hover:bg-s2 border border-transparent'}`}
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs relative shrink-0 overflow-hidden"
                  style={{ backgroundColor: `${displayColor}22`, color: displayColor, border: `1px solid ${displayColor}33` }}
                >
                  {decryptedAvatars[uid] && !isIncognito ? (
                    <img src={decryptedAvatars[uid]} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    displayName.substring(0,2).toUpperCase()
                  )}
                  {c.online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ok rounded-full border-2 border-s1"></div>}
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-text truncate">{displayName}</div>
                    <div className="text-[0.65rem] text-t3 truncate">
                      {displayId.toUpperCase()}
                    </div>
                  </div>
                  {unreadMap[uid] && (
                    <div className="w-2.5 h-2.5 bg-a rounded-full shadow-[0_0_8px_rgba(0,212,255,0.8)]"></div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
