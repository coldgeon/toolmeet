/* Browser-only mock API for the published static prototype. No user question is sent to a server. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const sourceUrl = new URL("brief_mock.json", document.currentScript.src);
  const sourcePromise = nativeFetch(sourceUrl).then((response) => {
    if (!response.ok) throw new Error("시연 데이터를 불러오지 못했습니다.");
    return response.json();
  });
  const choices = new Map();
  const labels = {
    meeting: "회의·후속 작업", summary: "자료·문서 요약", forms: "양식·초안",
    coding: "개발·자동화", planning: "기획·조사", creative: "이미지·콘텐츠",
    health: "의료", education: "교육", unknown: "분류 미확인",
  };
  const terms = {
    meeting: ["회의", "회의록", "미팅", "할 일", "담당자", "후속", "meeting"],
    summary: ["요약", "문서", "자료", "논문", "보고서", "pdf", "정리", "비교"],
    forms: ["양식", "서식", "신청서", "제안서", "계약서", "초안", "템플릿"],
    coding: ["개발", "코드", "프로그램", "깃허브", "api", "자동화"],
    planning: ["기획", "리서치", "조사", "전략", "시장"],
  };
  const rank = {possible: 0, adapt: 1, hold: 2, excluded: 3};

  function detectTopic(work) {
    const lowered = work.toLocaleLowerCase();
    let topic = "unknown";
    let hits = [];
    for (const [key, words] of Object.entries(terms)) {
      const found = words.filter((word) => lowered.includes(word));
      if (found.length > hits.length) {
        topic = key;
        hits = found;
      }
    }
    return {topic, hits};
  }

  function validate(raw) {
    if (typeof raw.work !== "string" || raw.work.trim().length < 8 || raw.work.trim().length > 1000) {
      throw new Error("업무를 8~1000자로 적어 주세요.");
    }
    const fields = {
      policy: ["allowed", "denied", "unknown"],
      installation: ["allowed", "denied", "unknown"],
      ecosystem: ["google", "microsoft", "other", "unknown"],
      data_kind: ["public", "internal", "unknown"],
      hosting: ["self_hosted", "cloud", "unknown"],
    };
    const profile = {work: raw.work.trim()};
    for (const [key, options] of Object.entries(fields)) {
      const value = raw[key] ?? "unknown";
      if (!options.includes(value)) throw new Error(`${key} 값이 올바르지 않습니다.`);
      profile[key] = value;
    }
    return profile;
  }

  function assess(candidate, profile) {
    if (candidate.external_ai && profile.policy === "denied") return ["excluded", "외부 AI 사용 불가 조건과 충돌합니다.", "정책 담당자 확인 전 이 후보에 자료를 넣지 마세요."];
    if (candidate.install && profile.installation === "denied") return ["excluded", "새 도구 설치 불가 조건과 충돌합니다.", "관리자에게 설치·실행 허용 범위를 확인하세요."];
    if (candidate.hosting === "self_hosted" && profile.hosting === "cloud") return ["excluded", "공개 템플릿의 self-hosted 전용 노드와 현재 클라우드 실행 조건이 충돌합니다.", "자체 호스팅 실행 환경을 마련할 수 있는지 관리자에게 확인하세요."];
    if (candidate.external_ai && profile.policy === "unknown") return ["hold", "외부 AI 사용 정책이 모름이므로 연결 판단을 보류합니다.", "정책 담당자에게 사용 가능 범위와 자료 전송 조건을 확인하세요."];
    if (candidate.install && profile.installation === "unknown") return ["hold", "이 후보의 실행 환경 설치 가능 여부가 모름입니다.", "관리자에게 설치 가능 여부와 시험 환경을 확인하세요."];
    if (candidate.hosting === "self_hosted" && profile.hosting !== "self_hosted") return ["hold", "공개 템플릿의 self-hosted 전용 노드를 사용할 환경인지 미확인입니다.", "관리자에게 자체 호스팅 n8n과 community node 사용 가능 여부를 확인하세요."];
    if (candidate.external_ai && profile.data_kind !== "public") return ["hold", "업무 자료의 외부 전송 허용 범위가 확인되지 않았습니다.", "자료 책임자에게 이번 시험 자료의 전송 허용을 확인하세요."];
    if (!["unknown", "other"].includes(profile.ecosystem) && !candidate.ecosystems.includes(profile.ecosystem) && !candidate.ecosystems.includes("any")) return ["adapt", "현재 사용 도구와 후보의 연결 대상이 달라 변경이 필요합니다.", "시험 환경에서 연결 대상 변경 가능 여부를 확인하세요."];
    if (["unknown", "other"].includes(profile.ecosystem) && !candidate.ecosystems.includes("any")) return ["hold", "필요한 업무 도구 계정·권한이 확인되지 않았습니다.", "해당 도구의 계정과 시험용 공간 사용 가능 여부를 확인하세요."];
    return ["possible", "입력 조건과 알려진 필수 조건의 충돌은 없습니다. 실제 사용 가능성은 아직 미검증입니다.", "공개·합성 자료로 한 번 시험하고 지원 범위·권한·요금·결과를 확인하세요."];
  }

  function buildBrief(raw, source) {
    const profile = validate(raw);
    const {topic, hits} = detectTopic(profile.work);
    const catalog = source.candidates;
    const base = topic === "unknown"
      ? catalog.filter((candidate) => candidate.id === "local-review")
      : catalog.filter((candidate) => candidate.topics.includes(topic) && candidate.id !== "local-review");
    const selected = base.map((candidate) => {
      const [status, fit_reason, first_gate] = assess(candidate, profile);
      const reasons = [
        hits.length
          ? `입력 업무의 ‘${hits.slice(0, 2).join(", ")}’ 표현과 ${labels[topic]} 맥락이 연결됩니다.`
          : "저장된 단어 규칙에서 관련 업무 분야를 찾지 못해 특정 서비스 추천을 보류했습니다.",
        candidate.why,
      ];
      if (profile.ecosystem !== "unknown") {
        reasons.push({google: "Google 업무 환경", microsoft: "Microsoft 업무 환경", other: "기타 업무 환경"}[profile.ecosystem] + " 조건을 판정에 반영했습니다.");
      }
      if (candidate.hosting === "self_hosted") reasons.push("공개 설명의 self-hosted 실행 조건을 판정에 반영했습니다.");
      return {
        id: candidate.id, name: candidate.name, kind: candidate.kind, summary: candidate.summary,
        method: candidate.method, source_status: candidate.source_status, source_url: candidate.source_url,
        status, fit_reason, reasons, first_gate,
        first_check: ["possible", "adapt"].includes(status) ? candidate.first_check : "확인 전에는 원본 연결이나 시험을 진행하지 않습니다.",
      };
    });
    selected.sort((a, b) => rank[a.status] - rank[b.status] || (a.kind === "AI 서비스" ? 0 : 1) - (b.kind === "AI 서비스" ? 0 : 1) || a.name.localeCompare(b.name));
    if (!selected.length || selected.every((candidate) => candidate.status === "excluded")) {
      const fallback = catalog.find((candidate) => candidate.id === "local-review");
      const [status, fit_reason, first_gate] = assess(fallback, profile);
      selected.push({
        id: fallback.id, name: fallback.name, kind: fallback.kind, summary: fallback.summary,
        method: fallback.method, source_status: fallback.source_status, source_url: null,
        first_check: fallback.first_check, status, fit_reason, first_gate,
        reasons: ["외부 AI나 설치 조건과 충돌해도 업무 구조와 시험 기준은 정리할 수 있습니다."],
      });
    }
    const candidates = selected.slice(0, 5);
    const selectedById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const catalogById = new Map(catalog.map((candidate) => [candidate.id, candidate]));
    const environmentLabel = {google: "Google Workspace", microsoft: "Microsoft 365", other: "기타 도구", unknown: "미확인 도구"}[profile.ecosystem];
    const related = source.news.filter((news) => news.topic === topic).map((news) => {
      const linked = news.candidate_ids.filter((id) => selectedById.has(id));
      const statuses = linked.map((id) => selectedById.get(id).status);
      if (statuses.length && statuses.every((status) => status === "excluded") && selectedById.has("local-review")) linked.push("local-review");
      const bestRank = statuses.length ? Math.min(...statuses.map((status) => rank[status])) : 4;
      const environmentMatch = ["google", "microsoft"].includes(profile.ecosystem) && linked.some((id) => catalogById.get(id)?.ecosystems.includes(profile.ecosystem));
      const context = statuses.length && statuses.every((status) => status === "excluded")
        ? `${environmentLabel} 환경에서 연결 후보가 입력 조건과 충돌합니다. 소식은 참고 주제로만 보세요.`
        : statuses.includes("possible")
          ? `${environmentLabel} 환경에서 입력 조건과 충돌 없는 검토 후보가 연결됩니다. 실제 계정·지원 범위는 첫 시험에서 확인해야 합니다.`
          : `${environmentLabel} 환경에서 연결 후보의 정책·설치·계정 조건이 미확인입니다. 확인 전에는 연결을 보류합니다.`;
      return {id: news.id, title: news.title, summary: news.summary, topic: labels[topic], angle: news.angle, candidate_ids: linked, context, priority: [bestRank, environmentMatch ? 0 : 1]};
    });
    related.sort((a, b) => a.priority[0] - b.priority[0] || a.priority[1] - b.priority[1]);
    related.forEach((item) => delete item.priority);
    const other = source.news.filter((news) => ["creative", "health", "education"].includes(news.topic))
      .map((news) => ({id: news.id, title: news.title, topic: labels[news.topic], summary: news.summary}));
    return {
      data_mode: source.mode, data_note: source.note, data_updated_at: source.updated_at,
      profile, topic, topic_label: labels[topic], matched_terms: hits,
      classification_note: hits.length ? "저장된 단어 규칙으로 임시 분류 · AI 문장 이해 아님" : "저장된 단어 규칙에서 일치 없음 · 업무를 더 구체적으로 적어 주세요",
      related_news: related, other_news: other, candidates,
      stage: "방법 후보·가정 미리보기 · 원본 연결 및 첫 시험 전",
    };
  }

  function json(value, status = 200) {
    return new Response(JSON.stringify(value), {status, headers: {"Content-Type": "application/json; charset=utf-8"}});
  }

  window.fetch = async (input, options = {}) => {
    const pathname = new URL(input instanceof Request ? input.url : input, location.href).pathname;
    const endpoint = pathname.match(/\/api\/(board|news|brief|brief\/confirm)$/)?.[1];
    if (!endpoint) return nativeFetch(input, options);
    try {
      const source = await sourcePromise;
      if (endpoint === "board") return json({data_mode: source.mode, note: source.note, posts: source.board_posts.map((post) => ({...post, topic_label: labels[post.topic]}))});
      if (endpoint === "news") {
        const candidateNames = new Map(source.candidates.map((candidate) => [candidate.id, candidate.name]));
        const sampleWork = new Map(source.board_posts.map((post) => [post.topic, post.work]));
        return json({data_mode: source.mode, note: source.note, news: source.news.map((item) => ({
          id: item.id, topic: item.topic, topic_label: labels[item.topic], title: item.title,
          summary: item.summary, angle: item.angle,
          candidate_names: item.candidate_ids.map((id) => candidateNames.get(id)).filter(Boolean),
          sample_work: sampleWork.get(item.topic) ?? null,
        }))});
      }
      const body = JSON.parse(options.body || "{}");
      if (endpoint === "brief") {
        const result = buildBrief(body, source);
        const token = crypto.randomUUID();
        choices.set(token, {expires: Date.now() + 900000, candidates: new Map(result.candidates.map((candidate) => [candidate.id, {status: candidate.status, source_url: candidate.source_url}]))});
        result.candidates.forEach((candidate) => delete candidate.source_url);
        result.brief_token = token;
        return json(result);
      }
      if (body.confirmed !== true) throw new Error("방법의 방향 확인이 필요합니다.");
      const saved = choices.get(body.brief_token);
      const candidate = saved?.candidates.get(body.candidate_id);
      if (!saved || saved.expires < Date.now() || !candidate) throw new Error("현재 조건으로 후보를 다시 확인하세요.");
      if (!["possible", "adapt"].includes(candidate.status) || !candidate.source_url) throw new Error("정책·설치·계정 조건이 확인되기 전에는 원본 연결 안내를 보류합니다.");
      return json({source_url: candidate.source_url, stage: "원본 링크 안내 · 첫 시험 전"});
    } catch (error) {
      return json({error: error.message || "시연 데이터를 처리하지 못했습니다."}, 400);
    }
  };
})();
