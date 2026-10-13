import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
import {validateIssueBody, validatePullRequest} from "./workflow_policy.mjs";

const issueTemplate = fs.readFileSync(new URL("../.github/ISSUE_TEMPLATE/task.md", import.meta.url), "utf8");
const prTemplate = fs.readFileSync(new URL("../.github/pull_request_template.md", import.meta.url), "utf8");
const issueBody = issueTemplate
  .replace("### 작업 유형·담당 영역\n", "### 작업 유형·담당 영역\n\nchore / repository\n")
  .replace("### 문제와 목표\n", "### 문제와 목표\n\n반복 가능한 작업 절차를 만든다.\n")
  .replace("### 작업 범위\n", "### 작업 범위\n\n템플릿과 CI를 추가한다.\n")
  .replace("### 범위 밖\n", "### 범위 밖\n\n제품 기능 변경은 없다.\n")
  .replace("- [ ] <!-- 관찰하거나 명령으로 확인할 수 있는 기준 -->", "- [ ] PR 검사 성공")
  .replace("### 검증 계획\n", "### 검증 계획\n\n정책 테스트와 npm test를 실행한다.\n")
  .replace("### 의존성과 영향\n", "### 의존성과 영향\n\n기존 CI에 새 검사를 추가한다.\n")
  .replace("- 주요 변경 경로:", "- 주요 변경 경로: .github, scripts")
  .replace("- 같은 경로를 수정하는 열린 이슈/PR:", "- 같은 경로를 수정하는 열린 이슈/PR: 없음")
  .replace("- 겹치는 작업의 조정 방법:", "- 겹치는 작업의 조정 방법: 최신 main 반영")
  .replace("### 승인 범위\n", "### 승인 범위\n\n이슈부터 PR까지.\n");
const prBody = prTemplate
  .replace("Closes #<!-- 이슈 번호 하나 -->", "Closes #12")
  .replace("## 변경 내용\n", "## 변경 내용\n\n템플릿과 검사를 추가했다.\n")
  .replace("## 검증 결과\n", "## 검증 결과\n\nnpm test 통과.\n")
  .replace("- 기준 main 커밋:", "- 기준 main 커밋: abc123")
  .replace("- 겹치는 열린 PR/변경 경로:", "- 겹치는 열린 PR/변경 경로: 없음")
  .replace("- 최신 main 반영 또는 충돌 해결 결과:", "- 최신 main 반영 또는 충돌 해결 결과: 최신 기준")
  .replace("## 미검증·남은 문제\n", "## 미검증·남은 문제\n\n서버 ruleset은 관리자 설정 대기.\n")
  .replaceAll("- [ ]", "- [x]");

test("채운 이슈·PR과 번호가 일치하는 브랜치를 허용한다", () => {
  assert.deepEqual(validateIssueBody(issueBody), []);
  assert.deepEqual(validatePullRequest({body: prBody, head: {ref: "chore/12-agent-workflow"}, base: {ref: "main"}}, {number: 12, body: issueBody}).errors, []);
});

test("빈 이슈 템플릿과 다른 번호의 브랜치를 거부한다", () => {
  assert.ok(validateIssueBody(issueTemplate).length > 0);
  const errors = validatePullRequest({body: prBody, head: {ref: "chore/13-agent-workflow"}, base: {ref: "main"}}, {number: 12, body: issueBody}).errors;
  assert.ok(errors.some((error) => error.includes("브랜치 번호")));
});

test("두 이슈를 닫는 PR과 체크리스트 미완료를 거부한다", () => {
  const errors = validatePullRequest({body: prBody.replace("Closes #12", "Closes #12\nCloses #13").replace("- [x] 이슈 하나", "- [ ] 이슈 하나"), head: {ref: "chore/12-agent-workflow"}, base: {ref: "main"}}, {number: 12, body: issueBody}).errors;
  assert.ok(errors.some((error) => error.includes("하나만")));
  assert.ok(errors.some((error) => error.includes("체크리스트")));
});
