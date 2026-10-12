import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {JSDOM} from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
const briefScript = fs.readFileSync(path.join(root, "src", "brief.js"), "utf8");
const source = JSON.parse(fs.readFileSync(path.join(root, "..", "shared", "data", "brief_mock.json"), "utf8"));
const work = source.board_posts.find((post) => post.topic === "meeting").work;
const allowed = {policy: "allowed", installation: "allowed", ecosystem: "google", "data-kind": "public", hosting: "self_hosted"};
const changedFields = [
  {id: "policy", field: "policy", value: "denied", candidate: "chatgpt", status: "excluded"},
  {id: "installation", field: "installation", value: "denied", candidate: "n8n-meeting", status: "excluded"},
  {id: "ecosystem", field: "ecosystem", value: "microsoft", candidate: "n8n-meeting", status: "adapt"},
  {id: "data-kind", field: "data_kind", value: "internal", candidate: "chatgpt", status: "hold"},
  {id: "hosting", field: "hosting", value: "cloud", candidate: "n8n-meeting", status: "excluded"},
];

async function flush() {
  // Fetch and Response.json settle across promise turns; no wall-clock sleeps.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function harness(t, url = "https://toolmeet.test/") {
  const dom = new JSDOM(html, {url, runScripts: "outside-only"});
  t.after(() => dom.window.close());
  const {window} = dom;
  const {document} = window;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const requests = [];
  window.fetch = (input, options = {}) => {
    const pathname = new URL(input, window.location.href).pathname;
    if (pathname === "/api/board") {
      return Promise.resolve(new Response(JSON.stringify({data_mode: "mock", posts: source.board_posts})));
    }
    assert(["/api/brief", "/api/brief/confirm"].includes(pathname), `Unexpected fetch: ${pathname}`);
    let resolve;
    let reject;
    const pending = new Promise((accept, fail) => {resolve = accept; reject = fail;});
    requests.push({
      pathname,
      body: JSON.parse(options.body),
      // Deliberately ignore AbortSignal: late server responses must remain harmless.
      async respond(body, status = 200) {
        resolve(new Response(JSON.stringify(body), {status}));
        await flush();
      },
      async reject(message) {
        reject(new TypeError(message));
        await flush();
      },
    });
    return pending;
  };
  window.eval(briefScript);
  await flush();

  return {
    document,
    requests,
    briefs: () => requests.filter((request) => request.pathname === "/api/brief"),
    confirms: () => requests.filter((request) => request.pathname === "/api/brief/confirm"),
    setAllowed() {
      for (const [id, value] of Object.entries(allowed)) document.getElementById(id).value = value;
    },
    change(id, value) {
      const field = document.getElementById(id);
      field.value = value;
      assert.equal(field.value, value, `Missing select option ${id}=${value}`);
      field.dispatchEvent(new window.Event("change", {bubbles: true}));
    },
    edit(value) {
      document.getElementById("work").value = value;
      document.getElementById("work").dispatchEvent(new window.Event("input", {bubbles: true}));
    },
    submit() {
      document.getElementById("brief-form").requestSubmit();
      return this.briefs().at(-1);
    },
    results: () => document.getElementById("results"),
    links: () => [...document.querySelectorAll(".source-link")],
    status: () => document.getElementById("status"),
    async answer(request, {token = "current-token", candidate = "chatgpt", status = "possible"} = {}) {
      const catalogItem = source.candidates.find((item) => item.id === candidate);
      assert(catalogItem, `Missing catalog fixture ${candidate}`);
      // Responses model the API contract; test-selected statuses do not recalculate policy rules.
      await request.respond({
        profile: request.body,
        topic_label: "회의·후속 작업",
        classification_note: "저장된 단어 규칙으로 임시 분류 · AI 문장 이해 아님",
        related_news: [],
        brief_token: token,
        data_updated_at: source.updated_at,
        stage: token,
        candidates: [{
          id: catalogItem.id, name: catalogItem.name, kind: catalogItem.kind,
          summary: catalogItem.summary, method: catalogItem.method,
          source_status: catalogItem.source_status, first_check: catalogItem.first_check,
          reasons: [catalogItem.why], status,
          fit_reason: `mock 환경 판정: ${status}`, first_gate: "공개·합성 자료로 사람이 확인하세요.",
        }],
      });
      return token;
    },
    beginConfirm(candidate = "chatgpt") {
      const card = document.getElementById(`candidate-${candidate}`);
      assert(card, `No rendered candidate ${candidate}`);
      card.querySelector(".preview-button").click();
      assert.equal(card.querySelector(".preview-panel").hidden, false);
      const button = card.querySelector(".confirm-button");
      assert(button, `No confirmation offered for ${candidate}`);
      button.click();
      assert.equal(button.disabled, true);
      return this.confirms().at(-1);
    },
  };
}

function assertInvalidated(app) {
  assert.equal(app.results().hidden, true, "Previous recommendations must be hidden immediately");
  assert.equal(app.document.querySelectorAll(".candidate").length, 0, "Previous candidate controls must be removed");
  assert.equal(app.links().length, 0, "Previous source links must be removed");
}

function assertAnswer(app, token, status = "possible", candidate = "chatgpt") {
  assert.equal(app.results().hidden, false);
  assert.match(app.status().textContent, new RegExp(token));
  assert.equal(app.document.getElementById("asked-question").textContent, app.document.getElementById("work").value);
  assert(app.document.querySelector(`#candidate-${candidate} .fit-pill.${status}`), `Expected ${status} result for ${candidate}`);
}

async function startAllowed(app) {
  app.setAllowed();
  app.edit(work);
  const request = app.submit();
  await app.answer(request);
  assertAnswer(app, "current-token");
  return request;
}

async function showOriginalLink(app) {
  await startAllowed(app);
  const confirm = app.beginConfirm();
  assert.equal(confirm.body.brief_token, "current-token");
  await confirm.respond({source_url: "https://chatgpt.com/"});
  assert.equal(app.links()[0]?.href, "https://chatgpt.com/");
}

test("all five environment fields before first submission issue no brief request", async (t) => {
  const app = await harness(t);
  app.edit(work);
  for (const [id, value] of Object.entries(allowed)) app.change(id, value);
  assert.equal(app.briefs().length, 0);
  assert.equal(app.results().hidden, true);
  assert.equal(app.document.getElementById("submit").disabled, false);
});

for (const field of changedFields) {
  test(`pending ${field.id} change requests and displays only the latest environment`, async (t) => {
    const app = await harness(t);
    app.setAllowed();
    app.edit(work);
    const original = app.submit();
    app.change(field.id, field.value);
    assert.equal(app.briefs().length, 2, "An environment change during loading must request new recommendations");
    const latest = app.briefs()[1];
    assert.equal(original.body[field.field], allowed[field.id]);
    assert.equal(latest.body[field.field], field.value);
    assertInvalidated(app);
    await app.answer(latest, {token: "latest-environment", candidate: field.candidate, status: field.status});
    await app.answer(original, {token: "stale-environment"});
    assertAnswer(app, "latest-environment", field.status, field.candidate);
    assert.equal(app.links().length, 0);
    if (["excluded", "hold"].includes(field.status)) assert.equal(app.document.querySelector(".confirm-button"), null);
    assert.equal(app.document.getElementById("submit").disabled, false);
  });
}

test("policy allowed to unknown while loading keeps confirmation on hold", async (t) => {
  const app = await harness(t);
  app.setAllowed();
  app.edit(work);
  const original = app.submit();
  app.change("policy", "unknown");
  assert.equal(app.briefs().length, 2);
  const latest = app.briefs()[1];
  assert.equal(latest.body.policy, "unknown");
  await app.answer(original, {token: "stale-allowed"});
  assertInvalidated(app);
  assert.equal(app.document.getElementById("submit").disabled, true);
  await app.answer(latest, {token: "latest-unknown", status: "hold"});
  assertAnswer(app, "latest-unknown", "hold");
  assert.equal(app.document.querySelector(".confirm-button"), null);
});

test("multiple environment changes tolerate success and failure in reverse order", async (t) => {
  const app = await harness(t);
  app.setAllowed();
  app.edit(work);
  const first = app.submit();
  app.change("policy", "denied");
  app.change("installation", "denied");
  app.change("policy", "allowed");
  assert.equal(app.briefs().length, 4);
  const latest = app.briefs()[3];
  assert.equal(latest.body.policy, "allowed");
  assert.equal(latest.body.installation, "denied");
  await app.answer(latest, {token: "last-change"});
  await app.briefs()[2].respond({error: "stale server error"}, 500);
  await app.answer(app.briefs()[1], {token: "stale-denied", status: "excluded"});
  await first.reject("stale network error");
  assertAnswer(app, "last-change");
  assert.doesNotMatch(app.status().textContent, /stale/);
  const confirm = app.beginConfirm();
  assert.equal(confirm.body.brief_token, "last-change", "Confirmation must use the displayed result token");
});

test("editing a pending question ignores the prior response and waits for resubmission", async (t) => {
  const app = await harness(t);
  app.setAllowed();
  app.edit(work);
  const original = app.submit();
  const edited = "회의 결정 사항과 담당자별 마감일을 표로 정리하고 싶어요";
  app.edit(edited);
  app.change("policy", "denied");
  assert.equal(app.briefs().length, 1, "Editing resets submission; changing environment must not submit the edited question");
  await app.answer(original, {token: "old-question"});
  assertInvalidated(app);
  assert.equal(app.status().hidden, true);
  assert.equal(app.document.getElementById("submit").disabled, false);
  const latest = app.submit();
  assert.equal(latest.body.work, edited);
  assert.equal(latest.body.policy, "denied");
  await app.answer(latest, {token: "edited-question", status: "excluded"});
  assertAnswer(app, "edited-question", "excluded");
});

for (const field of changedFields) {
  test(`displayed source link disappears immediately on ${field.id} change`, async (t) => {
    const app = await harness(t);
    await showOriginalLink(app);
    app.change(field.id, field.value);
    assertInvalidated(app);
    assert.equal(app.briefs().length, 2);
  });
}

test("displayed source link disappears immediately when the question is edited", async (t) => {
  const app = await harness(t);
  await showOriginalLink(app);
  app.edit("다른 회의에서 다음에 확인할 사항을 정리하고 싶어요");
  assertInvalidated(app);
  assert.equal(app.briefs().length, 1);
});

for (const outcome of ["success", "failure"]) {
  test(`pending confirmation ${outcome} cannot affect a changed environment`, async (t) => {
    const app = await harness(t);
    await startAllowed(app);
    const confirmation = app.beginConfirm();
    app.change("policy", "denied");
    assertInvalidated(app);
    const latest = app.briefs()[1];
    await app.answer(latest, {token: "new-denied", status: "excluded"});
    if (outcome === "success") await confirmation.respond({source_url: "https://chatgpt.com/"});
    else await confirmation.respond({error: "old confirmation failed"}, 400);
    assertAnswer(app, "new-denied", "excluded");
    assert.equal(app.links().length, 0);
    assert.equal(app.document.querySelector(".confirm-button"), null);
    assert.doesNotMatch(app.results().textContent, /old confirmation failed/);
  });
}

test("pending confirmation cannot affect an edited and resubmitted question", async (t) => {
  const app = await harness(t);
  await startAllowed(app);
  const originalConfirm = app.beginConfirm();
  app.edit("회의 결정과 담당자를 다시 확인해 정리하고 싶어요");
  assertInvalidated(app);
  const latest = app.submit();
  await app.answer(latest, {token: "new-question"});
  await originalConfirm.respond({source_url: "https://old-result.test/"});
  assert.equal(app.links().length, 0);
  const latestConfirm = app.beginConfirm();
  assert.equal(latestConfirm.body.brief_token, "new-question");
  await latestConfirm.respond({source_url: "https://chatgpt.com/"});
  assert.equal(app.links()[0]?.href, "https://chatgpt.com/");
});

for (const outcome of ["http", "network"]) {
  test(`latest ${outcome} error never restores the previous source link`, async (t) => {
    const app = await harness(t);
    await showOriginalLink(app);
    app.change("policy", "denied");
    const latest = app.briefs()[1];
    if (outcome === "http") await latest.respond({error: "latest request failed"}, 500);
    else await latest.reject("latest request failed");
    assertInvalidated(app);
    assert.equal(app.status().hidden, false);
    assert.match(app.status().textContent, /latest request failed/);
    assert.equal(app.document.getElementById("submit").disabled, false);
  });
}

test("latest failure followed by an older success does not resurrect recommendations", async (t) => {
  const app = await harness(t);
  app.setAllowed();
  app.edit(work);
  const original = app.submit();
  app.change("policy", "denied");
  assert.equal(app.briefs().length, 2);
  await app.briefs()[1].respond({error: "latest request failed"}, 500);
  await app.answer(original, {token: "old-allowed"});
  assertInvalidated(app);
  assert.match(app.status().textContent, /latest request failed/);
  assert.equal(app.document.getElementById("submit").disabled, false);
});

test("latest allowed result preserves preview, mock notice and confirmed source-link flow", async (t) => {
  const app = await harness(t);
  await startAllowed(app);
  assert.equal(app.links().length, 0);
  assert.match(app.status().textContent, /mock/);
  assert.match(app.results().textContent, /추천\/판정은 mock/);
  const confirmation = app.beginConfirm();
  assert.deepEqual(confirmation.body, {brief_token: "current-token", candidate_id: "chatgpt", confirmed: true});
  await confirmation.respond({source_url: "https://chatgpt.com/"});
  const link = app.links()[0];
  assert.equal(link.href, "https://chatgpt.com/");
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
  assert.equal(app.document.querySelector(".confirm-button"), null);
  assert.match(app.results().textContent, /첫 시험 완료가 아닙니다/);
});

test("news work URL still submits the linked question and uses changed environment", async (t) => {
  const app = await harness(t, `https://toolmeet.test/?work=${encodeURIComponent(work)}`);
  assert.equal(app.document.getElementById("work").value, work);
  assert.equal(app.briefs().length, 1);
  assert.equal(app.briefs()[0].body.work, work);
  app.change("policy", "denied");
  assert.equal(app.briefs().length, 2);
  await app.answer(app.briefs()[1], {token: "linked-work", status: "excluded"});
  await app.answer(app.briefs()[0], {token: "old-linked-work", status: "hold"});
  assertAnswer(app, "linked-work", "excluded");
});

test("board and inline example buttons still submit their displayed work", async (t) => {
  const app = await harness(t);
  app.setAllowed();
  const boardButton = app.document.querySelector(".board-open");
  assert(boardButton);
  boardButton.click();
  const boardRequest = app.briefs()[0];
  assert.equal(boardRequest.body.work, source.board_posts[0].work);
  const inlineButton = app.document.querySelector('[data-work]');
  inlineButton.click();
  assert.equal(app.briefs().length, 2);
  const latest = app.briefs()[1];
  assert.equal(latest.body.work, inlineButton.dataset.work);
  await app.answer(latest, {token: "inline-example"});
  await app.answer(boardRequest, {token: "old-board-example"});
  assertAnswer(app, "inline-example");
});


test("changing environment after the latest request failure retries the submitted question", async (t) => {
  const app = await harness(t);
  app.setAllowed();
  app.edit(work);
  const first = app.submit();
  await first.respond({error: "temporary service error"}, 500);
  assertInvalidated(app);
  assert.equal(app.document.getElementById("submit").disabled, false);
  app.change("policy", "unknown");
  assert.equal(app.briefs().length, 2);
  const retry = app.briefs()[1];
  assert.equal(retry.body.work, work);
  assert.equal(retry.body.policy, "unknown");
  assert.equal(app.document.getElementById("submit").disabled, true);
  await app.answer(retry, {token: "retry-result", status: "hold"});
  assertAnswer(app, "retry-result", "hold");
  assert.doesNotMatch(app.status().textContent, /temporary service error/);
});

test("a retained old confirmation button cannot send the newer result token", async (t) => {
  const app = await harness(t);
  await startAllowed(app);
  const oldCard = app.document.getElementById("candidate-chatgpt");
  oldCard.querySelector(".preview-button").click();
  const oldConfirm = oldCard.querySelector(".confirm-button");
  app.change("ecosystem", "microsoft");
  assertInvalidated(app);
  await app.answer(app.briefs()[1], {token: "newer-token"});
  assert.equal(oldCard.isConnected, false);
  oldConfirm.click();
  await flush();
  assert.equal(app.confirms().length, 0, "A detached result cannot confirm using any token");
  assert.equal(app.links().length, 0);
  const currentConfirm = app.beginConfirm();
  assert.equal(app.confirms().length, 1);
  assert.equal(currentConfirm.body.brief_token, "newer-token");
});
