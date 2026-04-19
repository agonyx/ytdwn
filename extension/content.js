(function () {
  const SERVER_URL = "https://ytdwn.vanity.pw";
  let buttonInjected = false;

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
    videoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none"/></svg> Download Video`;
    videoBtn.className = "ytdwn-btn ytdwn-btn-video";

    const audioBtn = document.createElement("button");
    audioBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> Audio`;
    audioBtn.className = "ytdwn-btn ytdwn-btn-audio";

    videoBtn.addEventListener("click", () => openYtdwn("video"));
    audioBtn.addEventListener("click", () => openYtdwn("audio"));

    wrapper.appendChild(videoBtn);
    wrapper.appendChild(audioBtn);
    titleContainer.parentElement.insertBefore(
      wrapper,
      titleContainer.nextSibling
    );
    buttonInjected = true;
  }

  function openYtdwn(mode) {
    const url = window.location.href;
    const hash =
      mode === "audio"
        ? `#download=${encodeURIComponent(url)}&mode=audio`
        : `#download=${encodeURIComponent(url)}`;
    window.open(`${SERVER_URL}/${hash}`, "_blank");
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
      setTimeout(tryInject, 1000);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
