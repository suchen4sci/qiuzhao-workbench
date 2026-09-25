import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { addJob, dashboardDir, listJobs, updateJob, workbookPath } from "./lib/store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");
const port = Number(process.env.PORT || 33210);

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("请求内容过大");
  }
  return body ? JSON.parse(body) : {};
}

function errorStatus(error) {
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "CONFLICT" || error.code === "DUPLICATE") return 409;
  if (error.code === "WORKBOOK_LOCKED") return 423;
  if (error.code === "INVALID") return 400;
  return 500;
}

async function serveStatic(res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const resolved = path.resolve(publicDir, requested);
  if (!resolved.startsWith(publicDir)) return sendJson(res, 403, { error: "禁止访问" });
  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "页面不存在" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/jobs") {
      return sendJson(res, 200, { jobs: await listJobs(), workbookPath, refreshedAt: new Date().toISOString() });
    }
    if (req.method === "POST" && url.pathname === "/api/jobs") {
      return sendJson(res, 201, { job: await addJob(await readJson(req)) });
    }
    if (req.method === "POST" && url.pathname === "/api/open-external") {
      const body = await readJson(req);
      let target;
      try {
        target = new URL(String(body.url || ""));
      } catch {
        const error = new Error("链接格式无效");
        error.code = "INVALID";
        throw error;
      }
      if (!['http:', 'https:'].includes(target.protocol)) {
        const error = new Error("只允许打开 http 或 https 链接");
        error.code = "INVALID";
        throw error;
      }
      spawn("rundll32.exe", ["url.dll,FileProtocolHandler", target.toString()], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
      return sendJson(res, 200, { ok: true });
    }
    const match = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === "PATCH" && match) {
      const body = await readJson(req);
      return sendJson(res, 200, {
        job: await updateJob(decodeURIComponent(match[1]), body.patch || {}, body.expectedVersion || "")
      });
    }
    if (req.method === "GET") return serveStatic(res, url.pathname);
    sendJson(res, 405, { error: "不支持这个操作" });
  } catch (error) {
    sendJson(res, errorStatus(error), { error: error.message, code: error.code || "ERROR", current: error.current });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`秋招看板已启动：http://127.0.0.1:${port}`);
  console.log(`本地数据：${workbookPath}`);
});
