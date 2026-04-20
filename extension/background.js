const SERVER = "https://ytdwn.vanity.pw";
const DEFAULT_MAX_HISTORY = 50;

let downloadState = {
  active: false,
  percent: 0,
  speed: "",
  filename: null,
  error: null,
  done: false,
  meta: null,
};

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function startBackgroundDownload({ videoUrl, formatId, audioFormat, meta }) {
  downloadState = {
    active: true,
    percent: 0,
    speed: "",
    filename: null,
    error: null,
    done: false,
    meta: meta || null,
  };

  try {
    const res = await fetch(`${SERVER}/api/download`, {
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.percent !== undefined) {
              downloadState.percent = data.percent;
              downloadState.speed = data.speed || "";
              broadcast({
                type: "downloadProgress",
                percent: data.percent,
                speed: data.speed || "",
              });
            }
          } catch {}
        }
        if (line.startsWith("event: done")) {
          const nextLine = lines[i + 1];
          if (nextLine && nextLine.startsWith("data: ")) {
            try {
              const data = JSON.parse(nextLine.slice(6));
              downloadState.filename = data.filename;
            } catch {}
          }
        }
        if (line.startsWith("event: error")) {
          const nextLine = lines[i + 1];
          if (nextLine && nextLine.startsWith("data: ")) {
            try {
              const data = JSON.parse(nextLine.slice(6));
              downloadState.error = data.error;
              broadcast({ type: "downloadError", error: data.error });
            } catch {}
          }
        }
      }
    }

    if (downloadState.filename) {
      downloadState.percent = 95;
      broadcast({
        type: "downloadProgress",
        percent: 95,
        speed: "Saving...",
      });

      chrome.downloads.download({
        url: `${SERVER}/api/file?file=${encodeURIComponent(downloadState.filename)}`,
        filename: downloadState.filename,
      });

      downloadState.percent = 100;
      downloadState.done = true;
      downloadState.active = false;
      broadcast({
        type: "downloadDone",
        filename: downloadState.filename,
      });

      saveToHistory(downloadState.meta, downloadState.filename);
    } else if (!downloadState.error) {
      downloadState.error = "No filename received";
      downloadState.active = false;
      broadcast({ type: "downloadError", error: "No filename received" });
    }
  } catch (err) {
    downloadState.error = err.message;
    downloadState.active = false;
    broadcast({ type: "downloadError", error: err.message });
  }
}

async function saveToHistory(meta, filename) {
  if (!meta) return;
  try {
    const storedSync = await chrome.storage.sync.get("settings");
    const maxHistory = storedSync.settings?.historyCount || DEFAULT_MAX_HISTORY;
    const stored = await chrome.storage.local.get("history");
    const history = stored.history || [];
    history.unshift({
      title: meta.title,
      videoId: meta.videoId,
      url: meta.url,
      format: meta.format,
      filename,
      timestamp: Date.now(),
    });
    await chrome.storage.local.set({ history: history.slice(0, maxHistory) });
  } catch {}
}

async function getHistory() {
  try {
    const stored = await chrome.storage.local.get("history");
    return stored.history || [];
  } catch {}
  return [];
}

async function clearHistory() {
  try {
    await chrome.storage.local.remove("history");
  } catch {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "startDownload") {
    startBackgroundDownload(msg);
    sendResponse({ started: true });
    return;
  }
  if (msg.type === "getDownloadStatus") {
    sendResponse(downloadState);
    return;
  }
  if (msg.type === "getHistory") {
    getHistory().then(sendResponse);
    return true;
  }
  if (msg.type === "clearHistory") {
    clearHistory().then(() => sendResponse({ done: true }));
    return true;
  }
  if (msg.type === "download") {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
    });
    return;
  }
  if (msg.type === "fetch") {
    fetch(msg.url, msg.options)
      .then(async (res) => {
        const contentType = res.headers.get("content-type") || "";
        if (
          contentType.includes("video/") ||
          contentType.includes("audio/") ||
          contentType.includes("application/octet-stream")
        ) {
          const buffer = await res.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return {
            ok: res.ok,
            status: res.status,
            body: btoa(binary),
            binary: true,
          };
        }
        const text = await res.text();
        return { ok: res.ok, status: res.status, body: text, binary: false };
      })
      .then(sendResponse)
      .catch((err) =>
        sendResponse({ ok: false, status: 0, body: err.message, binary: false })
      );
    return true;
  }
});
