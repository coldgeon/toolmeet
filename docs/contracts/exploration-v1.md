# 탐색·질문 UX 연동 계약 v1

기준: 2026-10-13. 해결 이슈: [#3](https://github.com/coldgeon/toolmeet/issues/3).
소비 이슈: [#4 두 탭·집중 입력](https://github.com/coldgeon/toolmeet/issues/4),
[#5 대화·추천](https://github.com/coldgeon/toolmeet/issues/5),
[#6 프리뷰·상세](https://github.com/coldgeon/toolmeet/issues/6).

이 문서는 **후속 프론트 mock 어댑터의 구현 기준안**이다. PR 검토·머지로 저장소 기준을 확정한다.
아래 HTTP 경로·새 필드는 **백엔드 협의용 제안**이며 현재 구현되었거나 백엔드 담당자가 합의했다고 뜻하지 않는다.
실제 AI 공급자·질문 생성·추천 판단·데이터 조사·미디어 사용 승인은 별도 작업이다.
현재 화면, backend, shared/data, 프레임워크와 배포 설정을 이 이슈에서 바꾸지 않는다.

## 1. 현재 구현과 새 계약의 경계

대조 기준은 main `cc4ccdfe54ce41ab75e5780da379eaaa5e81c647`이다.

| 현재 인터페이스 | 확인한 동작 | 이번 계약과의 차이 |
|---|---|---|
| POST /api/brief | work + policy/installation/ecosystem/data_kind/hosting, 단어 규칙으로 최대 5개 후보 | 대화·가변 종료·비용·project_id·revision 없음 |
| POST /api/brief/confirm | brief_token + candidate_id + confirmed:true, possible/adapt 중 URL 있는 후보에만 원본 안내 | 별도 확인 token 없음 |
| GET /api/catalog | count, scope, last_checked | 프로젝트 목록/상세 API 아님 |
| GET /api/board | data_mode, note, posts | 실제 사용자 글·후보 카탈로그 아님 |
| GET /api/news | data_mode, note, news | mock 소식이며 기사 원본 URL·게시일·미디어 없음 |
| POST /api/discover | 구형 5건 키워드 탐색, 불일치 때 고정 next_question 한 문장 | 가변 대화 엔진 아님 |

기존 brief 후보는 id/name/kind/summary/method/source_status/status/fit_reason/reasons/first_gate/first_check이다.
상태는 `possible | adapt | hold | excluded`다. 초기 HTTP/정적 mock 응답에서 source_url은 제거한다.
확인 성공은 `{source_url, stage}`이며 실제 실행·회사 승인 상태가 아니다.

현재 brief_token은 900초 동안 서버 메모리에 보관하며 확인 성공 뒤에도 소비하지 않는다.
프론트 편집은 이전 DOM·token 참조를 무효화하지만 서버 token을 폐기하지 않는다.
정적판은 브라우저 메모리 token과 전체 mock JSON을 사용하므로 확인 관문은 화면 흐름이며 비밀정보 접근 통제가 아니다.
구형 /explore의 discovery_token/simulation_token 및 /demo의 preview_token은 다른 계약이고 재사용하지 않는다.

기존 work는 trim 후 8~1000자다. 환경 enum은 아래와 같으며 필드 생략은 unknown이다.
Python은 명시적 null을 거부하지만 정적 mock은 null도 unknown으로 처리하는 차이가 있다.
후속 호환 어댑터는 null을 보내지 않고 명시적 문자열 unknown으로 정규화한다.
현재 오류는 주로 HTTP 400의 `{error:문자열}`이며 공통 code/revision/field_errors는 없다.
구형 /api/confirm의 정책 모름/불가 HTTP 200 보류와 새 대화 상태를 혼동하지 않는다.

근거: [brief 엔진](../../backend/brief_engine.py), [HTTP API](../../backend/app.py),
[정적 mock](../../frontend/src/mock_api.js), [화면 경합 처리](../../frontend/src/brief.js),
[정적 빌드](../../frontend/build.mjs).

## 2. 책임·교체 지점과 승인 범위

| 담당 영역 | 이 계약 이후의 책임 | 별도 승인/미완료 |
|---|---|---|
| frontend #4 | 탭·포커스·모션·새 질문, 공통 카탈로그 어댑터·기본 목록, 개발/정적 자산 경로 | 화면 구현·실제 저장 이미지 연결 |
| frontend #5 | 아래 DTO의 대화/추천 표시, 답변 수정, 요청 경합, 기존 brief/confirm 호환 어댑터 | 실제 AI 분석으로 표현하지 않음 |
| frontend #6 | 같은 ID의 프리뷰·상세·project_id 질문 연결 | project_id를 적용한 실제 추천 판정 |
| backend 후속 이슈 | 자유 업무 해석·질문 필요성/종료·실제 조건 판정, HTTP DTO 검증·token 수명/바인딩 | 경로/인증/보관/오류 정책과 구현 협의 |
| 리서치·데이터 후속 이슈 | 실제 후보·근거·확인일·미확인 조건·미디어 출처/사용 근거 | 실제 자료 조사와 shared/data 반영 |
| 사람 사용자 | 단계별 이슈·구현·PR·머지 승인 | 에이전트 검토는 승인 대체 아님 |

프론트가 소비하는 함수 형태는 `catalog.list()`, `catalog.get(id)`,
`conversation.evaluate(snapshot, {signal})`, `recommendations.confirm(selection, {signal})`다.
성공/업무 보류/오류를 구분하는 동일 DTO를 반환하도록 후속 mock/HTTP 어댑터를 교체한다.
함수·파일은 이 문서에서 실제 추가하지 않는다. AbortSignal은 최적화이고 응답 적용 검사도 반드시 유지한다.

HTTP 제안은 GET /api/projects, GET /api/projects/:id, POST /api/exploration/turn이다.
현재 /api/catalog의 의미를 바꾸거나 기존 /api/brief와 /api/brief/confirm을 제거하지 않는다.
새 confirmation 전송은 기존 brief/confirm 호환 또는 별도 endpoint 중 백엔드 후속 이슈에서 확정한다.
실제 API 연결 전 payload·경로·오류·자료 보관·token 검증과 정적판의 차이를 별도 검토한다.

## 3. 공통 값·사실·답변

버전은 `contract_version:"exploration.v1"`이다. 현재 시연의 `data_mode:"mock"`와
`data_note`를 필수로 보존하며 공급원 변경 전 실제 데이터/AI로 승격하지 않는다.
알 수 없는 버전·필수 필드 누락·잘못된 enum은 어댑터 오류로 처리하고 이전 입력은 보존한다.

| field | known의 value | 질문 유형 |
|---|---|---|
| outcome | 원하는 결과를 쓴 비어 있지 않은 문자열 | text 또는 choice_with_text |
| policy / installation | allowed, denied | choice |
| ecosystem | google, microsoft, other | choice_with_text |
| data_kind | public, internal | choice |
| hosting | self_hosted, cloud | choice |
| cost | 사용자 예산 조건 문자열 | text 또는 choice_with_text |

자료 전송 허용, 계정 권한, 가격 확인은 서로 다른 조건이다.
public은 자료 성격을 나타내며 실제 문서의 외부 전송 승인을 대신하지 않는다.

- 미답변: 해당 field가 answers/facts에 없다. 질문을 고려할 수 있다.
- 명시적 모름: `state:"unknown", value:null`. 답변은 완료했지만 조건은 미확인이다.
  허용/무료/설치 가능으로 추정하거나 같은 조건을 자동 재질문하지 않는다.
- 알려진 답변: `state:"known"`과 위 value가 있다. enum이 없는 값은 오류이며 unknown으로 자동 허용하지 않는다.
- other 환경의 설명은 answer의 선택적 `detail`에 기록한다. 자유 입력을 지원한다고 임의의 환경 호환성을 판정하지 않는다.
- facts는 어댑터가 매 요청의 현재 work와 answers에서 다시 산출한다.
  `origin:"work"`일 때 `reference`는 실제 입력의 근거 구절,
  `origin:"answer"`일 때 reference는 해당 answer.id다.
  known은 현재 진술을 알고 있다는 뜻이며 회사 정책·기능 검증 완료를 뜻하지 않는다.
- 명시적인 사용자 답변이 업무 문장 추정과 충돌하면 명시 답변을 우선하며 필요한 확인 이유를 표시한다.
  이전 work에서 얻은 추정 facts를 새 work에 그대로 복사하지 않는다.
- 사용자 답변·선택 조건은 편집 후에도 유지한다. 어댑터는 현재 맥락에서 관련 없는 조건을 질문/판정에 사용하지 않는다.
  새 질문 시작만 work/answers/project_id/results/token을 초기화한다.

## 4. 대화 snapshot과 응답

JSON 예시는 [exploration-v1.examples.json](exploration-v1.examples.json)에 있다.
문서 예시는 내부 합성 업무·mock 판정이며 실제 추천 기록이 아니다.

요청은 변경된 값만 보내는 대신 **현재 전체 snapshot**을 보낸다.

| 요청 필드 | 형식·의미 |
|---|---|
| contract_version | exploration.v1 |
| request_id | 요청마다 새 비어 있지 않은 문자열. 재시도도 새 ID |
| revision | 0 이상의 정수. 사용자 의미가 바뀌면 증가 |
| work | 8~1000자 업무 문자열. 초안 편집 중 유효하지 않으면 요청하지 않음 |
| project_id | 동일 카탈로그의 ID 또는 null. 선택 맥락이지 무조건 추천하라는 지시 아님 |
| answers | 현재 활성 답변 배열. id는 고유, field당 한 답변 |
| answer | id, question_id(조건 설정 출처면 null), field, state, value, 선택적 detail |

질문에 답할 때 화면에 적용된 question.id/field와 revision을 캡처한다.
이전 revision에서 남은 버튼은 새 snapshot에 답을 추가하지 못한다.
편집은 해당 답변 값을 교체하거나 제거하고 revision을 증가시킨다.
답변의 현재 기록은 유지하며 별도 UI 이력은 수정 표시를 제공할 수 있지만 오래된 값을 중복 전송하지 않는다.

| 응답 필드 | 형식·의미 |
|---|---|
| contract_version, request_id, revision | 요청과 일치해야 함 |
| data_mode, data_note | mock/실연동 경계 |
| phase | work, environment, recommendation |
| status | question, ready, needs_confirmation, empty, error |
| facts | field별 state/value/origin/reference |
| question | 질문 1개 또는 null |
| recommendations | 추천 bundle 또는 null |
| notice | 상황 이유·다음 확인 행동의 문자열 |
| error | 오류 객체 또는 null |

모든 필드를 반환한다. question 상태만 question 객체가 있고 error 상태만 error 객체가 있다.
ready/needs_confirmation/empty에서만 recommendations 객체가 있다.
empty는 candidates:[]·token:null이고 질문 없음이다. ready에는 서비스/공개 프로젝트 중 possible/adapt 후보가 최소 하나 있다.
needs_confirmation은 검토 후보의 필수 조건 판단이 보류된 상태이며 화면에서 **조건 확인 필요**로 표시한다.
사용자의 **방향 확인** 버튼으로 모름/보류를 해제하지 않는다.
hold/excluded/internal_method만 있는 결과를 ready로 표시하지 않는다.

question은 id/field/prompt/type/options/allow_unknown/allow_text를 가진다.
type은 choice, text, choice_with_text이고 options는 `{value,label}` 배열이다.
choice는 allow_text:false, text는 options:[]·allow_text:true,
choice_with_text는 allow_text:true다. allow_unknown:true를 지원한다.
모름 버튼은 option의 임의 enum이 아니라 state:unknown/value:null을 제출한다.
질문은 업무 결과(work 단계) 또는 후보 판정을 바꾸는 환경(environment 단계) 중 필요한 한 개만 제공한다.

이미 known인 field 또는 explicit unknown인 field를 같은 snapshot에서 다시 묻지 않는다.
알려진 정보가 충분하면 처음부터 recommendation으로 갈 수 있다.
보통 추가 질문 2~4개를 목표로 하지만 정해진 개수·순서·진행 퍼센트는 계약하지 않는다.
정책 모름 등 필요한 정보가 끝내 없으면 반복 질문 대신 needs_confirmation과 확인할 조건/행동을 제공한다.
사용자가 해당 답변을 수정하거나 제거한 경우에만 다시 평가한다.

## 5. 단계·대기·추천·확인

대기 상태는 프론트 요청 수명 `idle | waiting | settled | error`이고 위 status와 분리한다.
응답 전에는 마지막 적용 phase를 유지하며 최초 제출은 work다.
응답의 phase가 실제 단계의 기준이며 기다리는 시간·질문 개수로 진척률을 계산하지 않는다.
현재 HTTP brief의 stage 문자열은 이 새 phase를 제공하는 대화 엔진으로 간주하지 않는다.

recommendations는 `{candidates, supporting_methods, token}`이다.
supporting_methods는 카탈로그의 internal_method ID 배열이며 공개 후보 수·ready 판정에 포함하지 않는다.
기존 brief 호환 어댑터는 local-review 등 내부 방법을 candidates에서 이 배열로 옮겨 설명을 보존한다.
서비스/공개 프로젝트 중 possible/adapt가 있으면 ready, 그렇지 않고 hold가 있으면 needs_confirmation,
모두 제외되거나 내부 방법만 남으면 empty로 정규화한다. empty의 token은 null이다.
내부 방법은 별도 업무 준비 설명으로 표시하며 추천 성공·외부 도구 연결로 표현하지 않는다.
후보는 같은 catalog ID, status, reasons(문자열 배열), fit_reason, first_gate, first_check를 가진다.
name/summary/kind/method/media는 catalog에서 찾아 연결한다.
매칭 catalog ID가 없으면 허구의 카드를 만들지 않고 자료 오류와 재시도를 표시한다.
source_url은 추천/card/detail DTO의 사용 링크로 노출하지 않는다.
유효한 출력인지 확인하기 전에 URL·추천·확인 버튼을 표시하지 않는다.

token은 `{value, binding:"brief"|"exploration", revision, expires_at}` 또는 null이다.
expires_at은 ISO 시각 또는 null(현 brief는 만료 시각을 응답하지 않음)이다.
binding:brief는 실제 기존 brief_token을 보관한 호환 객체이며 새로운 서버 기능이 아니다.
별도 confirmation_token은 v1에 만들지 않는다.
미래 exploration token의 서버 revision 바인딩/만료/폐기는 백엔드 후속 구현 사항이다.
클라이언트 revision을 감싼 것만으로 서버의 이전 token이 폐기됐다고 표현하지 않는다.

confirm 요청은 `{request_id, revision, recommendation_request_id, candidate_id, token, confirmed:true}`다.
recommendation_request_id는 현재 적용된 turn 응답의 request_id이며 같은 revision의 재평가도 구분한다.
기존 HTTP 호환은 `{brief_token:token.value, candidate_id, confirmed:true}`만 전송한다.
확인 어댑터 응답은 같은 request_id/revision/recommendation_request_id와 `status:"linked"|"needs_confirmation"|"error"`,
source_url(성공 때만 비어 있지 않은 문자열), notice, error를 반환한다.
성공도 방향 확인 후 원본 안내일 뿐 설치·자동 실행·문서 전송·회사 승인을 뜻하지 않는다.

- possible/adapt + 원본 있음 + 유효한 최신 token + 사용자 방향 확인인 후보만 링크를 요청한다.
- hold/excluded, 내부 툴밋 방법, 만료/미확인 token에는 원본 사용 안내를 제공하지 않는다.
- 추천 뒤 방향 확인은 해당 후보·revision에만 유효하다. 모든 조건·업무·프로젝트 맥락 변경은 확인과 링크를 즉시 무효화한다.
- 현 brief 확인의 HTTP 400은 오류 문자열을 보존하며 조건/만료 관련이면 재평가 행동을 안내한다.
  현재 응답에 없는 세부 오류 code를 문자열 추정으로 사실처럼 만들지 않는다.

## 6. 편집·재시도·역순 응답 규칙

[#1](https://github.com/coldgeon/toolmeet/issues/1)과
[PR #2](https://github.com/coldgeon/toolmeet/pull/2)의 프론트 무효화 규칙을 확장한다.

1. work/답변/조건/project_id 변경 또는 새 질문은 revision을 먼저 증가시킨다.
   이전 후보·관련 소식·token·방향 확인·원본 링크를 즉시 지우고 진행 중 요청을 취소할 수 있다.
2. 질문·답변 입력·대화 이력은 오류나 취소 때문에 지우지 않는다.
   tab 변경은 revision을 증가시키지 않으며 제출 전 자유 답변 초안·현재 질문·대화·조건·결과를 모두 보존한다.
3. turn 재평가/재시도 시작은 같은 revision이어도 이전 후보·token·방향 확인·링크를 지우고
   진행 중 confirm의 최신 request_id를 무효화한다. 새 turn의 request_id로 추천 수명을 구분한다.
   turn은 현재 revision과 최신 turn request_id가 모두 일치하고 payload 검증까지 성공한 응답만 적용한다.
   confirm은 현재 revision·최신 confirm request_id·현재 적용된 recommendation_request_id·캡처 token이
   모두 일치하는 응답만 적용한다. 현재 brief 서버에는 이 바인딩이 없으므로 호환 계층이 캡처 값을 붙여 검증한다.
4. 오래된 성공·오류·finally는 화면·버튼·phase·대기 상태를 바꾸지 않는다.
   Abort 실패나 늦게 도착한 응답에도 위 비교를 적용한다.
5. 재시도는 같은 snapshot/revision과 새 request_id를 사용한다.
   사용자가 편집한 뒤에는 오류 당시 snapshot 대신 현재 snapshot을 전송한다.
6. confirm은 카드 생성 시점의 candidate_id/token/revision/recommendation_request_id를 캡처한다.
   오래된 카드가 최신 token으로 확인되거나 이전 확인 결과가 새 추천에 붙지 않도록 한다.
7. 새 질문은 위 데이터와 진행 상태를 초기화하되 모션 정지·움직임 감소 선호는 유지한다.
   페이지 새로고침·로그인 후 복원은 이 v1 기본 범위에 없다.

오류 객체는 `{code,message,retryable,field_errors}`다.
mock 어댑터 code는 invalid_input, invalid_payload, unavailable, expired_token, not_found를 사용한다.
field_errors는 `{field,message}` 배열이며 기존 오류에서 상세가 없으면 []다.
통신/파싱 실패는 어댑터가 캡처한 request_id/revision을 붙여 error DTO로 정규화한다.
후보 없음(empty)·조건 미확인(needs_confirmation)은 통신 오류가 아니다.
제안 HTTP 상태는 업무 상태 200, 잘못된 입력 400, 전송 실패 5xx와 어댑터 오류다.
추가 409/410/422나 인증 규칙을 현재 API의 동작으로 선언하지 않는다.

## 7. 공통 카탈로그·ID와 근거

v1 mock 원천은 기존 `shared/data/brief_mock.json.candidates`를 프론트 어댑터에서 변환한다.
원본 파일/ID/판정 규칙을 바꾸지 않고 배경·목록·상세·질문 맥락이 변환된 동일 객체를 사용한다.
이 선택은 새 카탈로그 소비 범위이며 구형 `solutions.json` 전체를 대체하는 작업이 아니다.

list는 `{contract_version,data_mode,data_note,projects}`,
get은 `{contract_version,data_mode,data_note,project}`를 반환한다.
원천 로딩 실패는 오류로 표시하며 등록 후보 0개는 빈 카탈로그 상태다.
없는 id의 get은 not_found 오류로 표시하고 임의 후보를 만들지 않는다.

| 프로젝트 필드 | 형식·미확인 처리 |
|---|---|
| id | 기존 brief 후보 ID. 새 연구 자료 추가는 별도 shared 승인 |
| name, summary | 기존 자료/공식 근거의 문자열. 과장·후기·수치 생성 금지 |
| kind | service, public_project, internal_method |
| tasks | 기존 topics와 해결 업무 설명. 새 분류 추정 금지 |
| method | `{text,origin:"source"|"proposed"|"mock",evidence_ids}` 배열 |
| requirements | external_ai/installation/ecosystems/hosting의 state/value/evidence_ids |
| cost | state, amount, currency, period, evidence_ids. 미확인은 값 모두 null |
| evidence | id, level, claim, reference, checked_at |
| media, fallback | 다음 절의 저장 자산/대체 설명 |

현재 kind의 AI 서비스→service, 공개 프로젝트→public_project, 툴밋 방법→internal_method로 매핑한다.
자료에 다른 kind가 있으면 분류를 임의로 맞추지 않고 자료 오류로 표시한다.
internal_method를 공개 프로젝트로 표시하지 않는다.
현재 method/summary/requirements는 mock 자료이므로 실제 지원·실행 완료로 해석하지 않는다.
증거 없이 method origin:source, 가격 known, 최신 확인일을 추가하지 않는다.

evidence.level은 mock, reference_read, code_reviewed, executed, unknown이다.
claim과 reference는 확인한 주장/로컬 자료·출처 참조이고 checked_at은 실제 확인일 또는 null이다.
source_status의 자유 문구나 data_updated_at을 실행 증거·공급자 확인일로 자동 변환하지 않는다.
실제 연구 원자료에는 공식 source_url·확인일·지원 범위·미확인 값·미디어 사용 근거를 별도로 기록한다.
소비 DTO에는 근거 reference/표시만 전달할 수 있으며 카드·상세가 원본 사용 링크 관문을 우회하지 않는다.
정적 원자료에 URL이 존재하더라도 비밀 유지/접근 통제를 주장하지 않는다.

구형 solutions 5건과 brief 8개는 ID 교집합이 0이다.
같은 URL을 가진 아래 관계는 후속 조사에서 검토할 연결 후보일 뿐 동등성 승인/자동 병합 규칙이 아니다.

| brief ID | 구형 solution ID |
|---|---|
| n8n-meeting | n8n-meeting-workspace |
| n8n-summary | n8n-content-summary |
| n8n-template | n8n-template-pdf |
| github-meeting | github-meeting-sheets |

제목·URL 유사성만으로 기능·조건·미디어를 다른 ID로 옮기지 않는다.
실제 통합/추가 ID는 연구 근거와 backend/shared 변경 영향에 대한 별도 승인 후 진행한다.

## 8. 미디어·예시·경로

현재 자료에는 저장 카드 이미지·영상이 없다. 이 문서는 자산 확보/사용 허가/실제 시연을 완료했다고 뜻하지 않는다.

media 항목은 id/project_id/kind(image 또는 video)/src/alt/content_kind(actual 또는 synthetic)/provenance를 가진다.
provenance는 `{source_url,rights_status:"owned"|"licensed"|"unknown",rights_note,checked_at}`다.
actual은 실제 도구 화면·실행 자료에 근거가 있는 경우만 사용하며 공식 이미지도 실행 성공 증거는 아니다.
synthetic은 합성/과정 예시임을 표시한다. 코드 라이선스만으로 미디어 사용 권리를 추정하지 않는다.
rights_status:unknown 또는 사용 근거/필수 필드 누락인 자산은 로딩·재생 대상으로 채택하지 않고 fallback으로 표시한다.
동작 예시의 자산 경로는 형식 예시이며 파일 확보를 의미하지 않는다.

- src는 저장 자산의 배포 기준 상대 경로(`media/catalog/...`)다.
  루트 / 경로, ../ 상위 이동, 외부 사이트 iframe/직접 스트림을 카드 배경에 사용하지 않는다.
- 앱 기준 URL을 홈은 현재 문서, 뉴스는 부모 경로에서 산출한다.
  `new URL(src, appBaseUrl)` 등으로 `/toolmeet/media/...`가 유지되도록 개발/빌드 어댑터가 제공한다.
- 배경·카드·상세는 같은 media/project ID를 사용한다. 배경은 추천 결과가 아닌 등록 자료 예시다.
  실제 개인화 추천처럼 표시하거나 여러 영상/외부 사이트를 동시에 실행하지 않는다.
- 배경은 저장 이미지 위주다. 프리뷰 영상은 명시적 선택·현재 열린 프리뷰 등으로 실행을 제한하고
  실패 시 설명 대체를 제공한다. 모션 정지·prefers-reduced-motion에서는 배경 움직임을 멈춘다.
- fallback은 `{kind:"text"|"process",label,text,steps}`이고 process의 steps는 입력→처리→결과 설명이다.
  현재 mock의 활용 방법을 대체로 사용할 때 label은 합성 예시/실행 미검증을 밝힌다.
- 파일 누락·잘못된 형식·재생 실패·자료 0개에서도 질문/상세는 작동한다.
  설명 대체 동작과 실제 저장 이미지의 로딩·사용 근거 검증은 완료 보고에서 별도로 기록한다.

## 9. 예시·검증·후속 관문

동반 JSON은 정상 질문, 충분한 정보로 조기 추천, 모름 후 조건 확인 필요, 답변 편집,
빈 후보/내부 방법 분리, 재시도 가능한 오류와 재시도, 확인 성공,
편집 후 역순 응답 및 같은 revision 재평가 후 이전 확인 응답 무시를 포함한다.
catalog 예시는 기존 ChatGPT·로컬 검토 체크리스트 mock을 형식 확인용으로 변환하며 가격/미디어를 만들지 않는다.
새 endpoint/DTO는 실제 HTTP 서버에 요청하여 통과했다고 보고하지 않는다.

| 검증 항목 | 문서/예시에서 확인 | 실제 구현 시 검증 |
|---|---|---|
| 필요한 한 질문·알려진/모름 생략 | facts/answers/field 정합성, 정상/조기/모름 예시 | #5 DOM과 실제 어댑터 |
| 편집·재시도·역순 | revision/request_id/token 연결, 오래된 turn/confirm 적용 금지 | #1 회귀 유지 + #5/#6 경합 시험 |
| 후보·원본 안내 | 동일 catalog ID, ready/hold/empty 구분, 최신 확인 관문 | #5/#6 DOM/HTTP |
| 근거·미디어 | 미확인 비용/확인일·권리 누락 대체, kind 구분 | 리서치 산출물 + #4/#6 자산 시험 |
| 경로·화면 | /toolmeet/ 상대 경로 원칙, 기존 뉴스/로컬 시연 보존 | 데스크톱·320/360/390px·키보드·정지/감소 |

프론트 mock DTO는 이 PR 검토 후 #4~#6의 기준으로 사용한다.
실제 HTTP 도입은 backend 담당의 계약 검토와 별도 이슈/구현 승인 후 진행한다.
자료·미디어 공급은 리서치 검증 후 별도 shared 변경 승인으로 진행한다.
이 문서의 합성 검토와 예시 검사만으로 실제 고객 인터뷰·회사 정책 검증·실제 AI/배포 완료를 선언하지 않는다.
