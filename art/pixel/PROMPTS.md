# 도트 그림 제작 기록 (B1, 2026-11-14)
## 방법
- 생성: `python3 art/tools/px-gen.py <폴더/이름> --refs washer8,fridge8 [--extra 문장]` (내부는 `codex exec --skip-git-repo-check -i <참조> -`, 프롬프트는 stdin). 새 PNG를 `~/.codex/generated_images/`에서 찾아 `art/raw/px/<폴더>-<이름>.png`로 복사. 대상 문장은 `art/pixel/subjects-B1.json`. 동시에 여러 장을 돌리면 새 파일 탐지가 섞인다(smart_tv가 세탁기로 나온 사고) → 순차 실행.
- 참조(`art/pixel/refs/`): `washer8`·`fridge8` = `public/assets/look-b`의 48×48을 최근접 8배(384²), `room6` = 방 180×120을 6배. 방은 room6만, 살림·상자·아이콘은 fridge8+washer8(세탁기는 fridge8만) 첨부.
- 후처리: `python3 art/tools/px.py make B1` → `check B1` → `sheet B1`.
## 화풍 문단 (px-gen.py STYLE, W×H만 장마다 치환)
16-bit pixel art drawn on a tiny WxH pixel canvas, enlarged nearest-neighbor; whole object only about WxH big hard-edged square blocks; chunky simple shapes, big flat colors, no fine detail/specks; continuous 1-pixel navy #16224a outline; 2-3 tone flat shading lit top-left; at most 1-2 white highlight pixels; 팔레트 색 나열; no anti-aliasing/gradient/glow/sparkle/shine/shadow; 3/4 front view from slightly above; flat magenta #FF00FF background; no text/logos/people/hands. 방은 3:2 가로, 8px 블록, 바닥선 62% 높이·창·조리대 위치를 비율로 지정.
## 설계서와 다르게 한 점
- 축소: 면적 평균 대신 **칸별 최빈 팔레트색**(원본을 먼저 팔레트 양자화). 평균은 격자가 어긋난 선·테두리에서 중간색 잡음(워셔 시험 고립 도트 16%)을 냈고 최빈은 0~6%.
- 키 색 제거: 가장자리 연결 영역만이 아니라 키 색 근처 화소 전부(선풍기 안쪽 구멍 때문).
- 원본 파일명: `<폴더>-<이름>.png`(폴더 충돌 대비, col/fan 등).
## 장별 재시도
- room/blue: 재생성 1(조리대가 흰 상자·오른쪽 잘림 → 하늘색 문짝 조리대, 폭 66~90%) + 손질(창틀 위 2행 삭제, 창틀 한 행 정리) handFixed
- box/small-1: 재생성 2(주황 윗면 → 모래색 지정; 줄무늬가 끈처럼 나옴 → 테이프 한 줄 명시)
- box/big-1: 재생성 1(윗면 색 통일). box/normal-1: 1차 통과
- item/washer: 1차(시험 후) / item/smart_tv: 1회 재생성(병렬 혼입 사고) / item/fridge 1차
- item/fan: 재생성 2(구멍 뚫린 가드·격자 잡음) 후 도트 손질 handFixed
- item/rice_cooker: 1(옆 손잡이가 얼굴처럼 보임 → 옆 손잡이 금지) / item/coffee_machine: 1(어두운 덩어리 → 밝은 몸통+컵)
- icon/svc-internet: 1(납작함 → 키 큰 안테나) / icon/svc-water: 1 + 도트 손질 handFixed(좌측 테두리 지그재그)
- 나머지 1차 통과: kettle air_purifier gloves wall-phone

# B2 + B1 다시 그리기 (2026-11-14)
- 도구: `px-gen.py`가 `subjects-B2.json`도 읽음. 참조 `refs/gloves16`(도구), `fridge8,washer8`(살림·아이콘). 상자 단계는 생성하지 않고 `art/tools/px-box.py`가 `box/*-1`에 도트 손상을 그림(handFixed). 손으로 찍기 `px-hand.py`(문자 격자).
- 다시 그리기: svc-internet 24×24 재생성 1(통과). svc-water 24×24 재생성 1 + 몸통 도트 재작성(얼굴처럼 보임) handFixed. coffee_machine 재생성 1(통과). rice_cooker 재생성 1(그릇처럼 보임) → 12×10 손도트 handFixed. fan 재생성 1(통과, handFixed 해제).
- 도구: hammer·drill·robot-arm 1차 → 대각선이 고립 도트 13~50%로 check 실패 → cutter·hammer·robot-arm 가로/세로 지시로 재생성 1. cutter는 납작한 막대로 나와 손도트 handFixed. drill 1차 통과.
- 상자 2단계: 테이프 윗부분 뜯김+말린 끝, 왼쪽 아래 모서리 컷+주름. 3단계: 2단계 + 윗면·앞면 사이에 완충재 틈(높이 유지 위해 몸통 중간 행 삭제) + 옆면 금 두 줄. 큰 상자 4단계: + 끈 끊어짐 + 앞면 금 3곳.
- 시험 잔재 washer-gold/rainbow 삭제. check 27/27 통과, sheet-B1(다시 그린 5장 포함)·sheet-B2.

# B3 + B2 손질 (2026-11-14)
- 도구: `px-gen.py`가 `subjects-B3.json`도 읽음. 참조 `refs/svcinternet8,svcwater8`(24×24를 8배). 순차 실행. 새 `art/tools/px-b3.py` = 도형 함수 + 자동 외곽선 손도트(16×16은 채움 12×12 + 외곽선, 24×24 도구). 대각선은 1칸 계단이면 고립 도트가 되어 계단을 2칸 폭으로.
- 생성 1차: svc-air/phone/interior/robot/home, coin, contract, box-closed 등. svc-clean 재생성 1(비눗방울 점 잡음 → 큰 방울 2개 지시).
- 손도트(handFixed): fever·crit·bundle·perk·box-closed·box-open·coin-pile(생성본이 가장자리 침범·잡음·형태 약함), cutter(굵은 가로형 몸통+슬라이더+비스듬 칼날, 대각 대신), robot-arm(팔·집게 2~4도트 굵기, 밝은 면).
- 상자 2~4단계 `px-box.py` 강화: 테이프 뜯김 길게 + 말려 올라간 조각, 모서리 찌그러짐 키움, 윗면 꼭짓점 눌림(2단계부터), 옆면·앞면 굵은 지그재그 금(폭 2, 개수 줄임).

# B4 + 상자 단계·커터 다시 그리기 (2026-11-14)
- B4 12장은 Codex 생성 없이 전부 손도트(handFixed): `art/tools/px-b4.py`(px-b3.py의 Cv 재사용, 16×16 채움 12×12+외곽선, 사은품 상자 40×40, 커터 24×24). 생성 0회, 도형 조정 반복 후 통과.
- 상자 단계 `px-box.py` 전면 재작성: 금은 4방향 연결 1도트 지그재그(앞면 w1, 옆면은 바탕이 w1이라 w2). 2단계 테이프 윗부분 벗겨짐(w1 틈+p1 말림)+옆금, 3단계 +윗면 날개 한쪽 2~3도트 들림(틈 k1, 균일 행을 지워 높이·바닥선 유지)+앞금+아랫모서리 찌그러짐, 4단계 +양쪽 들림+왼쪽 끈 끊어져 늘어짐+Y 금.
- 커터 24×24: 가로 22×8, 노란 손잡이+밀개 단추+왼쪽 비스듬 칼날(눈금 2줄).
- bundle-comm(위성 접시)은 윤곽 계단 고립 도트 때문에 `connect()`로 윤곽 보강. 가장 약한 그림.

# B5 특전 + svc-air·wall-phone-ring 보강 (2026-11-14)
- 12장 전부 Codex 생성 없이 손도트(handFixed): `art/tools/px-b5.py`(px-b3 Cv 재사용, 16×16 채움 12×12+외곽선). 특전 `icon/perk-<id>`: tap_power 빨간 글러브, crit 과녁+다트, fever_long 모래시계(주황 모래), svc_power 톱니+렌치, offline_rate 안락의자, offline_cap 파란 여행 가방, box_discount 별 쿠폰, parcel_freq 상자 실은 트럭, bundle_boost 리본 매듭, contract_slot 클립보드+별, penalty_cut 가위+두루마리, tap_crit_power 폭발 별.
- 도형 조정: fever_long 목 계단 고립 도트로 check 실패 → 2행 단위 계단 + `connect()`. tap_crit_power 가시를 굵게.
- svc-air 24×24 재작성: 흰 기둥 몸통 + 앞면 가로 살 통풍구 + 위로 나가는 바람 곡선 2개(b3). 정수기와 실루엣 구분.
- ui/wall-phone-ring 20×20: wall-phone 복제, 수화기 부분만 1도트 위로 + 양옆 울림 표시(g2 세로 선 3개씩). 전화 몸통 좌표 동일.
- 확대본: `sheet-B5-fix.png`(svc-water 비교·svc-air·wall-phone·wall-phone-ring 8배). check 68/68.
- 약한 그림: svc_power(톱니가 동전·열쇠처럼 보임), crit 다트, penalty_cut.

# B6 방 배경 8장 + blue 러그 (2026-11-14)
- Codex 생성 0회, 전부 손도트(handFixed): `art/tools/px-b6.py`(벽·바닥·창·조리대·러그 함수를 방별 인자로 호출, 창밖 풍경 함수 방별). blue는 `art/pixel/blue-base.png`(러그 전 원본) 위에 b4/b3 사다리꼴 러그(x44~136,y92~120)만 얹음.
- 방: mint(gn 벽·k3 타일·창 둘+화분) sunset(g1 벽·w1 바닥·노을 창+소파) night(k2 벽·k1 바닥·야경 통창) moon(k3 패널 벽·k2 금속 바닥·둥근 창 지구) mars(w1 벽·r1 금속 바닥·붉은 사막 창) jupiter(w2 벽·줄무늬 행성 창) nebula(k0 벽·pu 바닥·성운 통창) edge(b1 벽·k0 바닥·전폭 별밭 통창). 러그는 방마다 다른 색, 조리대 윗면 y52~58(manifest `counterTop`).
- 합성본 `art/tools/px-b6-sheet.py` -> `sheet-B6-rooms.png`(3배, 살림·p2 실루엣 2점·상자·선반 합성). check 76/76.
- 약한 방: mint(타일이 벽돌처럼 보임, 화분 작음), moon(벽 k3와 k4 살림 대비 낮음).

# B7 수집품 13종 + 변종 26장 (2026-11-14)
- manifest에 `col/<id>`(B7)·`col/<id>-gold|rainbow`(B7v) 39항목, 대상 문장 `subjects-B7.json`(px-gen.py가 읽음). 참조 washer8+fridge8, 장마다 "32 캔버스 꽉 채움" extra. 몸통 색: fan 민트(gn) kettle 빨강 toaster 하늘 heating_pad 노랑 hair_dryer 주황 humidifier 하늘 rice_cooker 크림 water_purifier 흰+파랑통 air_purifier 흰회 air_fryer 남회 vacuum 보라(key green) coffee_machine 남색 dishwasher 회색.
- 생성 13장 1차 + 재생성 6회: fan 2(고립 7%) · humidifier 1(밥솥처럼 보임 → 원뿔 병) · vacuum 1(키 색 불일치로 분홍 배경이 남음 → extra로 초록 배경 명시) · dishwasher 1(오븐처럼 보임 → 접시 창). 손질 0회. 병렬 실행 사고 주의: 한 번에 6장 돌리면 180초에서 백그라운드로 넘어가므로 3장씩.
- 변종: 기본 규칙(무지개 전부 치환)은 내부 형태가 뭉개져 `px.py variant rainbow`를 고침 — k0·k1·k2·k5·w1·r1·b1·g0는 유지하고 나머지만 대각 띠, 이후 고립 도트는 이웃 최빈색으로 흡수. 황금은 설계서 규칙 그대로(명암 5단계).
- 시트 `art/tools/px-b7-sheet.py` -> `sheet-B7.png`(기본·황금·무지개 3줄). check 115/115.
- 약한 그림: dishwasher(오븐 느낌), air_purifier(단순 기둥), heating_pad(담요/스펀지 느낌).

# B8 수집품 2차 7종 + B7 손질 + 변종 규칙 (2026-11-14)
- 대상 문장 `subjects-B8.json`(px-gen.py가 읽음), manifest `col/<id>`(B8)·`-gold|rainbow`(B8v) 21항목. 참조 `refs/col-rice_cooker8,col-coffee_machine8,col-water_purifier8`(B7 확정본 32×32를 마젠타 위 최근접 8배), 장마다 "32 캔버스 꽉 채움" extra, 순차 실행(한 장씩). 키: space_purifier·robot_vacuum 초록, 나머지 마젠타.
- 7종: 에픽 air_conditioner(와이드 흰 박스+파란 날개) washer(둥근 문) smart_tv(풍경 화면) fridge(키 큰 2도어) / 전설 massage_chair(버건디+금 장식) robot_vacuum(납작 원반) / 신화 space_purifier(보라 몸통+토성 고리 구체). 전부 1차 통과, 재생성 0.
- B7 다시: dishwasher 1회(문 열린 선반+접시), air_purifier 2회(1차 격자 잡음 고립 6.3% 실패 → 큰 원형 환기구+슬롯 3줄+바람 곡선). 생성 총 11장(신규 7 + 재생성 3 + ... 합 10회).
- 변종 규칙(px.py `variant`): 황금 = 얇은 k0/k1 선은 유지, 굵은 어두운 면은 면으로 취급 → 그림별 최대 면적색 g2, 더 어두운 색 g1(가장 어둡고 면적 <15~30%이면 g0), 더 밝은 색 g3, 흰 점은 좌상단 최대 2개만 k5. 무지개 = 얇은 k0/k1/k2 선·작은 k5만 유지하고 나머지 몸통 면 전부 대각 3도트 띠(r2·or·g2·gn·b3·pu), 고립 도트는 이웃 최빈색.
- 40장 전부 재파생, `art/tools/px-b8-sheet.py` -> `sheet-B8.png`(20종, 10종씩 기본·황금·무지개 3줄×2판). check 136/136.
- 약한 그림: air_conditioner(납작 단순), fridge(밋밋), coffee_machine·dishwasher 무지개(어두운 면 띠로 형태 뭉개짐).

# B9 집 단계 아이콘 9장 + fridge 다시 + 방 2곳 (2026-11-14)
- Codex 생성 0회, 전부 손도트(handFixed): `art/tools/px-b9.py`(px-b3 Cv 재사용, 24x24 집 / 32x32 냉장고는 여백 1칸 직접 그림). 시트 `art/tools/px-b9-sheet.py` -> `sheet-B9.png`(8배 + 실제 2배 줄).
- 집 icon/house-<id>: blue 파란 지붕 단층집, mint 투룸(창 둘+나무), sunset 벽돌색 다층 아파트(노을색 창), night 유리 고층+옥상 정원, moon 회색 돔+안테나, mars 붉은 땅 돔 3개, jupiter 줄무늬 행성+떠 있는 정거장, nebula 보라 구름+수정탑, edge 별밭 위 금빛 도시. 이름은 houses.ts의 theme.
- col/fridge: 위아래 두 문+손잡이+파란 패널+옆면 명암. gold·rainbow 변종 재파생.
- 방 손질(px-b6.py): mint 바닥 k4+k3 이음매·러그 b3, edge 바닥 k1+b1 격자. sheet-B6-rooms.png 재생성.
- 약한 그림: mars(낮은 돔 3개가 한 덩어리 UFO 느낌), moon(돔 단순).
