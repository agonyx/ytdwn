# YTDWN

A minimal YouTube video and audio downloader with a clean, accessible web interface.

## Features

- Download videos in multiple resolutions (480p up to 4K)
- Extract audio as MP3, M4A, OPUS, FLAC, or WAV
- One-click "best quality" download
- Real-time download progress
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

Try it at [ytdwn.vanity.pw](https://ytdwn.vanity.pw) or run locally:

## Build

```bash
bun run build
```

## Browser Extension

The extension adds a "Download" button directly on YouTube video pages and provides a popup to quickly download the current video.

### Install (Chrome)

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` directory

### Install (Firefox)

First build the extension, then load the unpacked directory:

```bash
cd extension && bash build.sh
```

1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `extension/dist/ytdwn-firefox/manifest.json`

### Install (Safari)

First build the extension:

```bash
cd extension && bash build.sh
```

Then convert the Safari build:

```bash
xcrun safari-web-extension-converter extension/dist/ytdwn-safari
```

### Build packages

```bash
cd extension && bash build.sh
```

This produces unpacked directories and zips in `extension/dist/`:
- `ytdwn-chrome/` and `ytdwn-chrome.zip`
- `ytdwn-firefox/` and `ytdwn-firefox.zip`
- `ytdwn-safari/` and `ytdwn-safari.zip`

## License

MIT
