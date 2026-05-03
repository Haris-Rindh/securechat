import { useState } from "react";
import { Search, Plus, UserPlus, LogOut, Copy } from "lucide-react";

export default function Sidebar({ user, contacts, activeConv, onSelectConv, onAddContact, onLogout, showMobile, setShowMobile }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addId, setAddId] = useState("");

  const filteredContacts = Object.entries(contacts).filter(([uid, c]) => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || uid.includes(search.toUpperCase())
  );

  const copyId = () => {
    navigator.clipboard.writeText(user.uid);
    alert("ID copied to clipboard!");
  };

  const handleAdd = () => {
    if (!addId) return;
    onAddContact(addId.toUpperCase());
    setAddId("");
    setShowAdd(false);
  };

  return (
    <div className={`w-full md:w-80 bg-s1 border-r border-b flex flex-col transition-transform duration-300 absolute md:relative z-20 h-full ${showMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      {/* Current User Header */}
      <div className="p-4 border-b border-b flex items-center gap-3 bg-s2">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
          style={{ backgroundColor: `${user.avatarColor}22`, color: user.avatarColor, border: `1px solid ${user.avatarColor}44` }}
        >
          {user.name.substring(0,2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text truncate">{user.name}</div>
          <div className="text-[0.65rem] text-t3 flex items-center gap-1 cursor-pointer hover:text-a transition-colors" onClick={copyId}>
            ID: {user.uid} <Copy size={10} />
          </div>
        </div>
        <button onClick={onLogout} className="p-2 text-t2 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Logout">
          <LogOut size={18} />
        </button>
        {showMobile && (
          <button onClick={() => setShowMobile(false)} className="md:hidden p-2 text-t2 hover:text-text rounded-lg transition-colors">
            ✕
          </button>
        )}
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
          filteredContacts.map(([uid, c]) => {
            const isActive = activeConv === uid;
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
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs relative shrink-0"
                  style={{ backgroundColor: `${c.avatarColor}22`, color: c.avatarColor, border: `1px solid ${c.avatarColor}33` }}
                >
                  {c.name.substring(0,2).toUpperCase()}
                  {c.online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ok rounded-full border-2 border-s1"></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-text truncate">{c.name}</div>
                  <div className="text-[0.65rem] text-t3 truncate">
                    {uid}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
