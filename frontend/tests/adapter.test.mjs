import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {webcrypto} from "node:crypto";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const root = process.env.TOOLMEET_FRONTEND_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const {JSDOM} = require("jsdom");
const script = (name) => fs.readFileSync(path.join(root, "src", name), "utf8");
const conversationScript = fs.readFileSync(process.env.TOOLMEET_CONVERSATION_SCRIPT ?? path.join(root, "src", "conversation.js"), "utf8");
const source = JSON.parse(fs.readFileSync(path.join(root, "..", "shared", "data", "brief_mock.json"), "utf8"));
const rules = JSON.parse(fs.readFileSync(path.join(root, "..", "shared", "data", "topic_rules.json"), "utf8"));
const provenance = JSON.parse(fs.readFileSync(path.join(root, "src", "media", "catalog", "provenance.json"), "utf8"));
const examples = JSON.parse(fs.readFileSync(path.join(root, "..", "docs", "contracts", "exploration-v1.examples.json"), "utf8"));
const plain = (value) => JSON.parse(JSON.stringify(value));
const meeting = source.board_posts.find((post) => post.topic === "meeting").work;

function snapshot(work = meeting, answers = [], extra = {}) {
  return {contract_version: "exploration.v1", request_id: "request-0", revision: 0, work, project_id: null, answers, ...extra};
}

function answer(previous, field, value, {detail, unknown = false} = {}) {
  const revision = previous.revision + 1;
  return {...previous, request_id: `request-${revision}`, revision,
    answers: [...previous.answers.filter((item) => item.field !== field), {
      id: `answer-${revision}-${field}`, question_id: `q-${previous.revision}-${field}`,
      field, state: unknown ? "unknown" : "known", value: unknown ? null : value,
      ...(detail === undefined ? {} : {detail}),
    }]};
}

function complete(work = meeting) {
  let state = snapshot(work);
  for (const [field, value] of Object.entries({policy: "allowed", data_kind: "public", installation: "allowed", hosting: "self_hosted", ecosystem: "google"})) state = answer(state, field, value);
  return state;
}

async function harness(t, {candidateIds, transform} = {}) {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {url: "https://toolmeet.test/toolmeet/", runScripts: "outside-only"});
  t.after(() => dom.window.close());
  const {window} = dom;
  window.Request = Request;
  window.Response = Response;
  Object.defineProperty(window, "crypto", {configurable: true, value: webcrypto});
  const mockSource = {...plain(source), topic_rules: plain(rules)};
  // Narrow existing fixture candidates to exercise requirements hidden by the generic early-ready service.
  if (candidateIds) mockSource.candidates = mockSource.candidates.filter((item) => candidateIds.includes(item.id) || item.id === "local-review");
  const nativeRequests = [];
  window.fetch = async (input) => {
    const url = new URL(input, window.location.href);
    nativeRequests.push(url.href);
    const relative = url.pathname.replace(/^\/toolmeet\//, "");
    assert.equal(url.origin, window.location.origin, "Adapter tests must make no external requests");
    const data = {"brief_mock.json": mockSource, "media/catalog/provenance.json": provenance}[relative];
    assert(data, `Unexpected native fetch: ${url.href}`);
    return new Response(JSON.stringify(data));
  };
  function evaluateScript(name, contents) {
    const element = window.document.createElement("script");
    element.src = new URL(name, window.location.href).href;
    window.document.head.append(element);
    Object.defineProperty(window.document, "currentScript", {configurable: true, value: element});
    window.eval(contents);
    delete window.document.currentScript;
  }
  evaluateScript("catalog.js", script("catalog.js"));
  evaluateScript("mock_api.js", script("mock_api.js"));
  const mockFetch = window.fetch.bind(window);
  const requests = [];
  window.fetch = async (input, options = {}) => {
    const pathname = new URL(input, window.location.href).pathname;
    const response = await mockFetch(input, options);
    if (!pathname.includes("/api/")) return response;
    const data = await response.json();
    requests.push({pathname, body: JSON.parse(options.body ?? "{}"), data: plain(data), status: response.status});
    const changed = transform ? transform(pathname, plain(data)) : data;
    return new Response(JSON.stringify(changed), {status: response.status});
  };
  evaluateScript("conversation.js", conversationScript);
  const catalog = await window.ToolmeetCatalog.list();
  const contract = window.ToolmeetConversationContract;
  return {window, catalog, contract, requests, nativeRequests,
    briefs: () => requests.filter((request) => request.pathname === "/api/brief"),
    confirms: () => requests.filter((request) => request.pathname === "/api/brief/confirm"),
    async evaluate(state) {
      const result = await window.ToolmeetConversation.evaluate(state);
      assert.equal(contract.validateTurn(result, state, catalog), result);
      assert.equal(result.data_mode, "mock");
      assert.match(result.data_note, /mock/);
      return result;
    },
    async confirm(selection) {
      const result = await window.ToolmeetConversation.confirm(selection);
      assert.equal(contract.validateConfirmation(result, selection), result);
      return result;
    },
  };
}

function selection(state, turn, candidateId = "chatgpt", extra = {}) {
  return {request_id: `confirm-${state.revision}`, recommendation_request_id: turn.request_id,
    revision: state.revision, candidate_id: candidateId, token: plain(turn.recommendations.token), confirmed: true, ...extra};
}

function rejectMutations(app, original, state, mutations) {
  for (const [label, change] of mutations) {
    const invalid = plain(original);
    change(invalid);
    assert.throws(() => app.contract.validateTurn(invalid, state, app.catalog), {code: "invalid_payload"}, label);
  }
}

test("an unconfirmed outcome starts with a free-text work question and makes no brief request", async (t) => {
  const app = await harness(t);
  const state = snapshot("회의 메모를 매일 전달하고 있습니다");
  const turn = await app.evaluate(state);
  assert.equal(turn.phase, "work");
  assert.equal(turn.question.field, "outcome");
  assert.equal(turn.question.type, "text");
  assert.equal(turn.question.allow_text, true);
  assert.equal(turn.question.allow_unknown, true);
  assert.deepEqual(plain(turn.question.options), []);
  assert.equal(app.briefs().length, 0);
});

test("known example clauses are retained as work facts and sufficient conditions finish early", async (t) => {
  const app = await harness(t);
  const state = snapshot(`${meeting}. 외부 AI 사용 가능. 공개·합성 자료.`);
  const turn = await app.evaluate(state);
  assert.equal(turn.status, "ready");
  assert.equal(turn.question, null);
  assert.equal(turn.facts.policy.origin, "work");
  assert.equal(turn.facts.policy.reference, "외부 AI 사용 가능");
  assert.equal(turn.facts.data_kind.value, "public");
  assert.equal(turn.facts.installation, undefined);
  assert.equal(turn.facts.hosting, undefined);
  assert.equal(turn.facts.ecosystem, undefined);
  assert(turn.recommendations.candidates.some((candidate) => candidate.id === "chatgpt" && candidate.status === "possible"));
  assert.equal(JSON.stringify(turn).includes("source_url"), false);
  assert(app.nativeRequests.every((url) => !new URL(url).pathname.includes("/api/")), "Static API calls stay in mock_api.js");
});

test("negated or conflicting clauses remain unconfirmed rather than being inferred", async (t) => {
  const app = await harness(t);
  for (const statement of ["외부 AI 사용 가능하지 않아요", "외부 AI 사용 가능. 외부 AI 사용 불가", "외부 AI 사용 가능일 수도 있어요"]) {
    const turn = await app.evaluate(snapshot(`${meeting}. ${statement}.`));
    assert.equal(turn.question.field, "policy", statement);
    assert.equal(turn.facts.policy, undefined, statement);
  }
});

test("negated example outcomes remain unconfirmed and do not initiate environment questions", async (t) => {
  const app = await harness(t);
  for (const work of ["회의 메모를 시트에 정리 원하지 않음", "양식 결과를 PDF로 만들고 싶지 않음"]) {
    const turn = await app.evaluate(snapshot(work));
    assert.equal(turn.status, "question", work);
    assert.equal(turn.phase, "work", work);
    assert.equal(turn.question.field, "outcome", work);
    assert.equal(turn.facts.outcome, undefined, work);
    assert.equal(turn.recommendations, null, work);
  }
  assert.equal(app.briefs().length, 0);
});

test("policy and public-data answers end questioning as soon as a usable candidate exists", async (t) => {
  const app = await harness(t);
  let state = snapshot();
  let turn = await app.evaluate(state);
  assert.equal(turn.question.field, "policy");
  assert.equal(turn.question.type, "choice");
  assert.equal(turn.question.allow_text, false);
  state = answer(state, "policy", "allowed");
  turn = await app.evaluate(state);
  assert.equal(turn.question.field, "data_kind");
  state = answer(state, "data_kind", "public");
  turn = await app.evaluate(state);
  assert.equal(turn.status, "ready");
  assert.equal(turn.question, null);
  assert.equal(state.answers.length, 2);
});

test("unknown policy counts as an answer and holds candidates without repeating the question", async (t) => {
  const app = await harness(t);
  const unanswered = await app.evaluate(snapshot());
  assert.equal(unanswered.question.field, "policy");
  const state = answer(snapshot(), "policy", null, {unknown: true});
  const turn = await app.evaluate(state);
  assert.equal(turn.status, "needs_confirmation");
  assert.equal(turn.question, null);
  assert.deepEqual(plain(turn.facts.policy), {state: "unknown", value: null, origin: "answer", reference: state.answers[0].id});
  assert(turn.recommendations.candidates.every((candidate) => candidate.status === "hold"));
  assert.equal((await app.evaluate(state)).question, null);
});

test("unknown trial data does not trigger unrelated installation or account questions", async (t) => {
  const app = await harness(t);
  const state = answer(answer(snapshot(), "policy", "allowed"), "data_kind", null, {unknown: true});
  const turn = await app.evaluate(state);
  assert.equal(turn.status, "needs_confirmation");
  assert.equal(turn.question, null);
  assert.equal(turn.facts.data_kind.state, "unknown");
  assert.equal(turn.facts.installation, undefined);
});

test("candidate requirements determine variable choice and choice-with-text questions", async (t) => {
  const app = await harness(t, {candidateIds: ["n8n-meeting"]});
  let state = snapshot();
  const seen = [];
  for (const [field, value] of Object.entries({policy: "allowed", data_kind: "public", installation: "allowed", hosting: "self_hosted"})) {
    const turn = await app.evaluate(state);
    seen.push(turn.question.field);
    assert.equal(turn.question.field, field);
    state = answer(state, field, value);
  }
  const tools = await app.evaluate(state);
  assert.equal(tools.question.field, "ecosystem");
  assert.equal(tools.question.type, "choice_with_text");
  assert.equal(tools.question.allow_text, true);
  assert.deepEqual(plain(tools.question.options.map((option) => option.value)), ["google", "microsoft", "other"]);
  const other = answer(state, "ecosystem", "other", {detail: "사내 문서 도구를 사용합니다"});
  const held = await app.evaluate(other);
  assert.equal(held.status, "needs_confirmation");
  assert.equal(held.question, null);
  assert.equal(held.facts.ecosystem.value, "other");
  assert.equal(app.briefs().at(-1).body.ecosystem, "other", "Free text does not pretend to establish account compatibility");
  const ready = await app.evaluate(answer(other, "ecosystem", "google"));
  assert.equal(ready.status, "ready");
  assert.deepEqual(seen, ["policy", "data_kind", "installation", "hosting"]);
});

test("an explicit outcome answer participates in legacy classification without AI interpretation", async (t) => {
  const app = await harness(t);
  const work = "매일 반복하는 내용을 별도로 관리합니다";
  let state = answer(snapshot(work), "outcome", "회의록 담당자와 할 일 목록을 얻기");
  state = answer(answer(state, "policy", "allowed"), "data_kind", "public");
  const turn = await app.evaluate(state);
  assert.equal(turn.status, "ready");
  assert.match(app.briefs().at(-1).body.work, /원하는 결과: 회의록 담당자와 할 일 목록을 얻기/);
  assert.equal(turn.facts.outcome.origin, "answer");
  assert.equal(turn.context.topic_label, "회의·후속 작업");
});

test("an unknown outcome holds direction without asking more questions or providing a token", async (t) => {
  const app = await harness(t);
  const possible = await app.evaluate(complete());
  assert(possible.recommendations.candidates.some((candidate) => candidate.status === "possible"));
  assert(possible.recommendations.candidates.some((candidate) => candidate.status === "adapt"));
  for (const previous of [snapshot("회의 메모를 매일 전달하고 있습니다"), complete()]) {
    const state = answer(previous, "outcome", null, {unknown: true});
    const turn = await app.evaluate(state);
    assert.equal(turn.status, "needs_confirmation");
    assert.equal(turn.phase, "recommendation");
    assert.equal(turn.question, null);
    assert.equal(turn.facts.outcome.state, "unknown");
    assert.equal(turn.facts.outcome.reference, state.answers.find((item) => item.field === "outcome").id);
    assert.equal(turn.recommendations.token, null);
    assert(turn.recommendations.candidates.every((candidate) => candidate.status === "hold"));
    const repeated = await app.evaluate(state);
    assert.equal(repeated.status, "needs_confirmation");
    assert.equal(repeated.question, null);
    assert.equal(repeated.recommendations.token, null);
  }
});

test("explicit answers override conflicting work clauses with answer provenance", async (t) => {
  const app = await harness(t);
  const state = answer(snapshot(`${meeting}. 외부 AI 사용 가능. 공개 자료.`), "policy", "denied");
  const turn = await app.evaluate(state);
  assert.equal(turn.status, "empty");
  assert.deepEqual(plain(turn.facts.policy), {state: "known", value: "denied", origin: "answer", reference: state.answers[0].id});
  assert.equal(app.briefs().at(-1).body.policy, "denied");
  assert.match(turn.notice, /직접 답한 조건을 우선 적용/);
  assert.match(turn.notice, /업무 문장의 이전 조건과 다르므로/);
  const incomplete = answer(snapshot("업무 문서를 매일 전달하고 있습니다. 외부 AI 사용 가능."), "policy", "denied");
  const question = await app.evaluate(incomplete);
  assert.equal(question.question.field, "outcome");
  assert.equal(question.facts.policy.value, "denied");
  assert.match(question.notice, /직접 답한 조건을 우선 적용/);
});

test("known internal trial data remains on hold and cannot obtain an original link", async (t) => {
  const app = await harness(t);
  const state = answer(answer(snapshot(), "policy", "allowed"), "data_kind", "internal");
  const turn = await app.evaluate(state);
  assert.equal(turn.status, "needs_confirmation");
  assert.equal(turn.question, null);
  assert.equal(turn.facts.installation, undefined);
  assert.equal(turn.facts.hosting, undefined);
  assert.equal(turn.facts.ecosystem, undefined);
  assert(turn.recommendations.candidates.every((candidate) => candidate.status === "hold"));
  const confirmation = await app.confirm(selection(state, turn));
  assert.equal(confirmation.status, "error");
  assert.equal(confirmation.source_url, null);
});

test("denied external AI produces empty recommendations with internal guidance kept separate", async (t) => {
  const app = await harness(t);
  const state = answer(snapshot(), "policy", "denied");
  const turn = await app.evaluate(state);
  assert.equal(turn.status, "empty");
  assert.deepEqual(plain(turn.recommendations.candidates), []);
  assert.deepEqual(plain(turn.recommendations.supporting_methods), ["local-review"]);
  assert.equal(turn.recommendations.token, null);
  assert.deepEqual(plain(turn.context.related_news), []);
  assert.equal(turn.question, null);
});

test("unmatched work returns an empty state rather than presenting internal guidance as a project", async (t) => {
  const app = await harness(t);
  const turn = await app.evaluate(answer(snapshot("상자 색을 매일 변경하고 있습니다"), "outcome", "파란색 상자 만들기"));
  assert.equal(turn.status, "empty");
  assert.deepEqual(plain(turn.recommendations.supporting_methods), ["local-review"]);
  assert.equal(turn.recommendations.candidates.length, 0);
  assert.equal(turn.recommendations.token, null);
});

test("project_id is checked for catalog existence without claiming project-specific assessment", async (t) => {
  const app = await harness(t);
  const state = {...complete(), project_id: "n8n-meeting"};
  const normal = await app.evaluate({...state, project_id: null});
  const selected = await app.evaluate(state);
  assert.deepEqual(plain(selected.recommendations.candidates), plain(normal.recommendations.candidates));
  const missing = await app.evaluate({...state, project_id: "missing-project"});
  assert.equal(missing.status, "error");
  assert.equal(missing.error.code, "not_found");
  assert.equal(missing.recommendations, null);
  const before = app.briefs().length;
  const missingBeforeOutcome = await app.evaluate(snapshot("회의 메모를 매일 전달하고 있습니다", [], {project_id: "missing-project"}));
  assert.equal(missingBeforeOutcome.status, "error");
  assert.equal(missingBeforeOutcome.error.code, "not_found");
  assert.equal(missingBeforeOutcome.question, null);
  assert.equal(app.briefs().length, before, "A nonexistent project is rejected before asking about outcome or sending a brief request");
});

for (const scenario of examples.scenarios) {
  test(`published exploration.v1 example ${scenario.name} passes the actual contract validators`, async (t) => {
    const app = await harness(t);
    assert.equal(app.contract.validateSnapshot(scenario.request), scenario.request);
    assert.equal(app.contract.validateTurn(scenario.response, scenario.request, app.catalog), scenario.response);
  });
}

test("snapshot validation rejects incorrect versions, enum values, duplicate answers and invalid shapes", async (t) => {
  const app = await harness(t);
  const valid = complete();
  const mutations = [
    ["version", (state) => {state.contract_version = "exploration.v2";}],
    ["revision", (state) => {state.revision = -1;}],
    ["work length", (state) => {state.work = "회의";}],
    ["unknown enum", (state) => {state.answers[0].value = "maybe";}],
    ["unknown with value", (state) => {state.answers[0].state = "unknown";}],
    ["duplicate field", (state) => {state.answers.push({...state.answers[0], id: "other-id"});}],
    ["duplicate ID", (state) => {state.answers[1].id = state.answers[0].id;}],
    ["answer shape", (state) => {state.answers = {}; }],
  ];
  for (const [label, change] of mutations) {
    const invalid = plain(valid);
    change(invalid);
    assert.throws(() => app.contract.validateSnapshot(invalid), {code: "invalid_input"}, label);
  }
});

test("turn validation rejects mismatched response identity and missing contract fields", async (t) => {
  const app = await harness(t);
  const state = complete();
  const turn = await app.evaluate(state);
  rejectMutations(app, turn, state, [
    ["version", (data) => {data.contract_version = "exploration.v2";}],
    ["request ID", (data) => {data.request_id = "old-request";}],
    ["revision", (data) => {data.revision--;}],
    ["mode", (data) => {data.data_mode = "actual";}],
    ["mandatory question", (data) => {delete data.question;}],
    ["invalid phase", (data) => {data.phase = "done";}],
  ]);
});

test("turn validation rejects contradictory facts and questions that repeat known or unknown answers", async (t) => {
  const app = await harness(t);
  const state = answer(snapshot(), "policy", "allowed");
  const turn = await app.evaluate(state);
  rejectMutations(app, turn, state, [
    ["answer value", (data) => {data.facts.policy.value = "denied";}],
    ["answer origin", (data) => {data.facts.policy.origin = "work"; data.facts.policy.reference = state.work;}],
    ["answer reference", (data) => {data.facts.policy.reference = "old-answer";}],
    ["missing answer fact", (data) => {delete data.facts.policy;}],
    ["repeated known field", (data) => {data.question.field = "policy"; data.question.options = [{value: "allowed", label: "가능"}];}],
    ["invalid choice enum", (data) => {data.question.options[0].value = "private";}],
    ["inconsistent text question", (data) => {data.question.type = "text"; data.question.allow_text = true;}],
  ]);
  const unknownState = answer(snapshot(), "policy", null, {unknown: true});
  const invalid = plain(turn);
  invalid.request_id = unknownState.request_id;
  invalid.facts.policy = {state: "unknown", value: null, origin: "answer", reference: unknownState.answers[0].id};
  invalid.question.field = "policy";
  invalid.question.options = [{value: "allowed", label: "가능"}];
  assert.throws(() => app.contract.validateTurn(invalid, unknownState, app.catalog), {code: "invalid_payload"});
});

test("recommendation validation rejects unknown IDs, invalid states, early URLs and malformed context", async (t) => {
  const app = await harness(t);
  const state = complete();
  const turn = await app.evaluate(state);
  rejectMutations(app, turn, state, [
    ["unknown candidate", (data) => {data.recommendations.candidates[0].id = "missing-project";}],
    ["duplicate candidate", (data) => {data.recommendations.candidates.push(data.recommendations.candidates[0]);}],
    ["internal method as project", (data) => {data.recommendations.candidates[0].id = "local-review";}],
    ["candidate enum", (data) => {data.recommendations.candidates[0].status = "approved";}],
    ["empty reasons", (data) => {data.recommendations.candidates[0].reasons = [];}],
    ["source URL before confirmation", (data) => {data.recommendations.candidates[0].source_url = "https://chatgpt.com/";}],
    ["expired revision binding", (data) => {data.recommendations.token.revision--;}],
    ["wrong supporting method", (data) => {data.recommendations.supporting_methods = ["chatgpt"];}],
    ["context shape", (data) => {data.context.related_news = {}; }],
    ["context ID", (data) => {data.context.related_news[0].candidate_ids = ["missing-project"];}],
    ["ready without usable candidate", (data) => {data.recommendations.candidates.forEach((candidate) => {candidate.status = "hold";});}],
  ]);
});

test("malformed existing brief candidates become an error while preserving current answer facts", async (t) => {
  const app = await harness(t, {transform(pathname, data) {
    if (pathname === "/api/brief") data.candidates[0].source_url = "https://chatgpt.com/";
    return data;
  }});
  const state = complete();
  const turn = await app.evaluate(state);
  assert.equal(turn.status, "error");
  assert.equal(turn.error.code, "invalid_payload");
  assert.equal(turn.error.retryable, false);
  assert.equal(turn.recommendations, null);
  assert.equal(turn.facts.policy.reference, state.answers.find((item) => item.field === "policy").id);
});

test("an actual ready mock recommendation exposes its source only after explicit confirmation", async (t) => {
  const app = await harness(t);
  const state = complete();
  const turn = await app.evaluate(state);
  assert.equal(JSON.stringify(turn).includes("source_url"), false);
  const denied = await app.confirm(selection(state, turn, "chatgpt", {confirmed: false}));
  assert.equal(denied.status, "error");
  assert.equal(denied.error.code, "invalid_input");
  assert.equal(app.confirms().length, 0);
  const linked = await app.confirm(selection(state, turn));
  assert.equal(linked.status, "linked");
  assert.equal(linked.source_url, source.candidates.find((item) => item.id === "chatgpt").source_url);
  assert.deepEqual(app.confirms()[0].body, {brief_token: turn.recommendations.token.value, candidate_id: "chatgpt", confirmed: true});
});

test("expired or incompatible tokens are rejected locally without a confirm API call", async (t) => {
  const app = await harness(t);
  const state = complete();
  const turn = await app.evaluate(state);
  for (const [label, change, code] of [
    ["expired", (token) => {token.expires_at = "2000-01-01T00:00:00Z";}, "expired_token"],
    ["revision mismatch", (token) => {token.revision--;}, "invalid_input"],
    ["unsupported binding", (token) => {token.binding = "exploration";}, "invalid_input"],
    ["invalid expiry", (token) => {token.expires_at = "not-a-date";}, "invalid_input"],
  ]) {
    const selected = selection(state, turn);
    change(selected.token);
    const result = await app.confirm(selected);
    assert.equal(result.error.code, code, label);
    assert.equal(result.source_url, null, label);
  }
  assert.equal(app.confirms().length, 0);
});

test("confirmation rejects unsafe links and responses bound to a different recommendation", async (t) => {
  const app = await harness(t, {transform(pathname, data) {
    if (pathname === "/api/brief/confirm") data.source_url = "javascript:alert(1)";
    return data;
  }});
  const state = complete();
  const turn = await app.evaluate(state);
  const selected = selection(state, turn);
  const unsafe = await app.confirm(selected);
  assert.equal(unsafe.status, "error");
  assert.equal(unsafe.error.code, "invalid_payload");
  const valid = {request_id: selected.request_id, recommendation_request_id: selected.recommendation_request_id,
    revision: selected.revision, status: "linked", source_url: "https://chatgpt.com/", notice: "원본 안내", error: null};
  assert.equal(app.contract.validateConfirmation(valid, selected), valid);
  for (const url of ["javascript:alert(1)", "file:///private", "ftp://example.test/", "https://user:password@example.test/", "/relative"]) {
    assert.throws(() => app.contract.validateConfirmation({...valid, source_url: url}, selected), {code: "invalid_payload"}, url);
  }
  for (const changed of [{request_id: "old-confirm"}, {recommendation_request_id: "old-recommendation"}, {revision: selected.revision - 1}, {source_url: null}, {error: {code: "unavailable"}}]) {
    assert.throws(() => app.contract.validateConfirmation({...valid, ...changed}, selected), {code: "invalid_payload"});
  }
});
