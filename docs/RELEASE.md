# 버전 태그와 GitHub Pages 배포

## 현재 범위와 상태

- 공개 대상은 `frontend/src/`에서 빌드한 질문·프로젝트·뉴스 **정적 mock 시연**이다. `/explore`·`/demo`와 Python API는 로컬에 보존하며 이 배포에 포함하지 않는다. 실제 AI·자동 수집·외부 도구 실행·#8 조사 자료 연결은 별도 범위다.
- 2026-10-23 #18의 승인된 구현 단계에서 Pages를 GitHub Actions 방식으로 설정했다. `github-pages` 환경은 `v*` **태그 한 규칙만** 허용하며 HTTPS가 적용된다. Pages 생성 시 자동 추가된 `main` 브랜치 허용 규칙은 제거했다.
- 이 문서 작성 시점에는 배포 구성이 작업 브랜치에 있고 PR 생성 승인 대기다. 실제 태그·배포·GitHub Release는 없으며 예정 주소는 HTTP 404다. 설정 완료를 공개 배포 완료로 해석하지 않는다.
- 예정 주소는 `https://coldgeon.github.io/toolmeet/`다. 성공 주소는 배포 action의 `page_url` 출력과 공개 검증 결과로 확정한다.

## 승인과 버전

이슈 초안 승인 → 이슈 등록 → 별도 구현 시작 → 완료 보고·전체 PR 초안 → PR 생성 승인 → PR 등록 → 해당 PR의 별도 머지 승인·CI 성공 → 승인 head를 지정한 Squash merge 순서를 따른다. `main` 직접 push·강제 push·관리자 우회·자동 머지를 사용하지 않는다.

첫 버전 제안은 현재 루트 `package.json`·lockfile의 버전과 같은 `v0.1.0`이다. 구성 머지를 태그 생성 승인으로 해석하지 않는다. 사용자가 배포할 **버전과 정확한 main 커밋**을 확정하면 그 커밋의 main 포함 여부·CI 성공과 미사용 태그를 확인해 주석 태그 하나를 push한다. 버전 변경은 별도 이슈/PR에서 `npm version <버전> --no-git-tag-version`으로 package와 lockfile을 함께 갱신한다.

- 운영 태그는 `v0.1.0` 같은 안정 버전이어야 한다. prerelease·build suffix·선행 0·가벼운 태그는 거부한다.
- 태그 버전은 루트 package 버전과 같아야 하며 태그 커밋은 checkout·이벤트 SHA와 일치하고 `origin/main`에 포함돼야 한다.
- 한 번 만든 태그는 이동·덮어쓰기·재사용하지 않는다. `v*` 형태만으로 실행 승인이 되는 것은 아니다.

## 실행 예시

다음은 **후속 버전 배포 지시를 받은 뒤** 사용하는 예시다. `APPROVED_MAIN_SHA`를 실제 승인된 SHA로 바꾸고, 깨끗한 별도 worktree에서 실행한다. 다른 미커밋 작업이 있는 공유 폴더는 전환하거나 pull하지 않는다.

```powershell
git fetch origin main --tags
git switch --detach APPROVED_MAIN_SHA
# 원격 main 포함·해당 SHA의 CI 성공·package 0.1.0·동명 태그 없음 확인
git tag -a v0.1.0 APPROVED_MAIN_SHA -m "Toolmeet v0.1.0"
node scripts/validate_release.mjs v0.1.0
git push origin refs/tags/v0.1.0
```

구성 PR 승인 전에 실행하지 않는다. 태그 생성/검증이 실패하면 push하지 않고 원인과 현재 ref 상태를 보고한다. 이미 원격에 존재하는 태그는 수정하지 않는다.

## workflow와 권한

`release.yml`은 `v*` 태그 push에서만 실행한다. PR·브랜치 push·수동 dispatch는 배포를 시작하지 않는다. `toolmeet-production` 동시 실행 그룹과 `cancel-in-progress: false`로 배포 중인 실행을 취소하지 않는다.

| job | 동작 | 권한 |
|---|---|---|
| build | 고정 이벤트 SHA checkout, 태그 검증, 전체 시험·빌드, release.json, 버전 묶음과 Pages artifact 업로드 | contents: read |
| deploy | 같은 커밋 checkout, 빌드 묶음 복원, 기존 Pages 설정 조회, 배포 후 공개 파일 검증 | contents: read, pages: write, id-token: write |
| release | build·deploy 성공 후에만 버전 묶음을 첨부한 GitHub Release 등록 | contents: write |

checkout은 인증 정보를 저장하지 않는다. 최초 Pages 설정은 현재 승인된 구현 단계에서 관리자 계정으로 한 번 수행했으며 workflow의 `configure-pages`는 `enablement: false`다. workflow에 관리자 PAT·AWS 키를 추가하지 않는다. 현재 사용한 공식 action은 checkout/setup-node/setup-python v7, upload-artifact v7, download-artifact v8, configure-pages v6, upload-pages-artifact/deploy-pages v5다.

## 검증과 성공 판정

- `npm test`는 릴리스 회귀와 기존 프론트·Python·정적·HTTP 통합 시험을 함께 실행한다. `npm run test:release`는 태그/이벤트/main·manifest·공개 파일 무결성·재시도와 workflow 권한/실행 조건을 fixture로 검사한다. YAML 파서는 개발 의존성이고 배포 페이지의 런타임 의존성이 아니다.
- build는 시험 후 `npm run build`를 실행하고 `release.json`에 tag·version·commit·소스 commit 시각·`static-mock` 모드를 기록한다. 산출물은 `frontend/dist/`뿐이며 저장소 루트·비밀 설정·Python 소스를 업로드하지 않는다.
- deploy는 실제 `page_url`의 HTTPS 주소를 사용한다. manifest의 tag/version/commit/name/mode와 질문·뉴스 직접 경로, 모든 빌드 파일 및 카드 미디어의 SHA256을 로컬 묶음과 대조한다. HTTP 200인 이전 페이지나 누락된 자산을 성공 처리하지 않는다. `/api/*` 실제 서버 호출 검증과 구분한다.
- CDN 전파를 고려해 전체 공개 확인을 최대 6회(간격 5초, 요청별 15초 timeout) 재시도한다. 끝까지 다르면 deploy job이 실패하고 새 Release는 등록하지 않는다.
- 자동 공개 검증 뒤 실제 브라우저에서 질문→조건→추천/보류→방향 확인→원본 안내, 두 탭·카드/상세, 뉴스 목록/검색/상세·질문 연결·새로고침과 mock 표시를 확인한다. 320/360/390px·짧은 높이·키보드도 확인하고 실제 기기/스크린리더 미검증을 별도로 남긴다.
- 배포 성공 보고에는 태그, 정확한 커밋, Actions 실행 링크, 실제 서비스 주소, 공개 manifest/자산 및 브라우저 검증 결과를 기록한다. YAML·로컬 fixture·Pages 설정만 통과한 단계에서는 배포 완료로 보고하지 않는다.

## 실패와 복구

GitHub Actions에서 실패 job·단계·로그와 `github-pages` 환경의 deployment 상태를 확인한다. Pages 배포 이후 공개 검증이 실패한 경우 사이트는 이미 새 파일을 제공할 수 있으므로 자동 롤백으로 간주하지 않는다. 실제 공개 manifest/파일 상태를 함께 보고한다.

- 일시적 실패는 원인을 확인한 뒤 같은 태그의 실패 job을 재실행하고 공개 검증을 다시 수행한다. 이미 있는 정식 Release/첨부 파일은 덮어쓰지 않는다.
- 사용자가 이전 성공 버전 복구를 지시하면 해당 태그의 성공 workflow 전체를 재실행하고 같은 방식으로 공개 상태를 검증한다. 태그 자체는 이동하지 않는다.
- 영구 수정은 별도 이슈/PR 또는 revert 후 새 버전으로 진행한다. 잘못된 태그를 강제로 고쳐 재배포하지 않는다.
- 첫 배포 전에는 복구할 성공 버전이 없다. 실패를 공개하고 수정/재실행 계획을 정리하며 성공 버전이 생긴 것처럼 보고하지 않는다.

## Pages 설정을 다시 확인할 때

`gh api repos/coldgeon/toolmeet/pages`에서 `build_type: workflow`·HTTPS, 환경의 `custom_branch_policies: true`, deployment-branch-policies 목록의 `type: tag`·`name: v*` 한 규칙을 확인한다. Pages 최초 생성이 `main` 허용을 자동 추가할 수 있으므로 생성 직후 다시 조회한다. 기존 환경이 있다면 다른 검토/보호 규칙을 임의로 지우지 않는다. 새 도메인·API/AWS 연결·보호 정책 확대는 별도 범위다.

공식 근거: [Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Pages REST](https://docs.github.com/en/rest/pages/pages), [환경 정책](https://docs.github.com/en/rest/deployments/branch-policies).
