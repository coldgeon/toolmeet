const $ = (id) => document.getElementById(id);
const state = { generation: 0, discoveryToken: null, simulationToken: null, busy: false };

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function addMessage(role) {
  const message = element("div", `message ${role}`);
  if (role === "assistant") message.append(element("span", "avatar", "T"));
  const bubble = element("div", "bubble");
  message.append(bubble);
  $("conversation").append(message);
  message.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return bubble;
}

function paragraph(parent, value, className = "") {
  const item = element("p", className, value);
  parent.append(item);
  return item;
}

function list(parent, values, className = "simple-list") {
  const collection = element("ul", className);
  values.forEach((value) => collection.append(element("li", "", value)));
  parent.append(collection);
  return collection;
}

function button(parent, label, callback, style = "") {
  const item = element("button", `action ${style}`, label);
  item.type = "button";
  item.addEventListener("click", callback);
  parent.append(item);
  return item;
}

function setJourney(step) {
  document.querySelectorAll(".journey li").forEach((item, index) => {
    item.classList.toggle("done", index < step - 1);
    item.classList.toggle("active", index === step - 1);
  });
}

async function post(path, payload) {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

function showError(message) {
  const bubble = addMessage("assistant");
  bubble.append(element("strong", "", "툴밋"));
  paragraph(bubble, message);
}

function showMatches(data, generation) {
  const bubble = addMessage("assistant");
  bubble.append(element("strong", "", "툴밋 · 저장된 맥락 검색"));
  bubble.append(element("h2", "stage-title", data.message));
  paragraph(bubble, `현재 ${data.catalog_count}건의 요약 컨텍스트에서 검색했습니다. ${data.retrieval}`, "muted");
  if (!data.matches.length) {
    paragraph(bubble, data.next_question, "notice");
    button(bubble, "설명을 더 적기", () => $("query").focus(), "secondary");
    return;
  }
  const cards = element("div", "cards");
  data.matches.forEach((match) => {
    const card = element("article", "solution-card");
    card.append(element("span", "tag", match.fit_status));
    card.append(element("h3", "", match.title));
    paragraph(card, match.summary);
    paragraph(card, `입력: ${match.input}  →  출력: ${match.output}`, "micro");
    card.append(element("div", "section-label", "저장된 원본 설명의 단계"));
    list(card, match.source_steps, "method-list");
    card.append(element("div", "section-label", "툴밋이 제안하는 보완 · 미검증"));
    list(card, match.proposed_steps, "method-list");
    paragraph(card, match.adaptation, "notice");
    if (match.condition_issues.length) list(card, match.condition_issues, "simple-list issues");
    paragraph(card, `“${match.evidence_quote}”`, "evidence");
    paragraph(card, `${match.evidence_status} · 확인 ${match.checked_at} · 검색어: ${match.matched_terms.join(", ")}`, "micro");
    const actions = element("div", "action-row");
    const action = button(actions, match.condition_issues.length ? "가정된 과정도 보기 →" : "이 방법의 전체 흐름 보기 →", () => {
      if (generation === state.generation) simulate(data.discovery_token, match.id, generation);
    });
    action.disabled = match.blocked;
    if (match.blocked) paragraph(card, "입력한 필수 조건과 충돌해 이 후보의 시뮬레이션·연결 안내를 중단했습니다.", "micro");
    card.append(actions);
    cards.append(card);
  });
  bubble.append(cards);
  setJourney(3);
}

async function discover(query) {
  if (state.busy) return;
  const value = query.trim();
  if (value.length < 8) return showError("하려는 일과 원하는 결과를 조금 더 구체적으로 적어 주세요.");
  state.generation += 1;
  const generation = state.generation;
  state.discoveryToken = null;
  state.simulationToken = null;
  document.querySelectorAll("#conversation .action").forEach((item) => { item.disabled = true; });
  paragraph(addMessage("user"), value);
  state.busy = true;
  $("search").disabled = true;
  setJourney(2);
  try {
    const data = await post("/api/discover", { query: value });
    if (generation !== state.generation) return;
    state.discoveryToken = data.discovery_token;
    showMatches(data, generation);
  } catch (error) { showError(error.message); }
  finally { state.busy = false; $("search").disabled = false; }
}

async function simulate(discoveryToken, solutionId, generation) {
  if (state.busy) return;
  state.busy = true;
  try {
    const data = await post("/api/simulate", { discovery_token: discoveryToken, solution_id: solutionId });
    if (generation !== state.generation) return;
    state.simulationToken = data.simulation_token;
    const bubble = addMessage("assistant");
    bubble.append(element("strong", "", "툴밋 · 전체 과정 시뮬레이션"));
    bubble.append(element("h2", "stage-title", data.title));
    paragraph(bubble, data.status, "muted");
    paragraph(bubble, `사용자 업무: ${data.query}`, "muted");
    paragraph(bubble, `저장된 설명의 입력 ${data.input} → 출력 ${data.output}`, "muted");
    bubble.append(element("div", "section-label", "저장된 원본 설명의 흐름"));
    const sourceFlow = element("div", "flow");
    data.source_steps.forEach((step, index) => {
      if (index) sourceFlow.append(element("span", "flow-arrow", "→"));
      const node = element("div", "flow-node");
      node.append(element("strong", "", `원본 ${index + 1}`), element("span", "", step));
      sourceFlow.append(node);
    });
    bubble.append(sourceFlow);
    bubble.append(element("div", "section-label", "툴밋 보완 제안 · 아직 도구에 연결하지 않음"));
    const proposedFlow = element("div", "flow");
    data.proposed_steps.forEach((step, index) => {
      if (index) proposedFlow.append(element("span", "flow-arrow", "→"));
      const node = element("div", "flow-node proposal");
      node.append(element("strong", "", `보완 ${index + 1}`), element("span", "", step));
      proposedFlow.append(node);
    });
    bubble.append(proposedFlow);
    bubble.append(element("div", "section-label", "아직 비어 있는 예상 결과"));
    const blank = element("div", "blank");
    Object.entries(data.blank_output).forEach(([label, value]) => {
      const cell = element("div");
      cell.append(element("b", "", label), element("span", "", value));
      blank.append(cell);
    });
    bubble.append(blank);
    bubble.append(element("div", "section-label", "확인되지 않은 조건"));
    list(bubble, data.assumptions);
    paragraph(bubble, "이 그림은 저장된 설명으로 만든 가정입니다. 실제 설치·문서 처리 결과가 아닙니다. 방향이 맞는지 먼저 확인해 주세요.", "notice");
    const policyField = element("div", "policy-field");
    const policyLabel = element("label", "", "연결 안내 전 확인 · 회사에서 외부 AI 사용이 가능한가요?");
    policyLabel.htmlFor = `policy-${generation}`;
    const policySelect = element("select");
    policySelect.id = `policy-${generation}`;
    [["unknown", "모름 · 연결 보류"], ["allowed", "가능 · 별도 문서 전송 허용은 아직 아님"], ["denied", "불가 · 이 후보 제외"]].forEach(([value, label]) => {
      const option = element("option", "", label);
      option.value = value;
      policySelect.append(option);
    });
    policyField.append(policyLabel, policySelect);
    bubble.append(policyField);
    const actions = element("div", "action-row");
    button(actions, data.condition_issues.length ? "가정이 맞아요 · 원본 근거 보기" : "방향이 맞아요 · 연결 방법 보기", () => confirm(data.simulation_token, generation, policySelect.value));
    button(actions, "수정할게요", () => {
      paragraph(addMessage("assistant"), "원하는 입력·출력이나 바꾸고 싶은 단계를 적어 다시 검색해 주세요. 이전 과정도는 실행되지 않았습니다.");
      $("query").focus();
    }, "secondary");
    bubble.append(actions);
    setJourney(4);
  } catch (error) { showError(error.message); }
  finally { state.busy = false; }
}

async function confirm(token, generation, policy) {
  if (state.busy) return;
  state.busy = true;
  try {
    const data = await post("/api/confirm", { simulation_token: token, confirmed: true, external_ai_policy: policy });
    if (generation !== state.generation) return;
    if (data.connection_status) {
      const bubble = addMessage("assistant");
      bubble.append(element("strong", "", "툴밋 · 연결 보류"));
      paragraph(bubble, data.guidance, "notice");
      if (data.condition_issues.length) list(bubble, data.condition_issues, "simple-list issues");
      return;
    }
    document.querySelectorAll("#conversation .action").forEach((item) => { item.disabled = true; });
    const bubble = addMessage("assistant");
    const evidenceOnly = data.condition_issues.length > 0;
    bubble.append(element("strong", "", evidenceOnly ? "툴밋 · 적합성 미확인 · 원본 근거 확인" : "툴밋 · 연결 안내"));
    bubble.append(element("h2", "stage-title", evidenceOnly ? `${data.title}의 지원 범위를 확인하세요` : `${data.title}을(를) 살펴볼 차례입니다`));
    paragraph(bubble, data.adaptation);
    bubble.append(element("div", "section-label", evidenceOnly ? "원본에서 확인할 준비 조건" : "시작 전에 필요한 것"));
    list(bubble, data.requirements);
    bubble.append(element("div", "section-label", "아직 확인할 것"));
    list(bubble, [...data.condition_issues, ...data.unknowns]);
    paragraph(bubble, data.guidance, "notice");
    paragraph(bubble, `${data.evidence_status} · ${data.execution_status}`, "muted");
    const link = element("a", "source-link", data.condition_issues.length ? "원본 근거 확인 ↗" : "원본 저장소·가이드 열기 ↗");
    link.href = data.source_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    bubble.append(link);
    setJourney(5);
  } catch (error) { showError(error.message); }
  finally { state.busy = false; }
}

$("query-form").addEventListener("submit", (event) => {
  event.preventDefault();
  discover($("query").value);
});
document.querySelectorAll("[data-example]").forEach((item) => item.addEventListener("click", () => {
  $("query").value = item.dataset.example;
  $("query").focus();
}));
fetch("/api/catalog").then((response) => response.json()).then((data) => {
  $("catalog-count").textContent = `저장된 설명 ${data.count}건`;
}).catch(() => { $("catalog-count").textContent = "저장소 확인 실패"; });
