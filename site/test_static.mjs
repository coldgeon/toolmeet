import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {webcrypto} from "node:crypto";
import {fileURLToPath} from "node:url";
import vm from "node:vm";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(fs.readFileSync(path.join(root, "src", "brief_mock.json"), "utf8"));
const externalRequests = [];
const window = {
  fetch: async (input) => {
    externalRequests.push(String(input));
    assert.equal(new URL(input).pathname, "/brief_mock.json");
    return new Response(JSON.stringify(source), {status: 200});
  },
};
vm.runInNewContext(fs.readFileSync(path.join(root, "src", "mock_api.js"), "utf8"), {
  window, document: {currentScript: {src: "https://example.test/mock_api.js"}},
  location: {href: "https://example.test/"}, URL, Request, Response, crypto: webcrypto,
});

async function get(pathname, body) {
  const response = await window.fetch(pathname, body ? {method: "POST", body: JSON.stringify(body)} : {});
  return {status: response.status, body: await response.json()};
}

const board = await get("/api/board");
const news = await get("/api/news");
assert.equal(board.body.data_mode, "mock");
assert.equal(board.body.posts.length, 5);
assert.equal(news.body.news.length, 9);
assert(news.body.news.some((item) => item.topic === "health" && !item.sample_work));
assert(news.body.news.some((item) => item.topic === "meeting" && item.sample_work));

const meeting = await get("/api/brief", {work: "회의록에서 결정과 할 일을 정리하고 싶어요"});
const summary = await get("/api/brief", {work: "여러 문서를 비교해 요약 보고서를 만들고 싶어요"});
assert.equal(meeting.body.topic, "meeting");
assert.equal(summary.body.topic, "summary");
assert.notDeepEqual(meeting.body.related_news.map((item) => item.id), summary.body.related_news.map((item) => item.id));
assert(!JSON.stringify(meeting.body).includes("source_url"));

const denied = await get("/api/brief", {work: "회의록에서 할 일을 정리하고 싶어요", policy: "denied"});
assert(denied.body.candidates.some((item) => item.status === "excluded"));
const deniedId = denied.body.candidates.find((item) => item.status === "excluded").id;
assert.equal((await get("/api/brief/confirm", {brief_token: denied.body.brief_token, candidate_id: deniedId, confirmed: true})).status, 400);

const allowed = await get("/api/brief", {
  work: "회의록에서 할 일을 구글 시트에 정리하고 싶어요", policy: "allowed", installation: "allowed",
  ecosystem: "google", data_kind: "public", hosting: "self_hosted",
});
const possible = allowed.body.candidates.find((item) => item.status === "possible" && item.kind !== "U-Solve 방법");
assert(possible);
const confirmed = await get("/api/brief/confirm", {brief_token: allowed.body.brief_token, candidate_id: possible.id, confirmed: true});
assert.equal(confirmed.status, 200);
assert.match(confirmed.body.source_url, /^https:\/\//);
assert.equal(externalRequests.length, 1);
console.log("Static mock API: board, news, dynamic recommendations, and link gate passed");
