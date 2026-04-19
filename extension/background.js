chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
