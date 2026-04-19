import { useState } from "react";

export default function UrlInput({ onSubmit, loading }) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  };

  return (
    <div className="input-wrapper">
      <form className="url-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Paste YouTube URL here..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <button type="submit" disabled={loading || !url.trim()}>
          {loading ? (
            <span className="spinner" />
          ) : (
            <>
              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Fetch
            </>
          )}
        </button>
      </form>
    </div>
  );
}
