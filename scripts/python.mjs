import {startBackend, python} from "./runtime.mjs";

const child = startBackend(process.argv.slice(2));
child.on("error", (error) => {
  console.error(`Python 실행 실패 (${python}): ${error.message}. Python 3.12+를 설치하거나 PYTHON 환경 변수를 지정하세요.`);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
