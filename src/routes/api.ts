import {
  getVideoInfo,
  parseFormats,
  downloadVideo,
  downloadAudio,
  getContentType,
  type DownloadProgress,
} from "../services/downloader";
import { analyzeAudio } from "../services/analyzer";
import { isValidYouTubeUrl } from "../utils/helpers";
import path from "path";
import fs from "fs";

const DOWNLOAD_DIR = path.resolve("downloads");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

export function handleAnalyze(req: Request): Response {
  let aborted = false;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: any) => {
        if (aborted) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      (async () => {
        try {
          const body = (await req.json()) as { url?: string };
          const url = body.url?.trim();

          if (!url || !isValidYouTubeUrl(url)) {
            send("error", { error: "Please provide a valid YouTube URL" });
            controller.close();
            return;
          }

          const result = await analyzeAudio(url, (msg) =>
            send("progress", { message: msg })
          );
          send("done", result);
        } catch {
          send("error", { error: "Analysis failed" });
        }

        controller.close();
      })();

      req.signal.addEventListener("abort", () => {
        aborted = true;
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function handleInfo(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url || !isValidYouTubeUrl(url)) {
      return Response.json(
        { error: "Please provide a valid YouTube URL" },
        { status: 400 }
      );
    }

    const info = await getVideoInfo(url);
    const formats = parseFormats(info.formats);

    return Response.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      formats,
    });
  } catch {
    return Response.json(
      { error: "Failed to fetch video info" },
      { status: 500 }
    );
  }
}

export function handleDownloadStream(req: Request): Response {
  let aborted = false;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: any) => {
        if (aborted) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      (async () => {
        try {
          const body = (await req.json()) as {
            url?: string;
            formatId?: string;
            audioFormat?: string;
          };
          const { url, formatId, audioFormat } = body;

          if (!url || !isValidYouTubeUrl(url)) {
            send("error", { error: "Invalid URL" });
            controller.close();
            return;
          }

          if (!formatId || !/^\d+[+-]?\d*$/.test(formatId)) {
            send("error", { error: "Invalid format ID" });
            controller.close();
            return;
          }

          const isAudio = !!audioFormat;
          const onProgress = (p: DownloadProgress) => send("progress", p);

          const filePath = isAudio
            ? await downloadAudio(url, formatId, audioFormat as any, DOWNLOAD_DIR, onProgress)
            : await downloadVideo(url, formatId, DOWNLOAD_DIR, onProgress);

          if (!fs.existsSync(filePath)) {
            send("error", { error: "Downloaded file not found" });
            controller.close();
            return;
          }

          const filename = path.basename(filePath);
          const ext = path.extname(filename).replace(".", "");

          send("progress", { percent: 90, speed: "Processing...", eta: "" });

          send("done", {
            filename,
            contentType: getContentType(ext),
          });

          setTimeout(() => {
            try {
              fs.unlinkSync(filePath);
            } catch {}
          }, 30000);
        } catch {
          send("error", { error: "Download failed" });
        }

        controller.close();
      })();

      req.signal.addEventListener("abort", () => {
        aborted = true;
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function handleFileDownload(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filename = url.searchParams.get("file");

  if (!filename) {
    return Response.json({ error: "Missing filename" }, { status: 400 });
  }

  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return Response.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.resolve(DOWNLOAD_DIR, filename);

  if (!filePath.startsWith(path.resolve(DOWNLOAD_DIR) + path.sep)) {
    return Response.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).replace(".", "");

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": getContentType(ext),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
