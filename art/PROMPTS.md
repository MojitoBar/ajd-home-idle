# 아이콘 세트 제작 기록 (화풍 A+ "쥬시 캔디 토이")
도구: Codex CLI(`codex exec --skip-git-repo-check -i 참조 -`, stdin 프롬프트, 이미지 도구 gpt-image). 샌드박스가 읽기 전용이라 저장은 시키지 말고 `~/.codex/generated_images/`의 새 PNG를 복사. 장당 약 37~46초. 스크립트는 scratchpad `art/`의 g.sh, mk.sh, key.py, subj.txt.

## 최종 화풍 문단
Style: ultra-juicy glossy 3D candy-toy icon, like a premium mobile idle-game reward icon. Very plump, chubby, exaggerated rounded proportions; jelly/candy-like high-gloss plastic with strong crisp white specular highlights and soft glow reflections; very saturated vivid colors; smooth gradient shading; golden-yellow (#ffc83d) trim, rims or decorative accents; two or three small white-gold four-point sparkle stars attached close to the object edges. Viewed from slightly above in a 3/4 angle. No outlines, no cast shadow on the ground. Main color vivid blue (#145ce6), accent colors golden yellow (#ffc83d) and red (#e9304b), plus white. One single object centered, filling about 84% of a square 1024x1024 canvas, effects stay close to the object (nothing spreading over the whole canvas). Background: perfectly flat solid pure magenta #FF00FF with no gradient, no floor, no shadow, and no magenta or pink in the object itself. Absolutely no text, letters, numbers, logos, brand marks, people or hands.

## 프롬프트 골격
"Generate exactly ONE square icon image ... containing only this single object: <대상>. Single object only, do not add any other objects. Attached image(s) are other items from the same icon set: match their exact rendering style, camera angle, lighting, saturation and material, but draw the different object described. Do not copy the attached object itself." + 화풍 문단 + "Reminder: only one object."

## 참조 이미지
- 비교용 전화: 견본 art-samples/raw/A-phone.png + A-giftbox.png 첨부 → 1차는 변화가 약해(빨간 띠 누락, 효과 미미) 재시도 1회: "even chubbier, glowing inner light, red-and-white candy stripe, golden aura, FOUR bigger sparkle stars, much more dazzling than the reference" 문구를 넣어 통과 (tap-phone).
- 사은품 상자: A-giftbox.png + 최종 전화(tap-phone raw) 첨부, 1회 통과 (box-closed).
- 나머지 전 장: art/raw/tap-phone.png + art/raw/box-closed.png 2장 첨부. 게임 스크린샷은 첨부하지 않음.

## 장별 대상 문장
- svc-internet: a Wi-Fi router: rounded boxy chubby body, two thick short antennas, a row of three glowing round indicator lights, three curved Wi-Fi signal arcs above in gold. It is NOT a telephone and NOT a box
- svc-water: a water purifier dispenser: tall rounded body with a big clear blue water tank bottle on top showing glossy water, a small spout in front and a drip tray, a blue water droplet shape. It is NOT an air purifier
- svc-air: an air purifier: a short wide rounded cylinder/pill-shaped unit with a big round grille/fan face on the front, with three curvy white wind swirls blowing out from the top, no water tank, no spout. It is NOT a water dispenser
- svc-phone: a modern smartphone: chubby rounded rectangle slab with a big glowing blank blue screen and a tiny round camera dot on the back-top, gold frame, plump candy proportions. It is NOT a telephone handset. no app icons, no text
- svc-clean: a cleaning broom with a chubby red-and-gold handle and plump yellow bristles, with a pile of three glossy soap bubbles beside it. A broom, NOT a robot, NOT a vacuum
- svc-interior: a plump cozy sofa/couch in glossy blue with golden legs and two red cushions, simple and chunky, side-front 3/4 view. NOT a person
- svc-robot: a round robot vacuum cleaner: a chubby flat disc with a glossy blue top, a big white center button ring and a small gold bumper rim, tiny glowing sensor eye dot, seen from slightly above. It is NOT a broom and NOT a humanoid robot, no face with arms
- svc-home: a cute small house with a red roof, blue walls, round door, and a big shiny golden key standing attached beside/in front of it (key leaning against the house). House and key only
- box-open: an OPEN gift box: glossy blue plump box with the lid popped up tilted open, bursting golden light beams and glowing golden sparkles and a few small golden stars shooting upward out of the box, brilliant golden glow from the inside, golden ribbon. Light effects hug the box and stay within the canvas
- parcel: a floating cardboard delivery parcel: plump corrugated cardboard-brown box with a glossy cream packing tape cross strip on top, a red shipping label shape without any text (blank rectangle), and two small white feathery angel wings on its sides plus a tiny round balloon-like puff, floating in air. It is clearly different from the blue gift box: brown cardboard, no ribbon bow
- coin: a big chubby glossy golden coin, thick rim, a big embossed star in the center (no letters or numbers), standing at a 3/4 angle showing the thick edge, intense golden glow and a few sparkle stars hugging it
- coin-pile: a heap of about 8 chubby glossy golden coins stacked in a small mound, a couple of coins leaning, golden glow and sparkle stars hugging the pile, embossed stars on coins, no letters or numbers
- fever: a big chubby glossy flame: layered fire in red, orange and golden yellow with a bright white-hot core, jelly-like shiny, with small glowing ember sparkles hugging it. A single fire icon, no face
- crit: an exploding star burst: a big chubby glossy golden five-pointed star at the center with a spiky red-orange-gold starburst explosion shape behind it and small white sparkle shards flying close around. No text
- contract: a plump rounded paper contract document, white-cream glossy sheet with golden border, wavy squiggly lines in place of text (no real letters), a big round red seal stamp with a gold star at the bottom corner, a small blue pen-tip ribbon accent
- bundle: two chunky glossy rings/links interlocked together, one blue and one gold-red, forming a bonded chain link, with a small red ribbon bow tied around the joint. Plump and shiny
- perk: a chubby glossy golden trophy cup with two round handles on a small blue base, with a red ribbon star badge on the front, a few sparkle stars hugging it. No text or numbers

(서비스 id 대응: internet→svc-internet, water→svc-water, air→svc-air, phone→svc-phone, clean→svc-clean, interior→svc-interior, robot→svc-robot, home→svc-home)

## 배경 제거 (tools/remove-bg.py, 2026-11-14 재처리)
마젠타 요청 → m=(min(R,B)-G)/255, alpha=1-clip((m-0.08)/0.37,0,1) → 가장자리에서 이어진 배경만 투명(내부 구멍도 투명, `--keep-holes`로 보호 가능) → 알파 3px 침식 → 불투명 코어(알파>0.98을 4px 침식) 밖 화소 색을 가장 가까운 코어 색으로 교체(마젠타 번짐·분홍 테두리 제거) → 알파 가우시안 0.8 → alpha>20 bbox 크롭 → 긴 변 860px → 1024 투명 캔버스 중앙(master). 내보내기 LANCZOS 256(tap-phone·box-closed·box-open 512). 사용: `python3 art/tools/remove-bg.py art/raw art/master public/assets/icons [--names a,b]`. 확인: art/edge-check.png(남색·흰·하늘·주황 배경).

## 기록·주의
- 재시도는 tap-phone 1회뿐, 나머지 18장은 1차 통과.
- 발광/오라가 연한 복숭아~분홍 테두리로 나옴(금색 글로우+마젠타 키 영향). 파랑·흰 배경 모두 자연스럽지만 배경이 어두우면 분홍 테두리가 보일 수 있음.
- 세로로 얇은 물체(svc-water, svc-phone)는 40px에서 상대적으로 작게 보임.
- 다음 제작(수집품 80종 등): 같은 문단·골격에 참조 2장 첨부, 대상 문장만 교체. 한 번에 한 장씩, 한 Bash 호출에 2~3장(180초 지나면 자동 백그라운드 전환됨).

## 2차분 (2026-11-14, 32장: 결합 5·특전 12·집 9·UI 5·box-open 재제작)
- 방법·화풍 문단·골격·후처리는 1차분과 동일(스타일 문단 = scratchpad style2.txt). 장당 약 40~50초, 한 번에 3장씩 순차 실행. 대상 문장은 art/raw 생성 시 사용한 아래 요지(주제 + "NOT" 구분 문구는 1차 방식).
- 참조(art/master, 전부 투명본 1차 승인 아이콘, 게임 스크린샷 없음):
  - box-open: box-closed.png + box-open-v1.png(이전본). 프롬프트 요지: 같은 파란 상자, 뚜껑 활짝 젖힘, 금빛 광선·동전·반짝이가 힘차게 위로 분출, 이전 시도보다 훨씬 강하게.
  - bundle-comm: bundle, svc-home / bundle-thrifty: bundle, coin / bundle-rental: bundle, box-closed / bundle-chores: svc-home, bundle / bundle-newhome: svc-home, bundle
  - ui-*, perk-tap_power, perk-svc_power: perk, coin / perk-crit: crit, perk / perk-fever_long: fever, perk / perk-tap_crit_power: crit, perk / perk-offline_rate: svc-interior, perk / perk-offline_cap·perk-bundle_boost·perk-box_discount·perk-contract_slot·perk-penalty_cut: perk + (parcel|bundle|contract) / perk-parcel_freq: parcel, svc-home / ui-move: svc-home, parcel / house-*: svc-home, perk (house-blue·mint은 svc-home, coin)
- 대상: bundle-comm 위성 접시+전파 / thrifty 빨간 바구니+열매 / rental 리본 묶인 세탁기 상자+얼음 / chores 스펀지+양동이 / newhome 금 열쇠+빨간 리본. 특전 12종은 과업 지시의 주제 그대로(글러브, 과녁+다트, 불꽃 모래시계, 별 폭죽, 렌치+톱니, 안락의자, 여행 가방, 별 쿠폰, 택배 트럭(갈색 상자+날개), 리본 매듭, 클립보드+별, 가위+계약서). 집 9종은 점점 화려하게. ui-move는 짐 가득 쌓은 파란 이삿짐 트럭(택배 트럭과 구분).
- 재시도: house-nebula 1회(1차 시도는 보라 소용돌이가 투명 처리돼 어두운 배경에서 검게 보임 → "보라·분홍·마젠타·검정 금지, 파랑·시안 소용돌이+금 별가루, 불투명 원반 위 집"으로 재생성). 나머지 31장은 1차 통과.
- 주의: perk-tap_power 글러브에 흰 얼룩 무늬, house-jupiter는 행성이 화면을 거의 채우는 둥근 실루엣. 확인 시트: art/contact-sheet-2.png(상: 하늘색, 하: 남색, 각 장 200px + 48px).

## 수집품 20종 × 변종 (2026-11-14, 기본 20 + 황금 20 + 무지개 20)
- 방법: 아이콘과 동일(g.sh/batch.sh, Codex 이미지, 마젠타 배경, remove-bg.py). 스타일 문단은 style2.txt에서 "금색 트림·메인 파랑" 문장만 "흰색·은색 트림, 금은 작은 포인트만 / 색은 대상 설명에 지정"으로 바꾼 style2.txt.col. 대상 문장에 물건마다 다른 몸통색 지정(민트 선풍기, 코랄 포트, 하늘 토스터, 레몬 전기장판, 라임 드라이어, 복숭아 가습기, 아이보리+빨강 밥솥 / 레어 2색: 틸+흰, 주황+흰, 루비+은, 코발트+은, 에스프레소+크림, 은청+시안 / 에픽: 아이스블루+크롬+수정, 에메랄드+크롬, 인디고 별빛 화면, 터콰이즈+크롬+다이아 / 전설: 루비 안마의자+금관+날개+빛줄기, 진주백+시안/바이올렛 로봇청소기+금관+날개 / 신화: 남색 우주 정수기+토성 고리+위성). 서비스 아이콘과 같은 물건은 다른 디자인·색으로 지정.
- 참조(art/master, 승인 아이콘만, 게임 스크린샷 없음): 공통으로 2장씩 — svc-interior.png / svc-air.png / svc-robot.png / svc-water.png / perk-offline_rate.png / perk.png 중 주제에 가까운 것(예: air_purifier=svc-air+svc-interior, water_purifier·space_purifier=svc-water+(svc-interior|perk), robot_vacuum=svc-robot+perk, massage_chair=svc-interior+perk, 나머지=svc-interior|svc-robot + svc-air|perk-offline_rate).
- 산출: raw `art/raw/col-<id>.png`, 투명본 `art/master/col-<id>.png`, 게임용 `public/assets/collectibles/<id>.png`(256, 최대 약 90KB). remove-bg.py는 col- 접두 그대로 내보내므로 파일명에서 `col-`를 뗐다. 확인 시트 `art/contact-sheet-col.png`(`tools/col-sheet.py`).
- 재시도: heating_pad·vacuum 각 1회 — 보라색 몸통이 마젠타 키로 투명 처리돼 구멍이 남(보라·마젠타 계열 금지) → 레몬 옐로·코발트 블루로 교체 후 통과. 나머지 18장 1차 통과.
- 변종(`art/tools/make-variants.py <master_dir> <out_dir> [--names] [--size 256]`): 1024 투명본에서 처리 후 LANCZOS 256. 알파는 원본 그대로(별도 클립).
  - 황금: 밝기(알파>0.5 화소의 3~97% 퍼센타일 스트레치, ^0.72, ×0.9) → 5단계 색 대응(진갈색 → 갈금 → 금 → 연금 → 크림), 광택 하이라이트 유지, 흰 4점 반짝이 별 5개(실루엣 안쪽 무작위, 이름 시드, 블러 글로우 포함).
  - 무지개: 외곽 bbox 대각선 위치로 색조 0.05~1.2회전 + 밝기 따라 살짝 흔들림, 채도 0.95(하이라이트에서 감소해 흰 광택 유지), 대각선 줄무늬로 밝기 변조(홀로그램), 반짝이 별 8개.
  - 반짝 변종은 게임 쪽 연출이라 파일 없음.
- 주의: 전기장판(레몬)·전설 로봇청소기 황금판은 기본과의 색 차이가 작은 편. 밥솥 기본(아이보리)의 황금판은 연한 크림 금색. 56px에서 청소기·신화 정수기는 가는 실루엣.
