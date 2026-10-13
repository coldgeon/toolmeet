import {spawnSync} from "node:child_process";

function command(program, args) {
  const result = spawnSync(program, args, {encoding: "utf8", shell: false});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} ${args.join(" ")} 실패: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

try {
  const branch = command("git", ["branch", "--show-current"]);
  if (!branch || branch === "main") throw new Error("이슈별 작업 브랜치에서 실행하세요.");
  if (command("git", ["status", "--porcelain"])) throw new Error("PR 전에 변경을 커밋하고 다시 확인하세요.");
  command("git", ["fetch", "origin", "main"]);
  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], {encoding: "utf8", shell: false});
  if (ancestor.status !== 0) throw new Error("작업 브랜치에 최신 origin/main을 반영하고 충돌을 해결하세요.");
  const changed = command("git", ["diff", "--name-only", "origin/main...HEAD"]).split(/\r?\n/).filter(Boolean);
  if (!changed.length) throw new Error("PR에 포함할 커밋 변경이 없습니다.");
  const prs = JSON.parse(command("gh", ["pr", "list", "--repo", "coldgeon/toolmeet", "--state", "open", "--json", "number,headRefName"]));
  const overlaps = [];
  for (const pr of prs) {
    if (pr.headRefName === branch) continue;
    const details = JSON.parse(command("gh", ["pr", "view", String(pr.number), "--repo", "coldgeon/toolmeet", "--json", "files"]));
    const paths = new Set(details.files.map((file) => file.path));
    const common = changed.filter((file) => paths.has(file));
    if (common.length) overlaps.push(`#${pr.number}: ${common.join(", ")}`);
  }
  if (overlaps.length) throw new Error(`열린 PR과 변경 경로가 겹칩니다. 작업 순서를 조정하세요.\n${overlaps.join("\n")}`);
  console.log(`${changed.length}개 변경 경로와 열린 PR을 확인했습니다. 겹치는 경로가 없습니다.`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
