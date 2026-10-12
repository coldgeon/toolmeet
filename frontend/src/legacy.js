const $ = (id) => document.getElementById(id);
const state = { task: "meeting", previewToken: null, result: null, documents: [], demoDocuments: null, running: false, previewRequest: 0, inputVersion: 0 };
const presets = {
  meeting: {
    job: "회의록에서 결정과 할 일을 매번 표로 옮긴다.",
    current: "회의록을 읽고 결정과 할 일을 찾은 뒤 표에 복사해 검토한다.",
    result: "결정 목록과 할 일·담당자·기한·원문 근거 표",
    format: "Markdown 회의록 → 표",
  },
  summary: {
    job: "여러 문서를 한 보고서로 요약하고 출처를 남긴다.",
    current: "각 문서를 읽고 공통점과 차이를 수동으로 비교한다.",
    result: "공통점·차이·조건·미확인을 출처와 연결한 보고서",
    format: "Markdown 문서 3개 → Markdown 보고서",
  },
  template: {
    job: "여러 문서를 한 보고서로 요약하고 문서별 근거를 남길 도구를 평가한다.",
    current: "후보 설명을 읽고 평가 양식과 수동으로 대조한다.",
    result: "요약 업무에 맞는지 양식 항목별로 근거·미확인을 구분한 평가 초안",
    format: "Markdown 양식 + 근거 문서 → Markdown 초안",
  },
};

function invalidate() {
  state.inputVersion += 1;
  state.previewRequest += 1;
  state.previewToken = null;
  state.result = null;
  $("preview").hidden = true;
  $("preview-empty").hidden = false;
  $("approve").checked = false;
  $("approve").disabled = true;
  $("document-stage").hidden = true;
  $("transfer").checked = false;
  $("result-box").hidden = true;
  $("result-empty").hidden = false;
  updateRunButton();
}

function invalidateDocuments() {
  state.inputVersion += 1;
  state.result = null;
  $("transfer").checked = false;
  $("result-box").hidden = true;
  $("result-empty").hidden = false;
  updateRunButton();
}

function selectTask(task) {
  state.task = task;
  state.documents = [];
  state.demoDocuments = null;
  state.result = null;
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.task === task);
    tab.setAttribute("aria-selected", tab.dataset.task === task ? "true" : "false");
  }
  for (const key of ["job", "current", "result"]) $(key).value = presets[task][key];
  $("formats").value = presets[task].format;
  $("policy").value = "unknown";
  $("services").value = "";
  $("limits").value = "";
  $("transfer").checked = false;
  $("result-box").hidden = true;
  $("result-empty").hidden = false;
  renderDocuments();
  invalidate();
}

function renderDocuments() {
  const container = $("documents");
  container.replaceChildren();
  state.documents.forEach((doc, index) => {
    const wrap = document.createElement("div");
    wrap.className = "doc-item";
    const row = document.createElement("div");
    row.className = "row";
    const name = document.createElement("input");
    name.value = doc.name;
    name.setAttribute("aria-label", `문서 ${index + 1} 이름`);
    name.addEventListener("input", () => { doc.name = name.value; doc.transfer_allowed = false; doc.test_material = false; box.checked = false; materialBox.checked = false; invalidateDocuments(); });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "삭제";
    remove.addEventListener("click", () => { state.documents.splice(index, 1); renderDocuments(); invalidateDocuments(); });
    row.append(name, remove);
    const body = document.createElement("textarea");
    body.value = doc.text;
    body.setAttribute("aria-label", `문서 ${index + 1} 본문`);
    body.addEventListener("input", () => { doc.text = body.value; doc.transfer_allowed = false; doc.test_material = false; box.checked = false; materialBox.checked = false; invalidateDocuments(); });
    const permit = document.createElement("label");
    permit.className = "check";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = doc.transfer_allowed === true;
    box.addEventListener("change", () => { doc.transfer_allowed = box.checked; updateRunButton(); });
    permit.append(box, document.createTextNode(" 이 문서의 Codex 전송 허용"));
    const material = document.createElement("label");
    material.className = "check";
    const materialBox = document.createElement("input");
    materialBox.type = "checkbox";
    materialBox.checked = doc.test_material === true;
    materialBox.addEventListener("change", () => { doc.test_material = materialBox.checked; updateRunButton(); });
    material.append(materialBox, document.createTextNode(" 공개·합성 시험 자료이며 기업 비공개 원본이 아님을 확인"));
    wrap.append(row, body, material, permit);
    container.append(wrap);
  });
  updateRunButton();
}

async function simulate() {
  const intake = getIntake();
  if (Object.values(intake).some((value) => !value)) {
    alert("첫 문의 3항목을 모두 입력하세요.");
    return;
  }
  const requestId = ++state.previewRequest;
  try {
    const response = await fetch("/api/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: state.task, intake, metadata: getMetadata() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "미리보기를 만들지 못했습니다.");
    if (requestId !== state.previewRequest) return;
    const flow = $("flow");
    flow.replaceChildren();
    data.steps.forEach((step, index) => {
      if (index) {
        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = "→";
        flow.append(arrow);
      }
      const node = document.createElement("div");
      node.className = "flow-step";
      node.textContent = step;
      flow.append(node);
    });
    const table = document.createElement("table");
    const header = document.createElement("tr");
    data.columns.forEach((column) => { const cell = document.createElement("th"); cell.textContent = column; header.append(cell); });
    table.append(header);
    const blanks = document.createElement("tr");
    data.columns.forEach(() => { const cell = document.createElement("td"); cell.textContent = "—"; blanks.append(cell); });
    table.append(blanks);
    $("output-shape").replaceChildren(table);
    $("assumptions").textContent = data.assumptions.join("\n");
    $("preview-empty").hidden = true;
    $("preview").hidden = false;
    state.previewToken = data.preview_token;
    $("approve").disabled = false;
    $("approve").checked = false;
    updateRunButton();
  } catch (error) { alert(error.message); }
}

function getIntake() {
  return Object.fromEntries(["job", "current", "result"].map((key) => [key, $(key).value.trim()]));
}

function getMetadata() {
  return Object.fromEntries(["formats", "services", "policy", "limits"].map((key) => [key, $(key).value.trim()]));
}

function documentsAreBundledDemo() {
  if (!state.demoDocuments || state.documents.length !== state.demoDocuments.length) return false;
  return state.documents.every((doc, index) => doc.name === state.demoDocuments[index].name && doc.text === state.demoDocuments[index].text);
}

function updateRunButton() {
  const minimum = state.task === "meeting" ? 1 : state.task === "summary" ? 3 : 2;
  $("run").disabled = state.running || !state.previewToken || !$("approve").checked || !$("transfer").checked
    || $("policy").value === "denied" || ($("policy").value === "unknown" && !documentsAreBundledDemo())
    || state.documents.length < minimum
    || state.documents.some((doc) => !doc.name.trim() || !doc.text.trim() || doc.test_material !== true || doc.transfer_allowed !== true);
}

async function loadDemo() {
  try {
    const response = await fetch(`/api/demo?task=${state.task}`);
    if (!response.ok) throw new Error("시험 문서를 읽지 못했습니다.");
    const data = await response.json();
    state.documents = data.documents.map((doc) => ({ ...doc, origin: "bundled_demo", test_material: true, transfer_allowed: false }));
    state.demoDocuments = data.documents;
    renderDocuments();
    invalidateDocuments();
  } catch (error) { alert(error.message); }
}

async function addFiles(files) {
  for (const file of files) {
    if (!/\.(md|txt)$/i.test(file.name)) {
      alert("현재 시연은 .md 또는 .txt 본문만 읽습니다. PDF·Docs/Word·Excel은 별도 검증 대상입니다.");
      continue;
    }
    if (state.documents.length >= 5) { alert("한 번에 최대 5개 문서만 넣을 수 있습니다."); break; }
    const content = await file.text();
    if (state.running) continue;
    state.documents.push({ name: file.name, text: content, origin: "file_upload", test_material: false, transfer_allowed: false });
  }
  $("file-input").value = "";
  renderDocuments();
  invalidateDocuments();
}

function showResult(data) {
  state.result = data;
  $("result-status").textContent = `${data.status} · ${new Date(data.executed_at).toLocaleString("ko-KR")}`;
  renderMarkdown(data.content, $("result-content"));
  const evidence = $("evidence");
  evidence.replaceChildren();
  for (const item of data.evidence) {
    const block = document.createElement("div");
    block.className = `evidence-item${item.verified ? "" : " bad"}`;
    const source = data.inputs[Number(item.source_id) - 1]?.name || `문서 ${item.source_id}`;
    block.textContent = `${item.verified ? "✓" : "!"} ${source} — “${item.quote}”`;
    evidence.append(block);
  }
  $("warnings").replaceChildren();
  for (const warning of data.warnings) {
    const line = document.createElement("p");
    line.textContent = `확인 필요: ${warning}`;
    $("warnings").append(line);
  }
  $("result-empty").hidden = true;
  $("result-box").hidden = false;
  $("result-box").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMarkdown(source, container) {
  container.replaceChildren();
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.startsWith("|") && index + 1 < lines.length && /^\|?[\s:|\-]+\|?$/.test(lines[index + 1].trim())) {
      const table = document.createElement("table");
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(lines[index].trim()); index += 1;
      }
      rows.forEach((row, rowIndex) => {
        if (rowIndex === 1 && /^\|?[\s:|\-]+\|?$/.test(row)) return;
        const tr = document.createElement("tr");
        row.replace(/^\|/, "").replace(/\|$/, "").split("|").forEach((cell) => {
          const element = document.createElement(rowIndex === 0 ? "th" : "td");
          element.textContent = cell.trim().replace(/\*\*/g, "");
          tr.append(element);
        });
        table.append(tr);
      });
      container.append(table);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const element = document.createElement(`h${Math.min(heading[1].length + 1, 4)}`);
      element.textContent = heading[2];
      container.append(element); index += 1; continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const list = document.createElement("ul");
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        const item = document.createElement("li");
        item.textContent = lines[index].trim().replace(/^[-*]\s+/, "").replace(/\*\*/g, "");
        list.append(item); index += 1;
      }
      container.append(list); continue;
    }
    const paragraph = document.createElement("p");
    paragraph.textContent = line.replace(/\*\*/g, "");
    container.append(paragraph); index += 1;
  }
}

async function run() {
  if ($("run").disabled) return;
  const button = $("run");
  state.running = true;
  const requestId = state.previewRequest;
  const inputVersion = state.inputVersion;
  const payload = {
    task: state.task, documents: state.documents.map((doc) => ({ ...doc })), intake: getIntake(),
    metadata: getMetadata(), preview_token: state.previewToken,
    approved: $("approve").checked, transfer_allowed: $("transfer").checked,
  };
  document.querySelectorAll("button,input,textarea,select").forEach((element) => { element.disabled = true; });
  button.disabled = true;
  button.textContent = "본문 처리 중… 최대 3분";
  try {
    const response = await fetch("/api/run", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "처리에 실패했습니다.");
    if (requestId === state.previewRequest && inputVersion === state.inputVersion) showResult(data);
  } catch (error) { alert(error.message); }
  finally {
    state.running = false;
    state.previewToken = null;
    document.querySelectorAll("button,input,textarea,select").forEach((element) => { element.disabled = false; });
    $("approve").disabled = true;
    button.textContent = "본문 처리 실행";
    updateRunButton();
  }
}

function download() {
  if (!state.result) return;
  const blob = new Blob([JSON.stringify(state.result, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `toolmeet-${state.task}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => selectTask(button.dataset.task)));
for (const key of ["job", "current", "result", "formats", "services", "policy", "limits"]) $(key).addEventListener("input", invalidate);
$("approve").addEventListener("change", () => { $("document-stage").hidden = !$("approve").checked; updateRunButton(); });
$("transfer").addEventListener("change", updateRunButton);
$("load-demo").addEventListener("click", loadDemo);
$("simulate").addEventListener("click", simulate);
$("file-input").addEventListener("change", (event) => addFiles(event.target.files));
$("add-text").addEventListener("click", () => {
  if (state.documents.length >= 5) return alert("한 번에 최대 5개 문서만 넣을 수 있습니다.");
  state.documents.push({ name: `붙여넣기-${state.documents.length + 1}.txt`, text: "", origin: "pasted_text", test_material: false, transfer_allowed: false });
  renderDocuments(); invalidateDocuments();
});
$("run").addEventListener("click", run);
$("download").addEventListener("click", download);
selectTask("meeting");
