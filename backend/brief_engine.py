"""Deterministic, replaceable mock feed and recommendation layer for the local demo."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DATA = ROOT.parent / "shared" / "data"
TOPIC_RULES = json.loads((DATA / "topic_rules.json").read_text(encoding="utf-8"))
TOPIC_TERMS = TOPIC_RULES["terms"]
TOPIC_LABELS = {
    "meeting": "회의·후속 작업", "summary": "자료·문서 요약", "forms": "양식·초안",
    "coding": "개발·자동화", "planning": "기획·조사", "creative": "이미지·콘텐츠",
    "health": "의료", "education": "교육",
    "unknown": "분류 미확인",
}


class MockBriefRepository:
    """Swap this adapter for a verified feed/catalog provider later."""

    def __init__(self, path: Path = DATA / "brief_mock.json") -> None:
        self.path = path

    def load(self) -> dict:
        return json.loads(self.path.read_text(encoding="utf-8"))


def board_feed(repository: MockBriefRepository | None = None) -> dict:
    source = (repository or MockBriefRepository()).load()
    return {"data_mode": source["mode"], "note": source["note"],
            "posts": [{**item, "topic_label": TOPIC_LABELS[item["topic"]]} for item in source["board_posts"]]}


def news_feed(repository: MockBriefRepository | None = None) -> dict:
    source = (repository or MockBriefRepository()).load()
    by_candidate = {item["id"]: item["name"] for item in source["candidates"]}
    by_topic = {item["topic"]: item["work"] for item in source["board_posts"]}
    news = []
    for item in source["news"]:
        news.append({"id": item["id"], "topic": item["topic"], "topic_label": TOPIC_LABELS[item["topic"]],
                     "title": item["title"], "summary": item["summary"], "angle": item["angle"],
                     "candidate_names": [by_candidate[cid] for cid in item["candidate_ids"] if cid in by_candidate],
                     "sample_work": by_topic.get(item["topic"])})
    return {"data_mode": source["mode"], "note": source["note"], "news": news}


def detect_topic(work: str) -> tuple[str, list[str]]:
    lowered = work.lower()
    hits = {topic: [term for term in terms if term in lowered] for topic, terms in TOPIC_TERMS.items()}
    def score(key: str) -> int:
        return sum(1 if term in TOPIC_RULES["weak_terms"] else 2 for term in hits[key])
    topic = max(TOPIC_TERMS, key=lambda key: (score(key), -list(TOPIC_TERMS).index(key)))
    return (topic, hits[topic]) if hits[topic] else ("unknown", [])


def validate_input(data: dict) -> dict:
    work = data.get("work")
    if not isinstance(work, str) or not 8 <= len(work.strip()) <= 1000:
        raise ValueError("업무를 8~1000자로 적어 주세요.")
    fields = {
        "policy": ("allowed", "denied", "unknown"),
        "installation": ("allowed", "denied", "unknown"),
        "ecosystem": ("google", "microsoft", "other", "unknown"),
        "data_kind": ("public", "internal", "unknown"),
        "hosting": ("self_hosted", "cloud", "unknown"),
    }
    result = {"work": work.strip()}
    for key, options in fields.items():
        value = data.get(key, "unknown")
        if value not in options:
            raise ValueError(f"{key} 값이 올바르지 않습니다.")
        result[key] = value
    return result


def assess(candidate: dict, profile: dict) -> tuple[str, str, str]:
    """Return status, reason, and concrete first gate, never a verified availability claim."""
    if candidate["external_ai"] and profile["policy"] == "denied":
        return "excluded", "외부 AI 사용 불가 조건과 충돌합니다.", "정책 담당자 확인 전 이 후보에 자료를 넣지 마세요."
    if candidate["install"] and profile["installation"] == "denied":
        return "excluded", "새 도구 설치 불가 조건과 충돌합니다.", "관리자에게 설치·실행 허용 범위를 확인하세요."
    if candidate.get("hosting") == "self_hosted" and profile["hosting"] == "cloud":
        return "excluded", "공개 템플릿의 self-hosted 전용 노드와 현재 클라우드 실행 조건이 충돌합니다.", "자체 호스팅 실행 환경을 마련할 수 있는지 관리자에게 확인하세요."
    if candidate["external_ai"] and profile["policy"] == "unknown":
        return "hold", "외부 AI 사용 정책이 모름이므로 연결 판단을 보류합니다.", "정책 담당자에게 사용 가능 범위와 자료 전송 조건을 확인하세요."
    if candidate["install"] and profile["installation"] == "unknown":
        return "hold", "이 후보의 실행 환경 설치 가능 여부가 모름입니다.", "관리자에게 설치 가능 여부와 시험 환경을 확인하세요."
    if candidate.get("hosting") == "self_hosted" and profile["hosting"] != "self_hosted":
        return "hold", "공개 템플릿의 self-hosted 전용 노드를 사용할 환경인지 미확인입니다.", "관리자에게 자체 호스팅 n8n과 community node 사용 가능 여부를 확인하세요."
    if candidate["external_ai"] and profile["data_kind"] != "public":
        return "hold", "업무 자료의 외부 전송 허용 범위가 확인되지 않았습니다.", "자료 책임자에게 이번 시험 자료의 전송 허용을 확인하세요."
    if profile["ecosystem"] not in ("unknown", "other") and profile["ecosystem"] not in candidate["ecosystems"] and "any" not in candidate["ecosystems"]:
        return "adapt", "현재 사용 도구와 후보의 연결 대상이 달라 변경이 필요합니다.", "시험 환경에서 연결 대상 변경 가능 여부를 확인하세요."
    if profile["ecosystem"] in ("unknown", "other") and "any" not in candidate["ecosystems"]:
        return "hold", "필요한 업무 도구 계정·권한이 확인되지 않았습니다.", "해당 도구의 계정과 시험용 공간 사용 가능 여부를 확인하세요."
    return "possible", "입력 조건과 알려진 필수 조건의 충돌은 없습니다. 실제 사용 가능성은 아직 미검증입니다.", "공개·합성 자료로 한 번 시험하고 지원 범위·권한·요금·결과를 확인하세요."


def build_brief(raw: dict, repository: MockBriefRepository | None = None) -> dict:
    profile = validate_input(raw)
    source = (repository or MockBriefRepository()).load()
    topic, hits = detect_topic(profile["work"])
    selected = []
    candidates = ([item for item in source["candidates"] if item["id"] == "local-review"] if topic == "unknown"
                  else [item for item in source["candidates"] if topic in item["topics"] and item["id"] != "local-review"])
    for item in candidates:
        status, fit_reason, gate = assess(item, profile)
        reasons = [f"입력 업무의 ‘{', '.join(hits[:2])}’ 표현과 {TOPIC_LABELS[topic]} 맥락이 연결됩니다." if hits else "저장된 단어 규칙에서 관련 업무 분야를 찾지 못해 특정 서비스 추천을 보류했습니다.", item["why"]]
        if profile["ecosystem"] != "unknown":
            reasons.append({"google":"Google 업무 환경", "microsoft":"Microsoft 업무 환경", "other":"기타 업무 환경"}[profile["ecosystem"]] + " 조건을 판정에 반영했습니다.")
        if item.get("hosting") == "self_hosted":
            reasons.append("공개 설명의 self-hosted 실행 조건을 판정에 반영했습니다.")
        selected.append({**{key: item[key] for key in ("id", "name", "kind", "summary", "method", "source_status")},
                         "status": status, "fit_reason": fit_reason, "reasons": reasons,
                         "first_gate": gate, "first_check": item["first_check"] if status in ("possible", "adapt") else "확인 전에는 원본 연결이나 시험을 진행하지 않습니다.",
                         "source_url": item["source_url"]})
    rank = {"possible": 0, "adapt": 1, "hold": 2, "excluded": 3}
    selected.sort(key=lambda item: (rank[item["status"]], 0 if item["kind"] == "AI 서비스" else 1, item["name"]))
    if not selected or all(item["status"] == "excluded" for item in selected):
        fallback = next(item for item in source["candidates"] if item["id"] == "local-review")
        status, fit_reason, gate = assess(fallback, profile)
        selected.append({**{key: fallback[key] for key in ("id", "name", "kind", "summary", "method", "first_check", "source_status")},
                         "status": status, "fit_reason": fit_reason,
                         "reasons": ["외부 AI나 설치 조건과 충돌해도 업무 구조와 시험 기준은 정리할 수 있습니다."],
                         "first_gate": gate, "source_url": None})
    selected = selected[:5]
    ids = {item["id"] for item in selected}
    related = []
    selected_by_id = {item["id"]: item for item in selected}
    catalog_by_id = {item["id"]: item for item in source["candidates"]}
    for news in source["news"]:
        if news["topic"] != topic:
            continue
        linked = [item for item in news["candidate_ids"] if item in ids]
        linked_statuses = [selected_by_id[item]["status"] for item in linked]
        if linked_statuses and all(item == "excluded" for item in linked_statuses) and "local-review" in ids:
            linked.append("local-review")
        best_rank = min((rank[item] for item in linked_statuses), default=4)
        environment_match = bool(profile["ecosystem"] in ("google", "microsoft") and any(
            profile["ecosystem"] in catalog_by_id[item]["ecosystems"] for item in linked))
        environment_label = {"google": "Google Workspace", "microsoft": "Microsoft 365", "other": "기타 도구", "unknown": "미확인 도구"}[profile["ecosystem"]]
        if linked_statuses and all(item == "excluded" for item in linked_statuses):
            context = f"{environment_label} 환경에서 연결 후보가 입력 조건과 충돌합니다. 소식은 참고 주제로만 보세요."
        elif linked_statuses and any(item == "possible" for item in linked_statuses):
            context = f"{environment_label} 환경에서 입력 조건과 충돌 없는 검토 후보가 연결됩니다. 실제 계정·지원 범위는 첫 시험에서 확인해야 합니다."
        else:
            context = f"{environment_label} 환경에서 연결 후보의 정책·설치·계정 조건이 미확인입니다. 확인 전에는 연결을 보류합니다."
        related.append({"id": news["id"], "title": news["title"], "summary": news["summary"],
                        "topic": TOPIC_LABELS[topic], "angle": news["angle"], "candidate_ids": linked,
                        "context": context, "priority": (best_rank, 0 if environment_match else 1)})
    related.sort(key=lambda item: item["priority"])
    for item in related:
        del item["priority"]
    other = [{"id": item["id"], "title": item["title"], "topic": TOPIC_LABELS[item["topic"]], "summary": item["summary"]}
             for item in source["news"] if item["topic"] in ("creative", "health", "education")]
    return {"data_mode": source["mode"], "data_note": source["note"], "data_updated_at": source["updated_at"],
            "profile": profile, "topic": topic, "topic_label": TOPIC_LABELS[topic], "matched_terms": hits,
            "classification_note": "저장된 단어 규칙으로 임시 분류 · AI 문장 이해 아님" if hits else "저장된 단어 규칙에서 일치 없음 · 업무를 더 구체적으로 적어 주세요",
            "related_news": related, "other_news": other, "candidates": selected,
            "stage": "방법 후보·가정 미리보기 · 원본 연결 및 첫 시험 전"}
