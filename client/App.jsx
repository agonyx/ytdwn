import { useState, useCallback } from "react";
import UrlInput from "./components/UrlInput";
import VideoInfo from "./components/VideoInfo";

export default function App() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [progress, setProgress] = useState(null);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const download = useCallback(async (formatId, audioFormat) => {
    setDownloading(formatId);
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
        setProgress((p) => ({ ...p, percent: 100 }));
        const fileRes = await fetch(`/api/file?file=${encodeURIComponent(filename)}`);
        if (!fileRes.ok) throw new Error("File download failed");

        const blob = await fileRes.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setTimeout(() => {
        setDownloading(null);
        setProgress(null);
      }, 1500);
    }
  }, [videoUrl]);

  return (
    <div className="app">
      <header className="header">
        <h1>YTDWN</h1>
        <p>YouTube Video Downloader</p>
      </header>

      <UrlInput onSubmit={fetchInfo} loading={loading} />

      {error && <div className="error">{error}</div>}

      {videoData && (
        <VideoInfo
          video={videoData}
          onDownload={download}
          downloading={downloading}
          progress={progress}
        />
      )}
    </div>
  );
}
