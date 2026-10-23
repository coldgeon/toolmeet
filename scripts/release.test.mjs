import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {parse} from "yaml";
import {validateRelease} from "./validate_release.mjs";
import {verifyDeployment} from "./verify_deployment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "toolmeet-release-test-"));
  t.after(() => {
    // Remove only the exact fixture created in the OS temp directory.
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) ||
        !path.basename(directory).startsWith("toolmeet-release-test-")) throw new Error("Unexpected fixture path");
    fs.rmSync(directory, {recursive: true, force: true});
  });
  return directory;
}
function git(cwd, ...args) {
  const result = spawnSync("git", ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args],
    {cwd, encoding: "utf8", windowsHide: true});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function repository(t, {tag = "v0.1.0", annotated = true} = {}) {
  const cwd = temporary(t);
  fs.writeFileSync(path.join(cwd, "package.json"), '{"version":"0.1.0"}\n');
  git(cwd, "init", "--initial-branch=main");
  git(cwd, "config", "user.name", "Toolmeet fixture");
  git(cwd, "config", "user.email", "fixture@example.invalid");
  git(cwd, "config", "core.autocrlf", "false");
  git(cwd, "add", "package.json");
  git(cwd, "commit", "-m", "fixture");
  const commit = git(cwd, "rev-parse", "HEAD");
  git(cwd, "update-ref", "refs/remotes/origin/main", commit);
  if (tag) git(cwd, "tag", ...(annotated ? ["-a", tag, "-m", "fixture release"] : [tag]));
  return {cwd, commit};
}

test("a main annotated tag produces the exact release identity and event binding", (t) => {
  const {cwd, commit} = repository(t);
  const result = validateRelease("v0.1.0", {cwd, expectedCommit: commit, ref: "refs/tags/v0.1.0"});
  assert.deepEqual({name:result.name, tag:result.tag, version:result.version, commit:result.commit, mode:result.mode},
    {name:"toolmeet", tag:"v0.1.0", version:"0.1.0", commit, mode:"static-mock"});
  assert.match(result.source_commit_time, /^\d{4}-\d{2}-\d{2}T/);
  // An annotated tag object's SHA must also peel to this same event commit.
  assert.equal(validateRelease("v0.1.0", {cwd, expectedCommit:git(cwd,"rev-parse","refs/tags/v0.1.0")}).commit, commit);
});
test("unstable or malformed tags fail before using Git references", async (t) => {
  const {cwd} = repository(t);
  for (const tag of ["", "0.1.0", "v0.1.0-rc.1", "v0.1.0+build", "v01.1.0", "v0.01.0", "v0.1.00", "v0.1.0/other", "--all"]) {
    await t.test(tag || "empty", () => assert.throws(() => validateRelease(tag, {cwd}), /안정 버전/));
  }
});
test("a lightweight tag or an absent tag cannot release", (t) => {
  const light = repository(t, {annotated:false});
  assert.throws(() => validateRelease("v0.1.0", light), /주석 태그/);
  const missing = repository(t, {tag:null});
  assert.throws(() => validateRelease("v0.1.0", missing), /Git 검증 실패/);
});
test("package version, ref and expected event SHA mismatches fail", (t) => {
  const {cwd} = repository(t);
  assert.throws(() => validateRelease("v0.2.0", {cwd}), /package.json/);
  assert.throws(() => validateRelease("v0.1.0", {cwd,ref:"refs/heads/main"}), /태그 push/);
  assert.throws(() => validateRelease("v0.1.0", {cwd,expectedCommit:"HEAD"}), /정확한 이벤트 SHA/);
  const original = git(cwd,"rev-parse","HEAD");
  git(cwd,"commit","--allow-empty","-m","other event");
  const other = git(cwd,"rev-parse","HEAD");
  git(cwd,"switch","--detach",original);
  assert.throws(() => validateRelease("v0.1.0", {cwd,expectedCommit:other}), /이벤트 SHA와/);
});
test("the checkout cannot drift from its tag", (t) => {
  const {cwd} = repository(t);
  git(cwd,"commit","--allow-empty","-m","later checkout");
  assert.throws(() => validateRelease("v0.1.0", {cwd}), /체크아웃과/);
});
test("a tag on an unmerged branch cannot release", (t) => {
  const {cwd} = repository(t, {tag:null});
  git(cwd,"switch","-c","unmerged");
  git(cwd,"commit","--allow-empty","-m","not in main");
  git(cwd,"tag","-a","v0.1.0","-m","unmerged");
  assert.throws(() => validateRelease("v0.1.0", {cwd}), /merge-base/);
});
test("the CLI writes a version manifest and job outputs only for a valid built tag", (t) => {
  const {cwd, commit} = repository(t);
  const env = {...process.env, RELEASE_TAG:"v0.1.0", RELEASE_REF:"refs/tags/v0.1.0",
    EXPECTED_RELEASE_COMMIT:commit, GITHUB_OUTPUT:path.join(cwd,"outputs")};
  const script = path.join(root,"scripts/validate_release.mjs");
  const invoke = () => spawnSync(process.execPath, [script,"--write-manifest"], {cwd,env,encoding:"utf8",windowsHide:true});
  assert.notEqual(invoke().status,0);
  fs.mkdirSync(path.join(cwd,"frontend/dist"),{recursive:true});
  fs.writeFileSync(path.join(cwd,"frontend/dist/index.html"),"fixture");
  const run = invoke();
  assert.equal(run.status,0,run.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(cwd,"frontend/dist/release.json"),"utf8")).commit,commit);
  assert.match(fs.readFileSync(env.GITHUB_OUTPUT,"utf8"),new RegExp("commit="+commit));
});

const required = ["index.html","news/index.html","brief.css","brief.js","news.js","mock_api.js",
  "catalog.js","projects.js","exploration.js","conversation.js","brief_mock.json","media/catalog/sample.svg"];
function site(t) {
  const dist = temporary(t);
  const manifest = {name:"toolmeet",mode:"static-mock",tag:"v0.1.0",version:"0.1.0",commit:"a".repeat(40)};
  for (const file of required) {
    fs.mkdirSync(path.dirname(path.join(dist,file)),{recursive:true});
    fs.writeFileSync(path.join(dist,file),"fixture content: "+file);
  }
  fs.writeFileSync(path.join(dist,"release.json"),JSON.stringify(manifest));
  fs.writeFileSync(path.join(dist,".nojekyll"),"");
  const seen = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url.origin,"https://example.test");
    assert(url.pathname.startsWith("/toolmeet/"),"the repository subpath must be preserved");
    assert.equal(options.redirect,"error");
    seen.push(url.pathname);
    let relative = url.pathname.slice("/toolmeet/".length);
    if (!relative || relative.endsWith("/")) relative += "index.html";
    const file = path.join(dist,relative);
    return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response("missing",{status:404});
  };
  return {dist,manifest,seen,fetchImpl};
}
const options = (fixture) => ({baseUrl:"https://example.test/toolmeet",dist:fixture.dist,fetchImpl:fixture.fetchImpl,attempts:1});

test("public verification preserves /toolmeet/, checks both routes and every asset", async (t) => {
  const fixture = site(t);
  const result = await verifyDeployment(options(fixture));
  assert.equal(result.verifiedFiles,required.length);
  assert.equal(result.commit,fixture.manifest.commit);
  assert.equal(result.url,"https://example.test/toolmeet/");
  for (const route of ["/toolmeet/","/toolmeet/news/","/toolmeet/media/catalog/sample.svg","/toolmeet/mock_api.js"]) {
    assert(fixture.seen.includes(route),route);
  }
  assert(!fixture.seen.some((route)=>route.includes("/api/")||route.endsWith(".nojekyll")));
});
test("HTTP, credentials, query strings and fragments are rejected before network use", async (t) => {
  const fixture = site(t);
  for (const baseUrl of ["http://example.test/toolmeet/","https://user:password@example.test/toolmeet/","https://example.test/?token=value","https://example.test/#fragment"]) {
    await assert.rejects(verifyDeployment({...options(fixture),baseUrl}),/HTTPS 배포 주소/);
  }
  assert.equal(fixture.seen.length,0);
});
test("an old public tag, commit, mode or version is not success", async (t) => {
  for (const [field,value] of [["tag","v0.0.9"],["commit","b".repeat(40)],["mode","production"],["version","0.0.9"],["name","other"]]) {
    await t.test(field,async (sub) => {
      const fixture = site(sub);
      const fetchImpl = async (url,opt) => url.pathname.endsWith("/release.json")
        ? new Response(JSON.stringify({...fixture.manifest,[field]:value})) : fixture.fetchImpl(url,opt);
      await assert.rejects(verifyDeployment({...options(fixture),fetchImpl}),/manifest 불일치/);
    });
  }
});
test("HTTP 200 with stale JavaScript cannot pass a matching manifest", async (t) => {
  const fixture = site(t);
  const fetchImpl = async (url,opt) => url.pathname.endsWith("/exploration.js")
    ? new Response("older site") : fixture.fetchImpl(url,opt);
  await assert.rejects(verifyDeployment({...options(fixture),fetchImpl}),/파일 내용 불일치/);
});
test("missing root, news route or card asset prevents public success", async (t) => {
  for (const route of ["/toolmeet/","/toolmeet/news/","/toolmeet/media/catalog/sample.svg"]) {
    await t.test(route,async (sub) => {
      const fixture = site(sub);
      const fetchImpl = async (url,opt) => url.pathname === route ? new Response("missing",{status:404}) : fixture.fetchImpl(url,opt);
      await assert.rejects(verifyDeployment({...options(fixture),fetchImpl}),/HTTP 404/);
    });
  }
});
test("CDN propagation is retried until the expected version is actually served", async (t) => {
  const fixture = site(t);
  let manifests=0, sleeps=0;
  const fetchImpl = async (url,opt) => {
    if (url.pathname.endsWith("/release.json") && ++manifests===1) {
      return new Response(JSON.stringify({...fixture.manifest,commit:"b".repeat(40)}));
    }
    return fixture.fetchImpl(url,opt);
  };
  const result = await verifyDeployment({...options(fixture),fetchImpl,attempts:2,sleep:async()=>{sleeps++;}});
  assert.equal(result.commit,fixture.manifest.commit);
  assert.equal(sleeps,1);
  assert.equal(manifests,2);
});
test("persistent network failure and invalid JSON exhaust a bounded retry", async (t) => {
  for (const fail of [()=>{throw new Error("network unavailable");},()=>new Response("<html>not a manifest</html>"),()=>new Response("unavailable",{status:503})]) {
    const fixture = site(t);
    let calls=0, sleeps=0;
    await assert.rejects(verifyDeployment({...options(fixture),attempts:3,
      fetchImpl:async()=>{calls++;return fail();},sleep:async()=>{sleeps++;}}),/공개 배포 검증 실패/);
    assert.equal(calls,3);
    assert.equal(sleeps,2);
  }
});
test("incomplete or invalid local output fails without trying a public URL", async (t) => {
  const fixture=site(t);
  fs.rmSync(path.join(fixture.dist,"conversation.js"));
  await assert.rejects(verifyDeployment(options(fixture)),/빌드 파일 누락/);
  fs.writeFileSync(path.join(fixture.dist,"conversation.js"),"restored");
  fs.writeFileSync(path.join(fixture.dist,"release.json"),JSON.stringify({...fixture.manifest,tag:"v0.1.0-rc.1"}));
  await assert.rejects(verifyDeployment(options(fixture)),/로컬 릴리스 manifest/);
  assert.equal(fixture.seen.length,0);
});
test("release workflow cannot deploy a PR or grant build/release Pages credentials", () => {
  const workflow = parse(fs.readFileSync(path.join(root,".github/workflows/release.yml"),"utf8"));
  assert.deepEqual(workflow.on,{push:{tags:["v*"]}});
  assert.deepEqual(workflow.permissions,{contents:"read"});
  assert.equal(workflow.concurrency["cancel-in-progress"],false);
  const {build,deploy,release}=workflow.jobs;
  assert.equal(build.permissions,undefined);
  assert.match(build.if,/github.event_name == 'push'/);
  assert.match(build.if,/refs\/tags\/v/);
  assert.deepEqual(deploy.permissions,{contents:"read",pages:"write","id-token":"write"});
  assert.deepEqual(release.permissions,{contents:"write"});
  assert.equal(deploy.needs,"build");
  assert.deepEqual(release.needs,["build","deploy"]);
  assert.equal(deploy.environment.name,"github-pages");
  const commands=build.steps.map((step)=>step.run);
  assert(commands.indexOf("node scripts/validate_release.mjs")<commands.indexOf("npm test"));
  assert(commands.indexOf("npm test")<commands.indexOf("node scripts/validate_release.mjs --write-manifest"));
  const deployments=deploy.steps;
  assert(deployments.findIndex((step)=>step.uses?.startsWith("actions/deploy-pages@")) <
    deployments.findIndex((step)=>step.run==="node scripts/verify_deployment.mjs"));
  const checkouts=[...build.steps,...deploy.steps].filter((step)=>step.uses?.startsWith("actions/checkout@"));
  assert(checkouts.every((step)=>step.with["persist-credentials"]===false && step.with.ref));
  assert.equal(deployments.find((step)=>step.uses?.startsWith("actions/configure-pages@")).with.enablement,false);
  assert(!JSON.stringify(workflow).includes("workflow_dispatch"));
});
