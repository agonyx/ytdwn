(function () {
  const SERVER = "https://ytdwn.vanity.pw";
  let buttonInjected = false;
  let overlayOpen = false;

  function apiFetch(url, options) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "fetch", url, options },
        (response) => {
          if (!response) return reject(new Error("No response from background"));
          if (!response.ok) {
            try {
              const err = JSON.parse(response.body);
              reject(new Error(err.error || `HTTP ${response.status}`));
            } catch {
              reject(new Error(response.body || `HTTP ${response.status}`));
            }
          } else {
            try {
              resolve(JSON.parse(response.body));
            } catch {
              reject(new Error("Invalid JSON"));
            }
          }
        }
      );
    });
  }

  function createButton() {
    if (buttonInjected) return;
    const titleContainer =
      document.querySelector("#above-the-fold #title") ||
      document.querySelector("#info .title") ||
      document.querySelector("ytd-watch-metadata #title");

    if (!titleContainer) return;

    const wrapper = document.createElement("div");
    wrapper.id = "ytdwn-btn-wrapper";
    wrapper.style.cssText =
      "display:inline-flex;gap:8px;margin-top:8px;align-items:center;";

    const videoBtn = document.createElement("button");
    videoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none"/></svg> Download`;
    videoBtn.className = "ytdwn-btn ytdwn-btn-video";
    videoBtn.addEventListener("click", () => openOverlay("video"));

    const audioBtn = document.createElement("button");
    audioBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> Audio`;
    audioBtn.className = "ytdwn-btn ytdwn-btn-audio";
    audioBtn.addEventListener("click", () => openOverlay("audio"));

    wrapper.appendChild(videoBtn);
    wrapper.appendChild(audioBtn);
    titleContainer.parentElement.insertBefore(
      wrapper,
      titleContainer.nextSibling
    );
    buttonInjected = true;
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

  function getQualityTier(h) {
    if (h >= 2160) return "4k";
    if (h >= 1440) return "2k";
    if (h >= 1080) return "1080";
    if (h >= 720) return "720";
    return "480";
  }

  function getLabel(f, isAudio) {
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

  function getDesc(f, isAudio) {
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

  function openOverlay(initialMode) {
    if (overlayOpen) return;
    overlayOpen = true;

    const backdrop = document.createElement("div");
    backdrop.className = "ytdwn-backdrop";
    backdrop.addEventListener("click", closeOverlay);

    const overlay = document.createElement("div");
    overlay.id = "ytdwn-overlay";
    overlay.innerHTML = `
      <div class="ytdwn-overlay-header">
        <h1>YTDWN</h1>
        <button class="ytdwn-overlay-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="ytdwn-overlay-body" id="ytdwn-body">
        <div class="ytdwn-loading" id="ytdwn-loading">
          <span class="ytdwn-spinner"></span>
          <p>Fetching video info...</p>
        </div>
      </div>
      <div class="ytdwn-overlay-footer">
        <span>ytdwn.vanity.pw</span>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(overlay);

    overlay.querySelector(".ytdwn-overlay-close").addEventListener("click", closeOverlay);

    fetchAndRender(initialMode);
  }

  function closeOverlay() {
    const overlay = document.getElementById("ytdwn-overlay");
    const backdrop = document.querySelector(".ytdwn-backdrop");
    if (overlay) {
      overlay.classList.add("closing");
      setTimeout(() => {
        overlay.remove();
        backdrop?.remove();
        overlayOpen = false;
      }, 200);
    } else {
      backdrop?.remove();
      overlayOpen = false;
    }
  }

  async function fetchAndRender(initialMode) {
    const body = document.getElementById("ytdwn-body");
    if (!body) return;

    const url = window.location.href;

    try {
      const data = await apiFetch(`${SERVER}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      let mode = initialMode || "video";
      let downloading = false;

      function renderFormats() {
        const isAudio = mode === "audio";
        const formats = isAudio ? data.formats.audioOnly : data.formats.videoAudio;
        const bestId = formats.length > 0 ? formats[0].formatId : null;

        let html = `
          <div class="ytdwn-video-card">
            <img src="${data.thumbnail}" alt="">
            <div class="ytdwn-video-meta">
              <p>${escHtml(data.title)}</p>
              ${data.duration ? `<span>${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, "0")}</span>` : ""}
            </div>
          </div>
          <div class="ytdwn-mode-toggle">
            <button class="ytdwn-mode-btn ${mode === "video" ? "active" : ""}" id="ytdwn-mode-video">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none"/>
              </svg>
              Video
            </button>
            <button class="ytdwn-mode-btn ${mode === "audio" ? "active" : ""}" id="ytdwn-mode-audio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              Audio
            </button>
          </div>
          <div class="ytdwn-formats" id="ytdwn-formats">
        `;

        formats.forEach((f) => {
          const tier = isAudio ? "audio" : getQualityTier(f.height);
          const label = isAudio ? `${Math.round(f.tbr)}kbps` : `${f.height}p`;
          const isBest = f.formatId === bestId;

          html += `<div class="ytdwn-format-row ${isBest ? "recommended" : ""}">`;
          html += `<span class="ytdwn-quality-badge" data-q="${tier}">${label}</span>`;
          html += `<div class="ytdwn-format-info">`;
          html += `<span class="ytdwn-format-label">${getLabel(f, isAudio)}</span>`;
          html += `<span class="ytdwn-format-desc">${getDesc(f, isAudio)}</span>`;
          html += `</div>`;
          html += `<span class="ytdwn-format-size">${formatSize(f.filesize || f.filesizeApprox)}</span>`;
          if (isBest) html += `<span class="ytdwn-best-tag">Best</span>`;
          if (isAudio) {
            html += `<select class="ytdwn-audio-select" id="ytdwn-asel-${f.formatId}">
              <option value="mp3">MP3</option><option value="m4a">M4A</option>
              <option value="opus">OPUS</option><option value="flac">FLAC</option>
              <option value="wav">WAV</option>
            </select>`;
          }
          html += `<button class="ytdwn-dl-btn" data-fmt="${f.formatId}" ${downloading ? "disabled" : ""}>Download</button>`;
          html += `</div>`;
        });

        html += `</div><div class="ytdwn-progress" id="ytdwn-progress" style="display:none">
          <div class="ytdwn-progress-bar"><div class="ytdwn-progress-fill" id="ytdwn-pfill" style="width:0%"></div></div>
          <div class="ytdwn-progress-info">
            <span class="ytdwn-progress-pct" id="ytdwn-ppct">0%</span>
            <span class="ytdwn-progress-speed" id="ytdwn-pspd"></span>
          </div>
        </div>`;

        body.innerHTML = html;

        document.getElementById("ytdwn-mode-video").addEventListener("click", () => {
          mode = "video";
          renderFormats();
        });
        document.getElementById("ytdwn-mode-audio").addEventListener("click", () => {
          mode = "audio";
          renderFormats();
        });

        document.querySelectorAll(".ytdwn-dl-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const fmt = btn.dataset.fmt;
            const sel = document.getElementById(`ytdwn-asel-${fmt}`);
            const af = mode === "audio" && sel ? sel.value : undefined;
            startDownload(fmt, af, url);
          });
        });
      }

      async function startDownload(formatId, audioFormat, videoUrl) {
        downloading = true;
        document.querySelectorAll(".ytdwn-dl-btn").forEach((b) => (b.disabled = true));

        const prog = document.getElementById("ytdwn-progress");
        const fill = document.getElementById("ytdwn-pfill");
        const pct = document.getElementById("ytdwn-ppct");
        const spd = document.getElementById("ytdwn-pspd");
        prog.style.display = "";
        fill.style.width = "0%";
        pct.textContent = "0%";
        spd.textContent = "";

        try {
          const res = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                type: "fetch",
                url: `${SERVER}/api/download`,
                options: {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    url: videoUrl,
                    formatId,
                    ...(audioFormat ? { audioFormat } : {}),
                  }),
                },
              },
              (response) => {
                if (!response) return reject(new Error("No response"));
                resolve(response);
              }
            );
          });

          if (!res.ok) {
            try {
              const err = JSON.parse(res.body);
              throw new Error(err.error || "Download failed");
            } catch (e) {
              if (e.message !== "Download failed" && !e.message.includes("Download failed")) throw e;
              throw new Error(res.body || "Download failed");
            }
          }

          const text = res.body;
          const lines = text.split("\n");
          let filename = null;
          let lastPercent = 0;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith("data: ")) {
              try {
                const d = JSON.parse(line.slice(6));
                if (d.percent !== undefined) {
                  lastPercent = d.percent;
                  fill.style.width = `${d.percent}%`;
                  pct.textContent = `${Math.round(d.percent)}%`;
                  if (d.speed) spd.textContent = d.speed;
                }
              } catch {}
            }
            if (line.startsWith("event: done")) {
              const next = lines[i + 1];
              if (next && next.startsWith("data: ")) {
                try {
                  const d = JSON.parse(next.slice(6));
                  filename = d.filename;
                } catch {}
              }
            }
          }

          if (filename) {
            fill.style.width = "100%";
            pct.textContent = "100%";
            spd.textContent = "Saving...";

            const fileRes = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage(
                {
                  type: "fetch",
                  url: `${SERVER}/api/file?file=${encodeURIComponent(filename)}`,
                  options: {},
                },
                (response) => {
                  if (!response) return reject(new Error("No response"));
                  resolve(response);
                }
              );
            });

            if (!fileRes.ok) throw new Error("File download failed");

            const byteChars = atob(fileRes.body);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteArray[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([byteArray]);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);

            pct.textContent = "Done!";
            spd.textContent = filename;
          }
        } catch (err) {
          pct.textContent = "Failed";
          spd.textContent = err.message;
        } finally {
          downloading = false;
          setTimeout(() => {
            prog.style.display = "none";
            document.querySelectorAll(".ytdwn-dl-btn").forEach((b) => (b.disabled = false));
          }, 3000);
        }
      }

      renderFormats();
    } catch (err) {
      body.innerHTML = `<div class="ytdwn-error">${escHtml(err.message)}</div>`;
    }
  }

  function escHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function tryInject() {
    if (buttonInjected) return;
    createButton();
  }

  const observer = new MutationObserver(() => {
    tryInject();
  });

  function init() {
    tryInject();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("yt-navigate-finish", () => {
      buttonInjected = false;
      const old = document.getElementById("ytdwn-btn-wrapper");
      if (old) old.remove();
      if (overlayOpen) closeOverlay();
      setTimeout(tryInject, 1000);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
