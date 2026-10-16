import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {JSDOM} from "jsdom";
import {installLegacyAdapter} from "./legacy-adapter.mjs";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(frontend, "src", "index.html"), "utf8");
const feed = JSON.parse(fs.readFileSync(path.join(frontend, "..", "shared", "data", "brief_mock.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(frontend, "src", "media", "catalog", "provenance.json"), "utf8"));
const question = feed.board_posts[0].work;
const environment = {policy: "allowed", installation: "allowed", ecosystem: "google", "data-kind": "public", hosting: "self_hosted"};

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function harness(t, {url = "https://toolmeet.test/", reducedMotion = false, catalogReplies = [{}]} = {}) {
  const dom = new JSDOM(html, {url, runScripts: "outside-only"});
  t.after(() => dom.window.close());
  const {window} = dom;
  const {document} = window;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const motionListeners = new Set();
  const mediaQuery = {
    matches: reducedMotion,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener(type, listener) {if (type === "change") motionListeners.add(listener);},
    removeEventListener(type, listener) {if (type === "change") motionListeners.delete(listener);},
    addListener(listener) {motionListeners.add(listener);},
    removeListener(listener) {motionListeners.delete(listener);},
  };
  window.matchMedia = () => mediaQuery;
  const requests = [];
  const dataRequests = [];
  let catalogLoads = 0;
  window.fetch = (input, options = {}) => {
    const requestUrl = new URL(input, window.location.href);
    const pathname = requestUrl.pathname;
    if (pathname.endsWith("/brief_mock.json")) {
      const plan = catalogReplies[Math.min(catalogLoads++, catalogReplies.length - 1)];
      dataRequests.push(requestUrl.href);
      return Promise.resolve(new Response(JSON.stringify(plan.feed ?? feed), {status: plan.status ?? 200}));
    }
    if (pathname.endsWith("/media/catalog/provenance.json")) {
      const plan = catalogReplies[Math.min(Math.max(catalogLoads - 1, 0), catalogReplies.length - 1)];
      dataRequests.push(requestUrl.href);
      return Promise.resolve(new Response(JSON.stringify(plan.manifest ?? manifest), {status: plan.manifestStatus ?? 200}));
    }
    if (pathname === "/api/board") return Promise.resolve(new Response(JSON.stringify({data_mode: "mock", posts: feed.board_posts})));
    assert(["/api/brief", "/api/brief/confirm"].includes(pathname), `Unexpected network request: ${requestUrl.href}`);
    let resolve;
    const pending = new Promise((accept) => {resolve = accept;});
    requests.push({
      pathname,
      body: JSON.parse(options.body),
      // Late replies deliberately arrive even after cancellation.
      async respond(body, status = 200) {
        resolve(new Response(JSON.stringify(body), {status}));
        await flush();
      },
    });
    return pending;
  };
  for (const name of ["catalog.js", "exploration.js", "brief.js"]) {
    const script = [...document.querySelectorAll("script[src]")].find((item) => new URL(item.src).pathname.endsWith("/" + name));
    assert(script, `HTML must load ${name}`);
    // Match document.currentScript during execution, using the actual HTML script element.
    Object.defineProperty(document, "currentScript", {configurable: true, value: script});
    if (name === "brief.js") installLegacyAdapter(window, frontend, feed);
    window.eval(fs.readFileSync(path.join(frontend, "src", name), "utf8"));
    delete document.currentScript;
  }
  await flush();
  return {
    window, document, requests, dataRequests,
    byId: (id) => document.getElementById(id),
    briefs: () => requests.filter((request) => request.pathname === "/api/brief"),
    confirms: () => requests.filter((request) => request.pathname === "/api/brief/confirm"),
    cards: () => [...document.querySelectorAll("#catalog-list .catalog-card")],
    links: () => [...document.querySelectorAll(".source-link")],
    changeMotion(matches) {
      mediaQuery.matches = matches;
      for (const listener of motionListeners) listener({matches, media: mediaQuery.media});
    },
    edit(value) {
      this.byId("work").value = value;
      this.byId("work").dispatchEvent(new window.Event("input", {bubbles: true}));
    },
    async startResult() {
      for (const [id, value] of Object.entries(environment)) this.byId(id).value = value;
      this.edit(question);
      this.byId("work").focus();
      this.byId("brief-form").requestSubmit();
      const request = this.briefs().at(-1);
      await this.answer(request);
      return request;
    },
    async answer(request, token = "current-result") {
      const candidate = feed.candidates.find((item) => item.id === "chatgpt");
      await request.respond({
        data_mode: "mock", data_note: "HTTP regression fixture",
        profile: request.body,
        topic_label: "회의·후속 작업", classification_note: "단어 규칙 mock",
        related_news: [], brief_token: token, data_updated_at: feed.updated_at, stage: token,
        candidates: [{id: candidate.id, name: candidate.name, kind: candidate.kind,
          summary: candidate.summary, method: candidate.method, source_status: candidate.source_status,
          first_check: candidate.first_check, first_gate: "공개·합성 자료로 검토하세요.",
          reasons: [candidate.why], status: "possible", fit_reason: "시연 조건 판정"}],
      });
    },
    beginConfirm() {
      const card = this.byId("candidate-chatgpt");
      assert(card);
      card.querySelector(".preview-button").click();
      card.querySelector(".confirm-button").click();
      return this.confirms().at(-1);
    },
  };
}

function assertTab(app, name) {
  const other = name === "ask" ? "projects" : "ask";
  assert.equal(app.document.body.dataset.tab, name);
  assert.equal(app.byId(name + "-tab").getAttribute("aria-selected"), "true");
  assert.equal(app.byId(name + "-tab").tabIndex, 0);
  assert.equal(app.byId(name + "-panel").hidden, false);
  assert.equal(app.byId(other + "-tab").getAttribute("aria-selected"), "false");
  assert.equal(app.byId(other + "-tab").tabIndex, -1);
  assert.equal(app.byId(other + "-panel").hidden, true);
  assert.equal(app.byId(other + "-panel").hasAttribute("hidden"), true, "Inactive panel must be excluded from normal interaction");
}

function assertNewQuestion(app) {
  assertTab(app, "ask");
  assert.equal(app.document.body.dataset.mode, "initial");
  assert.equal(app.byId("work").value, "");
  for (const id of Object.keys(environment)) assert.equal(app.byId(id).value, "");
  assert.equal(app.byId("results").hidden, true);
  assert.equal(app.byId("candidate-list").children.length, 0);
  assert.equal(app.links().length, 0);
  assert.equal(app.byId("submit").disabled, false);
  assert.equal(app.document.activeElement, app.byId("ask-tab"));
}

test("background resumes the paused track without replacing cards or changing input focus and conditions", async (t) => {
  const app = await harness(t);
  const track = app.byId("catalog-background").firstElementChild;
  const firstCard = track.querySelector(".background-card");
  app.edit(question);
  for (const [id, value] of Object.entries(environment)) app.byId(id).value = value;
  app.byId("work").focus();
  assert.equal(app.byId("motion-controls").hidden, false);
  assert.equal(app.document.body.dataset.motion, "paused");
  const backgroundDown = new app.window.MouseEvent("mousedown", {bubbles:true, cancelable:true});
  app.byId("catalog-background").dispatchEvent(backgroundDown);
  assert.equal(backgroundDown.defaultPrevented, true, "Background mouse input preserves the current focus");
  const inputDown = new app.window.MouseEvent("mousedown", {bubbles:true, cancelable:true});
  app.byId("work").dispatchEvent(inputDown);
  assert.equal(inputDown.defaultPrevented, false, "Normal input mouse actions must remain native");
  app.document.querySelector(".question-stage").click();
  assert.equal(app.document.body.dataset.motion, "running");
  assert.equal(app.document.activeElement, app.byId("work"));
  assert.equal(app.byId("work").value, question);
  for (const [id, value] of Object.entries(environment)) assert.equal(app.byId(id).value, value);
  assert.equal(app.byId("catalog-background").firstElementChild, track);
  assert.equal(track.querySelector(".background-card"), firstCard);
  assert.equal(app.briefs().length, 0);
  app.byId("work").dispatchEvent(new app.window.Event("pointerdown", {bubbles:true}));
  assert.equal(app.document.body.dataset.motion, "paused");
});

test("form, condition, motion controls and tab interactions never act as background resume", async (t) => {
  const app = await harness(t);
  app.byId("work").focus();
  for (const element of [app.byId("brief-form"), app.byId("work"), app.document.querySelector(".input-label"), app.document.querySelector("#environment-details summary"), app.byId("submit"), app.document.querySelector("#motion-controls p")]) {
    element.click();
    assert.equal(app.document.body.dataset.motion, "paused");
  }
  app.byId("projects-tab").click(); app.byId("ask-tab").click();
  assert.equal(app.document.body.dataset.motion, "paused");
  app.byId("catalog-background").click();
  assert.equal(app.document.body.dataset.motion, "running");
  app.byId("policy").focus();
  assert.equal(app.document.body.dataset.motion, "paused", "Keyboard condition focus pauses too");
});

test("background auto-resume respects manual pause and reduced motion; explicit play resumes interaction pause", async (t) => {
  const app = await harness(t);
  app.byId("motion-toggle").click();
  app.byId("work").focus();
  app.byId("catalog-background").click();
  assert.equal(app.document.body.dataset.motion, "paused");
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "true");
  app.changeMotion(true);
  app.byId("catalog-background").click();
  app.changeMotion(false);
  assert.equal(app.document.body.dataset.motion, "paused");
  app.byId("motion-toggle").click();
  assert.equal(app.document.body.dataset.motion, "running");
  app.byId("work").click();
  app.changeMotion(true);
  app.byId("catalog-background").click();
  assert.equal(app.document.body.dataset.motion, "paused");
  app.changeMotion(false);
  assert.equal(app.document.body.dataset.motion, "running");
  app.byId("work").click();
  app.byId("motion-toggle").click();
  assert.equal(app.document.body.dataset.motion, "running");
});

test("background click keeps a pending recommendation alive and preserves its eventual confirmed link", async (t) => {
  const app = await harness(t);
  for (const [id, value] of Object.entries(environment)) app.byId(id).value = value;
  app.edit(question); app.byId("brief-form").requestSubmit();
  const pending = app.briefs()[0], input = app.byId("work");
  app.byId("catalog-background").click();
  assert.equal(app.byId("submit").disabled, true);
  assert.equal(app.briefs().length, 1);
  await app.answer(pending);
  const confirmation = app.beginConfirm();
  app.byId("catalog-background").click();
  await confirmation.respond({source_url:"https://chatgpt.com/"});
  const link = app.links()[0]; assert(link);
  app.byId("catalog-background").click();
  assert.equal(app.links()[0], link);
  assert.equal(app.byId("work"), input);
  assert.equal(input.value, question);
  assert.equal(app.briefs().length, 1);
  assert.equal(app.confirms().length, 1);
});

test("new question stays initial after the delayed close event of expanded conditions", async (t) => {
  const app = await harness(t);
  app.edit(question);
  app.byId("environment-details").open = true;
  await flush();
  app.byId("new-question").click();
  await flush();
  assertNewQuestion(app);
  assert.equal(app.document.body.dataset.motion, "running");
  assert.equal(app.byId("question-examples").hidden, true);
});

test("two tabs expose linked panels and support roving keyboard selection", async (t) => {
  const app = await harness(t);
  for (const name of ["ask", "projects"]) {
    const tab = app.byId(name + "-tab");
    const panel = app.byId(name + "-panel");
    assert.equal(tab.getAttribute("role"), "tab");
    assert.equal(tab.getAttribute("aria-controls"), panel.id);
    assert.equal(panel.getAttribute("role"), "tabpanel");
    assert.equal(panel.getAttribute("aria-labelledby"), tab.id);
    assert.equal(panel.tabIndex, 0, "A visible panel must be a keyboard entry point");
  }
  assertTab(app, "ask");
  app.byId("ask-tab").focus();
  for (const [key, expected] of [["ArrowRight", "projects"], ["ArrowRight", "ask"], ["ArrowLeft", "projects"], ["Home", "ask"], ["End", "projects"]]) {
    app.document.activeElement.dispatchEvent(new app.window.KeyboardEvent("keydown", {key, bubbles: true, cancelable: true}));
    assertTab(app, expected);
    assert.equal(app.document.activeElement, app.byId(expected + "-tab"));
  }
});

test("focusing or clicking the question enters focus mode and blur keeps it", async (t) => {
  const app = await harness(t);
  assert.equal(app.document.body.dataset.mode, "initial");
  app.byId("work").focus();
  assert.equal(app.document.body.dataset.mode, "focused");
  assert.equal(app.document.body.dataset.motion, "paused");
  app.byId("policy").focus();
  assert.equal(app.document.body.dataset.mode, "focused");
  app.byId("new-question").click();
  assertNewQuestion(app);
  app.byId("work").click();
  assert.equal(app.document.body.dataset.mode, "focused");
});

test("tab round trip preserves drafts and all environment values without submitting", async (t) => {
  const app = await harness(t);
  app.edit(question);
  for (const [id, value] of Object.entries(environment)) app.byId(id).value = value;
  const textarea = app.byId("work");
  app.byId("projects-tab").click();
  assertTab(app, "projects");
  app.byId("ask-tab").click();
  assertTab(app, "ask");
  assert.equal(app.byId("work"), textarea);
  assert.equal(textarea.value, question);
  for (const [id, value] of Object.entries(environment)) assert.equal(app.byId(id).value, value);
  assert.equal(app.briefs().length, 0);
});

test("tab round trip preserves rendered results, preview and confirmed link DOM", async (t) => {
  const app = await harness(t);
  await app.startResult();
  assert.equal(app.byId("asked-question").tabIndex, -1);
  assert.equal(app.document.activeElement, app.byId("asked-question"), "Completed visible answer must receive focus");
  const confirmation = app.beginConfirm();
  await confirmation.respond({source_url: "https://chatgpt.com/"});
  const result = app.byId("candidate-chatgpt");
  const link = app.links()[0];
  assert(link);
  assert.equal(app.document.activeElement, link, "Replacing the confirmation button must move focus to its source link");
  app.byId("projects-tab").click();
  assertTab(app, "projects");
  app.byId("ask-tab").click();
  assertTab(app, "ask");
  assert.equal(app.byId("candidate-chatgpt"), result);
  assert.equal(app.links()[0], link);
  assert.equal(result.querySelector(".preview-panel").hidden, false);
  assert.equal(link.href, "https://chatgpt.com/");
  assert.equal(app.briefs().length, 1);
  assert.equal(app.confirms().length, 1);
});

test("tab changes leave a pending recommendation usable on return", async (t) => {
  const app = await harness(t);
  app.edit(question);
  app.byId("brief-form").requestSubmit();
  const pending = app.briefs()[0];
  app.byId("projects-tab").focus();
  app.byId("projects-tab").click();
  await app.answer(pending);
  assertTab(app, "projects");
  assert.equal(app.document.activeElement, app.byId("projects-tab"), "A hidden question answer must not steal project-tab focus");
  app.byId("ask-tab").click();
  assert.equal(app.byId("results").hidden, false);
  assert.equal(app.byId("asked-question").textContent, question);
  assert.equal(app.briefs().length, 1);
});

test("news work link enters focused question mode and new question removes its query", async (t) => {
  const app = await harness(t, {url: "https://toolmeet.test/?work=" + encodeURIComponent(question)});
  assertTab(app, "ask");
  assert.equal(app.document.body.dataset.mode, "focused");
  assert.equal(app.document.activeElement, app.byId("work"));
  assert.equal(app.byId("work").value, question);
  assert.equal(app.briefs().length, 1);
  app.byId("new-question").click();
  assertNewQuestion(app);
  assert.equal(new URL(app.window.location.href).searchParams.has("work"), false);
  await app.answer(app.briefs()[0], "old-news-result");
  assertNewQuestion(app);
});

test("new question resets a pending brief and ignores its late result", async (t) => {
  const app = await harness(t);
  for (const [id, value] of Object.entries(environment)) app.byId(id).value = value;
  app.edit(question);
  app.byId("brief-form").requestSubmit();
  const pending = app.briefs()[0];
  assert.equal(app.byId("submit").disabled, true);
  app.byId("new-question").click();
  assertNewQuestion(app);
  await app.answer(pending, "old-question-result");
  assertNewQuestion(app);
  assert.equal(app.byId("status").hidden, true);
  assert.equal(app.briefs().length, 1);
});

for (const outcome of ["success", "failure"]) {
  test(`new question resets pending confirmation and ignores late ${outcome}`, async (t) => {
    const app = await harness(t);
    await app.startResult();
    const confirmation = app.beginConfirm();
    app.byId("new-question").click();
    assertNewQuestion(app);
    if (outcome === "success") await confirmation.respond({source_url: "https://chatgpt.com/"});
    else await confirmation.respond({error: "old confirmation failed"}, 400);
    assertNewQuestion(app);
    assert.doesNotMatch(app.byId("results").textContent, /old confirmation failed/);
  });
}

test("manual motion pause survives tab changes and new question", async (t) => {
  const app = await harness(t);
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "false");
  app.byId("motion-toggle").click();
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "true");
  assert.equal(app.document.body.dataset.motion, "paused");
  app.byId("work").focus();
  app.byId("projects-tab").click();
  app.byId("new-question").click();
  assertNewQuestion(app);
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "true");
  assert.equal(app.document.body.dataset.motion, "paused");
  app.byId("motion-toggle").click();
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "false");
  assert.equal(app.document.body.dataset.motion, "running");
});

test("reduced motion stops background without altering manual pause preference", async (t) => {
  const app = await harness(t, {reducedMotion: true});
  assert.equal(app.document.body.dataset.motion, "paused");
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "false");
  assert.equal(app.byId("motion-toggle").disabled, true);
  app.changeMotion(false);
  assert.equal(app.byId("motion-toggle").disabled, false);
  assert.equal(app.document.body.dataset.motion, "running");
  app.byId("motion-toggle").click();
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "true");
  app.changeMotion(true);
  assert.equal(app.document.body.dataset.motion, "paused");
  assert.equal(app.byId("motion-toggle").disabled, true);
  app.changeMotion(false);
  assert.equal(app.document.body.dataset.motion, "paused");
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "true");
  app.byId("motion-toggle").click();
  assert.equal(app.document.body.dataset.motion, "running");
  assert.equal(app.byId("motion-toggle").getAttribute("aria-pressed"), "false");
});

test("catalog and background use the same mock IDs and correctly marked saved images", async (t) => {
  const app = await harness(t);
  const cards = app.cards();
  assert.deepEqual(cards.map((card) => card.dataset.projectId).sort(), feed.candidates.map((candidate) => candidate.id).sort());
  for (const card of cards) {
    const candidate = feed.candidates.find((item) => item.id === card.dataset.projectId);
    assert.match(card.textContent, new RegExp(candidate.name));
    const image = card.querySelector(".catalog-image");
    assert(image);
    assert.equal(image.dataset.projectId, candidate.id);
    assert(image.alt.trim());
    assert.match(image.src, new RegExp(`/media/catalog/${candidate.id}\\.svg$`));
    assert.match(card.textContent, /합성|시연|mock/);
    assert.equal(card.querySelector(".catalog-media-label").textContent, "합성 설명 · 실제 실행 화면 아님", "Each saved image must visibly identify its synthetic origin");
    assert.equal(card.querySelector('a[href^="http"]'), null, "Catalog must not bypass confirmed source-link guidance");
  }
  const background = app.byId("catalog-background");
  assert.equal(background.getAttribute("aria-hidden"), "true");
  for (const card of background.querySelectorAll(".background-card")) {
    assert(cards.some((item) => item.dataset.projectId === card.dataset.projectId));
    assert.equal(card.querySelector("img").alt, "");
  }
});

test("catalog load error offers retry while preserving the question flow", async (t) => {
  const app = await harness(t, {catalogReplies: [{status: 503}, {}]});
  assert.equal(app.cards().length, 0);
  assert.equal(app.byId("catalog-retry").hidden, false);
  assert(app.byId("catalog-status").textContent.trim());
  app.edit(question);
  app.byId("work").focus();
  app.byId("catalog-retry").click();
  await flush();
  assert.equal(app.cards().length, feed.candidates.length);
  assert.equal(app.byId("catalog-retry").hidden, true);
  assert.equal(app.byId("work").value, question);
  assert.equal(app.document.body.dataset.mode, "focused");
});

test("empty catalog shows a usable empty state without fabricated cards", async (t) => {
  const app = await harness(t, {catalogReplies: [{feed: {...feed, candidates: []}, manifest: {contract_version: "exploration.v1", media: []}}]});
  assert.equal(app.cards().length, 0);
  assert.equal(app.byId("catalog-background").querySelectorAll(".background-card").length, 0);
  assert(app.byId("catalog-status").textContent.trim());
  app.byId("projects-tab").click();
  assertTab(app, "projects");
  app.byId("ask-tab").click();
  app.byId("work").focus();
  assert.equal(app.document.body.dataset.mode, "focused");
});

test("malformed catalog kinds show data error without fabricating project cards", async (t) => {
  const invalid = structuredClone(feed);
  invalid.candidates[0].kind = "미등록 종류";
  const app = await harness(t, {catalogReplies: [{feed: invalid}]});
  assert.equal(app.cards().length, 0);
  assert.equal(app.byId("catalog-retry").hidden, false);
  assert(app.byId("catalog-status").textContent.trim());
  app.byId("work").focus();
  assert.equal(app.document.body.dataset.mode, "focused");
});

test("failed saved image switches to explanation and leaves the project card intact", async (t) => {
  const app = await harness(t);
  const card = app.cards().find((item) => item.dataset.projectId === "chatgpt");
  const image = card.querySelector(".catalog-image");
  const fallback = card.querySelector(".media-fallback");
  const imageLabel = card.querySelector(".catalog-visual > .catalog-media-label");
  assert(imageLabel);
  assert.equal(fallback.hidden, true);
  image.dispatchEvent(new app.window.Event("error"));
  assert.equal(fallback.hidden, false);
  assert(image.hidden || !image.isConnected);
  assert.equal(imageLabel.isConnected, false, "The failed image label must be removed while the explanation label remains");
  assert.match(fallback.textContent, /설명 대체 · 실행 화면 아님/);
  assert(fallback.textContent.trim());
  assert.equal(card.isConnected, true);
  assert.equal(app.cards().length, feed.candidates.length);
  app.byId("ask-tab").click();
  app.byId("work").focus();
  assert.equal(app.document.body.dataset.mode, "focused");
});


for (const mediaFailure of ["unavailable", "unknown-rights"]) {
  test(`catalog media ${mediaFailure} preserves projects with explanation fallbacks`, async (t) => {
    const plan = mediaFailure === "unavailable"
      ? {manifestStatus: 503}
      : {manifest: {...manifest, media: manifest.media.map((item) => ({...item, provenance: {...item.provenance, rights_status: "unknown"}}))}};
    const app = await harness(t, {catalogReplies: [plan]});
    assert.equal(app.cards().length, feed.candidates.length);
    for (const card of app.cards()) {
      assert.equal(card.querySelector(".catalog-image"), null);
      assert.equal(card.querySelector(".media-fallback").hidden, false);
      assert(card.querySelector(".media-fallback").textContent.trim());
      assert.match(card.querySelector(".media-fallback").textContent, /설명 대체 · 실행 화면 아님/);
    }
    app.byId("work").focus();
    assert.equal(app.document.body.dataset.mode, "focused");
  });
}
