const $ = (id) => document.getElementById(id);
const contract = window.ToolmeetConversationContract;
const adapter = window.ToolmeetConversation;
const state = {request: 0, revision: 0, submitted: false, answers: new Map(), facts: {}, drafts: new Map(),
  phase: "work", lifecycle: "idle", question: null, appliedTurn: null, turnId: null, confirmationId: null,
  briefToken: null, candidates: new Map(), boardPosts: [], boardTopic: "all", projectId: null, controller: null};
const statusLabels = {possible: "조건상 검토 가능", adapt: "환경 변경 필요", hold: "확인 전 보류", excluded: "입력 조건과 충돌"};
const fieldLabels = {outcome: "원하는 결과", policy: "외부 AI 사용", installation: "새 도구 설치", ecosystem: "업무 환경", data_kind: "시험 자료", hosting: "실행 위치", cost: "비용 조건"};
const values = {allowed: "가능", denied: "불가", google: "Google Workspace", microsoft: "Microsoft 365", other: "기타", public: "공개·합성 자료", internal: "회사 내부 자료", self_hosted: "자체 호스팅", cloud: "클라우드만 가능"};
const selectIds = {policy: "policy", installation: "installation", ecosystem: "ecosystem", data_kind: "data-kind", hosting: "hosting"};
function node(tag, className = "", value = "") { const item = document.createElement(tag); if (className) item.className = className; if (value) item.textContent = value; return item; }
function scrollToElement(target, block) { const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches; target.scrollIntoView({behavior: reduced ? "auto" : "smooth", block}); }
function nextId(prefix) { return prefix + "-" + ++state.request; }
function setPhase(phase) {
  state.phase = phase;
  for (const item of document.querySelectorAll("[data-phase]")) {
    if (item.dataset.phase === phase) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
  }
}
function invalidateResults(keepQuestion = false) {
  state.controller?.abort(); state.controller = null;
  state.turnId = nextId("invalidated"); state.confirmationId = null;
  state.briefToken = null; state.candidates.clear();
  $("results").hidden = true; $("related-list").replaceChildren(); $("candidate-list").replaceChildren(); $("supporting-methods").replaceChildren();
  if (!keepQuestion) {state.question = null; state.appliedTurn = null; $("conversation-question").replaceChildren();}
}
function changed() { state.revision++; invalidateResults(); state.facts = contract.factsFor({work: $("work").value.trim(), answers: [...state.answers.values()]}); state.lifecycle = "idle"; $("conversation").setAttribute("aria-busy", "false"); $("conversation-question").hidden = false; $("answer-editor").hidden = true; $("submit").disabled = false; $("retry-conversation").hidden = true; }
function syncConditions() {
  let didChange = false;
  for (const [field, id] of Object.entries(selectIds)) {
    const value = $(id).value;
    const old = state.answers.get(field);
    if (!value) {if (old) {state.answers.delete(field); didChange = true;} continue;}
    const answer = {id: "answer-" + field, question_id: old?.question_id ?? null, field, state: value === "unknown" ? "unknown" : "known", value: value === "unknown" ? null : value};
    if (old?.state !== answer.state || old?.value !== answer.value) {state.answers.set(field, answer); didChange = true;}
  }
  if (didChange) changed();
}
function currentSnapshot(requestId) {return {contract_version: contract.version, request_id: requestId, revision: state.revision, work: $("work").value.trim(), project_id: state.projectId, answers: [...state.answers.values()].map((a) => ({...a}))};}
function displayValue(a) {return a.state === "unknown" ? "모름 · 답변 완료, 조건 미확인" : (values[a.value] || a.value) + (a.detail ? " · " + a.detail : "");}
function renderHistory() {
  const list = $("conversation-answers"); list.replaceChildren();
  const combined = new Map(Object.entries(state.facts));
  for (const [field, answer] of state.answers) combined.set(field, answer);
  for (const [field, answer] of combined) {
    const row = node("li", "answer-row");
    const content = node("div"); content.append(node("strong", "", fieldLabels[field]), node("p", "", displayValue(answer)));
    if (!state.answers.has(field)) content.append(node("small", "", "업무 문장의 명시 표현 · mock 참고"));
    const edit = node("button", "inline-action", "수정"); edit.type = "button"; edit.dataset.editAnswer = field;
    edit.setAttribute("aria-label", fieldLabels[field] + " 답변 수정"); edit.addEventListener("click", () => openEditor(field, answer));
    row.append(content, edit); list.append(row);
  }
  $("answers-details").hidden = combined.size === 0;
}
function saveAnswer(field, stateValue, value, questionId = null, detail = "") {
  if (stateValue === "known" && !(contract.enums[field] ? contract.enums[field].includes(value) : typeof value === "string" && value.trim() && value.length <= 1000)) return;
  state.answers.set(field, {id: "answer-" + field, question_id: questionId, field, state: stateValue, value: stateValue === "unknown" ? null : value, ...(detail ? {detail} : {})});
  if (selectIds[field]) $(selectIds[field]).value = stateValue === "unknown" ? "unknown" : value;
  $("answer-editor").hidden = true; state.drafts.delete(field); changed(); renderHistory(); refresh(true);
}
function openEditor(field, answer) {
  const editor = $("answer-editor"); editor.replaceChildren(); editor.hidden = false; $("conversation-question").hidden = true;
  const heading = node("h3", "", fieldLabels[field] + " 수정"); editor.append(heading);
  const form = node("form", "answer-form");
  const label = node("label", "", fieldLabels[field]);
  const input = node(contract.enums[field] ? "select" : "textarea"); input.id = "edited-answer"; label.htmlFor = input.id;
  if (contract.enums[field]) for (const value of contract.enums[field]) {const option = node("option", "", values[value]); option.value = value; input.append(option);}
  else {input.rows = 3; input.maxLength = 1000; input.required = true;}
  input.value = answer.state === "known" ? answer.value : contract.enums[field]?.[0] || "";
  form.append(label, input);
  let detail;
  if (field === "ecosystem") {const l = node("label", "", "기타 도구 설명 (선택)"); detail = node("textarea"); detail.id = "edited-detail"; detail.maxLength = 1000; detail.value = state.answers.get(field)?.detail || ""; l.htmlFor = detail.id; form.append(l, detail);}
  const actions = node("div", "conversation-actions");
  const save = node("button", "answer-primary", "수정하고 다시 보기"); save.type = "submit";
  const unknown = node("button", "answer-secondary", "모름으로 변경"); unknown.type = "button"; unknown.addEventListener("click", () => saveAnswer(field, "unknown", null));
  const cancel = node("button", "answer-secondary", "취소"); cancel.type = "button"; cancel.addEventListener("click", () => {editor.hidden = true; $("conversation-question").hidden = false;});
  actions.append(save, unknown, cancel);
  if (state.answers.has(field)) {
    const remove = node("button", "answer-secondary", "답변 지우기"); remove.type = "button";
    remove.addEventListener("click", () => {state.answers.delete(field); if (selectIds[field]) $(selectIds[field]).value = ""; editor.hidden = true; changed(); renderHistory(); refresh(true);}); actions.append(remove);
  }
  form.append(actions); form.addEventListener("submit", (event) => {event.preventDefault(); saveAnswer(field, "known", input.value.trim(), null, detail?.value.trim() || "");}); editor.append(form); input.focus();
}
function renderQuestion(data) {
  const q = data.question;
  const revision = state.revision, turn = data.request_id;
  const current = () => state.revision === revision && state.appliedTurn === turn && state.question?.id === q.id && state.lifecycle !== "waiting";
  const container = $("conversation-question"); container.replaceChildren(); container.hidden = false;
  const heading = node("h3", "", q.prompt); heading.id = "conversation-prompt"; heading.tabIndex = -1; container.append(heading);
  const answer = (value, detail = "") => {if (current()) saveAnswer(q.field, "known", value, q.id, detail);};
  if (q.type === "choice") {
    const options = node("div", "conversation-actions");
    for (const o of q.options) {const button = node("button", "answer-option", o.label); button.type = "button"; button.dataset.answerValue = o.value; button.addEventListener("click", () => answer(o.value)); options.append(button);}
    container.append(options);
  } else {
    const form = node("form", "answer-form"); const draft = state.drafts.get(q.field) || {value: q.options[0]?.value || "", text: ""};
    let select;
    if (q.type === "choice_with_text") {
      const label = node("label", "", "답변 선택");
      select = node("select"); select.id = "answer-choice"; label.htmlFor = select.id;
      for (const o of q.options) {const option = node("option", "", o.label); option.value = o.value; select.append(option);}
      select.value = draft.value; select.addEventListener("change", () => {draft.value = select.value; state.drafts.set(q.field, draft);}); form.append(label, select);
    }
    const label = node("label", "", q.type === "text" ? fieldLabels[q.field] + " 설명" : q.field === "ecosystem" ? "기타 도구 설명" : "직접 입력 (선택)");
    const input = node("textarea"); input.id = "answer-text"; input.rows = 3; input.maxLength = 1000; input.required = q.type === "text"; label.htmlFor = input.id; input.value = draft.text;
    input.addEventListener("input", () => {draft.text = input.value; state.drafts.set(q.field, draft);});
    const submit = node("button", "answer-primary", "답변 보내기"); submit.type = "submit";
    form.append(label, input, submit); form.addEventListener("submit", (event) => {event.preventDefault(); if (!current()) return; const value = input.value.trim();
      if (q.type === "text") {if (value) answer(value);} else if (!contract.enums[q.field]) answer(value || select.value);
      else if (select.value !== "other" || value) answer(select.value, select.value === "other" ? value : ""); else {input.setCustomValidity("기타 도구를 설명하거나 모름을 선택해 주세요."); input.reportValidity();}
    }); input.addEventListener("input", () => input.setCustomValidity("")); container.append(form);
  }
  if (q.allow_unknown) {const unknown = node("button", "answer-secondary unknown-answer", "모름 · 확인이 필요해요"); unknown.type = "button"; unknown.addEventListener("click", () => {if (current()) saveAnswer(q.field, "unknown", null, q.id);}); container.append(unknown);}
  container.append(node("p", "conversation-hint", "모름은 답변 완료로 기록합니다. 사용 허용으로 판단하지 않습니다."));
}
function candidateJump(id) { const target = $("candidate-" + id); if (!target) return; scrollToElement(target, "center"); target.classList.add("focused"); setTimeout(() => target.classList.remove("focused"), 1800); }
function renderCandidate(item) {
  const revision = state.revision, turn = state.appliedTurn, token = state.briefToken;
  const isCurrent = () => revision === state.revision && turn === state.appliedTurn && turn === state.turnId && token === state.briefToken;
  const card = node("article", "candidate"); card.id = "candidate-" + item.id;
  const top = node("div", "candidate-top"), heading = node("div");
  heading.append(node("span", "kind", item.kind), node("h3", "", item.name), node("p", "candidate-summary", item.summary));
  top.append(heading, node("span", "fit-pill " + item.status, statusLabels[item.status])); card.append(top);
  const grid = node("div", "reason-grid");
  const reason = node("div"); reason.append(node("b", "", "왜 추천했나요?"), node("p", "", item.reasons.join(" ")));
  const fit = node("div"); fit.append(node("b", "", "현재 환경에서 쓸 수 있나요?"), node("p", "", item.fit_reason)); grid.append(reason, fit); card.append(grid);
  const first = node("div", "first-check"); first.append(node("b", "", "첫 사용에서 확인할 것"), node("p", "", item.first_gate + " " + item.first_check)); card.append(first);
  card.append(node("p", "source-status", "근거 상태: " + item.source_status + " · 추천/판정은 mock · 비용·지원 범위 미검증"));
  const actions = node("div", "candidate-actions"), preview = node("button", "preview-button", "활용 방법 미리보기 →"); preview.type = "button"; preview.setAttribute("aria-expanded", "false"); actions.append(preview); card.append(actions);
  const panel = node("div", "preview-panel"); panel.hidden = true; panel.append(node("h4", "", "이 후보를 쓰는 가정된 흐름"));
  const steps = node("ol"); item.method.forEach((step) => steps.append(node("li", "", step))); panel.append(steps, node("p", "", "실제 자료를 처리하거나 도구를 연결한 결과가 아닙니다. 방향이 맞는지 확인한 뒤 원본을 살펴보세요."));
  if (item.status === "hold" || item.status === "excluded") panel.append(node("p", "hold-note", "연결 보류 · " + item.fit_reason + " " + item.first_gate));
  else if (contract.validToken(token, revision) && (token.expires_at === null || Date.parse(token.expires_at) > Date.now())) {
    const confirm = node("button", "confirm-button", "방향 확인 · 원본 안내 보기"); confirm.type = "button";
    const feedback = node("div", "confirm-feedback"); feedback.setAttribute("role", "status");
    confirm.addEventListener("click", async () => {
      if (!isCurrent()) return;
      const requestId = nextId("confirm"); state.confirmationId = requestId;
      const current = () => isCurrent() && state.confirmationId === requestId;
      const selection = {request_id: requestId, revision, recommendation_request_id: turn, candidate_id: item.id, token, confirmed: true};
      document.querySelectorAll(".confirm-button").forEach((b) => {b.disabled = true;}); feedback.textContent = "원본 안내를 확인하는 중입니다.";
      try {
        if (token.expires_at !== null && Date.parse(token.expires_at) <= Date.now()) throw new Error("추천이 만료되었습니다. 현재 조건으로 다시 보기 버튼을 눌러 주세요.");
        const raw = await adapter.confirm(selection);
        if (!current()) return;
        const data = contract.validateConfirmation(raw, selection);
        if (data.status === "error") throw new Error(data.error.message);
        feedback.replaceChildren();
        if (data.status === "needs_confirmation") {feedback.append(node("p", "hold-note", data.notice)); return;}
        confirm.remove(); feedback.append(node("p", "", "원본 링크 안내 단계입니다. 설치·계정 연결·자료 전송·첫 시험 완료가 아닙니다."));
        const link = node("a", "source-link", "원본 서비스·프로젝트 열기 ↗"); link.href = data.source_url; link.target = "_blank"; link.rel = "noopener noreferrer"; feedback.append(link);
        if (!$("ask-panel")?.hidden) link.focus({preventScroll: true});
      } catch (error) {if (current()) feedback.textContent = error.message;}
      finally {if (current()) document.querySelectorAll(".confirm-button").forEach((b) => {b.disabled = false;});}
    }); panel.append(confirm, feedback);
  } else panel.append(node("p", "hold-note", "유효한 최신 추천 토큰이 없습니다. 현재 조건으로 다시 평가해 주세요."));
  preview.addEventListener("click", () => {panel.hidden = !panel.hidden; preview.setAttribute("aria-expanded", String(!panel.hidden)); preview.textContent = panel.hidden ? "활용 방법 미리보기 →" : "활용 방법 닫기 ↑";}); card.append(panel); return card;
}
function render(data, catalog) {
  const editing = !$("answer-editor").hidden;
  state.facts = data.facts; state.question = data.question; state.appliedTurn = data.request_id;
  setPhase(data.phase); renderHistory(); $("conversation-question").hidden = editing;
  $("status").hidden = false; $("status").textContent = "mock · " + data.notice;
  $("conversation-note").textContent = data.data_note;
  if (data.status === "question") {renderQuestion(data); $("conversation-question").hidden = editing; return editing ? null : $("conversation-prompt");}
  $("conversation-question").replaceChildren();
  if (data.status === "error") {$("status").textContent = data.error.message + " · " + data.notice; $("retry-conversation").hidden = false; return null;}
  state.briefToken = data.recommendations.token;
  const projects = new Map(catalog.projects.map((p) => [p.id, p]));
  const kinds = {service: "AI 서비스", public_project: "공개 프로젝트"};
  const decorated = data.recommendations.candidates.map((c) => {const p = projects.get(c.id); return {...c, name: p.name, kind: kinds[p.kind], summary: p.summary, method: p.method.map((v) => v.text), source_status: p.evidence.map((v) => v.claim).join(" · ")};});
  state.candidates = new Map(decorated.map((c) => [c.id, c]));
  $("asked-question").textContent = $("work").value.trim();
  $("topic-description").textContent = data.context ? "현재 업무를 ‘" + data.context.topic_label + "’로 임시 분류했습니다. " + data.context.classification_note : data.notice;
  renderNews($("related-list"), data.context?.related_news || []);
  decorated.forEach((c) => $("candidate-list").append(renderCandidate(c)));
  if (data.status === "empty") $("candidate-list").append(node("p", "empty-result", "외부 서비스·공개 프로젝트 후보 없음 · 업무나 조건을 수정해 다시 살펴보세요."));
  for (const id of data.recommendations.supporting_methods) {
    const p = projects.get(id), block = node("aside", "supporting-method"); block.append(node("h4", "", "업무 준비 방법 · " + p.name), node("p", "", "외부 프로젝트 추천이나 도구 연결 완료가 아닙니다."));
    const steps = node("ol"); p.method.forEach((v) => steps.append(node("li", "", v.text))); block.append(steps); $("supporting-methods").append(block);
  }
  $("results").hidden = false; return editing ? null : $("asked-question");
}
async function refresh(scrollToAnswer = false) {
  document.dispatchEvent(new Event("toolmeet:focus-question")); syncConditions(); invalidateResults(true);
  if ($("work").value.trim().length < 8 || $("work").value.trim().length > 1000) {
    state.submitted = false; state.lifecycle = "idle"; $("status").hidden = false; $("status").textContent = "업무를 8~1000자로 적어 주세요."; $("submit").disabled = false; return;
  }
  const requestId = nextId("turn"), s = currentSnapshot(requestId); state.turnId = requestId;
  const current = () => state.turnId === requestId && state.revision === s.revision;
  state.submitted = true; state.lifecycle = "waiting"; state.controller = new AbortController();
  $("conversation").hidden = false; $("conversation").setAttribute("aria-busy", "true"); $("submit").disabled = true; $("retry-conversation").hidden = true;
  $("status").hidden = false; $("status").textContent = "현재 업무와 답변으로 mock 대화를 평가하는 중입니다.";
  try {
    const raw = await adapter.evaluate(s, {signal: state.controller.signal}); if (!current()) return;
    const catalog = ["ready", "needs_confirmation", "empty"].includes(raw?.status) ? await window.ToolmeetCatalog.list() : {projects: []}; if (!current()) return;
    const data = contract.validateTurn(raw, s, catalog);
    state.lifecycle = data.status === "error" ? "error" : "settled";
    // An error must keep the applied question and draft usable.
    const focusTarget = data.status === "error" ? null : render(data, catalog);
    if (data.status === "error") {state.facts = data.facts; renderHistory(); $("status").textContent = data.error.message + " · 입력과 답변은 유지됩니다."; $("retry-conversation").hidden = false;}
    if (scrollToAnswer && focusTarget && !$("ask-panel")?.hidden) {focusTarget.focus({preventScroll: true}); scrollToElement(focusTarget, "start");}
  } catch (error) {if (!current()) return; state.lifecycle = "error"; $("status").textContent = error.message; $("retry-conversation").hidden = false;}
  finally {if (current()) {$("submit").disabled = false; $("conversation").setAttribute("aria-busy", "false");}}
}

function renderNews(container, news) {
  container.replaceChildren();
  if (!news.length) {
    container.append(node("p", "status", "현재 저장된 시연용 소식에서 일치하는 업무 분야를 찾지 못했습니다. 업무와 원하는 결과를 더 구체적으로 적어 주세요."));
    return;
  }
  news.forEach((item) => {
    const card = node("article", "news-card");
    card.append(node("span", "news-meta", item.topic + " · 시연용 가상 소식"));
    card.append(node("h3", "", item.title));
    card.append(node("p", "", item.summary));
    card.append(node("p", "news-angle", "활용 방향: " + item.angle));
    card.append(node("p", "", item.context));
    const links = node("div", "news-links");
    links.append(node("span", "", "연결 후보"));
    if (!item.candidate_ids.length) links.append(node("span", "", "현재 조건에서 표시할 후보 없음"));
    item.candidate_ids.forEach((id) => {
      const candidate = state.candidates.get(id);
      const button = node("button", "", candidate?.name || id);
      button.type = "button";
      button.addEventListener("click", () => candidateJump(id));
      links.append(button);
    });
    card.append(links);
    container.append(card);
  });
}


function renderBoard() {
  const list = $("board-list");
  list.replaceChildren();
  const visible = state.boardPosts.filter((item) => state.boardTopic === "all" || item.topic === state.boardTopic);
  visible.forEach((item) => {
    const card = node("article", "board-post");
    const meta = node("div", "board-post-meta");
    meta.append(node("span", "board-topic", item.topic_label), node("span", "", "시연용 예시 질문"));
    card.append(meta, node("h3", "", item.title), node("p", "", item.summary));
    const open = node("button", "board-open", "이 질문으로 답변 보기 →");
    open.type = "button";
    open.addEventListener("click", () => {
      startWork(item.work);
    });
    card.append(open);
    list.append(card);
  });
}

async function loadBoard() {
  try {
    const response = await fetch("/api/board");
    const data = await response.json();
    if (!response.ok || data.data_mode !== "mock") throw new Error("예시 질문을 불러오지 못했습니다.");
    state.boardPosts = data.posts;
    renderBoard();
  } catch (error) {
    $("board-list").append(node("p", "status", error.message));
  }
}


$("brief-form").addEventListener("submit", (event) => {event.preventDefault(); refresh(true);});
function startWork(work) {$("work").value = work; changed(); state.submitted = false; refresh(true);}
document.querySelectorAll("[data-work]").forEach((item) => item.addEventListener("click", () => startWork(item.dataset.work)));
document.querySelectorAll(".fields select").forEach((item) => item.addEventListener("change", () => {
  syncConditions(); renderHistory(); if (state.submitted) refresh();
}));
$("work").addEventListener("input", () => {state.submitted = false; changed(); $("status").hidden = true; renderHistory();});
$("edit-environment").addEventListener("click", () => {$("environment-details").open = true; scrollToElement($("environment-details"), "center");});
$("retry-conversation").addEventListener("click", () => refresh(true));
$("reevaluate-conversation").addEventListener("click", () => refresh(true));
document.querySelectorAll("[data-board-topic]").forEach((item) => item.addEventListener("click", () => {
  state.boardTopic = item.dataset.boardTopic;
  document.querySelectorAll("[data-board-topic]").forEach((button) => button.classList.toggle("selected", button === item)); renderBoard();
}));
document.addEventListener("toolmeet:project-context", (event) => {
  const id = event.detail?.project_id ?? null; if (id === state.projectId) return;
  state.projectId = id; changed(); if (state.submitted) refresh();
});
document.addEventListener("toolmeet:new-question", () => {
  changed(); state.submitted = false; state.answers.clear(); state.facts = {}; state.drafts.clear(); state.projectId = null;
  $("brief-form").reset(); $("environment-details").open = false; $("question-examples").open = false;
  $("asked-question").textContent = ""; $("topic-description").textContent = "";
  $("status").hidden = true; $("status").textContent = ""; $("conversation").hidden = true;
  $("answer-editor").hidden = true; $("answers-details").open = false; renderHistory(); setPhase("work");
});
loadBoard();
const linkedWork = new URLSearchParams(window.location.search).get("work");
if (linkedWork) {$("work").value = linkedWork.slice(0, 1000); $("work").focus(); changed(); refresh(true);}
