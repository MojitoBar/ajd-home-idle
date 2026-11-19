# 상자깡 루프 개편 설계 (서비스 제거 · 공구 강화 다양화 · 살림/도감 배율 확대)

구현 완료(2026-11-17). 설계와 달라진 점:
- 이사 목표는 잠정값(3e7·2e8·3e9·1e11·8e11)이 아니라 `data/houses.ts`의 3.7e15·9e16·3e19·1.15e21·2e22 등으로 확정(`tools/box-sim.mjs`로 조정). 그 뒤 x8은 설계대로.
- 안전모 실드는 "게이지 옆"이 아니라 연속 배수 칩 오른쪽 가로 한 줄(방 왼쪽 위)에 8x6 도트 작은 안전모(`hardhat-s`, 2배 표시)로 나오고, 칸 아래 얇은 충전 막대가 따로 있다.
- 손목 단련 특전은 +110%/Lv(`data/perks.ts`)이다.
- 시뮬 도구는 `tools/box-sim.mjs`(공구 5종·실드·급소 반영), 스모크는 `smoke.cjs`·`smoke-pc.cjs`를 새로 썼다.

기준 코드: 커밋 `4cb4346` 이후 미커밋 트리(2026-11-17). 표기: [사실]은 코드로 확인한 것, [제안]은 설계안이다.
구현 에이전트는 9절의 자기 단계와, 그 단계가 가리키는 절만 읽는다.

## 1. 서비스의 현재 역할 [사실]
| 영역 | 근거 | 내용 |
|---|---|---|
| 데이터 | `src/data/services.ts:10-19` | 서비스 8종(baseCost·1.15배·baseProd). 같은 파일에 `TAP_*`·`STRIKE_*`·`PERMANENT_MULT_PER_MOVE`·`TAP_BOX_SCALE`·`TAPS_PER_SEC_*`가 같이 들어 있음 |
| 자동 수입 | `economy.ts:81-100` `pps`·`ppsNoContract`·`ppsStable` | 초당 수익은 서비스에서만 나옴. `tick`(`economy.ts:261`)이 `ppsNoContract × dt`를 더함 |
| 탭 수익 | `economy.ts:209` `tapBreakdown` | 탭 = 기본값 몫(`tapBase × 영구 × 도감`) + `tapRatio(L) × ppsStable`. 서비스가 없으면 비율 몫은 0이고 감쇠 탭(`damped`)은 기본값 몫만 받음 |
| 상자 가격 | `gacha.ts:27-30` | `max(5000, 60 × ppsStable) × 1.06^n × 할인` |
| 택배 | `variety.ts:68` | `max(pps × 초, tapFlat × 50)` |
| 오프라인 | `offline.ts:54-74` | `ppsNoContract × 경과(상한 8h) × 0.5` + 약정. 특전 `offline_rate`·`offline_cap`, 에픽 세트 `offlineMult` |
| 결합 | `bundle.ts`, `data/bundles.ts` | 서비스 묶음 레벨에 따라 x1.5~x4 |
| 약정 | `contract.ts`, `data/contracts.ts`, `prestige.ts:13-44` | 약정 x1.5~x3, 위약금이 이사 조건(`moveStatus.reason==='penalty'`) |
| 이사 | `prestige.ts:51` `move` | `services`·`contracts` 초기화. 이사 조건 자체는 `earned ≥ target`(`prestige.ts:33`) |
| 특전 | `data/perks.ts` | 12종 중 6종이 서비스·방치 전용(`svc_power`·`bundle_boost`·`contract_slot`·`penalty_cut`·`offline_rate`·`offline_cap`) |
| 도감 세트 | `data/collectibles.ts:79` | 레어 세트 `serviceMult`, 에픽 세트 `offlineMult`는 대상이 사라짐 |
| 공개 | `unlock.ts:11,50-58` | `bundle`(서비스 3종)·`contract`·`mult`(결합·약정 포함)·`box` 규칙이 서비스·`boxPrice`를 봄. 새 게임에서는 서비스 탭만 열려 있음 |
| 퀴즈 이벤트 | `event.ts`, `eventUi.ts`, `state.event` | 요금제(A 고정형/B 할인형) 비교 퀴즈, 맞히면 x3 120초. `globalMult`에 `eventMult`. `initUnpack`이 `eventCall`을 받음(`unpackUi.ts:238,274`) |
| 화면 | `app.ts:84-88,353-369,461-489,983,1057,1126-1170` | 탭 `services`가 기본값이자 대체 탭, 수량 칩 `seg`(x1/x10/MAX), 첫 구매 말풍선(`firstBuyHinted`). 히어로는 `pps`를 Mbps·`speedTitle`(회선 등급 배너)로 보여 주고, 독은 "+N/초" |
| 선반 | `data/rooms.ts:21-22,72-98`, `unpackUi.ts:335` | 산 서비스 아이콘 8칸(`svc-*.png`). `rooms.test.ts:8-9`가 `SERVICES.length`와 칸 수를 맞춰 봄 |
| 전략 UI | `strategyUi.ts`(약 620줄) | 결합 줄·약정 칸 알약(`topBar`), 카드 약정 버튼, 약정 시트, 이사 위약금 문구, 특전 창, 배율 내역 팝오버(`toggleMult`) |
| 테스트 | `src/logic/*.test.ts` | 전부 서비스용: `strategy`(230줄)·`penalty`(250)·`event`(157). 일부 고침: `economy`·`offline`·`prestige`·`save`·`unlock`·`gacha`·`collection`·`variety`, `data/rooms.test` |
| 도구 | `tools/sim.mjs`(251줄), `unlock-pace.mjs`, `smoke.cjs`(985줄 중 약 110줄, SEED 7행), `smoke-pc.cjs`(32·93·116·150-156행) | `sim.mjs`는 src를 부르지 않는 상수 복사본이고 서비스·결합·약정이 핵심. 강타·연쇄는 반영하지 않음 |

추가 사실: 살림 레벨 `homeLv`는 **수익 효과가 0**이다. 손질 칸 선택(`unpack.ts:108`), 단계 사은품(`unpack.ts:240-250`), 그림 단계(`unpackUi.ts:49,399-436`)에만 쓰인다. 도감은 20종 × 변이 4 = 80칸이고, 현재 최대치는 C ≈ 1 + 0.67 × 15 × 3 ≈ 31이다.

## 2. 서비스를 뺀 뒤의 구조 [제안]
- **2.1 자동 수입·오프라인**: 삭제한다. `pps`·`tick` 수익·오프라인 정산을 없애고, **돌아오면 러시**를 준다. 30분 넘게 비웠다가 오면 `unpack.rushSec`을 `RETURN_RUSH_SEC`(15)까지 채운다(이미 더 많으면 그대로)(시계 상자 자동 연타를 그대로 씀). 이유: 살림이 초당 수익을 내면 서비스를 다시 만드는 셈이고, 손맛 루프로 돌아오게 만든다. 대안: 살림 레벨 합에 비례한 소액 오프라인 P. 방치형 정체성이 걸린 결정이라 질문 1로 남긴다.
- **2.2 포인트 소비처**: 공구 강화(3절)가 주 소비처다. 무한 축(공구·오함마)은 이번 집 안에서 쓰고, 상한 축은 영구다. 상한 축 비용은 현재 집 목표에 비례하므로, 이사 직전에 남은 P를 영구 공구에 쓰는 선택이 생긴다. 상자(뽑기)는 두 번째 소비처다. 이사 조건은 `earned`이므로 P를 써도 이사가 늦어지지 않는다(`prestige.ts:34`).
- **2.3 이사**: 조건은 `earned ≥ target` 하나만 남는다(위약금 삭제, `MoveStatus.reason`은 `'target' | null`). 보상은 영구 배율 `1+1.5×이사`, 특전 3택, 살림·도감·영구 공구 유지다. 목표 수치는 5절에서 다시 잡는다.
- **2.4 선반**: 공구 선반으로 쓴다. 7칸(3절 순서)에 Lv 1 이상인 공구 아이콘을 건다. 첫 칸은 지금 단계 공구(`toolOf`, 그림 `tool/*.png`)이고, 산 순간 톡 내려앉는 연출(`unpackUi.ts:354`)은 그대로 쓴다. 대안: 비우기(그림 0장이지만 방 윗부분이 허전함).
- **2.5 탭 구성**: 왼쪽은 `공구`(기본 탭, 항상 열림, 대체 탭)와 `살림`(새 탭, 첫 큰 상자부터 열림), 오른쪽은 `상자`와 `도감`이다. 2+2 배치와 키 1~4를 그대로 쓴다. PC 오른쪽 단은 같은 패널을 쓰고, `strat.topBar`와 `seg`는 삭제한다. 살림 탭에는 8칸의 Lv·단계·칸 기여, 살림 배율 합, 다음 계단까지 남은 레벨을 둔다(그림은 기존 `item/*`).
- **2.6 결합·약정·퀴즈**: 모두 삭제한다. 퀴즈는 요금제 비교라 서비스 맥락에 붙어 있고 상자 루프를 끊는다. x3 시간 버프는 피버가 이미 맡고 있다.
- **2.7 히어로·독**: Mbps와 회선 등급을 **총 배율 x N**(영구 × 살림 × 도감 × 탭 특전) 롤러로 바꾼다. 2배 계단을 넘을 때마다 기존 등급 배너(`app.ts:1018-1023`)를 "배율 x16 돌파!"로 다시 쓴다. "+N/초"는 화면에서 잰 최근 5초 실제 수익(earned 차이 이동평균)으로 바꾼다.
- **2.8 특전**: 죽는 6종을 지우고 2종을 더한다. `home_boost`(살림 배율 +25%, 최대 4), `dex_boost`(도감 배율 +25%, 최대 4). 남는 풀은 8종이라 3택이 유지된다.
- **2.9 저장 v8 → v9 (`MIGRATIONS[8]`, 원본 raw에서 계산)**. 단계별로 같은 함수에 덧붙인다.
  - 3단계: 버전 올림, 서비스 보상, 수치 정리, `services`·`contracts` 삭제, `notice`
  - 4단계: 죽은 특전 처리, `event` 삭제
  - 5단계: `gear`
  - 서비스 보상: `n = min(30, floor(Σservices / 25))`개의 무료 상자를 도감에 넣는다(`seededRng(moves×7919+9)` + `rollBox`, 결정적).
  - 죽은 특전: 레벨 1마다 `perkOffers`에 3택 묶음을 1개 더한다(`rollPerkOffer` 시드 고정). 기존 묶음에서는 죽은 id를 빼고, 3개가 안 되면 다시 뽑는다.
  - 수치 정리: `points = min(points, 새 목표 × 0.3)`, `earned = min(earned, 새 목표)`. 예전 큰 P로 새 비용 체계를 단번에 뚫지 않게 하려는 것이다.
  - 필드: `services`·`contracts`·`event` 삭제, `gear: {}` 추가, `notice: 'v9'`를 둔다. 화면이 안내 창("서비스가 공구·살림으로 바뀌었어요 · 선물 상자 N개")을 한 번 띄운 뒤 지운다.
  - 예전 `MIGRATIONS[2]`·`[3]`이 `contractPenaltyBase` 등을 부른다(`save.ts:2-5`). 버전만 올리는 통과 함수로 줄인다.
  - `UNLOCK_IDS`에서 `bundle`·`contract`·`tap`을 빼고 `home`을 더한다.

## 3. 공구 강화 베리에이션 [제안]
새 파일은 `src/data/gear.ts`(정의)와 `src/logic/gear.ts`(`gearCost`·`buyGear`·`gearEffects`·실드)다. 저장 필드 `gear: Record<GearId, number>`는 영구이고 이사해도 남는다. 기존 `tapLevel`·`strikeLevel`은 그대로 둔다.
상한 축 비용: `cost = houseInfo(moves).target × frac × 2.2^lv`. Lv1은 목표의 2%, Lv5는 약 47%다.

| # | 이름 | 효과 식 | 상한 | 비용 | 이사 | 해금 | 체감 연출 |
|---|---|---|---|---|---|---|---|
| 1 | 공구(기존 `tapLevel`, 이름은 `toolOf`) | `tapBase(L)=(1+L)×2^마일스톤`. 마일스톤을 10·25·50·100에서 **150·200·300·400까지 늘림**(각 x2) | 무한 | `20×1.25^L`(기존) | 초기화 | 처음부터 | 기존 카드, 단계마다 공구 그림이 바뀜 |
| 2 | 오함마(기존 `strikeLevel`, 이름만 바꿈) | 강타·급소 탭 수 `×(1+0.2×lv)` | 무한 | `60×1.3^lv`(기존) | 초기화 | 처음부터 | 강타 숫자가 커짐 |
| 3 | 수평계 | 퍼펙트 반폭 `0.05 + 0.012×lv`(Lv5 0.11, 기본의 2.2배). 굿 폭은 그대로 | 5 | frac 0.02 | 유지 | 상자 15개 | 게이지의 노랑 퍼펙트 칸이 넓어짐. 산 순간 칸이 2px씩 늘어나는 4프레임 |
| 4 | 안전모(실드) | 퍼펙트가 아닌 판정에서 연속 퍼펙트를 1회 지킴(아래 규칙) | 3(칸 수 = lv) | frac 0.03 | 유지 | 상자 45개 | 게이지 옆 안전모 n개. 막는 순간 안전모가 튕겨 깨지고 주황 "연속 지킴! x3.5" + 쿵 소리 |
| 5 | 빠루 | 연쇄 보너스 상한 `CHAIN_BONUS_CAP 20 + 10×lv`(Lv5면 70번째에 x8) | 5 | frac 0.02 | 유지 | 상자 35개 | 연쇄 배율 숫자가 x3을 넘어 계속 오름 |
| 6 | 송곳 | 급소 탭 수 `8 + 4×lv`, 등장 간격 `×(1−0.08×lv)` | 5 | frac 0.015 | 유지 | 상자 55개 | 급소 명중 숫자가 커지고 더 자주 뜸 |
| 7 | 돋보기 | 특별 상자 확률 `5% + 1%×lv`(Lv5 10%) | 5 | frac 0.02 | 유지 | 상자 25개 | 대기 상자에 황금·폭탄·시계가 더 자주 보임 |

해금: 공구 탭 카드에 `moves > 0 || unpack.box ≥ unlockBox`인 것만 보인다(새 공개 id는 만들지 않음).
상한을 둔 이유: 수평계와 실드는 연속 길이를 늘리고, 그 길이가 상한 없는 `streakMult`(`charge.ts`)로 곱해진다. 그래서 무한 축은 직접 배율인 1·2번만 둔다.

**실드 규칙.** 저장하지 않는 런타임 값이고 연속 퍼펙트(streak)와 같다. 불러오기·이사 때 가득 찬다. 순수 함수는 `gear.ts`에 둔다.
```ts
export interface ShieldState { n: number; toNext: number }           // toNext 초기값 SHIELD_CHARGE_PERFECTS = 8
export function initialShield(max: number): ShieldState
export function resolveStreak(prev: number, grade: ChargeGrade, sh: ShieldState, max: number):
  { streak: number; shield: ShieldState; saved: boolean }
// perfect: streak = prev+1, toNext-1, 0이 되면 n = min(max, n+1)이고 toNext = 8
// 그 밖(good·miss): prev > 0 && n > 0이면 streak = prev(유지, +1 없음), n-1, saved = true. 아니면 streak = 0
// 보상은 실제 판정대로 준다(지켜도 굿은 굿 보상)
```
화면은 `releaseCharge` 결과의 `grade`로 `resolveStreak`를 불러 `chargeStreak`를 덮어쓴다. `charge.ts`의 `streak` 계산은 건드리지 않는다.

**코드 연결점.**
- `chargeZoneAt(center, half = 0.05)`와 `rollChargeZone(rng, prev?, half?)`에 반폭 인자를 더한다. `half ≤ 0.12`(굿 오른쪽 0.13 안쪽)로 자르고 `clamp01`은 그대로 둔다.
- `chainBonus(i, cap = CHAIN_BONUS_CAP)`: `hitChained`(`unpack.ts:276`)에서 `gearEffects(state).chainCap`을 넘긴다.
- `specialAt(salt, k, rate = SPECIAL_RATE)`는 `specialCandidate`까지 rate를 넘긴다. `boxSpecial`·`hitBox`·`unpackUi.ts:165`는 `gearEffects(state).specialRate`를 쓴다. 값을 올리면 앞으로 올 상자 배치가 달라지는데, 이는 받아들인다.
- `hitWeak`(`weak.ts:78`): `WEAK_REWARD.taps` 대신 `gearEffects(state).weakTaps`를 쓴다. 간격 배율은 `advanceWeak`의 `nextDelay`에 넘긴다.

## 4. 살림·도감 배율 [제안]
**4.1 살림 배율 H (새로 만듦)**
`H = (1 + 0.05 × Σ_칸 lv × 2^tierOf(lv)) × (1 + 0.25 × home_boost)`. 문턱은 기존 `tierOf`(3·12·48·192)를 그대로 쓴다.
- 단계가 오르는 순간(`care.tierUp`) 그 칸의 기여가 2배가 된다. 기존 단계 토스트와 사은품(`unpackUi.ts:467-495`)이 뜨는 순간과 겹치므로 "살림 x9.8 → x11.1" 숫자를 같이 띄운다.
- 예: 8칸 모두 Lv1이면 x1.4, 모두 Lv3이면 x3.4, 모두 Lv12면 x20, Lv48이면 x155, Lv192면 x1229.
- `tapValue`에만 곱하고 `unpackPower`(상자 피해)에는 곱하지 않는다. 상자 HP 균형을 지키기 위해서다.

**4.2 도감 C**
- 지금 [사실]: 칸 기여 `w등급 × w변이 × (1 + 0.5×(Lv−1))`, 등급 가중 0.01·0.02·0.04·0.08·0.16(`collectibles.ts:26`), 세트 효과는 탭 x1.5 / 서비스 x1.25 / 오프라인 x1.5 / 피버 +5초 / 치명 +2(`collectibles.ts:79`).
- 새 식: 등급 가중을 **5배**(0.05·0.1·0.2·0.4·0.8)로 올리고 칸 레벨 배수를 `2^(Lv−1)`(Lv5 x16)로 바꾼다. 세트는 **도감 배율 곱 x2·x2·x3·x3·x5**로 바꾼다. 전설·신화 세트는 피버 +5초·치명 +2도 그대로 유지한다. 마지막에 `×(1 + 0.25×dex_boost)`를 곱한다.
- 예: 첫 상자 10개는 지금 x1.16에서 x1.8이 된다. 일반 세트를 완성하면 x3.6. 20종 기본 Lv2에 세트 3개면 약 x100. 최대는 약 x1.4e5.
- 상자 가격: `max(5000, 900 × tapStable) × 1.06^n × 할인`. `tapStable`은 피버를 뺀 탭 1회 값이고, 약 30초분 수익이다.

**4.3 탭 식 (서비스 몫 삭제)**
- `tapValue = tapBase(L) × 영구 × C × H × 탭특전 × 피버 × 0.6`.
- 감쇠 탭은 이제 기본값 몫이 전부라 전액이 된다. 그래서 `× DAMPED_RATIO 0.3`을 따로 둔다.
- 택배 P는 `tapStable × 2.5 × 초(20~40)`로 바꾼다.

**4.4 진행 속도 대략 계산** (스크래치 파이썬, 같은 결론을 낼 새 시뮬은 9절 4단계)
- 가정:
  - 초당 탭 환산 30(일반 탭 + 상자 덩어리 + 강타 30% 비중 × 오함마)
  - 상자 0.6개/초, 큰 상자 10개마다 살림 +1
  - 탭·오함마를 싼 쪽부터 사고, C는 1.2로 고정
- 결과:

| 집 | 5분 누적 | 10분 누적 | 집을 떠날 때 H |
|---|---|---|---|
| 0 | 4e6 | 3e7 | 4.6 |
| 1 | 1.3e8 | 3.7e8 | 8.2 |
| 2 | 4.4e8 | 1.7e9 | 22.6 |
| 3 | - | 4.8e9 | 29.8 |

- 기존 목표(5.5e7, 4.6e8, **3e12**, 8e14, 8e15)는 서비스의 지수 성장에 맞춘 값이다. 아파트부터는 수백 배가 모자란다.
- 잠정 목표: 원룸 3e7, 투룸 2e8, 아파트 3e9, 펜트하우스 1e11, 달 기지 8e11. 그 뒤로는 x8(`MOVE_TARGET_GROWTH_AFTER` 40 → 8).
- 같은 모델로 이사별 시간을 재면 이렇다(아파트는 5e9 기준으로 잼).
  - 원룸 10.1분, 투룸 6.7분, 아파트 21.6분(3e9면 약 16분), 펜트하우스 70분, 달 기지 89분
  - 달 기지 도착 누적은 약 1.8시간
- 이 모델에는 뽑기 상자와 영구 공구가 빠져 있어 실제로는 더 빠르다. 3회차부터의 속도는 새 시뮬로 확정한다.
- 시간 예산(`sim.mjs` `CUR`·`CURMOON`, `DESIGN-UNPACK2.md:65`): 첫 이사 9.9분, 2회 6.6분, 3회 16분, 달 기지 누적 2.88시간(±20%).
- 새 시뮬 판정 기준: 첫 이사 8~12분, 2회 < 1회, 3회 12~22분, 달 기지 누적 1.5~2.9시간(지금 2.88시간과 비슷하거나 조금 빠르게). 이사별 상한은 두지 않는다.

## 5. pps 소비처 → 새 기준 [제안]
| 자리 | 새 기준 |
|---|---|
| `tapBreakdown.fromPps`, `tapRatio`, `TAP_RATIO_*` | 삭제. `tapBreakdown`은 `{flat, total}`만 남긴다(배율 팝오버용) |
| `boxPrice` | 4.2절 `tapStable` 기준 |
| `catchParcel` | 4.3절 |
| `tick` 수익, `applyOffline` | 수익 0. `applyOffline`은 `savedAt` 갱신과 돌아오면 러시(2.1절)만 한다 |
| 히어로 Mbps, `speedTitle`, `formatMbps` | 총 배율 롤러와 2배 계단 배너(2.7절) |
| 독·포인트 줄 "+N/초" | 최근 5초 실측 |
| `parcelUi.ts:48`, `app.ts:672-681,1153,1182-1187` | 서비스 줄은 삭제. 택배 문구는 받은 P만 보여 준다 |
| `unlock.ts` `mult` 규칙 | `collectionMult ≠ 1 ∥ perks ∥ homeMult ≠ 1` |
| `strategyUi.ts:535-620` 배율 내역 | 영구·살림·도감·세트·특전·피버 줄 |
| `tools/sim.mjs`, `unlock-pace.mjs` | 삭제하고 `tools/box-sim.mjs`(`ssrLoadModule`로 실제 로직 호출, `unpack-pace.mjs` 방식)로 바꾼다 |

## 6. 그림 수요 (최소)
- 공구 아이콘 24×24도트 5장: 수평계, 안전모, 빠루, 송곳, 돋보기(`public/assets/px/tool/level.png`·`hardhat.png`·`crowbar.png`·`awl.png`·`magnifier.png`).
  - 기존 `tool/*.png`와 같은 팔레트·외곽선 규칙을 따른다. Pillow로 기존 공구 그림을 팔레트 치환·합성하거나 Codex 생성 후 24색으로 줄인다.
  - 오함마는 기존 `perk-tap_crit_power`를 그대로 쓴다.
- 특전 아이콘 2장: `perk-home_boost`(`house-blue` 합성), `perk-dex_boost`(`ui-dex` 합성).
- 선반 폭 표 `SHELF_ICON_EXTENT`는 새 7칸 아이콘의 불투명 폭을 다시 재서 채운다(6단계).
- 그 밖에는 기존 그림(`item/*`, 단계 접미사, `box-*`)을 쓴다. 쓰지 않게 되는 `svc-*`·`bundle-*`·`contract`·`perk-(죽은 6종)`·`ui-event`는 8단계에서 지운다.

## 7. 지켜야 할 것
- 화풍: 1도트 = 2px, 24색, 글자 12·15·24·30·36·48px. 빨강은 위험·남은 시간에만 쓴다. 안전모가 깨지는 연출은 주황, 배율 계단은 노랑.
- 숫자: 실제 금액처럼 보이지 않게 P와 x배율만 쓴다. 유료 결제 없음.
- 동시 작업: 연속 퍼펙트 배수·게이지 가속·배수 칩(`charge.ts`·`chargeUi.ts`·`app.ts`) 작업이 **끝난 뒤** 1단계를 시작한다. 그 규칙은 바꾸지 않는다.

## 8. 테스트·스모크 규모
- 삭제: `strategy.test.ts`(230줄), `penalty.test.ts`(250), `event.test.ts`(157). 합 약 640줄.
- 고침: `economy.test`(220줄 중 서비스 몫 약 절반), `offline.test`(35, 다시 씀), `prestige.test`, `save.test`(154, v3·v4 약정 케이스는 v9 기준으로), `unlock.test`, `gacha.test`, `collection.test`, `variety.test`, `rooms.test`(선반 7칸). 약 300줄.
- 추가: `gear.test.ts`(비용·효과·실드 6~8케이스), `home.test`(H 계단), v9 migrate 케이스.
- `smoke.cjs`: SEED(7행)와 서비스·결합·약정·이벤트·수량 칩 검사 약 110줄을 지우고, 공구 카드·살림 탭·선반·실드 검사 약 60줄을 더한다. `smoke-pc.cjs`는 32·93·116·150-156행을 고친다.
- `shots-*.cjs` 일회성 스크립트 약 40개는 서비스를 참조하지만 고치지 않는다(낡음 표시만).

## 9. 작업 순서
각 단계는 순차 실행이다. 공통 완료 조건은 `npx tsc --noEmit`, `npx vitest run`, `npm run build` 통과다. 단계 밖 파일이 컴파일 때문에 깨지면 import 제거나 0 스텁 같은 최소 수정만 허용한다. 스모크는 8단계에서만 돌린다(그 전 단계에서는 깨져 있어도 된다). 긴 명령은 `timeout 590`으로 감싸고 출력은 `| tail -40`.

**A. 그림 (src 밖, 1~5단계와 병렬 가능)**: 6절 아이콘 7장을 새 파일로만 추가한다.
- 완료 조건: 24×24, 팔레트 24색 검사 통과. 기존 `tool/hammer.png`와 나란히 놓은 2배 확대 비교 이미지를 만들고 그 경로를 보고에 적는다.

**1. 화면 A: 서비스 탭 걷기**
- 파일: `app.ts`, `keys.ts`, `unlockUi.ts`, 관련 css
- 변경:
  - `TabId = 'tap' | 'home' | 'box' | 'dex'`. 기본·대체 탭은 `'tap'`.
  - tap 버튼에는 `data-ux`·`tab-lock`을 달지 않는다(지금 `services`를 다루는 방식과 같게). `tabOpen('tap')`은 항상 true다. 이렇게 해야 `unlock.ts:50`의 상자 10개 규칙이 남아 있어도 새 게임에 열린 탭이 0개가 되지 않는다.
  - `'home'` 버튼과 패널은 7단계 전까지 숨긴다.
  - 서비스 패널·`serviceRows`·`buyServiceClick`·`seg`·Q/W/E·`firstBuyHinted`를 삭제한다. 첫 안내 말풍선은 공구 카드로 옮긴다.
  - 히어로 Mbps를 "탭 1회 +N"으로 바꾸고, "+N/초"는 5초 실측으로 바꾼다.
  - 로직은 손대지 않는다.
- 화면 확인: 모바일 390과 PC 각 1장.

**2. 화면 B: 결합·약정·퀴즈·선반 걷기**
- 파일: `strategyUi.ts`(특전 창·배율 팝오버만 남김), `eventUi.ts`(삭제), `unpackUi.ts`(선반 비움, `eventCall` 인자 제거), `parcelUi.ts`, `app.ts` 호출부
- 완료 조건: 공통 조건 + `grep -rnE 'SERVICES|serviceProd|buyService|contract|bundle|eventUi|ppsStable|pps\(' src/ui`가 0건(`TAP_*` 상수 import는 예외).
- 화면 확인: 이사 확인창, 특전 창.

**3. 로직 A: 서비스·결합·약정 삭제 + 저장 v9**
- 파일:
  - `data/services.ts` → `data/tap.ts`(탭·강타·영구 상수만)
  - `data/bundles.ts`·`contracts.ts`·`logic/bundle.ts`·`contract.ts` 삭제
  - `economy.ts`(pps 계열 삭제, `tick` 수익 0), `prestige.ts`, `unlock.ts`, `state.ts`, `save.ts`(2.9절), 테스트
  - `data/rooms.test.ts`(`SERVICES` import 제거, 칸 수는 `SHELF_ICON_EXTENT.length`만 확인)
  - 컴파일을 위해 `strategyUi.ts` 배율 팝오버에서 `bundle`·`contract` 줄도 뺀다
- 변경:
  - `pps`·`ppsNoContract`·`ppsStable`은 0을 돌려주는 스텁으로 남긴다. 호출처(`gacha.ts:2`, `variety.ts:1`, `offline.ts:1`)는 4단계에서 정리한다.
  - `offline.ts`의 `contractExtraPps`·`extras`는 지운다.
  - `state.event`·`event.ts`는 4단계까지 그대로 둔다.
  - 탭 식은 `fromPps = 0`인 상태로만 둔다(새 배율은 4단계).
- 완료 조건: 공통 조건 + v8 서비스 저장을 불러오면 상자 n개 보상이 들어가는 테스트.

**4. 로직 B: 이벤트·오프라인·특전 정리 + 새 경제 + 새 시뮬**
- 파일: `event.ts` 삭제, `offline.ts`(2.1절), `data/perks.ts`·`perks.ts`(2.8절), `collection.ts`·`data/collectibles.ts`(4.2절), `economy.ts`(`homeMult`, 4.3절, 마일스톤 확장), `gacha.ts`, `variety.ts`, `data/houses.ts`(잠정 목표), 새 `tools/box-sim.mjs`
- 시뮬 정책: 초당 4탭, 강타 30%, 퍼펙트 60%, 싼 업그레이드부터 사고, 상자는 가격이 P의 10% 이하일 때 산다. 4.4절 판정 기준을 출력한다.
- 완료 조건: 공통 조건 + 시뮬 판정 결과를 보고에 첨부. 판정을 통과하지 못하면 `houses.ts` 목표만 조정한다.
- 너무 크면 4a(이벤트·오프라인·특전)와 4b(경제·시뮬)로 나눈다.

**5. 로직 C: 공구 베리에이션**
- 파일: 새 `data/gear.ts`·`logic/gear.ts`, `charge.ts`(반폭 인자만), `unpack.ts`(`chainBonus` cap, `specialAt` rate), `weak.ts`, `state.ts`·`save.ts`(`gear` 정리: 정의에 없는 id 버림, 최대 레벨로 자름), 새 `gear.test.ts`
- 완료 조건: 공통 조건 + 실드 규칙 테스트(지킴, 0칸, streak 0일 때 소모 안 함, 퍼펙트 8회 충전, 최대 칸) + `box-sim` 재실행.

**6. 화면 C: 공구 탭·실드·선반**
- 파일: `app.ts`(공구 패널 카드 7종, `onBuy` 재사용), `chargeUi.ts`(퍼펙트 폭 반영, 안전모 아이콘과 깨짐 연출), `unpackUi.ts`(`syncPixelShelf`를 공구 선반으로), `data/rooms.ts`(`SHELF_ICON_EXTENT` 7칸 다시 잼), `rooms.test.ts`, css
- 화면 확인: 공구 탭 전체, 실드가 막는 순간 프레임, 선반 원본 해상도 크롭(축소 스크린샷 승인 금지).

**7. 화면 D: 살림 탭·총 배율·안내**
- 파일: 새 `ui/homeUi.ts`(살림 8칸 목록), `app.ts`(히어로 총 배율 롤러·계단 배너, v9 안내 창, 돌아오면 러시 토스트), `unpackUi.ts`(단계 상승 때 "살림 xA → xB"), `strategyUi.ts`(배율 내역 줄), `unlock.ts`(`home` 규칙: `homeLv` 합 > 0)
- 화면 확인: 살림 탭, 단계 상승 순간, 히어로.

**8. 도구: 스모크 다시 쓰기·정리**
- 파일: `smoke.cjs`·`smoke-pc.cjs`(8절). `sim.mjs`·`unlock-pace.mjs`, 쓰지 않는 그림, 남은 css 선택자를 삭제한다.
- 완료 조건: 스모크 두 개 통과(Aside 헤드리스 9333, `--mute-audio`, 끝나면 SIGKILL로 끄고 복제본 정리).

**9. 마무리: 목표 확정·문서**
- 파일: `data/houses.ts`(`box-sim` 최종 판정 통과값), `src/logic/README.md`, `DESIGN.md`, `ui/UI-GUIDE.md`(공개 표·탭)
- 완료 조건: 시뮬 판정 OK 전부 + 공통 조건.

## 10. 위험·사용자 확인
- **질문 1 — 방치 수익**: 오프라인·자동 수입을 완전히 없애고 돌아오면 러시만 줘도 되는가? 대안은 살림 레벨 비례 소액 오프라인 P다. 장르 정체성이 걸린 결정이다.
- **질문 2 — 서비스 테마**: 인터넷·정수기·휴대폰 같은 서비스 8종, Mbps·회선 등급, 요금제 퀴즈를 전부 걷어내도 되는가? 회사(아정당) 토이 프로젝트라 사업 테마와 겹친다. 남긴다면 살림 이름이나 선반 장식으로 흔적을 둘 수 있다.
- **질문 3 — 기존 플레이어**: GitHub Pages로 이미 배포돼 있다. v9 정리(P를 목표 × 0.3으로 자름, 서비스는 선물 상자로 환산)가 기존 플레이어 눈에 보인다. 이 방식으로 괜찮은가?
- **위험**:
  - 4.4절은 초당 탭 환산 30, 상자 0.6개/초라는 가정에 기댄 거친 계산이다. 목표 수치는 4단계 `box-sim`이 기준이다.
  - 상한 없는 `streakMult`에 수평계·실드가 겹치면 상위 실력자의 수익 폭이 커진다. 시뮬에 퍼펙트 90% 정책도 함께 돌린다.
