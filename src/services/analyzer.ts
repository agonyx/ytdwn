import { spawn, execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const EssentiaWASM = require("essentia.js/dist/essentia-wasm.umd.js");
const Essentia = require("essentia.js/dist/essentia.js-core.umd.js");
const ffmpegPath = require("ffmpeg-static");

const ANALYSIS_DIR = path.resolve("analysis");

if (!fs.existsSync(ANALYSIS_DIR)) {
  fs.mkdirSync(ANALYSIS_DIR, { recursive: true });
}

export interface AudioAnalysis {
  bpm: number;
  bpmConfidence: number;
  key: string;
  scale: string;
  keyStrength: number;
}

export async function analyzeAudio(
  url: string,
  onProgress?: (msg: string) => void
): Promise<AudioAnalysis> {
  const essentia = new Essentia(EssentiaWASM);

  try {
    onProgress?.("Downloading audio...");

    const tmpFile = await downloadAudioForAnalysis(url);

    onProgress?.("Analyzing audio...");

    const samples = decodeToPCM(tmpFile, 120);
    const signal = essentia.arrayToVector(samples);

    const bpmResult = essentia.RhythmExtractor2013(signal);
    const keyResult = essentia.KeyExtractor(signal);

    const result: AudioAnalysis = {
      bpm: Math.round(bpmResult.bpm * 10) / 10,
      bpmConfidence: Math.round(bpmResult.confidence * 100) / 100,
      key: keyResult.key,
      scale: keyResult.scale,
      keyStrength: Math.round(keyResult.strength * 100) / 100,
    };

    bpmResult.ticks?.delete?.();
    bpmResult.estimates?.delete?.();
    bpmResult.bpmIntervals?.delete?.();
    signal.delete();

    try {
      fs.unlinkSync(tmpFile);
    } catch {}

    return result;
  } finally {
    essentia.delete();
  }
}

function downloadAudioForAnalysis(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      ANALYSIS_DIR,
      `analysis-${Date.now()}.wav`
    );

    const args = [
      "-f",
      "bestaudio[ext=m4a]/bestaudio/best",
      "-x",
      "--audio-format",
      "wav",
      "--audio-quality",
      "5",
      "-o",
      outputPath,
      "--no-playlist",
      "--newline",
      url,
    ];

    const proc = spawn("yt-dlp", args);
    let stderr = "";

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(stderr || `yt-dlp exited with code ${code}`)
        );
        return;
      }

      if (fs.existsSync(outputPath)) {
        resolve(outputPath);
        return;
      }

      const wavFile = outputPath.replace(/\.wav$/, ".m4a");
      if (fs.existsSync(wavFile)) {
        resolve(wavFile);
        return;
      }

      const files = fs
        .readdirSync(ANALYSIS_DIR)
        .filter((f) => f.startsWith("analysis-"))
        .sort()
        .reverse();

      if (files.length > 0) {
        resolve(path.join(ANALYSIS_DIR, files[0]!));
        return;
      }

      reject(new Error("Could not find downloaded audio file"));
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  });
}

function decodeToPCM(
  filePath: string,
  maxSeconds?: number
): Float32Array {
  const args: string[] = [
    "-i",
    filePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "44100",
    "-f",
    "f32le",
  ];

  if (maxSeconds) {
    args.push("-t", String(maxSeconds));
  }

  args.push("-");

  const buf = execFileSync(ffmpegPath, args, {
    maxBuffer: 300 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.length
  );
  return new Float32Array(ab);
}
