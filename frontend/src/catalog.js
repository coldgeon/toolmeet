(() => {
  const appBase = new URL(".", document.currentScript.src);
  const contractVersion = "exploration.v1";
  const kinds = {"AI 서비스": "service", "공개 프로젝트": "public_project", "툴밋 방법": "internal_method"};
  const topics = new Set(["meeting", "summary", "forms", "planning", "coding", "creative", "health", "education"]);
  let loading;

  function failure(code, message, field = "", retryable = false) {
    const error = new Error(message);
    error.code = code;
    error.retryable = retryable;
    error.field_errors = field ? [{field, message}] : [];
    return error;
  }

  const text = (value) => typeof value === "string" && value.trim().length > 0;
  const strings = (value) => Array.isArray(value) && value.length > 0 && value.every(text);

  async function readJson(relativePath) {
    let response;
    try {
      response = await fetch(new URL(relativePath, appBase));
    } catch {
      throw failure("unavailable", "시연 카탈로그 자료를 불러오지 못했습니다. 다시 시도해 주세요.", "", true);
    }
    if (!response.ok) throw failure("unavailable", "시연 카탈로그 자료를 불러오지 못했습니다. 다시 시도해 주세요.", "", true);
    try {
      return await response.json();
    } catch {
      throw failure("invalid_payload", "시연 카탈로그 자료 형식이 올바르지 않습니다.");
    }
  }

  function validMedia(item, projectId) {
    if (!item || item.project_id !== projectId || !text(item.id) || !["image", "video"].includes(item.kind) ||
        !["actual", "synthetic"].includes(item.content_kind) || !text(item.alt) ||
        !/^media\/catalog\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|png|jpe?g|webp|mp4|webm)$/.test(item.src)) return false;
    if ((item.kind === "video") !== /\.(?:mp4|webm)$/.test(item.src)) return false;
    const provenance = item.provenance;
    return provenance && ["owned", "licensed"].includes(provenance.rights_status) &&
      text(provenance.rights_note) && (provenance.source_url === null || text(provenance.source_url)) &&
      (provenance.checked_at === null || text(provenance.checked_at)) &&
      (item.text_sources === undefined || strings(item.text_sources));
  }

  function project(item, index, media) {
    const field = "candidates[" + index + "]";
    if (!item || !text(item.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || !text(item.name) ||
        !text(item.summary) || !text(item.source_status) || !Object.hasOwn(kinds, item.kind) ||
        !strings(item.topics) || !item.topics.every((topic) => topics.has(topic)) ||
        !strings(item.method) || typeof item.external_ai !== "boolean" || typeof item.install !== "boolean" ||
        !strings(item.ecosystems) || !item.ecosystems.every((value) => ["any", "google", "microsoft", "other"].includes(value)) ||
        (item.hosting !== undefined && !["self_hosted", "cloud"].includes(item.hosting))) {
      throw failure("invalid_payload", "시연 후보의 필수 정보나 분류가 올바르지 않습니다.", field);
    }
    const evidenceId = "brief-" + item.id;
    const known = (value) => ({state: "known", value, evidence_ids: [evidenceId]});
    return {
      id: item.id,
      name: item.name,
      summary: item.summary,
      kind: kinds[item.kind],
      tasks: [...item.topics],
      method: item.method.map((step) => ({text: step, origin: "mock", evidence_ids: [evidenceId]})),
      requirements: {
        external_ai: known(item.external_ai),
        installation: known(item.install),
        ecosystems: known([...item.ecosystems]),
        hosting: item.hosting ? known(item.hosting) : {state: "unknown", value: null, evidence_ids: []},
      },
      cost: {state: "unknown", amount: null, currency: null, period: null, evidence_ids: []},
      evidence: [{id: evidenceId, level: "mock", claim: item.source_status,
        reference: "shared/data/brief_mock.json#" + item.id, checked_at: null}],
      media: media.filter((entry) => validMedia(entry, item.id)),
      fallback: {kind: "text", label: "합성 활용 예시 · 실행 미검증", text: item.method.join(" · "), steps: []},
    };
  }


  // Used by both list and detail; invalid media falls back, invalid project facts fail closed.
  function validateProject(item) {
    const bad = () => {throw failure("invalid_payload", "프로젝트 정보가 올바르지 않습니다.", "project");};
    const ids = (values) => Array.isArray(values) && values.every(text);
    if (!item || !text(item.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || !text(item.name) || !text(item.summary) ||
        !["service", "public_project", "internal_method"].includes(item.kind) || !strings(item.tasks) || !item.tasks.every((v) => topics.has(v)) ||
        !Array.isArray(item.evidence) || !item.evidence.length || !Array.isArray(item.method) || !item.method.length || !Array.isArray(item.media)) bad();
    for (const e of item.evidence) {
      if (!e || !text(e.id) || !["mock", "reference_read", "code_reviewed", "executed", "unknown"].includes(e.level) ||
          !text(e.claim) || !text(e.reference) || !(e.checked_at === null || text(e.checked_at))) bad();
    }
    const evidenceIds = new Set(item.evidence.map((e) => e.id));
    if (evidenceIds.size !== item.evidence.length) bad();
    const refs = (values) => ids(values) && values.every((v) => evidenceIds.has(v));
    for (const m of item.method) if (!m || !text(m.text) || !["source", "proposed", "mock"].includes(m.origin) || !refs(m.evidence_ids)) bad();
    const r = item.requirements;
    for (const [key, test] of Object.entries({external_ai: (v) => typeof v === "boolean", installation: (v) => typeof v === "boolean",
      ecosystems: (v) => strings(v) && v.every((e) => ["any", "google", "microsoft", "other"].includes(e)), hosting: (v) => ["self_hosted", "cloud"].includes(v)})) {
      const value = r?.[key];
      if (!value || !refs(value.evidence_ids) || (value.state === "unknown" ? value.value !== null : value.state !== "known" || !test(value.value) || !value.evidence_ids.length)) bad();
    }
    const c = item.cost;
    if (!c || !refs(c.evidence_ids) || (c.state === "unknown" ? c.amount !== null || c.currency !== null || c.period !== null :
        c.state !== "known" || typeof c.amount !== "number" || !Number.isFinite(c.amount) || c.amount < 0 || !text(c.currency) || !text(c.period) || !c.evidence_ids.length)) bad();
    const f = item.fallback;
    if (!f || !["text", "process"].includes(f.kind) || !text(f.label) || !text(f.text) || !ids(f.steps)) bad();
    return freeze({...item, media: item.media.filter((m) => validMedia(m, item.id))});
  }

  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  async function load() {
    const [source, manifest] = await Promise.all([
      readJson("brief_mock.json"),
      readJson("media/catalog/provenance.json").catch(() => null),
    ]);
    if (!source || source.mode !== "mock" || !text(source.note) || !Array.isArray(source.candidates)) {
      throw failure("invalid_payload", "시연 카탈로그의 필수 정보가 올바르지 않습니다.");
    }
    const media = manifest?.contract_version === contractVersion && Array.isArray(manifest.media) ? manifest.media : [];
    const projects = source.candidates.map((item, index) => validateProject(project(item, index, media)));
    if (new Set(projects.map((item) => item.id)).size !== projects.length) {
      throw failure("invalid_payload", "시연 카탈로그 ID가 중복되어 있습니다.", "candidates.id");
    }
    return freeze({contract_version: contractVersion, data_mode: "mock",
      data_note: source.note + " 카탈로그도 기존 mock 후보 예시이며 실제 등록·조사·실행 검증이 완료된 목록이 아닙니다.",
      projects});
  }

  async function list() {
    if (!loading) loading = load().catch((error) => { loading = null; throw error; });
    return loading;
  }

  async function get(id) {
    if (!text(id)) throw failure("invalid_input", "프로젝트 ID를 확인해 주세요.", "id");
    const catalog = await list();
    const selected = catalog.projects.find((item) => item.id === id);
    if (!selected) throw failure("not_found", "현재 시연 카탈로그에 해당 후보가 없습니다.", "id");
    return {contract_version: contractVersion, data_mode: catalog.data_mode, data_note: catalog.data_note, project: selected};
  }

  window.ToolmeetCatalog = Object.freeze({list, get, validateProject});
})();
