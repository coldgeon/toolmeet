import fs from "node:fs";
import {validatePullRequest} from "./workflow_policy.mjs";

const eventPath = process.env.GITHUB_EVENT_PATH;
const token = process.env.GITHUB_TOKEN;
if (!eventPath || !token) {
  console.error("GITHUB_EVENT_PATH와 GITHUB_TOKEN이 필요합니다.");
  process.exit(1);
}

const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const pull = event.pull_request;
const repository = event.repository?.full_name;
if (!pull || !/^[-\w.]+\/[-\w.]+$/.test(repository || "")) {
  console.error("GitHub pull_request 이벤트를 읽을 수 없습니다.");
  process.exit(1);
}

const references = [...(pull.body || "").matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi)];
let issue = null;
if (references.length === 1) {
  const response = await fetch(`https://api.github.com/repos/${repository}/issues/${references[0][1]}`, {
    headers: {Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "toolmeet-workflow-policy"},
  });
  if (response.ok) issue = await response.json();
  else console.error(`연결 이슈 조회 실패: HTTP ${response.status}`);
}

const {errors} = validatePullRequest(pull, issue);
if (errors.length) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}
console.log("PR·이슈 연결과 필수 항목을 확인했습니다.");
