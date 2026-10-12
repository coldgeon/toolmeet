import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
export function startBackend(args = ["app.py"], options = {}) {
  return spawn(python, args, {
    cwd: path.join(root, "backend"),
    env: {...process.env, PYTHONUTF8: "1", PYTHONUNBUFFERED: "1", ...options.env},
    stdio: options.stdio || "inherit", windowsHide: true,
  });
}
export async function waitForApi(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error("Backend exited before becoming ready");
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(500)});
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Backend did not start: ${url}`);
}
