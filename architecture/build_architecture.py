from pathlib import Path
import xml.etree.ElementTree as ET

OUT = Path(__file__).parent
FONT = 'Malgun Gothic'
C = {'ink':'#172D45','muted':'#52677D','blue':'#2779BD','green':'#27876B','purple':'#8062C2','orange':'#C88832','line':'#CBD6E2'}
mx = ET.Element('mxfile', host='app.diagrams.net', agent='Toolmeet PM', version='26.0.0', compressed='false')

class Page:
    def __init__(self, name, w, h):
        self.n=0; self.geom={}
        d=ET.SubElement(mx,'diagram',id=name.split()[0],name=name)
        m=ET.SubElement(d,'mxGraphModel',dx=str(w),dy=str(h),grid='1',gridSize='10',guides='1',tooltips='1',connect='1',arrows='1',fold='1',page='1',pageScale='1',pageWidth=str(w),pageHeight=str(h),math='0',shadow='0',background='#FFFFFF')
        self.root=ET.SubElement(m,'root'); ET.SubElement(self.root,'mxCell',id='0'); ET.SubElement(self.root,'mxCell',id='1',parent='0')
    def box(self, label, x,y,w,h, fill='#FFFFFF', stroke='#CBD6E2', size=19, style='', parent='1'):
        self.n+=1; i=str(self.n+1)
        s=f'rounded=1;arcSize=10;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};strokeWidth=1.5;fontColor={C["ink"]};fontFamily={FONT};fontSize={size};spacing=16;align=left;verticalAlign=middle;{style}'
        c=ET.SubElement(self.root,'mxCell',id=i,value=label,style=s,vertex='1',parent=parent)
        ET.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})
        self.geom[i]=(x,y,w,h);return i
    def text(self,label,x,y,w,h,size=20,color=None,bold=False,align='left'):
        return self.box(label,x,y,w,h,fill='none',stroke='none',size=size,style=f'spacing=0;fontColor={color or C["ink"]};fontStyle={1 if bold else 0};align={align};')
    def region(self,title,sub,x,y,w,h,fill,stroke):
        self.box('',x,y,w,h,fill,stroke)
        self.text(title,x+22,y+14,w-44,30,22,stroke,True)
        if sub:self.text(sub,x+22,y+46,w-44,27,16,C['muted'])
    def edge(self,a,b,label='',color=None,points=None,exit=(1,.5),entry=(0,.5),dash=False):
        self.n+=1;i=str(self.n+1)
        s=f'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;strokeWidth=2;strokeColor={color or C["blue"]};fontColor={color or C["blue"]};fontFamily={FONT};fontSize=16;labelBackgroundColor=#FFFFFF;spacing=5;exitX={exit[0]};exitY={exit[1]};entryX={entry[0]};entryY={entry[1]};'
        if dash:s+='dashed=1;dashPattern=6 4;'
        c=ET.SubElement(self.root,'mxCell',id=i,value=label,style=s,edge='1',parent='1',source=a,target=b)
        g=ET.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'})
        if points:
            arr=ET.SubElement(g,'Array',attrib={'as':'points'})
            for x,y in points:ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))
        return i
    def aws(self,name,desc,icon,x,y,w=245,h=100,color='#ED7100'):
        box=self.box('',x,y,w,h)
        self.box('',x+15,y+23,54,54,fill=color,stroke='#FFFFFF',style=f'shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{icon};outlineConnect=0;aspect=fixed;')
        self.text(name,x+83,y+17,w-94,28,19,bold=True)
        self.text(desc,x+83,y+48,w-96,h-55,15,C['muted'])
        return box

p=Page('01 서비스 전체 흐름',1800,1230)
p.text('툴밋  |  서비스 아키텍처',50,35,1280,55,36,bold=True)
p.text('AI 소식부터 내 업무에 맞는 도구까지',52,92,1000,34,22,C['muted'])
p.box('PM 제안안 · v1.0<br>2026.10.12 · 구현 예정',1460,40,290,70,'#F2F6FA','#D5DFE8',17)
p.region('사용자 경험','파란 화살표: 사용자 요청과 결과',40,160,1720,445,'#F5F9FE','#8EB6D8')
user=p.box('<b>사용자</b><br><br>어떤 일을<br>도와줬으면 하나요?',70,280,190,180,'#FFFFFF','#8EB6D8',21)
web=p.box('<b>툴밋 웹 화면</b><br><br>• 업무와 원하는 결과 입력<br>• 사용 도구·설치·권한 확인<br>• AI 소식 탐색<br><br><font color="#52677D">소식 → 내 업무에 활용하기</font>',325,255,300,245,'#FFFFFF','#8EB6D8',20)
p.region('추천 처리','검증된 후보 안에서 설명을 생성',705,230,510,315,'#F4F0FB','#A68CCE')
reco=p.box('<b>① 업무 이해·추가 질문</b><br>② 카탈로그에서 후보 조회<br>③ 환경·비용·권한 조건 비교<br><b>④ 추천 이유·사용 순서 작성</b>',740,315,440,190,'#FFFFFF','#A68CCE',22)
result=p.box('<b>추천 결과와 첫 실행 가이드</b><br><br>• 내 업무에 맞는 도구 / 프로젝트<br>• 추천 이유와 조건 충족 여부<br>• 준비물·비용·사용 방법<br>• 원문 출처와 확인 날짜<br><br><font color="#52677D">예: 회의록 → 결정 사항·할 일 표</font>',1310,255,410,290,'#FFFFFF','#8EB6D8',20)
p.edge(user,web,'업무 입력');p.edge(web,reco,'추천 요청');p.edge(reco,result,'결과 제공')
p.region('콘텐츠와 지식 축적','초록 화살표: 수집·정리  /  보라 화살표: 추천에 사용할 근거',40,655,1330,300,'#F2FAF6','#85BBAA')
src=p.box('<b>공개 원문</b><br><br>공식 AI 소식·RSS<br>GitHub 프로젝트·공개 템플릿',70,755,310,145,'#FFFFFF','#85BBAA',20)
ing=p.box('<b>수집·정리·확인</b><br><br>중복 제거 · 주제 분류 · 용어 해설<br>사실 / 의견 / 활용 제안 구분',460,755,370,145,'#FFFFFF','#85BBAA',20)
data=p.box('<b>뉴스 + 도구 카탈로그</b><br><br>작업·연동·비용·설치·권한<br>출처 URL · 검증 수준 · 확인일',930,755,400,145,'#FFFFFF','#85BBAA',20)
p.edge(src,ing,'가져오기',C['green']);p.edge(ing,data,'확인 후 저장',C['green'])
p.edge(data,reco,'후보와 근거',C['purple'],[(1130,620),(990,620)],exit=(.5,0),entry=(.57,1))
p.edge(data,web,'소식 목록·상세',C['green'],[(900,920),(900,630),(475,630)],exit=(0,.9),entry=(.5,1))
p.box('<b>결과 표시 원칙</b><br><br>조건상 검토 가능<br>조건 변경 필요 / 확인 필요<br>현재 조건에 부적합<br><br><font color="#52677D">추천 ≠ 회사 승인·실행 검증<br>모르는 조건은 “확인 필요”</font>',1410,685,350,270,'#FFFAF0','#D7B16B',19)
p.box('<b>MVP 완료 기준</b><br><br>실제 소식 2–3개 + 확인한 후보 2개<br>입력 조건이 바뀌면 추천 이유도 변경<br>회의록 샘플 → 출처가 있는 결과 표',40,1000,560,160,'#F5F9FE','#CBD6E2',19)
p.box('<b>개발 분담 제안</b><br><br>찬건: 업무 입력 · 추천 · 조건 검토 · 가이드<br>성원: 소식 수집 · 주제 분류 · 해설 · 뉴스 화면<br>공동: 데이터 규격 · 통합 · 데모 검증',630,1000,590,160,'#F5F9FE','#CBD6E2',18)
p.box('<b>후속 확장</b><br><br>회원·저장 · 새 소식 알림<br>제작자 등록 · 후기 · 도구 직접 실행<br>Threads 수집은 접근 가능성 확인 후',1250,1000,510,160,'#FAFAFB','#AAB6C4',18,style='dashed=1;')
p.text('설계 기준: 공동 기획 + 2차 피드백  |  현재 프로토타입에 추가 구현할 목표 구조  |  각 도형·문구·연결선 편집 가능',40,1180,1720,25,15,C['muted'])

p=Page('02 AWS 소규모 배포안',2200,1510)
p.text('툴밋  |  AWS 소규모 MVP 구성',40,30,1600,58,36,bold=True)
p.text('정적 웹 + 서버리스 API + 비동기 AI 처리  ·  사용량에 맞춰 시작하는 제안 구조',42,91,1750,35,22,C['muted'])
p.box('제안안 · 배포 전<br>리전·모델은 착수 시 확정',1880,35,280,75,'#F2F6FA','#D5DFE8',17)
p.region('AWS Cloud','AWS 관리형 서비스 중심 · VPC 구성 없이 시작 · 서울 리전 우선 검토',280,150,1580,1130,'#FAFCFF','#879AAE')
p.region('① 웹 화면 제공 + 요청 접수','화면은 캐시로 빠르게 제공하고, API는 조회와 작업 접수를 처리',315,235,1510,230,'#F1F7FE','#8CB6D7')
browser=p.box('<b>사용자 브라우저</b><br><br>업무 입력 · AI 소식<br>진행 상태 / 결과 조회',40,285,200,165,'#F1F7FE','#8CB6D7',20)
cf=p.aws('CloudFront','HTTPS · 정적 파일 캐시','cloudfront',360,325,265,105,'#8C4FFF')
site=p.aws('S3 · 웹 파일','비공개 버킷 · OAC 접근','s3',700,325,265,105,'#7AA116')
apig=p.aws('API Gateway','HTTP API · 요청 제한','api_gateway',1045,325,290,105,'#8C4FFF')
api=p.aws('Lambda · API','입력 검증 · 작업 ID 발급','lambda',1415,325,355,105)
p.edge(browser,cf,'HTTPS',C['blue'],exit=(1,.25))
p.edge(cf,site,'OAC',C['blue'])
p.edge(browser,apig,'POST 추천 요청 / GET 소식·결과',C['blue'],[(255,495),(1190,495)],exit=(1,.9),entry=(.5,1))
p.edge(apig,api,'요청',C['blue'])
p.region('② 추천 작업','접수 후 작업 ID 반환 → 브라우저가 완료 여부를 조회',315,545,955,260,'#F5F1FC','#AD96D0')
rq=p.aws('SQS · 추천 큐','대기 · 재시도 · 부하 조절','sqs',360,660,290,105,'#E7157B')
rw=p.aws('Lambda · 추천','후보 조회 → 조건 비교\n→ 이유·가이드 생성'.replace('\n','<br>'),'lambda',800,660,400,105)
p.edge(api,rq,'작업 등록',C['purple'],[(1593,525),(505,525)],exit=(.5,1),entry=(.5,0))
p.edge(rq,rw,'큐 처리',C['purple'])
p.region('AI + 데이터','각 Lambda가 필요한 리소스만 접근',1320,545,505,530,'#FFF9F0','#D2AD70')
bed=p.aws('Amazon Bedrock','업무 이해 · 설명 · 소식 요약','bedrock',1360,640,425,105,'#01A88D')
db=p.aws('DynamoDB','뉴스 · 후보 · 작업 상태/결과','dynamodb',1360,820,425,105,'#C925D1')
raw=p.aws('S3 · 수집 자료','허용된 원문·메타데이터 보관','s3',1360,965,425,85,'#7AA116')
p.edge(rw,bed,'AI 호출',C['purple'],exit=(1,.3),entry=(0,.5))
p.edge(rw,db,'후보 읽기 / 결과 저장',C['orange'],[(1245,735),(1245,855)],exit=(1,.72),entry=(0,.33))
p.edge(api,db,'',C['orange'],[(1805,480),(1805,792),(1600,792)],exit=(1,.5),entry=(.57,0))
p.text('작업 상태 기록·조회 / 소식 조회',1575,756,235,32,14,C['orange'],align='center')
p.region('③ 소식·프로젝트 수집','수집 주기와 데이터량은 MVP에 맞춰 제한',315,850,955,260,'#F1FAF5','#89BAA7')
sch=p.aws('EventBridge','Scheduler · 정기 실행','eventbridge',345,955,260,100,'#E7157B')
cq=p.aws('SQS · 수집 큐','소스별 작업 · 재시도','sqs',660,955,240,100,'#E7157B')
cw=p.aws('Lambda · 수집','수집 · 중복 제거<br>분류·요약 · 출처 확인','lambda',965,945,275,120)
p.edge(sch,cq,'예약 실행',C['green']);p.edge(cq,cw,'작업',C['green'])
p.edge(cw,raw,'자료 저장',C['green'],exit=(1,.7),entry=(0,.55))
p.edge(cw,db,'뉴스·후보 저장',C['green'],[(1285,969),(1285,895)],exit=(1,.2),entry=(0,.7))
p.edge(cw,bed,'요약 요청',C['purple'],[(1303,935),(1303,773),(1500,773)],exit=(.82,0),entry=(.33,1),dash=True)
sources=p.box('<b>외부 공개 소스</b><br><br>공식 AI 소식 · RSS<br>GitHub · 공개 템플릿<br><br><font color="#52677D">수집 가능한 출처만 사용<br>URL·게시일·확인일 기록</font>',1905,905,260,210,'#F1FAF5','#89BAA7',19)
p.edge(cw,sources,'HTTPS 수집 요청 ↔ 원문 응답',C['green'],[(1100,1135),(2035,1135)],exit=(.5,1),entry=(.5,1))
p.region('공통 운영 · 관련 서비스에 공통 적용 (연결선 생략)','',315,1160,1510,95,'#F3F5F8','#A5B3C1')
p.text('CloudWatch 로그·알림   |   SQS별 DLQ + 재처리   |   IAM 최소 권한   |   Secrets Manager: 소스 API 키(필요 시)   |   AWS Budgets 비용 알림',335,1215,1460,26,16,C['muted'])
p.box('<b>요청 처리 규칙</b><br><br>jobId + 조회 토큰으로 해당 결과만 조회<br>입력 크기·모델 토큰·동시 처리량 제한<br>작업 TTL · 재시도 중복 처리 방지',40,545,200,280,'#FFFAF0','#D6B26E',17)
p.box('<b>저장할 데이터</b><br><br>출처 URL · 확인일<br>비용·설치·연동 조건<br>검증 수준 · 추천 근거<br><br><font color="#52677D">초기 검색: 태그·업무 분류<br>+ 후보 목록 내 키워드 비교</font>',1905,595,260,255,'#FFF9F0','#D2AD70',18)
p.box('<b>향후 확장</b><br><br>Cognito 회원 인증·저장<br>개인화·알림 · 제작자 등록<br>데이터 증가 시 검색 개선',1905,255,260,195,'#FAFAFB','#AAB6C4',18,style='dashed=1;')
p.box('<b>작게 시작하는 기준</b><br>테스트 사용량을 기준으로 DynamoDB 온디맨드·Lambda 사용<br>AI 호출량 제한 / 서비스별 예산 알림으로 비용 확인',40,1320,760,115,'#F5F9FE','#CBD6E2',18)
p.box('<b>설계 시 확정할 항목</b><br>Bedrock 모델의 서울 리전 지원·가격·품질 확인<br>허용 출처·수집 주기·원문 보관 범위·작업 만료일 결정',830,1320,750,115,'#FFFAF0','#D7B16B',18)
p.box('<b>화살표 범례</b><br><font color="#2779BD">파랑: 웹/API</font>  ·  <font color="#27876B">초록: 수집</font><br><font color="#8062C2">보라: AI/작업</font>  ·  <font color="#C88832">황토: 조회/저장</font>',1610,1320,550,115,'#FFFFFF','#CBD6E2',18)
p.text('상세 원칙: 추천은 검토 근거 제공 · 자동 도구 실행/업무 시스템 쓰기는 후속 범위 · 소규모 테스트용 제안이며 운영 적용 전 인증·제한값 검토',40,1460,2120,25,16,C['muted'])

ET.indent(mx,space='  ')
target=OUT/'Toolmeet_Architecture_v1.drawio'
ET.ElementTree(mx).write(target,encoding='utf-8',xml_declaration=True)
print(target)
print('Pages:',len(mx.findall('diagram')),'Cells:',len(mx.findall('.//mxCell')))
