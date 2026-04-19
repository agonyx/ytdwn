(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const SERVER = "https://ytdwn.vanity.pw";
  const YOUTUBE_REGEX =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]{11}/;

  const statusBar = $("#status-bar");
  const statusText = statusBar.querySelector(".status-text");
  const loadingSection = $("#loading-section");
  const errorSection = $("#error-section");
  const errorMsg = $("#error-msg");
  const videoSection = $("#video-section");
  const noYoutube = $("#no-youtube");
  const formatsList = $("#formats-list");
  const progressSection = $("#progress-section");
  const progressFill = $("#progress-fill");
  const progressPercent = $("#progress-percent");
  const progressSpeed = $("#progress-speed");
  const modeVideoBtn = $("#mode-video");
  const modeAudioBtn = $("#mode-audio");

  let videoUrl = null;
  let videoData = null;
  let currentMode = "video";
  let downloading = false;

  function setStatus(status, text) {
    statusBar.dataset.status = status;
    statusText.textContent = text;
  }

  function show(el) {
    el.style.display = "";
  }

  function hide(el) {
    el.style.display = "none";
  }

  async function checkServer() {
    try {
      const res = await fetch(`${SERVER}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      });
      if (res.ok || res.status === 400) {
        setStatus("connected", "Server connected");
        return true;
      }
      throw new Error();
    } catch {
      setStatus("disconnected", "Server unreachable");
      return false;
    }
  }

  function extractVideoId(url) {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") return u.pathname.slice(1);
      if (u.searchParams.has("v")) return u.searchParams.get("v");
      const match = u.pathname.match(/(?:embed|shorts)\/([\w-]{11})/);
      if (match) return match[1];
    } catch {}
    return null;
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

  function getQualityTier(height) {
    if (height >= 2160) return "4k";
    if (height >= 1440) return "2k";
    if (height >= 1080) return "1080";
    if (height >= 720) return "720";
    return "480";
  }

  function getHumanLabel(f, isAudio) {
    if (isAudio) {
      if (f.tbr >= 128) return "Best";
      if (f.tbr >= 64) return "Good";
      return "Standard";
    }
    if (f.height >= 2160) return "Ultra HD";
    if (f.height >= 1440) return "2K";
    if (f.height >= 1080) return "Full HD";
    if (f.height >= 720) return "HD";
    return "Standard";
  }

  function getHumanDesc(f, isAudio) {
    if (isAudio) {
      if (f.tbr >= 128) return "Highest quality";
      if (f.tbr >= 64) return "Good quality";
      return "Standard quality";
    }
    if (f.height >= 2160) return "Large file";
    if (f.height >= 1440) return "Very high quality";
    if (f.height >= 1080) return "Recommended";
    if (f.height >= 720) return "Smaller file";
    return "Works everywhere";
  }

  function renderFormats() {
    formatsList.innerHTML = "";
    if (!videoData) return;

    const isAudio = currentMode === "audio";
    const formats = isAudio ? videoData.formats.audioOnly : videoData.formats.videoAudio;
    const bestFormatId = formats.length > 0 ? formats[0].formatId : null;

    formats.forEach((f) => {
      const row = document.createElement("div");
      row.className = "format-row" + (f.formatId === bestFormatId ? " recommended" : "");

      const tier = isAudio ? "audio" : getQualityTier(f.height);
      const label = isAudio ? `${Math.round(f.tbr)}kbps` : `${f.height}p`;

      let html = `<span class="quality-badge" data-quality="${tier}">${label}</span>`;
      html += `<div class="format-info">`;
      html += `<span class="format-label">${getHumanLabel(f, isAudio)}</span>`;
      html += `<span class="format-desc">${getHumanDesc(f, isAudio)}</span>`;
      html += `</div>`;
      html += `<span class="format-size">${formatSize(f.filesize || f.filesizeApprox)}</span>`;

      if (f.formatId === bestFormatId) {
        html += `<span class="recommended-tag">Best</span>`;
      }

      if (isAudio) {
        html += `<select class="audio-select" id="audio-fmt-${f.formatId}">
          <option value="mp3">MP3</option>
          <option value="m4a">M4A</option>
          <option value="opus">OPUS</option>
          <option value="flac">FLAC</option>
          <option value="wav">WAV</option>
        </select>`;
      }

      html += `<button class="dl-btn" data-format="${f.formatId}" ${downloading ? "disabled" : ""}>Download</button>`;

      row.innerHTML = html;
      formatsList.appendChild(row);
    });

    formatsList.querySelectorAll(".dl-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const formatId = btn.dataset.format;
        const isAudio = currentMode === "audio";
        const select = document.getElementById(`audio-fmt-${formatId}`);
        const audioFormat = isAudio && select ? select.value : undefined;
        startDownload(formatId, audioFormat);
      });
    });
  }

  async function fetchInfo(url) {
    hide(errorSection);
    hide(videoSection);
    show(loadingSection);

    try {
      const res = await fetch(`${SERVER}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch video info");

      videoData = data;
      hide(loadingSection);
      show(videoSection);

      const videoId = extractVideoId(url);
      if (videoId) {
        $("#video-thumb").src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
      $("#video-title").textContent = data.title;
      if (data.duration) {
        const min = Math.floor(data.duration / 60);
        const sec = String(data.duration % 60).padStart(2, "0");
        $("#video-duration").textContent = `${min}:${sec}`;
      }

      renderFormats();
    } catch (err) {
      hide(loadingSection);
      errorMsg.textContent = err.message;
      show(errorSection);
    }
  }

  async function startDownload(formatId, audioFormat) {
    downloading = true;
    disableAllButtons(true);
    show(progressSection);
    progressFill.style.width = "0%";
    progressPercent.textContent = "0%";
    progressSpeed.textContent = "";

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
      let filename = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.percent !== undefined) {
                progressFill.style.width = `${data.percent}%`;
                progressPercent.textContent = `${Math.round(data.percent)}%`;
                if (data.speed) progressSpeed.textContent = data.speed;
              }
            } catch {}
          }
          if (line.startsWith("event: done")) {
            const idx = lines.indexOf(line);
            const nextLine = lines[idx + 1];
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
        progressFill.style.width = "100%";
        progressPercent.textContent = "100%";
        progressSpeed.textContent = "Saving...";

        const fileRes = await fetch(`${SERVER}/api/file?file=${encodeURIComponent(filename)}`);
        if (!fileRes.ok) throw new Error("File download failed");

        const blob = await fileRes.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);

        progressSpeed.textContent = "Done!";
      }
    } catch (err) {
      progressPercent.textContent = "Failed";
      progressSpeed.textContent = err.message;
    } finally {
      downloading = false;
      disableAllButtons(false);
      setTimeout(() => hide(progressSection), 2000);
    }
  }

  function disableAllButtons(disabled) {
    formatsList.querySelectorAll(".dl-btn").forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  modeVideoBtn.addEventListener("click", () => {
    currentMode = "video";
    modeVideoBtn.classList.add("active");
    modeAudioBtn.classList.remove("active");
    renderFormats();
  });

  modeAudioBtn.addEventListener("click", () => {
    currentMode = "audio";
    modeAudioBtn.classList.add("active");
    modeVideoBtn.classList.remove("active");
    renderFormats();
  });

  async function init() {
    await checkServer();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !YOUTUBE_REGEX.test(tab.url)) {
      show(noYoutube);
      return;
    }

    videoUrl = tab.url;
    fetchInfo(videoUrl);
  }

  init();
})();
