# YTDWN

A minimal YouTube video and audio downloader with a clean, accessible web interface.

## Features

- Download videos in multiple resolutions (480p up to 4K)
- Extract audio as MP3, M4A, OPUS, FLAC, or WAV
- One-click "best quality" download
- Real-time download progress
- Dark theme UI with mobile support

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

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
bun run build
```

## License

MIT
