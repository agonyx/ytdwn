import { useState } from "react";
import FormatTable from "./FormatTable";

export default function VideoInfo({ video, onDownload, downloading, progress }) {
  const [mode, setMode] = useState("video");
  const [showAll, setShowAll] = useState(false);

  const duration = video.duration
    ? `${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, "0")}`
    : null;

  const videoFormats = video.formats.videoAudio || [];
  const audioFormats = video.formats.audioOnly || [];
  const activeFormats = mode === "video" ? videoFormats : audioFormats;

  const bestVideo = videoFormats.length > 0 ? videoFormats[0] : null;
  const bestAudio = audioFormats.length > 0 ? audioFormats[0] : null;
  const bestFormat = mode === "video" ? bestVideo : bestAudio;

  const handleSmartDownload = () => {
    if (mode === "audio" && bestAudio) {
      onDownload(bestAudio.formatId, "mp3");
    } else if (bestVideo) {
      onDownload(bestVideo.formatId);
    }
  };

  const smartLabel =
    mode === "video"
      ? `Download Video${bestVideo ? ` (${bestVideo.height}p)` : ""}`
      : `Download Audio (MP3)`;

  return (
    <div className="video-info">
      <div className="video-header">
        <div className="thumbnail-wrap">
          <img src={video.thumbnail} alt={video.title} className="thumbnail" />
        </div>
        <div className="video-meta">
          <h2>{video.title}</h2>
          {duration && (
            <span className="duration">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" fill="none" stroke="#080808" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              {duration}
            </span>
          )}
        </div>
      </div>

      <div className="mode-toggle">
        <button
          className={`mode-btn${mode === "video" ? " active" : ""}`}
          onClick={() => { setMode("video"); setShowAll(false); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none" />
          </svg>
          Video
        </button>
        <button
          className={`mode-btn${mode === "audio" ? " active" : ""}`}
          onClick={() => { setMode("audio"); setShowAll(false); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Audio
        </button>
      </div>

      {bestFormat && (
        <button
          className="smart-download-btn"
          onClick={handleSmartDownload}
          disabled={downloading === bestFormat.formatId}
        >
          {downloading === bestFormat.formatId ? (
            <>
              <span className="spinner" />
              <span className="smart-download-progress">
                {progress?.percent !== undefined ? `${Math.round(progress.percent)}%` : "Preparing..."}
              </span>
              {progress?.speed && <span className="smart-download-meta">{progress.speed}</span>}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {smartLabel}
              {bestVideo && mode === "video" && bestVideo.filesize && (
                <span className="smart-download-size">
                  {formatSize(bestVideo.filesize || bestVideo.filesizeApprox)}
                </span>
              )}
            </>
          )}
        </button>
      )}

      {downloading === bestFormat?.formatId && progress && (
        <div className="smart-progress-bar">
          <div className="smart-progress-fill" style={{ width: `${progress.percent || 0}%` }} />
        </div>
      )}

      <button className="toggle-options-btn" onClick={() => setShowAll((s) => !s)}>
        {showAll ? "Hide options" : "More options..."}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`chevron${showAll ? " open" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showAll && activeFormats.length > 0 && (
        <FormatTable
          formats={activeFormats}
          onDownload={onDownload}
          downloading={downloading}
          progress={progress}
          isAudio={mode === "audio"}
          bestFormatId={bestFormat?.formatId}
        />
      )}
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
