/* Home exploration UI. Catalog examples and the question share a page; tabs never rebuild the form. */
(() => {
  const $ = (id) => document.getElementById(id);
  const script = document.currentScript || document.querySelector('script[src$="exploration.js"]');
  const appBase = new URL(".", script?.src || document.baseURI);
  const state = {tab: "ask", focused: false, motionPaused: false, reducedMotion: false, projectId: null};
  let catalogReady = false;
  let loadGeneration = 0;
  const topicLabels = {meeting: "회의·후속 작업", summary: "자료·문서 요약", forms: "양식·초안", planning: "기획·조사", coding: "개발·자동화"};
  const kindLabels = {service: "AI 서비스", public_project: "공개 프로젝트", internal_method: "툴밋 내부 방법"};
  const tabs = [$("ask-tab"), $("projects-tab")];

  function node(tag, className = "", text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function sync() {
    document.body.dataset.mode = state.focused ? "focused" : "initial";
    document.body.dataset.tab = state.tab;
    const running = state.tab === "ask" && !state.focused && !state.motionPaused && !state.reducedMotion && catalogReady;
    document.body.dataset.motion = running ? "running" : "paused";
    $("ask-panel").hidden = state.tab !== "ask";
    $("projects-panel").hidden = state.tab !== "projects";
    for (const tab of tabs) {
      const selected = tab.id === state.tab + "-tab";
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    $("new-question").hidden = !state.focused;
    $("question-examples").hidden = !state.focused;
    $("motion-controls").hidden = state.focused || state.tab !== "ask";
    const toggle = $("motion-toggle");
    toggle.setAttribute("aria-pressed", String(state.motionPaused));
    toggle.disabled = state.reducedMotion || !catalogReady;
    toggle.textContent = state.reducedMotion ? "움직임 감소 설정으로 정지됨" : state.motionPaused ? "배경 움직임 재생" : "배경 움직임 정지";
    $("motion-description").textContent = state.reducedMotion ? "기기의 움직임 감소 설정을 따릅니다." : !catalogReady ? "배경 자료 없이도 질문을 사용할 수 있습니다." : "입력에 집중하면 배경 움직임이 멈춥니다. 새 질문에서도 수동 정지 선택은 유지됩니다.";
  }

  function selectTab(tab) {
    if (tab !== "ask" && tab !== "projects") return;
    state.tab = tab;
    sync();
  }

  function focusQuestion() {
    state.focused = true;
    selectTab("ask");
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => selectTab(tab.id === "ask-tab" ? "ask" : "projects"));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[1] : tabs[1 - tabs.indexOf(tab)];
      selectTab(next.id === "ask-tab" ? "ask" : "projects");
      next.focus();
    });
  }
  $("work").addEventListener("focus", focusQuestion);
  $("work").addEventListener("click", focusQuestion);
  $("work").addEventListener("input", focusQuestion);
  $("environment-details").addEventListener("toggle", () => {
    if ($("environment-details").open) focusQuestion();
  });
  document.addEventListener("toolmeet:focus-question", focusQuestion);
  $("motion-toggle").addEventListener("click", () => {
    if (state.reducedMotion || !catalogReady) return;
    state.motionPaused = !state.motionPaused;
    sync();
  });
  $("new-question").addEventListener("click", () => {
    document.dispatchEvent(new Event("toolmeet:new-question"));
    state.focused = false;
    state.projectId = null;
    selectTab("ask");
    const url = new URL(location.href);
    url.searchParams.delete("work");
    history.replaceState(null, "", url);
    // Focusing the input here would immediately enter focus mode again.
    $("ask-tab").focus();
  });
  const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  if (mediaQuery) {
    state.reducedMotion = mediaQuery.matches;
    const changed = (event) => {state.reducedMotion = event.matches; sync();};
    if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", changed);
    else if (mediaQuery.addListener) mediaQuery.addListener(changed);
  }

  function visual(project, decorative = false) {
    const frame = node("div", decorative ? "background-visual" : "catalog-visual");
    const fallback = node("div", "media-fallback");
    fallback.append(node("span", "fallback-kind", kindLabels[project.kind]), node("strong", "", project.name));
    fallback.append(node("p", "", project.fallback?.text || project.summary));
    if (!decorative) fallback.append(node("small", "catalog-media-label", "설명 대체 · 실행 화면 아님"));
    const media = project.media?.find((item) => item.kind === "image" && ["owned", "licensed"].includes(item.provenance?.rights_status));
    if (media) {
      const img = node("img", decorative ? "background-image" : "catalog-image");
      img.dataset.projectId = project.id;
      img.alt = decorative ? "" : media.alt;
      img.width = 720;
      img.height = 440;
      img.loading = decorative ? "eager" : "lazy";
      img.decoding = "async";
      fallback.hidden = true;
      const label = decorative ? null : node("small", "catalog-media-label", media.content_kind === "actual" ? "실제 자료 · 실행 검증은 별도" : "합성 설명 · 실제 실행 화면 아님");
      img.addEventListener("error", () => {img.remove(); label?.remove(); fallback.hidden = false;});
      img.src = new URL(media.src, appBase).href;
      frame.append(img);
      if (label) frame.append(label);
    }
    frame.append(fallback);
    return frame;
  }

  function conditions(project) {
    const values = [];
    if (project.requirements.external_ai.state === "unknown") values.push("외부 AI 조건 미확인");
    else if (project.requirements.external_ai.value) values.push("외부 AI 정책 확인");
    if (project.requirements.installation.state === "unknown") values.push("설치 조건 미확인");
    else if (project.requirements.installation.value) values.push("설치 허용 필요");
    if (project.requirements.hosting.value === "self_hosted") values.push("자체 호스팅 조건");
    const ecosystem = project.requirements.ecosystems;
    if (ecosystem.state === "unknown") values.push("업무 환경 미확인");
    else if (!ecosystem.value.includes("any")) {
      const labels = {google: "Google Workspace", microsoft: "Microsoft 365", other: "기타"};
      values.push(ecosystem.value.map((value) => labels[value] || value).join(" · ") + " 환경");
    }
    values.push("비용 미확인");
    return values;
  }

  function renderProjects(projects) {
    const hasActual = projects.some((project) => project.media.some((media) => media.content_kind === "actual"));
    $("catalog-media-note").textContent = hasActual ? "카드의 표시로 실제 자료·합성 예시를 구분하세요" : "이미지는 합성 설명 · 실제 실행 화면 아님";
    $("background-note").textContent = hasActual ? "등록 후보의 카드 이미지 · 실제/합성 표시는 목록에서 확인하세요. 개인 맞춤 추천이 아닙니다." : "등록 후보의 합성 카드 이미지 · 개인 맞춤 추천이나 실제 실행 화면이 아닙니다.";
    $("catalog-list").replaceChildren();
    $("catalog-background").replaceChildren();
    $("catalog-count").textContent = projects.length ? "등록된 시연 항목 " + projects.length + "개" : "";
    for (const project of projects) {
      const card = node("article", "catalog-card");
      card.dataset.projectId = project.id;
      card.append(visual(project));
      const content = node("div", "catalog-card-content");
      content.append(node("span", "catalog-kind", kindLabels[project.kind]));
      content.append(node("h3", "", project.name));
      content.append(node("p", "catalog-task", project.tasks.map((topic) => topicLabels[topic] || topic).join(" · ")));
      content.append(node("p", "catalog-summary", project.summary));
      const tags = node("div", "catalog-conditions");
      for (const value of conditions(project)) tags.append(node("span", "", value));
      content.append(tags, node("p", "catalog-evidence", "시연 후보 · 기능·요금 미검증"));
      card.append(content);
      $("catalog-list").append(card);
    }
    if (projects.length) {
      const track = node("div", "background-track");
      for (let copy = 0; copy < 2; copy++) {
        const cycle = node("div", "background-cycle");
        for (const project of projects) {
          const card = node("div", "background-card");
          card.dataset.projectId = project.id;
          card.append(visual(project, true));
          cycle.append(card);
        }
        track.append(cycle);
      }
      $("catalog-background").append(track);
    }
  }

  async function loadCatalog() {
    const generation = ++loadGeneration;
    catalogReady = false;
    $("catalog-status").hidden = false;
    $("catalog-status").textContent = "시연 후보를 불러오는 중입니다.";
    $("catalog-retry").hidden = true;
    $("catalog-list").replaceChildren();
    $("catalog-background").replaceChildren();
    $("catalog-count").textContent = "";
    sync();
    try {
      if (!window.ToolmeetCatalog) throw new Error("후보 목록을 불러오지 못했습니다.");
      const data = await window.ToolmeetCatalog.list();
      if (generation !== loadGeneration) return;
      if (data.contract_version !== "exploration.v1" || data.data_mode !== "mock" || !Array.isArray(data.projects)) throw new Error("후보 정보가 올바르지 않습니다.");
      renderProjects(data.projects);
      catalogReady = data.projects.length > 0;
      $("catalog-status").hidden = catalogReady;
      $("catalog-status").textContent = catalogReady ? "" : "아직 등록된 시연 후보가 없습니다. 업무 질문은 계속 사용할 수 있습니다.";
    } catch (error) {
      if (generation !== loadGeneration) return;
      $("catalog-status").textContent = error.code === "invalid_payload" ? "시연 후보 정보가 올바르지 않아 목록을 표시할 수 없습니다. 질문은 계속 사용할 수 있습니다." : "시연 후보를 불러오지 못했습니다. 다시 시도하거나 업무 질문을 사용할 수 있습니다.";
      $("catalog-retry").hidden = false;
    } finally {
      if (generation === loadGeneration) sync();
    }
  }
  $("catalog-retry").addEventListener("click", async () => {
    await loadCatalog();
    if ($("catalog-retry").hidden && state.tab === "projects") {
      const heading = document.querySelector(".catalog-heading h2");
      heading.tabIndex = -1;
      heading.focus();
    }
  });
  window.ToolmeetExploration = {state, focusQuestion, selectTab};
  sync();
  loadCatalog();
})();
