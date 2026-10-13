# 툴밋 (Toolmeet)

**AI 소식부터 내 업무에 맞는 도구까지.** 박찬건·김성원이 함께 만드는 업무 도구 탐색 서비스의 모노레포입니다.

사용자가 업무와 사용 환경을 입력하면 관련 AI 소식, 서비스·공개 프로젝트 후보, 추천 이유, 조건과 첫 사용 방법을 보여줍니다. 현재 질문·뉴스는 **가상 데이터와 단어 규칙으로 동작하는 프로토타입**입니다. 실제 뉴스 수집과 AI 문장 이해는 다음 구현 범위입니다.

## 폴더

```text
frontend/          HTML·CSS·JavaScript 화면, 개발 서버, 정적 빌드
backend/           Python HTTP API, 추천·탐색 로직, API 테스트
shared/data/       공용 mock 데이터·카탈로그·업무 분류 규칙
scripts/           전체 실행, Python 실행, 통합 검증
docs/              기획·완료 기준·인계·합성 문서 시연 기록
architecture/      편집 가능한 draw.io 설계와 미리보기
.github/workflows/ Windows·Linux 자동 검증
```

프론트엔드 원본은 `frontend/src/` 하나입니다. 로컬에서는 `/api/*`를 백엔드로 전달하고, 정적 배포용 빌드는 같은 원본에 브라우저 mock API를 추가합니다. 백엔드는 API만 제공합니다. 홈 배경과 탐색 목록은 같은 mock 카탈로그 ID와 저장 SVG를 사용합니다. SVG는 기존 mock 설명으로 직접 만든 합성 예시이며 실제 서비스 화면·실행 결과가 아닙니다. 실제 자료는 출처·사용 근거가 있는 미디어로 별도 연동합니다.

## 시작

Node.js 20 이상과 Python 3.12 이상을 준비합니다. 기본 시연은 추가 Python 패키지나 API 키가 필요 없습니다.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

브라우저에서 **http://127.0.0.1:5173**을 엽니다. 프론트엔드와 백엔드를 함께 실행하며 `Ctrl+C`로 종료합니다.

| 경로 | 내용 |
|---|---|
| `/` | AI 질문·집중 입력과 모든 프로젝트 보기 탭, 조건·mock 추천·방법 미리보기 |
| `/news` | 분야별 가상 AI 소식·검색·상세·업무 질문 연결 |
| `/explore` | 기존 5개 카탈로그 탐색 시연 |
| `/demo` | 기존 문서 처리 시연. 실제 처리에는 로그인된 Codex CLI 필요 |
| `http://127.0.0.1:8765/api/health` | 백엔드 상태 |

별도 실행은 `npm run dev:frontend`, `npm run dev:backend`를 사용합니다. 포트와 Python 경로는 [.env.example](.env.example)의 환경 변수로 변경할 수 있습니다. `.env` 파일은 자동으로 읽지 않으므로 셸에 값을 설정합니다.

## 검증과 빌드

```bash
npm test
npm run build
```

`npm test`는 jsdom의 질문·탭·모션·응답 경합 회귀, 정적 빌드·브라우저 mock API·하위 경로, Python API, 개발 서버의 화면/자산/API 프록시, 5개 업무×3개 환경의 Python·JavaScript 판정 일치를 확인합니다. 문서 실행의 확인·전송·미리보기 검증은 Codex 호출을 대체한 테스트로 확인합니다.

정적 배포 파일은 `frontend/dist/`에 생성합니다. 이 빌드에는 질문·뉴스 화면을 포함하며 질문을 서버로 전송하지 않습니다. `/explore`와 `/demo`는 로컬 개발 서버의 별도 시연입니다.

실제 Codex 문서 처리 여섯 번을 다시 실행하는 별도 명령은 `python scripts/verify_demo.py --save docs/demo/RUNS.json`입니다. 공개·합성 자료만 사용하며 외부 모델 호출이 발생합니다. 일반 `npm test`에는 포함하지 않습니다. 이전 실행 기록은 [docs/demo](docs/demo/)에 보존했습니다.

## 협업 기준

- 화면은 `frontend/`, API와 판정은 `backend/`, 공용 규칙과 샘플은 `shared/data/`에서 수정합니다.
- 탐색·질문 UX의 후속 mock 기준은 [연동 계약 v1](docs/contracts/exploration-v1.md)과 [합성 예시](docs/contracts/exploration-v1.examples.json)를 따른다. 새 HTTP API는 별도 협의·구현 사항이다.
- 공용 데이터 형식을 바꾸면 `npm test`로 양쪽 응답을 확인합니다.
- 변경은 브랜치와 PR로 검토하고, GitHub Actions에서 Windows·Linux 검증을 진행합니다.
- 이슈·PR 공통 템플릿, 이슈별 worktree 시작 명령, 충돌 확인 순서는 [공동 작업 절차](docs/COLLABORATION.md)를 따릅니다. 예: `npm run task:start -- 12 chore agent-workflow`.
- 최신 범위는 [현재 상태](docs/CURRENT.md), 변경·검증 기록은 [인계](docs/HANDOFF.md), 제품 기준은 [기획](docs/PLAN.md)과 [완료 기준](docs/ACCEPTANCE.md)를 확인합니다.

원본은 [seongwwww/u-solve](https://github.com/seongwwww/u-solve)의 `61831ec`입니다. 원본 커밋 이력과 기존 시연을 보존해 [coldgeon/toolmeet](https://github.com/coldgeon/toolmeet)로 이전했습니다. 기존 Sites 배포 설정은 `docs/legacy/site.openai/hosting.json`에 과거 기록으로 보관했습니다. AWS 소규모 구성은 [draw.io 제안 설계](architecture/Toolmeet_Architecture_v1.drawio) 단계입니다.
