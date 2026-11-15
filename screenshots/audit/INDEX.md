# 검수용 화면 묶음 색인 (2026-11-15 촬영, 개발 서버 localhost:5173, 격리 헤드리스 Aside)

## 못 찍은 장면 / 주의
- 트로피 창: 별도 "트로피" 창은 코드에 없다(`트로피|업적|trophy` 검색 결과 없음). 상단 트로피 아이콘 버튼은 특전 버튼(aria-label "특전")이고 눌러서 뜨는 창이 특전 창이다 -> `extra/m1-perk-list.png`, 폭별 `final/*-18-perk-list.png`.
- 새 게임 실제 클릭 진행: 110초 안에 실제로 열린 것은 "공구 강화" 하나뿐(경과 29초, `n03-unlock-1-real`). 결합·상자·도감·특전·이사·약정은 시드로 조건을 채워 열린 순간(토스트)을 찍었다(`n03-unlock-N-seeded-*`). "배율 내역" 열림 토스트는 따로 잡히지 않았고(다른 열림 토스트에 가려졌거나 조건이 늦게 충족), "영구 배율(badge)"은 코드상 규칙이 항상 false라 열리지 않는다.
- 피버 "진행 중" 장면은 `f3-*`(탭 직후)와 `final/*-22-fever`(390·360·430·1024·1440)로 찍혔다.
- 방 완성 3.5초 장면(`extra/r2-roomdone-3_5s.png`)은 사은품 상자 연출 화면이 방을 덮고 있어 토스트 "이제 살림을 손질해요"가 화면에 보이지 않는다(토스트 텍스트는 그 시각 DOM에 존재). 의도한 장면인지 검수자가 확인할 것.
- `unpack/` 의 care·tierup 는 u5 장면(살림 손질), `room-*.png` 는 `ONLY=room SCENE=...` 장면. 파일 이름이 겹쳐 `room-` 접두사로 바꿨다. `unpack-pc/` 는 PC 1440x900 (care, big), 이미지 폭이 큰 것은 프레임 여러 장을 가로로 이은 스트립이라서.
- 동시에 다른 에이전트가 수치를 조정 중이라 화면의 숫자는 촬영 시각 기준이다.
- 넘침 검사(`final/overflow-report.txt`): 125화면, 넘침·촬영 실패 0건.

## extra (tools/shots-audit.cjs, 모바일 390x844 DPR 1, PC 표시한 것만)

- `screenshots/audit/extra/b1-odds.png` — 상자 탭 확률 화면(확률 펼침)
- `screenshots/audit/extra/b2-open-1.png` — 상자 탭에서 1개 열기 결과
- `screenshots/audit/extra/b3-open-10.png` — 상자 탭에서 10개 열기 결과
- `screenshots/audit/extra/b4-box-sets.png` — 상자 탭 세트 효과 영역
- `screenshots/audit/extra/b5-set-view.png` — "세트 보기"를 눌러 도감의 세트 효과로 이동한 화면
- `screenshots/audit/extra/b6-dex-tab.png` — 도감 탭(가득 찬 도감) 390x844
- `screenshots/audit/extra/b7-dex-detail.png` — 도감 칸 상세
- `screenshots/audit/extra/c-m-gold-lv12.png` — 살림 8칸 모두 Lv 12 390x844
- `screenshots/audit/extra/c-m-mixed.png` — 살림 8칸 섞임 1/3/12/48/192/5/20/2 390x844
- `screenshots/audit/extra/c-m-rainbow-lv48.png` — 살림 8칸 모두 Lv 48 390x844
- `screenshots/audit/extra/c-m-silver-lv3.png` — 살림 8칸 모두 Lv 3 390x844
- `screenshots/audit/extra/c-m-sparkle-lv192.png` — 살림 8칸 모두 Lv 192 390x844
- `screenshots/audit/extra/c-pc-gold-lv12.png` — 살림 8칸 모두 Lv 12 1440x900
- `screenshots/audit/extra/c-pc-mixed.png` — 살림 8칸 섞임 1/3/12/48/192/5/20/2 1440x900
- `screenshots/audit/extra/c-pc-rainbow-lv48.png` — 살림 8칸 모두 Lv 48 1440x900
- `screenshots/audit/extra/c-pc-silver-lv3.png` — 살림 8칸 모두 Lv 3 1440x900
- `screenshots/audit/extra/c-pc-sparkle-lv192.png` — 살림 8칸 모두 Lv 192 1440x900
- `screenshots/audit/extra/f1-m-gauge50.png` — 피버 게이지 약 50%(피버 전) 390x844
- `screenshots/audit/extra/f1-pc-gauge50.png` — 피버 게이지 약 50%(피버 전) 1440x900
- `screenshots/audit/extra/f2-m-start.png` — 피버 시작 순간(피버! 글자) 390x844
- `screenshots/audit/extra/f2-pc-start.png` — 피버 시작 순간(피버! 글자) 1440x900
- `screenshots/audit/extra/f3-m-active.png` — 피버 진행 중(탭 직후) 390x844
- `screenshots/audit/extra/f3-pc-active.png` — 피버 진행 중(탭 직후) 1440x900
- `screenshots/audit/extra/h1-oneroom.png` — 집 방 화면: 원룸(moves=0) 390x844
- `screenshots/audit/extra/h2-tworoom.png` — 집 방 화면: 투룸(moves=1) 390x844
- `screenshots/audit/extra/h3-apt.png` — 집 방 화면: 아파트(moves=2) 390x844
- `screenshots/audit/extra/h4-penthouse.png` — 집 방 화면: 펜트하우스(moves=3) 390x844
- `screenshots/audit/extra/h5-moon.png` — 집 방 화면: 달 기지(moves=4) 390x844
- `screenshots/audit/extra/k1-contract-sheet.png` — 약정 창(종류 3택)
- `screenshots/audit/extra/k2-contract-card.png` — 약정 중 카드(남은 시간 표시, 서비스 0·1)
- `screenshots/audit/extra/k3-penalty-confirm.png` — 약정 중 이사 누름 -> 위약금 확인 창
- `screenshots/audit/extra/k4-bundle-open.png` — 결합 줄 펼침(처음 aria-expanded=true)
- `screenshots/audit/extra/k5-bundle-closed.png` — 결합 줄 접힘(비교용)
- `screenshots/audit/extra/m1-perk-list.png` — 특전 창(보유 특전 목록)
- `screenshots/audit/extra/m10-event-alert.png` — 이벤트 알림(전화 울림, 아직 안 누름)
- `screenshots/audit/extra/m11-tap-popover.png` — 공구 강화 탭 "탭 1회" 줄 내역 팝오버(.mult-pop 보임=1)
- `screenshots/audit/extra/m2-house-table.png` — 집 단계 창
- `screenshots/audit/extra/m3-move-confirm.png` — 이사 확인 창
- `screenshots/audit/extra/m4-move-mid.png` — 이사 장면 중간 1장(1.1초)
- `screenshots/audit/extra/m5-after-move.png` — 이사 직후 방(투룸)
- `screenshots/audit/extra/m6-settings.png` — 설정 창
- `screenshots/audit/extra/m7-info-mult.png` — 위쪽 i 상세(배율 내역 팝오버)
- `screenshots/audit/extra/m9-offline.png` — 오프라인 보상 창(3시간)
- `screenshots/audit/extra/n00-new-start.png` — 새 게임 시작(탭 전, 방+서비스 카드 2장, 잠긴 탭 자물쇠)
- `screenshots/audit/extra/n01-first-tap.png` — 첫 탭 직후
- `screenshots/audit/extra/n02-first-buy.png` — 첫 구매 직후
- `screenshots/audit/extra/n03-unlock-1-real.png` — 실제 진행으로 열림 토스트: 새로 열렸어요 · 공구 강화 (경과 29초)
- `screenshots/audit/extra/n03-unlock-2-seeded-bundle.png` — 시드로 건너뛰어 연 단계(bundle): 새로 열렸어요 · 결합
- `screenshots/audit/extra/n03-unlock-3-seeded-box.png` — 시드로 건너뛰어 연 단계(box): 새로 열렸어요 · 상자
- `screenshots/audit/extra/n03-unlock-4-seeded-dex.png` — 시드로 건너뛰어 연 단계(dex): 새로 열렸어요 · 도감
- `screenshots/audit/extra/n03-unlock-5-seeded-perk.png` — 시드로 건너뛰어 연 단계(perk): 새로 열렸어요 · 특전
- `screenshots/audit/extra/n03-unlock-6-seeded-move.png` — 시드로 건너뛰어 연 단계(move): 새로 열렸어요 · 이사
- `screenshots/audit/extra/n03-unlock-7-seeded-contract.png` — 시드로 건너뛰어 연 단계(contract): 새로 열렸어요 · 약정
- `screenshots/audit/extra/p01-new.png` — PC 1440x900 새 게임
- `screenshots/audit/extra/p02-mid.png` — PC 1440x900 중반
- `screenshots/audit/extra/p03-tool-tab.png` — PC 1440x900 공구 강화 탭
- `screenshots/audit/extra/p04-box-tab.png` — PC 1440x900 상자 탭
- `screenshots/audit/extra/p05-dex-tab.png` — PC 1440x900 도감 탭
- `screenshots/audit/extra/p06-contract-modal.png` — PC 1440x900 약정 창
- `screenshots/audit/extra/p07-mid-1280x720.png` — PC 1280x720 중반
- `screenshots/audit/extra/p08-mid-1024x768.png` — PC 1024x768 중반
- `screenshots/audit/extra/r1-roomdone-1s.png` — 방 완성 1.3초 뒤(토스트: 원룸 정리 끝. 사은품 상자를 받았어요)
- `screenshots/audit/extra/r2-roomdone-3_5s.png` — 방 완성(80번째 상자) 이후 3.5초(토스트: 이제 살림을 손질해요)
- `screenshots/audit/extra/r3-free-box-result.png` — 방 완성 무료 사은품 상자가 열린 결과 화면
- `screenshots/audit/extra/r4-tierup-toast.png` — 단계 상승 직후 토스트 보이는 순간(토스트: 냉장고가 은빛이 됐어요)
- `screenshots/audit/extra/r5-tierup-free-box.png` — 단계 상승 무료 사은품 결과 화면
- `screenshots/audit/extra/t1-crit.png` — 치명타 타격 순간(.fx-float.crit 1개)
- `screenshots/audit/extra/t2-damped.png` — 감쇠(초당 6회 초과) 타격 순간(.fx-float.damped 1개)

## unpack (tools/shots-unpack.cjs 스트립, 모바일 390x844 DPR 1 — 여러 프레임을 가로로 이은 연속 장면)

- `screenshots/audit/unpack/after.png` — 방 완성 뒤 연속 탭 4회
- `screenshots/audit/unpack/break.png` — 22번째 보통 상자 터지는 타
- `screenshots/audit/unpack/care-idle.png` — 살림 8칸 정지 화면(Lv 1/3/12/48/192/5/20/2)
- `screenshots/audit/unpack/care.png` — 살림 손질 큰 상자 터짐(레벨 상승)
- `screenshots/audit/unpack/dock.png` — 독 도구 버튼으로 치기
- `screenshots/audit/unpack/done.png` — 80번째 상자 터짐(방 완성)
- `screenshots/audit/unpack/hit.png` — 20번째 작은 상자 평범한 1타
- `screenshots/audit/unpack/place.png` — 10번째 큰 상자(냉장고) 터져 살림이 놓임
- `screenshots/audit/unpack/room-big.png` — 큰 상자 연타
- `screenshots/audit/unpack/room-care.png` — 방 장면 care
- `screenshots/audit/unpack/room-pile36.png` — 상자 더미 36번째
- `screenshots/audit/unpack/room-pile76.png` — 상자 더미 76번째
- `screenshots/audit/unpack/room-tierup.png` — 방 장면 tierup
- `screenshots/audit/unpack/tierup.png` — 손질로 단계 상승

## card (tools/shots-card.cjs 등)

- `screenshots/audit/card/m360-hint.png`
- `screenshots/audit/card/m360-services.png`
- `screenshots/audit/card/m390-box.png`
- `screenshots/audit/card/m390-new.png`
- `screenshots/audit/card/m390-services.png`
- `screenshots/audit/card/m390-tool.png`
- `screenshots/audit/card/pc1024-services.png`
- `screenshots/audit/card/pc1280-services.png`
- `screenshots/audit/card/pc1440-new.png`
- `screenshots/audit/card/pc1440-services.png`

## unpack-pc (tools/shots-card.cjs 등)

- `screenshots/audit/unpack-pc/big.png`
- `screenshots/audit/unpack-pc/care.png`

## final (tools/shots-final.cjs, 폭별: 390·360·430 = 모바일 DPR 2(원본 2배 크기 780/720/860 px 폭), 1024·1440 = PC DPR 1). 화면 번호는 폭 공통


### 폭 390 (25장)

- `screenshots/final/390-01-main-early.png` — 새 게임 초반
- `screenshots/final/390-02-main-mid.png` — 중반(서비스 4종, 상자 45)
- `screenshots/final/390-03-service-end.png` — 서비스 8종 끝까지 스크롤
- `screenshots/final/390-04-tool-tab.png` — 공구 강화 탭
- `screenshots/final/390-05-box-tab.png` — 상자 탭
- `screenshots/final/390-06-open-single.png` — 상자 1개 열기 결과
- `screenshots/final/390-07-open-ten.png` — 상자 10개 열기 결과
- `screenshots/final/390-08-dex-some.png` — 도감 일부
- `screenshots/final/390-09-dex-all.png` — 도감 가득
- `screenshots/final/390-10-dex-detail.png` — 도감 칸 상세(황금)
- `screenshots/final/390-11-settings.png` — 설정 창
- `screenshots/final/390-12-house-step.png` — 집 단계 창
- `screenshots/final/390-13-move-confirm.png` — 이사 확인 창
- `screenshots/final/390-14-move-mid.png` — 이사 장면 중간
- `screenshots/final/390-15-move-end.png` — 이사 장면 끝(결과 카드)
- `screenshots/final/390-16-contract-sheet.png` — 약정 창
- `screenshots/final/390-17-perk-pick.png` — 특전 3택
- `screenshots/final/390-18-perk-list.png` — 특전 목록 창
- `screenshots/final/390-19-offline.png` — 오프라인 보상 창(3시간)
- `screenshots/final/390-20-event-question.png` — 이벤트 질문
- `screenshots/final/390-21-event-result.png` — 이벤트 결과
- `screenshots/final/390-22-fever.png` — 피버 진행 중
- `screenshots/final/390-23-room-done.png` — 방 완성 뒤(상자 85, 손질 단계)
- `screenshots/final/390-24-house-night.png` — 펜트하우스 방(moves=3)
- `screenshots/final/390-25-house-edge.png` — 우주 끝 신도시 방(moves=8)

### 폭 360 (25장)

- `screenshots/final/360-01-main-early.png` — 새 게임 초반
- `screenshots/final/360-02-main-mid.png` — 중반(서비스 4종, 상자 45)
- `screenshots/final/360-03-service-end.png` — 서비스 8종 끝까지 스크롤
- `screenshots/final/360-04-tool-tab.png` — 공구 강화 탭
- `screenshots/final/360-05-box-tab.png` — 상자 탭
- `screenshots/final/360-06-open-single.png` — 상자 1개 열기 결과
- `screenshots/final/360-07-open-ten.png` — 상자 10개 열기 결과
- `screenshots/final/360-08-dex-some.png` — 도감 일부
- `screenshots/final/360-09-dex-all.png` — 도감 가득
- `screenshots/final/360-10-dex-detail.png` — 도감 칸 상세(황금)
- `screenshots/final/360-11-settings.png` — 설정 창
- `screenshots/final/360-12-house-step.png` — 집 단계 창
- `screenshots/final/360-13-move-confirm.png` — 이사 확인 창
- `screenshots/final/360-14-move-mid.png` — 이사 장면 중간
- `screenshots/final/360-15-move-end.png` — 이사 장면 끝(결과 카드)
- `screenshots/final/360-16-contract-sheet.png` — 약정 창
- `screenshots/final/360-17-perk-pick.png` — 특전 3택
- `screenshots/final/360-18-perk-list.png` — 특전 목록 창
- `screenshots/final/360-19-offline.png` — 오프라인 보상 창(3시간)
- `screenshots/final/360-20-event-question.png` — 이벤트 질문
- `screenshots/final/360-21-event-result.png` — 이벤트 결과
- `screenshots/final/360-22-fever.png` — 피버 진행 중
- `screenshots/final/360-23-room-done.png` — 방 완성 뒤(상자 85, 손질 단계)
- `screenshots/final/360-24-house-night.png` — 펜트하우스 방(moves=3)
- `screenshots/final/360-25-house-edge.png` — 우주 끝 신도시 방(moves=8)

### 폭 430 (25장)

- `screenshots/final/430-01-main-early.png` — 새 게임 초반
- `screenshots/final/430-02-main-mid.png` — 중반(서비스 4종, 상자 45)
- `screenshots/final/430-03-service-end.png` — 서비스 8종 끝까지 스크롤
- `screenshots/final/430-04-tool-tab.png` — 공구 강화 탭
- `screenshots/final/430-05-box-tab.png` — 상자 탭
- `screenshots/final/430-06-open-single.png` — 상자 1개 열기 결과
- `screenshots/final/430-07-open-ten.png` — 상자 10개 열기 결과
- `screenshots/final/430-08-dex-some.png` — 도감 일부
- `screenshots/final/430-09-dex-all.png` — 도감 가득
- `screenshots/final/430-10-dex-detail.png` — 도감 칸 상세(황금)
- `screenshots/final/430-11-settings.png` — 설정 창
- `screenshots/final/430-12-house-step.png` — 집 단계 창
- `screenshots/final/430-13-move-confirm.png` — 이사 확인 창
- `screenshots/final/430-14-move-mid.png` — 이사 장면 중간
- `screenshots/final/430-15-move-end.png` — 이사 장면 끝(결과 카드)
- `screenshots/final/430-16-contract-sheet.png` — 약정 창
- `screenshots/final/430-17-perk-pick.png` — 특전 3택
- `screenshots/final/430-18-perk-list.png` — 특전 목록 창
- `screenshots/final/430-19-offline.png` — 오프라인 보상 창(3시간)
- `screenshots/final/430-20-event-question.png` — 이벤트 질문
- `screenshots/final/430-21-event-result.png` — 이벤트 결과
- `screenshots/final/430-22-fever.png` — 피버 진행 중
- `screenshots/final/430-23-room-done.png` — 방 완성 뒤(상자 85, 손질 단계)
- `screenshots/final/430-24-house-night.png` — 펜트하우스 방(moves=3)
- `screenshots/final/430-25-house-edge.png` — 우주 끝 신도시 방(moves=8)

### 폭 1024 (25장)

- `screenshots/final/1024-01-main-early.png` — 새 게임 초반
- `screenshots/final/1024-02-main-mid.png` — 중반(서비스 4종, 상자 45)
- `screenshots/final/1024-03-service-end.png` — 서비스 8종 끝까지 스크롤
- `screenshots/final/1024-04-tool-tab.png` — 공구 강화 탭
- `screenshots/final/1024-05-box-tab.png` — 상자 탭
- `screenshots/final/1024-06-open-single.png` — 상자 1개 열기 결과
- `screenshots/final/1024-07-open-ten.png` — 상자 10개 열기 결과
- `screenshots/final/1024-08-dex-some.png` — 도감 일부
- `screenshots/final/1024-09-dex-all.png` — 도감 가득
- `screenshots/final/1024-10-dex-detail.png` — 도감 칸 상세(황금)
- `screenshots/final/1024-11-settings.png` — 설정 창
- `screenshots/final/1024-12-house-step.png` — 집 단계 창
- `screenshots/final/1024-13-move-confirm.png` — 이사 확인 창
- `screenshots/final/1024-14-move-mid.png` — 이사 장면 중간
- `screenshots/final/1024-15-move-end.png` — 이사 장면 끝(결과 카드)
- `screenshots/final/1024-16-contract-sheet.png` — 약정 창
- `screenshots/final/1024-17-perk-pick.png` — 특전 3택
- `screenshots/final/1024-18-perk-list.png` — 특전 목록 창
- `screenshots/final/1024-19-offline.png` — 오프라인 보상 창(3시간)
- `screenshots/final/1024-20-event-question.png` — 이벤트 질문
- `screenshots/final/1024-21-event-result.png` — 이벤트 결과
- `screenshots/final/1024-22-fever.png` — 피버 진행 중
- `screenshots/final/1024-23-room-done.png` — 방 완성 뒤(상자 85, 손질 단계)
- `screenshots/final/1024-24-house-night.png` — 펜트하우스 방(moves=3)
- `screenshots/final/1024-25-house-edge.png` — 우주 끝 신도시 방(moves=8)

### 폭 1440 (25장)

- `screenshots/final/1440-01-main-early.png` — 새 게임 초반
- `screenshots/final/1440-02-main-mid.png` — 중반(서비스 4종, 상자 45)
- `screenshots/final/1440-03-service-end.png` — 서비스 8종 끝까지 스크롤
- `screenshots/final/1440-04-tool-tab.png` — 공구 강화 탭
- `screenshots/final/1440-05-box-tab.png` — 상자 탭
- `screenshots/final/1440-06-open-single.png` — 상자 1개 열기 결과
- `screenshots/final/1440-07-open-ten.png` — 상자 10개 열기 결과
- `screenshots/final/1440-08-dex-some.png` — 도감 일부
- `screenshots/final/1440-09-dex-all.png` — 도감 가득
- `screenshots/final/1440-10-dex-detail.png` — 도감 칸 상세(황금)
- `screenshots/final/1440-11-settings.png` — 설정 창
- `screenshots/final/1440-12-house-step.png` — 집 단계 창
- `screenshots/final/1440-13-move-confirm.png` — 이사 확인 창
- `screenshots/final/1440-14-move-mid.png` — 이사 장면 중간
- `screenshots/final/1440-15-move-end.png` — 이사 장면 끝(결과 카드)
- `screenshots/final/1440-16-contract-sheet.png` — 약정 창
- `screenshots/final/1440-17-perk-pick.png` — 특전 3택
- `screenshots/final/1440-18-perk-list.png` — 특전 목록 창
- `screenshots/final/1440-19-offline.png` — 오프라인 보상 창(3시간)
- `screenshots/final/1440-20-event-question.png` — 이벤트 질문
- `screenshots/final/1440-21-event-result.png` — 이벤트 결과
- `screenshots/final/1440-22-fever.png` — 피버 진행 중
- `screenshots/final/1440-23-room-done.png` — 방 완성 뒤(상자 85, 손질 단계)
- `screenshots/final/1440-24-house-night.png` — 펜트하우스 방(moves=3)
- `screenshots/final/1440-25-house-edge.png` — 우주 끝 신도시 방(moves=8)
- `screenshots/final/overflow-report.txt` — 화면마다 넘침 검사 결과

### final/ 폭 무관 파일 (모바일 390 DPR 2)
- `screenshots/final/fx-crit.png` / `fx-boom.png` / `fx-fever.png` / `fx-ten.png` / `fx-move.png` — tools/shots-fx.cjs 이펙트 프레임 5장(치명타·상자 터짐·피버·10개 열기·이사). 이번에 재촬영.
- `screenshots/final/390dpr1-*.png` (25장) — 이전 실행의 DPR 1 사본. 이번에 재촬영하지 않은 묵은 파일이라 검수 대상에서 제외하는 것을 권장.
