"""Small, auditable text-context store for the local discovery prototype.

The JSON collection is deliberately small. More records can be added without
changing the discovery API; this is not a claim that a large repository exists.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT / "data" / "solutions.json"


def load_catalog() -> list[dict]:
    records = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if not isinstance(records, list) or not records:
        raise ValueError("솔루션 컨텍스트가 비어 있습니다.")
    seen = set()
    for record in records:
        if record["id"] in seen:
            raise ValueError(f"중복 솔루션 ID: {record['id']}")
        seen.add(record["id"])
        source = ROOT / record["local_source"]
        if not source.is_file() or record["evidence_quote"] not in source.read_text(encoding="utf-8"):
            raise ValueError(f"근거 문구를 확인할 수 없습니다: {record['id']}")
        if not record["source_url"].startswith("https://"):
            raise ValueError(f"출처 URL이 올바르지 않습니다: {record['id']}")
        if not isinstance(record["external_ai"], bool) or not record["source_steps"] or not record["proposed_steps"]:
            raise ValueError(f"후보 조건·단계가 올바르지 않습니다: {record['id']}")
    return records


CATALOG = load_catalog()
BY_ID = {record["id"]: record for record in CATALOG}


def assess_constraints(query: str, record: dict, policy: str = "unknown") -> tuple[bool, list[str]]:
    text = " ".join(query.lower().split())
    issues = []
    external_forbidden = policy == "denied" or any(term in text for term in (
        "외부 ai 금지", "외부 ai 불가", "외부 ai 사용 불가", "외부 ai 안", "외부 전송 금지",
        "외부 전송 불가", "외부 전송 안", "사내망만", "내부망만", "온프레미스만",
    )) or bool(re.search(r"(?:외부\s*(?:ai|인공지능|서비스|전송|반출)|밖으로).{0,24}(?:금지|불가|안|못|없|않|허용되지)", text))
    blocked = external_forbidden and record["external_ai"]
    if blocked:
        issues.append("외부 AI·전송 금지 조건과 이 후보의 외부 AI API 요구가 충돌합니다.")
    pdf_output = bool(re.search(r"pdf로\s*(?:만들|생성|출력|변환|내보내)", text))
    pdf_as_input = "pdf" in text and not pdf_output and any(term in text for term in ("회의록", "문서", "파일", "자료", "입력", "읽"))
    if pdf_as_input and "pdf" not in record["input"].lower():
        issues.append("PDF 입력 지원이 저장된 설명에서 확인되지 않습니다.")
    excel_as_output = any(term in text for term in ("엑셀로", "excel로", "엑셀 파일로", "excel 파일로"))
    if excel_as_output and not any(term in record["output"].lower() for term in ("excel", "엑셀")):
        issues.append("Excel 파일 출력이 저장된 설명에서 확인되지 않습니다.")
    return blocked, issues


def search(query: str, limit: int = 3) -> list[dict]:
    text = " ".join(query.lower().split())
    ranked = []
    for record in CATALOG:
        anchors = [term for term in record["anchors"] if term.lower() in text]
        if not anchors:
            continue
        extras = [term for term in record["keywords"] if term.lower() in text and term not in record["anchors"]]
        score = len(anchors) * 6 + len(extras) * 2
        requested_outputs = ("시트", "sheets", "메일", "gmail", "pdf", "markdown", "html")
        score += sum(8 for term in requested_outputs if term in text and term in record["output"].lower())
        ranked.append((score, record["id"], record, anchors + extras))
    ranked.sort(key=lambda row: (-row[0], row[1]))
    results = []
    for _, _, record, terms in ranked[:limit]:
        blocked, issues = assess_constraints(query, record)
        results.append({
            "id": record["id"],
            "title": record["title"],
            "kind": record["kind"],
            "summary": record["summary"],
            "input": record["input"],
            "output": record["output"],
            "source_steps": record["source_steps"],
            "proposed_steps": record["proposed_steps"],
            "adaptation": record["adaptation"],
            "unknowns": record["unknowns"],
            "evidence_quote": record["evidence_quote"],
            "evidence_status": record["evidence_status"],
            "checked_at": record["checked_at"],
            "matched_terms": terms,
            "fit_status": "명시 조건 충돌 · 후보 제외" if blocked else "형식 지원 미확인 · 연결 보류" if issues else "설명상 관련 · 회사 적합성 미판정",
            "blocked": blocked,
            "condition_issues": issues,
        })
    return results


def preview(query: str, record: dict) -> dict:
    _, issues = assess_constraints(query, record)
    return {
        "title": record["title"],
        "query": query,
        "input": record["input"],
        "output": record["output"],
        "source_steps": record["source_steps"],
        "proposed_steps": record["proposed_steps"],
        "blank_output": {"입력": record["input"], "처리 결과": "— 실제 문서 처리 전 —", "근거": "— 원문 대조 전 —", "검토": "사람 확인 필요"},
        "assumptions": issues + record["unknowns"],
        "condition_issues": issues,
        "status": "2D 설계 시뮬레이션 · 도구 실행 전",
    }
