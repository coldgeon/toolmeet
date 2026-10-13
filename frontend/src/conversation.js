/* exploration.v1 mock conversation + existing brief HTTP compatibility.
 * Closed example phrases and stored candidate requirements are not AI understanding.
 * Client revisions do not revoke backend brief tokens.
 */
(() => {
  const version = "exploration.v1";
  const enums = {policy: ["allowed", "denied"], installation: ["allowed", "denied"],
    ecosystem: ["google", "microsoft", "other"], data_kind: ["public", "internal"], hosting: ["self_hosted", "cloud"]};
  const fields = [...Object.keys(enums), "outcome", "cost"];
  const phases = ["work", "environment", "recommendation"];
  const statuses = ["question", "ready", "needs_confirmation", "empty", "error"];
  const note = "시연용 mock 대화 · 명시된 예시 표현과 기존 후보 조건만 사용합니다. 실제 AI 이해·질문 생성·기업 적합성 검증은 연결되지 않았습니다.";
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  const strings = (value) => Array.isArray(value) && value.every(text);
  const own = (value, key) => Object.hasOwn(value, key);
  function fail(message, code = "invalid_payload") { const e = new Error(message); e.code = code; throw e; }
  function validValue(field, state, value) {
    return fields.includes(field) && (state === "unknown" ? value === null :
      state === "known" && (enums[field] ? enums[field].includes(value) : text(value) && value.length <= 1000));
  }
  function validateSnapshot(s) {
    if (!s || s.contract_version !== version || !text(s.request_id) || !Number.isInteger(s.revision) || s.revision < 0 ||
        !text(s.work) || s.work.trim().length < 8 || s.work.trim().length > 1000 ||
        !(s.project_id === null || text(s.project_id)) || !Array.isArray(s.answers)) fail("대화 입력 형식을 확인해 주세요.", "invalid_input");
    const ids = new Set(), used = new Set();
    for (const a of s.answers) {
      if (!a || !text(a.id) || !(a.question_id === null || text(a.question_id)) || !validValue(a.field, a.state, a.value) ||
          ids.has(a.id) || used.has(a.field) || (own(a, "detail") && (typeof a.detail !== "string" || a.detail.length > 1000))) fail("답변의 값이나 중복을 확인해 주세요.", "invalid_input");
      ids.add(a.id); used.add(a.field);
    }
    return s;
  }
  function errorDto(s, error, phase = "work") {
    const codes = ["invalid_input", "invalid_payload", "unavailable", "expired_token", "not_found"];
    const code = codes.includes(error.code) ? error.code : "unavailable";
    return {...base(s, phase), status: "error", notice: "입력과 답변은 유지됩니다. 현재 조건으로 다시 시도해 주세요.",
      error: {code, message: error.message || "시연 결과를 가져오지 못했습니다.", retryable: code === "unavailable", field_errors: []}};
  }
  function base(s, phase) {
    return {contract_version: version, request_id: s.request_id, revision: s.revision, data_mode: "mock", data_note: note,
      phase, status: "question", facts: {}, question: null, recommendations: null, notice: "", error: null};
  }
  const phrases = {
    policy: [["외부 AI 사용 불가", "denied"], ["외부 AI 사용 금지", "denied"], ["외부 AI 사용 가능", "allowed"]],
    installation: [["새 도구 설치 불가", "denied"], ["새 도구 설치 가능", "allowed"]],
    ecosystem: [["Google Workspace", "google"], ["구글 문서", "google"], ["구글 시트", "google"], ["Microsoft 365", "microsoft"]],
    data_kind: [["회사 내부 자료", "internal"], ["공개·합성 자료", "public"], ["공개 자료", "public"], ["합성 자료", "public"]],
    hosting: [["자체 호스팅 사용 가능", "self_hosted"], ["클라우드만 사용 가능", "cloud"]],
  };
  function factsFor(s) {
    const facts = {};
    for (const [field, options] of Object.entries(phrases)) {
      // Entire clause matches only: negated or ambiguous statements stay unconfirmed.
      const clauses = s.work.split(/[.,;!?。\n]/).map((v) => v.trim());
      const matches = options.filter(([phrase]) => clauses.includes(phrase));
      if (matches.length && new Set(matches.map((v) => v[1])).size === 1) {
        facts[field] = {state: "known", value: matches[0][1], origin: "work", reference: matches[0][0]};
      }
    }
    const outcomeClauses = s.work.split(/[.!?。\n]/).filter((clause) => !/(모르|모름|않|아니|싫|원하지|싶지)/.test(clause));
    const outcome = ["결정과 할 일", "할 일을 뽑아", "요약 보고서", "출처가 있는 요약", "양식 초안을 채워", "PDF로 만들", "코드 오류", "시트에 정리"].find((phrase) => outcomeClauses.some((clause) => clause.includes(phrase)));
    if (outcome) facts.outcome = {state: "known", value: outcome, origin: "work", reference: outcome};
    for (const a of s.answers) facts[a.field] = {state: a.state, value: a.value, origin: "answer", reference: a.id};
    return facts;
  }
  function withConflictNotice(result, s) {
    const inferred = factsFor({...s, answers: []});
    if (s.answers.some((a) => inferred[a.field] && (inferred[a.field].state !== a.state || inferred[a.field].value !== a.value))) {
      result.notice += " 직접 답한 조건을 우선 적용했습니다. 업무 문장의 이전 조건과 다르므로 담당자에게 실제 조건을 확인해 주세요.";
    }
    return result;
  }
  const questions = {
    outcome: {prompt: "이 업무에서 어떤 결과를 얻고 싶나요?", type: "text", options: [], allow_text: true},
    policy: {prompt: "이 업무에 외부 AI를 사용할 수 있나요?", type: "choice", options: [{value: "allowed", label: "사용 가능"}, {value: "denied", label: "사용 불가"}], allow_text: false},
    data_kind: {prompt: "첫 시험에 어떤 자료를 사용할 예정인가요?", type: "choice", options: [{value: "public", label: "공개·합성 자료"}, {value: "internal", label: "회사 내부 자료"}], allow_text: false},
    ecosystem: {prompt: "현재 사용하는 업무 도구는 무엇인가요?", type: "choice_with_text", options: [{value: "google", label: "Google Workspace"}, {value: "microsoft", label: "Microsoft 365"}, {value: "other", label: "기타 · 직접 설명"}], allow_text: true},
    installation: {prompt: "새 도구를 설치할 수 있나요?", type: "choice", options: [{value: "allowed", label: "설치 가능"}, {value: "denied", label: "설치 불가"}], allow_text: false},
    hosting: {prompt: "이 후보의 자체 호스팅 환경을 사용할 수 있나요?", type: "choice", options: [{value: "self_hosted", label: "자체 호스팅 사용 가능"}, {value: "cloud", label: "클라우드만 가능"}], allow_text: false},
  };
  function question(s, facts, field) {
    return {...base(s, field === "outcome" ? "work" : "environment"), facts,
      question: {id: "q-" + s.revision + "-" + field, field, ...questions[field], allow_unknown: true},
      notice: "후보를 살펴보는 데 필요한 미확인 조건을 하나씩 확인합니다. 모르면 답변 완료로 기록하고 연결 판단은 보류합니다."};
  }
  async function post(path, body, signal) {
    const response = await fetch(path, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body), signal});
    let data;
    try { data = await response.json(); } catch { fail("시연 응답이 JSON 형식이 아닙니다."); }
    if (!response.ok) { const e = new Error(text(data?.error) ? data.error : "결과를 가져오지 못했습니다."); e.code = "unavailable"; throw e; }
    return data;
  }
  function legacyProfile(s, facts) {
    let work = s.work.trim();
    // The legacy endpoint has no outcome field. An explicit result description is appended as input, without AI interpretation.
    const outcome = s.answers.find((a) => a.field === "outcome" && a.state === "known");
    if (outcome) work = (work + " / 원하는 결과: " + outcome.value).slice(0, 1000);
    return {work, ...Object.fromEntries(Object.keys(enums).map((field) => [field, facts[field]?.state === "known" ? facts[field].value : "unknown"]))};
  }
  function required(project) {
    const r = project.requirements;
    return [r.external_ai.value && "policy", r.external_ai.value && "data_kind", r.installation.value && "installation",
      r.hosting.value === "self_hosted" && "hosting", !r.ecosystems.value.includes("any") && "ecosystem"].filter(Boolean);
  }
  function normalizeBrief(data, s, facts, catalog) {
    if (!data || data.data_mode !== "mock" || !text(data.data_note) || !Array.isArray(data.candidates) || !Array.isArray(data.related_news) ||
        !text(data.topic_label) || !text(data.classification_note) || !text(data.brief_token) || !text(data.stage)) fail("기존 mock 응답의 필수 정보가 누락되었습니다.");
    const projects = new Map(catalog.projects.map((p) => [p.id, p]));
    const ids = new Set();
    const candidates = [], supporting_methods = [];
    for (const c of data.candidates) {
      const project = projects.get(c?.id);
      if (!project || ids.has(c.id) || !["possible", "adapt", "hold", "excluded"].includes(c.status) || !strings(c.reasons) ||
          ![c.fit_reason, c.first_gate, c.first_check].every(text) || own(c, "source_url")) fail("시연 후보 ID나 판정 응답을 확인해 주세요.");
      ids.add(c.id);
      if (project.kind === "internal_method") supporting_methods.push(c.id);
      else candidates.push({id: c.id, status: c.status, reasons: c.reasons, fit_reason: c.fit_reason, first_gate: c.first_gate, first_check: c.first_check});
    }
    for (const n of data.related_news) {
      if (!n || ![n.id, n.title, n.summary, n.topic, n.angle, n.context].every(text) || !strings(n.candidate_ids) || n.candidate_ids.some((id) => !ids.has(id))) fail("관련 소식 응답 형식을 확인해 주세요.");
    }
    if (facts.outcome?.state === "unknown") for (const c of candidates) {
      if (["possible", "adapt"].includes(c.status)) {
        c.status = "hold"; c.fit_reason = "원하는 결과가 모름이므로 추천 방향 판단을 보류합니다.";
        c.first_gate = "원하는 출력과 검토 기준을 정한 뒤 결과 답변을 수정하세요."; c.first_check = "확인 전에는 원본 연결이나 시험을 진행하지 않습니다.";
      }
    }
    const status = candidates.some((c) => ["possible", "adapt"].includes(c.status)) ? "ready" : candidates.some((c) => c.status === "hold") ? "needs_confirmation" : "empty";
    const result = {...base(s, "recommendation"), facts, status,
      recommendations: {candidates: status === "empty" ? [] : candidates, supporting_methods,
        token: status === "empty" || facts.outcome?.state === "unknown" ? null : {value: data.brief_token, binding: "brief", revision: s.revision, expires_at: null}},
      notice: status === "empty" ? "외부 서비스·공개 프로젝트 후보가 없습니다. " +
        (candidates.length ? [...new Set(candidates.map((c) => c.fit_reason))].join(" ") + " " : "") + "업무 설명이나 조건을 수정해 다시 살펴보세요. " + data.stage :
        status === "needs_confirmation" ? "조건 확인 필요 · " + (facts.outcome?.state === "unknown" ? "원하는 결과와 검토 기준을 정하고 답변을 수정하세요. " : "담당자에게 정책·자료 전송·설치·계정 조건을 확인하고 답변을 수정하세요. ") + data.stage : data.stage,
      context: {topic_label: data.topic_label, classification_note: data.classification_note, related_news: status === "empty" ? [] : data.related_news}};
    return result;
  }
  async function evaluate(snapshot, {signal} = {}) {
    const s = JSON.parse(JSON.stringify(snapshot));
    let facts = {};
    try {
      validateSnapshot(s); facts = factsFor(s);
      if (s.project_id !== null && !(await window.ToolmeetCatalog.list()).projects.some((p) => p.id === s.project_id)) fail("현재 카탈로그에 해당 프로젝트가 없습니다.", "not_found");
      if (!facts.outcome) return withConflictNotice(question(s, facts, "outcome"), s);
      const dataPromise = post("/api/brief", legacyProfile(s, facts), signal);
      const [data, catalog] = await Promise.all([dataPromise, window.ToolmeetCatalog.list()]);
      if (s.project_id !== null && !catalog.projects.some((p) => p.id === s.project_id)) fail("현재 카탈로그에 해당 프로젝트가 없습니다.", "not_found");
      const result = normalizeBrief(data, s, facts, catalog);
      if (result.status === "needs_confirmation" && facts.outcome?.state !== "unknown") {
        const projects = new Map(catalog.projects.map((p) => [p.id, p]));
        const viable = result.recommendations.candidates.filter((c) => c.status === "hold").map((c) => projects.get(c.id));
        // A candidate blocked by an explicitly unknown prerequisite cannot be unlocked by asking other fields.
        const unblocked = viable.filter((p) => !required(p).some((field) => facts[field]?.state === "unknown") &&
          !(p.requirements.external_ai.value && facts.data_kind?.value === "internal") &&
          !(!p.requirements.ecosystems.value.includes("any") && facts.ecosystem?.value === "other"));
        const missing = ["policy", "data_kind", "installation", "hosting", "ecosystem"].find((field) =>
          !facts[field] && unblocked.some((p) => required(p).includes(field)));
        if (missing) return withConflictNotice(question(s, facts, missing), s);
      }
      return withConflictNotice(result, s);
    } catch (error) { return {...errorDto(s, error, facts.outcome ? "environment" : "work"), facts}; }
  }
  function validateError(error) {
    return error && ["invalid_input", "invalid_payload", "unavailable", "expired_token", "not_found"].includes(error.code) &&
      text(error.message) && typeof error.retryable === "boolean" && Array.isArray(error.field_errors) &&
      error.field_errors.every((f) => f && text(f.field) && text(f.message));
  }
  function validToken(token, revision) {
    return token && text(token.value) && ["brief", "exploration"].includes(token.binding) && token.revision === revision &&
      (token.expires_at === null || typeof token.expires_at === "string" && Number.isFinite(Date.parse(token.expires_at)));
  }
  function validateTurn(data, s, catalog) {
    if (!data || data.contract_version !== version || data.request_id !== s.request_id || data.revision !== s.revision ||
        data.data_mode !== "mock" || !text(data.data_note) || !phases.includes(data.phase) || !statuses.includes(data.status) ||
        !data.facts || typeof data.facts !== "object" || Array.isArray(data.facts) || typeof data.notice !== "string" ||
        !own(data, "question") || !own(data, "recommendations") || !own(data, "error")) fail("대화 응답의 버전·요청·필수 정보를 확인해 주세요.");
    for (const [field, f] of Object.entries(data.facts)) {
      const a = s.answers.find((v) => v.field === field);
      if (!f || !validValue(field, f.state, f.value) || !["work", "answer"].includes(f.origin) || !text(f.reference) ||
          (f.origin === "work" && !s.work.includes(f.reference)) ||
          (f.origin === "answer" && (!a || a.id !== f.reference || a.state !== f.state || a.value !== f.value)) ||
          (a && (f.origin !== "answer" || a.state !== f.state || a.value !== f.value))) fail("알려진 조건의 근거가 현재 답변과 일치하지 않습니다.");
    }
    for (const a of s.answers) if (!data.facts[a.field]) fail("현재 답변의 조건 근거가 누락되었습니다.");
    if (data.status === "question") {
      const q = data.question;
      if (!q || !text(q.id) || !fields.includes(q.field) || !text(q.prompt) || !["choice", "text", "choice_with_text"].includes(q.type) ||
          typeof q.allow_unknown !== "boolean" || typeof q.allow_text !== "boolean" || !Array.isArray(q.options) ||
          q.options.some((o) => !o || !text(o.label) || !validValue(q.field, "known", o.value)) ||
          new Set(q.options.map((o) => o.value)).size !== q.options.length ||
          (q.type === "choice" && (q.allow_text || !q.options.length)) || (q.type === "text" && (!q.allow_text || q.options.length)) ||
          (q.type === "choice_with_text" && (!q.allow_text || !q.options.length)) || data.facts[q.field] || s.answers.some((a) => a.field === q.field) ||
          data.recommendations !== null || data.error !== null || data.phase !== (q.field === "outcome" ? "work" : "environment")) fail("추가 질문의 형식이나 이미 답한 조건을 확인해 주세요.");
    } else if (data.question !== null) fail("현재 상태에 추가 질문이 있으면 안 됩니다.");
    if (data.status === "error") {
      if (!validateError(data.error) || data.recommendations !== null) fail("오류 응답의 형식이 올바르지 않습니다.");
    } else if (data.error !== null) fail("정상 응답에 오류 값이 있습니다.");
    if (["ready", "needs_confirmation", "empty"].includes(data.status)) {
      const r = data.recommendations, map = new Map(catalog.projects.map((p) => [p.id, p]));
      if (data.phase !== "recommendation" || !r || !Array.isArray(r.candidates) || !strings(r.supporting_methods) ||
          new Set(r.supporting_methods).size !== r.supporting_methods.length ||
          r.supporting_methods.some((id) => map.get(id)?.kind !== "internal_method") ||
          new Set(r.candidates.map((c) => c?.id)).size !== r.candidates.length ||
          r.candidates.some((c) => !c || !map.has(c.id) || map.get(c.id).kind === "internal_method" ||
            !["possible", "adapt", "hold", "excluded"].includes(c.status) || !strings(c.reasons) || !c.reasons.length ||
            ![c.fit_reason, c.first_gate, c.first_check].every(text) || own(c, "source_url"))) fail("추천 후보의 형식이나 카탈로그 ID를 확인해 주세요.");
      if (data.status === "empty" ? r.candidates.length !== 0 || r.token !== null :
          !(data.status === "needs_confirmation" && r.token === null) && !validToken(r.token, s.revision)) fail("추천 토큰과 현재 상태가 일치하지 않습니다.");
      const possible = r.candidates.some((c) => ["possible", "adapt"].includes(c.status));
      if (data.status === "ready" && !possible || data.status === "needs_confirmation" && (possible || !r.candidates.some((c) => c.status === "hold"))) fail("추천 완료와 조건 확인 필요 상태를 확인해 주세요.");
    } else if (data.recommendations !== null) fail("현재 상태에 추천 결과가 있으면 안 됩니다.");
    if (data.context !== undefined) {
      const c = data.context;
      const ids = new Set([...(data.recommendations?.candidates.map((v) => v.id) || []), ...(data.recommendations?.supporting_methods || [])]);
      if (!c || !text(c.topic_label) || !text(c.classification_note) || !Array.isArray(c.related_news) || c.related_news.some((n) =>
        !n || ![n.id, n.title, n.summary, n.topic, n.angle, n.context].every(text) || !strings(n.candidate_ids) || n.candidate_ids.some((id) => !ids.has(id)))) fail("대화 맥락의 소식 형식을 확인해 주세요.");
    }
    return data;
  }
  function safeUrl(value) {
    if (!text(value)) return false;
    try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  }
  async function confirm(selection, {signal} = {}) {
    const s = JSON.parse(JSON.stringify(selection));
    const base = {request_id: s.request_id, revision: s.revision, recommendation_request_id: s.recommendation_request_id, status: "error", source_url: null, notice: "", error: null};
    try {
      if (!text(s.request_id) || !text(s.recommendation_request_id) || !text(s.candidate_id) || !Number.isInteger(s.revision) || s.revision < 0 ||
          s.confirmed !== true || !validToken(s.token, s.revision) || s.token.binding !== "brief") fail("현재 추천을 다시 확인해 주세요.", "invalid_input");
      if (s.token.expires_at !== null && Date.parse(s.token.expires_at) <= Date.now()) fail("추천 토큰이 만료되었습니다. 현재 조건으로 다시 평가하세요.", "expired_token");
      const data = await post("/api/brief/confirm", {brief_token: s.token.value, candidate_id: s.candidate_id, confirmed: true}, signal);
      if (!safeUrl(data.source_url)) fail("원본 링크 응답 형식이 올바르지 않습니다.");
      return {...base, status: "linked", source_url: data.source_url, notice: "원본 링크 안내 · 설치·계정 연결·자료 전송·첫 시험 전"};
    } catch (error) { return {...base, error: errorDto(s, error).error}; }
  }
  function validateConfirmation(data, selection) {
    if (!data || data.request_id !== selection.request_id || data.revision !== selection.revision ||
        data.recommendation_request_id !== selection.recommendation_request_id || !["linked", "needs_confirmation", "error"].includes(data.status) ||
        typeof data.notice !== "string" || (data.status === "linked" ? !safeUrl(data.source_url) || data.error !== null : data.source_url !== null ||
          (data.status === "error" ? !validateError(data.error) : data.error !== null))) fail("원본 안내 응답이 현재 추천과 일치하지 않습니다.");
    return data;
  }
  window.ToolmeetConversationContract = Object.freeze({version, fields, enums, validateSnapshot, validateTurn, validateConfirmation, validToken, normalizeBrief, errorDto, factsFor, legacyProfile});
  window.ToolmeetConversation = Object.freeze({evaluate, confirm});
})();
