import { useState, useEffect, useRef } from "react";

const SETTINGS_KEY = "ytdwn_settings";

const DEFAULT_SETTINGS = {
  historyCount: 50,
  autoAnalyze: false,
};

export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export default function Settings({ settings, onChange, open, onClose }) {
  const [local, setLocal] = useState(settings);
  const panelRef = useRef(null);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  const handleChange = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(next);
  };

  if (!open) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-panel" ref={panelRef}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="settings-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-group">
          <label className="settings-label">
            History limit
            <span className="settings-desc">Max number of items to keep in history</span>
          </label>
          <div className="settings-control-row">
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={local.historyCount}
              onChange={(e) => handleChange("historyCount", Number(e.target.value))}
              className="settings-range"
            />
            <span className="settings-range-value">{local.historyCount}</span>
          </div>
        </div>

        <div className="settings-group">
          <label className="settings-label">
            Auto-analyze BPM & Key
            <span className="settings-desc">Automatically analyze audio when fetching video info</span>
          </label>
          <button
            className={`settings-toggle${local.autoAnalyze ? " active" : ""}`}
            onClick={() => handleChange("autoAnalyze", !local.autoAnalyze)}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>
      </div>
    </div>
  );
}
