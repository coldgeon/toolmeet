import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const frontend = process.env.TOOLMEET_FRONTEND_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {JSDOM} = createRequire(path.join(frontend, "package.json"))("jsdom");
const catalogScript = fs.readFileSync(path.join(frontend, "src", "catalog.js"), "utf8");
const source = JSON.parse(fs.readFileSync(path.join(frontend, "..", "shared", "data", "brief_mock.json"), "utf8"));
const plain = (value) => JSON.parse(JSON.stringify(value));

function mediaFixture(overrides = {}) {
  const {provenance, ...properties} = overrides;
  return {id: "fixture-image", project_id: "chatgpt", kind: "image", src: "media/catalog/fixture-image.svg",
    alt: "테스트 fixture · 실제 제품 화면 검증 아님", content_kind: "synthetic",
    text_sources: ["shared/data/brief_mock.json#chatgpt"],
    ...properties,
    provenance: {rights_status: "owned", rights_note: "테스트용 메타데이터 fixture · 실제 자산 확보 기록 아님",
      source_url: null, checked_at: null, ...provenance}};
}

function manifest(media = []) {
  return {contract_version: "exploration.v1", note: "test fixture only", media};
}

function harness(t, {media = [], manifestValue = manifest(media), manifestReply} = {}) {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>",
    {url: "https://toolmeet.test/toolmeet/", runScripts: "outside-only"});
  t.after(() => dom.window.close());
  const {window} = dom;
  const requests = [];
  window.fetch = async (input) => {
    const url = new URL(input, window.location.href);
    requests.push(url.href);
    assert.equal(url.origin, window.location.origin, "Catalog tests make no external requests");
    assert(url.pathname.startsWith("/toolmeet/"), "Data requests must preserve the static subpath");
    const relative = url.pathname.slice("/toolmeet/".length);
    if (relative === "brief_mock.json") return new Response(JSON.stringify(source));
    assert.equal(relative, "media/catalog/provenance.json", `Unexpected catalog request: ${url.href}`);
    if (manifestReply) return manifestReply();
    return new Response(JSON.stringify(manifestValue));
  };
  const element = window.document.createElement("script");
  element.src = new URL("catalog.js", window.location.href).href;
  window.document.head.append(element);
  Object.defineProperty(window.document, "currentScript", {configurable: true, value: element});
  window.eval(catalogScript);
  delete window.document.currentScript;
  return {window, api: window.ToolmeetCatalog, requests};
}

function assertFallbacks(catalog) {
  assert.deepEqual(plain(catalog.projects.map((project) => project.id)), source.candidates.map((item) => item.id));
  for (const project of catalog.projects) {
    assert.deepEqual(plain(project.media), [], project.id);
    assert.equal(project.fallback.kind, "text", project.id);
    assert.match(project.fallback.label, /합성|예시/, project.id);
    assert.match(project.fallback.label, /미검증/, project.id);
    for (const step of source.candidates.find((item) => item.id === project.id).method) {
      assert(project.fallback.text.includes(step), `Missing fallback method for ${project.id}`);
    }
  }
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert(Object.isFrozen(value));
  for (const nested of Object.values(value)) assertDeepFrozen(nested);
}

test("catalog accepts supported image formats with explicit rights and actual or synthetic provenance", async (t) => {
  const media = ["svg", "png", "jpg", "jpeg", "webp"].map((extension, index) => mediaFixture({
    id: `fixture-image-${extension}`, src: `media/catalog/examples/fixture-image.${extension}`,
    content_kind: index % 2 ? "actual" : "synthetic",
    provenance: index % 2 ? {rights_status: "licensed", rights_note: "fixture license information", source_url: "https://example.test/source", checked_at: "2026-10-13"} : {},
  }));
  const app = harness(t, {media});
  const catalog = await app.api.list();
  const project = catalog.projects.find((item) => item.id === "chatgpt");
  assert.deepEqual(plain(project.media), media);
  assert.equal((await app.api.get("chatgpt")).project, project);
  assert.equal(app.requests.length, 2, "Catalog reads metadata without fetching or claiming to execute media assets");
});

test("catalog accepts mp4 and webm video metadata without changing source or task evidence", async (t) => {
  const media = ["mp4", "webm"].map((extension, index) => mediaFixture({
    id: `fixture-video-${extension}`, kind: "video", src: `media/catalog/examples/fixture-video.${extension}`,
    content_kind: index ? "actual" : "synthetic", provenance: {rights_status: index ? "licensed" : "owned"},
  }));
  const app = harness(t, {media});
  const project = (await app.api.get("chatgpt")).project;
  assert.deepEqual(plain(project.media), media);
  assert.deepEqual(plain(project.method.map((step) => step.text)), source.candidates.find((item) => item.id === "chatgpt").method);
  assert.equal(project.evidence[0].level, "mock", "A video metadata fixture does not establish product execution evidence");
});

test("list and detail retain only media for the same project ID and preserve manifest ordering", async (t) => {
  const first = mediaFixture({id: "first-image"});
  const unrelated = mediaFixture({id: "other-project-image", project_id: "notebooklm"});
  const second = mediaFixture({id: "second-video", kind: "video", src: "media/catalog/second-video.mp4"});
  const orphan = mediaFixture({id: "missing-project-image", project_id: "missing-project"});
  const app = harness(t, {media: [first, unrelated, second, orphan]});
  const catalog = await app.api.list();
  const selected = await app.api.get("chatgpt");
  assert.deepEqual(plain(selected.project.media.map((item) => item.id)), [first.id, second.id]);
  assert.deepEqual(plain((await app.api.get("notebooklm")).project.media), [unrelated]);
  assert(catalog.projects.every((project) => project.media.every((item) => item.project_id === project.id)));
  assert.equal(selected.project, catalog.projects.find((project) => project.id === "chatgpt"));
});

test("unknown rights or incomplete provenance uses text fallbacks and retains project records", async (t) => {
  const invalid = [
    mediaFixture({id: "unknown-rights", provenance: {rights_status: "unknown"}}),
    mediaFixture({id: "missing-rights", provenance: {rights_status: undefined}}),
    mediaFixture({id: "empty-rights-note", provenance: {rights_note: " "}}),
    mediaFixture({id: "missing-kind", content_kind: undefined}),
    mediaFixture({id: "unrecognized-kind", content_kind: "official"}),
    mediaFixture({id: "missing-alt", alt: " "}),
  ];
  const app = harness(t, {media: invalid});
  assertFallbacks(await app.api.list());
});

test("kind and extension mismatches are omitted while an eligible neighbor remains usable", async (t) => {
  const valid = mediaFixture({id: "valid-neighbor"});
  const invalid = [
    {kind: "image", src: "media/catalog/image-as-mp4.mp4"},
    {kind: "image", src: "media/catalog/image-as-webm.webm"},
    {kind: "video", src: "media/catalog/video-as-svg.svg"},
    {kind: "video", src: "media/catalog/video-as-png.png"},
    {kind: "audio", src: "media/catalog/audio-kind.mp4"},
    {kind: "video", src: "media/catalog/unsupported-video.mov"},
    {kind: "image", src: "media/catalog/unsupported-image.gif"},
  ].map((entry, index) => mediaFixture({id: `invalid-format-${index}`, ...entry}));
  const app = harness(t, {media: [...invalid, valid]});
  const project = (await app.api.get("chatgpt")).project;
  assert.deepEqual(plain(project.media), [valid]);
});

test("absolute, parent, remote and backslash media paths cannot bypass local catalog assets", async (t) => {
  const paths = [
    "/media/catalog/absolute.png", "C:/media/catalog/absolute.png", "../outside.png",
    "media/catalog/../outside.png", "media/catalog/examples/../../outside.mp4",
    "https://example.test/external.png", "//example.test/external.webm", "media\\catalog\\backslash.png",
  ];
  const app = harness(t, {media: paths.map((src, index) => mediaFixture({id: `invalid-path-${index}`, kind: src.endsWith(".webm") || src.endsWith(".mp4") ? "video" : "image", src}))});
  assertFallbacks(await app.api.list());
  assert.equal(app.requests.length, 2);
});

test("missing media keeps every catalog ID with a meaningful unverified text fallback", async (t) => {
  const app = harness(t);
  const catalog = await app.api.list();
  assertFallbacks(catalog);
  for (const project of catalog.projects) assert.equal((await app.api.get(project.id)).project, project);
});

test("broken or incompatible manifests fall back without turning the source catalog into an error", async (t) => {
  const cases = [
    ["network failure", {manifestReply: () => {throw new TypeError("test network failure");}}],
    ["HTTP failure", {manifestReply: () => new Response("unavailable", {status: 503})}],
    ["invalid JSON", {manifestReply: () => new Response("{broken json") }],
    ["null manifest", {manifestValue: null}],
    ["unsupported version", {manifestValue: {contract_version: "exploration.v2", media: [mediaFixture()]}}],
    ["invalid media shape", {manifestValue: {contract_version: "exploration.v1", media: {invalid: true}}}],
  ];
  for (const [label, options] of cases) {
    const app = harness(t, options);
    const catalog = await app.api.list();
    assertFallbacks(catalog);
    assert.equal(catalog.data_mode, "mock", label);
    assert.equal(await app.api.list(), catalog, label);
    assert.equal((await app.api.get("chatgpt")).project, catalog.projects.find((project) => project.id === "chatgpt"), label);
    assert.equal(app.requests.length, 2, "Once the source succeeds, a missing manifest does not cause repeated catalog fetches");
  }
});

test("list and get share stable project references whose media, methods and conditions are deeply frozen", async (t) => {
  const app = harness(t, {media: [mediaFixture()]});
  const [catalog, sameCatalog, detail] = await Promise.all([app.api.list(), app.api.list(), app.api.get("chatgpt")]);
  const selected = catalog.projects.find((project) => project.id === "chatgpt");
  assert.equal(sameCatalog, catalog);
  assert.equal(detail.project, selected);
  assertDeepFrozen(catalog);
  assert.equal(Reflect.set(selected, "name", "changed"), false);
  assert.equal(Reflect.set(selected.media[0].provenance, "rights_status", "unknown"), false);
  assert.equal(Reflect.set(selected.requirements.ecosystems.value, 0, "other"), false);
  assert.equal(Reflect.set(selected.method[0], "text", "changed"), false);
  assert.equal(Reflect.set(selected.cost, "amount", 0), false);
  assert.equal((await app.api.get("chatgpt")).project.name, source.candidates.find((item) => item.id === "chatgpt").name);
  assert.equal((await app.api.get("chatgpt")).project.cost.amount, null);
  assert.equal(app.requests.length, 2);
});

test("catalog preserves mock methods and evidence and leaves unknown costs and hosting explicit", async (t) => {
  const app = harness(t, {media: [mediaFixture()]});
  const catalog = await app.api.list();
  const kinds = {"AI 서비스": "service", "공개 프로젝트": "public_project", "툴밋 방법": "internal_method"};
  assert.equal(catalog.contract_version, "exploration.v1");
  assert.equal(catalog.data_mode, "mock");
  assert(catalog.data_note.includes(source.note));
  for (const project of catalog.projects) {
    const original = source.candidates.find((item) => item.id === project.id);
    assert.equal(project.kind, kinds[original.kind]);
    assert.equal(project.name, original.name);
    assert.equal(project.summary, original.summary);
    assert.deepEqual(plain(project.tasks), original.topics);
    assert.deepEqual(plain(project.method.map((step) => step.text)), original.method);
    assert(project.method.every((step) => step.origin === "mock" && step.evidence_ids.length > 0));
    const evidenceIds = new Set(project.evidence.map((item) => item.id));
    assert(project.method.every((step) => step.evidence_ids.every((id) => evidenceIds.has(id))));
    assert(project.evidence.some((item) => item.level === "mock" && item.claim === original.source_status && item.reference.includes(project.id) && item.checked_at === null));
    assert.equal(project.requirements.external_ai.value, original.external_ai);
    assert.equal(project.requirements.installation.value, original.install);
    assert.deepEqual(plain(project.requirements.ecosystems.value), original.ecosystems);
    assert.equal(project.requirements.hosting.state, original.hosting ? "known" : "unknown");
    assert.equal(project.requirements.hosting.value, original.hosting ?? null);
    assert.deepEqual(plain(project.cost), {state: "unknown", amount: null, currency: null, period: null, evidence_ids: []});
    assert.equal(Object.hasOwn(project, "source_url"), false, "Catalog browsing cannot reveal the gated original link");
  }
});
