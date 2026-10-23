# 툴밋 인계

## 2026-10-23 #20 v0.1.0 배포 확인 · 기록 PR 준비

- [PR #19](https://github.com/coldgeon/toolmeet/pull/19) 병합 커밋 `9fc3b3c2bce711bf9dab5c7f6663140da7d5c101`의 main CI 성공과 미사용 `v0.1.0` 태그를 확인했다. 별도 깨끗한 worktree에서 주석 태그를 만들고 `node scripts/validate_release.mjs v0.1.0` 통과 후 push했다. 공유 main checkout의 미커밋 문서는 건드리지 않았다.
- [릴리스 실행](https://github.com/coldgeon/toolmeet/actions/runs/39963182463)의 build·deploy·release가 모두 성공했고 정식 [GitHub Release](https://github.com/coldgeon/toolmeet/releases/tag/v0.1.0)에 버전 묶음이 있다. [Pages 홈](https://coldgeon.github.io/toolmeet/)·[뉴스](https://coldgeon.github.io/toolmeet/news/)가 HTTP 200이며 공개 [`release.json`](https://coldgeon.github.io/toolmeet/release.json)의 tag/version/commit/mode는 `v0.1.0`/`0.1.0`/위 SHA/`static-mock`이다. workflow의 공개 manifest·전체 파일 SHA256 대조도 통과했다.
- 실제 공개 브라우저에서 홈 mock 고지, 예시 질문 클릭 후 조건 확인 대화, 뉴스 목록과 상세의 가상 소식 고지·질문 링크를 확인했다. 실제 기기·스크린리더·전체 추천/방향 확인 흐름은 이번 브라우저 확인 범위 밖이다. 실제 AI·수집·Python API는 배포하지 않았다.
- 문서 브랜치에서 `npm ci --ignore-scripts --no-audit --no-fund`, 전체 `npm test`(릴리스/정책 36, 프론트 182, Python 13, 정적·HTTP 통합), `npm run build`, `git diff --check`, `npm run task:overlap`이 통과했다. 열린 PR과 변경 경로 중복은 없고 기준 `origin/main`은 위 병합 SHA 그대로다.
- [이슈 #20](https://github.com/coldgeon/toolmeet/issues/20) 범위는 배포 결과를 `CURRENT.md`·`HANDOFF.md`·`RELEASE.md`에 사실대로 기록하는 문서 PR이다. 이 브랜치는 `seongwwww/issue-20-release-status`, 기준 main은 위 SHA다. Discord 인계 채널 `#codex` 조회 시 이 이슈·릴리스와 관련된 기존 보고가 없었다. 문서 기록 후 한 건 보고한다.
- 다음 담당: PR 검토자는 문서와 CI를 확인한다. 실제 휴대폰/스크린리더·전체 공개 화면 흐름은 별도 검증 작업으로 남긴다. PR 머지는 이번 지시 범위 밖이다.

## 2026-10-23 #18 구현·Pages 최초 설정 완료 · PR 준비

- 이슈 [#18](https://github.com/coldgeon/toolmeet/issues/18) 등록 후 사용자 `배포 진행하자`로 별도 구현 시작을 확인했다. 최신 main `f8678c6800b1b32f5bdc0eb343c9153d772f86a9`에서 managed worktree `C:/Users/cksrj/.codex/worktrees/issue-18-pages-release/u-solve`를 만들고 이슈 Development에 연결한 `chore/18-pages-release` 브랜치를 선택했다. 공유 폴더와 다른 worktree의 미커밋 파일을 가져오지 않았다.
- `.github/workflows/release.yml`의 build는 이벤트 SHA 고정 checkout·주석/안정 태그·package 버전·main 포함 확인·전체 시험/빌드·release.json·버전 tar/Pages artifact를 처리한다. deploy는 Pages write/OIDC 권한으로 배포하고 같은 묶음의 manifest 및 모든 빌드 파일 SHA256을 실제 page_url에서 확인한다. release는 앞 두 job 성공 후 contents write로 Release를 생성하며 기존 Release 자산을 덮어쓰지 않는다. 공용 동시 실행 그룹·태그 push 전용·credential 미보존을 적용했다.
- `validate_release.mjs`, `verify_deployment.mjs`, 릴리스 회귀 33개와 실행/복구 `docs/RELEASE.md`를 추가했다. yaml 2.9.1은 workflow 정책 시험용 개발 의존성이며 npm test에 연결했다. 프론트 소스/빌드·API/공용 데이터·버전 값은 변경하지 않았다.
- 검증: targeted 릴리스 33 PASS, 전체 npm test PASS(릴리스 33+정책 3·프론트 182·Python 13·정적 /toolmeet/·HTTP 통합 15조합), npm run build PASS. 공식 rhysd/actionlint 1.7.12 Windows 배포 파일의 SHA256을 검증한 뒤 release.yml 검사 PASS(shellcheck 외부 실행은 비활성). git diff --check PASS. fixture Git 태그는 OS 임시 디렉터리에만 만들고 범위를 검사해 정리했다. 실제 저장소 태그·유료/AI API는 호출하지 않았다.
- 승인 범위의 외부 설정: Pages build_type workflow·HTTPS true, github-pages custom_branch_policies true, 단일 name v*/type tag 규칙을 설정했다. Pages 최초 생성이 main branch 규칙을 자동 추가해 그 id 64073534의 이름/유형을 재확인하고 제거했다. 기존 환경이 없는 상태를 먼저 보존했고 다른 보호 설정을 바꾸지 않았다. 최종 v* 정책 id는 64073532다.
- 실제 태그·Release·deployment는 0건이고 https://coldgeon.github.io/toolmeet/ 은 아직 HTTP 404다. 최초 설정·로컬 fixture를 실제 공개 배포 성공으로 보고하지 않는다. GitHub Actions의 원격 Windows/Linux/PR CI·태그 이벤트·공개 CDN·실제 공개 브라우저 흐름은 PR/후속 배포 단계에서 확인한다.
- 근거는 채팅 산출물 `C:/Users/cksrj/.codex/visualizations/2026/10/14/01a1392a-af12-7ba3-acb8-e186d87f6be7/`의 issue18-seed.json·issue18-npm-test.log·issue18-pages-before.json·issue18-pages-configured.json·설정 JSON과 actionlint 파일에 있다. Ouroboros 도구/CLI가 없어 로컬 Seed를 사용했고 다른 반복 실행기를 추가하지 않았다. Discord 호출 도구가 없어 조회/게시하지 않았다.
- 다음은 현재 main/열린 PR 중복과 clean commit 확인 후 전체 PR 초안을 사용자에게 제시하는 것이다. PR 생성·머지는 각각 별도 사람 승인 단계다. 실제 첫 태그 v0.1.0과 릴리스 커밋은 구성 머지 후 확정하며 버전 태그를 미리 만들지 않는다. 원래 공유 폴더는 pull/checkout/reset/clean하지 않는다.

## 2026-10-14 #15 배경 정지·재개·전체 화면 배치 구현과 로컬 실행

- 승인: 사람 사용자 `오케이 #15 구현 시작해줘. 다 되면 로컬로 띄워줘.`. [#15](https://github.com/coldgeon/toolmeet/issues/15)의 기존 범위·완료 기준을 보존하고 착수 승인·#6/PR #16 머지·변경/검증 경로를 이슈에 보완했다. 최신 main `297d3182307c9c386dc97e1663794f14c3667438`의 managed worktree `C:/Users/cksrj/.codex/worktrees/issue-15-home-background/u-solve`와 이슈 Development에 연결한 `feat/15-home-background`를 사용한다.
- exploration.js에서 입력으로 인한 정지와 수동 정지, 움직임 감소를 구분한다. 입력/조건/대화의 실제 조작은 보이는 배경을 정지한다. 비대화 배경 클릭과 명시 재생은 CSS animation을 이어서 재생하며 배경 이벤트가 form·condition·button·tab·link 조작을 대신하지 않는다. 배경 mousedown의 기본 초점 이동만 막고 focus/blur를 호출하지 않는다. 배경 재개는 질문·답변·projectId·revision·request/token/확인 수명을 변경하지 않는다. 새 질문 뒤 조건 details의 늦은 close toggle이 다시 집중 상태를 만들지 않도록 회귀를 보완했다.
- 배경 폭에 맞춘 열과 높이에 충분한 동일 두 반복 주기를 같은 카탈로그 ID·합성 SVG로 채운다. 입력 시 트랙/카드를 교체하거나 크기·opacity·gradient를 바꾸지 않는다. ResizeObserver로 화면·조건 높이에 맞추며 주기 크기가 달라질 때 실제 animation 시간 위치를 보정해 픽셀 위치를 보존한다. reduced-motion은 animation을 제거하지 않고 pause해 설정 변경 뒤에도 위치를 이어간다.
- question-stage의 내용은 clip하지 않고 배경 레이어만 clip한다. scrollbar-gutter로 입력/대화에 따른 스크롤바 등장 시 배경 너비가 바뀌는 것을 줄였다. 헤더/탭/푸터를 뺀 기본 화면 높이와 짧은 desktop/mobile 간격을 조정했다. 답변 전 입력만 한 화면에서는 하단 예시 목록의 여백을 숨기고 대화/추천이 생기면 기존 목록을 제공한다. 긴 입력의 textarea 스크롤, 조건 펼침·프로젝트 맥락·대화/추천·목록의 문서 스크롤을 보존했다.
- 최종 검증: npm test PASS(프론트 182 = 기존 175 + 보존/초기화 회귀 7, Python 13, workflow 정책 3, 정적 mock /toolmeet/·HTTP 통합 15조합), npm run build PASS, git diff --check PASS. 실제 mock/DOM과 제어 가능한 요청 fixture를 사용했으며 일반 시험에서 실제 Codex·유료 API를 호출하지 않았다. 정적 /toolmeet/에서 배경 재개와 모션 제어가 데이터 재조회/확인 링크 무효화를 만들지 않음을 추가로 검증했다.
- 브라우저 검증: 1058×641 요청(실제 viewport 1058×642 반올림), 1322×712·1366×768·1440×900·1920×1080, 320/360/390×800·360×560. 기본/입력 상태에서 정상 높이 화면은 스크롤 없이 입력·제출·안내·모션 제어·푸터에 접근하고, 360×560은 세로 스크롤을 허용한다. 가로 넘침 없음과 배경 반복 주기 높이/동일 타일 채움을 확인했다. 두 번 읽은 paused transform이 같고 재개 시 0으로 초기화하지 않으며 카드 크기/opacity가 유지됐다. mobile 조건 펼침으로 주기가 늘어나도 transform 유지, 배경 클릭 후 입력/조건/확인 URL 보존, Space 모션 제어, 320px 프리뷰·상세·기존 질문과 같은 프로젝트 맥락 연결을 확인했다. 긴 480자 입력과 짧은 화면/프로젝트 맥락에서 내부·문서 스크롤 영역이 존재하고 가로 넘침이 없다. 콘솔 오류 없음. 브라우저 입력 한 건의 CDP 지연은 현재 상태 재확인 후 키보드로 완료했으며 제품 오류로 단정하지 않았다.
- 실제 휴대폰·소프트 키보드·OS 움직임 감소 설정 변경·실제 브라우저 확대·스크린리더·실제 AI/자동 수집/도구 실행·공개 배포는 미검증이다. 움직임 감소 우선과 수동 선택 유지/대기·역순 응답 수명은 DOM fixture 검증이다. backend/shared/API/추천 계약·#8 조사 데이터·새 후보/미디어·프레임워크·배포 설정은 변경하지 않았다.
- Seed `seed_8ba8dea90677`, 전체 시험 로그·브라우저 크기/모션 JSON·desktop/mobile JPG·PR 초안은 `C:/Users/cksrj/.codex/visualizations/2026/10/14/01a1392a-af12-7ba3-acb8-e186d87f6be7/`에 보존한다. 현재 Ouroboros 도구·CLI와 Discord 연결 도구가 없어 로컬 Seed/원본 이슈·저장소로 진행했고 다른 반복 실행기나 외부 메시지는 추가하지 않았다.
- 사용자가 요청한 로컬 서버는 이 worktree의 npm run dev로 http://127.0.0.1:5173 (API 8765)에 띄우고 브라우저 탭을 남긴다. PC/프로세스 종료 뒤에는 같은 폴더에서 npm run dev로 재시작한다. 원래 공유 폴더는 pull/checkout/reset/clean하지 않았고 다른 채팅의 미커밋 초안을 보존했다.
- 다음: 완료 보고와 PR 제목·본문 전체 초안 제출 후 **사람 PR 생성 승인**을 기다린다. 승인 시 최신 main/열린 PR 경로 중복·head를 재확인하고 작업 브랜치 정상 push·Closes #15의 일반 PR을 생성한다. 원격 CI·머지·태그·배포는 후속 승인/검증 단계다. 이번 구현에서 PR을 생성하거나 머지·태그·배포하지 않았다.

## 2026-10-13 #6 프로젝트 프리뷰·상세·질문 연결 · 로컬 검증 완료

- 승인: 사용자 “좋아, #6 구현 시작해. 기존 스택과 승인된 이슈 범위로 진행하고, 완료 후 검증 결과와 PR 초안을 보여줘. PR 생성·머지·태그·배포는 별도 승인으로 남겨줘. 또한 다 되면 로칼로 한 번 띄워주라”. [이슈 #6](https://github.com/coldgeon/toolmeet/issues/6)의 기존 목표를 확대하지 않고 경로/승인 메타데이터를 보완했다. 이슈에 연결된 `feat/6-project-preview`, `C:/Users/cksrj/.codex/worktrees/issue-6-project-preview/u-solve`를 최신 origin/main `b2a1ac6df3765822182357c3010c8d7618b38132`에서 준비했다. 원래 공유 폴더·#5와 #8 worktree의 미커밋 변경을 옮기거나 수정하지 않았다.
- `projects.js`는 카드 호버와 명시 버튼이 같은 저장 활용 순서를 보여주도록 구성한다. 한 프리뷰만 열고 명시 열기는 닫기 버튼에 초점을 준다. 닫기/Escape는 해당 버튼에 복귀하고 탭 전환은 프리뷰를 닫는다. 카드 선택/상세 버튼은 같은 catalog.get ID의 상세를 연다. native dialog의 초점 순환·Escape/닫기·복귀, 오류/재시도·not_found·늦은 상세 응답을 처리한다. 비동기 이전 close 이벤트가 재열린 상세를 닫지 않도록 보호했다.
- 상세는 기존 설명·method·사용 조건·근거와 미확인 비용/실행 위치를 보여준다. catalog.validateProject를 목록과 상세에 재사용해 필수 자료·조건 타입/enum·근거 참조를 검증한다. 권리 미확인·경로 이탈·종류/확장자 불일치 미디어는 채택하지 않는다. 이미지 오류는 설명으로 대체한다. 영상은 상세의 controls/preload none, autoplay 없이 사용자 재생만 허용하고 닫기/오류/탭/새 질문에서 pause·src 제거·load를 수행한다. 현재 실제 저장 영상 파일은 없으며 영상 재생 바이트/코덱은 미검증이다.
- 상세의 질문 연결은 같은 ID를 brief snapshot과 탐색 상태에 적용한다. 선택 이름과 mock 경계를 질문 위에 표시하고 기존 work·선택 조건·명시 답변·초안을 보존한다. 다른 ID 선택/해제는 #5 changed/refresh 경로로 이전 추천·token·원본 링크를 즉시 무효화하며 대기 중 이전 확인 성공/실패도 무시한다. 같은 ID 재선택이나 상세만 읽기는 revision을 바꾸지 않는다. 새 질문은 선택 맥락을 초기화한다. 설치/실행/원본 링크를 카드·상세에 추가하지 않았으며 실제 프로젝트별 backend 판정은 이슈 범위 밖이다.
- 개발/정적 빌드에 같은 원본 projects.js를 연결했다. 정적 /toolmeet/의 프리뷰·상세·media src·질문 맥락·확인 링크 무효화도 자동 회귀로 검증했다. backend/shared 원본·#8 조사 자료·프레임워크·배포 설정은 변경하지 않았다. Ctrl/Meta/Alt+Home 페이지 탐색이 탭의 Home 선택 동작에 가로막히지 않도록 키보드 회귀를 보완했다.
- 검증: npm ci 성공, 최종 전체 npm test 성공(프론트 175개 = 기존 124 + 카탈로그 10 + 프로젝트 DOM 41, Python 13, workflow 정책 3, 정적·하위 경로·HTTP 15조합), npm run build·git diff --check 통과. 실제 production adapter/DTO/DOM을 사용하고 HTTP/지연 상세/미디어는 fixture로 제어했다. 일반 테스트에서 실제 Codex·유료 API는 호출하지 않았다. 구현 커밋 `74bd9f1` 뒤 task:overlap은 11개 제품 변경 경로·열린 PR 없음으로 통과했다. 문서 기록 후 최종 head 검사 결과는 채팅 검토 자료에 남긴다.
- 브라우저: 개발 API의 데스크톱 호버/명시 버튼·상세 키보드 Tab/Shift+Tab/Escape·초점 복귀, 320/360/390×800과 360×560에서 프리뷰/상세·질문 입력 보존·가로 넘침 없음, 방향 확인 링크→프로젝트 변경 시 링크 제거를 확인했다. 정적 /toolmeet/ 직접 진입과 상세 자산 상대 경로, 뉴스 상세→질문 자동 채움·대화, 콘솔 오류 없음도 확인했다. /explore·/demo는 기존 HTTP/자산 통합으로 보존을 확인했고 실제 도구 실행은 하지 않았다. 실제 휴대폰/소프트 키보드·스크린리더·OS 움직임 감소 설정 변경·실제 AI·도구 실행·실제 영상·공개 배포는 미검증이다. 기존 움직임 감소/수동 정지 DOM/CSS 회귀는 통과했다.
- 독립 기술 검토와 테스트 초안으로 상세 DTO 검증, close 이벤트 경합, 카드 초점 유지와 영상 종료를 점검했다. 하위 에이전트는 저장소 밖 초안/읽기 검토만 담당했고 root가 단독으로 제품·테스트를 반영했다. 이 검토는 사람 사용자 승인이나 실제 고객 검증이 아니다.
- Seed `seed_6a7749c8e253`와 PR 초안/화면 증거는 `C:/Users/cksrj/.codex/visualizations/2026/10/13/01a13389-558a-7ad2-b5c4-9230913c6d2f/`에 저장한다. 현재 Ouroboros·Discord 연결 도구가 없어 Seed 로컬 기록과 GitHub/저장소 원본을 사용하며 다른 반복 실행기·외부 메시지는 추가하지 않았다.
- 사용자 확인용 개발 서버는 이 #6 worktree의 npm run dev, http://127.0.0.1:5173 (API 8765)로 계속 실행하고 브라우저 탭을 남긴다. 정적 확인용 15180 서버는 확인 후 종료한다. PC/프로세스 종료 뒤에는 같은 worktree에서 npm run dev로 재시작한다.
- 다음 단계: 이 채팅에 변경·검증·미검증 항목과 PR 제목/본문 전체 초안을 제출한다. 초안 승인 후에만 최신 main/overlap 재확인·작업 브랜치 정상 push·일반 PR 1개(Closes #6)를 생성한다. 원격 CI는 PR 생성 후 확인한다. 머지·태그·배포 승인은 각각 별도이며 이번 실행에서 수행하지 않았다.


## 2026-10-13 #5 조건 확인 대화 · PR #14 등록

- PR 등록 결과: #13 반영·문서 충돌 조정·최신 main 기준 전체 검증·task:overlap(14개 변경 경로, 다른 열린 PR과 겹침 없음)·PR 형식 검사를 완료한 뒤 승인된 #5 브랜치만 정상 push했다. [일반 PR #14](https://github.com/coldgeon/toolmeet/pull/14)를 main 대상으로 생성해 Closes #5 하나에 연결하고 이 채팅의 PR artifact로 등록했다. 생성 시 head는 `b712ad463a8c23c33c5aad1b9b0994f0ba157b2f`였으며 workflow-policy SUCCESS와 Windows/Ubuntu 검사 실행 중 상태를 확인했다. 이 PR 등록 기록을 후속 문서 커밋으로 남기며 제품 코드에는 변경이 없다. 자동 후속 확인 `13-5-pr`은 목적 달성으로 PAUSED로 중지했다. PR 머지·태그·배포는 실행하지 않았다.

- PR 생성 후속 실행: #13이 `61254d1f866ac9485dd40b574f58bc6940985df8`로 main에 머지된 것을 원본 GitHub와 fetch/ancestor 검사로 확인했다. 승인된 기존 브랜치에 최신 main을 병합했고 HANDOFF 상단 충돌은 #5와 #12 기록을 모두 보존했다. AGENTS/COLLABORATION의 #13 절차는 main 원본대로 유지했다. 이번 세션에는 호출 가능한 Discord 도구가 없어 채널/스레드 조회를 완료하지 않았으며 사용자 외부 메시지 금지에 따라 게시하지 않는다. GitHub 이슈·PR·저장소 원본으로 진행한다. 승인된 제품 코드와 #13 협업 규칙 보존은 독립 읽기 비교로 확인했다. npm ci 복원 성공 뒤 최신 main 기준 전체 npm test(프론트 124, Python 13, 정책 3, 정적·15조합 HTTP 통합)·npm run build·git diff --check와 task:overlap이 모두 통과했다(변경 경로 14개, 다른 열린 PR과 겹침 없음). 승인된 제목·본문에서 기준 main·충돌 해결·검증 사실만 갱신해 일반 PR을 생성한다.

- 사용자 인계 메시지가 기존 #5의 구현 재개를 명시해 이슈/브랜치/작업 폴더를 새로 만들지 않았다. 기존 `C:/Users/cksrj/.codex/worktrees/issue-5-question-conversation/u-solve`, `feat/5-question-conversation`에서 clean HEAD와 최신 origin/main `f387ab0180142be4d5c2caa50e878741488ecedc`, 열린 이슈 #5/문서 PR #13을 확인하고 시작했다. 공유 원래 폴더의 PM 미커밋 초안과 제품 파일은 복사하거나 수정하지 않았다.
- `frontend/src/conversation.js`에 exploration.v1 snapshot·fact·question·추천·confirm 검증과 교체 가능한 mock evaluate/confirm 어댑터를 추가했다. 기존 후보 ID와 판정 API를 재사용한다. 알려진 명시 예시 구절만 facts로 읽고 부정/모호한 구절은 조건으로 추정하지 않으며 명시 답변을 우선하고 충돌 확인 이유를 표시한다. 원하는 결과가 빠지면 자유 답변 하나를 묻고 후보의 미확인 필수조건만 선택한다. 충분한 정보는 즉시 추천, 모름/내부 자료 등 다른 질문으로 풀 수 없는 보류는 조건 확인 필요로 마무리한다.
- `brief.js`, `index.html`, `brief.css`에 실제 단계, 한 질문, 미답변/known/unknown, 답변 수정·삭제·초안, 오류/재시도·empty/hold·내부 준비 방법을 추가했다. 기존 뉴스·후보 이유·조건·활용 방법·방향 확인 후 링크를 재사용했다. 탭은 DOM/대화/revision을 보존한다. 새 질문만 전체 초기화하며 모션 선호는 기존 탐색 UI에 남는다.
- 모든 의미 변경은 revision 증가와 이전 결과/추천 token/확인/링크 즉시 제거를 먼저 수행한다. 같은 revision 재평가도 새 turn ID로 confirm을 무효화한다. turn과 confirm의 최신 revision/request_id/추천 요청/token 비교 뒤 payload 검증을 통과한 응답만 표시하고 오래된 성공/오류/finally를 무시한다. 화면 token 제거는 backend 메모리 token 폐기가 아니며 새 서버 기능을 구현하지 않았다.
- 개발/정적 빌드에 같은 원본 conversation.js를 연결했다. backend/shared 원본과 프레임워크·배포 설정은 변경하지 않았다. outcome은 기존 brief의 업무 입력에 설명을 덧붙이는 호환 방식이며 실제 자유문장 이해가 아니다. cost/project_id는 snapshot·검증·편집 계약을 보존하지만 기존 API에 실제 비용·프로젝트별 판단을 추가하지 않았다.
- 검증: 최종 `npm test` 성공. frontend 총 124개(기존 #1/#4 HTTP 경합·탐색 44개, 실제 mock/계약 31개, 대화 DOM 49개), Python 13개, workflow 정책 3개, 정적 빌드·하위 경로·뉴스/후보·확인 관문, HTTP 5개 화면/자산·15개 Python/정적 판정 비교 통과. `npm run build`, JS 구문/공백 검사 통과. 실제 Codex·유료 API는 호출하지 않았다. 기존 경합 fixtures는 질문 선택만 제어하며 production normalize/validate/confirm을 사용하고 실제 질문 흐름은 별도 actual adapter/DOM 시험으로 검증했다.
- 브라우저 확인: 실제 local 개발 API에서 선택 질문→조기 추천→활용 방법→방향 확인 링크, 정책을 모름으로 수정해 링크 제거/보류, 자유 답변과 탭 왕복 초안 보존을 조작했다. 1440×900, 320/360/390×800 및 360×560에서 대화/추천 가로 넘침 없음·키보드 제출/답변/확인·초점 이동을 확인했다. 정적 `/toolmeet/` 직접 진입·저장 합성 이미지·뉴스 상세→질문 자동 채움/대화·추천/확인, 콘솔 오류 없음도 확인했다. `/explore`, `/demo`는 HTTP/자산 통합 검증으로 보존을 확인했으며 실제 도구 실행은 하지 않았다.
- 독립 코드 검토가 찾은 업무 근거 이력 누락, 부정 결과 오해, 내부 자료 불필요 질문, 대기 중 편집 초안 소실을 수정하고 회귀에 반영했다. 내부 에이전트 검토는 사람의 승인이나 고객 인터뷰를 대신하지 않는다.
- 기존 Seed `seed_49cafe36102b`를 이어받고 현재 검토/화면 증거는 저장소 밖 `C:/Users/cksrj/.codex/visualizations/2026/10/13/01a13389-558a-7ad2-b5c4-9230913c6d2f/`에 보관한다. 현 세션에 Ouroboros MCP/CLI가 없어 Seed 기록만 유지하고 다른 반복 실행기는 추가하지 않았다.
- 미검증: 실제 휴대폰/소프트 키보드·스크린리더·OS 움직임 감소 설정 변경(기존 DOM matchMedia/CSS 회귀는 통과), 실제 AI/기사 수집/회사 정책/도구 실행/요금, 공개 배포. 원격 Windows/Linux CI는 PR #14의 최신 head 검사로 별도 확인한다. #6의 프로젝트 상세/프리뷰·실제 project_id 추천, 새로고침/로그인 저장 복원도 범위 밖이다.
- 첫 후속 확인의 복구: #13은 OPEN이고 #5 PR은 없었다. 기존 #5 checkout 폴더가 사라졌으나 같은 이슈 브랜치와 `7d96b5b3a8b3abd86be4e24b6ce6b9339c85006a` 이하 구현/승인 기록 커밋이 Git에 보존돼 있었다. 사라진 원인은 확정하지 않았다. 기존 브랜치를 같은 원래 경로에 다시 checkout해 작업 폴더를 복구했고 공유 main checkout·미커밋 파일은 변경하지 않았다. 복구 HEAD의 frontend/backend/shared 파일이 승인된 구현 `ae3ad74`와 같은 것과 clean 상태를 확인했다. 제품 변경이 없어 기능 시험을 반복하지 않았으며 #13 반영 후에는 npm ci와 필요한 전체 검증을 실행한다. 앱 attach_worktree는 이 ownerless worktree가 해당 채팅 소유인지 확인할 수 없어 등록하지 못했지만 Git 작업 폴더 복구는 성공했다.
- 후속 확인: 향후 push/PR 생성까지 재개하는 지속적 자동화 설정은 최초 자동 승인 검토에서 명시 승인 부족으로 거절됐다. 사용자에게 정확한 범위를 설명하고 `자동 후속 확인 허용` 응답을 받은 뒤 이 채팅의 15분 간격 heartbeat `13-5-pr`을 ACTIVE로 생성했다. #13이 unchanged/OPEN이면 조용히 대기하고 반영 뒤 승인된 #5 PR 생성까지 재개한다. PR 생성 또는 필수 사용자 조치가 있을 때 알리며 완료 뒤 후속 확인을 중지한다. #5/#13 머지와 배포는 승인 범위가 아니다.
- 승인 갱신: 사용자 `좋아, #5 PR 초안 승인해. #13 문서 반영 후 최신 main에 맞추고 중복 검사 통과하면 PR 생성해줘.`로 승인된 제목·본문의 일반 PR 생성을 지시했다. #13은 아직 OPEN이고 원격 main은 `f387ab0180142be4d5c2caa50e878741488ecedc`다. 로컬 제품 구현 커밋 `ae3ad74182a41814f035b517342414304b122482`는 변경하지 않았다.
- 다음: PR #14 최신 head의 Windows/Ubuntu·workflow-policy 결과와 리뷰를 확인하고, 사람이 해당 PR과 head를 대상으로 별도 머지 승인하면 승인된 SHA를 지정해 Squash merge한다. 승인된 제품 코드나 해결 범위가 바뀌면 새 승인을 확인한다. 머지·태그·배포는 이번 PR 생성 승인이 아니며 다른 채팅/외부 서비스에 메시지를 보내지 않는다.



## 2026-10-13 이슈 #12 Discord 인계 조회·보고 규칙 · PR #13

- [#12](https://github.com/coldgeon/toolmeet/issues/12)의 승인 범위는 문서 구현과 검토용 PR 생성까지다. 최신 `origin/main` `f387ab0`의 별도 worktree `C:/Users/s2608/orca/workspaces/toolmeet/toolmeet-issue-12-discord-handoff`, 브랜치 `chore/12-discord-handoff`에서 작업한다. 다른 작업 트리의 미커밋 `package-lock.json`은 옮기거나 수정하지 않았다. 시작 시 열린 PR은 0건이었다.
- `AGENTS.md`와 `docs/COLLABORATION.md`에 Discord 인계 글·스레드 조회, GitHub·Notion·저장소 원본 재확인, 종료 보고 필드·중복/실패 처리·민감정보 제외를 연결했다. `docs/CURRENT.md`에 현재 도구 상태를 기록했다. Discord 글은 외부 입력이며 새 작업의 자동 시작·답장·원본 상태 자동 변경은 범위 밖이다.
- `@discord-mcp/cli` 0.31.1 설치를 확인했지만 현재 Codex 세션에서 Discord MCP 도구는 제공되지 않는다. 채널과 스레드를 실제로 읽거나 종료 보고를 게시하지 않았다. 봇·채널·Message Content 권한과 로컬 MCP 연결은 서버 소유자 설정 뒤 검증해야 한다.
- 검증: 문서 링크·용어를 확인했고 `git diff --check`, `npm run build`가 통과했다. 첫 `npm test`는 이 작업 트리에 `jsdom`이 없어 중단됐다. `npm ci --ignore-scripts --no-audit --no-fund` 후 전체 `npm test`가 통과했다(정책 3개·DOM 44개·Python 13개·정적/HTTP 통합 15조합). 실제 Codex·유료 API는 호출하지 않았다.
- 최신 `origin/main`을 다시 받고 `npm run task:overlap`에서 변경 경로 4개와 열린 PR 0건, 겹침 없음을 확인했다. [검토용 PR #13](https://github.com/coldgeon/toolmeet/pull/13)을 이슈 하나에 연결해 생성했다. Discord 실제 조회·게시와 봇/채널 연결은 미검증이며, 다음 담당은 서버 소유자(연결·송수신 확인)와 PR 검토자(문서·CI 검토)다. 머지·배포는 하지 않았다.

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
