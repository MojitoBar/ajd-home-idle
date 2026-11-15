# UI 감리 — 우리 집 키우기 (2026-11-14, 읽기 전용 리뷰)

기준: `screenshots/u2-*.png`(780×1688, DPR 2 → 아래 수치는 CSS px), 서비스 목록 전체는 `u1-02-services-full.png`. 문구 내용(말투·용어·숫자 표기)과 수집품 이모지는 범위 밖이다. 줄 번호 대신 선택자로 적었다.

## 총평

- 부품(젤리 버튼·탭·모달 틀)은 한 벌로 잘 잡혀 있다. 지금 수준은 "프로토타입 상위권, 출시작 하위권"이다. 아이콘의 광택 3D 톤에 비해 글자와 작은 부품(배지·막대 라벨·태그)이 거칠어서 싸 보인다.
- 약점 1. **한국어 줄바꿈.** `word-break: keep-all`이 전역에 없다. 그래서 모달 설명이 "않아/요.", "없/고,"처럼 음절 중간에서 끊긴다(6개 화면).
- 약점 2. **색의 의미가 흩어져 있다.** 빨강이 위험(약정·초기화), 보상(오프라인 72억), 배율(결합 x1.5, 도감 x1.03)에 모두 쓰인다. 진행 막대도 색 4종, 높이 5종이다.
- 약점 3. **방 영역 밀도.** 8개 아이콘의 수익 배지가 서로 붙어 있고(간격 1~2px), 펄스와 이벤트 알림이 그 위를 덮는다. 이사 버튼의 펄스는 젤리 받침까지 지워 버린다.

## 고칠 목록

| 번호 | 화면(스크린샷) | 요소(선택자) | 문제(측정값) | 수정안(구체 값) | 중요도 |
|---|---|---|---|---|---|
| 1 | u2-03, u2-17-dark-modal-m6, u2-05, u2-09-event, u2-09b, u2-14 | `body`, `.modal-body p`, `.note` | 음절 중간 줄바꿈: "않아/요.", "없/고,", "머리/로", "단/위)", "돼/요.". `keep-all`은 `.modal-head h2`, `.pc-*`, `.plan-title`, `.dex-name`에만 있다. | `body { word-break: keep-all; overflow-wrap: break-word; }`를 추가한다. `.modal-body p, .note, .box-hint, .q-ask, .pr-desc { text-wrap: pretty; }` | 상 |
| 2 | u2-15, u2-10, u2-14, u1-02 | `.move-btn.ready` + `@keyframes pulse`(style.css) | 키프레임이 `box-shadow`를 통째로 바꿔서, 펄스가 도는 동안 파란 버튼의 받침(4px `--base`)이 사라진다. 대신 분홍 테(`#e9304bcc`, 최대 9px)가 생긴다. 파랑 위에 분홍이 겹쳐 색이 충돌한다. | `pulse-gold`와 같은 구조로 바꾼다. `0%,100% { box-shadow: 0 var(--press) 0 var(--base), 0 0 0 0 #5b9bffcc } 50% { box-shadow: 0 var(--press) 0 var(--base), 0 0 0 9px #5b9bff00 }`(`--blue-300` 기준) | 상 |
| 3 | u2-17-dark-m4, u2-17-dark-m6 | `.perk-alert` + `@keyframes perkpulse`(m4.css) | 2번과 같은 원인으로 금색 버튼의 받침이 사라진다. 어두운 테마에서는 갈색 테 8px가 링처럼 보인다. | 키프레임의 두 상태 모두 맨 앞에 `0 var(--press) 0 var(--base)`를 넣는다. | 중 |
| 4 | u2-15 | `.move-row` 안의 `.bar` / `.step-btn` / `.move-btn` | 한 줄에 높이가 세 가지다. 실측 38 / 35(+받침 3) / 44(+받침 4). 아래 선이 맞지 않는다. | `.bar { height: 44px; }`, `.step-btn { min-height: 44px; --press: 4px; }`로 바꾼다. 셋 다 44 + 받침 4가 된다. | 상 |
| 5 | u2-15, u2-06 | `.bar-fill`(초록 `--good`) | 꽉 찬 초록 막대가 여섯 번째 버튼 색처럼 보여서 누를 수 있을 것 같다. 바로 옆이 진짜 버튼 2개다. | `.bar`를 오목한 홈 모양으로 바꾼다: `box-shadow: inset 0 2px 3px #1f2a4422;`, 바깥 그림자는 제거. 다 차면 `.bar-fill { background: linear-gradient(180deg, var(--gold-300), var(--gold)); }`, 글자는 `--gold-ink`. 초록은 쓰지 않는다. | 중 |
| 6 | u2-15, u2-17-dark-m6, u2-09-event-call | `.room-item`(폭 45 고정), `.ri-rate`(10px) | 45×8 = 360px인데 안쪽 폭은 약 356px이다. "1,350·7,920·1.36만" 배지 간격이 1~2px이고, m6의 "1,000만"은 카드 가장자리에 닿는다. 10px는 글자 크기 스케일 밖이다. | `.room-items { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); column-gap: 2px; inset: var(--s2) var(--s2) auto; }`, `.room-item { width: auto; }`, `.ri-rate { max-width: 100%; font-size: var(--fs-1); height: 16px; line-height: 16px; padding: 0 var(--s1); }`. 숫자를 4글자 이내로 줄이는 일은 문구 담당에게 요청한다. | 상 |
| 7 | u2-14, u2-10 | `.ri-rate.pulse` | `scale(1.3)` 때문에 배지가 약 60px까지 커져 이웃 배지와 겹친다("135", "1.36만", "100만"). | `transform: scale(1.12); position: relative; z-index: 1;` | 중 |
| 8 | u2-09-event-call | `.event-call` | 370×40 빨간 알약이 `top: var(--s2)`에 있어 방 아이콘 3~6번과 그 수익 배지를 가린다. | `.event-call { top: auto; bottom: var(--s2); }`로 `.tap-hint` 자리로 옮긴다. 알림이 떠 있는 동안 `.room:has(.event-call:not([hidden])) .tap-hint { visibility: hidden; }` | 상 |
| 9 | u2-09-event-call | `.event-call .dot` | 빨간 알약 모서리에 금색 점이 붙어 있는데 의미가 없다. | `display: none` | 하 |
| 10 | u2-15c, 전 화면 | `.badge`(x1 영구) | 누를 수 없는 `span`인데 주 버튼과 똑같은 파란 젤리다(40px, 받침 4px). 사람들이 누르려 한다. 화면에서 가장 진한 파랑이기도 하다. | `.badge { height: 32px; background: var(--card); color: var(--accent); box-shadow: 0 0 0 1.5px var(--blue-300) inset; margin-bottom: 0; }` 정보 배지 모양이다. | 상 |
| 11 | u2-15c | `.info-btn` | 실제 크기 26px라 터치 영역이 44px에 못 미친다. 앱에서 유일하게 Georgia 이탤릭 세리프를 쓴다. | `width/height: 30px; font: 900 var(--fs-2)/1 inherit; font-style: normal;`, 그리고 `::after { content: ''; position: absolute; inset: -8px; }`로 누를 수 있는 영역을 44px로 넓힌다. | 중 |
| 12 | u2-15c | `.speed-num` | 숫자와 단위가 같은 34px/900이라 "Mbps"가 숫자와 무게를 다툰다. | app.ts에서 단위를 `<span class="speed-unit">`로 분리한다. `.speed-unit { font-size: .6em; font-weight: 800; margin-left: var(--s1); color: var(--dim); }` | 중 |
| 13 | u2-15, u2-09-event-call | `.bchip`(폭 154 고정) | 모든 화면에서 이름이 잘린다. "알뜰 입문 …", "공기청정기 Lv 10 …". "휴대폰 Lv 13 더"는 말줄임표도 없이 끊긴다. 오른쪽 세 번째 칸은 30px만 보여서 옆으로 넘길 수 있다는 단서가 약하다. | `.bchip { width: 68%; max-width: 260px; }`(390 폭에서 약 245px). 한 칸 반이 보여 넘길 수 있다는 게 드러난다. `.bc-need`의 ellipsis를 유지한다. | 상 |
| 14 | u2-15, u2-06 | `.bchip.on .bc-mult`(`--red-700`) | 금색 카드 안에서 x1.5가 빨강 15px로 가장 크다. 빨강은 약정과 위험에 쓰는 색이다. | `color: var(--accent)`. 아래 배율 색 규칙을 따른다. | 중 |
| 15 | u2-15 | `.bc-bar`/`.bc-fill` | 높이 5px, `#ffc83d→#ff9f1a` 하드코딩. 다섯 번째 막대 모양이다. | `height: 6px; background: linear-gradient(90deg, var(--gold-300), var(--gold));` | 하 |
| 16 | u2-15 | `.bundle-toggle`("결합 2/5 ▲") | ▲가 약 7px라 거의 보이지 않는다. 옆의 "약정 0/2"는 금색 상태 칩, 이것은 흰 버튼이라 같은 줄의 칩 둘이 모양이 다르다. | ▲를 12px 셰브론 아이콘으로 바꾸거나 `font-size: var(--fs-2)` ▾로 한다. 높이는 둘 다 `min-height: 36px`로 맞춘다. | 하 |
| 17 | u2-15 | `.toolbar .chip`(x1/x10/MAX) | 폭이 36/48/56으로 제각각이라 선택된 x1만 동그랗게 보인다. | `.toolbar .chip { min-width: 56px; }` | 하 |
| 18 | u2-15, u2-16, u1-02 | `.ms-label`(`-webkit-text-stroke: 2.5px`) | 11px 글자에 2.5px 남색 외곽선을 둘러 획이 뭉개진다("Lv 50에 x2"의 0·e 속이 막힘). 가장 싸 보이는 요소다. | 라벨을 막대 밖으로 뺀다. 막대 위 오른쪽에 둔다: `.ms-label { position: static; text-align: right; color: var(--dim); -webkit-text-stroke: 0; font-size: var(--fs-1); line-height: 1.3; }`, `.ms-bar { height: 8px; overflow: hidden; }`. app.ts에서 라벨을 막대 앞의 형제 요소로 옮긴다. | 상 |
| 19 | u2-16, u1-02 | `.mini-chip:not(.on)` | 회색 34×20 알약에 아이콘만 있고 글자가 없다. 무엇인지 알 수 없고 고장 난 것처럼 보인다. | `background: transparent; box-shadow: 0 0 0 1px var(--line) inset;`(점선 느낌), 아이콘은 `filter: grayscale(1); opacity: .6`. `title`·`aria-label`에 결합 이름을 넣는다. | 중 |
| 20 | u2-14 | `.card.tap-card` | 카드 아래쪽에 약 30px 빈 공간이 있다. 다음 마일스톤을 막대(`.ms-bar`) 대신 글 한 줄로 보여 줘서 서비스 카드와 모양이 다르다. | 서비스 카드와 같은 `.ms-bar`와 라벨을 쓴다(18번 적용 뒤). `min-height: auto`. | 중 |
| 21 | u2-06 | `.mult-pop` | 팝오버 아래 가장자리가 `.tap-hint`("탭 +101")를 반쯤 덮어 잘린 것처럼 보인다. | `.room:has(.mult-pop) .tap-hint { visibility: hidden; }`, 또는 팝오버 `bottom`이 방 아래 가장자리보다 위에 오도록 맞춘다. | 중 |
| 22 | u2-06 | `.mp-t`(대상 칩) | 아이콘만 있고, 선택 상태를 받침 색으로만 보여 준다(가이드 금지 사항). | 선택된 칩은 `.chip.active`처럼 면을 파랑으로 채운다(`--b1: #5b9bff; --b2: #145ce6; --base: #0b3aa0`). `aria-label`에 서비스 이름을 넣는다. | 중 |
| 23 | u2-06 | `.mp-row`(`#7a859f`) | 흰 바탕 13px에서 대비 3.7:1이다. 하드코딩 색이다. | `color: var(--m-dim)`(5.34:1). `.mult-pop`도 `#fff/#1f2a44` 대신 `--m-*` 토큰을 쓴다. | 중 |
| 24 | u2-06 | `.mp-row.hot b`(`--hot`) | 결합 x1.5는 빨강, 합계 x1.5는 파랑으로 같은 숫자가 두 색이다. | `color: var(--accent)` | 중 |
| 25 | u2-02, u2-08, u2-13b | `.modal-actions`의 "닫기" | 닫기만 하는 버튼이 전체 폭 주 버튼(파랑)이다. X가 이미 있어서 가장 센 버튼을 쓸 이유가 없다. | 닫기만 있는 모달은 버튼을 기본 `.btn`(흰색)으로 바꾼다. 행동 버튼이 있는 모달(설정 등)에서는 닫기 버튼을 없앤다. | 중 |
| 26 | u2-02 | `.house-row.current` | 현재 집 줄이 `--m-soft`(#f1f5ff) 면뿐이라 흰 바탕과의 차이가 거의 없다. | `background: var(--gold-100);`, 이름 옆에 `.tag.gold`로 "지금"을 붙인다. 테두리만으로 표시하는 건 금지. | 중 |
| 27 | u2-01 | `.modal-body b` | "x1 -> x2.5" 강조가 홀로 다음 줄로 떨어진다. | `.modal-body b { white-space: nowrap; }`(1번과 함께) | 하 |
| 28 | u2-03, u2-17-dark-modal-m6 | `.pcard-inner`(188px) | 설명과 Lv 줄 사이에 약 56px 빈 공간이 있다(가이드 '남은 문제'에 기재됨). | `height: 164px`로 줄이고 `.pc-desc { flex: 1 }`은 유지한다. | 중 |
| 29 | u2-03 | `.pface.front`, `.pc-lv`(`--cc`) | 금색 모달 한 장 안에 빨강·파랑·보라 면과 받침이 함께 있어 색이 다섯 가지다. | 면은 `var(--m-soft)`, 받침은 `0 3px 0 var(--m-line)`으로 통일한다. 분류 색은 `.pc-cat` 알약에만 남기고, `.pc-lv`는 `var(--m-ink)`로 한다. | 중 |
| 30 | u2-04 | `.perk-row`(`border-left: 4px` + `--r-btn`) | 왼쪽 막대가 반경 14px를 따라 초승달 모양으로 휜다. | `border-left-width: 1px; box-shadow: inset 4px 0 0 var(--cc); overflow: hidden;`(분류마다 `--cc` 지정) | 중 |
| 31 | u2-04 | `.pr-name em`(분류) | 3택 화면에서는 색 알약인데 여기서는 흐린 글자다. | `.pc-cat`과 같은 알약 스타일(11px, 흰 글자, `--cc` 바탕)로 맞춘다. | 중 |
| 32 | u2-04 | `.modal`(내부 스크롤) | 마지막 줄이 모달 가장자리에서 그냥 잘려서 더 내릴 수 있다는 단서가 없다. | 스크롤되는 모달 본문에 `mask-image: linear-gradient(#000 calc(100% - 24px), transparent);`를 준다. | 하 |
| 33 | u2-04 | `.perk-pick-btn`(파랑) | 3택 모달은 보상 금색인데, 그리로 들어가는 버튼은 파랑이다. | `.btn.gold` | 하 |
| 34 | u2-05 | `.ct-opt.k-normal` / `.k-long` | 선택지 3줄이 회청·파랑·빨강으로 서로 다르다. 가이드 규칙("연한 면 + 강조 금색")과 어긋난다. | 두 클래스의 색 덮어쓰기를 지운다. 기본 `.ct-opt`로 통일하고, 추천 하나만 금색(`.plan-card.picked` 값)으로 한다. | 중 |
| 35 | u2-05 | `.ct-gain`(m5: `#1f8a52`) | 13px에서 대비 4.36:1이라 기준에 조금 못 미친다. 하드코딩 색이다. | `color: var(--accent)`(배율·수익 규칙). | 하 |
| 36 | — | m4.css `.ct-meta` `.ct-gain` `.ct-why` | m5.css와 이중 정의되어 있고 값도 서로 다르다. | m4.css의 세 줄을 지운다. | 하 |
| 37 | u2-07 | `.reward-num`(`--hot`) | 보상 "72억"이 위험 색인 빨강으로 표시된다. | `color: var(--accent); text-shadow: 0 2px 0 var(--gold-300);` | 상 |
| 38 | u2-08 | 설정의 `input[type=checkbox]`(app.ts `settingRow`) | OS 기본 체크박스(22px) 그대로다. CSS 규칙이 없다. | 스위치를 만든다: `appearance: none; width: 48px; height: 28px; border-radius: var(--r-chip); background: var(--m-line);` + `::before` 손잡이 22px 흰 원, `:checked`이면 `background: var(--accent)`, 손잡이 `translateX(20px)`. 줄 전체를 `label`로 감싸 44px로 한다. | 상 |
| 39 | u2-08 | `.btn.danger`(초기화) | 위험 버튼이 전체 폭 44px로 '닫기' 바로 위에 있어 주 버튼과 같은 무게다. | 맨 아래로 옮기고 구분선(`border-top: 1px solid var(--m-line); padding-top: var(--s3)`)을 둔다. `.btn.sm`, 흰 바탕에 `--fg: var(--hot)`. 누르면 확인 모달을 연다. 아래 '닫기'는 지운다(25번). | 상 |
| 40 | u2-08 | `.textbox` | 빈 60px 상자에 안내 문구도 테두리 대비도 없다. | `placeholder` 추가(문구 담당), `font: var(--fs-1)/1.4 ui-monospace, monospace; border: 1px solid var(--m-line);` | 하 |
| 41 | u2-09-event | `.plan-card` | B는 4줄, A는 2줄이 세로 가운데 정렬되어 제목 기준선이 29px 어긋난다. | `.plan-card { display: flex; flex-direction: column; justify-content: flex-start; }` | 중 |
| 42 | u2-09b | `.res-big.lose`(24px, `--m-dim`) | 18px 제목 "아쉬워요" 아래에 더 큰 회색 24px 문구가 있어 제목이 두 개처럼 보인다. 흐린 색이라 힘도 없다. | `font-size: var(--fs-3); color: var(--m-ink); font-weight: 800;`, 또는 오답일 때 요소를 지운다. | 중 |
| 43 | u2-09b | `.tot.win`(`#dff6e9` / `--good`) | 정답 칸에 초록을 쓴다. 강조는 금색이라는 규칙과 어긋난다. | `background: var(--gold-100); border-color: var(--gold);` | 하 |
| 44 | u2-10, u2-13 | `.dexsum-mult`, `.dex-mult`(`--hot`) | "수익 x1.00", "도감 배율 x1.03"이 빨강이다. | `color: var(--accent)` | 중 |
| 45 | u2-10 | `.box-open.ready`, `.bs-actions .btn.primary` | 금색 변수를 따로 다시 선언한다(가이드: 새 버튼 색 금지). | 마크업에 `.btn.gold`를 주고 변수 재선언을 지운다. | 하 |
| 46 | u2-11 | `.rar-pill` | 흰 글자 대비가 일반(`#9aa6bf`) 2.45:1, 전설(`#ff9f1a`) 2.05:1이다. | `.rar-pill { color: var(--ink); text-shadow: none; background: color-mix(in srgb, var(--c) 45%, #fff); box-shadow: 0 0 0 1.5px var(--c) inset; }`를 전 등급에 적용한다. 바탕을 밝게 하므로 모든 등급에서 4.5:1 이상이 나온다. | 상 |
| 47 | u2-11 | `.bs-card`(폭 210) | 844px 무대에서 카드가 화면의 27% 높이뿐이고 위아래가 비어 있다. 결과가 초라해 보인다. | `width: min(280px, 72vw); padding: var(--s5) var(--s4);`, 그림 96px, `.bs-name` 22→`var(--fs-num)`의 0.8배(28px). | 중 |
| 48 | u2-12 | `.badge-new.mini` | 10칸 중 9칸에 빨간 NEW 리본(약 38×18)이 칸 테두리와 행 간격을 덮는다. 화면의 주인공이 리본이 된다. | 미니는 점으로 바꾼다: `width: 10px; height: 10px; padding: 0; font-size: 0; border-radius: 50%; top: -3px; right: -3px; box-shadow: 0 0 0 2px #0b1333;` 개수는 `.sum-new`에 이미 나온다. | 상 |
| 49 | u2-12 | `.sum-cell` / `.sum-name` | "에어프라이어"가 62px 칸의 테두리에 닿는다(좌우 여백 2px). | `.sum-cell { padding: var(--s2) var(--s1) var(--s1); } .sum-name { letter-spacing: -0.3px; }` | 하 |
| 50 | u2-12 vs u2-11 | `.bs-actions` | 1개 결과는 버튼 2개(160+160), 10개 결과는 160px 버튼 하나가 가운데 덩그러니 있다. | 10개 결과에도 "또 10개" + "확인" 두 개를 둔다. 하나만 둘 때는 `max-width: 336px`. | 중 |
| 51 | u2-13 | `.dex-prog`(24px) | 글자 크기 스케일 밖이다(18과 34 사이). | 토큰 `--fs-5: 24px`를 추가하고 가이드에 적는다(`.res-big.lose`, `.sum-title` 20도 함께 정리). | 하 |
| 52 | u2-13b | 도감 상세 `openModal` | 다른 모달은 모두 제목 아이콘이 32px인데 여기만 없다. | `icon: 'ui-dex'`를 넘긴다. | 하 |
| 53 | u2-13b | `.det-v` | '기본'(이모지 없음)과 '반짝'(이모지 있음)의 글자 시작 x가 다르고(90 vs 130/2) 기준선도 2~3px 어긋난다. | `.det-v { align-items: center; min-height: 44px; }`, '기본'에도 20px 빈 아이콘 칸을 둔다(`.det-v > span:first-child { display: flex; gap: var(--s2); align-items: center; }`). | 중 |
| 54 | u2-17-dark-m6 | `body[data-theme='jupiter']` | `--dim`을 덮어쓰지 않아서 `#5d6b8a`가 `--bg1 #c58a4f` 위에 놓인다. 대비 1.81:1("기가", "+1,333만/초", "구매 수량"). | jupiter에 `--dim: #3f2a12;`를 추가한다(bg1에서 4.59:1, bg2에서 10.1:1). | 상 |
| 55 | (스크린샷 없음, 계산) | `body[data-theme='mars']` | `--dim #f3cdb4`가 `--bg2 #d98a5a` 위에서 1.84:1이다. 페이지 아래쪽(도구줄 라벨)이 여기 해당한다. | `--bg2`를 어둡게(`#b8653a`) 하거나, 도구줄 라벨을 `.panel` 면 위로 옮긴다. 실제 화면으로 확인해야 한다. | 중 |
| 56 | u2-17-dark-m6 | `--room-bg`(jupiter 줄무늬) | 14/12px 고대비 줄무늬가 전화기와 배지 뒤에서 어지럽다. | 알파를 `cc→66`으로 낮추고 줄 폭을 `0 28px, 28px 52px`로 넓힌다. | 중 |
| 57 | u2-17-dark-m4 | `.tab`(비활성, `--card` 반투명) | 어두운 테마에서 비활성 탭은 어두운 반투명인데, 같은 화면의 비활성 `.chip`·`.step-btn`·`.bundle-toggle`·`.icon-btn`은 흰 젤리다. 선택되지 않은 상태의 모양이 두 가지다. | `.tab`도 `.btn` 기본값(`--b1: #fff; --b2: #e6ecfa; --base: #aebad6; --fg: #1f2a44`)과 같은 그라데이션 면으로 한다. 테마와 상관없이 고정. | 중 |
| 58 | u2-15 | `.tab`(42px) | 다른 젤리 버튼은 44px인데 탭만 42px다. | `min-height: 44px` | 하 |
| 59 | 전 화면 | `.toast` | `bottom: var(--s5)`이 `env(safe-area-inset-bottom)`을 빼먹어서 홈 표시줄과 겹칠 수 있다(코드 확인). | `bottom: calc(var(--s5) + env(safe-area-inset-bottom));` | 하 |

**배율·수익 숫자 색 규칙(13·14·24·35·37·44에 적용):** 배율과 보상 숫자는 `--accent`, 금색 면 위에서는 `--accent` + `text-shadow: 0 2px 0 var(--gold-300)`. 빨강(`--hot`, `--red-700`)은 약정, 위험, 남은 시간에만 쓴다.

## 부품 불일치 요약

| 부품 | 화면별 값 | 맞출 값 |
|---|---|---|
| 주 버튼 높이 | `.btn` 44 / `.buy`·`.perk-alert` 46 / `.bs-actions .btn` 48 / `.box-btns .btn` 52 | 일반 44, 화면 대표 행동(구매·상자·결과) 48 → `--h-cta: 48px` 토큰 |
| 이사 줄 높이 | `.bar` 40 / `.step-btn` 40 / `.move-btn` 44 | 44 |
| 탭·칩 높이 | `.tab` 42 / `.chip` 34 / `.bundle-toggle`·구매 수량 칩 실측 36 | 탭 44, 칩 36 |
| 진행 막대 높이 | `.bar` 40 / `.ms-bar` 16 / `.q-bar`·`.dex-bar` 10 / `.bc-bar` 5 | 큰 막대 44(이사), 작은 막대 8로 두 단계 |
| 진행 막대 채움 | 초록 세로 그라데이션(`.bar-fill`) / 파랑 세로(`.ms-fill`) / 파랑 가로(`.dex-bar-fill`, `.q-fill`) / 주황 가로(`.bc-fill`) | 진행 = 파랑 가로(`--blue-300→--accent`), 보상 대기 = 금색 가로(`--gold-300→--gold`) |
| 배율 숫자 색 | `--red-700`(결합 칩) / `--gold-ink`(태그) / `--accent`(합계) / `--hot`(도감·배율 내역·보상) / `--ink`(단계표) | 위 규칙: `--accent` |
| 선택 카드 강조 | 금색(`.plan-card.picked`, `.det-v.sel`) / 파랑·빨강(`.ct-opt.k-*`) / 초록(`.tot.win`) / 분류색(`.pcard`) | 금색 하나 |
| 분류 표시 | 색 알약(`.pc-cat`) / 흐린 글자(`.pr-name em`) / 왼쪽 막대(`.perk-row`) | 알약 + 안쪽 막대 |
| 모달 제목 아이콘 | 대부분 32px / 도감 상세 없음 | 32px 모두 |
| 닫기 버튼 | 파랑 주 버튼(단계·설정·도감 상세) / 흰 보조(약정) / 없음(이사 확인) | 흰 보조 또는 없음(X로 충분) |
| 글자 크기 스케일 밖 | `.ri-rate` 10, `.fever-tag` 12, `.sum-title` 20, `.bs-name` 22, `.dex-prog`·`.res-big.lose` 24 | 11·13·15·18·24(신규)·34 |
| 같은 규칙 이중 정의 | `.ct-meta/.ct-gain/.ct-why`(m4 vs m5), `.perk-btn`(m4 두 번), `.bc-name`(m4 vs m5) | 한 곳만 남김 |

## 품질을 한 단계 올릴 제안 (비용 대비 효과 순)

1. **전역 타이포 3줄**: `body { word-break: keep-all; }`, 숫자 요소 전부에 `font-variant-numeric: tabular-nums`, 큰 숫자 단위 분리(12번). 비용은 30분인데 화면 전체의 완성도가 올라간다.
2. **색 의미 표 확정**: 파랑 = 행동·배율, 금색 = 보상·선택, 빨강 = 약정·위험·시간. UI-GUIDE.md에 표로 넣고 위 7곳을 고친다. 지금 가장 '아마추어 같은' 인상이 여기서 나온다.
3. **애니메이션은 받침을 지우지 않는다**: 젤리 버튼에 펄스를 걸 때는 `box-shadow` 대신 `::after` 링(`position: absolute; inset: 0; border-radius: inherit; animation: ring`)을 쓰는 공용 클래스 `.glow-ring`을 하나 만든다. 2·3번과 `pulse-gold` 문제가 한꺼번에 사라진다.
4. **진행 막대 부품 하나(`.pbar`)**: 높이 2단계, 채움 2색, 라벨은 막대 밖. 다섯 군데를 교체한다.
5. **단계표에 집 아이콘(`house-<theme>`) 24px 추가**: 이미 있는 에셋이라 바로 할 수 있다. 표 같던 모달이 '여정' 화면처럼 바뀐다.

## 못 본 화면·상태

- `u2-17-dark-modal-m4.png`(따로 열지 않음. m6 모달과 같은 틀로 추정), 피버 상태와 360·430 폭(u1에만 있어 구버전), 이벤트 정답(win)·`.plan-card.picked`, 잠긴 서비스 카드(`.card.locked`), 토스트, 이사 장면(`.move-scene`), 택배 상자(`.parcel`), 특전 최대 레벨(`.pcard.maxed`), 약정 중 카드의 `.ct-badge.soon`
- 테마: night·mint·sunset·nebula·edge·mars(mars는 대비만 계산)

---

## A. 모바일 사용성 개선안 (390×844, 한 손)

**현재 구조**(app.ts `app.append` 순서, 실측 CSS px): 머리줄 0~56 → 속도·포인트 56~150 → 방(전화) 160~408 → 이사 줄 415~460 → 탭 483~527(스크롤 중 고정) → 약정·결합 줄 540~650 → 구매 수량 670~705 → 첫 카드 717~(첫 구매 버튼 731~779).

| 번호 | 문제 | 중요도 |
|---|---|---|
| A1 | 가장 많이 누르는 큰 전화 버튼의 중심이 y≈300이다. 화면 위쪽 36%라 엄지가 닿기 어렵다. 서비스 목록으로 내려가면 화면 밖으로 사라진다. | 상 |
| A2 | 대체 수단인 작은 전화(64px, 왼쪽 아래 고정)가 카드 아이콘을 가리고, 자리를 따로 차지하지도 않는다(`.panel` 아래 여백 96px로 땜질). | 상 |
| A3 | 첫 화면에서 보이는 구매 버튼이 하나뿐이고(731~779), 두 번째 카드부터는 스크롤해야 한다. 탭하면서 동시에 목록을 볼 수 없다. | 상 |
| A4 | 탭 줄이 위쪽에 고정되어 있다. 엄지에서 가장 먼 곳이다. | 중 |
| A5 | 구매 수량(x1·x10·MAX)이 목록 맨 위에만 있어서, 아래 카드를 보다가 바꾸려면 다시 올라가야 한다. | 중 |
| A6 | 길게 눌러 연속 구매하는 기능이 없다(app.ts에 `pointerdown` 반복 처리 없음). 방치형의 핵심 편의 기능이다. | 중 |
| A7 | 모달의 X가 오른쪽 위(y≈80~120)에 있다. 엄지에서 가장 멀다. 모달은 화면 가운데에 뜬다. | 중 |
| A8 | 결합 칸 가로 줄은 세 번째 칸이 30px만 보여서 넘길 수 있다는 걸 알아채기 어렵다(13번). | 중 |
| A9 | 터치 영역 44px 미만: `.info-btn` 26, `.chip` 34(구매 수량), `.dex-rar` 24, `.ct-badge`. | 중 |
| A10 | `.toast`가 하단 안전 영역을 빠뜨렸다(59번). 그 밖의 고정 요소는 `env()`를 쓰고 있다. | 하 |
| A11 | 연타 중 오조작: 전화 아래 56px 안쪽에 '이사' 버튼이 있다. 확인 모달이 있어 피해는 없지만 흐름이 끊긴다. | 하 |

**추천 레이아웃: 하단 고정 독(dock) + 방 접기.** 위쪽은 '보는 곳', 아래쪽은 '누르는 곳'으로 나눈다.

```
[스크롤 영역]
 머리줄        56   (스크롤됨)
 속도·포인트    88   (Mbps 34 → 28, 포인트 한 줄)
 방            200  (전화 112 → 96. 스크롤로 방이 화면 밖에 나가면 독의 전화가 대신함)
 이사 줄        52
 [탭 내용]     약정·결합 → 카드 목록 …  (아래 여백 = 독 높이 + 16)
[하단 고정 독]  position: fixed; bottom: 0;  높이 64 + 56 + safe-area
 ├ 보조 줄 64: [x1|x10|MAX 분절 버튼 3×56]  ……  [전화 버튼 64 원형, 오른쪽]
 └ 탭 바 56:   서비스 · 탭 강화 · 상자 · 도감 (아이콘 24 + 11px 라벨)
```

- 이유: 엄지 영역(아래 40%)에 탭 바, 구매 수량, 전화가 모두 모인다. 전화가 독 안에 자리를 차지하므로 내용을 가리지 않는다. 그래서 A2 땜질(96px 여백, IntersectionObserver)을 지울 수 있다. 구매 버튼은 카드 오른쪽 열에 그대로 둔다. 오른손 엄지의 자연스러운 호에 이미 들어와 있다.
- 독의 전화는 큰 전화가 화면 밖에 있을 때만 보인다(지금의 `.mini-phone` 판정을 재사용하고, 위치만 독 오른쪽 칸으로 옮긴다). 큰 전화가 보일 때는 그 칸에 '이사' 진행률 미니 링을 둔다.
- 구현 지침: `.tabs`를 `nav.dock > .dock-tabs`로 옮긴다(`position: fixed; left: 0; right: 0; bottom: 0; padding-bottom: env(safe-area-inset-bottom); max-width: 480px; margin: 0 auto; background: color-mix(in srgb, var(--bg2) 88%, transparent); backdrop-filter: blur(10px); box-shadow: 0 -4px 16px #1f2a4422`). 구매 수량 칩은 `buildServicesPanel`에서 독 보조 줄로 옮기고, 서비스 탭에서만 보인다. `.panel { padding-bottom: calc(120px + env(safe-area-inset-bottom)) }`. 탭 강화·상자·도감 탭에서는 보조 줄 왼쪽을 비운다.
- 길게 눌러 연속 구매(A6): `.buy`에 `pointerdown`을 걸고 400ms 뒤부터 초당 8회 반복, `pointerup`·`pointerleave`·`pointercancel`에 멈춘다. 반복할 때마다 짧은 진동과 버튼 눌림 연출을 준다. 돈이 모자라면 즉시 멈춘다.
- 모달(A7): 390 폭에서는 바닥 시트로 띄운다(`.overlay { align-items: flex-end }`, `.modal { border-radius: var(--r-card) var(--r-card) 0 0; padding-bottom: calc(var(--s4) + env(safe-area-inset-bottom)) }`). 버튼 줄이 엄지 영역에 온다. X는 유지하고, 가림막을 누르면 닫힌다(`noClose`는 예외).
- 착수 시점: 독은 탭을 옮기는 구조 변경이다. 지금 `src/ui/`에서 진행 중인 탭·위약금 작업이 병합된 뒤에 시작한다.
- 바꾸지 않는 것: 페이지 전체 스크롤(내부 스크롤 금지 원칙)은 유지한다. 방을 위에 고정하는 것은 하지 않는다. 248px가 고정되면 목록이 화면의 40%밖에 남지 않는다.

## B. PC 레이아웃 설계안 (폭 1024 이상)

**현재 추정**: `#app { max-width: 480px }`이고 폭에 따른 `@media`가 하나도 없다(높이 700 미만과 움직임 줄이기만 있음). 1440 폭에서는 가운데 480px 기둥만 있고 양옆 960px가 빈 그라데이션이다. 키보드 처리는 `sound.ts`의 잠금 해제를 빼면 없다(Esc도 없음). `.mini-phone`의 `left` 계산이 480을 하드코딩하고 있다.

**중단점**: `< 900` 지금 그대로(모바일안 A). `900~1279` 두 단. `≥ 1280` 두 단 + 카드 2열.

```
┌──────────────── max-width 1180, 가운데, 바깥 여백 24 ────────────────┐
│ [왼쪽 단 400, sticky top:0, height:100dvh]  │ [오른쪽 단 1fr]            │
│  머리줄 56                                   │  탭 줄 52 (sticky top:0)   │
│  속도·포인트 120                             │  약정·결합 줄               │
│  방 320 (전화 140, 배지 11px 여유)           │  구매 수량 줄               │
│  이사 줄 52                                  │  카드 목록 (≥1280: 2열 grid)│
│  단축키 안내 줄 13px (Space 탭 · 1~4 탭 · Esc)│                            │
└──────────────────────────────────────────────────────────────────────┘
```

- 전화는 항상 왼쪽 단에 보이므로 `.mini-phone`은 900 이상에서 `display: none`.
- 모달: 지금처럼 가운데 대화상자, `max-width: 480px`(목록형 특전·단계표는 560). 가림막을 누르거나 Esc로 닫는다. 첫 버튼에 포커스를 두고, Tab 키가 모달 안에서만 돌게 한다.
- 전체 화면 연출(상자·이사·10개 결과): 가림막은 전체 화면 그대로 두고, 무대(`.bs-stage`, `.sum-wrap`, `.bs-actions`, `.sc-result`)는 `max-width: 480px; margin: 0 auto`인 가운데 기둥에 모은다. 지금 `.bs-actions`는 `left/right: var(--s5)`라 1440 폭에서 버튼 사이가 1000px 벌어진다. `.fever-frame` 비네트는 그대로 둔다.
- hover·focus: `@media (hover: hover) { .btn:hover:not(:disabled), .chip:hover, .tab:hover { filter: brightness(1.05); transform: translateY(-1px); } }`. 모든 버튼에 `:focus-visible { outline: 3px solid var(--blue-300); outline-offset: 2px; }`. 카드 hover 때 `--sh-2`. 아이콘만 있는 버튼(`.mp-t`, `.mini-chip`, `.icon-btn`)은 `title`을 툴팁으로 쓴다.
- 키보드: Space·Enter = 전화 탭(`e.repeat`는 무시해서, 누르고 있기로 자동 연타가 되지 않게 함). 1~4 = 탭 전환. Q/W/E = x1/x10/MAX. Esc = 모달 닫기(`noClose`면 무시). 입력란에 포커스가 있으면 모두 꺼진다.
- 마우스 탭 속도: 마우스 클릭은 초당 6~8회로 손가락 연타(10~12)보다 느리다. 밸런스는 바꾸지 않고, 대신 Space 키 연타를 허용해 보완한다. 길게 눌러 연속 구매(A6)는 PC에서도 같다.
- 배경: 넓은 화면에서는 `body::before` 별빛 외에 테마 `--room-bg`를 흐리게(`opacity: .25; filter: blur(40px)`) 깐 고정 레이어를 하나 더 두어 빈 공간을 채운다.

**CSS 구조 지침**
1. app.ts의 `app.append(...)`를 `el('div', { cls: 'col-play' }, header, hero, room, moveBlock, hint)`와 `el('div', { cls: 'col-list' }, tabs, panel)`로 감싼다. 모바일에서는 두 래퍼가 `display: contents`라 지금과 같다.
2. 새 파일 `src/ui/m6-desktop.css`: `@media (min-width: 900px) { #app { max-width: 1180px; display: grid; grid-template-columns: 400px minmax(0, 1fr); column-gap: var(--s5); padding: 0 var(--s5); } .col-play, .col-list { display: block; } .col-play { position: sticky; top: 0; align-self: start; max-height: 100dvh; } .room { height: min(320px, 40dvh); } .mini-phone { display: none; } .panel { padding-bottom: var(--s5); } }`. 1366×768 노트북(보이는 높이 약 650)에서 이사 줄이 잘리지 않게 `overflow: hidden`은 쓰지 않는다.
   - A의 독을 이미 적용했다면: 900 이상에서 `.dock`을 `.col-list` 맨 위로 옮기고 `position: sticky; top: 0; bottom: auto;`로 되돌린다. 독 안의 전화 칸과 구매 수량 보조 줄은 숨기고, 구매 수량 칩은 목록 위 도구줄로 되돌린다.
3. `@media (min-width: 1280px) { .card-list { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s2); } }`. 카드를 감싸는 `.card-list` 래퍼가 필요하다(app.ts `buildServicesPanel`).
4. `keys.ts`를 새로 만들어 위 단축키를 처리한다. `openModal`에 Esc와 포커스 가두기를 추가한다.

**구현 순서**: (1) 래퍼 + `display: contents`(모바일 회귀 0 확인) → (2) 두 단 CSS → (3) 연출 무대 기둥 → (4) hover·focus → (5) 키보드 → (6) 1280 2열 → (7) 배경.

**위험한 곳**: `innerWidth`·`innerHeight`·`getBoundingClientRect`가 `src/ui` 9개 파일에 32곳 있다(box, dex, app, eventUi, feverUi, parcelUi, fx, strategyUi, tapFx). 특히 위험한 곳:
- `parcelUi.ts`: 택배 상자를 화면 좌표로 띄운다. 넓은 화면에서 왼쪽 단 밖, 빈 배경에 뜰 수 있다.
- `fx.ts`·`tapFx.ts`: 떠오르는 숫자와 날아가는 동전의 출발점·도착점.
- `strategyUi.ts`의 `.bundle-link`: 고정 SVG 선을 화면 좌표로 그린다. sticky 단이 스크롤될 때 좌표가 어긋날 수 있다.
- `.mini-phone`의 `calc((100vw - 480px) / 2)`

각각 두 단 상태에서 왼쪽 단 기준 좌표로 계산되는지 확인해야 한다.
