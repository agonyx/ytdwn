const AUDIO_FORMATS = ["mp3", "m4a", "opus", "flac", "wav"];

function formatFileSize(bytes) {
  if (!bytes) return "N/A";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function getQualityTier(height) {
  if (height >= 2160) return "4k";
  if (height >= 1440) return "2k";
  if (height >= 1080) return "1080";
  if (height >= 720) return "720";
  return "480";
}

function getHumanLabel(format, isAudio) {
  if (isAudio) {
    const tbr = format.tbr;
    if (tbr >= 128) return "Best";
    if (tbr >= 64) return "Good";
    return "Standard";
  }
  const h = format.height;
  if (h >= 2160) return "Ultra HD";
  if (h >= 1440) return "2K";
  if (h >= 1080) return "Full HD";
  if (h >= 720) return "HD";
  return "Standard";
}

function getHumanDescription(format, isAudio) {
  if (isAudio) {
    const tbr = format.tbr;
    if (tbr >= 128) return "Highest audio quality";
    if (tbr >= 64) return "Good audio quality";
    return "Standard audio quality";
  }
  const h = format.height;
  if (h >= 2160) return "Highest quality, large file";
  if (h >= 1440) return "Very high quality";
  if (h >= 1080) return "Great quality, recommended";
  if (h >= 720) return "Good quality, smaller file";
  return "Small file, works everywhere";
}

function QualityBadge({ height, quality, isAudio }) {
  const label = height ? `${height}p` : quality || "—";
  const tier = isAudio ? "audio" : getQualityTier(height);
  return (
    <span className="quality-badge" data-quality={tier}>
      {label}
    </span>
  );
}

export default function FormatTable({ formats, onDownload, downloading, progress, isAudio, bestFormatId }) {
  const isDownloading = (formatId) => downloading === formatId;

  return (
    <div className="format-section">
      <div className="format-cards">
        {formats.map((f) => {
          const isBest = f.formatId === bestFormatId;
          return (
            <div
              key={f.formatId}
              className={`format-card${isDownloading(f.formatId) ? " downloading" : ""}`}
            >
              <QualityBadge height={f.height} quality={f.quality} isAudio={isAudio} />

              <div className="format-details">
                <span className="format-human-label">{getHumanLabel(f, isAudio)}</span>
                <span className="format-human-desc">{getHumanDescription(f, isAudio)}</span>
                <span className="format-size">{formatFileSize(f.filesize || f.filesizeApprox)}</span>
              </div>

              {isAudio && !isDownloading(f.formatId) && (
                <select
                  className="audio-format-select"
                  defaultValue="mp3"
                  disabled={isDownloading(f.formatId)}
                  id={`audio-fmt-${f.formatId}`}
                >
                  {AUDIO_FORMATS.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {fmt.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}

              {isBest && !isDownloading(f.formatId) && (
                <span className="recommended-badge">Recommended</span>
              )}

              {isDownloading(f.formatId) ? (
                <div className="progress-cell">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress?.percent || 0}%` }}
                    />
                  </div>
                  <span className="progress-text">
                    {progress?.percent !== undefined
                      ? `${Math.round(progress.percent)}%`
                      : "Preparing..."}
                  </span>
                  {progress?.speed && (
                    <span className="progress-meta">{progress.speed}</span>
                  )}
                </div>
              ) : (
                <button
                  className="download-btn"
                  onClick={() => {
                    const audioFormat = isAudio
                      ? document.getElementById(`audio-fmt-${f.formatId}`)?.value
                      : undefined;
                    onDownload(f.formatId, audioFormat);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
