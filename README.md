# YTDWN

A minimal YouTube video and audio downloader with a clean, accessible web interface.

## Features

- Download videos in multiple resolutions (480p up to 4K)
- Extract audio as MP3, M4A, OPUS, FLAC, or WAV
- One-click "best quality" download
- Real-time download progress
- BPM and musical key analysis
- Dark theme UI with mobile support
- Browser extension for Chrome, Firefox, and Safari

## Prerequisites

- [Bun](https://bun.sh) runtime
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available in PATH
- FFmpeg (required by yt-dlp for merging video+audio streams)

## Setup

```bash
bun install
```

## Run

```bash
bun run dev
```

Try it at [ytdwn.vanity.pw](https://ytdwn.vanity.pw) or run locally.

## Build

```bash
bun run build
```

## Docker

```bash
docker compose up -d
```

The app runs on port 3000.

## Browser Extension

The extension popup detects the current YouTube video and lets you download it directly without leaving the page.

### Download

Pre-built packages are available on the [releases page](https://github.com/agonyx/ytdwn/releases/latest).

- `ytdwn-chrome.zip` — Chrome / Chromium
- `ytdwn-firefox.zip` — Firefox
- `ytdwn-safari.zip` — Safari (macOS)

### Install (Chrome)

1. Download and extract `ytdwn-chrome.zip`
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extracted `ytdwn-chrome/` directory

### Install (Firefox)

1. Download and extract `ytdwn-firefox.zip`
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `ytdwn-firefox/manifest.json` inside the extracted directory

### Install (Safari)

1. Download and extract `ytdwn-safari.zip`
2. Convert the extension:

```bash
xcrun safari-web-extension-converter ytdwn-safari
```

### Build from source

```bash
cd extension && bash build.sh
```

This produces unpacked directories and zips in `extension/dist/`.

## License

MIT
