import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { addJob, listJobs, updateJob, workbookPath } from "./lib/store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");


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
  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) return sendJson(res, 403, { error: "禁止访问" });
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

export function createDashboardServer({ openExternal } = {}) {
 return http.createServer(async (req, res) => {
  try {
    const expectedHost = `127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== expectedHost && req.headers.host !== `localhost:${req.socket.localPort}`) {
      return sendJson(res, 403, { error: "只允许本机访问" });
    }
    // No CORS: an unrelated web page cannot read or mutate the local job store.
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      return sendJson(res, 403, { error: "不允许跨站请求" });
    }
    const url = new URL(req.url, `http://${expectedHost}`);
    if (url.pathname.startsWith('/api/') && req.headers['sec-fetch-site'] === 'cross-site') return sendJson(res, 403, { error: "不允许跨站请求" });
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
      if (!openExternal) return sendJson(res, 400, { error: "请复制链接到浏览器打开" });
      await openExternal(target.toString());
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
}

export async function startDashboard(options = {}) {
 const server = createDashboardServer(options);
 await new Promise((resolve, reject) => {
   server.once('error', reject);
   server.listen(options.port ?? 0, '127.0.0.1', resolve);
 });
 return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

function openSystemBrowser(url) {
  const command = process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command[1], { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
 const port = Number(process.env.PORT || 33210);
 startDashboard({ port, openExternal: openSystemBrowser }).then(() => {
  console.log(`秋招看板已启动：http://127.0.0.1:${port}`);
  console.log(`本地数据：${workbookPath}`);
 }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
