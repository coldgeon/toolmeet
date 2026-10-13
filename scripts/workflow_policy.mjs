const ISSUE_SECTIONS = [
  "작업 유형·담당 영역",
  "문제와 목표",
  "작업 범위",
  "범위 밖",
  "완료 기준",
  "검증 계획",
  "의존성과 영향",
  "변경 예정 경로·충돌 확인",
  "승인 범위",
];

const PR_SECTIONS = [
  "연결 이슈",
  "변경 내용",
  "검증 결과",
  "충돌 확인",
  "미검증·남은 문제",
  "체크리스트",
];

function section(body, level, title) {
  const lines = body.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  const prefix = "#".repeat(level) + " ";
  const start = lines.findIndex((line) => line.trim() === prefix + title);
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && /^#{1,6} /.test(line) && line.match(/^#+/)[0].length <= level);
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
}

function filledLabel(text, label) {
  return text.split(/\r?\n/).some((line) => {
    const match = line.match(/^\s*-?\s*([^:]+):\s*(.*)$/);
    return match && match[1].trim() === label && match[2].trim().length > 0;
  });
}

export function validateIssueBody(body) {
  const errors = [];
  for (const title of ISSUE_SECTIONS) {
    if (!section(body || "", 3, title)) errors.push(`이슈의 '${title}' 항목을 채우세요.`);
  }
  const criteria = section(body || "", 3, "완료 기준") || "";
  if (!/^\s*- \[[ xX]\] \S/m.test(criteria)) errors.push("완료 기준에 구체적인 체크 항목을 적으세요.");
  const overlap = section(body || "", 3, "변경 예정 경로·충돌 확인") || "";
  for (const label of ["주요 변경 경로", "같은 경로를 수정하는 열린 이슈/PR", "겹치는 작업의 조정 방법"]) {
    if (!filledLabel(overlap, label)) errors.push(`'${label}' 값을 적으세요. 해당 사항이 없으면 '없음'으로 적으세요.`);
  }
  return errors;
}

export function validatePullRequest(pull, issue) {
  const errors = [];
  const body = pull?.body || "";
  for (const title of PR_SECTIONS) {
    if (!section(body, 2, title)) errors.push(`PR의 '${title}' 항목을 채우세요.`);
  }
  const references = [...body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi)];
  if (references.length !== 1) errors.push("PR 본문에 'Closes #번호' 하나만 적으세요.");
  const number = references.length === 1 ? Number(references[0][1]) : null;
  const branch = pull?.head?.ref || "";
  const branchMatch = branch.match(/^(?:feat|fix|docs|chore|test|refactor)\/(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  if (!branchMatch) errors.push("브랜치를 '유형/이슈번호-짧은-이름' 형식으로 만드세요.");
  else if (number !== Number(branchMatch[1])) errors.push("브랜치 번호와 'Closes #번호'가 다릅니다.");
  if (pull?.base?.ref !== "main") errors.push("PR 대상 브랜치는 main이어야 합니다.");
  const collision = section(body, 2, "충돌 확인") || "";
  for (const label of ["기준 main 커밋", "겹치는 열린 PR/변경 경로", "최신 main 반영 또는 충돌 해결 결과"]) {
    if (!filledLabel(collision, label)) errors.push(`PR의 '${label}' 값을 적으세요.`);
  }
  const checklist = section(body, 2, "체크리스트") || "";
  if ((checklist.match(/^- \[x\] /gim) || []).length !== 4 || /^- \[ \] /m.test(checklist)) {
    errors.push("PR 체크리스트 네 항목을 확인하고 표시하세요.");
  }
  if (number && (!issue || issue.number !== number || issue.pull_request)) errors.push("연결된 이슈를 확인할 수 없습니다.");
  if (issue && !issue.pull_request) errors.push(...validateIssueBody(issue.body));
  return {errors, issueNumber: number};
}
