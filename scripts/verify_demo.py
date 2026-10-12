"""Run the three synthetic Markdown cases and their changed-input copies.

This makes real Codex CLI calls. It uses only public/synthetic docs/demo files.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app import DEMO, TASKS, run_codex  # noqa: E402


INTAKES = {
    "meeting": {"job": "회의록의 결정과 할 일을 표로 정리", "current": "본문을 읽고 수동 복사", "result": "결정·할 일·담당자·기한·원문 근거"},
    "summary": {"job": "여러 문서를 한 보고서로 요약", "current": "세 문서를 수동 비교", "result": "공통점·차이·출처·미확인"},
    "template": {"job": "여러 문서를 한 보고서로 요약하고 문서별 근거를 남길 도구 평가", "current": "후보 설명과 평가 양식을 수동 대조", "result": "요약 업무에 맞는지 모든 양식 항목과 근거·미확인"},
}
CHANGES = {
    "meeting": ("2026-10-12까지 요약 후보", "2026-10-13까지 요약 후보"),
    "summary": ("Markdown 형식의 요약으로 반환", "HTML 형식의 요약으로 반환"),
    "template": ("3. 입력과 출력:", "3. 입력·출력·저장 위치:"),
}


def documents(task: str) -> list[dict]:
    return [{"name": name, "text": (DEMO / name).read_text(encoding="utf-8")} for name in TASKS[task]]


def changed_copy(task: str, originals: list[dict]) -> list[dict]:
    copied = [dict(doc) for doc in originals]
    before, after = CHANGES[task]
    index = 0
    assert copied[index]["text"].count(before) == 1, (task, before)
    copied[index]["text"] = copied[index]["text"].replace(before, after)
    copied[index]["name"] = "변경복사본-" + copied[index]["name"]
    return copied


def review(task: str, base: dict, changed: dict) -> list[str]:
    problems = []
    for label, result in (("원본", base), ("변경본", changed)):
        if not result["evidence"] or not all(item["verified"] for item in result["evidence"]):
            problems.append(f"{task} {label}: 인용 근거 미검증")
        if not result["content"].strip():
            problems.append(f"{task} {label}: 결과 없음")
    if base["content"] == changed["content"]:
        problems.append(f"{task}: 입력 변경 후 결과 동일")
    if task == "summary":
        urls = [
            "https://n8n.io/workflows/8210-summarize-content-from-urls-text-and-pdfs-using-openai/",
            "https://n8n.io/workflows/5904-transform-meeting-notes-into-action-items-with-gemini-and-google-workspace/",
            "https://n8n.io/workflows/5808-create-custom-pdf-documents-from-templates-with-gemini-and-google-drive/",
        ]
        for label, result in (("원본", base), ("변경본", changed)):
            for url in urls:
                if url not in result["content"]:
                    problems.append(f"summary {label}: 공개 URL 누락: {url}")
    for token in {
        "meeting": ["평가 담당 A", "2026-10-12", "평가 담당 B", "미확인"],
        "summary": ["공통점", "차이", "Markdown", "미확인"],
        "template": ["1.", "10.", "여러 문서", "보고서", "미확인"],
    }[task]:
        if token not in base["content"]:
            problems.append(f"{task}: 원본 결과에 {token!r} 없음")
    variant_token = {"meeting": "2026-10-13", "summary": "HTML", "template": "저장 위치"}[task]
    if variant_token not in changed["content"]:
        problems.append(f"{task}: 변경 결과에 {variant_token!r} 없음")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", type=Path, help="Write synthetic input hashes and full run results as JSON")
    parser.add_argument("--task", choices=("meeting", "summary", "template"), help="Run only one case")
    args = parser.parse_args()
    version = subprocess.run(["codex", "--version"], capture_output=True, text=True, check=False)
    record = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "docs/demo synthetic/public summaries",
        "runtime": {"tool": version.stdout.strip() or "Codex CLI · version unknown", "model": "CLI default, not pinned"},
        "cases": {},
    }
    if args.task and args.save and args.save.exists():
        record = json.loads(args.save.read_text(encoding="utf-8"))
        record["generated_at"] = datetime.now(timezone.utc).isoformat()
        record["runtime"] = {"tool": version.stdout.strip() or "Codex CLI · version unknown", "model": "CLI default, not pinned"}
    failures = []
    for task in ((args.task,) if args.task else ("meeting", "summary", "template")):
        source_docs = documents(task)
        print(f"{task}: original", flush=True)
        base = run_codex(task, source_docs, INTAKES[task])
        print(f"{task}: changed copy", flush=True)
        changed = run_codex(task, changed_copy(task, source_docs), INTAKES[task])
        problems = review(task, base, changed)
        record["cases"][task] = {"original": base, "changed": changed, "review_findings": problems}
        failures.extend(problems)
        print(f"{task}: {'PASS' if not problems else 'REVIEW'}", flush=True)
    if args.save:
        args.save.parent.mkdir(parents=True, exist_ok=True)
        args.save.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"saved: {args.save}")
    for problem in failures:
        print("-", problem)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
