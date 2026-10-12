# U-Solve 인계

기준: 2026-10-12, Asia/Seoul. [현재 상태](CURRENT.md), [기획](PLAN.md), [완료 기준](ACCEPTANCE.md)을 따른다.

## 이번 작업

- 사용자의 최신 수정인 **게시판 형식의 메인 질문 화면**과 **별도 AI 뉴스 카테고리**를 구현했다. `코멘토 참고.png`를 직접 열어 넓은 질문 입력과 간결한 목록 배치를 참고했다. `/`에서 질문을 제출하면 관련 가상 소식과 조건별 추천 답변으로 이어진다. 예시 질문은 가상 게시글이고 사용자 질문은 현재 화면에서만 처리된다.
- `data/brief_mock.json`은 가상 질문·소식·후보 설명이다. `brief_engine.py`의 `MockBriefRepository`가 읽고 업무 단어와 외부 AI 정책·설치·Google/Microsoft 환경·시험 자료·n8n 실행 위치로 결과를 계산한다. 일치 단어가 없으면 특정 서비스 추천을 보류한다. 데이터 접근과 판정 함수를 분리해 검증된 실제 공급원으로 교체할 지점을 남겼다.
- `web/index.html`, `web/brief.css`, `web/brief.js`는 질문 게시판과 답변이다. `web/news.html`, `web/news.js`는 분야 필터·검색·요약 상세가 있는 뉴스 화면이다. `app.py`는 `/api/board`, `/api/news`, `/api/brief`, `/api/brief/confirm`을 제공한다. 뉴스의 업무 분야에서 예시 질문으로 돌아올 수 있다. 초기 추천 응답에는 URL이 없으며 방향 확인 후 조건상 검토 가능한 후보에만 링크를 준다. 이전 5건 탐색은 `/explore`, 세 문서 본문 처리 시연은 `/demo`에 보존했다.
- `README.md`, `AGENTS.md`, `PLAN.md`, `ACCEPTANCE.md`, `CURRENT.md`를 최신 화면과 mock/실제 경계에 맞췄다. 게시판·뉴스 Seed는 `seed_d5f3732c4c93`, 앞선 소식·추천 Seed는 `seed_a4d15145d51b`; 이전 두 Seed의 판정과 실행 기록도 유지한다.
- 최신 수정에 대한 가상 기업 실무자 검토는 질문 후 결과가 자신의 글처럼 보이되 공개 게시로 오해되지 않고, 뉴스가 별도 목록·상세로 읽혀야 한다고 지적했다. 독립 기획 검증자는 `/`·`/news` 경계, 가상 소식 표시, 뉴스→질문 연결과 URL 확인 경계를 점검했다. 두 검토는 **내부 합성 시나리오**이며 실제 고객 인터뷰가 아니다.

## 실행과 검증

- 실행: `cd /home/s2608/orca/workspaces/u-solve/prototype && python3 app.py` → `http://127.0.0.1:8765/`. 이번 작업 종료 시 로컬 서버는 실행 중이다. PC 재시작 후에는 같은 명령으로 다시 연다. 기본 mock 화면에는 외부 API 비용이 없다. `/demo`에서 본문 처리를 실행하는 경우에만 별도 Codex CLI가 필요하다.
- 배포: [Sites 정적 mock 시연](https://u-solve-board-demo-20261012.stony-grove-6981.chatgpt.site)이 2026-10-12 **소유자 전용 접근**으로 성공 배포됐다. `site/.openai/hosting.json`은 프로젝트 ID와 `dist`를, `site/src/`는 질문·뉴스 UI와 브라우저 내 mock API를 담는다. `site/build.mjs`로 정적 파일을 만들고 `site/test_static.mjs`로 주요 흐름을 검증한다. 배포판에는 `/explore`·`/demo`가 없고 사용자 질문은 서버로 전송되지 않는다. 링크 확인은 화면 흐름이지 보안 경계가 아니다.
- 자동 검증: `python3 -m unittest discover -s tests -v` **8개 PASS**. Python 구문 검사, 새 화면의 JS 구문 검사, JSON 파싱, `git diff --check`도 통과했다. 실행 서버에서 `/`, `/news`, `/api/board`, `/api/news`, JS·CSS 자산, `/explore`, `/demo` HTTP 200을 확인했다. 업무·환경별 추천 변화, mock 표기·보류/제외·무매치·초기 URL 미노출을 시험했다.
- 정적 판 검증: `node site/build.mjs`, `node site/test_static.mjs` 통과. 별도 로컬 정적 서버에서 `/`·`/news/`·JS·CSS·JSON의 HTTP 200을 확인한 뒤 종료했다. Sites 배포 `appgdep_6acc649b7988819188c39ac8950366e0`은 `succeeded`다.
- 브라우저 자동 제어 도구와 로컬 브라우저가 이 환경에 없어 화면의 직접 클릭·시각 검토는 하지 못했다. 서버/API·정적 자산·JS 구문으로 검증한 범위를 넘어 UI 조작 PASS를 주장하지 않는다.
- 공식 페이지를 읽어 n8n 회의·양식 템플릿의 self-hosted 전용 community node 조건을 판정에 반영했다. ChatGPT·Microsoft 365 Copilot·n8n·GitHub의 원본 페이지 링크는 일부 접근 확인했지만, 계정별 기능·요금·한국어 품질·실제 설치 성공은 확인하지 않았다. NotebookLM 시작 URL은 도구에서 Google 로그인 주소로 리디렉션되어 실제 계정 접근을 검증하지 못했다.

## 남은 일

1. GitHub 연결이 완료되면 이 워크트리 변경을 비공개 저장소에 업로드한다. 현재 원격 저장소·`gh`·GitHub 인증이 없고 GitHub 연결 제안은 미연결이다. `coldgun`은 GitHub **조직**이므로 개인 기여자 초대 대상 계정 또는 조직 소유 방식을 사용자에게 확인 중이다. 초대 후 수락 상태를 확인한다.
2. 실제 브라우저에서 배포판 메인의 질문 입력·예시 질문 전환·환경 선택·소식→후보 이동·방법 미리보기·확인 후 링크와 `/news/`의 필터·검색·상세·질문 연결, 모바일 폭을 조작·시각 검토한다.
3. 실제 소식 공급원과 후보 카탈로그를 연결할 때 기사 원문·발행/확인 시각·중복·출처·갱신 기록을 남기고, 제품별 기능·권한·요금·파일 형식을 다시 검증한다. 한국어 Threads 자동 수집은 실제 수집 실행 기록으로 따로 판정한다.
4. 기업 적용 전 정책·이번 자료 전송 허용·시험용 대상·사람 검토·복구 방법을 확인한다. 기존 `/demo` 세 사례의 사람 원문 대조와 브라우저 검토도 별도로 남아 있다.

원본 작업은 `prototype` 브랜치의 로컬 커밋에 정리했다. Sites 정적 mock 판만 배포했고 GitHub 푸시·유료 API 호출·기업 원본 처리는 하지 않았다.
