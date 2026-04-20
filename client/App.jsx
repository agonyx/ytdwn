import { useState, useCallback, useEffect, useRef } from "react";
import UrlInput from "./components/UrlInput";
import VideoInfo from "./components/VideoInfo";
import Settings, { loadSettings, saveSettings } from "./components/Settings";

const HISTORY_KEY = "ytdwn_history";

function loadHistory(maxCount) {
  try {
    const items = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    return items.slice(0, maxCount);
  } catch {}
  return [];
}

function saveToHistory(entry, maxCount) {
  const history = loadHistory(maxCount);
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, maxCount)));
}

function clearAllHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function App() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [progress, setProgress] = useState(null);
  const [downloadDone, setDownloadDone] = useState(null);
  const [initialMode, setInitialMode] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState(() => loadHistory(loadSettings().historyCount));
  const analyzeCalledRef = useRef(false);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;

      const params = new URLSearchParams(hash);
      const url = params.get("download");
      if (url) {
        const mode = params.get("mode");
        if (mode) setInitialMode(mode);
        window.history.replaceState(null, "", window.location.pathname);
        fetchInfo(url);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const handleSettingsChange = useCallback((next) => {
    setSettings(next);
    saveSettings(next);
    setHistory(loadHistory(next.historyCount));
  }, []);

  const fetchInfo = async (url) => {
    setLoading(true);
    setError(null);
    setVideoData(null);
    setVideoUrl(url);

    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch video info");
      }

      setVideoData(data);

      if (settings.autoAnalyze) {
        analyzeCalledRef.current = false;
        triggerAnalyze(url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [resetKey, setResetKey] = useState(0);

  const reset = useCallback(() => {
    setVideoData(null);
    setVideoUrl(null);
    setDownloading(null);
    setProgress(null);
    setDownloadDone(null);
    setError(null);
    setAnalysis(null);
    setAnalyzing(false);
    setAnalysisProgress(null);
    setResetKey((k) => k + 1);
  }, []);

  const triggerAnalyze = useCallback(async (url) => {
    if (!url) return;
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisProgress(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: progress")) continue;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) setAnalysisProgress(data.message);
            } catch {}
          }
          if (line.startsWith("event: done")) {
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine && nextLine.startsWith("data: ")) {
              try {
                const data = JSON.parse(nextLine.slice(6));
                setAnalysis(data);
              } catch {}
            }
          }
          if (line.startsWith("event: error")) {
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine && nextLine.startsWith("data: ")) {
              try {
                const data = JSON.parse(nextLine.slice(6));
                setAnalysis({ error: data.error });
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      setAnalysis({ error: err.message });
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const analyze = useCallback(() => {
    triggerAnalyze(videoUrl);
  }, [videoUrl, triggerAnalyze]);

  const download = useCallback(async (formatId, audioFormat) => {
    setDownloading(formatId);
    setDownloadDone(null);
    setProgress({ percent: 0, speed: "", eta: "" });

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoUrl,
          formatId,
          ...(audioFormat ? { audioFormat } : {}),
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let filename = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: progress")) {
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.percent !== undefined) {
                setProgress(data);
              }
            } catch {}
          }
          if (line.startsWith("event: done")) {
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine && nextLine.startsWith("data: ")) {
              try {
                const data = JSON.parse(nextLine.slice(6));
                filename = data.filename;
              } catch {}
            }
          }
        }
      }

      if (filename) {
        setProgress({ percent: 95, speed: "Saving..." });
        const a = document.createElement("a");
        a.href = `/api/file?file=${encodeURIComponent(filename)}`;
        a.download = filename;
        a.click();

        setProgress({ percent: 100, speed: filename });
        setDownloadDone(formatId);

        const isAudio = !!audioFormat;
        saveToHistory({
          title: videoData.title,
          thumbnail: videoData.thumbnail,
          url: videoUrl,
          format: isAudio ? audioFormat.toUpperCase() : "Video",
          filename,
          timestamp: Date.now(),
        }, settings.historyCount);
        setHistory(loadHistory(settings.historyCount));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(null);
    }
  }, [videoUrl]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <h1>YTDWN</h1>
          <button className="settings-btn" onClick={() => setShowSettings(true)} title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
        <p>YouTube Video Downloader</p>
      </header>

      <Settings
        settings={settings}
        onChange={handleSettingsChange}
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <UrlInput onSubmit={fetchInfo} loading={loading} key={resetKey} />

      {error && <div className="error">{error}</div>}

      {videoData && (
        <VideoInfo
          video={videoData}
          onDownload={download}
          onReset={reset}
          downloading={downloading}
          progress={progress}
          downloadDone={downloadDone}
          initialMode={initialMode}
          analysis={analysis}
          analyzing={analyzing}
          analysisProgress={analysisProgress}
          onAnalyze={analyze}
        />
      )}

      {!videoData && !loading && history.length > 0 && (
        <div className="history-section">
          <div className="history-header">
            <span className="history-title">History</span>
            <button
              className="clear-history-btn"
              onClick={() => { clearAllHistory(); setHistory([]); }}
            >
              Clear
            </button>
          </div>
          <div className="history-list">
            {history.map((item, i) => (
              <div key={i} className="history-item" onClick={() => fetchInfo(item.url)}>
                <img className="history-thumb" src={item.thumbnail} alt="" />
                <div className="history-info">
                  <span className="history-item-title">{item.title}</span>
                  <span className="history-meta">{item.format} · {formatTimeAgo(item.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
