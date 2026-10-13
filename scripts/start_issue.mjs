import fs from "node:fs";
import path from "node:path";
import {execFileSync, spawnSync} from "node:child_process";
import {validateIssueBody} from "./workflow_policy.mjs";

const [numberText, kind, slug, option] = process.argv.slice(2);
if (!/^\d+$/.test(numberText || "") || !["feat", "fix", "docs", "chore", "test", "refactor"].includes(kind) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "") || (option && option !== "--dry-run")) {
  console.error("사용법: npm run task:start -- <이슈번호> <feat|fix|docs|chore|test|refactor> <영문-이름> [--dry-run]");
  process.exit(1);
}

function command(program, args, cwd, allowFailure = false) {
  const result = spawnSync(program, args, {cwd, encoding: "utf8", shell: false});
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(`${program} ${args.join(" ")} 실패: ${result.stderr || result.stdout}`);
  return result;
}

try {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {encoding: "utf8"}).trim();
  const issueResult = command("gh", ["api", `repos/coldgeon/toolmeet/issues/${numberText}`], root);
  const issue = JSON.parse(issueResult.stdout);
  if (issue.pull_request || issue.state !== "open") throw new Error(`이슈 #${numberText}가 열려 있지 않습니다.`);
  const errors = validateIssueBody(issue.body);
  if (errors.length) throw new Error(`이슈 템플릿을 먼저 채우세요:\n${errors.join("\n")}`);

  command("git", ["fetch", "origin", "main"], root);
  const branch = `${kind}/${numberText}-${slug}`;
  const destination = path.resolve(root, "..", `toolmeet-issue-${numberText}-${slug}`);
  if (fs.existsSync(destination)) throw new Error(`대상 폴더가 이미 있습니다: ${destination}`);
  if (command("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], root, true).status === 0) throw new Error(`로컬 브랜치가 이미 있습니다: ${branch}`);
  if (command("git", ["ls-remote", "--heads", "origin", branch], root).stdout.trim()) throw new Error(`원격 브랜치가 이미 있습니다: ${branch}`);
  if (option === "--dry-run") {
    console.log(`준비 확인: ${branch} → ${destination} (origin/main 기준)`);
  } else {
    command("git", ["worktree", "add", "-b", branch, destination, "origin/main"], root);
    console.log(`작업 공간: ${destination}\n브랜치: ${branch}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
