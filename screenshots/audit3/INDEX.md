# 검수용 화면 묶음 색인 3 (2026-11-15 3차 재촬영, 개발 서버 localhost:5173, 격리 헤드리스 Aside, 지금 코드 기준)

## 못 찍은 장면 / 주의
- 모든 시드 저장 값에 `stats.totalTaps=500`을 넣어 방 안 안내 말풍선을 숨겼다(2차와 같은 도구 그대로). 새 게임 첫 화면(`extra/n00-new-start`, `card/m390-new`, `card/pc1440-new`, `extra/p01-new`, `extra/n01`·`n02`)과 `final/*-01-main-early`(5폭)는 시드 없는 새 게임이라 말풍선이 보인다.
- 트로피 창: 별도 "트로피" 창은 코드에 없다(상단 트로피 버튼은 특전 창). `extra/m1-perk-list.png`, `final/*-18-perk-list.png`.
- 새 게임 실제 클릭 진행으로 열린 것은 처음 몇 개뿐(`n03-unlock-1~2-real`), 나머지 열림은 시드로 조건을 채워 찍었다(`n03-unlock-3~7-seeded-*`). 2차의 `n03-unlock-3-real`(도감)은 이번엔 실제 진행으로 안 잡혀 시드 장면으로 바뀌었다. "배율 내역"·영구 배율(badge) 열림은 못 잡음(badge는 코드상 항상 false).
- 방 완성 3.5초 장면(`extra/r2-roomdone-3_5s.png`)은 사은품 상자 연출이 방을 덮어 토스트가 안 보일 수 있다.
- 확률 화면은 "확률 보기" 버튼으로 뜨는 `상자 확률` 창(`extra/b1-odds.png`). `b4-box-sets`는 세트 완성 줄 + `세트 보기` 버튼 상태, `b5-set-view`는 도감의 세트 효과를 펼친 상태.
- 촬영 도구는 이번에 고치지 않았다(2차 도구 그대로, 에러 없이 전부 촬영됨). 단 `fx` 도구가 이번엔 `06-sparkle-192-0~4`(연속 프레임 5장)와 `08-gifts-2-banner-2.4s`(사은품 2개 배너)를 더 찍었다(2차 색인에는 없던 사진).
- 새로 추가한 장면 `extra/x-*` 8장: 기존 장면 함수(`tools/shots-fx2.cjs` 도우미, `fx2/s07`·`s08` 방식)를 재사용한 일회용 스크립트로 촬영(도구 파일 없음). `x-390-gift-banner-2`는 `fx/08-gifts-2-banner-2.4s.png`의 복사본이다. 못 찍은 추가 장면: 없음.
- `final/1440-06-open-single`은 이번에 결과 창(신화 등급 한 개 결과)이 찍힌 것을 직접 확인했다.
- 직접 눈으로 본 것: `final/1440-06-open-single`, `final/390-07-open-ten`, `extra/m6-settings`, `extra/m4-move-mid`, `fx/01-open-ten-0.5s`, `fx/08-gifts-2-banner-2.4s`, `card/m390-new`, `unpack/place`, `extra/x-*` 중 room-done-banner·bundle-banner·buy-flourish·move-ready·settings-mixed.
- 넘침 검사(`final/overflow-report.txt`): 125화면, 넘침·잘림 3건 — `1024-08-dex-some`(미발견 글자 잘림 3건: 황금·무지개·반짝 칸, scrollWidth 61 > clientWidth 59). 2차에 있던 `1024-25-house-edge`의 `span.house-name` 넘침은 이번엔 없음. 게임 쪽 문제로 보임(고치지 않음).
- `unpack/`·`unpack-pc/`는 프레임 여러 장을 가로로 이은 스트립. `room-*.png`는 `ONLY=room SCENE=...`(big, care, tierup, pile36, pile76) 결과를 `room-` 머리로 바꾼 것. `unpack/`은 기본 실행(hit·break·place·done·after·dock + u5: care·tierup·care-idle), `unpack-pc/`는 VW=1440 VH=900 `ONLY=u5`(care·tierup·care-idle)와 `ONLY=room SCENE=big`(big).
- 동시 작업으로 수치가 바뀔 수 있어 화면의 숫자는 촬영 시각 기준. 2차 색인의 사진 크기 표기는 이번 촬영 실제 크기로 바꿨다.


## final (tools/shots-final.cjs, 폭 390·360·430 = 모바일 DPR 2(원본 폭 780/720/860), 1024·1440 = PC DPR 1). 폭 5개 x 25장 + overflow-report.txt

파일 이름 `screenshots/audit3/final/<폭>-<번호>-<이름>.png`

| 번호 | 이름 | 화면 |
|---|---|---|
| 01 | main-early | 새 게임 초반 |
| 02 | main-mid | 중반(서비스 4종, 상자 45) |
| 03 | service-end | 서비스 8종 끝까지 스크롤 |
| 04 | tool-tab | 공구 강화 탭 |
| 05 | box-tab | 상자 탭 |
| 06 | open-single | 상자 1개 열기 결과 |
| 07 | open-ten | 상자 10개 열기 결과 |
| 08 | dex-some | 도감 일부 |
| 09 | dex-all | 도감 가득 |
| 10 | dex-detail | 도감 칸 상세(황금) |
| 11 | settings | 설정 창 |
| 12 | house-step | 집 단계 창 |
| 13 | move-confirm | 이사 확인 창 |
| 14 | move-mid | 이사 장면 중간 |
| 15 | move-end | 이사 장면 끝(결과 카드) |
| 16 | contract-sheet | 약정 창 |
| 17 | perk-pick | 특전 3택 |
| 18 | perk-list | 특전 목록 창 |
| 19 | offline | 오프라인 보상 창(3시간) |
| 20 | event-question | 이벤트 질문 |
| 21 | event-result | 이벤트 결과 |
| 22 | fever | 피버 진행 중 |
| 23 | room-done | 방 완성 뒤(상자 85, 손질 단계) |
| 24 | house-night | 펜트하우스 방(moves=3) |
| 25 | house-edge | 우주 끝 신도시 방(moves=8) |

폭별 화면 크기: 390=780x1688, 360=720x1480, 430=860x1864(DPR 2 원본), 1024=1024x768, 1440=1440x900.

## extra (tools/shots-audit.cjs, 모바일 390x844 DPR 1, PC 표시한 것만 1440x900)

- `screenshots/audit3/extra/b1-odds.png` — 상자 탭 "확률 보기"를 눌러 뜬 상자 확률 창 (390x844)
- `screenshots/audit3/extra/b2-open-1.png` — 상자 탭에서 1개 열기 결과 (390x844)
- `screenshots/audit3/extra/b3-open-10.png` — 상자 탭에서 10개 열기 결과 (390x844)
- `screenshots/audit3/extra/b4-box-sets.png` — 상자 탭 위쪽(세트 완성 줄 + 세트 보기 버튼, 세트 목록은 없음) (390x844)
- `screenshots/audit3/extra/b5-set-view.png` — "세트 보기"를 눌러 도감의 세트 효과로 이동한 화면 (390x844)
- `screenshots/audit3/extra/b6-dex-tab.png` — 도감 탭(가득 찬 도감) 390x844 (390x844)
- `screenshots/audit3/extra/b7-dex-detail.png` — 도감 칸 상세 (390x844)
- `screenshots/audit3/extra/c-m-gold-lv12.png` — 살림 8칸 모두 Lv 12 390x844 (390x844)
- `screenshots/audit3/extra/c-m-mixed.png` — 살림 8칸 섞임 1/3/12/48/192/5/20/2 390x844 (390x844)
- `screenshots/audit3/extra/c-m-rainbow-lv48.png` — 살림 8칸 모두 Lv 48 390x844 (390x844)
- `screenshots/audit3/extra/c-m-silver-lv3.png` — 살림 8칸 모두 Lv 3 390x844 (390x844)
- `screenshots/audit3/extra/c-m-sparkle-lv192.png` — 살림 8칸 모두 Lv 192 390x844 (390x844)
- `screenshots/audit3/extra/c-pc-gold-lv12.png` — 살림 8칸 모두 Lv 12 1440x900 (1440x900)
- `screenshots/audit3/extra/c-pc-mixed.png` — 살림 8칸 섞임 1/3/12/48/192/5/20/2 1440x900 (1440x900)
- `screenshots/audit3/extra/c-pc-rainbow-lv48.png` — 살림 8칸 모두 Lv 48 1440x900 (1440x900)
- `screenshots/audit3/extra/c-pc-silver-lv3.png` — 살림 8칸 모두 Lv 3 1440x900 (1440x900)
- `screenshots/audit3/extra/c-pc-sparkle-lv192.png` — 살림 8칸 모두 Lv 192 1440x900 (1440x900)
- `screenshots/audit3/extra/f1-m-gauge50.png` — 피버 게이지 약 50%(피버 전) 390x844 (390x844)
- `screenshots/audit3/extra/f1-pc-gauge50.png` — 피버 게이지 약 50%(피버 전) 1440x900 (1440x900)
- `screenshots/audit3/extra/f2-m-start.png` — 피버 시작 순간(피버! 글자) 390x844 (390x844)
- `screenshots/audit3/extra/f2-pc-start.png` — 피버 시작 순간(피버! 글자) 1440x900 (1440x900)
- `screenshots/audit3/extra/f3-m-active.png` — 피버 진행 중(탭 직후) 390x844 (390x844)
- `screenshots/audit3/extra/f3-pc-active.png` — 피버 진행 중(탭 직후) 1440x900 (1440x900)
- `screenshots/audit3/extra/h1-oneroom.png` — 집 방 화면: 원룸(moves=0) 390x844 (390x844)
- `screenshots/audit3/extra/h2-tworoom.png` — 집 방 화면: 투룸(moves=1) 390x844 (390x844)
- `screenshots/audit3/extra/h3-apt.png` — 집 방 화면: 아파트(moves=2) 390x844 (390x844)
- `screenshots/audit3/extra/h4-penthouse.png` — 집 방 화면: 펜트하우스(moves=3) 390x844 (390x844)
- `screenshots/audit3/extra/h5-moon.png` — 집 방 화면: 달 기지(moves=4) 390x844 (390x844)
- `screenshots/audit3/extra/k1-contract-sheet.png` — 약정 창(종류 3택) (390x844)
- `screenshots/audit3/extra/k2-contract-card.png` — 약정 중 카드(남은 시간 표시, 서비스 0·1) (390x844)
- `screenshots/audit3/extra/k3-penalty-confirm.png` — 약정 중 이사 누름 -> 위약금 확인 창 (390x844)
- `screenshots/audit3/extra/k4-bundle-open.png` — 결합 줄 펼침(처음 aria-expanded=false) (390x844)
- `screenshots/audit3/extra/k5-bundle-closed.png` — 결합 줄 접힘(비교용) (390x844)
- `screenshots/audit3/extra/m1-perk-list.png` — 특전 창(보유 특전 목록) (390x844)
- `screenshots/audit3/extra/m10-event-alert.png` — 이벤트 알림(전화 울림, 아직 안 누름) (390x844)
- `screenshots/audit3/extra/m11-tap-popover.png` — 공구 강화 탭 "탭 1회" 줄 내역 팝오버(.mult-pop 보임=1) (390x844)
- `screenshots/audit3/extra/m2-house-table.png` — 집 단계 창 (390x844)
- `screenshots/audit3/extra/m3-move-confirm.png` — 이사 확인 창 (390x844)
- `screenshots/audit3/extra/m4-move-mid.png` — 이사 장면 중간 1장(1.1초) (390x844)
- `screenshots/audit3/extra/m5-after-move.png` — 이사 직후 방(투룸) (390x844)
- `screenshots/audit3/extra/m6-settings.png` — 설정 창 (390x844)
- `screenshots/audit3/extra/m7-info-mult.png` — 위쪽 i 상세(배율 내역 팝오버) (390x844)
- `screenshots/audit3/extra/m9-offline.png` — 오프라인 보상 창(3시간) (390x844)
- `screenshots/audit3/extra/n00-new-start.png` — 새 게임 시작(탭 전, 방+서비스 카드 2장, 잠긴 탭 자물쇠) (390x844)
- `screenshots/audit3/extra/n01-first-tap.png` — 첫 탭 직후 (390x844)
- `screenshots/audit3/extra/n02-first-buy.png` — 첫 구매 직후 (390x844)
- `screenshots/audit3/extra/n03-unlock-1-real.png` — 실제 진행으로 열림 토스트: 새로 열렸어요 · 공구 강화 (경과 26초) (390x844)
- `screenshots/audit3/extra/n03-unlock-2-real.png` — 실제 진행으로 열림 토스트: 새로 열렸어요 · 상자 (경과 93초) (390x844)
- `screenshots/audit3/extra/n03-unlock-3-seeded-bundle.png` — 시드로 건너뛰어 연 단계(bundle)
- `screenshots/audit3/extra/n03-unlock-4-seeded-dex.png` — 시드로 건너뛰어 연 단계(dex)
- `screenshots/audit3/extra/n03-unlock-5-seeded-perk.png` — 시드로 건너뛰어 연 단계(perk): 새로 열렸어요 · 결합 (390x844)
- `screenshots/audit3/extra/n03-unlock-6-seeded-move.png` — 시드로 건너뛰어 연 단계(move): 새로 열렸어요 · 이사 (390x844)
- `screenshots/audit3/extra/n03-unlock-7-seeded-contract.png` — 시드로 건너뛰어 연 단계(contract): 새로 열렸어요 · 약정 (390x844)
- `screenshots/audit3/extra/p01-new.png` — PC 1440x900 새 게임 (1440x900)
- `screenshots/audit3/extra/p02-mid.png` — PC 1440x900 중반 (1440x900)
- `screenshots/audit3/extra/p03-tool-tab.png` — PC 1440x900 공구 강화 탭 (1440x900)
- `screenshots/audit3/extra/p04-box-tab.png` — PC 1440x900 상자 탭 (1440x900)
- `screenshots/audit3/extra/p05-dex-tab.png` — PC 1440x900 도감 탭 (1440x900)
- `screenshots/audit3/extra/p06-contract-modal.png` — PC 1440x900 약정 창 (1440x900)
- `screenshots/audit3/extra/p07-mid-1280x720.png` — PC 1280x720 중반 (1280x720)
- `screenshots/audit3/extra/p08-mid-1024x768.png` — PC 1024x768 중반 (1024x768)
- `screenshots/audit3/extra/r1-roomdone-1s.png` — 방 완성 1.3초 뒤(토스트: 커피머신을 놓았어요) (390x844)
- `screenshots/audit3/extra/r2-roomdone-3_5s.png` — 방 완성(80번째 상자) 이후 3.5초(토스트: ) (390x844)
- `screenshots/audit3/extra/r3-free-box-result.png` — 방 완성 무료 사은품 상자가 열린 결과 화면 (390x844)
- `screenshots/audit3/extra/r3b-after-close.png` — 사은품 결과를 닫은 0.9초 뒤(토스트: 이제 살림을 손질해요) (390x844)
- `screenshots/audit3/extra/r4-tierup-toast.png` — 단계 상승 직후 토스트 보이는 순간(토스트: 냉장고가 은빛이 됐어요) (390x844)
- `screenshots/audit3/extra/r5-tierup-free-box.png` — 단계 상승 무료 사은품 결과 화면 (390x844)
- `screenshots/audit3/extra/t1-crit.png` — 치명타 타격 순간(.fx-float.crit 1개) (390x844)
- `screenshots/audit3/extra/t2-damped.png` — 감쇠(초당 6회 초과) 타격 순간(.fx-float.damped 1개) (390x844)
- `screenshots/audit3/extra/x-1440x960-main.png` — PC 1440x960 중반(상자 45) (1440x960)
- `screenshots/audit3/extra/x-1440x960-move-ready.png` — PC 1440x960 이사 가능 상태(8,000만 P), 방 아래 이사 줄 (1440x960)
- `screenshots/audit3/extra/x-1280x880-main.png` — PC 1280x880 중반 (1280x880)
- `screenshots/audit3/extra/x-390-settings-mixed.png` — 설정 창, 효과음만 켜짐·나머지 꺼짐 (390x844)
- `screenshots/audit3/extra/x-390-gift-banner-2.png` — 사은품 2개일 때 `사은품 상자 도착!` 배너 + `1개 더 와요` 부제 (390x844)
- `screenshots/audit3/extra/x-1440-room-done-banner.png` — PC 1440x900 `방 완성!` 배너(탭 1.5초 뒤) (1440x900)
- `screenshots/audit3/extra/x-1440-bundle-banner.png` — PC 1440x900 `통신 결합 x1.5!` 배너(0.2초 뒤) (1440x900)
- `screenshots/audit3/extra/x-390-buy-flourish.png` — 구매 버튼 누른 직후 약 120ms의 반짝이 (390x844)

## card (tools/shots-card.cjs, DPR 1)

- `screenshots/audit3/card/m360-hint.png` — m360-hint (360x800)
- `screenshots/audit3/card/m360-services.png` — m360-services (360x800)
- `screenshots/audit3/card/m390-box.png` — m390-box (390x844)
- `screenshots/audit3/card/m390-new.png` — m390-new (390x844)
- `screenshots/audit3/card/m390-services.png` — m390-services (390x844)
- `screenshots/audit3/card/m390-tool.png` — m390-tool (390x844)
- `screenshots/audit3/card/pc1024-services.png` — pc1024-services (1024x768)
- `screenshots/audit3/card/pc1280-services.png` — pc1280-services (1280x820)
- `screenshots/audit3/card/pc1440-new.png` — pc1440-new (1440x900)
- `screenshots/audit3/card/pc1440-services.png` — pc1440-services (1440x900)

## unpack (모바일 390x844 스트립)

- `screenshots/audit3/unpack/after.png` — after (1590x1270)
- `screenshots/audit3/unpack/break.png` — break (1590x1270)
- `screenshots/audit3/unpack/care-idle.png` — care-idle (390x310)
- `screenshots/audit3/unpack/care.png` — care (1590x1270)
- `screenshots/audit3/unpack/dock.png` — dock (1590x954)
- `screenshots/audit3/unpack/done.png` — done (1590x1270)
- `screenshots/audit3/unpack/hit.png` — hit (1590x1270)
- `screenshots/audit3/unpack/place.png` — place (1590x1270)
- `screenshots/audit3/unpack/room-big.png` — room-big (1590x1270)
- `screenshots/audit3/unpack/room-care.png` — room-care (1590x1270)
- `screenshots/audit3/unpack/room-pile36.png` — room-pile36 (1590x954)
- `screenshots/audit3/unpack/room-pile76.png` — room-pile76 (1590x954)
- `screenshots/audit3/unpack/room-tierup.png` — room-tierup (1590x954)
- `screenshots/audit3/unpack/tierup.png` — tierup (1590x1270)

## unpack-pc (PC 1440x900 스트립)

- `screenshots/audit3/unpack-pc/big.png` — big (5790x2486)
- `screenshots/audit3/unpack-pc/care-idle.png` — care-idle (1440x614)
- `screenshots/audit3/unpack-pc/care.png` — care (5790x2486)
- `screenshots/audit3/unpack-pc/tierup.png` — tierup (5790x2486)

## fx (연출·드문 상태, tools/shots-fx2.cjs, ONLY=번호로 재촬영)

- `screenshots/audit3/fx/01-open-ten-0.5s.png` — 상자 10개 결과, 확인 버튼이 풀린 뒤 0.5초(입자 아직 떠 있음, 캔버스 입자 0.0~1.3초 뒤 0개)
- `screenshots/audit3/fx/01-open-ten-2s.png` — 같은 화면 2초 뒤(입자 없음)
- `screenshots/audit3/fx/01-open-ten-4s.png` — 같은 화면 4초 뒤(입자 없음)
- `screenshots/audit3/fx/02-myth-charge.png` — 신화 1개: 터지기 직전 상자(흔들림 끝, 틈새 빛)
- `screenshots/audit3/fx/02-myth-flash-a.png` — 신화: 터진 순간 전면 흰 면
- `screenshots/audit3/fx/02-myth-flash-b.png` — 신화: 터진 직후 열린 상자 + 입자
- `screenshots/audit3/fx/02-myth-reveal-a.png` — 신화: 카드가 내려앉는 중(0.45초 지점)
- `screenshots/audit3/fx/02-myth-reveal-b.png` — 신화: 카드 안착 직전(칩이 그림 틀에 가림)
- `screenshots/audit3/fx/02-myth-edge-c.png` — 신화: 카드 테두리 색 순환 중(노랑 단계)
- `screenshots/audit3/fx/02-myth-after.png` — 신화: 연출이 끝난 뒤 결과(7초)
- `screenshots/audit3/fx/02-legend-charge.png` — 전설 1개: 터지기 직전
- `screenshots/audit3/fx/02-legend-flash-a.png` — 전설: 터진 직후 열린 상자
- `screenshots/audit3/fx/02-legend-flash-b.png` — 전설: 전면 흰 면
- `screenshots/audit3/fx/02-legend-reveal-a.png` — 전설: 카드 내려앉는 중
- `screenshots/audit3/fx/02-legend-after.png` — 전설: 끝난 뒤 결과
- `screenshots/audit3/fx/03-move-390-truck.png` — 이사 트럭 장면(출발 글자, 먼지)
- `screenshots/audit3/fx/03-move-390-arrive-a.png` — 도착 직전 흰(크림) 면 1프레임
- `screenshots/audit3/fx/03-move-390-arrive-b.png` — 도착: 새 집 그림 + 집 이름(투룸)
- `screenshots/audit3/fx/03-move-390-result-before.png` — 결과 화면, 영구 배율 x1 표시(튀기 전)
- `screenshots/audit3/fx/03-move-390-mult-pop-a.png` — 배율이 x1에서 x2.5로 바뀌기 직전 프레임
- `screenshots/audit3/fx/03-move-390-mult-pop-b.png` — 배율이 바뀌는 순간의 흰 면
- `screenshots/audit3/fx/03-move-390-result-after.png` — 결과 화면 x2.5(튄 뒤)
- `screenshots/audit3/fx/03-move-1440-truck.png` — PC 1440 트럭 장면
- `screenshots/audit3/fx/03-move-1440-arrive-a.png` — PC 도착 직전 면
- `screenshots/audit3/fx/03-move-1440-arrive-b.png` — PC 도착: 집 그림 + 이름
- `screenshots/audit3/fx/03-move-1440-result-before.png` — PC 결과 x1
- `screenshots/audit3/fx/03-move-1440-mult-pop-a.png` — PC 배율 바뀌기 직전
- `screenshots/audit3/fx/03-move-1440-mult-pop-b.png` — PC 배율 바뀌는 순간 흰 면
- `screenshots/audit3/fx/03-move-1440-result-after.png` — PC 결과 x2.5
- (Enter 닫힘) — 결과 화면에서 Enter: 포커스가 새 집으로 버튼, 눌렀더니 장면이 닫힘(확인됨, 사진 없음)
- `screenshots/audit3/fx/04-tapchain-390-crit.png` — 초당 5회 2초 연타 직후 치명타 한 번 + 10연타 글자(390)
- `screenshots/audit3/fx/04-tapchain-390-after.png` — 0.25초 뒤
- `screenshots/audit3/fx/04-tapchain-1440-crit.png` — PC 같은 장면
- `screenshots/audit3/fx/04-tapchain-1440-after.png` — PC 0.25초 뒤
- `screenshots/audit3/fx/04-fever-390-start-toast.png` — 피버 찬 직후 피버! 배너 + 토스트 동시(390)
- `screenshots/audit3/fx/04-fever-390-active.png` — 피버 진행 중 0.5초 뒤
- `screenshots/audit3/fx/04-fever-1440-start-toast.png` — PC 피버! 배너 + 토스트 동시
- `screenshots/audit3/fx/04-fever-1440-active.png` — PC 피버 진행
- `screenshots/audit3/fx/05-fevergauge-1s.png` — 탭 멈춘 1초 뒤 게이지 칩 `피버 52%` 유지
- `screenshots/audit3/fx/05-fevergauge-2s.png` — 2초 뒤 칩 숨김
- `screenshots/audit3/fx/05-fevergauge-3s.png` — 3초 뒤 칩 숨김
- `screenshots/audit3/fx/06-tierup-gold-a.png` — 살림 단계 상승(은에서 금) 탭 0.12초 뒤: 상자 터지는 중
- `screenshots/audit3/fx/06-tierup-gold-b.png` — 0.24초 뒤
- `screenshots/audit3/fx/06-tierup-gold-c.png` — 0.36초 뒤
- `screenshots/audit3/fx/06-tierup-gold-d.png` — 0.48초 뒤
- `screenshots/audit3/fx/06-tierup-gold-e.png` — 0.65초 뒤: 냉장고 금빛 반짝
- `screenshots/audit3/fx/06-tierup-gold-f.png` — 0.9초 뒤: 흰 1프레임 + Lv 12 + 토스트
- `screenshots/audit3/fx/06-tierup-gold-g.png` — 1.4초 뒤: 사은품 상자 장면 시작
- `screenshots/audit3/fx/06-tierup-gold-h.png` — 3초 뒤: 사은품 상자 열리는 중
- `screenshots/audit3/fx/06-sparkle-192-0.png` ~ `06-sparkle-192-4.png` — 살림 전부 Lv 192 반짝 단계 연속 프레임 5장(방 확대 크롭, -5와 한 묶음)
- `screenshots/audit3/fx/06-sparkle-192-5.png` — 살림 전부 Lv 192 반짝 단계, 방 2배 확대 크롭(별 알갱이 입자 8개 떠 있는 순간)
- `screenshots/audit3/fx/06-emptyslots-box12-390.png` — 상자 12개째, 빈 살림 자리 점선(다음 칸 세탁기만 점선), 2배 확대 크롭
- `screenshots/audit3/fx/07-bundle-done-a.png` — 통신 결합 x1.5 완성 직후 0.15초(배너 + 카드 반짝)
- `screenshots/audit3/fx/07-bundle-done-b.png` — 0.45초
- `screenshots/audit3/fx/07-bundle-done-c.png` — 0.9초
- `screenshots/audit3/fx/07-bundle-done-d.png` — 1.5초(배너 아직 떠 있음)
- `screenshots/audit3/fx/07-bundle-done-dot.png` — 3.8초 뒤 알림 점이 결합 칩 모서리에 뜬 상태
- `screenshots/audit3/fx/07-bundle-after-dot.png` — 배너 끝난 뒤 결합 알림 점 + 카드의 x1.5 칩
- `screenshots/audit3/fx/07-bundle-opened.png` — 결합 줄 펼친 뒤
- `screenshots/audit3/fx/08-gifts-2-wait-1.5s.png` — 방 완성 + 단계 상승으로 사은품 2개 예약: 1.5초(방 완성! 배너와 토스트 겹침)
- `screenshots/audit3/fx/08-gifts-2-banner-2.4s.png` — 2.4초: `사은품 상자 도착!` 배너 + `1개 더 와요` 부제
- `screenshots/audit3/fx/08-gifts-2-first-3.9s.png` — 첫 사은품 상자 장면
- `screenshots/audit3/fx/08-gifts-2-after-first-6.5s.png` — 첫 번째 닫은 뒤, 두 번째 대기 중(표시 없음)
- `screenshots/audit3/fx/08-gifts-2-second-11s.png` — 두 번째 사은품 결과(탭 뒤 약 9초)
- `screenshots/audit3/fx/09-dex-detail-missing-390.png` — 도감 상세, 못 가진 변종(황금·무지개) 섞임 390
- `screenshots/audit3/fx/09-dex-detail-missing-1440.png` — 같은 상세 PC 1440
- `screenshots/audit3/fx/10-open-one-900.png` — (예약: 아래 참고)
- `screenshots/audit3/fx/10-open-one-1024.png` — PC 1024 한 개 결과(전설 황금)
- `screenshots/audit3/fx/10-open-one-1100.png` — PC 1100 한 개 결과
- `screenshots/audit3/fx/10-open-ten-900.png` — PC 900x800 10개 결과(버튼 아래 잘림)
- `screenshots/audit3/fx/10-open-ten-1024.png` — PC 1024x800 10개 결과
- `screenshots/audit3/fx/10-open-ten-1100.png` — PC 1100x800 10개 결과
- `screenshots/audit3/fx/11-newgame-firstbuy-1440.png` — 새 게임 PC, 첫 구매 가능(60 P) 0.7초 뒤
- `screenshots/audit3/fx/11-perk-pick-1440.png` — PC 특전 3택 창
- `screenshots/audit3/fx/11-quiz-question-390.png` — 퀴즈 질문 창(390)
- `screenshots/audit3/fx/11-quiz-answer-390.png` — 퀴즈 오답 해설 창(390)
- `screenshots/audit3/fx/12-reduced-main-390.png` — 움직임 줄이기 메인
- `screenshots/audit3/fx/12-reduced-open-one-myth-390.png` — 움직임 줄이기 신화 한 개 결과
- `screenshots/audit3/fx/12-reduced-move-result-390.png` — 움직임 줄이기 이사 결과
- 못 찍음: 없음(1~12 전부 촬영, 총 82장). 단 1번 노란 점은 사진이 아니라 입자 카운트로 확인(0~1.3초 뒤 0개). 8번은 사은품 2개 대기를 표시하는 UI가 없어 방 화면(08-gifts-2-after-first-6.5s)만 있음.
