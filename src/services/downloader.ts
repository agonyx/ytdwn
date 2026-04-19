import { spawn } from "child_process";
import fs from "fs";
import path from "path";

interface Format {
  format_id: string;
  ext: string;
  height: number | null;
  width: number | null;
  fps: number | null;
  filesize: number | null;
  filesize_approx: number | null;
  tbr: number | null;
  vbr: number | null;
  abr: number | null;
  vcodec: string;
  acodec: string;
  format_note: string;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  formats: Format[];
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", ["-J", "--no-playlist", url]);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        return;
      }

      try {
        const json = JSON.parse(stdout);
        resolve({
          title: json.title,
          thumbnail: json.thumbnail,
          duration: json.duration,
          formats: json.formats || [],
        });
      } catch {
        reject(new Error("Failed to parse yt-dlp output"));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  });
}

export interface ParsedFormat {
  formatId: string;
  ext: string;
  height: number | null;
  fps: number | null;
  filesize: number | null;
  filesizeApprox: number | null;
  vcodec: string;
  acodec: string;
  tbr: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  quality: string;
}

export function parseFormats(formats: Format[]): {
  videoAudio: ParsedFormat[];
  audioOnly: ParsedFormat[];
} {
  const parsed: ParsedFormat[] = formats
    .filter((f) => f.format_id && (f.filesize || f.filesize_approx || f.tbr))
    .map((f) => ({
      formatId: f.format_id,
      ext: f.ext,
      height: f.height,
      fps: f.fps,
      filesize: f.filesize,
      filesizeApprox: f.filesize_approx,
      vcodec: f.vcodec,
      acodec: f.acodec,
      tbr: f.tbr,
      hasVideo: f.vcodec !== "none" && f.vcodec !== null,
      hasAudio: f.acodec !== "none" && f.acodec !== null,
      quality: f.format_note || (f.height ? `${f.height}p` : ""),
    }));

  const videoAudio = parsed
    .filter((f) => f.hasVideo)
    .filter((f, i, arr) => {
      const seen = arr.findIndex(
        (x) => x.height === f.height && x.ext === f.ext
      );
      return seen === i;
    })
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const audioOnly = parsed
    .filter((f) => !f.hasVideo && f.hasAudio)
    .filter((f, i, arr) => {
      const seen = arr.findIndex(
        (x) => Math.round((x.tbr || 0) / 10) === Math.round((f.tbr || 0) / 10) && x.ext === f.ext
      );
      return seen === i;
    })
    .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))
    .slice(0, 5);

  return { videoAudio, audioOnly };
}

const AUDIO_FORMATS = ["mp3", "m4a", "opus", "flac", "wav"] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  opus: "audio/opus",
  flac: "audio/flac",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function getContentType(ext: string): string {
  return CONTENT_TYPES[ext.toLowerCase()] || "application/octet-stream";
}

function findLatestFile(downloadDir: string): string | null {
  const files = fs.readdirSync(downloadDir).map((name) => {
    const filePath = path.join(downloadDir, name);
    const stat = fs.statSync(filePath);
    return { filePath, mtime: stat.mtimeMs };
  });
  if (files.length === 0) return null;
  files.sort((a, b) => b.mtime - a.mtime);
  return files[0]!.filePath;
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
}

function runYtDlp(
  args: string[],
  downloadDir: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const before = new Set(fs.readdirSync(downloadDir));
    const proc = spawn("yt-dlp", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let allOutput = "";

    const parseProgress = (data: string) => {
      const match = data.match(
        /\[download\]\s+([\d.]+)%\s+of\s+~?[\d.]+\w+\s+at\s+([\d.]+\w+\/s)\s+ETA\s+([\d:]+)/
      );
      if (match && match[1] && match[2] && match[3] && onProgress) {
        onProgress({
          percent: parseFloat(match[1]) * 0.85,
          speed: match[2],
          eta: match[3],
        });
      }
    };

    proc.stdout.on("data", (data: Buffer) => {
      allOutput += data.toString();
      parseProgress(data.toString());
    });
    proc.stderr.on("data", (data: Buffer) => {
      allOutput += data.toString();
      parseProgress(data.toString());
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(allOutput || `yt-dlp exited with code ${code}`));
        return;
      }

      const after = fs.readdirSync(downloadDir);
      const newFiles = after.filter((f) => !before.has(f));
      if (newFiles.length > 0) {
        const latest = newFiles
          .map((f) => ({
            path: path.join(downloadDir, f),
            mtime: fs.statSync(path.join(downloadDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime)[0];
        resolve(latest!.path);
        return;
      }

      const fallback = findLatestFile(downloadDir);
      if (fallback) {
        resolve(fallback);
        return;
      }

      reject(new Error("Could not determine output file path"));
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  });
}

export async function downloadVideo(
  url: string,
  formatId: string,
  downloadDir: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  const args = [
    "-f",
    `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio/${formatId}`,
    "--merge-output-format",
    "mp4",
    "-o",
    `${downloadDir}/%(title)s.%(ext)s`,
    "--no-playlist",
    "--newline",
    url,
  ];
  return runYtDlp(args, downloadDir, onProgress);
}

export async function downloadAudio(
  url: string,
  formatId: string,
  audioFormat: AudioFormat,
  downloadDir: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  const args = [
    "-f",
    formatId,
    "-x",
    "--audio-format",
    audioFormat,
    "--audio-quality",
    "0",
    "-o",
    `${downloadDir}/%(title)s.%(ext)s`,
    "--no-playlist",
    "--newline",
    url,
  ];
  return runYtDlp(args, downloadDir, onProgress);
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "N/A";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
