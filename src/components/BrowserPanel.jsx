import { useState } from "react";
import { Globe, X, ArrowLeft, ArrowRight, RotateCw, ExternalLink } from "lucide-react";

export default function BrowserPanel({ onClose }) {
  const [urlInput, setUrlInput] = useState("");
  const [currentUrl, setCurrentUrl] = useState("https://www.wikipedia.org");
  const [history, setHistory] = useState(["https://www.wikipedia.org"]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const navigateTo = (url) => {
    let targetUrl = url.trim();
    if (!targetUrl) return;
    
    // Auto prefix protocol if missing
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(targetUrl);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentUrl(targetUrl);
    setUrlInput(targetUrl);
  };

  const handleGo = (e) => {
    e.preventDefault();
    navigateTo(urlInput);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setCurrentUrl(history[idx]);
      setUrlInput(history[idx]);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      setCurrentUrl(history[idx]);
      setUrlInput(history[idx]);
    }
  };

  const handleReload = () => {
    // Hacky reload by momentarily clearing and resetting url
    const temp = currentUrl;
    setCurrentUrl("");
    setTimeout(() => setCurrentUrl(temp), 50);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-s1 border-l border-b min-w-0 md:min-w-[400px] z-10 relative">
      {/* Navigation Bar */}
      <div className="h-14 border-b border-b bg-s2 flex items-center px-3 gap-2 shrink-0">
        <button 
          onClick={handleBack} 
          disabled={historyIndex === 0}
          className="p-2 hover:bg-s3 rounded-lg text-t2 hover:text-text disabled:opacity-40 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <button 
          onClick={handleForward} 
          disabled={historyIndex === history.length - 1}
          className="p-2 hover:bg-s3 rounded-lg text-t2 hover:text-text disabled:opacity-40 transition-colors"
        >
          <ArrowRight size={16} />
        </button>
        <button 
          onClick={handleReload}
          className="p-2 hover:bg-s3 rounded-lg text-t2 hover:text-text transition-colors"
        >
          <RotateCw size={14} />
        </button>

        <form onSubmit={handleGo} className="flex-1 flex items-center bg-bg border border-b focus-within:border-a rounded-xl px-3 py-1.5 transition-colors">
          <Globe size={14} className="text-t3 mr-2 shrink-0" />
          <input 
            type="text" 
            placeholder="Search or enter web address..." 
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-transparent border-none text-text text-xs outline-none"
          />
        </form>

        <button 
          onClick={() => window.open(currentUrl, "_blank")}
          className="p-2 hover:bg-s3 rounded-lg text-t2 hover:text-text transition-colors"
          title="Open in New Tab"
        >
          <ExternalLink size={15} />
        </button>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-danger/20 hover:text-danger rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Frame Container */}
      <div className="flex-1 bg-black relative">
        {currentUrl ? (
          <iframe 
            src={currentUrl} 
            title="Embedded Web Viewer"
            className="w-full h-full border-none bg-white"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-t3 animate-pulse">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}
