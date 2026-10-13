import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {webcrypto} from "node:crypto";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
import {JSDOM} from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(fs.readFileSync(path.join(root, "dist", "brief_mock.json"), "utf8"));
const externalRequests = [];
const window = {
  fetch: async (input) => {
    externalRequests.push(String(input));
    assert.equal(new URL(input).pathname, "/brief_mock.json");
    return new Response(JSON.stringify(source), {status: 200});
  },
};
vm.runInNewContext(fs.readFileSync(path.join(root, "dist", "mock_api.js"), "utf8"), {
  window, document: {currentScript: {src: "https://example.test/mock_api.js"}},
  location: {href: "https://example.test/"}, URL, Request, Response, crypto: webcrypto,
});

async function get(pathname, body) {
  const response = await window.fetch(pathname, body ? {method: "POST", body: JSON.stringify(body)} : {});
  return {status: response.status, body: await response.json()};
}

const board = await get("/api/board");
const news = await get("/api/news");
assert.equal(board.body.data_mode, "mock");
assert.equal(board.body.posts.length, 5);
assert.equal(news.body.news.length, 9);
assert(news.body.news.some((item) => item.topic === "health" && !item.sample_work));
assert(news.body.news.some((item) => item.topic === "meeting" && item.sample_work));
for (const post of board.body.posts) {
  const result = await get("/api/brief", {work: post.work});
  assert.equal(result.body.topic, post.topic, `Wrong task for ${post.work}`);
}
for (const [file, strings] of [["index.html", ["질문하기", "툴밋", 'href="news/"']], ["news/index.html", ["분야별로 보기", "가상 시연 데이터"]]]) {
  const html = fs.readFileSync(path.join(root, "dist", file), "utf8");
  strings.forEach((text) => assert(html.includes(text), `Missing ${text} in ${file}`));
  assert(!/(?:href|src)="\//.test(html));
}

const meeting = await get("/api/brief", {work: "회의록에서 결정과 할 일을 정리하고 싶어요"});
const summary = await get("/api/brief", {work: "여러 문서를 비교해 요약 보고서를 만들고 싶어요"});
assert.equal(meeting.body.topic, "meeting");
assert.equal(summary.body.topic, "summary");
assert.notDeepEqual(meeting.body.related_news.map((item) => item.id), summary.body.related_news.map((item) => item.id));
assert(!JSON.stringify(meeting.body).includes("source_url"));

const denied = await get("/api/brief", {work: "회의록에서 할 일을 정리하고 싶어요", policy: "denied"});
assert(denied.body.candidates.some((item) => item.status === "excluded"));
const deniedId = denied.body.candidates.find((item) => item.status === "excluded").id;
assert.equal((await get("/api/brief/confirm", {brief_token: denied.body.brief_token, candidate_id: deniedId, confirmed: true})).status, 400);

const allowed = await get("/api/brief", {
  work: "회의록에서 할 일을 구글 시트에 정리하고 싶어요", policy: "allowed", installation: "allowed",
  ecosystem: "google", data_kind: "public", hosting: "self_hosted",
});
const possible = allowed.body.candidates.find((item) => item.status === "possible" && item.kind !== "툴밋 방법");
assert(possible);
const confirmed = await get("/api/brief/confirm", {brief_token: allowed.body.brief_token, candidate_id: possible.id, confirmed: true});
assert.equal(confirmed.status, 200);
assert.match(confirmed.body.source_url, /^https:\/\//);
assert.equal(externalRequests.length, 1);
console.log("Static mock API: board, news, dynamic recommendations, and link gate passed");

async function settleDom() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

const packagedMedia = JSON.parse(fs.readFileSync(path.join(root, "dist", "media", "catalog", "provenance.json"), "utf8"));
assert.equal(packagedMedia.contract_version, "exploration.v1");
assert.deepEqual(packagedMedia.media.map((item) => item.project_id).sort(), source.candidates.map((item) => item.id).sort());
for (const media of packagedMedia.media) {
  assert.equal(media.content_kind, "synthetic");
  assert.equal(media.provenance.rights_status, "owned");
  assert(media.provenance.rights_note.trim());
  assert(media.src.startsWith("media/catalog/"));
  assert(!media.src.includes(".."));
  const filename = path.join(root, "dist", media.src);
  assert(fs.existsSync(filename), `Missing packaged image ${media.src}`);
  const svg = new JSDOM(fs.readFileSync(filename, "utf8"), {contentType: "image/svg+xml"});
  assert.equal(svg.window.document.documentElement.localName, "svg");
  svg.window.close();
}

for (const prefix of ["/", "/toolmeet/"]) {
  const base = new URL(prefix, "https://example.test");
  for (const [filename, page] of [["index.html", ""], ["news/index.html", "news/"]]) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, "dist", filename), "utf8"), {url: new URL(page, base).href});
    try {
      for (const element of dom.window.document.querySelectorAll("script[src], link[rel=stylesheet][href], a[href]")) {
        const raw = element.getAttribute("src") ?? element.getAttribute("href");
        if (raw.startsWith("#")) continue;
        const resolved = new URL(raw, dom.window.location.href);
        assert.equal(resolved.origin, base.origin, `Unexpected external static link ${raw}`);
        assert(resolved.pathname.startsWith(base.pathname), `Link escaped ${prefix}: ${raw}`);
        const relative = resolved.pathname.slice(base.pathname.length);
        const asset = relative.endsWith("/") || relative === "" ? relative + "index.html" : relative;
        assert(fs.existsSync(path.join(root, "dist", asset)), `Missing ${prefix} asset/link ${raw}`);
        assert(!["explore", "demo"].includes(relative), "Local demonstrations must stay out of static navigation");
      }
    } finally {
      dom.window.close();
    }
  }

  const dom = new JSDOM(fs.readFileSync(path.join(root, "dist", "index.html"), "utf8"), {url: base.href, runScripts: "outside-only"});
  try {
    const browser = dom.window;
    const document = browser.document;
    browser.Response = Response;
    browser.Request = Request;
    browser.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
    browser.HTMLElement.prototype.scrollIntoView = () => {};
    const nativeRequests = [];
    browser.fetch = async (input) => {
      const url = new URL(input, base);
      nativeRequests.push(url.href);
      assert.equal(url.origin, base.origin);
      assert(url.pathname.startsWith(prefix), `Data request escaped ${prefix}: ${url.href}`);
      const relative = url.pathname.slice(prefix.length);
      assert(["brief_mock.json", "media/catalog/provenance.json"].includes(relative), `Unexpected static network request ${relative}`);
      return new Response(fs.readFileSync(path.join(root, "dist", relative), "utf8"));
    };
    for (const script of document.querySelectorAll("script[src]")) {
      const relative = new URL(script.src).pathname.slice(prefix.length);
      Object.defineProperty(document, "currentScript", {configurable: true, value: script});
      browser.eval(fs.readFileSync(path.join(root, "dist", relative), "utf8"));
      delete document.currentScript;
    }
    await settleDom();
    assert.equal(document.getElementById("ask-tab").getAttribute("aria-selected"), "true");
    document.getElementById("projects-tab").click();
    const cards = [...document.querySelectorAll("#catalog-list .catalog-card")];
    assert.deepEqual(cards.map((card) => card.dataset.projectId).sort(), source.candidates.map((item) => item.id).sort());
    const catalog = await browser.ToolmeetCatalog.list();
    assert.equal(catalog.data_mode, "mock");
    for (const project of catalog.projects) {
      assert.equal(Object.hasOwn(project, "source_url"), false);
      assert.equal(project.cost.state, "unknown");
      assert.equal(project.cost.amount, null);
      assert(project.method.every((step) => step.origin === "mock"));
      const card = cards.find((item) => item.dataset.projectId === project.id);
      const image = card.querySelector(".catalog-image");
      assert.equal(image.dataset.projectId, project.id);
      assert.equal(card.querySelector(".catalog-media-label").textContent, "합성 설명 · 실제 실행 화면 아님");
      assert.equal(new URL(image.src).pathname, prefix + project.media[0].src);
      assert(project.media.every((item) => item.project_id === project.id));
    }
    assert(nativeRequests.some((request) => request === new URL("brief_mock.json", base).href));
    assert(nativeRequests.some((request) => request === new URL("media/catalog/provenance.json", base).href));
    document.getElementById("ask-tab").click();
    const work = document.getElementById("work");
    work.value = source.board_posts[0].work;
    work.dispatchEvent(new browser.Event("input", {bubbles: true}));
    for (const [id, value] of Object.entries({policy: "allowed", installation: "allowed", ecosystem: "google", "data-kind": "public", hosting: "self_hosted"})) document.getElementById(id).value = value;
    document.getElementById("brief-form").requestSubmit();
    await settleDom();
    assert.equal(document.getElementById("results").hidden, false);
    assert.equal(document.querySelector(".source-link"), null);
    const candidate = document.querySelector(".candidate:has(.confirm-button)");
    assert(candidate);
    candidate.querySelector(".preview-button").click();
    candidate.querySelector(".confirm-button").click();
    await settleDom();
    assert.match(document.querySelector(".source-link").href, /^https:\/\//);
    assert(nativeRequests.every((request) => !new URL(request).pathname.includes("/api/")), "Static recommendation requests must stay inside the mock API");
  } finally {
    dom.window.close();
  }
}
console.log("Static exploration: saved mock images, two tabs, confirmed links, and /toolmeet/ paths passed");
