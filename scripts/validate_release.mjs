import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";

export const stableTag = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

export function validateRelease(tag, {cwd = process.cwd(), expectedCommit, ref} = {}) {
  if (!stableTag.test(tag || "")) throw new Error("안정 버전 태그(v0.1.0 형식)가 필요합니다.");
  if (ref && ref !== "refs/tags/" + tag) throw new Error("태그 push만 릴리스할 수 있습니다.");
  const version = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")).version;
  if (tag !== "v" + version) throw new Error("태그와 package.json 버전이 다릅니다.");
  function git(args) {
    const result = spawnSync("git", args, {cwd, encoding: "utf8", windowsHide: true});
    if (result.status !== 0) throw new Error("Git 검증 실패: " + args.join(" "));
    return result.stdout.trim();
  }
  if (git(["cat-file", "-t", "refs/tags/" + tag]) !== "tag") throw new Error("주석 태그(annotated tag)가 필요합니다.");
  const commit = git(["rev-parse", "refs/tags/" + tag + "^{commit}"]);
  if (commit !== git(["rev-parse", "HEAD"])) throw new Error("체크아웃과 태그 커밋이 다릅니다.");
  if (expectedCommit) {
    if (!/^[0-9a-f]{40}$/.test(expectedCommit)) throw new Error("정확한 이벤트 SHA가 필요합니다.");
    if (commit !== git(["rev-parse", expectedCommit + "^{commit}"])) throw new Error("이벤트 SHA와 태그 커밋이 다릅니다.");
  }
  git(["merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"]);
  return {name: "toolmeet", tag, version, commit,
    source_commit_time: git(["show", "-s", "--format=%cI", commit]), mode: "static-mock"};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const release = validateRelease(process.env.RELEASE_TAG || process.argv[2], {
    expectedCommit: process.env.EXPECTED_RELEASE_COMMIT, ref: process.env.RELEASE_REF,
  });
  if (process.argv.includes("--write-manifest")) {
    if (!fs.existsSync("frontend/dist/index.html")) throw new Error("정적 빌드를 먼저 실행하세요.");
    fs.writeFileSync("frontend/dist/release.json", JSON.stringify(release, null, 2) + "\n");
  }
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      "tag=" + release.tag + "\nversion=" + release.version + "\ncommit=" + release.commit + "\n");
  }
  console.log("Release validated: " + release.tag + " -> " + release.commit);
}
