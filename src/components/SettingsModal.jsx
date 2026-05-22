import { useState } from "react";
import { X, Volume2, ShieldAlert } from "lucide-react";
import { ref, update } from "firebase/database";
import { db } from "../firebase";
import { playNotificationTone } from "../audio";

const TONES = [
  { id: "none", name: "Silent (No Sound)" },
  { id: "subtle_tap", name: "Subtle Tap (Like a mic bump)" },
  { id: "system_error", name: "System Error (Generic OS sound)" },
  { id: "soft_sine", name: "Soft Sine (Gentle wave)" },
  { id: "cricket", name: "Cricket (Tiny chirp)" }
];

export default function SettingsModal({ user, onClose, onUpdate }) {
  const [tone, setTone] = useState(user.notificationTone || "none");
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || "");

  const handleTestTone = (selectedTone) => {
    setTone(selectedTone);
    playNotificationTone(selectedTone);
  };

  const handleSave = async () => {
    try {
      const updates = { name, bio, notificationTone: tone };
      await update(ref(db, `users/${user.uid}`), updates);
      onUpdate(updates);
      onClose();
    } catch {
      alert("Failed to save settings");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-s1 border border-b rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-b bg-s2 shrink-0">
          <h2 className="font-bold text-lg text-text">Profile & Security</h2>
          <button onClick={onClose} className="p-1 hover:bg-danger/20 hover:text-danger rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          
          {/* Profile Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-t3 uppercase tracking-wider">Profile</h3>
            <div>
              <label className="block text-xs text-t2 mb-1.5 ml-1">Display Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-t2 mb-1.5 ml-1">Bio (Optional)</label>
              <textarea 
                value={bio} 
                onChange={e => setBio(e.target.value)}
                maxLength={120}
                rows={2}
                className="w-full bg-bg border border-b rounded-xl px-4 py-2.5 text-sm text-text focus:border-a outline-none transition-colors resize-none"
              />
              <div className="text-right text-[0.6rem] text-t3 mt-1">{bio.length}/120</div>
            </div>
          </div>

          {/* Secure Notifications Section */}
          <div className="space-y-4 pt-4 border-t border-b">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={16} className="text-warn" />
              <h3 className="text-xs font-bold text-warn uppercase tracking-wider">Stealth Notifications</h3>
            </div>
            <p className="text-[0.65rem] text-t2 leading-relaxed bg-warn/5 p-3 border border-warn/10 rounded-lg">
              To keep your privacy absolute, notifications do not show banners on your screen or lock screen. 
              Instead, pick a generic background sound that only <strong>you</strong> recognize. If someone else is using the device, they will assume it's a random system glitch or ambient noise.
            </p>
            
            <div className="space-y-2 mt-4">
              {TONES.map(t => (
                <label key={t.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${tone === t.id ? 'bg-s3 border-a' : 'bg-bg border-b hover:border-t3'}`}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="tone" 
                      value={t.id} 
                      checked={tone === t.id}
                      onChange={() => handleTestTone(t.id)}
                      className="accent-a"
                    />
                    <span className="text-sm">{t.name}</span>
                  </div>
                  {tone === t.id && t.id !== "none" && <Volume2 size={16} className="text-a" />}
                </label>
              ))}
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-b bg-s2 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-b text-t2 hover:text-text hover:bg-s3 transition-colors text-sm font-semibold">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-a to-a2 text-black hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all text-sm font-bold">
            Save Settings
          </button>
        </div>

      </div>
    </div>
  );
}
