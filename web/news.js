const $ = (id) => document.getElementById(id);
const state = {items: [], topic: "all", search: "", detailId: null};

function node(tag, className = "", value = "") {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value) item.textContent = value;
  return item;
}

function visibleNews() {
  const search = state.search.trim().toLocaleLowerCase();
  return state.items.filter((item) =>
    (state.topic === "all" || item.topic === state.topic) &&
    (!search || (item.title + " " + item.summary + " " + item.topic_label).toLocaleLowerCase().includes(search))
  );
}

function showDetail(item, scroll = true) {
  state.detailId = item.id;
  const detail = $("news-detail");
  detail.replaceChildren();
  const top = node("div", "news-detail-top");
  top.append(node("span", "board-topic", item.topic_label), node("span", "mock-badge", "가상 소식 · 원문 없음"));
  detail.append(top, node("h2", "", item.title), node("p", "news-detail-lead", item.summary));
  if (item.angle) {
    detail.append(node("h3", "", "이 소식에서 볼 활용 방향"));
    detail.append(node("p", "", item.angle));
  }
  if (item.candidate_names.length) {
    detail.append(node("h3", "", "관련 방법 후보 예시"));
    const names = node("div", "detail-candidates");
    item.candidate_names.forEach((name) => names.append(node("span", "", name)));
    detail.append(names);
  }
  detail.append(node("p", "news-disclosure", "이 내용은 실제 기사나 공급자 실행 결과가 아닙니다. 계정·정책·요금·기능은 원본에서 따로 확인해야 합니다."));
  const actions = node("div", "detail-actions");
  if (item.sample_work) {
    const link = node("a", "news-to-question", "이 소식으로 업무 질문하기 ↗");
    link.href = "/?work=" + encodeURIComponent(item.sample_work);
    actions.append(link);
  } else {
    actions.append(node("span", "no-link", "이 분야는 현재 추천 질문 예시와 연결하지 않았습니다."));
  }
  const close = node("button", "inline-action", "상세 닫기");
  close.type = "button";
  close.addEventListener("click", () => {
    detail.hidden = true;
    state.detailId = null;
    history.replaceState(null, "", "/news");
  });
  actions.append(close);
  detail.append(actions);
  detail.hidden = false;
  history.replaceState(null, "", "/news?id=" + encodeURIComponent(item.id));
  if (scroll) detail.scrollIntoView({behavior: "smooth", block: "start"});
}

function render() {
  const list = $("news-index-list");
  list.replaceChildren();
  const items = visibleNews();
  $("news-count").textContent = items.length + "건의 가상 소식";
  if (!items.length) {
    list.append(node("p", "status", "이 분야와 검색어에 해당하는 시연용 소식이 없습니다."));
  }
  items.forEach((item) => {
    const row = node("article", "news-row");
    row.setAttribute("role", "listitem");
    const top = node("div", "news-row-top");
    top.append(node("span", "board-topic", item.topic_label), node("span", "", "가상 소식 · 발행일 없음"));
    row.append(top);
    const title = node("button", "news-title", item.title);
    title.type = "button";
    title.addEventListener("click", () => showDetail(item));
    row.append(title, node("p", "", item.summary));
    row.append(node("span", "news-read", "요약 상세 보기 →"));
    list.append(row);
  });
  if (state.detailId && !items.some((item) => item.id === state.detailId)) {
    $("news-detail").hidden = true;
    state.detailId = null;
    history.replaceState(null, "", "/news");
  }
}

document.querySelectorAll("[data-news-topic]").forEach((button) => button.addEventListener("click", () => {
  state.topic = button.dataset.newsTopic;
  document.querySelectorAll("[data-news-topic]").forEach((item) => item.classList.toggle("selected", item.dataset.newsTopic === state.topic));
  render();
}));
$("news-search").addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

async function loadNews() {
  try {
    const response = await fetch("/api/news");
    const data = await response.json();
    if (!response.ok || data.data_mode !== "mock") throw new Error("가상 소식을 불러오지 못했습니다.");
    state.items = data.news;
    render();
    const id = new URLSearchParams(window.location.search).get("id");
    const selected = state.items.find((item) => item.id === id);
    if (selected) showDetail(selected, false);
  } catch (error) {
    $("news-count").textContent = "불러오기 실패";
    $("news-index-list").append(node("p", "status", error.message));
  }
}
loadNews();
