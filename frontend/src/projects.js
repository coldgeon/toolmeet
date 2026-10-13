/* Catalog browsing is UI context only; recommendation/confirmation remains in brief.js. */
(() => {
  const $ = (id) => document.getElementById(id);
  const appBase = new URL(".", document.currentScript.src);
  const dialog = $("project-detail");
  const kinds = {service: "AI 서비스", public_project: "공개 프로젝트", internal_method: "툴밋 내부 방법"};
  let preview = null, detailProject = null, detailOrigin = null, generation = 0;

  function node(tag, className = "", text = "") {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  }
  function button(className, text) {
    const el = node("button", className, text);
    el.type = "button";
    return el;
  }
  function method(project) {
    const block = node("section", "project-method");
    block.append(node("h4", "", "활용 방법 미리보기"), node("p", "project-truth-note", "합성 활용 예시 · 실제 도구 실행과 결과는 미검증"));
    const steps = node("ol", "project-steps");
    for (const step of project.method) steps.append(node("li", "", step.text));
    block.append(steps);
    return block;
  }
  function conditions(project) {
    const list = node("dl", "project-requirements");
    const r = project.requirements;
    const flag = (value, yes, no) => value.state === "unknown" ? "미확인" : value.value ? yes : no;
    const env = {any: "환경 제한 없음", google: "Google Workspace", microsoft: "Microsoft 365", other: "기타"};
    const entries = [
      ["외부 AI", flag(r.external_ai, "사용 정책 확인 필요", "외부 AI 사용 없음")],
      ["새 도구 설치", flag(r.installation, "설치 허용 필요", "새 설치 필요 없음")],
      ["업무 환경", r.ecosystems.state === "unknown" ? "미확인" : r.ecosystems.value.map((value) => env[value] || value).join(" · ")],
      ["실행 위치", r.hosting.state === "unknown" ? "미확인" : r.hosting.value === "self_hosted" ? "자체 호스팅 조건" : "클라우드 조건"],
      ["비용", project.cost.state === "unknown" ? "미확인 · 원본 요금 확인 필요" : String(project.cost.amount) + " " + project.cost.currency + " / " + project.cost.period],
    ];
    for (const [label, value] of entries) list.append(node("dt", "", label), node("dd", "", value));
    return list;
  }
  function stopMedia() {
    for (const video of dialog.querySelectorAll("video")) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }
  function closePreview(restore = false) {
    if (!preview) return;
    const old = preview;
    preview = null;
    old.panel.hidden = true;
    old.toggle.setAttribute("aria-expanded", "false");
    if (restore && old.toggle.isConnected && !$("projects-panel").hidden) old.toggle.focus();
  }
  function openPreview(entry, pinned) {
    if (preview !== entry) closePreview();
    preview = entry;
    entry.pinned = pinned;
    entry.panel.hidden = false;
    entry.toggle.setAttribute("aria-expanded", "true");
    if (pinned) {
      entry.panel.querySelector(".project-preview-close").focus();
      entry.panel.scrollIntoView?.({block: "nearest", inline: "nearest"});
    }
  }
  function closeDetail(restore = true) {
    ++generation;
    stopMedia();
    detailProject = null;
    const origin = detailOrigin;
    detailOrigin = null;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    document.body.classList.remove("project-detail-active");
    if (restore && origin?.isConnected && !$("projects-panel").hidden) origin.focus();
  }
  function mediaView(project) {
    const frame = node("div", "project-detail-media");
    const fallback = node("div", "project-media-fallback");
    fallback.append(node("strong", "", "설명으로 살펴보기"), node("p", "", project.fallback?.text || project.summary), node("small", "", "설명 대체 · 실제 실행 화면 아님"));
    const media = project.media.find((item) => item.kind === "image") || project.media.find((item) => item.kind === "video");
    if (media) {
      const asset = node(media.kind === "video" ? "video" : "img");
      if (media.kind === "image") {asset.alt = media.alt; asset.decoding = "async";}
      else {asset.controls = true; asset.preload = "none"; asset.setAttribute("aria-label", media.alt);}
      const label = node("p", "project-truth-note", media.content_kind === "actual" ? "실제 자료 · 기능·결과의 실행 검증은 별도" : "합성 설명 · 실제 실행 화면 아님");
      fallback.hidden = true;
      asset.addEventListener("error", () => {
        if (media.kind === "video") {asset.pause(); asset.removeAttribute("src"); asset.load();}
        asset.remove(); label.remove(); fallback.hidden = false;
      }, {once: true});
      asset.src = new URL(media.src, appBase).href;
      frame.append(asset, label);
    }
    frame.append(fallback);
    return frame;
  }
  async function openDetail(id, origin) {
    closePreview();
    stopMedia();
    detailProject = null;
    delete dialog.dataset.projectId;
    detailOrigin = origin;
    dialog.scrollTop = 0;
    const request = ++generation;
    $("project-detail-title").textContent = "프로젝트 살펴보기";
    $("project-detail-content").replaceChildren(node("p", "status", "프로젝트를 불러오는 중입니다."));
    $("project-detail-ask").hidden = true;
    $("project-detail-retry").hidden = true;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    document.body.classList.add("project-detail-active");
    $("project-detail-close").focus();
    try {
      const data = await window.ToolmeetCatalog.get(id);
      if (request !== generation || !dialog.open) return;
      if (data.contract_version !== "exploration.v1" || data.project?.id !== id || data.data_mode !== "mock") throw new Error("프로젝트 정보를 확인할 수 없습니다.");
      detailProject = window.ToolmeetCatalog.validateProject(data.project);
      dialog.dataset.projectId = id;
      const p = detailProject, content = $("project-detail-content");
      $("project-detail-title").textContent = p.name;
      content.replaceChildren(node("span", "catalog-kind", kinds[p.kind]), node("p", "project-detail-summary", p.summary), mediaView(p), method(p));
      content.append(node("h4", "", "사용 조건"), node("p", "project-truth-note", "시연 데이터의 조건 · 실제 계정·자료·요금 확인은 별도"), conditions(p));
      const evidence = node("section", "project-evidence");
      evidence.append(node("h4", "", "자료의 확인 범위"));
      for (const item of p.evidence) evidence.append(node("p", "", item.claim));
      evidence.append(node("p", "project-truth-note", "원본 사용 안내는 질문에서 후보와 방향을 확인한 뒤 제공됩니다."));
      content.append(evidence);
      $("project-detail-ask").hidden = false;
    } catch (error) {
      if (request !== generation || !dialog.open) return;
      $("project-detail-content").replaceChildren(node("p", "status", error.code === "not_found" ? "현재 목록에 없는 프로젝트입니다. 다른 후보를 선택해 주세요." : "프로젝트를 불러오지 못했습니다. 다시 시도하거나 다른 후보를 선택해 주세요."));
      $("project-detail-retry").hidden = error.code === "not_found";
      $("project-detail-retry").onclick = () => openDetail(id, detailOrigin);
    }
  }
  function decorate(card, project) {
    const actions = node("div", "project-card-actions");
    const toggle = button("project-preview-toggle", "활용 미리보기");
    const detail = button("project-detail-open", "상세 보기 ↗");
    detail.setAttribute("aria-label", project.name + " 상세 보기");
    detail.setAttribute("aria-haspopup", "dialog");
    const panel = node("section", "project-preview");
    panel.id = "preview-" + project.id;
    panel.hidden = true;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", project.name + " 활용 미리보기");
    toggle.setAttribute("aria-controls", panel.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", project.name + " 활용 미리보기");
    const close = button("project-preview-close", "미리보기 닫기");
    panel.append(close, node("strong", "project-preview-name", project.name), method(project));
    actions.append(toggle, detail);
    card.querySelector(".catalog-card-content").append(actions);
    card.append(panel);
    const entry = {card, panel, toggle, pinned: false};
    toggle.addEventListener("click", () => {
      if (preview === entry && entry.pinned) closePreview();
      else openPreview(entry, true);
    });
    close.addEventListener("click", (event) => {event.stopPropagation(); closePreview(true);});
    card.addEventListener("mouseenter", () => {if (!dialog.open && preview !== entry) openPreview(entry, false);});
    card.addEventListener("mouseleave", () => {
      if (preview === entry && !entry.pinned && !card.contains(document.activeElement)) closePreview();
    });
    card.addEventListener("focusout", (event) => {
      if (preview === entry && !entry.pinned && !card.contains(event.relatedTarget)) closePreview();
    });
    detail.addEventListener("click", () => openDetail(project.id, detail));
    card.addEventListener("click", (event) => {
      if (!event.target.closest("button, .project-preview")) openDetail(project.id, detail);
    });
  }
  $("project-detail-close").addEventListener("click", () => closeDetail());
  dialog.addEventListener("cancel", (event) => {event.preventDefault(); closeDetail();});
  // Also covers programmatic/native closing so playing media never continues behind the page.
  dialog.addEventListener("close", () => {if (!dialog.open && detailOrigin) closeDetail();});
  $("project-detail-ask").addEventListener("click", () => {
    if (!detailProject) return;
    const project = detailProject;
    closeDetail(false);
    $("selected-project-name").textContent = project.name;
    $("selected-project-context").dataset.projectId = project.id;
    $("selected-project-context").hidden = false;
    document.dispatchEvent(new CustomEvent("toolmeet:project-context", {detail: {project_id: project.id}}));
    document.dispatchEvent(new Event("toolmeet:focus-question"));
    $("work").focus();
  });
  function clearContext() {
    $("selected-project-context").hidden = true;
    delete $("selected-project-context").dataset.projectId;
    $("selected-project-name").textContent = "";
  }
  $("clear-project-context").addEventListener("click", () => {
    clearContext();
    document.dispatchEvent(new CustomEvent("toolmeet:project-context", {detail: {project_id: null}}));
    $("work").focus();
  });
  document.addEventListener("toolmeet:new-question", () => {closePreview(); closeDetail(false); clearContext();});
  document.addEventListener("toolmeet:tab-change", () => {closePreview(); if (dialog.open) closeDetail(false);});
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (dialog.open) {event.preventDefault(); closeDetail();}
      else if (preview) {event.preventDefault(); closePreview(true);}
    }
    if (event.key === "Tab" && dialog.open) {
      const items = [...dialog.querySelectorAll("button, video[controls]")].filter((el) => !el.hidden && !el.disabled);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    }
  });
  window.ToolmeetProjects = Object.freeze({decorate, closePreview, closeDetail});
})();
