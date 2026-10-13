import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

// In frontend/tests this runs without configuration. An external review draft can
// point to the actual frontend using TOOLMEET_FRONTEND_ROOT.
const frontend = process.env.TOOLMEET_FRONTEND_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(frontend, "package.json"));
const {JSDOM} = require("jsdom");
const html = fs.readFileSync(path.join(frontend, "src/index.html"), "utf8");
const feed = JSON.parse(fs.readFileSync(path.join(frontend, "../shared/data/brief_mock.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(frontend, "src/media/catalog/provenance.json"), "utf8"));
const work = "회의록에서 결정과 할 일을 뽑아 시트에 정리하고 싶어요";
const unexplainedWork = "매주 모은 회의 기록을 정리하려고 합니다";
const clone = (value) => JSON.parse(JSON.stringify(value));
async function flush() {await new Promise(setImmediate); await new Promise(setImmediate);}

async function harness(t) {
  const dom = new JSDOM(html, {url: "https://toolmeet.test/", runScripts: "outside-only"});
  t.after(() => dom.window.close());
  const {window} = dom, {document} = window;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
  const requests = [], confirmations = [], dataRequests = [];
  window.fetch = async (input) => {
    const pathname = new URL(input, window.location.href).pathname;
    dataRequests.push(pathname);
    if (pathname.endsWith("/brief_mock.json")) return new Response(JSON.stringify(feed));
    if (pathname.endsWith("/media/catalog/provenance.json")) return new Response(JSON.stringify(manifest));
    if (pathname === "/api/board") return new Response(JSON.stringify({data_mode: "mock", posts: feed.board_posts}));
    assert.fail("UI tests must not invoke a real API: " + pathname);
  };
  function deferred(captured, list, options = {}) {
    let resolve, reject;
    const promise = new Promise((accept, fail) => {resolve = accept; reject = fail;});
    const request = {
      snapshot: clone(captured), signal: options.signal,
      async respond(value) {resolve(typeof value === "function" ? value(request.snapshot) : value); await flush();},
      async reject(error) {reject(error); await flush();},
    };
    list.push(request);
    return promise;
  }
  for (const name of ["catalog.js", "exploration.js", "conversation.js", "brief.js"]) {
    const script = [...document.querySelectorAll("script[src]")].find((item) => new URL(item.src).pathname.endsWith("/" + name));
    assert(script, "index.html must load " + name);
    Object.defineProperty(document, "currentScript", {configurable: true, value: script});
    if (name === "brief.js") {
      // Keep the actual contracts; only the provider is replaced by controllable,
      // cancellation-resistant replies to expose late response races.
      window.ToolmeetConversation = {
        evaluate(snapshot, options) {window.ToolmeetConversationContract.validateSnapshot(snapshot); return deferred(snapshot, requests, options);},
        confirm(selection, options) {return deferred(selection, confirmations, options);},
      };
    }
    window.eval(fs.readFileSync(path.join(frontend, "src", name), "utf8"));
    delete document.currentScript;
  }
  await flush();
  return {
    window, document, requests, confirmations, dataRequests,
    contract: window.ToolmeetConversationContract,
    byId: (id) => document.getElementById(id),
    query: (selector) => document.querySelector(selector),
    all: (selector) => [...document.querySelectorAll(selector)],
    edit(value) {this.byId("work").value = value; this.byId("work").dispatchEvent(new window.Event("input", {bubbles: true}));},
    setCondition(id, value) {this.byId(id).value = value; this.byId(id).dispatchEvent(new window.Event("change", {bubbles: true}));},
    submit() {this.byId("brief-form").requestSubmit(); return requests.at(-1);},
    start(value = work) {this.edit(value); return this.submit();},
    latest() {return requests.at(-1);},
    links() {return this.all(".source-link");},
    phase() {return this.query('[data-phase][aria-current="step"]')?.dataset.phase;},
    editorButton(label) {return this.all("#answer-editor button").find((button) => button.textContent === label);},
    beginConfirm(id = "chatgpt") {
      const card = this.byId("candidate-" + id); assert(card);
      if (card.querySelector(".preview-panel").hidden) card.querySelector(".preview-button").click();
      const button = card.querySelector(".confirm-button"); assert(button);
      button.click(); return confirmations.at(-1);
    },
    project(id) {document.dispatchEvent(new window.CustomEvent("toolmeet:project-context", {detail: {project_id: id}}));},
    async ready({conditions = {}, token = "first-token"} = {}) {
      for (const [id, value] of Object.entries(conditions)) this.setCondition(id, value);
      const request = this.start(); await request.respond((s) => ready(this, s, token)); return request;
    },
  };
}

function base(app, snapshot, {phase = "recommendation", status = "ready"} = {}) {
  return {contract_version: "exploration.v1", request_id: snapshot.request_id, revision: snapshot.revision,
    data_mode: "mock", data_note: "UI contract fixture · 실제 AI나 기업 적용 검증 아님", phase, status,
    facts: clone(app.contract.factsFor(snapshot)), question: null, recommendations: null, notice: "fixture notice", error: null};
}
function question(app, snapshot, field = "outcome", type = field === "outcome" ? "text" : "choice") {
  const options = field === "policy" ? [{value: "allowed", label: "사용 가능"}, {value: "denied", label: "사용 불가"}] :
    field === "ecosystem" ? [{value: "google", label: "Google Workspace"}, {value: "other", label: "기타 · 직접 설명"}] : [];
  return {...base(app, snapshot, {phase: field === "outcome" ? "work" : "environment", status: "question"}),
    question: {id: "question-" + snapshot.request_id + "-" + field, field, prompt: "질문: " + field, type, options,
      allow_unknown: true, allow_text: type !== "choice"}};
}
function candidate(id = "chatgpt", status = "possible") {
  return {id, status, reasons: ["조건별 mock 추천 이유"], fit_reason: "환경 적합성은 미검증입니다.",
    first_gate: "시험 자료 허용을 확인하세요.", first_check: "출력을 원문과 대조하세요."};
}
function ready(app, s, value = "current-token", candidates = [candidate()]) {
  return {...base(app, s), recommendations: {candidates, supporting_methods: [], token: {value, binding: "brief", revision: s.revision, expires_at: null}}};
}
function held(app, s) {
  return {...ready(app, s, "held-token", [candidate("chatgpt", "hold")]), status: "needs_confirmation", notice: "정책과 자료 전송 조건 확인 필요"};
}
function empty(app, s, supporting = []) {
  return {...base(app, s, {status: "empty"}), recommendations: {candidates: [], supporting_methods: supporting, token: null}};
}
function errorTurn(app, s) {
  return {...base(app, s, {phase: "work", status: "error"}), error: {code: "unavailable", message: "일시적인 mock 오류", retryable: true, field_errors: []}};
}
function linked(s, source_url = "https://chatgpt.com/") {
  return {request_id: s.request_id, revision: s.revision, recommendation_request_id: s.recommendation_request_id,
    status: "linked", source_url, notice: "원본 링크 안내 단계", error: null};
}
function assertInvalidated(app) {
  assert.equal(app.byId("results").hidden, true);
  assert.equal(app.byId("candidate-list").children.length, 0);
  assert.equal(app.byId("supporting-methods").children.length, 0);
  assert.equal(app.links().length, 0);
}
function assertError(app) {
  assertInvalidated(app);
  assert.equal(app.byId("retry-conversation").hidden, false);
  assert.equal(app.byId("submit").disabled, false);
  assert.equal(app.byId("conversation").getAttribute("aria-busy"), "false");
  assert(app.byId("status").textContent.trim());
}

test("work → environment → recommendation renders exactly one question and keeps complete answer history", async (t) => {
  const app = await harness(t), first = app.start(unexplainedWork);
  assert.equal(app.byId("conversation").getAttribute("aria-busy"), "true");
  await first.respond((s) => question(app, s));
  assert.equal(app.phase(), "work");
  assert.equal(app.all("#conversation-question h3").length, 1);
  app.byId("answer-text").value = "결정 목록과 담당자 표";
  app.query("#conversation-question form").requestSubmit();
  const second = app.latest();
  assert(second.snapshot.revision > first.snapshot.revision);
  assert.equal(second.snapshot.work, unexplainedWork);
  assert.deepEqual(second.snapshot.answers.map((a) => [a.field, a.value]), [["outcome", "결정 목록과 담당자 표"]]);
  await second.respond((s) => question(app, s, "policy"));
  assert.equal(app.phase(), "environment");
  assert.equal(app.all("#conversation-question h3").length, 1);
  app.query('[data-answer-value="allowed"]').click();
  const third = app.latest();
  assert.equal(third.snapshot.answers.length, 2);
  assert.equal(third.snapshot.answers.find((a) => a.field === "policy").question_id, "question-" + second.snapshot.request_id + "-policy");
  await third.respond((s) => ready(app, s));
  assert.equal(app.phase(), "recommendation");
  assert.equal(app.byId("results").hidden, false);
  assert.equal(app.all("#conversation-question h3").length, 0);
  assert.equal(app.all(".answer-row").length, 2);
  assert.equal(app.links().length, 0);
});

test("known work facts are shown as mock evidence without manufacturing explicit answer records", async (t) => {
  const app = await harness(t), request = app.start(work + ". 외부 AI 사용 가능.");
  await request.respond((s) => ready(app, s));
  assert.deepEqual(request.snapshot.answers, []);
  assert.equal(app.all(".answer-row").length, 2);
  assert.equal(app.all(".answer-row small").length, 2);
  assert.match(app.byId("conversation-answers").textContent, /업무 문장의 명시 표현/);
  assert.equal(app.phase(), "recommendation", "Known facts allow early recommendation without filler questions");
  app.setCondition("ecosystem", "google");
  assert(app.query('[data-edit-answer="outcome"]'), "Current work facts survive a condition change");
  assert(app.query('[data-edit-answer="policy"]'));
  await app.latest().respond((s) => errorTurn(app, s));
  assertError(app);
  assert.equal(app.all(".answer-row").length, 3, "An error retains the work-derived facts and explicit answers");
  assert.equal(app.all(".answer-row small").length, 2);
});

test("choice_with_text requires an explanation for other and captures enum plus detail", async (t) => {
  const app = await harness(t), request = app.start();
  await request.respond((s) => question(app, s, "ecosystem", "choice_with_text"));
  app.byId("answer-choice").value = "other";
  app.byId("answer-choice").dispatchEvent(new app.window.Event("change"));
  app.query("#conversation-question form").requestSubmit();
  assert.equal(app.requests.length, 1, "Other cannot silently submit without a description");
  app.byId("answer-text").value = "사내 위키와 LibreOffice";
  app.byId("answer-text").dispatchEvent(new app.window.Event("input"));
  app.query("#conversation-question form").requestSubmit();
  const answer = app.latest().snapshot.answers.find((a) => a.field === "ecosystem");
  assert.equal(answer.value, "other"); assert.equal(answer.detail, "사내 위키와 LibreOffice");
  assert.equal(app.byId("ecosystem").value, "other");
  for (const field of ["outcome", "cost"]) await t.test(field + " accepts direct text", async (sub) => {
    const other = await harness(sub), first = other.start(unexplainedWork);
    await first.respond((s) => {
      const data = question(other, s, field, "choice_with_text");
      data.question.options = [{value: "선택한 예시", label: "선택한 예시"}];
      return data;
    });
    assert.equal(other.phase(), field === "outcome" ? "work" : "environment");
    other.byId("answer-text").value = "예시와 다른 직접 입력";
    other.byId("answer-text").dispatchEvent(new other.window.Event("input"));
    other.query("#conversation-question form").requestSubmit();
    assert.deepEqual(other.latest().snapshot.answers.map((a) => [a.field, a.state, a.value]), [[field, "known", "예시와 다른 직접 입력"]]);
  });
});

test("unknown is a completed answer with null value and renders a hold instead of approval", async (t) => {
  const app = await harness(t), request = app.start();
  await request.respond((s) => question(app, s, "policy"));
  app.query(".unknown-answer").click();
  const next = app.latest();
  assert.deepEqual(next.snapshot.answers.map((a) => [a.field, a.state, a.value]), [["policy", "unknown", null]]);
  await next.respond((s) => held(app, s));
  assert.match(app.byId("conversation-answers").textContent, /모름 · 답변 완료, 조건 미확인/);
  assert.equal(app.byId("candidate-chatgpt").querySelector(".confirm-button"), null);
  assert.equal(app.links().length, 0);
});

test("editing an answer instantly removes previous links and sends a higher revision full snapshot", async (t) => {
  const app = await harness(t);
  const first = await app.ready({conditions: {policy: "allowed", ecosystem: "google"}});
  await app.beginConfirm().respond(linked);
  assert.equal(app.links().length, 1);
  app.query('[data-edit-answer="policy"]').click();
  app.byId("edited-answer").value = "denied";
  app.query("#answer-editor form").requestSubmit();
  assertInvalidated(app);
  const next = app.latest();
  assert(next.snapshot.revision > first.snapshot.revision);
  assert.equal(next.snapshot.work, first.snapshot.work);
  assert.deepEqual(next.snapshot.answers.map((a) => [a.field, a.value]), [["policy", "denied"], ["ecosystem", "google"]]);
  assert.equal(next.snapshot.answers.find((a) => a.field === "policy").question_id, null);
  await next.respond((s) => ready(app, s));
  app.byId("reevaluate-conversation").click();
  const pending = app.latest();
  app.query('[data-edit-answer="ecosystem"]').click();
  app.byId("edited-answer").value = "other";
  const draft = app.byId("edited-detail");
  draft.value = "평가 응답 중에도 보존할 사내 도구 설명"; draft.focus();
  await pending.respond((s) => ready(app, s));
  assert.equal(app.byId("answer-editor").hidden, false, "A pending evaluation must not discard an editor opened after its request");
  assert.equal(app.byId("edited-detail"), draft);
  assert.equal(draft.value, "평가 응답 중에도 보존할 사내 도구 설명");
  assert.equal(app.document.activeElement, draft);
  assert.equal(app.byId("conversation-question").hidden, true);
  app.query("#answer-editor form").requestSubmit();
  assert.equal(app.latest().snapshot.answers.find((a) => a.field === "ecosystem").detail, draft.value);
});

test("deleting an explicit answer invalidates results and removes only that answer from the next full snapshot", async (t) => {
  const app = await harness(t), first = await app.ready({conditions: {policy: "allowed", ecosystem: "google"}});
  app.query('[data-edit-answer="policy"]').click();
  app.editorButton("답변 지우기").click();
  assertInvalidated(app);
  assert(app.latest().snapshot.revision > first.snapshot.revision);
  assert.deepEqual(app.latest().snapshot.answers.map((a) => a.field), ["ecosystem"]);
  assert.equal(app.byId("policy").value, "");
  assert.equal(app.query('[data-edit-answer="policy"]'), null);
});

test("work editing keeps explicit answers while immediately clearing old work-derived facts", async (t) => {
  const app = await harness(t);
  app.setCondition("ecosystem", "google");
  const first = app.start(work + ". 외부 AI 사용 가능.");
  await first.respond((s) => ready(app, s));
  assert(app.query('[data-edit-answer="policy"]'));
  app.edit(unexplainedWork);
  assertInvalidated(app);
  assert.equal(app.query('[data-edit-answer="policy"]'), null);
  assert.equal(app.query('[data-edit-answer="outcome"]'), null);
  assert(app.query('[data-edit-answer="ecosystem"]'));
  const next = app.submit();
  assert.equal(next.snapshot.work, unexplainedWork);
  assert.deepEqual(next.snapshot.answers.map((a) => [a.field, a.value]), [["ecosystem", "google"]]);
  assert(next.snapshot.revision > first.snapshot.revision);
});

test("error and retry preserve the applied free-text question, draft, work and answers", async (t) => {
  const app = await harness(t); app.setCondition("policy", "unknown");
  const first = app.start(unexplainedWork);
  await first.respond((s) => question(app, s));
  app.byId("answer-text").value = "아직 보내지 않은 결과 설명";
  app.byId("answer-text").dispatchEvent(new app.window.Event("input"));
  const input = app.byId("answer-text");
  app.byId("reevaluate-conversation").click();
  const failed = app.latest();
  await failed.respond((s) => errorTurn(app, s));
  assertError(app);
  assert.equal(app.byId("answer-text"), input);
  assert.equal(input.value, "아직 보내지 않은 결과 설명");
  app.byId("retry-conversation").click();
  const retry = app.latest();
  assert.equal(retry.snapshot.revision, failed.snapshot.revision);
  assert.deepEqual(retry.snapshot.answers, failed.snapshot.answers);
  assert.equal(retry.snapshot.work, unexplainedWork);
  await retry.respond((s) => question(app, s));
  assert.equal(app.byId("answer-text").value, "아직 보내지 않은 결과 설명");
  assert.equal(app.byId("retry-conversation").hidden, true);
  app.query("#conversation-question form").requestSubmit();
  assert.equal(app.latest().snapshot.answers.find((a) => a.field === "outcome").value, "아직 보내지 않은 결과 설명");
});

test("tab round trips retain the text draft and do not send or rebuild the active question", async (t) => {
  const app = await harness(t), first = app.start(unexplainedWork);
  await first.respond((s) => question(app, s));
  const input = app.byId("answer-text"); input.value = "탭을 이동해도 남아야 할 설명";
  input.dispatchEvent(new app.window.Event("input"));
  app.byId("projects-tab").click(); assert.equal(app.byId("ask-panel").hidden, true);
  app.byId("ask-tab").click();
  assert.equal(app.byId("answer-text"), input);
  assert.equal(input.value, "탭을 이동해도 남아야 할 설명");
  assert.equal(app.requests.length, 1);
  input.form.requestSubmit();
  assert.equal(app.latest().snapshot.answers[0].value, input.value);
});

test("old question controls cannot answer during reevaluation or after the work changes", async (t) => {
  const app = await harness(t), first = app.start();
  await first.respond((s) => question(app, s, "policy"));
  const oldChoice = app.query('[data-answer-value="allowed"]'), oldUnknown = app.query(".unknown-answer");
  app.byId("reevaluate-conversation").click();
  oldChoice.click(); oldUnknown.click();
  assert.equal(app.requests.length, 2);
  assert.deepEqual(app.latest().snapshot.answers, []);
  app.edit("공개 문서를 비교해 요약 보고서를 만들고 싶어요");
  oldChoice.click(); oldUnknown.click();
  assert.equal(app.requests.length, 2);
  const next = app.submit();
  assert.deepEqual(next.snapshot.answers, []);
  assert(next.snapshot.revision > first.snapshot.revision);
});

test("project context change invalidates the old result and preserves full work and answers", async (t) => {
  const app = await harness(t), first = await app.ready({conditions: {policy: "allowed"}});
  await app.beginConfirm().respond(linked);
  const projectId = feed.candidates.find((c) => c.kind === "공개 프로젝트").id;
  app.project(projectId);
  assertInvalidated(app);
  const next = app.latest();
  assert.equal(next.snapshot.project_id, projectId);
  assert(next.snapshot.revision > first.snapshot.revision);
  assert.equal(next.snapshot.work, first.snapshot.work);
  assert.deepEqual(next.snapshot.answers, first.snapshot.answers);
  app.project(projectId); assert.equal(app.requests.length, 2, "Same project is not a new revision");
  app.project(null); assert.equal(app.latest().snapshot.project_id, null);
});

for (const outcome of ["success", "error"]) {
  test(`same-revision reevaluation ignores prior confirm ${outcome} and its finally while a new confirm is pending`, async (t) => {
    const app = await harness(t), first = await app.ready();
    const old = app.beginConfirm();
    app.byId("reevaluate-conversation").click();
    const second = app.latest();
    assert.equal(second.snapshot.revision, first.snapshot.revision);
    assert.notEqual(second.snapshot.request_id, first.snapshot.request_id);
    await second.respond((s) => ready(app, s, "new-token"));
    const current = app.beginConfirm(), currentButton = app.query(".confirm-button");
    assert.equal(currentButton.disabled, true);
    if (outcome === "success") await old.respond((s) => linked(s, "https://old.example/"));
    else await old.reject(new Error("OLD_CONFIRM_ERROR"));
    assert.equal(app.links().length, 0);
    assert.equal(currentButton.disabled, true, "Old finally must not reenable controls belonging to the new confirmation");
    assert.doesNotMatch(app.byId("results").textContent, /OLD_CONFIRM_ERROR|old\.example/);
    await current.respond((s) => linked(s, "https://current.example/"));
    assert.equal(app.links()[0].href, "https://current.example/");
  });
}

test("out-of-order turn responses cannot replace current results, links or busy state", async (t) => {
  const app = await harness(t), old = app.start();
  app.edit("공개 문서를 비교해 출처가 있는 요약 보고서를 만들고 싶어요");
  const current = app.submit();
  assert.equal(old.signal.aborted, true);
  await current.respond((s) => ready(app, s, "current-token"));
  await app.beginConfirm().respond((s) => linked(s, "https://current.example/"));
  const card = app.byId("candidate-chatgpt"), link = app.links()[0];
  await old.respond((s) => ready(app, s, "stale-token", [candidate("notebooklm")]));
  assert.equal(app.byId("candidate-chatgpt"), card);
  assert.equal(app.links()[0], link);
  assert.equal(app.byId("asked-question").textContent, current.snapshot.work);
  assert.equal(app.byId("submit").disabled, false);
  assert.equal(app.byId("conversation").getAttribute("aria-busy"), "false");
});

test("malformed question envelopes, facts and enum values fail closed without rendering an active question", async (t) => {
  const cases = {
    missingEnvelope: () => null,
    version: (d) => ({...d, contract_version: "future.v2"}),
    request: (d) => ({...d, request_id: "other-request"}),
    revision: (d) => ({...d, revision: d.revision + 1}),
    phase: (d) => ({...d, phase: "work"}),
    required: (d) => {delete d.recommendations; return d;},
    enum: (d) => {d.question.options[0].value = "maybe"; return d;},
    duplicateOptions: (d) => {d.question.options.push(d.question.options[0]); return d;},
    alreadyKnown: (d) => {d.question = {id: "already-known", field: "outcome", prompt: "known field", type: "text", options: [], allow_text: true, allow_unknown: true}; d.phase = "work"; return d;},
    inconsistentFact: (d) => {d.facts.policy = {state: "known", value: "allowed", origin: "work", reference: "없는 명시 표현"}; return d;},
  };
  for (const [name, mutate] of Object.entries(cases)) await t.test(name, async (sub) => {
    const app = await harness(sub), request = app.start();
    await request.respond((s) => mutate(question(app, s, "policy")));
    assertError(app);
    assert.equal(app.query("#conversation-question h3"), null);
    assert.equal(app.query(".answer-option"), null);
  });
});

test("malformed recommendation IDs, duplicate IDs, status enums, tokens and source URLs fail closed", async (t) => {
  const internalId = feed.candidates.find((c) => c.kind === "툴밋 방법").id;
  const cases = {
    unknownId: (d) => {d.recommendations.candidates[0].id = "absent-project"; return d;},
    duplicateId: (d) => {d.recommendations.candidates.push(clone(d.recommendations.candidates[0])); return d;},
    internalCandidate: (d) => {d.recommendations.candidates[0].id = internalId; return d;},
    enum: (d) => {d.recommendations.candidates[0].status = "approved"; return d;},
    sourceUrl: (d) => {d.recommendations.candidates[0].source_url = "https://bypass.example/"; return d;},
    tokenRevision: (d) => {d.recommendations.token.revision++; return d;},
    supportingId: (d) => {d.recommendations.supporting_methods = ["chatgpt"]; return d;},
    readyWithoutViable: (d) => {d.recommendations.candidates[0].status = "hold"; return d;},
  };
  for (const [name, mutate] of Object.entries(cases)) await t.test(name, async (sub) => {
    const app = await harness(sub), request = app.start();
    await request.respond((s) => mutate(ready(app, s)));
    assertError(app);
    assert.equal(app.query(".confirm-button"), null);
  });
});

test("unsafe or mismatched confirmation DTOs cannot produce source links and leave retryable controls", async (t) => {
  const cases = {
    javascript: (d) => ({...d, source_url: "javascript:alert(1)"}),
    credentials: (d) => ({...d, source_url: "https://user:secret@example.com/"}),
    data: (d) => ({...d, source_url: "data:text/html,bypass"}),
    request: (d) => ({...d, request_id: "another-confirmation"}),
    recommendation: (d) => ({...d, recommendation_request_id: "another-turn"}),
    revision: (d) => ({...d, revision: d.revision + 1}),
    enum: (d) => ({...d, status: "approved"}),
  };
  for (const [name, mutate] of Object.entries(cases)) await t.test(name, async (sub) => {
    const app = await harness(sub); await app.ready();
    const confirmation = app.beginConfirm();
    await confirmation.respond((s) => mutate(linked(s)));
    assert.equal(app.links().length, 0);
    assert.equal(app.query(".confirm-button").disabled, false);
    assert.match(app.query(".confirm-feedback").textContent, /현재 추천과 일치하지 않습니다/);
  });
});

test("hold, empty and internal preparation methods render separate guidance without a source-link bypass", async (t) => {
  const app = await harness(t), request = app.start();
  await request.respond((s) => held(app, s));
  assert.equal(app.byId("results").hidden, false);
  assert.match(app.byId("candidate-list").textContent, /확인 전 보류/);
  app.query(".preview-button").click();
  assert.match(app.query(".hold-note").textContent, /연결 보류/);
  assert.equal(app.query(".confirm-button"), null);
  const internalId = feed.candidates.find((c) => c.kind === "툴밋 방법").id;
  app.byId("reevaluate-conversation").click();
  await app.latest().respond((s) => empty(app, s, [internalId]));
  assert.equal(app.all("#candidate-list .candidate").length, 0);
  assert.match(app.query(".empty-result").textContent, /외부 서비스·공개 프로젝트 후보 없음/);
  assert.equal(app.all(".supporting-method").length, 1);
  assert.match(app.byId("supporting-methods").textContent, /업무 준비 방법/);
  assert.equal(app.query(".confirm-button"), null);
  assert.equal(app.links().length, 0);
});

test("new question clears drafts, explicit history, project context and pending evaluation", async (t) => {
  const app = await harness(t); app.setCondition("policy", "allowed"); app.project("chatgpt");
  const first = app.start(unexplainedWork); await first.respond((s) => question(app, s));
  app.byId("answer-text").value = "없어져야 할 초안"; app.byId("answer-text").dispatchEvent(new app.window.Event("input"));
  app.byId("reevaluate-conversation").click(); const pending = app.latest();
  app.byId("new-question").click();
  assertInvalidated(app);
  assert.equal(app.byId("work").value, ""); assert.equal(app.byId("policy").value, "");
  assert.equal(app.all(".answer-row").length, 0);
  assert.equal(app.byId("conversation").hidden, true);
  assert.equal(app.phase(), "work");
  await pending.respond((s) => ready(app, s, "stale-token"));
  assertInvalidated(app); assert.equal(app.byId("status").hidden, true);
  const next = app.start(unexplainedWork); assert(next.snapshot.revision > first.snapshot.revision);
  assert.deepEqual(next.snapshot.answers, []); assert.equal(next.snapshot.project_id, null);
  await next.respond((s) => question(app, s));
  assert.equal(app.byId("answer-text").value, "");
});

test("new question ignores late confirmation success and failure while keeping reset controls usable", async (t) => {
  for (const outcome of ["success", "error"]) await t.test(outcome, async (sub) => {
    const app = await harness(sub); await app.ready({conditions: {policy: "allowed"}});
    const confirmation = app.beginConfirm(); app.byId("new-question").click();
    if (outcome === "success") await confirmation.respond(linked);
    else await confirmation.reject(new Error("OLD_RESET_CONFIRM_ERROR"));
    assertInvalidated(app);
    assert.equal(app.byId("submit").disabled, false);
    assert.equal(app.byId("conversation").hidden, true);
    assert.equal(app.byId("status").hidden, true);
    assert.doesNotMatch(app.document.body.textContent, /OLD_RESET_CONFIRM_ERROR/);
    assert.equal(app.document.activeElement, app.byId("ask-tab"));
  });
});
