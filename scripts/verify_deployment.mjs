import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import {stableTag} from "./validate_release.mjs";

const requiredFiles = ["index.html", "news/index.html", "brief.css", "brief.js", "news.js",
  "mock_api.js", "catalog.js", "projects.js", "exploration.js", "conversation.js", "brief_mock.json"];

function publishedFiles(directory, prefix = "") {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error("배포 파일에 심볼릭 링크를 사용할 수 없습니다.");
    if (entry.isDirectory()) return publishedFiles(path.join(directory, entry.name), relative + "/");
    return entry.isFile() && !entry.name.startsWith(".") && relative !== "release.json" ? [relative] : [];
  });
}

export async function verifyDeployment({baseUrl, dist = "frontend/dist", fetchImpl = globalThis.fetch,
  attempts = 6, delayMs = 5000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))} = {}) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("자격 증명·쿼리 없는 실제 HTTPS 배포 주소가 필요합니다.");
  }
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 12) throw new Error("검증 재시도 횟수가 올바르지 않습니다.");
  const expected = JSON.parse(fs.readFileSync(path.join(dist, "release.json"), "utf8"));
  if (expected.name !== "toolmeet" || expected.mode !== "static-mock" ||
      !stableTag.test(expected.tag || "") || expected.tag !== "v" + expected.version ||
      !/^[0-9a-f]{40}$/.test(expected.commit || "")) throw new Error("로컬 릴리스 manifest가 올바르지 않습니다.");
  const files = publishedFiles(dist);
  for (const file of requiredFiles) if (!files.includes(file)) throw new Error("빌드 파일 누락: " + file);
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const localHashes = new Map(files.map((file) => [file, digest(fs.readFileSync(path.join(dist, file)))]));
  async function get(relative) {
    const url = new URL(relative, base);
    const response = await fetchImpl(url, {cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(url.pathname + " HTTP " + response.status);
    return response;
  }
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const actual = await (await get("release.json")).json();
      for (const field of ["name", "mode", "tag", "version", "commit"]) {
        if (actual[field] !== expected[field]) throw new Error("공개 manifest 불일치: " + field);
      }
      // Check the public routes as well as every built asset, including card media.
      for (let offset = 0; offset < files.length; offset += 6) {
        await Promise.all(files.slice(offset, offset + 6).map(async (file) => {
          const route = file.endsWith("index.html") ? file.slice(0, -"index.html".length) : file;
          const actualHash = digest(Buffer.from(await (await get(route)).arrayBuffer()));
          if (actualHash !== localHashes.get(file)) throw new Error("공개 파일 내용 불일치: " + file);
        }));
      }
      return {url: base.href, tag: expected.tag, commit: expected.commit, verifiedFiles: files.length};
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await sleep(delayMs);
    }
  }
  throw new Error("공개 배포 검증 실패: " + lastError.message, {cause: lastError});
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await verifyDeployment({baseUrl: process.env.PUBLIC_SITE_URL});
  console.log("Deployment verified: " + result.tag + " (" + result.commit + "), " +
    result.verifiedFiles + " files at " + result.url);
}
