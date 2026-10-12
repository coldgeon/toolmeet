import {createFrontendServer} from "../frontend/dev.mjs";
import {startBackend, waitForApi} from "./runtime.mjs";

const backendPort = Number(process.env.TOOLMEET_BACKEND_PORT || 8765);
const frontendPort = Number(process.env.TOOLMEET_FRONTEND_PORT || 5173);
const child = startBackend();
const server = createFrontendServer({backendPort});
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  server.close();
  server.closeAllConnections();
  child.kill();
}
child.on("error", (error) => { console.error(`Python 실행 실패: ${error.message}`); stop(1); });
child.on("exit", (code) => { if (!stopping) stop(code || 1); });
server.on("error", (error) => { console.error(error.message); stop(1); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
try {
  await waitForApi(`http://127.0.0.1:${backendPort}/api/health`, child);
  server.listen(frontendPort, "127.0.0.1", () => console.log(`Toolmeet: http://127.0.0.1:${frontendPort} (Ctrl+C to stop)`));
} catch (error) { console.error(error.message); stop(1); }
