import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, "src");
const dist = path.join(root, "dist");

function replaceRequired(value, before, after) {
  if (!value.includes(before)) throw new Error(`Missing expected source text: ${before}`);
  return value.replaceAll(before, after);
}

function removeLocalOnlyLinks(html) {
  return html
    .replace(/<a[^>]*href="\/explore"[^>]*>.*?<\/a>/g, "")
    .replace(/<a[^>]*href="\/demo"[^>]*>.*?<\/a>/g, "");
}

fs.rmSync(dist, {recursive: true, force: true});
fs.mkdirSync(path.join(dist, "news"), {recursive: true});

let home = fs.readFileSync(path.join(source, "index.html"), "utf8");
home = removeLocalOnlyLinks(home);
home = replaceRequired(home, 'href="/brief.css"', 'href="brief.css"');
home = replaceRequired(home, 'src="/brief.js"', 'src="brief.js"');
home = home.replaceAll('href="/news"', 'href="news/"').replaceAll('href="/"', 'href="./"');
home = home.replace('LOCAL MOCK DEMO', 'MOCK DEMO').replace('로컬 프로토타입', '배포용 mock 프로토타입');
home = home.replace('<script src="brief.js" defer></script>', '<script src="mock_api.js"></script>\n  <script src="brief.js" defer></script>');
fs.writeFileSync(path.join(dist, "index.html"), home);

let news = fs.readFileSync(path.join(source, "news.html"), "utf8");
news = removeLocalOnlyLinks(news);
news = replaceRequired(news, 'href="/brief.css"', 'href="../brief.css"');
news = replaceRequired(news, 'src="/news.js"', 'src="../news.js"');
news = news.replaceAll('href="/news"', 'href="./"').replaceAll('href="/"', 'href="../"');
news = news.replace('<script src="../news.js" defer></script>', '<script src="../mock_api.js"></script>\n  <script src="../news.js" defer></script>');
fs.writeFileSync(path.join(dist, "news", "index.html"), news);

let newsJs = fs.readFileSync(path.join(source, "news.js"), "utf8");
newsJs = replaceRequired(newsJs, 'link.href = "/?work="', 'link.href = "../?work="');
newsJs = newsJs.replaceAll('"/news?id="', '"./?id="').replaceAll('"/news"', '"./"');
fs.writeFileSync(path.join(dist, "news.js"), newsJs);

for (const filename of ["brief.css", "brief.js", "mock_api.js", "brief_mock.json"]) {
  fs.copyFileSync(path.join(source, filename), path.join(dist, filename));
}
fs.writeFileSync(path.join(dist, ".nojekyll"), "");
for (const html of [home, news]) {
  if (/(?:href|src)="\//.test(html)) throw new Error("A root-relative asset or link remains in the static build.");
}
console.log("Built U-Solve static mock site in site/dist");
