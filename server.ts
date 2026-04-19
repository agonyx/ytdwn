import { handleInfo, handleDownloadStream, handleFileDownload, handleAnalyze } from "./src/routes/api";
import path from "path";
import fs from "fs";

const PORT = 3000;
const STATIC_DIR = path.resolve("client/dist");

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/info" && req.method === "POST") {
      return handleInfo(req);
    }

    if (url.pathname === "/api/download" && req.method === "POST") {
      return handleDownloadStream(req);
    }

    if (url.pathname === "/api/analyze" && req.method === "POST") {
      return handleAnalyze(req);
    }

    if (url.pathname === "/api/file" && req.method === "GET") {
      return handleFileDownload(req);
    }

    let servePath = path.join(STATIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
    servePath = path.resolve(servePath);

    if (!servePath.startsWith(path.resolve(STATIC_DIR) + path.sep) && servePath !== path.resolve(STATIC_DIR)) {
      return new Response("Not Found", { status: 404 });
    }

    if (!fs.existsSync(servePath)) {
      servePath = path.join(STATIC_DIR, "index.html");
    }

    if (fs.existsSync(servePath)) {
      return new Response(Bun.file(servePath));
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);
