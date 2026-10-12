# 툴밋 인계

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
