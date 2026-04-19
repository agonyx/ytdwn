(function () {
  const $ = (sel) => document.querySelector(sel);
  const YOUTUBE_REGEX =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]{11}/;

  const SERVER_URL = "https://ytdwn.vanity.pw";

  const statusBar = $("#status-bar");
  const statusText = statusBar.querySelector(".status-text");
  const youtubeSection = $("#youtube-section");
  const noYoutube = $("#no-youtube");

  const videoThumb = $("#video-thumb");
  const videoTitle = $("#video-title");
  const videoUrl = $("#video-url");
  const btnVideo = $("#btn-download-video");
  const btnAudio = $("#btn-download-audio");

  function setStatus(status, text) {
    statusBar.dataset.status = status;
    statusText.textContent = text;
  }

  async function checkServer() {
    try {
      const res = await fetch(`${SERVER_URL}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      });
      if (res.ok || res.status === 400) {
        setStatus("connected", "Server connected");
        return true;
      }
      throw new Error("bad response");
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

  async function init() {
    const serverOk = await checkServer();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !YOUTUBE_REGEX.test(tab.url)) {
      noYoutube.style.display = "block";
      return;
    }

    youtubeSection.style.display = "block";
    videoUrl.textContent = tab.url;

    const videoId = extractVideoId(tab.url);
    if (videoId) {
      videoThumb.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    videoTitle.textContent = tab.title
      ? tab.title.replace(/ - YouTube$/, "")
      : "YouTube Video";

    if (serverOk) {
      btnVideo.disabled = false;
      btnAudio.disabled = false;
    }
  }

  btnVideo.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;
    chrome.tabs.create({
      url: `${SERVER_URL}/#download=${encodeURIComponent(tab.url)}`,
    });
  });

  btnAudio.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;
    chrome.tabs.create({
      url: `${SERVER_URL}/#download=${encodeURIComponent(tab.url)}&mode=audio`,
    });
  });

  init();
})();
