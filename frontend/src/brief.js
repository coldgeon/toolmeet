const $ = (id) => document.getElementById(id);
const state = {request: 0, boardPosts: [], boardTopic: "all"};
const statusLabels = {possible: "조건상 검토 가능", adapt: "환경 변경 필요", hold: "확인 전 보류", excluded: "입력 조건과 충돌"};

function node(tag, className = "", value = "") {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value) item.textContent = value;
  return item;
}

function profile() {
  return {
    work: $("work").value,
    policy: $("policy").value,
    installation: $("installation").value,
    ecosystem: $("ecosystem").value,
    data_kind: $("data-kind").value,
    hosting: $("hosting").value,
  };
}

function candidateJump(id) {
  const target = document.getElementById("candidate-" + id);
  if (!target) return;
  target.scrollIntoView({behavior: "smooth", block: "center"});
  target.classList.add("focused");
  setTimeout(() => target.classList.remove("focused"), 1800);
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

function renderCandidate(item) {
  const card = node("article", "candidate");
  card.id = "candidate-" + item.id;
  const top = node("div", "candidate-top");
  const heading = node("div");
  heading.append(node("span", "kind", item.kind));
  heading.append(node("h3", "", item.name));
  heading.append(node("p", "candidate-summary", item.summary));
  top.append(heading, node("span", "fit-pill " + item.status, statusLabels[item.status]));
  card.append(top);

  const grid = node("div", "reason-grid");
  const reason = node("div");
  reason.append(node("b", "", "왜 추천했나요?"));
  reason.append(node("p", "", item.reasons.join(" ")));
  const fit = node("div");
  fit.append(node("b", "", "현재 환경에서 쓸 수 있나요?"));
  fit.append(node("p", "", item.fit_reason));
  grid.append(reason, fit);
  card.append(grid);

  const first = node("div", "first-check");
  first.append(node("b", "", "첫 사용에서 확인할 것"));
  first.append(node("p", "", item.first_gate + " " + item.first_check));
  card.append(first);
  card.append(node("p", "source-status", "근거 상태: " + item.source_status + " · 추천/판정은 mock"));

  const actions = node("div", "candidate-actions");
  const preview = node("button", "preview-button", "활용 방법 미리보기 →");
  preview.type = "button";
  preview.setAttribute("aria-expanded", "false");
  actions.append(preview);
  card.append(actions);

  const panel = node("div", "preview-panel");
  panel.hidden = true;
  panel.append(node("h4", "", "이 후보를 쓰는 가정된 흐름"));
  const steps = node("ol");
  item.method.forEach((step) => steps.append(node("li", "", step)));
  panel.append(steps);
  panel.append(node("p", "", "실제 자료를 처리하거나 도구를 연결한 결과가 아닙니다. 방향이 맞는지 확인한 뒤 원본을 살펴보세요."));
  if (item.status === "hold" || item.status === "excluded") {
    panel.append(node("p", "hold-note", "연결 보류 · " + item.fit_reason + " " + item.first_gate));
  } else if (item.kind !== "툴밋 방법") {
    const confirm = node("button", "confirm-button", "방향 확인 · 원본 안내 보기");
    confirm.type = "button";
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        const response = await fetch("/api/brief/confirm", {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({brief_token: state.briefToken, candidate_id: item.id, confirmed: true}),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "원본 안내를 가져오지 못했습니다.");
        confirm.remove();
        panel.append(node("p", "", "원본 링크 안내 단계입니다. 설치·계정 연결·자료 전송·첫 시험 완료가 아닙니다."));
        const link = node("a", "source-link", "원본 서비스·프로젝트 열기 ↗");
        link.href = data.source_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        panel.append(link);
      } catch (error) {
        panel.append(node("p", "hold-note", error.message));
        confirm.disabled = false;
      }
    });
    panel.append(confirm);
  } else {
    panel.append(node("p", "no-link", "툴밋 시연용 방법에는 외부 원본 링크가 없습니다."));
  }
  preview.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    preview.setAttribute("aria-expanded", String(!panel.hidden));
    preview.textContent = panel.hidden ? "활용 방법 미리보기 →" : "활용 방법 닫기 ↑";
  });
  card.append(panel);
  return card;
}

function render(data) {
  state.briefToken = data.brief_token;
  state.candidates = new Map(data.candidates.map((item) => [item.id, item]));
  $("asked-question").textContent = data.profile.work;
  $("topic-description").textContent = "현재 업무를 ‘" + data.topic_label + "’로 임시 분류했습니다. " + data.classification_note + ". 입력한 환경 조건에 따라 소식의 연결 후보와 적합성 안내가 달라집니다.";
  renderNews($("related-list"), data.related_news);
  const list = $("candidate-list");
  list.replaceChildren();
  data.candidates.forEach((item) => list.append(renderCandidate(item)));
  $("results").hidden = false;
  $("status").hidden = false;
  $("status").textContent = "시연용 mock 데이터 · " + data.data_updated_at + " 저장본 · " + data.stage;
}

async function refresh(scrollToAnswer = false) {
  const request = ++state.request;
  state.briefToken = null;
  $("results").hidden = true;
  if ($("work").value.trim().length < 8) {
    $("status").hidden = false;
    $("status").textContent = "업무를 8자 이상 적어 주세요.";
    $("results").hidden = true;
    $("submit").disabled = false;
    return;
  }
  $("submit").disabled = true;
  $("status").hidden = false;
  $("status").textContent = "입력한 업무와 환경에 맞춰 mock 결과를 다시 계산하는 중입니다.";
  try {
    const response = await fetch("/api/brief", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(profile()),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "결과를 가져오지 못했습니다.");
    if (request !== state.request) return;
    render(data);
    if (scrollToAnswer) $("results").scrollIntoView({behavior: "smooth", block: "start"});
  } catch (error) {
    if (request !== state.request) return;
    $("status").textContent = error.message;
    $("results").hidden = true;
  } finally {
    if (request === state.request) $("submit").disabled = false;
  }
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
      $("work").value = item.work;
      refresh(true);
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
document.querySelectorAll("[data-work]").forEach((item) => item.addEventListener("click", () => {
  $("work").value = item.dataset.work;
  refresh(true);
}));
document.querySelectorAll(".fields select").forEach((item) => item.addEventListener("change", () => {
  if ($("work").value.trim().length >= 8 && !$("results").hidden) refresh();
}));
$("work").addEventListener("input", () => {
  state.request += 1;
  state.briefToken = null;
  $("results").hidden = true;
  $("status").hidden = true;
  $("submit").disabled = false;
});
$("edit-environment").addEventListener("click", () => {
  $("environment-details").open = true;
  $("environment-details").scrollIntoView({behavior: "smooth", block: "center"});
});
document.querySelectorAll("[data-board-topic]").forEach((item) => item.addEventListener("click", () => {
  state.boardTopic = item.dataset.boardTopic;
  document.querySelectorAll("[data-board-topic]").forEach((button) => button.classList.toggle("selected", button === item));
  renderBoard();
}));
loadBoard();
const linkedWork = new URLSearchParams(window.location.search).get("work");
if (linkedWork) {
  $("work").value = linkedWork.slice(0, 1000);
  refresh(true);
}
