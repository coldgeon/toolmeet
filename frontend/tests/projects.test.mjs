import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

const frontend = process.env.TOOLMEET_FRONTEND_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(frontend, "package.json"));
const {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(frontend, "src/index.html"), "utf8");
const feed = JSON.parse(fs.readFileSync(path.join(frontend, "../shared/data/brief_mock.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(frontend, "src/media/catalog/provenance.json"), "utf8"));
const work = "회의록에서 결정과 할 일을 뽑아 시트에 정리하고 싶어요";
const environment = {policy: "allowed", installation: "allowed", ecosystem: "google", "data-kind": "public", hosting: "self_hosted"};
const clone = (value) => JSON.parse(JSON.stringify(value));
async function flush() {await new Promise(setImmediate); await new Promise(setImmediate);}

// All production modules, including the conversation adapter and validators,
// run unchanged. HTTP and optional delayed catalog.get results are the only seams.
async function harness(t, {deferDetails = false, mediaManifest = manifest} = {}) {
  const dom = new JSDOM(html, {url: "https://toolmeet.test/", runScripts: "outside-only"});
  t.after(() => dom.window.close());
  const {window} = dom, {document} = window;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
  const requests = [], snapshots = [], getRequests = [], contexts = [], mediaCalls = [];
  window.HTMLMediaElement.prototype.pause = function () {mediaCalls.push({type: "pause", asset: this});};
  window.HTMLMediaElement.prototype.load = function () {mediaCalls.push({type: "load", asset: this});};
  window.HTMLMediaElement.prototype.play = function () {mediaCalls.push({type: "play", asset: this}); return Promise.resolve();};
  document.addEventListener("toolmeet:project-context", (event) => contexts.push(clone(event.detail)));
  window.fetch = (input, options = {}) => {
    const pathname = new URL(input, window.location.href).pathname;
    if (pathname.endsWith("/brief_mock.json")) return Promise.resolve(new Response(JSON.stringify(feed)));
    if (pathname.endsWith("/media/catalog/provenance.json")) return Promise.resolve(new Response(JSON.stringify(mediaManifest)));
    if (pathname === "/api/board") return Promise.resolve(new Response(JSON.stringify({data_mode: "mock", posts: feed.board_posts})));
    assert(["/api/brief", "/api/brief/confirm"].includes(pathname), "Unexpected network request: " + pathname);
    let resolve;
    const pending = new Promise((accept) => {resolve = accept;});
    requests.push({pathname, body: clone(JSON.parse(options.body)), signal: options.signal,
      async respond(body, status = 200) {resolve(new Response(JSON.stringify(body), {status})); await flush();}});
    return pending;
  };
  for (const name of ["catalog.js", "projects.js", "exploration.js", "conversation.js", "brief.js"]) {
    const script = [...document.querySelectorAll("script[src]")].find((item) => new URL(item.src).pathname.endsWith("/" + name));
    assert(script, "index.html must load " + name);
    Object.defineProperty(document, "currentScript", {configurable: true, value: script});
    if (name === "brief.js") {
      const realAdapter = window.ToolmeetConversation;
      window.ToolmeetConversation = {...realAdapter,
        evaluate(snapshot, options) {snapshots.push(clone(snapshot)); return realAdapter.evaluate(snapshot, options);}};
    }
    window.eval(fs.readFileSync(path.join(frontend, "src", name), "utf8"));
    delete document.currentScript;
    if (name === "catalog.js") {
      const realCatalog = window.ToolmeetCatalog;
      window.ToolmeetCatalog = {...realCatalog, get(id) {
        if (!deferDetails) {getRequests.push({id}); return realCatalog.get(id);}
        let resolve, reject;
        const pending = new Promise((accept, fail) => {resolve = accept; reject = fail;});
        getRequests.push({id,
          async respond(value) {resolve(value ?? await realCatalog.get(id)); await flush();},
          async fail(message = "임시 상세 조회 오류", code = "unavailable") {const error = new Error(message); error.code = code; reject(error); await flush();}});
        return pending;
      }};
    }
  }
  await flush();
  return {
    window, document, requests, snapshots, getRequests, contexts, mediaCalls,
    byId: (id) => document.getElementById(id),
    query: (selector) => document.querySelector(selector),
    all: (selector) => [...document.querySelectorAll(selector)],
    cards() {return this.all("#catalog-list .catalog-card");},
    card(id = "chatgpt") {return this.query('.catalog-card[data-project-id="' + id + '"]');},
    toggle(id = "chatgpt") {return this.card(id).querySelector(".project-preview-toggle");},
    preview(id = "chatgpt") {return this.byId("preview-" + id);},
    dialog() {return this.byId("project-detail");},
    briefs() {return requests.filter((r) => r.pathname === "/api/brief");},
    confirms() {return requests.filter((r) => r.pathname === "/api/brief/confirm");},
    links() {return this.all(".source-link");},
    async hover(id = "chatgpt", type = "mouseenter") {this.card(id).dispatchEvent(new window.MouseEvent(type)); await flush();},
    key(target, key, shiftKey = false) {const event = new window.KeyboardEvent("keydown", {key, shiftKey, bubbles: true, cancelable: true}); target.dispatchEvent(event); return event;},
    edit(value) {this.byId("work").value = value; this.byId("work").dispatchEvent(new window.Event("input", {bubbles: true}));},
    async submit() {this.byId("brief-form").requestSubmit(); await flush(); return this.briefs().at(-1);},
    async openDetail(id = "chatgpt") {this.byId("projects-tab").click(); const button = this.card(id).querySelector(".project-detail-open"); button.focus(); button.click(); await flush(); return button;},
    async select(id = "chatgpt") {await this.openDetail(id); if (deferDetails) await getRequests.at(-1).respond(); this.byId("project-detail-ask").click(); await flush();},
    async ready() {
      for (const [id, value] of Object.entries(environment)) this.byId(id).value = value;
      this.edit(work); const request = await this.submit(); assert(request);
      await this.answer(request); return request;
    },
    async answer(request, token = "current-token") {
      const c = feed.candidates.find((item) => item.id === "chatgpt");
      await request.respond({data_mode: "mock", data_note: "실제 도구를 실행하지 않는 HTTP mock fixture", profile: request.body,
        topic_label: "회의·후속 작업", classification_note: "단어 규칙 mock", related_news: [], brief_token: token, stage: "mock 후보 검토",
        candidates: [{id: c.id, status: "possible", reasons: [c.why], fit_reason: "현재 mock 조건의 예시입니다.", first_gate: "공개 자료 허용 확인", first_check: c.first_check}]});
    },
    async beginConfirm() {const card = this.byId("candidate-chatgpt"); assert(card); if (card.querySelector(".preview-panel").hidden) card.querySelector(".preview-button").click(); card.querySelector(".confirm-button").click(); await flush(); return this.confirms().at(-1);},
  };
}

test("background pause/resume preserves selected project, recommendation revision and confirmed link", async (t) => {
  const app = await harness(t);
  await app.ready(); await app.select("chatgpt");
  await app.answer(app.briefs().at(-1));
  const current = clone(app.snapshots.at(-1)), count = app.snapshots.length, contexts = app.contexts.length;
  const confirmation = await app.beginConfirm();
  const selection = clone(confirmation.body);
  app.byId("catalog-background").click();
  app.byId("motion-toggle").click(); app.byId("motion-toggle").click();
  await confirmation.respond({source_url:"https://chatgpt.com/"});
  const link = app.links()[0]; assert(link);
  app.byId("work").focus(); app.byId("catalog-background").click();
  assert.equal(app.links()[0], link);
  assert.equal(app.snapshots.length, count);
  assert.deepEqual(app.snapshots.at(-1), current);
  assert.deepEqual(confirmation.body, selection);
  assert.equal(app.contexts.length, contexts);
  assert.equal(app.window.ToolmeetExploration.state.projectId, "chatgpt");
  assert.equal(app.byId("selected-project-context").hidden, false);
  assert.equal(app.byId("work").value, current.work);
});

function assertPreview(app, id, open) {
  assert.equal(app.preview(id).hidden, !open);
  assert.equal(app.toggle(id).getAttribute("aria-expanded"), String(open));
}
function assertDialog(app, open) {assert.equal(app.dialog().hasAttribute("open"), open);}
function assertInvalidated(app) {
  assert.equal(app.byId("results").hidden, true);
  assert.equal(app.byId("candidate-list").children.length, 0);
  assert.equal(app.links().length, 0);
}
function assertNoGuidanceLinks(app) {
  for (const target of [app.byId("catalog-list"), app.dialog()]) assert.equal(target.querySelectorAll('a[href^="http"], a[href^="javascript:"], a[href^="data:"]').length, 0);
}
function assertCannotSelect(app) {const ask = app.byId("project-detail-ask"); assert(ask.hidden || ask.disabled, "Unavailable details cannot expose an enabled selection button");}
function assertContext(app, id) {
  const project = feed.candidates.find((candidate) => candidate.id === id);
  assert.equal(app.byId("selected-project-context").hidden, id === null);
  if (id !== null) assert.match(app.byId("selected-project-name").textContent, new RegExp(project.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(app.window.ToolmeetExploration.state.projectId, id);
  assert.equal(app.contexts.at(-1)?.project_id, id);
}
function focusables(app) {
  return [...app.dialog().querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter((el) => !el.disabled && el.tabIndex >= 0 && !el.closest("[hidden]"));
}

test("every catalog card exposes a unique named preview region and explicit detail button", async (t) => {
  const app = await harness(t), ids = new Set();
  assert.equal(app.cards().length, feed.candidates.length);
  for (const card of app.cards()) {
    const id = card.dataset.projectId, toggle = card.querySelector(".project-preview-toggle"), region = app.preview(id);
    assert(toggle); assert(region); assert(card.querySelector(".project-detail-open"));
    assert.equal(toggle.getAttribute("aria-controls"), region.id); assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(region.getAttribute("role"), "region"); assert.equal(region.hidden, true);
    assert.equal(ids.has(region.id), false); ids.add(region.id);
    assert(card.querySelector(".project-preview-close"));
    assert.match(card.textContent, /합성|mock|시연/);
  }
  assertNoGuidanceLinks(app);
});

test("hover opens the same stored method steps as the preview button without stealing focus", async (t) => {
  const app = await harness(t); app.byId("projects-tab").click(); app.byId("projects-tab").focus();
  await app.hover(); assertPreview(app, "chatgpt", true);
  assert.equal(app.document.activeElement, app.byId("projects-tab"));
  const hoverText = app.preview().textContent;
  for (const method of feed.candidates.find((c) => c.id === "chatgpt").method) assert(hoverText.includes(method));
  await app.hover("chatgpt", "mouseleave"); assertPreview(app, "chatgpt", false);
  app.toggle().click(); assertPreview(app, "chatgpt", true);
  assert.equal(app.preview().textContent, hoverText);
});

test("button-pinned preview remains open after mouseleave and close resets aria state", async (t) => {
  const app = await harness(t); app.byId("projects-tab").click();
  app.toggle().click();
  assert.equal(app.document.activeElement, app.preview().querySelector(".project-preview-close"), "Explicit open brings the preview into keyboard focus even when the card toggle was near the viewport edge");
  await app.hover("chatgpt", "mouseleave"); assertPreview(app, "chatgpt", true);
  app.preview().querySelector(".project-preview-close").click(); assertPreview(app, "chatgpt", false);
  assert.equal(app.document.activeElement, app.toggle());
  app.toggle().click(); app.toggle().click(); assertPreview(app, "chatgpt", false);
});

test("Escape closes an active preview and returns keyboard focus to its own toggle", async (t) => {
  const app = await harness(t); app.byId("projects-tab").click(); app.toggle().focus(); app.toggle().click();
  const close = app.preview().querySelector(".project-preview-close"); close.focus();
  app.key(close, "Escape"); assertPreview(app, "chatgpt", false);
  assert.equal(app.document.activeElement, app.toggle());
});

test("hover preview survives pointer exit while focus is inside the card", async (t) => {
  const app = await harness(t); app.byId("projects-tab").click(); await app.hover();
  app.card().querySelector(".project-detail-open").focus();
  await app.hover("chatgpt", "mouseleave"); assertPreview(app, "chatgpt", true);
  app.byId("projects-tab").focus();
  app.card().dispatchEvent(new app.window.FocusEvent("focusout", {bubbles: true, relatedTarget: app.byId("projects-tab")}));
  await flush(); assertPreview(app, "chatgpt", false);
});

test("opening another preview closes the first and tab changes remove hidden-panel preview interaction", async (t) => {
  const app = await harness(t); app.byId("projects-tab").click();
  const otherId = feed.candidates.find((c) => c.id !== "chatgpt").id;
  app.toggle().click(); app.toggle(otherId).click();
  assertPreview(app, "chatgpt", false); assertPreview(app, otherId, true);
  app.byId("ask-tab").click();
  assert.equal(app.byId("projects-panel").hidden, true);
  assertPreview(app, otherId, false);
});

test("detail fetches the same catalog ID and shows stored methods, conditions, evidence and mock labels", async (t) => {
  const app = await harness(t), opener = await app.openDetail();
  assertDialog(app, true); assert.equal(app.getRequests.at(-1).id, "chatgpt");
  assert.equal(app.dialog().getAttribute("aria-labelledby"), "project-detail-title");
  assert.match(app.byId("project-detail-title").textContent, /ChatGPT/);
  const content = app.byId("project-detail-content").textContent;
  const candidate = feed.candidates.find((c) => c.id === "chatgpt");
  assert(content.includes(candidate.summary));
  for (const step of candidate.method) assert(content.includes(step));
  assert(content.includes(candidate.source_status));
  assert.match(content, /정책|외부 AI/); assert.match(content, /비용|요금/); assert.match(content, /미확인|미검증/);
  assertNoGuidanceLinks(app);
  app.byId("project-detail-close").click(); assertDialog(app, false);
  assert.equal(app.document.activeElement, opener);
});

test("dialog traps Tab at both boundaries and Escape closes with focus return", async (t) => {
  const app = await harness(t), opener = await app.openDetail();
  const nodes = focusables(app); assert(nodes.length >= 2);
  nodes.at(-1).focus(); const forward = app.key(nodes.at(-1), "Tab");
  assert.equal(forward.defaultPrevented, true); assert.equal(app.document.activeElement, nodes[0]);
  nodes[0].focus(); const backward = app.key(nodes[0], "Tab", true);
  assert.equal(backward.defaultPrevented, true); assert.equal(app.document.activeElement, nodes.at(-1));
  app.key(app.document.activeElement, "Escape"); assertDialog(app, false);
  assert.equal(app.document.activeElement, opener);
});

test("opening and closing detail or switching tabs preserves recommendation revision and links", async (t) => {
  const app = await harness(t); await app.ready();
  await (await app.beginConfirm()).respond({source_url: "https://chatgpt.com/"});
  const snapshot = app.snapshots.at(-1), link = app.links()[0]; assert(link);
  await app.openDetail(); app.byId("project-detail-close").click();
  app.byId("ask-tab").click(); app.byId("projects-tab").click(); app.byId("ask-tab").click();
  assert.equal(app.links()[0], link);
  assert.equal(app.snapshots.length, 1, "Inspection must not initiate a recommendation or revision change");
  app.byId("reevaluate-conversation").click(); await flush();
  assert.equal(app.snapshots.at(-1).revision, snapshot.revision);
});

test("detail selection uses the same ID and preserves an unsubmitted work and environment draft", async (t) => {
  const app = await harness(t); app.edit(work);
  for (const [id, value] of Object.entries(environment)) app.byId(id).value = value;
  await app.select("chatgpt"); assertContext(app, "chatgpt");
  assertDialog(app, false); assert.equal(app.byId("ask-panel").hidden, false);
  assert.equal(app.byId("work").value, work);
  for (const [id, value] of Object.entries(environment)) assert.equal(app.byId(id).value, value);
  assert.equal(app.snapshots.length, 0, "Selecting a project does not submit a previously unsubmitted work");
  await app.submit(); assert.equal(app.snapshots.at(-1).project_id, "chatgpt");
  assert.equal(app.snapshots.at(-1).answers.length, Object.keys(environment).length);
});

test("switching selected project preserves explicit answers while instantly invalidating tokens and source links", async (t) => {
  const app = await harness(t); await app.ready();
  await (await app.beginConfirm()).respond({source_url: "https://chatgpt.com/"});
  const first = app.snapshots.at(-1), otherId = feed.candidates.find((c) => c.id !== "chatgpt" && c.kind !== "툴밋 방법").id;
  await app.select(otherId); assertContext(app, otherId); assertInvalidated(app);
  const second = app.snapshots.at(-1);
  assert(second.revision > first.revision); assert.equal(second.project_id, otherId);
  assert.equal(second.work, first.work); assert.deepEqual(second.answers, first.answers);
  assert.equal(app.confirms().length, 1);
});

test("clearing project context resets both owners and reevaluates preserved work at a higher revision", async (t) => {
  const app = await harness(t); await app.ready(); await app.select("chatgpt");
  await app.answer(app.briefs().at(-1), "selected-token");
  const selected = app.snapshots.at(-1); app.byId("clear-project-context").click(); await flush();
  assertContext(app, null); assertInvalidated(app);
  const current = app.snapshots.at(-1); assert.equal(current.project_id, null);
  assert(current.revision > selected.revision); assert.equal(current.work, selected.work); assert.deepEqual(current.answers, selected.answers);
});

test("new question clears project context, preview, dialog and pending work without applying late detail", async (t) => {
  const app = await harness(t, {deferDetails: true}); app.edit(work); await app.select("chatgpt");
  await app.openDetail("notebooklm"); const pending = app.getRequests.at(-1); assertDialog(app, true);
  app.byId("new-question").click(); await flush();
  assertDialog(app, false); assert.equal(app.byId("selected-project-context").hidden, true);
  assert.equal(app.window.ToolmeetExploration.state.projectId, null); assert.equal(app.byId("work").value, "");
  for (const id of Object.keys(environment)) assert.equal(app.byId(id).value, "");
  await pending.respond(); assertDialog(app, false); assert.equal(app.byId("selected-project-context").hidden, true);
  assert.equal(app.document.activeElement, app.byId("ask-tab"));
});

test("closing detail ignores its late success and failure without reopening or moving focus", async (t) => {
  for (const outcome of ["success", "error"]) await t.test(outcome, async (sub) => {
    const app = await harness(sub, {deferDetails: true}), opener = await app.openDetail();
    const pending = app.getRequests.at(-1); app.byId("project-detail-close").click();
    if (outcome === "success") await pending.respond(); else await pending.fail("OLD_DETAIL_ERROR");
    assertDialog(app, false); assert.equal(app.document.activeElement, opener);
    assert.doesNotMatch(app.byId("project-detail-content").textContent, /OLD_DETAIL_ERROR/);
    assert.equal(app.contexts.length, 0);
  });
  await t.test("queued native close event cannot close a reopened dialog", async (sub) => {
    const app = await harness(sub); await app.openDetail("chatgpt");
    app.dialog().close = function () {this.removeAttribute("open"); setImmediate(() => this.dispatchEvent(new app.window.Event("close")));};
    app.byId("project-detail-close").click();
    app.card("notebooklm").querySelector(".project-detail-open").click();
    await flush();
    assertDialog(app, true); assert.match(app.byId("project-detail-title").textContent, /NotebookLM/);
    assert.equal(app.byId("project-detail-ask").hidden, false);
    app.byId("project-detail-ask").click(); await flush(); assertContext(app, "notebooklm");
  });
});

test("out-of-order detail results preserve the latest catalog ID and selection", async (t) => {
  const app = await harness(t, {deferDetails: true});
  await app.openDetail("chatgpt"); const old = app.getRequests.at(-1);
  app.byId("project-detail-close").click();
  await app.openDetail("notebooklm"); const current = app.getRequests.at(-1);
  await current.respond(); assert.match(app.byId("project-detail-title").textContent, /NotebookLM/);
  const content = app.byId("project-detail-content").textContent;
  await old.respond(); assert.equal(app.byId("project-detail-content").textContent, content);
  assert.match(app.byId("project-detail-title").textContent, /NotebookLM/);
  app.byId("project-detail-ask").click(); await flush(); assertContext(app, "notebooklm");
});

test("detail error offers same-ID retry and keeps existing work and conditions usable", async (t) => {
  const app = await harness(t, {deferDetails: true}); app.edit(work); app.byId("policy").value = "unknown";
  await app.openDetail(); await app.getRequests.at(-1).fail();
  assertDialog(app, true); assert.equal(app.byId("project-detail-retry").hidden, false);
  assertCannotSelect(app);
  assert(app.byId("project-detail-content").textContent.trim());
  app.byId("project-detail-retry").click(); await flush(); assert.equal(app.getRequests.at(-1).id, "chatgpt");
  await app.getRequests.at(-1).respond();
  assert.equal(app.byId("project-detail-retry").hidden, true); assert.equal(app.byId("project-detail-ask").disabled, false);
  assert.equal(app.byId("work").value, work); assert.equal(app.byId("policy").value, "unknown");
});

test("malformed or mismatched detail payload cannot enable selection or invent links", async (t) => {
  for (const shape of ["missing", "mismatched", "partial", "unknown-kind", "invalid-boolean", "method-origin", "evidence-id", "evidence-reference"]) await t.test(shape, async (sub) => {
    const app = await harness(sub, {deferDetails: true}); await app.openDetail("chatgpt");
    const catalog = await app.window.ToolmeetCatalog.list();
    const body = shape === "missing" ? {contract_version: "exploration.v1", project: null} :
      shape === "partial" ? {...catalog, project: {id: "chatgpt", name: "ChatGPT"}} :
      {...catalog, project: clone(catalog.projects.find((p) => p.id === (shape === "mismatched" ? "notebooklm" : "chatgpt")))};
    if (shape === "unknown-kind") body.project.kind = "unregistered-kind";
    if (shape === "invalid-boolean") body.project.requirements.external_ai.value = "true";
    if (shape === "method-origin") body.project.method[0].origin = "automatically-approved";
    if (shape === "evidence-id") body.project.method[0].evidence_ids = ["absent-evidence"];
    if (shape === "evidence-reference") body.project.evidence[0].reference = "";
    await app.getRequests.at(-1).respond(body);
    assertCannotSelect(app); assertNoGuidanceLinks(app);
    assert.equal(app.contexts.length, 0);
  });
});

test("failed detail image falls back to explanation with explicit synthetic origin", async (t) => {
  const app = await harness(t); await app.openDetail();
  const image = app.byId("project-detail-content").querySelector("img"); assert(image, "The saved licensed image must be displayed before its error");
  image.dispatchEvent(new app.window.Event("error"));
  assert(!image.isConnected || image.hidden);
  assert.match(app.byId("project-detail-content").textContent, /설명 대체|합성 활용/);
  assert.equal(app.byId("project-detail-ask").disabled, false); assertNoGuidanceLinks(app);
  const withoutMedia = await harness(t, {mediaManifest: {contract_version: "exploration.v1", media: []}});
  await withoutMedia.openDetail(); assert.equal(withoutMedia.byId("project-detail-content").querySelector("img"), null);
  assert(withoutMedia.byId("project-detail-content").textContent.includes(feed.candidates.find((c) => c.id === "chatgpt").method[0]));
  assert.equal(withoutMedia.byId("project-detail-ask").disabled, false);
  for (const badMedia of ["unsafe-path", "unknown-rights"]) await t.test(badMedia + " uses explanation while selection stays available", async (sub) => {
    const mediaApp = await harness(sub, {deferDetails: true}); await mediaApp.openDetail();
    const catalog = await mediaApp.window.ToolmeetCatalog.list(), project = clone(catalog.projects.find((p) => p.id === "chatgpt"));
    assert(project.media.length);
    if (badMedia === "unsafe-path") project.media[0].src = "https://external.example/media.svg";
    else project.media[0].provenance.rights_status = "unknown";
    await mediaApp.getRequests.at(-1).respond({...catalog, project});
    assertDialog(mediaApp, true);
    assert.equal(mediaApp.byId("project-detail-content").querySelector("img, video"), null);
    assert.equal(mediaApp.byId("project-detail-content").querySelector(".project-media-fallback").hidden, false);
    assert.equal(mediaApp.byId("project-detail-ask").hidden, false); assert.equal(mediaApp.byId("project-detail-ask").disabled, false);
    mediaApp.byId("project-detail-ask").click(); await flush(); assertContext(mediaApp, "chatgpt");
  });
  for (const exit of ["close", "native-close", "error", "tab", "new-question"]) await t.test("video stops on " + exit, async (sub) => {
    const media = {...clone(manifest.media[0]), id: "chatgpt-video", kind: "video", src: "media/catalog/chatgpt.mp4", alt: "합성 영상 예시"};
    const videoApp = await harness(sub, {mediaManifest: {contract_version: "exploration.v1", media: [media]}});
    videoApp.edit(work); await videoApp.openDetail();
    const asset = videoApp.dialog().querySelector("video"); assert(asset);
    assert.equal(asset.controls, true); assert.equal(asset.preload, "none"); assert.equal(asset.autoplay, false);
    assert.equal(videoApp.mediaCalls.some((call) => call.type === "play"), false, "Opening detail must not autoplay a video");
    if (exit === "close") videoApp.byId("project-detail-close").click();
    else if (exit === "native-close") {videoApp.dialog().removeAttribute("open"); videoApp.dialog().dispatchEvent(new videoApp.window.Event("close"));}
    else if (exit === "error") asset.dispatchEvent(new videoApp.window.Event("error"));
    else if (exit === "tab") videoApp.byId("ask-tab").click();
    else videoApp.byId("new-question").click();
    assert(videoApp.mediaCalls.some((call) => call.type === "pause" && call.asset === asset));
    assert.equal(asset.hasAttribute("src"), false);
    if (exit === "error") {assert.equal(asset.isConnected, false); assert.equal(videoApp.byId("project-detail-ask").disabled, false);}
    else assertDialog(videoApp, false);
  });
});

test("project selection during pending confirmation ignores old success and error responses", async (t) => {
  for (const outcome of ["success", "error"]) await t.test(outcome, async (sub) => {
    const app = await harness(sub); await app.ready(); const old = await app.beginConfirm();
    await app.select("notebooklm"); assertInvalidated(app); const selected = app.snapshots.at(-1);
    if (outcome === "success") await old.respond({source_url: "https://old.example/"});
    else await old.respond({error: "OLD_PROJECT_CONFIRM_ERROR"}, 400);
    assertInvalidated(app); assert.equal(app.byId("submit").disabled, true, "Current evaluation is still pending");
    assert.doesNotMatch(app.document.body.textContent, /OLD_PROJECT_CONFIRM_ERROR|old\.example/);
    await app.answer(app.briefs().at(-1), "selected-token");
    assert.equal(app.snapshots.at(-1).project_id, selected.project_id); assert.equal(app.links().length, 0);
    assert.equal(app.byId("submit").disabled, false);
  });
});

test("detail inspection never provides a source link before explicit recommendation confirmation", async (t) => {
  const app = await harness(t); await app.openDetail(); assertNoGuidanceLinks(app);
  assert.equal(app.links().length, 0); app.byId("project-detail-close").click();
  await app.ready(); assert.equal(app.links().length, 0);
  app.byId("candidate-chatgpt").querySelector(".preview-button").click(); assert.equal(app.links().length, 0);
  const confirmation = await app.beginConfirm();
  assert.equal(app.links().length, 0); await confirmation.respond({source_url: "https://chatgpt.com/"});
  assert.equal(app.links()[0].href, "https://chatgpt.com/");
  await app.openDetail(); assertNoGuidanceLinks(app);
});

test("page navigation shortcuts on tabs do not switch the project panel", async (t) => {
  const app = await harness(t);
  app.byId("projects-tab").click();
  for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
    app.byId("projects-tab").dispatchEvent(new app.window.KeyboardEvent("keydown", {key: "Home", [modifier]: true, bubbles: true}));
    assert.equal(app.byId("projects-tab").getAttribute("aria-selected"), "true");
  }
});
