import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, "src");
const dist = path.join(root, "dist");
const data = path.join(root, "..", "shared", "data");

function replaceRequired(value, before, after) {
  if (!value.includes(before)) throw new Error(`Missing expected source text: ${before}`);
  return value.replaceAll(before, after);
}

function removeLocalOnlyLinks(html) {
  return html
    .replace(/<a[^>]*href="\/explore"[^>]*>.*?<\/a>/g, "")
    .replace(/<a[^>]*href="\/demo"[^>]*>.*?<\/a>/g, "");
}

// Overwrite the known generated files; no recursive deletion is needed.
fs.mkdirSync(path.join(dist, "news"), {recursive: true});

let home = fs.readFileSync(path.join(source, "index.html"), "utf8");
home = removeLocalOnlyLinks(home);
home = replaceRequired(home, 'href="/brief.css"', 'href="brief.css"');
home = replaceRequired(home, 'src="/brief.js"', 'src="brief.js"');
home = home.replaceAll('src="/projects.js"', 'src="projects.js"').replaceAll('src="/catalog.js"', 'src="catalog.js"').replaceAll('src="/exploration.js"', 'src="exploration.js"').replaceAll('src="/conversation.js"', 'src="conversation.js"');
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

for (const filename of ["brief.css", "brief.js", "mock_api.js", "catalog.js", "projects.js", "exploration.js", "conversation.js"]) {
  fs.copyFileSync(path.join(source, filename), path.join(dist, filename));
}
const mediaExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".json"]);
function copyMedia(directory, target) {
  fs.mkdirSync(target, {recursive: true});
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const original = path.join(directory, entry.name);
    const output = path.join(target, entry.name);
    if (entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) copyMedia(original, output);
    else if (entry.isFile() && /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/.test(entry.name) && mediaExtensions.has(path.extname(entry.name))) {
      fs.copyFileSync(original, output);
    }
  }
}
const mediaSource = path.join(source, "media");
if (fs.existsSync(mediaSource)) {
  if (fs.lstatSync(mediaSource).isSymbolicLink()) throw new Error("Media source must stay inside frontend/src.");
  copyMedia(mediaSource, path.join(dist, "media"));
}
const feed = JSON.parse(fs.readFileSync(path.join(data, "brief_mock.json"), "utf8"));
feed.topic_rules = JSON.parse(fs.readFileSync(path.join(data, "topic_rules.json"), "utf8"));
fs.writeFileSync(path.join(dist, "brief_mock.json"), JSON.stringify(feed, null, 2) + "\n");
fs.writeFileSync(path.join(dist, ".nojekyll"), "");
for (const html of [home, news]) {
  if (/(?:href|src)="\//.test(html)) throw new Error("A root-relative asset or link remains in the static build.");
}
console.log("Built Toolmeet static mock site in frontend/dist");
