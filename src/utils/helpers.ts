export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export const YOUTUBE_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]{11}/;

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_REGEX.test(url);
}
