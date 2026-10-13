# 툴밋 현재 상태

## 2026-10-13 조건 확인 대화 #5 · PR 생성 승인, #13 문서 반영 대기

- [#5](https://github.com/coldgeon/toolmeet/issues/5)의 기존 구현 시작·재개 승인으로 전용 worktree와 `feat/5-question-conversation`을 재사용했다. 기준 main은 `f387ab0180142be4d5c2caa50e878741488ecedc`이며 제품 변경은 이 브랜치의 검토 결과다. PR 생성·머지·태그·배포는 진행하지 않았다.
- `conversation.js`의 교체 가능한 frontend mock 어댑터가 exploration.v1 전체 snapshot을 받고 필요한 미확인 조건을 한 번에 하나씩 제공한다. 명시 예시 표현·기존 카탈로그 조건과 기존 `/api/brief`, `/api/brief/confirm`을 사용하며 새 backend 대화 API·실제 AI 이해/질문 생성은 미구현이다. 정적판은 기존 브라우저 mock API를 사용한다.
- 미답변과 명시 모름, 알려진 사실, 선택/자유 답변·수정/삭제, 실제 phase, 대기/오류/재시도/빈 후보/조건 확인 필요를 구분한다. 알려진 조건은 생략하고 준비된 외부 후보가 있으면 조기 종료한다. 결과·정책·자료 등이 모름이면 반복 질문이나 방향 확인으로 보류를 풀지 않는다. 내부 준비 방법은 외부 추천과 분리한다.
- 업무·답변·조건·프로젝트 맥락 변경 및 같은 revision 재평가가 이전 추천·확인·링크를 즉시 지운다. 최신 revision/request_id와 검증된 DTO만 적용하고 확인은 추천 요청·token까지 비교한다. 오류·탭 왕복·대기 중 응답에도 질문/답변/편집 초안을 유지한다. 클라이언트 무효화를 서버 token 폐기로 주장하지 않는다.
- 전체 `npm test`(대화/DOM·어댑터 124개, Python 13개, 정책 3개, 정적/하위 경로·HTTP 통합 15조합)와 `npm run build`가 통과했다. 브라우저 1440×900, 320/360/390×800, 360×560의 대화·추천·키보드·탭 입력 보존·확인 링크·뉴스→질문·정적 `/toolmeet/`를 확인했다. 실제 휴대폰/소프트 키보드·스크린리더·OS 움직임 감소 설정·실제 AI·새 PR CI·배포는 미검증이다.
- 사용자 `좋아, #5 PR 초안 승인해. #13 문서 반영 후 최신 main에 맞추고 중복 검사 통과하면 PR 생성해줘.`로 PR 제목·본문 초안과 선행 문서 정리 후 일반 PR 생성을 승인받았다. 확인 시 #13은 OPEN이며 main은 변경되지 않았다. #5의 승인된 제품 코드·검증 결과는 그대로 보존한다. 머지·태그·배포 승인은 없다.
- 열린 [PR #13](https://github.com/coldgeon/toolmeet/pull/13)과 `docs/CURRENT.md`, `docs/HANDOFF.md` 경로가 겹친다. 다른 채팅의 파일/브랜치는 변경하지 않았으며 #13 문서 반영 뒤 최신 main에 #5 기록을 맞추고 overlap을 다시 확인하는 순서로 조정한다. #6 상세/프리뷰·실제 project_id 판정, backend/shared 원본, 조사 데이터 연결은 별도 범위다.


기준: 2026-10-13, Asia/Seoul.

## 공동 작업 절차 #10
- 에이전트 시작 규칙은 루트 `AGENTS.md` 첫 부분에 있고, `CLAUDE.md`와 `.github/copilot-instructions.md`가 같은 원본을 가리킨다. 작업자가 최신 기본 브랜치를 받은 뒤 확인할 수 있다. 임의의 에이전트가 자동으로 읽는다고 보장하지는 않는다.

- [#10](https://github.com/coldgeon/toolmeet/issues/10)에 이슈·PR 템플릿, 이슈별 worktree 시작 명령, PR 형식 검사와 충돌 확인 절차를 연결했다. 변경은 [PR #11](https://github.com/coldgeon/toolmeet/pull/11)에서 관리한다.
- GitHub `main`은 보호 브랜치가 아니고 활성 ruleset이 없다. CI 형식 검사를 머지 조건으로 강제하고 직접 push를 막으려면 저장소 관리자의 ruleset 설정이 필요하다. 현재 작업 계정에는 관리자 권한이 없다.

## 두 탐색 탭·집중 입력 #4 · main 반영

- 사용자 `좋아, #4는 기존 스택으로 구현 시작해.` 지시로 최신 main `5460da458d57ec816dc881b72bdebacf195e440f`에서 연결한 `feat/4-exploration-tabs` 브랜치의 별도 worktree에서 구현했다. HTML·CSS·Vanilla JavaScript와 기존 Node 개발/빌드·jsdom 테스트를 유지했다.
- `/`에서 `AI에게 질문하기`와 `모든 프로젝트 보기`를 분리했다. 초기 중앙 질문 입력 뒤로 저장된 합성 카드가 반복 상승하며 입력 클릭·키보드 포커스 뒤 흰 집중 상태로 바뀐다. 초점 이탈로 모션을 재시작하지 않으며 수동 정지·움직임 감소 설정을 지원한다.
- 탭 이동은 질문·다섯 조건·현재 추천·미리보기·확인 링크를 보존한다. 명시적 새 질문은 질문·조건·추천·확인 상태와 이전 요청을 초기화하며 수동 모션 정지 선호를 보존한다. 첫 화면의 환경 설정과 시연 질문 목록은 접어 두었다.
- `catalog.js`는 기존 공용 mock 후보를 exploration.v1 DTO로 읽는 교체 가능한 frontend 어댑터다. 목록과 배경은 같은 8개 ID를 사용하며 자체 제작 저장 SVG·권리/합성 표시를 연결했다. 누락·이미지 실패·권리 미확인은 설명으로 대체한다. 실제 조사·도구 실행·요금 검증·실제 서비스 화면 연결을 완료한 것으로 표시하지 않는다.
- 전체 테스트(DOM 44개·Python 13개·정적 mock/하위 경로·HTTP 통합 15조합)와 정적 빌드가 통과했다. 브라우저에서 1440px 및 320·360·390px, 360×560px 키보드 입력, 탭·정지·기본 결과/확인·뉴스→질문·`/toolmeet/`를 확인했다. OS 움직임 감소 설정·실제 휴대폰·스크린리더는 직접 시험하지 않았다.
- [PR #9](https://github.com/coldgeon/toolmeet/pull/9)가 `d195f0e`로 main에 병합되고 #4가 종료됐다. [#5 대화·추천](https://github.com/coldgeon/toolmeet/issues/5), [#6 프리뷰·상세](https://github.com/coldgeon/toolmeet/issues/6)는 별도 구현 범위다. backend/shared 원본과 제품 배포는 변경하지 않았다.

## 탐색·질문 UX 계약 #3 · main 반영

- [PR #7](https://github.com/coldgeon/toolmeet/pull/7)은 사용자 머지 승인 뒤 `5460da458d57ec816dc881b72bdebacf195e440f`로 Squash merge됐고 [#3](https://github.com/coldgeon/toolmeet/issues/3)이 종료됐다. 승인 head `11b669233a8099d4e6102b10dddd8904e84585e1`과 Windows·Linux CI 성공을 확인했다. 제품 배포는 실행하지 않았다.
- [탐색·질문 계약 v1](contracts/exploration-v1.md)과 [합성 JSON 예시](contracts/exploration-v1.examples.json)는 후속 frontend mock 어댑터 기준이다. 실제 HTTP API는 협의용 제안이며 backend/shared 구현·데이터 조사·실제 AI 연동은 별도다.

## 프론트엔드 이슈 #1 · main 반영

- [#1](https://github.com/coldgeon/toolmeet/issues/1)의 구현 시작 지시에 따라 최신 main `4086d3d`에서 연결한 `fix/1-stale-brief-results` 브랜치의 별도 worktree에서 수정했다. [PR #2](https://github.com/coldgeon/toolmeet/pull/2)가 cc4ccdf로 Squash merge되어 이슈 #1이 종료됐다.
- 추천 대기 중에도 환경 변경을 반영하고, 질문·환경 변경 시 이전 후보·프론트엔드 토큰·원본 링크를 즉시 무효화한다. 이전 추천 및 링크 확인 응답은 최신 화면에 반영하지 않는다. 최신 오류 후 환경 변경으로 다시 계산할 수 있으며 첫 제출 전에는 환경만 바꿔 추천을 요청하지 않는다.
- `jsdom@26.1.0`은 테스트용 개발 의존성이다. 실제 DOM 회귀 26개와 기존 전체 테스트·정적 빌드가 통과했다. 제품의 HTML·CSS·JavaScript 구조와 API·공용 데이터·mock 경계, `/news`·`/explore`·`/demo`는 유지한다. PR 및 머지 후 Windows·Linux CI가 통과했다. 제품 배포는 실행하지 않았다.

## 저장소와 실행

- 공동 저장소: `https://github.com/coldgeon/toolmeet`. 성원이 원본 `seongwwww/u-solve`의 `61831ec` 이력을 보존한 모노레포다.
- `frontend/`: 원본 화면·개발 서버·정적 빌드. `backend/`: Python API. `shared/data/`: 공용 샘플·카탈로그·업무 분류 규칙.
- 루트 `npm run dev` → `http://127.0.0.1:5173`. Python API는 `127.0.0.1:8765`; `/api/*`는 프론트엔드 개발 서버가 전달한다.
- `npm test`는 양쪽 시험과 HTTP 통합 검증, `npm run build`는 `frontend/dist/` 정적 mock 빌드를 실행한다. Windows·Linux GitHub Actions도 구성했다.

## 제품과 구현

- 서비스 이름은 **툴밋**. AI 소식부터 업무에 맞는 도구·공개 프로젝트·활용 방법을 연결한다.
- `/`는 두 탐색 탭의 질문 입력과 기본 프로젝트 목록, `/news`는 별도 뉴스 카테고리다. 업무·환경을 입력하면 기존 mock 답변에서 관련 가상 소식, 후보, 추천 이유·조건·방법 미리보기·확인 후 원본 링크를 보여준다. 조건을 하나씩 묻는 대화는 #5의 후속 작업이다.
- 소식·예시 질문·추천은 mock이다. 실제 기사 수집, AI 자유문장 이해, 회원·게시글 저장, 자동 도구 실행은 미구현이다. 입력 질문은 메모리에서 처리한다.
- 기본 예시 5개가 각각 회의·요약·양식·기획·개발로 분류되도록 수정했다. 문서·자료·PDF 같은 일반 단어보다 작업별 단어에 높은 점수를 주며 같은 규칙 파일을 양쪽에서 사용한다.
- `/explore`의 기존 5건 탐색과 `/demo`의 Markdown 문서 시연을 보존했다. `/demo` 실제 처리는 로그인된 Codex CLI에 의존하며, 일반 테스트는 호출을 대체해 입력·확인 경계만 검증한다.
- AWS 소규모 구성은 `architecture/Toolmeet_Architecture_v1.drawio`의 제안이다. AWS 리소스 배포·Bedrock 연동은 후속 작업이다.

## 다음 구현

1. 실제 출처 소식 2–3개와 검토한 후보 2개를 대표 회의록 업무에 연결한다.
2. 뉴스 수집·갱신, 출처 URL·게시일·확인일·중복 및 후보 비용·권한·설치 조건을 검증한다.
3. AI 업무 이해·추가 질문을 구현하고, 추천 조건 비교와 근거 표시를 유지한다.
4. AWS 모델·리전·예산을 확정한 뒤 배포를 진행한다. 회원·저장·알림·제작자 등록·직접 도구 실행은 후속 범위다.

기존 Sites 공개 배포와 과거 Codex 실행은 원본의 기록이다. 이번 구조 정리는 해당 배포를 갱신하지 않았다. 자세한 변경과 실제 검증 결과는 [HANDOFF.md](HANDOFF.md)를 따른다.
