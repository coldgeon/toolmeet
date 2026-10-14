import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, "src");
const data = path.join(root, "..", "shared", "data");
const mediaTypes = {".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".json": "application/json"};
const assets = {
  "/": ["index.html", "text/html"],
  "/news": ["news.html", "text/html"],
  "/news/": ["news.html", "text/html"],
  "/explore": ["explore.html", "text/html"],
  "/demo": ["legacy.html", "text/html"],
};
for (const name of ["brief.js", "news.js", "app.js", "legacy.js", "catalog.js", "projects.js", "exploration.js", "conversation.js"]) assets[`/${name}`] = [name, "text/javascript"];
for (const name of ["brief.css", "discover.css", "style.css"]) assets[`/${name}`] = [name, "text/css"];

export function createFrontendServer({backendPort = 8765} = {}) {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/")) {
      const upstream = http.request({
        hostname: "127.0.0.1", port: backendPort, path: request.url,
        method: request.method, headers: {...request.headers, host: `127.0.0.1:${backendPort}`},
      }, (result) => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      });
      upstream.setTimeout(190000, () => upstream.destroy(new Error("API timeout")));
      upstream.on("error", () => {
        if (response.headersSent) return response.destroy();
        response.writeHead(502, {"Content-Type": "application/json; charset=utf-8"});
        response.end(JSON.stringify({error: "백엔드에 연결할 수 없습니다. npm run dev로 함께 실행해 주세요."}));
      });
      request.on("aborted", () => upstream.destroy());
      request.pipe(upstream);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405); response.end(); return;
    }
    try {
      let body, contentType;
      const asset = assets[pathname];
      if (pathname === "/brief_mock.json") {
        // Serve the same mock source as the static build; this is a frontend asset, not a new API.
        const [feed, rules] = await Promise.all(["brief_mock.json", "topic_rules.json"].map(async (name) =>
          JSON.parse(await fs.readFile(path.join(data, name), "utf8"))));
        body = Buffer.from(JSON.stringify({...feed, topic_rules: rules}) + "\n");
        contentType = "application/json; charset=utf-8";
      } else if (asset) {
        body = await fs.readFile(path.join(source, asset[0]));
        contentType = `${asset[1]}; charset=utf-8`;
      } else if (/^\/media\/catalog\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|png|jpe?g|webp|mp4|webm|json)$/.test(pathname)) {
        const file = path.resolve(source, "." + pathname);
        const [realSource, realFile] = await Promise.all([fs.realpath(source), fs.realpath(file)]);
        const relative = path.relative(realSource, realFile);
        if (relative.startsWith("..") || path.isAbsolute(relative)) { response.writeHead(404); response.end("Not found"); return; }
        body = await fs.readFile(realFile);
        contentType = mediaTypes[path.extname(file)];
      } else {
        response.writeHead(404); response.end("Not found"); return;
      }
      response.writeHead(200, {"Content-Type": contentType, "Content-Length": body.length, "Cache-Control": "no-store"});
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      if (error.code === "ENOENT" && pathname.startsWith("/media/")) {
        response.writeHead(404); response.end("Not found"); return;
      }
      response.writeHead(500); response.end("Unable to load frontend asset");
      console.error(error.message);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.TOOLMEET_FRONTEND_PORT || 5173);
  const server = createFrontendServer({backendPort: Number(process.env.TOOLMEET_BACKEND_PORT || 8765)});
  server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => console.log(`Toolmeet web: http://127.0.0.1:${port}`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
}
