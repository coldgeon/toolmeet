import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
import {once} from "node:events";
import {createFrontendServer} from "../frontend/dev.mjs";
import {root, startBackend, waitForApi} from "./runtime.mjs";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const backendPort = await freePort();
let logs = "";
const backend = startBackend(["app.py"], {env: {TOOLMEET_BACKEND_PORT: String(backendPort)}, stdio: ["ignore", "pipe", "pipe"]});
backend.stdout.on("data", (data) => { logs += data; });
backend.stderr.on("data", (data) => { logs += data; });
let spawnError;
backend.on("error", (error) => { spawnError = error; });
const frontend = createFrontendServer({backendPort});
try {
  await waitForApi(`http://127.0.0.1:${backendPort}/api/health`, backend);
  if (spawnError) throw spawnError;
  frontend.listen(0, "127.0.0.1"); await once(frontend, "listening");
  const base = `http://127.0.0.1:${frontend.address().port}`;
  for (const [route, text] of [["/", "질문하기"], ["/news", "분야별로 보기"], ["/news/", "가상 시연 데이터"], ["/explore", "툴밋"], ["/demo", "툴밋"]]) {
    const result = await fetch(base + route);
    assert.equal(result.status, 200, route);
    const html = await result.text();
    assert(html.includes(text), `${route}: missing ${text}`);
    for (const match of html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)) {
      assert.equal((await fetch(base + match[1])).status, 200, match[1]);
    }
  }
  const source = JSON.parse(fs.readFileSync(path.join(root, "frontend/dist/brief_mock.json"), "utf8"));
  const mockWindow = {fetch: async () => new Response(JSON.stringify(source))};
  vm.runInNewContext(fs.readFileSync(path.join(root, "frontend/dist/mock_api.js"), "utf8"), {
    window: mockWindow, document: {currentScript: {src: "https://example.test/mock_api.js"}},
    location: {href: "https://example.test/"}, URL, Request, Response, crypto: webcrypto,
  });
  for (const post of source.board_posts) {
    for (const profile of [{}, {policy: "denied", installation: "denied"}, {policy: "allowed", installation: "allowed", data_kind: "public", ecosystem: "google", hosting: "self_hosted"}]) {
      const body = JSON.stringify({work: post.work, ...profile});
      const options = {method: "POST", headers: {"Content-Type": "application/json"}, body};
      const apiResponse = await fetch(base + "/api/brief", options);
      assert.equal(apiResponse.status, 200);
      const api = await apiResponse.json();
      const mock = await (await mockWindow.fetch("/api/brief", options)).json();
      const compare = (result) => ({topic: result.topic, news: result.related_news.map((x) => x.id), candidates: result.candidates.map((x) => ({id: x.id, status: x.status})).sort((a,b) => a.id.localeCompare(b.id))});
      assert.deepEqual(compare(api), compare(mock), `API/static drift: ${post.topic}`);
      assert.equal(api.topic, post.topic);
    }
  }
  const demo = await (await fetch(base + "/api/demo?task=meeting")).json();
  assert.equal(demo.synthetic, true);
  assert(demo.documents[0].text.includes("회의"));
  const invalid = await fetch(base + "/api/brief", {method: "POST", body: JSON.stringify({work: "짧음"})});
  assert.equal(invalid.status, 400);
  const missing = await fetch(base + "/missing"); assert.equal(missing.status, 404);
  console.log("Integration passed: 5 pages + assets, API proxy, 15 API/static recommendation comparisons, legacy demo sample, invalid input");
} catch (error) {
  console.error(logs); throw error;
} finally {
  frontend.closeAllConnections();
  await new Promise((resolve) => frontend.close(resolve));
  if (backend.exitCode === null && !spawnError) {
    const exit = once(backend, "exit"); backend.kill(); await exit;
  }
}
