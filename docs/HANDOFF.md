# 툴밋 인계

## 2026-10-13 #5 조건 확인 대화 · 구현·검증 완료

- 사용자 인계 메시지가 기존 #5의 구현 재개를 명시해 이슈/브랜치/작업 폴더를 새로 만들지 않았다. 기존 `C:/Users/cksrj/.codex/worktrees/issue-5-question-conversation/u-solve`, `feat/5-question-conversation`에서 clean HEAD와 최신 origin/main `f387ab0180142be4d5c2caa50e878741488ecedc`, 열린 이슈 #5/문서 PR #13을 확인하고 시작했다. 공유 원래 폴더의 PM 미커밋 초안과 제품 파일은 복사하거나 수정하지 않았다.
- `frontend/src/conversation.js`에 exploration.v1 snapshot·fact·question·추천·confirm 검증과 교체 가능한 mock evaluate/confirm 어댑터를 추가했다. 기존 후보 ID와 판정 API를 재사용한다. 알려진 명시 예시 구절만 facts로 읽고 부정/모호한 구절은 조건으로 추정하지 않으며 명시 답변을 우선하고 충돌 확인 이유를 표시한다. 원하는 결과가 빠지면 자유 답변 하나를 묻고 후보의 미확인 필수조건만 선택한다. 충분한 정보는 즉시 추천, 모름/내부 자료 등 다른 질문으로 풀 수 없는 보류는 조건 확인 필요로 마무리한다.
- `brief.js`, `index.html`, `brief.css`에 실제 단계, 한 질문, 미답변/known/unknown, 답변 수정·삭제·초안, 오류/재시도·empty/hold·내부 준비 방법을 추가했다. 기존 뉴스·후보 이유·조건·활용 방법·방향 확인 후 링크를 재사용했다. 탭은 DOM/대화/revision을 보존한다. 새 질문만 전체 초기화하며 모션 선호는 기존 탐색 UI에 남는다.
- 모든 의미 변경은 revision 증가와 이전 결과/추천 token/확인/링크 즉시 제거를 먼저 수행한다. 같은 revision 재평가도 새 turn ID로 confirm을 무효화한다. turn과 confirm의 최신 revision/request_id/추천 요청/token 비교 뒤 payload 검증을 통과한 응답만 표시하고 오래된 성공/오류/finally를 무시한다. 화면 token 제거는 backend 메모리 token 폐기가 아니며 새 서버 기능을 구현하지 않았다.
- 개발/정적 빌드에 같은 원본 conversation.js를 연결했다. backend/shared 원본과 프레임워크·배포 설정은 변경하지 않았다. outcome은 기존 brief의 업무 입력에 설명을 덧붙이는 호환 방식이며 실제 자유문장 이해가 아니다. cost/project_id는 snapshot·검증·편집 계약을 보존하지만 기존 API에 실제 비용·프로젝트별 판단을 추가하지 않았다.
- 검증: 최종 `npm test` 성공. frontend 총 124개(기존 #1/#4 HTTP 경합·탐색 44개, 실제 mock/계약 31개, 대화 DOM 49개), Python 13개, workflow 정책 3개, 정적 빌드·하위 경로·뉴스/후보·확인 관문, HTTP 5개 화면/자산·15개 Python/정적 판정 비교 통과. `npm run build`, JS 구문/공백 검사 통과. 실제 Codex·유료 API는 호출하지 않았다. 기존 경합 fixtures는 질문 선택만 제어하며 production normalize/validate/confirm을 사용하고 실제 질문 흐름은 별도 actual adapter/DOM 시험으로 검증했다.
- 브라우저 확인: 실제 local 개발 API에서 선택 질문→조기 추천→활용 방법→방향 확인 링크, 정책을 모름으로 수정해 링크 제거/보류, 자유 답변과 탭 왕복 초안 보존을 조작했다. 1440×900, 320/360/390×800 및 360×560에서 대화/추천 가로 넘침 없음·키보드 제출/답변/확인·초점 이동을 확인했다. 정적 `/toolmeet/` 직접 진입·저장 합성 이미지·뉴스 상세→질문 자동 채움/대화·추천/확인, 콘솔 오류 없음도 확인했다. `/explore`, `/demo`는 HTTP/자산 통합 검증으로 보존을 확인했으며 실제 도구 실행은 하지 않았다.
- 독립 코드 검토가 찾은 업무 근거 이력 누락, 부정 결과 오해, 내부 자료 불필요 질문, 대기 중 편집 초안 소실을 수정하고 회귀에 반영했다. 내부 에이전트 검토는 사람의 승인이나 고객 인터뷰를 대신하지 않는다.
- 기존 Seed `seed_49cafe36102b`를 이어받고 현재 검토/화면 증거는 저장소 밖 `C:/Users/cksrj/.codex/visualizations/2026/10/13/01a13389-558a-7ad2-b5c4-9230913c6d2f/`에 보관한다. 현 세션에 Ouroboros MCP/CLI가 없어 Seed 기록만 유지하고 다른 반복 실행기는 추가하지 않았다.
- 미검증: 실제 휴대폰/소프트 키보드·스크린리더·OS 움직임 감소 설정 변경(기존 DOM matchMedia/CSS 회귀는 통과), 실제 AI/기사 수집/회사 정책/도구 실행/요금, 새 PR 원격 Windows/Linux CI·공개 배포. #6의 프로젝트 상세/프리뷰·실제 project_id 추천, 새로고침/로그인 저장 복원도 범위 밖이다.
- 다음: 채팅의 PR 제목·본문 전체 초안에 대한 사용자 승인. PR #13과 CURRENT/HANDOFF가 겹치므로 #13 문서 반영 뒤 최신 main에서 #5 기록을 조정하고 `npm run task:overlap`을 다시 통과시킨 뒤 승인된 PR을 생성한다. PR 생성·머지·태그·배포는 각각 별도 승인이다. 다른 채팅이나 외부 서비스에 메시지를 보내지 않았다.


## 2026-10-13 이슈 #10 공동 작업 절차 · PR #11

- 작업 시작 규칙을 루트 `AGENTS.md`의 맨 위 "작업 시작 전 필수 확인"으로 옮기고, `CLAUDE.md`와 `.github/copilot-instructions.md`에서 같은 원본을 가리키도록 했다. 도구가 해당 파일을 읽는지와 최신 기본 브랜치를 받았는지에 따라 실제 적용이 달라진다는 한계를 `docs/COLLABORATION.md`에 명시했다.
- 후속 문서 변경은 `git diff --check`와 파일 경로·참조 확인으로 검증했다. 제품 코드가 바뀌지 않아 기능 테스트는 앞선 전체 `npm test`·`npm run build` 결과를 유지했다. 최신 기능·문서 커밋 `bee7873`에서 Windows·Linux CI가 모두 성공했다.
- 최신 원격 main `d195f0e`에서 별도 worktree `C:/Users/s2608/orca/toolmeet-agent-workflow`와 `chore/10-agent-workflow` 브랜치로 작업했다. 기존 로컬 main의 미커밋 `CURRENT.md`·`HANDOFF.md`는 옮기거나 덮어쓰지 않았다. [#10](https://github.com/coldgeon/toolmeet/issues/10)은 공통 항목을 채워 등록했다.
- `.github/ISSUE_TEMPLATE/task.md`, `.github/pull_request_template.md`, `docs/COLLABORATION.md`에 이슈·PR 형식과 이슈별 격리·열린 PR 경로 확인·충돌 조정 순서를 기록했다. `npm run task:start -- <번호> <유형> <이름>`은 이슈 본문·상태·중복 브랜치·대상 폴더를 확인하고 최신 origin/main에서 별도 worktree를 만든다. `npm run task:overlap`은 커밋된 변경과 열린 PR의 경로 중복·최신 main 포함을 확인한다.
- PR의 이슈 하나 연결·브랜치 번호·필수 항목·체크리스트를 `workflow-policy` CI가 검사한다. `pull_request_target`에서 기본 브랜치의 검사 코드만 실행하고 이슈 조회에는 읽기 권한만 쓴다. 이 workflow는 main 반영 후부터 작동한다. `AGENTS.md`와 `README.md`에서 공동 절차를 참조한다. 제품 기능과 shared/data·backend는 변경하지 않았다.
- 검증: `npm ci --ignore-scripts --no-audit --no-fund` 성공(`npm.cmd` 사용), 정책 테스트 3개, 전체 `npm test`(DOM 44개·Python 13개·정적·통합), `npm run build`, 새 이슈 #10의 worktree 명령 dry-run, workflow YAML 구문, `git diff --check`를 통과했다. 일반 테스트에서 실제 Codex·유료 API를 호출하지 않았다.
- [PR #11](https://github.com/coldgeon/toolmeet/pull/11)을 이슈 하나에 연결해 생성했다. PR 본문을 로컬 정책 검사로 통과시켰고 Windows·Linux CI가 성공했다. 작업 중 다른 PR의 변경 경로와 겹침은 없었다.
- 남은 문제: GitHub main 보호/ruleset은 현재 없고 이 계정은 관리자 권한이 없어 적용하지 못했다. 새 `pull_request_target` 검사는 기본 브랜치에 반영된 뒤 새 PR부터 실행된다. 템플릿과 CI만으로 직접 push나 실패한 PR의 머지를 서버에서 막을 수 없다. 다음은 저장소 관리자의 ruleset 설정과 후속 PR에서 새 정책 검사 실행 여부를 확인하는 것이다. 제품 배포는 진행하지 않았다.

## 2026-10-13 이슈 #4 구현 완료 · PR 초안 승인 대기

- 승인 이슈: [#4 두 탐색 탭과 집중 입력 화면](https://github.com/coldgeon/toolmeet/issues/4). 사용자 `좋아, #4는 기존 스택으로 구현 시작해.`로 해당 이슈의 구현 시작을 지시받았다. 최신 main `5460da458d57ec816dc881b72bdebacf195e440f`에서 Development에 연결한 `feat/4-exploration-tabs` 브랜치·별도 worktree `C:/Users/cksrj/.codex/worktrees/issue-4-exploration-tabs/u-solve`를 사용했다. 원래 작업 폴더의 다른 채팅 미커밋 변경을 보존했다.
- 기존 HTML·CSS·Vanilla JavaScript로 중앙 질문 입력, 두 탭, 접힌 환경/예시 목록, 흰 집중 상태와 명시적 새 질문을 구현했다. 작은 안내/조건 글자 크기와 대비도 보완했다. 탭 이동은 기존 입력·조건·추천·미리보기·확인 링크 DOM을 재생성하지 않는다. 새 질문은 brief 요청 세대와 token을 무효화하므로 늦은 추천/확인 성공·실패도 복원하지 않는다.
- 배경은 자체 제작 SVG 8개를 같은 카탈로그 ID로 두 번 배치해 80초 동안 위로 반복 이동한다. 클릭·키보드 포커스·환경 설정·뉴스 질문 진입 뒤 모션을 멈추고 blur로 재시작하지 않는다. 수동 정지는 새 질문에서도 유지하며 prefers-reduced-motion은 CSS와 상태·스크롤에 반영한다.
- `catalog.js`의 list/get은 기존 `shared/data/brief_mock.json`을 exploration.v1의 mock DTO로 변환한다. 원본 후보 이름·summary·method를 사용하고 비용은 미확인, 내부 방법은 별도 kind로 구분한다. 공용 원본과 backend API는 변경하지 않았다. `frontend/src/media/catalog/provenance.json`에 자체 제작 사용 근거를 남겼고 실제/합성/대체를 카드마다 표시한다. 검증된 실제 서비스 미디어를 연결한 작업은 아니다.
- 카탈로그 오류·빈 목록·잘못된 payload·권리 미확인·미디어 누락/실패에서도 질문을 사용할 수 있다. 개발 서버는 공통 mock JSON과 안전한 저장 미디어 경로를 frontend 자산으로 제공하며 정적 빌드는 같은 src를 복사한다. `/toolmeet/` 자산·뉴스 연결을 유지하고 로컬 `/explore`·`/demo`도 보존했다. dist를 직접 수정하지 않았다.
- 검증: `npm ci --ignore-scripts --no-audit --no-fund`, 최종 `npm test` 및 `npm run build` 성공. DOM 44개(기존 #1의 26개+신규 탐색 18개), Python API 13개, 정적 mock API·탐색·`/toolmeet/` 시험, 개발 HTTP 5개 화면/자산/프록시·15조합 판정 비교가 통과했다. 탭 상태/초점·새 질문 중 pending brief/confirm·수동 정지·reduced-motion 변경·카탈로그 오류/빈/잘못된 응답·이미지 fallback을 포함한다.
- 브라우저: CSS viewport 1440×900, 320·360·390×800px에서 초기/집중/프로젝트 목록의 관련 화면과 가로 넘침을 확인했다. 360×560px에서는 키보드 제출 후 결과 heading 초점을 확인했다. 탭 키·방향 키·패널 진입, 클릭/포커스 집중 전환, blur와 탭 왕복 후 정지, 수동 정지 후 새 질문, 조건 유지·기본 추천·미리보기→확인 링크를 직접 조작했다. 정적 `/toolmeet/`의 저장 이미지·스크립트·탭과 뉴스 상세→질문 채움/결과/초점도 확인했다. 외부 원본 링크는 열지 않았다.
- 미검증: OS 설정을 바꾼 실제 reduced-motion 브라우저 동작(자동시험의 matchMedia와 CSS로 확인), 실제 휴대폰·소프트 키보드·스크린리더, 새 PR의 GitHub CI와 제품 배포. 실제 AI·기사 수집·기업 원본·유료 API를 호출하지 않았다. 별도 단계형 대화/답변 수정은 #5, 호버/버튼 프리뷰·상세·프로젝트 기반 질문은 #6, 조사·실제 미디어 연결은 해당 담당의 별도 승인 범위다.
- 독립 코드 읽기 검토에서 범위 내 blocker를 찾지 못했다. 합성 실무자 검토가 권고한 새 질문 입력 자동 초점으로 초기 상태가 즉시 사라지는 문제를 피하고, 독립 검토가 권고한 패널 tabIndex와 개별 미디어 표시를 반영했다. 이는 내부 합성 검토이며 고객 인터뷰·사람의 PR 승인을 대신하지 않는다.
- 로컬 Seed `seed_5a9c026e81d4`와 화면 증거는 저장소 밖 `C:/Users/cksrj/.codex/visualizations/2026/10/12/01a130ba-3577-7d43-ad9e-f4b58d88ae40/toolmeet-issue-4/`에 보관한다. Ouroboros MCP/CLI가 없어 로컬 Seed만 기록하고 다른 반복 실행기는 추가하지 않았다.
- 점검용 브라우저 탭을 닫고 뷰포트를 복원했다. 이번 작업의 개발/진단 서버 포트 15176·15177·18766 종료를 확인했으며 다른 작업의 서버는 종료하지 않았다.
- 다음은 완료 보고의 PR 제목·본문 전체 초안에 대한 사용자 승인이다. PR 생성·머지·태그·배포는 실행하지 않았다. 아래 #3 기록의 당시 승인 상태는 과거 이력이며 PR #7은 별도 사용자 승인 뒤 main에 반영됐다.


## 2026-10-13 이슈 #3 계약 문서 구현 · PR 초안 승인 대기

- 승인 이슈: [#3 대화·카탈로그·미디어 연동 계약 합의](https://github.com/coldgeon/toolmeet/issues/3). 사용자 `좋아 이슈 생성해`로 등록, 후속 `구현 들어가자`로 구현 시작을 지시받았다. 권장 순서 #3 → #4 → #5 → #6의 선행 문서부터 진행했다.
- GitHub main과 origin/main이 `cc4ccdfe54ce41ab75e5780da379eaaa5e81c647`로 일치함을 확인한 뒤 별도 worktree `C:/Users/cksrj/.codex/worktrees/issue-3-ux-contract/u-solve`와 `docs/3-exploration-contract` 브랜치를 만들고 #3 Development 연결을 확인했다. 원래 작업 폴더의 다른 채팅 미커밋 변경을 가져오거나 덮어쓰지 않았다.
- `docs/contracts/exploration-v1.md`와 동반 JSON에 대화 snapshot·known/explicit unknown·필요한 한 질문·조기 종료·실제 단계·보류/빈 후보/오류·수정/재시도·추천/확인 수명·동일 ID 카탈로그·근거·가격 미확인·미디어 출처/사용 근거/대체·하위 경로·담당/후속 승인 경계를 정의했다. 현재 API와 새 mock DTO/HTTP 제안을 구분했다.
- 기존 brief에는 별도 확인 token이 없고 brief_token이 900초·확인 성공 후 비소비임을 명시했다. 같은 revision의 재평가도 이전 추천/confirm을 무효화하며 추천 request_id·token까지 검사하도록 정의했다. 내부 local-review는 supporting_methods로 보존하고 공개 추천 집계에서 제외한다.
- 내부 합성 실무자는 탭 복귀 시 제출 전 초안 보존과 조건 확인 필요/방향 확인 구분을 권고했다. 독립 검증자는 같은 revision 재시도 중 확인 경합과 not_found 코드 정합성을 지적했고 기술 검토자는 내부 방법→empty 변환을 확인했다. 모두 문서·예시에 반영했다. 실제 고객 인터뷰나 사람 사용자 승인·backend 담당 합의가 아니다.
- 실행 검증: `npm ci --ignore-scripts --no-audit --no-fund` 성공, `npm test` 성공(DOM 26개·Python API 13개·정적 mock·5개 화면/자산/API 프록시·15개 판정 비교), `npm run build` 성공. 외부 검증 스크립트에서 합성 turn 8개·도착 순서 6개·미디어 거부 3개·카탈로그 2개·ID 교집합 0·문서 로컬 링크를 검사해 PASS했다. 예시의 topics 순서를 원자료와 일치시킨 뒤 다시 통과했다.
- 계약 JSON 검증 도구와 Seed `seed_7c693d26aeb1`은 저장소 밖 `C:/Users/cksrj/.codex/visualizations/2026/10/12/01a130ba-3577-7d43-ad9e-f4b58d88ae40/toolmeet-ux-issues/`에 보관한다. 현재 세션에 Ouroboros MCP/CLI가 없어 로컬 Seed만 준비했고 다른 반복 실행기는 추가하지 않았다.
- 문서만 변경했다. 새 DTO의 실제 HTTP/AI/미디어/브라우저·320/360/390px·스크린리더·GitHub CI·제품 배포는 검증하지 않았다. #4~#6 실제 화면 구현과 backend/리서치 검토·실연동이 남아 있다. 기존 /news와 로컬 /explore·/demo 제품 코드를 바꾸지 않았으며 dist는 빌드로만 생성했다.
- 다음은 #3의 완료 보고와 PR 제목·본문 초안 검토다. PR 생성·머지는 각각 별도 사람 승인이 필요하며 main push·자동 머지·관리자 우회·강제 push·태그·배포는 실행하지 않았다.

## 2026-10-13 이슈 #1 구현 완료 · PR 초안 승인 대기

- 승인 이슈: [#1](https://github.com/coldgeon/toolmeet/issues/1) `fix(frontend): 환경 변경 중 이전 추천·원본 링크 표시 방지`. 사용자 `이슈 작성해`는 이슈 생성, 후속 `작업 시작해`는 이슈 구현 시작 승인이다. PR 생성·머지·배포 승인은 아직 없다.
- 최신 main `4086d3da22456ff36c0bad09b1a3e9f153a67059`에서 GitHub Development에 연결한 `fix/1-stale-brief-results` 브랜치로 구현했다. 경로는 `C:/Users/cksrj/.codex/worktrees/issue-1-stale-brief/u-solve`다. 원래 작업 폴더의 협업 규칙·PM 기획·Pages 관련 미커밋 변경을 가져오거나 덮어쓰지 않았다.
- `frontend/src/brief.js`에서 제출 상태를 결과 가시성과 분리했다. 질문·환경 변경과 새 요청 시작 시 이전 후보·관련 소식·토큰·링크를 즉시 비우고 요청 세대를 갱신한다. 다섯 환경 항목은 응답 대기·성공·오류 뒤에도 최신 조건을 재계산하며 첫 제출 전과 질문 편집 후 재제출 전에는 자동 요청하지 않는다.
- 확인 버튼은 카드 생성 당시 요청 세대·토큰을 사용하고 클릭 전·응답 후·오류 처리 때 유효성을 검사한다. 이전 추천의 성공·실패·finally와 이전 링크 확인의 성공·실패가 최신 화면을 바꾸지 않는다. 서버 토큰 폐기나 API·공용 데이터 변경은 하지 않았다.
- `frontend/tests/brief.test.mjs`에 실제 index.html·jsdom DOM/Event·brief.js와 제어된 fetch 응답으로 회귀 검증 26개를 추가했다. 환경 다섯 항목, 연속·역순·오류 응답, 질문 편집, 기존 링크 제거, 확인 요청 경합, 오류 후 재시도, 이전 버튼의 새 토큰 오용, 정상 미리보기·확인·mock 및 뉴스/예시 입력을 검증한다. `jsdom@26.1.0`은 테스트용 개발 의존성으로 정확 버전을 고정했다. 기존 Node 20 이상 제품 실행 기준과 프레임워크는 바꾸지 않았다.
- 검증: `npm ci --ignore-scripts --no-audit --no-fund` 성공, `npm test` 성공(DOM 26개·Python API 13개·정적 mock·5개 화면/자산/프록시·15조합 판정 비교), `npm run build` 성공, `node --check frontend/src/brief.js` 및 `git diff --check` 통과. 원본 4086d3d의 brief.js를 별도 fixture로 평가하면 핵심 정책·설치 대기 중 변경 시험 2개가 예상대로 실패하고 수정본은 통과했다.
- 브라우저: 별도 worktree 개발 서버(15174/18765)와 임시 응답 지연 프록시(15175/18866)에서 데스크톱 1440×900과 모바일 360×800을 확인했다. 가능 응답 4초·불가 응답 1초로 역순 도착시켜 최신 불가 판정·링크 0개가 유지됐다. 모바일에서 확인 응답 대기 중 키보드 Home/Tab으로 정책을 모름으로 바꿔 후보·링크 즉시 제거와 늦은 확인 성공 무시를 확인했다. 최신 가능 결과에서는 미리보기→확인 후 링크가 표시되고 질문 편집 시 제거됐다. 뉴스 분야 필터·상세·업무 질문 연결도 확인했다.
- 외부 원본 링크는 열지 않았고 실제 Codex·유료 API는 호출하지 않았다. 실제 휴대폰·스크린리더·GitHub CI·배포는 시험하지 않았다. 기존 접근성·뉴스 API 실패 표시·모바일 검색 배치는 후속 범위다. 제품 원본은 frontend/src 하나이며 dist는 빌드로만 생성했다.
- 독립 코드 검토에서 이슈 범위의 추가 결함을 찾지 못했다. 권장한 이전 오류의 늦은 도착·실패 후 재시도·이전 버튼 보관 사례를 DOM 시험에 반영했다. 이 검토는 사람 사용자의 PR 승인이 아니다.
- 로컬 Seed `seed_81c9918b37d4`에 합의 범위·완료 기준·검증 계획을 기록했다(`.ouroboros/seeds/seed_81c9918b37d4.json`, Git 제외). 현재 세션에 Ouroboros MCP·CLI가 없어 도구 실행 기록을 주장하지 않는다. 다른 반복 실행기는 추가하지 않았다.
- 화면 증거: 저장소 밖 `C:/Users/cksrj/.codex/visualizations/2026/10/12/01a130ba-3577-7d43-ad9e-f4b58d88ae40/toolmeet-issue-1/`의 desktop-denied.jpg·mobile-unknown.jpg·mobile-confirmed.jpg. 점검용 탭을 닫고 뷰포트를 복원했으며 이번 개발·진단 서버 네 포트의 종료를 확인했다. 기존 작업 폴더의 개발 서버는 종료하지 않았다. 다음은 채팅의 PR 제목·본문 전체 초안 승인 뒤 작업 브랜치 push와 일반 PR 생성이다. 머지는 별도 사용자 승인과 CI 성공 확인 후 처리한다.

## 2026-10-12 공동 저장소 이전과 모노레포 정리

- 사용자 요청에 따라 `coldgeon/toolmeet`의 초기 `main`과 `seongwwww/u-solve`의 `61831ec884ae4a482738de39dd048207ab49be94`를 병합했다. 원본 커밋 이력과 기존 4개 화면, 공개·합성 문서 및 과거 실행 기록을 보존했다. 원본 저장소와 Sites 배포는 수정하지 않았다.
- `frontend/`에 HTML·CSS·JS 화면과 개발 서버·정적 빌드·정적 API 시험, `backend/`에 Python API·추천·탐색 로직·시험, `shared/data/`에 공용 데이터·분류 규칙을 정리했다. 중복 `site/src/`는 통합하고 과거 Sites 설정은 `docs/legacy/site.openai/`에 보관했다.
- 루트 npm workspaces와 lockfile, `npm run dev` 동시 실행, `npm test`, `npm run build`, Windows·Linux CI를 추가했다. 개발 화면 `127.0.0.1:5173`이 `/api/*`를 Python API `127.0.0.1:8765`로 전달한다. 생성물·키·로컬 검증 화면은 Git에서 제외한다.
- 제품 화면과 코드의 이름을 툴밋으로 바꿨다. 과거 문서 인용·`RUNS.json`은 수정하지 않았다. 합동 PM 아키텍처 파일도 공동 저장소에 포함했다.
- 양식·기획 예시가 summary로 잘못 분류되던 문제를 수정했다. 공용 규칙에서 일반적인 문서·자료·PDF 단어보다 구체적인 작업 단어에 높은 점수를 주며 Python·정적 JS가 같은 규칙을 사용한다.
- 검증: `npm ci --ignore-scripts --no-audit --no-fund` 성공. `npm test`의 Python API 시험 **13개 통과**, 정적 빌드/API 시험 통과, 5개 화면·자산·프록시·입력 오류 통과. 5개 업무×3개 환경 **15조합**에서 Python·정적 JS의 업무·관련 소식·후보 상태가 일치했다.
- 실제 브라우저: 양식·기획 분류, 회의 질문, 외부 AI 불가/가능에 따른 제외·검토 가능 변화, 방법 미리보기·확인 후 원본 링크, 뉴스 검색·상세·질문 연결, 기존 탐색·과정도, 문서 시연 설계 미리보기를 조작해 확인했다. 문서 시연 화면의 콘솔 오류가 없었다. 검증 화면은 로컬 `docs/verification/`에 저장한다.
- 실제 Codex·유료 API는 이번에 호출하지 않았다. `/demo` 실행 API는 mock으로 확인·전송·정책·미리보기 변경·토큰 재사용 경계를 검증했다. 실제 AI 실행·출력 품질, 자동 뉴스 수집·회원·게시글 저장·AWS 배포는 후속 작업이다.
- 다음 작업: 실제 출처 소식과 확인한 후보를 대표 회의록 업무에 연결하고 AI 이해를 구현한다. 신규 변경은 브랜치·PR와 CI로 검토한다.

아래는 원본 U-Solve 작업의 과거 인계 기록이다. 현재 실행 방법과 저장소 상태는 위 항목과 `CURRENT.md`를 따른다.

기준: 2026-10-12, Asia/Seoul. [현재 상태](CURRENT.md), [기획](PLAN.md), [완료 기준](ACCEPTANCE.md)을 따른다.

## 이번 작업

- 사용자의 최신 수정인 **게시판 형식의 메인 질문 화면**과 **별도 AI 뉴스 카테고리**를 구현했다. `코멘토 참고.png`를 직접 열어 넓은 질문 입력과 간결한 목록 배치를 참고했다. `/`에서 질문을 제출하면 관련 가상 소식과 조건별 추천 답변으로 이어진다. 예시 질문은 가상 게시글이고 사용자 질문은 현재 화면에서만 처리된다.
- `shared/data/brief_mock.json`은 가상 질문·소식·후보 설명이다. `brief_engine.py`의 `MockBriefRepository`가 읽고 업무 단어와 외부 AI 정책·설치·Google/Microsoft 환경·시험 자료·n8n 실행 위치로 결과를 계산한다. 일치 단어가 없으면 특정 서비스 추천을 보류한다. 데이터 접근과 판정 함수를 분리해 검증된 실제 공급원으로 교체할 지점을 남겼다.
- `frontend/src/index.html`, `frontend/src/brief.css`, `frontend/src/brief.js`는 질문 게시판과 답변이다. `frontend/src/news.html`, `frontend/src/news.js`는 분야 필터·검색·요약 상세가 있는 뉴스 화면이다. `app.py`는 `/api/board`, `/api/news`, `/api/brief`, `/api/brief/confirm`을 제공한다. 뉴스의 업무 분야에서 예시 질문으로 돌아올 수 있다. 초기 추천 응답에는 URL이 없으며 방향 확인 후 조건상 검토 가능한 후보에만 링크를 준다. 이전 5건 탐색은 `/explore`, 세 문서 본문 처리 시연은 `/demo`에 보존했다.
- `README.md`, `AGENTS.md`, `PLAN.md`, `ACCEPTANCE.md`, `CURRENT.md`를 최신 화면과 mock/실제 경계에 맞췄다. 게시판·뉴스 Seed는 `seed_d5f3732c4c93`, 앞선 소식·추천 Seed는 `seed_a4d15145d51b`; 이전 두 Seed의 판정과 실행 기록도 유지한다.
- 최신 수정에 대한 가상 기업 실무자 검토는 질문 후 결과가 자신의 글처럼 보이되 공개 게시로 오해되지 않고, 뉴스가 별도 목록·상세로 읽혀야 한다고 지적했다. 독립 기획 검증자는 `/`·`/news` 경계, 가상 소식 표시, 뉴스→질문 연결과 URL 확인 경계를 점검했다. 두 검토는 **내부 합성 시나리오**이며 실제 고객 인터뷰가 아니다.

## 실행과 검증

- 실행: `cd /home/s2608/orca/workspaces/u-solve/prototype && python3 app.py` → `http://127.0.0.1:8765/`. 이번 작업 종료 시 로컬 서버는 실행 중이다. PC 재시작 후에는 같은 명령으로 다시 연다. 기본 mock 화면에는 외부 API 비용이 없다. `/demo`에서 본문 처리를 실행하는 경우에만 별도 Codex CLI가 필요하다.
- 배포: [Sites 정적 mock 시연](https://u-solve-board-demo-20261012.stony-grove-6981.chatgpt.site)을 2026-10-12 **공개 접근**으로 전환했다. 인증 없는 외부 요청에서 `/`·`/news/`·`/mock_api.js`·`/brief_mock.json` HTTP 200을 확인했다. `site/.openai/hosting.json`은 프로젝트 ID와 `dist`를, `frontend/src/`는 질문·뉴스 UI와 브라우저 내 mock API를 담는다. `frontend/build.mjs`로 정적 파일을 만들고 `frontend/tests/static.test.mjs`로 주요 흐름을 검증한다. 배포판에는 `/explore`·`/demo`가 없고 사용자 질문은 서버로 전송되지 않는다. 링크 확인은 화면 흐름이지 보안 경계가 아니다.
- GitHub: WSL에는 `gh`가 없지만 Windows GitHub CLI는 `seongwwww`로 인증돼 있다. [seongwwww/u-solve](https://github.com/seongwwww/u-solve) 비공개 저장소를 만들고 로컬 `prototype` 브랜치 커밋 `95e6604`를 원격 `main`에 푸시했다. 원격 SHA와 로컬 SHA 일치를 확인했다. CLI 토큰은 저장소·문서에 기록하지 않았다.
- GitHub Pages: 같은 정적 빌드를 `gh-pages`에 올려 Pages API를 호출했으나 `Your current plan does not support GitHub Pages for this repository.`(422)로 거절됐다. 시험용 원격 `gh-pages` 브랜치는 삭제했다. 공개 Sites 배포는 별도로 정상 작동한다.
- 자동 검증: `python3 -m unittest discover -s tests -v` **8개 PASS**. Python 구문 검사, 새 화면의 JS 구문 검사, JSON 파싱, `git diff --check`도 통과했다. 실행 서버에서 `/`, `/news`, `/api/board`, `/api/news`, JS·CSS 자산, `/explore`, `/demo` HTTP 200을 확인했다. 업무·환경별 추천 변화, mock 표기·보류/제외·무매치·초기 URL 미노출을 시험했다.
- 정적 판 검증: `node frontend/build.mjs`, `node frontend/tests/static.test.mjs` 통과. 별도 로컬 정적 서버에서 `/`·`/news/`·JS·CSS·JSON의 HTTP 200을 확인한 뒤 종료했다. Sites 배포 `appgdep_6acc649b7988819188c39ac8950366e0`은 `succeeded`다.
- 브라우저 자동 제어 도구와 로컬 브라우저가 이 환경에 없어 화면의 직접 클릭·시각 검토는 하지 못했다. 서버/API·정적 자산·JS 구문으로 검증한 범위를 넘어 UI 조작 PASS를 주장하지 않는다.
- 공식 페이지를 읽어 n8n 회의·양식 템플릿의 self-hosted 전용 community node 조건을 판정에 반영했다. ChatGPT·Microsoft 365 Copilot·n8n·GitHub의 원본 페이지 링크는 일부 접근 확인했지만, 계정별 기능·요금·한국어 품질·실제 설치 성공은 확인하지 않았다. NotebookLM 시작 URL은 도구에서 Google 로그인 주소로 리디렉션되어 실제 계정 접근을 검증하지 못했다.

## 남은 일

1. `coldgun`에 대한 `PUT /repos/seongwwww/u-solve/collaborators/coldgun` 요청은 GitHub에서 `coldgun is not a user`(404)로 거절됐다. `GET /users/coldgun`은 `type: Organization`이다. 초대할 **개인 GitHub 계정명**을 받으면 같은 비공개 저장소에 기여자로 초대하고 수락 상태를 확인한다.
2. 실제 브라우저에서 배포판 메인의 질문 입력·예시 질문 전환·환경 선택·소식→후보 이동·방법 미리보기·확인 후 링크와 `/news/`의 필터·검색·상세·질문 연결, 모바일 폭을 조작·시각 검토한다.
3. 실제 소식 공급원과 후보 카탈로그를 연결할 때 기사 원문·발행/확인 시각·중복·출처·갱신 기록을 남기고, 제품별 기능·권한·요금·파일 형식을 다시 검증한다. 한국어 Threads 자동 수집은 실제 수집 실행 기록으로 따로 판정한다.
4. 기업 적용 전 정책·이번 자료 전송 허용·시험용 대상·사람 검토·복구 방법을 확인한다. 기존 `/demo` 세 사례의 사람 원문 대조와 브라우저 검토도 별도로 남아 있다.

원본 작업은 `prototype` 브랜치의 로컬 커밋에 정리했다. Sites 정적 mock 판을 공개 배포하고 GitHub 개인 비공개 저장소에 푸시했다. 유료 API 호출·기업 원본 처리는 하지 않았다.
