# 툴밋 이슈·PR 작업 절차

이 문서는 사람과 작업 에이전트가 같은 절차를 쓰기 위한 저장소 기준이다. 이슈 작성은 [.github/ISSUE_TEMPLATE/task.md](../.github/ISSUE_TEMPLATE/task.md), PR 작성은 [.github/pull_request_template.md](../.github/pull_request_template.md)를 따른다. 기존 [#4 이슈](https://github.com/coldgeon/toolmeet/issues/4)는 작성 예시다.

저장소 규칙의 시작점은 루트 [AGENTS.md](../AGENTS.md)의 "작업 시작 전 필수 확인"이다. Claude Code용 `CLAUDE.md`와 GitHub Copilot용 `.github/copilot-instructions.md`는 같은 규칙을 가리킨다. 각 도구가 이 파일을 읽는 방식은 해당 도구의 동작에 달려 있으므로, 임의의 에이전트에게 자동 적용된다고 가정하지 않는다. 새 규칙은 PR이 기본 브랜치에 반영되고 작업자가 최신 코드를 받은 뒤부터 확인할 수 있다.

## 한 작업의 순서

1. `docs/CURRENT.md`와 `docs/HANDOFF.md`를 먼저 읽고, 기획·인터뷰라면 `docs/PLAN.md`와 `docs/ACCEPTANCE.md`도 읽는다. 기존 이슈와 열린 PR을 찾아 중복 작업을 확인한다.
2. 이슈에 문제·목표, 작업 범위와 범위 밖, 검증 가능한 완료 기준, 검증 계획, 의존성, 변경 예정 경로와 충돌 조정 방법을 기록한다. 사용자 지시가 이미 단계 전체를 승인했다면 그 범위를 적고 같은 승인을 반복 요청하지 않는다.
3. 이슈 번호를 받은 뒤 최신 원격 `main`에서 **이슈별 브랜치와 별도 worktree**를 만든다. 예: `npm run task:start -- 12 chore agent-workflow`. 이 명령은 기존 작업 폴더의 미커밋 파일을 옮기거나 수정하지 않는다. 이미 브랜치 또는 대상 폴더가 있으면 중단한다.
   기존 이슈에 새 템플릿의 항목이 빠져 있으면 이슈 본문을 보완한 뒤 명령을 실행한다.
4. 시작 전과 PR 직전에 `gh pr list --state open`과 `gh pr view <번호> --json files`로 같은 경로를 수정하는 열린 PR을 확인한다. 겹치면 담당자와 변경 순서·파일 경계를 정하거나 선행 PR 병합 후 최신 `main`에 맞춘다. 다른 작업자의 미커밋 변경을 가져오거나 덮어쓰지 않는다.
5. 이슈 범위에서 구현하고 관련 테스트, `npm test`, `npm run build`를 실행한다. 일반 테스트에서 실제 Codex·유료 API를 호출하지 않는다. 실행한 검증과 미검증을 구분한다.
6. `docs/HANDOFF.md`에 변경·검증·남은 문제·다음 작업을 기록한다. 기능·도구·공급자·일정이 바뀌면 `docs/CURRENT.md`도 갱신한다. 오래된 인계 항목의 당시 승인 상태를 현재 상태로 해석하지 않는다.
7. 변경을 커밋한 뒤 `npm run task:overlap`으로 최신 `origin/main` 포함 여부와 열린 PR의 경로 중복을 확인한다. 겹치면 작업 순서를 조정하거나 선행 PR을 반영한다. 그 뒤 **이슈 하나당 PR 하나**를 연다. PR 본문에는 `Closes #번호` 한 개와 템플릿의 각 항목을 채운다. 브랜치 이름의 이슈 번호와 본문 번호가 일치해야 한다. 기본 브랜치에 적용된 `workflow-policy` CI가 형식을 확인한다.
8. PR 검토와 Windows·Linux CI 결과를 확인한 다음 머지한다. 제품 배포와 태그는 별도 작업이다. 사용자가 이슈 작성부터 PR까지 한 번에 맡기면 그 범위를 진행하고, 머지·배포가 지시에 포함되지 않았다면 실행하지 않는다.

## 충돌을 줄이는 기준

- 같은 이슈의 브랜치를 여러 에이전트가 동시에 수정하지 않는다. 공동 파일(`AGENTS.md`, `README.md`, `docs/CURRENT.md`, `docs/HANDOFF.md`, `shared/data/`, API 계약)을 바꾸기 전에는 열린 PR과 담당 영역을 확인한다.
- 분리 가능한 작업은 이슈와 worktree를 나눈다. 선행 계약·공용 데이터가 필요한 작업은 의존성을 적고 해당 변경이 확정된 뒤 후속 작업에 반영한다.
- PR 직전에 `git fetch origin main`으로 기준을 갱신한다. 원격 `main`이 앞서 있거나 같은 파일 변경이 겹치면 PR에서 충돌 여부를 확인하고 해당 worktree에서 해결한다. 공유 작업 폴더의 변경을 지우거나 강제로 덮어쓰지 않는다.
- 브랜치·worktree 격리는 **로컬 파일 충돌을 줄이는 장치**다. 열린 PR의 논리적 충돌까지 자동으로 막지는 못하므로 이슈의 경로 확인과 PR 검토가 필요하다.

## GitHub 설정의 한계

템플릿은 입력을 돕고 `workflow-policy` CI는 PR 형식을 검사한다. 이 검사는 `pull_request_target`에서 **기본 브랜치의 검사 코드만** 실행하고 PR 코드는 실행하지 않는다. 새 workflow가 기본 브랜치에 반영된 뒤부터 작동한다. 이를 머지 조건으로 강제하려면 저장소 관리자가 `main` ruleset에서 **PR 경유**, **필수 상태 검사**(`workflow-policy`, Windows·Linux `test`), **최신 기준 브랜치 반영**, **강제 push 차단**을 설정해야 한다. 현재 작업 계정에는 관리자 권한이 없어 이 서버 설정을 적용할 수 없다. ruleset 적용 전에는 CI 실패가 직접 push나 머지를 기술적으로 차단하지 못한다.
