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
  const modeVideoBtn = $("#mode-video");
  const modeAudioBtn = $("#mode-audio");
  const smartDownload = $("#smart-download");
  const smartBtn = $("#smart-btn");
  const smartBtnLabel = $("#smart-btn-label");
  const smartBtnSize = $("#smart-btn-size");
  const smartProgressBar = $("#smart-progress-bar");
  const smartProgressFill = $("#smart-progress-fill");
  const toggleOptions = $("#toggle-options");
  const toggleLabel = $("#toggle-label");
  const toggleChevron = $("#toggle-chevron");
  const analysisSection = $("#analysis-section");
  const analyzeBtn = $("#analyze-btn");

  let videoUrl = null;
  let videoData = null;
  let currentMode = "video";
  let downloading = false;
  let showAll = false;
  let analyzing = false;
  let analysisData = null;

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

  function getBestFormat() {
    const isAudio = currentMode === "audio";
    const formats = isAudio ? videoData.formats.audioOnly : videoData.formats.videoAudio;
    return formats.length > 0 ? formats[0] : null;
  }

  function updateSmartButton() {
    if (!videoData || downloading) return;

    const best = getBestFormat();
    if (!best) {
      hide(smartDownload);
      return;
    }

    show(smartDownload);

    const isAudio = currentMode === "audio";
    if (isAudio) {
      smartBtnLabel.textContent = "Download Audio (MP3)";
      smartBtnSize.textContent = "";
    } else {
      smartBtnLabel.textContent = `Download Video (${best.height}p)`;
      const size = best.filesize || best.filesizeApprox;
      smartBtnSize.textContent = size ? formatSize(size) : "";
    }
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

  function updateUI() {
    if (!videoData) return;

    updateSmartButton();

    if (!downloading && !analyzing) {
      show(analysisSection);
    } else {
      hide(analysisSection);
    }

    if (showAll && !downloading) {
      show(formatsList);
    } else {
      hide(formatsList);
    }

    if (!downloading) {
      show(toggleOptions);
      toggleLabel.textContent = showAll ? "Hide options" : "More options...";
      toggleChevron.classList.toggle("open", showAll);
    } else {
      hide(toggleOptions);
    }
  }

  async function fetchInfo(url) {
    hide(errorSection);
    hide(videoSection);
    hide(analysisSection);
    hide(smartDownload);
    hide(toggleOptions);
    hide(formatsList);
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
      showAll = false;
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
      analysisData = null;
      updateUI();
      renderAnalysis();
    } catch (err) {
      hide(loadingSection);
      errorMsg.textContent = err.message;
      show(errorSection);
    }
  }

  async function startDownload(formatId, audioFormat) {
    downloading = true;
    hide(formatsList);
    hide(toggleOptions);
    smartBtn.disabled = true;

    const isAudio = currentMode === "audio";
    smartBtnLabel.textContent = "Preparing...";
    smartBtnSize.textContent = "";
    show(smartProgressBar);
    smartProgressFill.style.width = "0%";

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
                smartProgressFill.style.width = `${data.percent}%`;
                smartBtnLabel.textContent = `${Math.round(data.percent)}%`;
                if (data.speed) smartBtnSize.textContent = data.speed;
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
        smartProgressFill.style.width = "95%";
        smartBtnLabel.textContent = "95%";
        smartBtnSize.textContent = "Saving...";

        chrome.downloads.download({
          url: `${SERVER}/api/file?file=${encodeURIComponent(filename)}`,
          filename: filename,
        });

        smartProgressFill.style.width = "100%";
        smartProgressFill.classList.add("done");
        smartBtnLabel.textContent = "Done!";
        smartBtnLabel.classList.add("done");
        smartBtnSize.textContent = "";
      }
    } catch (err) {
      smartBtnLabel.textContent = "Failed";
      smartBtnSize.textContent = err.message;
    } finally {
      downloading = false;
      smartBtn.disabled = false;
    }
  }

  analyzeBtn.addEventListener("click", async () => {
    if (!videoUrl || analyzing) return;
    analyzing = true;
    analysisData = null;
    renderAnalysis();

    try {
      const res = await fetch(`${SERVER}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl }),
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
          if (line.startsWith("event: done")) {
            const idx = lines.indexOf(line);
            const nextLine = lines[idx + 1];
            if (nextLine && nextLine.startsWith("data: ")) {
              try {
                analysisData = JSON.parse(nextLine.slice(6));
              } catch {}
            }
          }
          if (line.startsWith("event: error")) {
            const idx = lines.indexOf(line);
            const nextLine = lines[idx + 1];
            if (nextLine && nextLine.startsWith("data: ")) {
              try {
                const data = JSON.parse(nextLine.slice(6));
                analysisData = { error: data.error };
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      analysisData = { error: err.message };
    } finally {
      analyzing = false;
      renderAnalysis();
    }
  });

  function renderAnalysis() {
    if (!videoData) return;

    if (analyzing) {
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:1.5px;border-top-color:#ff1a3d;"></span> Analyzing...`;
      analyzeBtn.classList.add("analyzing");
      return;
    }

    if (analysisData && !analysisData.error) {
      analysisSection.innerHTML = `
        <div class="analysis-results">
          <div class="analysis-item">
            <span class="analysis-label">BPM</span>
            <span class="analysis-value bpm">${analysisData.bpm}</span>
            ${analysisData.bpmConfidence > 0 ? `<span class="analysis-confidence">${Math.round(analysisData.bpmConfidence * 100)}%</span>` : ""}
          </div>
          <div class="analysis-divider"></div>
          <div class="analysis-item">
            <span class="analysis-label">Key</span>
            <span class="analysis-value key">${analysisData.key} ${analysisData.scale}</span>
            ${analysisData.keyStrength > 0 ? `<span class="analysis-confidence">${Math.round(analysisData.keyStrength * 100)}%</span>` : ""}
          </div>
        </div>`;
      return;
    }

    if (analysisData && analysisData.error) {
      analysisSection.innerHTML = `
        <div class="analysis-error">
          <span>${analysisData.error}</span>
          <button class="analyze-btn retry" id="analyze-retry">Retry</button>
        </div>`;
      $("#analyze-retry").addEventListener("click", () => analyzeBtn.click());
      return;
    }

    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
      Analyze BPM & Key`;
    analyzeBtn.classList.remove("analyzing");
  }

  smartBtn.addEventListener("click", () => {
    const best = getBestFormat();
    if (!best) return;
    const isAudio = currentMode === "audio";
    startDownload(best.formatId, isAudio ? "mp3" : undefined);
  });

  toggleOptions.addEventListener("click", () => {
    showAll = !showAll;
    updateUI();
  });

  modeVideoBtn.addEventListener("click", () => {
    currentMode = "video";
    modeVideoBtn.classList.add("active");
    modeAudioBtn.classList.remove("active");
    showAll = false;
    renderFormats();
    updateUI();
  });

  modeAudioBtn.addEventListener("click", () => {
    currentMode = "audio";
    modeAudioBtn.classList.add("active");
    modeVideoBtn.classList.remove("active");
    showAll = false;
    renderFormats();
    updateUI();
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
