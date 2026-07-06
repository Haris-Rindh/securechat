// Secure/Subtle Notification Tones using Web Audio API

let _audioCtx = null;
function getAudioCtx() {
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}

export function playNotificationTone(toneName) {
  const audioCtx = getAudioCtx();
  if (!audioCtx) return;
  if (!toneName || toneName === "none") return;
  
  // Resume context if needed (browsers require user interaction first, 
  // which will happen when they select a tone or interact with the app)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (toneName === "subtle_tap") {
    // Very short, low frequency thump. Sounds like a microphone bump.
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } 
  else if (toneName === "system_error") {
    // A jarring triangle wave that sounds like a generic Windows background error
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.setValueAtTime(400, now + 0.1);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }
  else if (toneName === "soft_sine") {
    // High frequency but very soft and gentle
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
  else if (toneName === "cricket") {
    // High pitched rapid chirps
    osc.type = "square";
    osc.frequency.setValueAtTime(2500, now);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.setValueAtTime(0, now + 0.02);
    gainNode.gain.setValueAtTime(0.05, now + 0.04);
    gainNode.gain.setValueAtTime(0, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}
