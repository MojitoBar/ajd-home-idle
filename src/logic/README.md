# 로직 공개 API (M2)
모두 순수 함수. 난수 `rng: () => number`(0 이상 1 미만)와 시간은 인자로 넘긴다. 상태 변경 함수는 새 `GameState`를 돌려준다. 개편 설계는 `DESIGN-BOXLOOP.md`. 2026-11-17 상자깡 루프 개편으로 서비스·결합·약정·퀴즈 이벤트·오프라인 수익·자동 수익(`pps`)은 삭제됐다. 수익은 탭뿐이다.

## 파일별 역할
| 파일 | 역할 |
|---|---|
| `economy.ts` | 탭 수익(`tapStable`·`tapValue`), 영구·도감·살림 배율, 배율 분해, 탭·강타 강화 비용, `tick` |
| `gacha.ts` | 상자 가격·개봉(`boxPrice`·`openBox`·`openBoxes`), 확률표 |
| `collection.ts` | 도감 칸 레벨·배율, 등급 세트 |
| `unpack.ts` | 이삿짐 상자 풀기(타격·터짐·특별 상자·연쇄), 살림 칸 레벨 올리기, 살림 단계(`tierOf`) |
| `gear.ts` | 영구 공구 5종(비용·해금·구매·효과), 안전모 실드 |
| `charge.ts` · `weak.ts` · `combo.ts` · `heat.ts` | 꾹 눌러 강타, 급소, 콤보, 열기 |
| `fever.ts` · `variety.ts` | 피버·택배·치명타, 탭 상한(`tapGate`)·`tapWithRng`·`catchParcel` |
| `perks.ts` · `perkBox.ts` | 특전 3택 · 특전 상자 구매 |
| `prestige.ts` · `house.ts` | 이사 조건·실행, 집 이름·목표 |
| `guide.ts` | 첫 가이드(손맛 요소가 하나씩 열리는 순서, `state.guide`) |
| `unlock.ts` | 단계적 공개(`UNLOCK_IDS`) |
| `offline.ts` | 복귀 러시 판정 |
| `save.ts` · `state.ts` | 저장·불러오기·`MIGRATIONS`, 상태 정의(`CURRENT_VERSION = 14`) |
| `format.ts` | 한국식 큰 수 표기 |

## 상자·도감 (`gacha.ts`, 데이터 `data/collectibles.ts`)
- `oddsTable()` -> `{rarities[], variants[]}` 각 항목 `{id,name,prob,percent,weight,...}`. 상자 화면에 항상 표시(합 100%).
- `boxPrice(state)` 가격. `openBox(state, rng)` -> `{state, result}` 또는 P 부족 시 `null`. `result={item,variant,isNew,count,prevLevel,level,nextNeed,completedSets}`. 가격은 `max(5000, 900 x tapStable) x 1.06^boxesThisRun x 특전 할인`(`BOX_MIN_PRICE`·`BOX_TAP_FACTOR`·`BOX_PRICE_GROWTH`, tapStable = 피버를 뺀 탭 1회 값, 약 30초분).
- `openBoxes(state, rng, 10)` -> `{state, results[]}` (P 모자라면 중간에 멈춤, 0개면 빈 배열). 10개를 모두 열 수 있고 앞 9개가 전부 일반이면 10번째는 레어 이상(`rollBox(rng, true)`, 난수 호출 순서는 그대로).
- 칸 레벨(`collection.ts`): `slotLevel(count)`(1·3·7·15·31개 = Lv 1~5), `slotNextNeed(count)`, 칸 기여 = 등급 가중(0.05·0.1·0.2·0.4·0.8) x 변이 가중 x 2^(Lv-1). 도감 배율 `collectionMultOf` = (1 + 칸 기여 합 `slotMultOf`) x 완성 세트 곱. 등급 세트(`SETS`: `dexMult` 일반 x2·레어 x2·에픽 x3·전설 x3·신화 x5, 전설은 피버 +5초·신화는 치명 +2 추가, `setProgress`, `setEffects` -> `{dexMult, feverSec, critMult}`). 저장 형식은 v4 그대로(개수만 저장).
- `collectionProgress(state)` -> `{mult(C), registered, total(80), byRarity[]}`. `isRegistered(state,itemId,variant)`.
- 도감 전체 목록: `COLLECTIBLES`(id,name,emoji,rarity), `VARIANTS`(emoji/name). 슬롯 개수는 `state.collection[id][variant]`(0=미등록, 중복은 개수만 증가).
- C는 `economy.collectionMult`(= `collectionMultOf` x 도감 특전)로 탭 수익에 곱해진다.

## 탭 (`economy.ts`, 상수 `data/tap.ts`)
- 탭 1회 수익 `tapStable(state) = tapBase(L) x 영구 x 도감 x 살림 x 탭 특전 x 0.6`(`TAP_BOX_SCALE`, 피버 제외, 상자 가격·택배 기준). `tapValue(state, damped) = tapStable x 피버 x (감쇠면 DAMPED_RATIO 0.3)`. 수익은 탭뿐이다.
- 영구 `permMult(moves) = 1 + 1.5 x moves`. 도감 `collectionMult = collectionMultOf x 도감 특전`(상자·도감 절).
- 살림 `homeMult(state) = (1 + 0.05 x sum(칸 Lv x 2^tierOf(Lv))) x 살림 특전`(`HOME_MULT_PER_LV`). 탭 수익에만 곱하고 상자 피해(`unpackPower`)에는 곱하지 않는다. 살림은 8칸(`HOME_SLOTS`, `state.homeLv`)이고 큰 상자가 터질 때마다 한 칸 Lv가 오른다(방 단계는 정해진 칸, 80개 뒤 손질 단계는 `nextCareSlot`). `tierOf(lv)`는 문턱 3·12·48·192…(`TIER_BASE` 3, `TIER_STEP` 4)를 넘을 때마다 1씩 오르고, 단계가 오르면 무료 상자 1개가 나온다.
- `tapCost(L)` = 20 x 1.25^L. `tapBase(L) = (1+L) x 2^마일스톤`, 마일스톤은 10·25·50·100·150·200·300·400(각 x2).
- `tapBreakdown(state)` -> `{flat, total}`: flat = `tapStable`, total = `tapValue`. `multBreakdown(state,'tap')` -> `{permanent, collection(세트 곱 제외), home, fever, perk(탭 특전), set(세트 곱), total}`, total은 항목의 곱(`tapBase x 0.6` 앞, 치명타 제외). 머리의 총 배율 칩은 피버를 뺀 같은 곱이다.
- `globalMult`는 영구·도감·살림·피버의 곱.
- 저장값 정리(`sanitize`): `notice: {kind:'v9', boxes}`는 v9 안내 창용(화면이 한 번 띄운 뒤 지운다).

## 탭 변주 (`fever.ts` 상수·타이머, `variety.ts` 동작)
- `tapWithRng(state, rng)` -> `{state, gain, crit}`: 치명타(5%, x6) 판정 + 피버 충전 + 포인트 반영. 기존 `applyTap`(난수 없음)은 치명타·충전 없이 그대로. UI 탭은 `tapWithRng`로 교체.
- 피버: `state.fever={gauge(0~45탭, 초당 1.2 감쇠), activeSec, cooldownSec}`, `feverRatio(state)`(0~1, 피버 중엔 남은 시간 비율). 발동 중엔 `tapValue`에 x3 자동 반영(`FEVER_MULT`). `tick`이 감쇠·종료·재충전 제한 진행.
- 택배 상자: `state.parcel={nextInSec, remainSec}`, `parcelVisible(state)`(remainSec>0이면 떠 있음, 남은 시간 표시). `tick(state, dt, rng)`이 등장(60~120초 간격)·8초 만료 처리(rng 생략 시 90초).
- 잡기: `catchParcel(state, rng)` -> `{state, reward}` 또는 `null`(안 떠 있음). `reward`는 `{kind:'points', gain, seconds}` 또는 `{kind:'box', result: BoxResult}`(무료 상자, 가격·개봉 수 불변).
- 호출 순서: 탭 `tapWithRng` -> 매 프레임 `tick` -> 상자 클릭 `catchParcel`. 피버·택배는 저장 안 함(불러오면 초기값), 이사 시 피버만 초기화, 오프라인엔 피버 미적용.

## 누르는 방식 변주 (`charge.ts`, `weak.ts`; 공용 `unpack.heavyHit`, `combo.comboAdd`)
- `heavyHit(state, rng, taps, comboMult, feverCharge)` -> `tapAndHit`과 같은 필드 + `bursts[]`: 탭 taps번어치 수익·상자 타격을 한 번에(치명타 1회, 피버는 feverCharge). 콤보는 `comboAdd(c, nowMs, add)`로 따로 올린다.
- 꾹 눌러 강타: `CHARGE_HOLD_MS` 넘게 누르면 `chargePos(elapsedMs, chargeSpeed(streak))`가 0~1을 왕복, 뗀 자리로 `releaseCharge(state, rng, pos, streak, comboMult)` -> `{...heavyHit, grade, streak, comboAdd}`. 보상은 `CHARGE_REWARD`. 연속 퍼펙트는 탭 수에 `streakMult(streak) = 1 + 0.5 x streak`(상한 없음)을 곱하고, 속도(`chargeSpeed`)만 10회분에서 멈춘다.
  - 스윙마다 구간이 바뀐다: `rollChargeZone(rng, prev?)`(가운데 0.35~0.87, 직전과 0.15 이상 떨어짐) -> `ChargeZone {perfect, good}`, `chargeGrade(pos, zone)`·`releaseCharge(..., tapsMult, zone)`에 넘긴다(생략하면 `CHARGE_ZONE_DEFAULT`, 가운데 0.83).
- 급소: `WeakState`(`initialWeak`, `advanceWeak(w, dt, active, rng)` -> `{weak, appeared, vanished}`, `weakHitTest(w,u,v,radius)`, `hitWeak(state, rng, w, comboMult)` -> `{...heavyHit, weak, comboAdd}`). 저장 안 함.

# 저장·복귀·이사
저장 버전 11(`CURRENT_VERSION`). `MIGRATIONS[10]`(10 -> 11)은 `perkBoxBought: 0`을 넣고, 가이드 진행 중이면 영구 공구 단계(번호 11) 뒤에 특전 상자 단계가 끼어든 만큼 `guide.step`이 12 이상일 때 +1 밀어 같은 단계에 머물게 한다(완료·이사한 저장은 그대로). 특전 레벨은 상한을 없앤 특전(`Infinity`)이라도 저장은 숫자 그대로이고 `sanitize`는 `min(maxLevel, 값)`으로 읽는다. 이전 `MIGRATIONS[9]`(9 -> 10)는 `guide`를 넣는다: 이미 하던 저장은 전부 가이드 완료(`finishedGuide()`), 탭을 한 번도 안 했고 이사도 안 한 저장만 1단계부터. `sanitize`는 `guide`가 없거나 범위 밖이거나 이사했으면 완료로 읽는다.

저장 버전 9. `MIGRATIONS[8]`(8 -> 9)이 옛 서비스·결합·약정·이벤트를 걷어낸다: 서비스 레벨 합 25마다 선물 상자 1개(최대 30개)를 도감에 넣고, 죽은 특전 6종(`svc_power`·`bundle_boost`·`contract_slot`·`penalty_cut`·`offline_rate`·`offline_cap`)은 레벨 1마다 3택 묶음 1개로 바꿔 주며, 보유 P는 이사 목표의 30%, 누적은 목표까지로 자르고 `gear: {}`, `notice: {kind:'v9', boxes}`를 넣는다. 이 뒤로 `services`·`contracts`·`event`는 읽지 않는다.

## state 필드 (모두 저장됨)
- `perks: Record<perkId, 레벨>` 영구 특전 레벨. 이사해도 유지.
- `perkOffers: string[][]` 선택 대기 중인 특전 3택 묶음(오래된 순, 묶음당 perkId 3개). 새로고침해도 같은 후보가 유지된다. 이사 시 `movePerkBoxes(이사 전 횟수)`개 추가, 특전 상자를 사면 1묶음 추가, 선택하면 그 묶음 삭제. 여러 묶음이 쌓여도 게임은 막히지 않는다.
- `perkBoxBought: number` 이 집에서 산 특전 상자 수(다음 가격이 오른다). 저장됨, 이사하면 0.
- `deck` 공구함 덱(아래 "공구함 덱" 절). 저장됨, 이사하면 초기화.
- `homeLv: number[8]` 살림 칸 레벨, `gear` 공구 레벨(영구), `unlocked`(선택 필드, 열린 요소).

## 호출 시점 요약
- 매 프레임 `tick(state, dt, rng)` 하나로 타이머(피버·택배·러시)를 처리한다. 자동 수익은 없다.
- 시작·복귀 시 `applyOffline(state, now)` -> `{state, rush, awaySec}`. 오프라인 수익은 없고 30분(`RETURN_RUSH_AWAY_SEC` 1800초) 넘게 비웠으면 `unpack.rushSec`을 `RETURN_RUSH_SEC`(15초)까지 채운다(이미 더 쌓여 있으면 그대로). 저장 시각이 미래면 현재로 보정.
- 이사: `moveStatus(state)` -> `{ok, reason:null|'target', targetReached}`, 확인 시 `move(state, rng?)`. 인자 rng는 특전 3택 추첨용(생략하면 이사 횟수 기반 결정적). 이사 보상은 특전 상자 `movePerkBoxes(이사 전 횟수)`개 = 3택 묶음 그만큼(첫 이사 2개, 그 뒤 3·4·5·5…).

## 이사 (`prestige.ts`, 집 목표 `data/houses.ts`)
- 조건은 `earned >= 현재 집 목표` 하나다. 초기화: P·누적·`tapLevel`·`strikeLevel`·`boxesThisRun`·피버·상자 풀기(`unpack`). 유지: `moves`(+1)·도감·살림·공구·특전·통계·설정.
- 집 목표(P): 원룸 3.3e10, 투룸 1.5e14, 아파트 3e17, 펜트하우스 4e19, 달 기지 5e21, 화성 별관 5e22, 목성 위성 단지 5e23, 은하 분양단지 5e24, 우주 끝 신도시 5e25. 그 뒤 "우주 끝 신도시 N차"는 직전 x8(`MOVE_TARGET_GROWTH_AFTER`). `houseInfo(stage)`.

## 첫 가이드 (`guide.ts`, 설계 `DESIGN.md` "가이드와 J 커브")
새 게임은 탭과 공구 강화만 열려 있고, 가이드 단계를 끝낼 때마다 손맛 요소가 하나씩 열린다. 첫 이사(`moves > 0`)를 하면 가이드가 끝나고 전부 열린다. 열린 뒤의 동작·수치는 가이드가 없던 때와 같다(`streakMult` 식 그대로).
- 상태 `state.guide = {step, n, done}`(저장됨): `step`은 지금 단계 번호(0부터, 단계 수가 되면 끝), `n`은 그 단계 진행 수, `done`은 끝남. `defaultState()`는 `{step:0, n:0, done:false}`. 시험용 `testState.ts`의 `defaultState`는 가이드를 마친 상태.
- 단계표 `GUIDE_STEPS`(18개, 화면은 `GUIDE_STEPS.length`/`guideView.total`을 쓴다): `{id, text, event, goal, opens?, gate, rewardTaps, rewardBoxes?, progress?}`. `gate` = 이 단계를 끝내려면 필요한 이번 집 누적 포인트(0이면 없음, 행동 목표를 채워도 모자라면 기다린다). `rewardTaps` = 끝낼 때 받는 보상(그때 `tapStable` x 탭 수, 포인트·누적에 더함, 1~8단계만). `rewardBoxes` = 선물 상자 수(9단계부터 2·2·2·3·3·4·6·6·8): 무료 `rollBox` 뽑기를 도감에 넣는다(`boxesThisRun`·`boxesOpened`는 안 오름, 씨앗은 탭·상자 수·단계). `progress(state)` = 사건 대신 state로 판정하는 후반 단계(14 탭 강화 Lv 68, 15 살림 Lv 합 250, 16 강타 강화 Lv 62, 17 총 배율 1500): `event`는 `'tick'`이고 어떤 사건이 와도 다시 본다. 단계 번호는 `DESIGN.md` 5-1절 표.
- `guideEvent(state, ev)` -> `{state, completed, step, reward, rewardBoxes, boxResults, opened}`(`boxResults` = 선물 상자 뽑기 결과 `BoxResult[]`, 화면이 보여 준다). 사건 `ev`: `{type:'tap'}`·`'upgrade'`·`'unbox'`(큰 상자가 터져 살림이 나옴)·`'combo'`·`'chain'`·`'perfect'`(이 셋은 `value` = 지금 콤보·한 번에 터진 수·연속 퍼펙트 수, 가장 큰 값을 기억)·`'strike'`·`'weak'`·`'fever'`(피버 시작)·`'boxBuy'`·`'special'`(특별 상자가 터짐)·`'gearBuy'`·`'perkBoxBuy'`(특전 상자를 샀다)·`'move'`(이사 뒤에 알려도 됨)·`'tick'`(아무 일 없음). 지금 단계가 기다리는 사건만 센다. 누적 포인트만 기다리던 단계는 아무 사건(보통 탭)이 올 때 끝나므로 화면은 탭마다 `'tap'`을 알린다. 한 번에 한 단계만 끝낸다.
- `featureOpen(state, feature)`: `combo`(콤보 배율)·`charge`(꾹 눌러 강타·열기 게이지)·`weak`(급소)·`fever`·`chain`(연쇄 보너스·상금·강타 뚫기·오함마 카드)·`streak`(연속 퍼펙트 배수·안전모)·`special`(특별 상자)·`gear`(영구 공구 카드)·`perkBox`(특전 상자 구매, `buyPerkBox`가 `null`을 돌려주지 않음). 가이드가 끝났거나 `moves > 0`이면 전부 true. 요소는 그 요소의 `opens` 단계에 들어설 때(앞 단계를 끝낼 때) 열린다.
- `guideView(state)` -> `{no, total, text, n, goal, gate, gateMet, rewardTaps, rewardPoints, rewardBoxes, opens, event}` 또는 끝났으면 `null`. `guideEnded`·`guideReached(state, stepId)`(가이드 중이고 그 단계에 닿음)·`guideAt`(바로 그 단계).
- 로직이 `featureOpen`을 읽는 곳(화면이 따로 막지 않아도 되는 것): 피버 충전(`variety.tapWithRng`·`unpack.heavyHit`), 연쇄(`unpack.hitChained` 보너스·`chainPrize`·`heavyHit`의 뚫기), 특별 상자(`unpack.boxSpecial`·`hitBox`), 연속 퍼펙트 배수(`charge.releaseCharge`), 오함마(`economy.buyStrikeUpgrade`가 연쇄 전엔 null), 영구 공구 카드(`gear.gearUnlocked`: 가이드 중엔 공구 단계에 닿고 그 공구의 요소가 열려야), 상자 탭(`unlock.ts` `box`: 가이드 중엔 상자 단계에서만). 화면이 막아야 하는 것: 콤보 배율(`combo.comboMultOf(state, n)`), 강타 입력·열기 게이지, 급소 표시, 피버 표시(게이지는 안 차지만 UI), 오함마 카드.
- 특별 상자 단계(`guideAt(state,'special')`)에서는 `gearEffects.specialRate`가 `GUIDE_SPECIAL_RATE`(20%) 이상이라 처음 20개 뒤에 곧 만난다.

## 열림 규칙 (`unlock.ts`)
`UNLOCK_IDS = box·home·dex·mult·badge·perk`. 한번 열리면 `state.unlocked`에 남고, 이사한 저장은 전부 열린 채 시작한다. 조건(`isMet`): 상자 = P가 가격 절반 이상이거나 누적 >= 5000 x 3(`UNLOCK_RULE.boxEarnedMult`)이거나 방을 끝냈거나 도감·개봉 기록이 있음, 살림 = 살림 칸 하나라도 Lv 1 이상, 도감 = 도감 칸이 하나라도 있음, 배율 내역·총 배율 = 도감·살림 배율이 1이 아니거나 특전 보유, 특전 = 선택 대기·보유. 공구 탭은 항상 열려 있다. `nextUnlock`은 아직 안 열린 상자 등 중 진행률이 높은 것의 조건 문구.

## 특전 상자·특전 3택 (`perkBox.ts`·`perks.ts`, 데이터 `data/perks.ts`)
특전은 이사 보상과 특전 상자 구매로 얻는다. 둘 다 3택 묶음(`perkOffers`)을 쌓고, 고르는 건 `choosePerk`다.
- 특전 상자(`perkBox.ts`): `perkBoxCost(state)` = `houseTarget(state) x PERK_BOX_FRAC(0.0025) x PERK_BOX_GROWTH(2) ^ perkBoxBought`(영구 공구와 같은 방식). `perkBoxUnlocked(state)` = `featureOpen(state, 'perkBox')`(가이드 18단계 중 13번째 "특전 상자를 뽑아 보세요"에 닿았거나 가이드가 끝남/이사). `canBuyPerkBox(state)` = 열려 있고 `points >= 가격`. `buyPerkBox(state, rng?)` -> 포인트를 깎고 `perkBoxBought + 1`, `perkOffers` 끝에 3택 묶음 1개를 넣은 새 state, 잠겼거나 모자라면 `null`(rng 생략하면 이사 횟수·구매 수·탭 수 기반 결정적). 사고 나면 화면이 `guideEvent(state, {type:'perkBoxBuy'})`를 알린다.
- `movePerkBoxes(moves)` = `min(2 + moves, 5)`(moves = 이사 전 횟수. `move`가 이 개수만큼 묶음을 쌓는다. 화면이 "특전 상자 N개" 문구에 읽는다).
- 상한 없는 특전: 손목 단련·살림 장인·도감 수집가·강타 단련은 `maxLevel = Infinity`(`maxed`는 항상 false, `PerkOptionView.unlimited = true`). 화면은 `maxLevel`을 숫자로 찍거나 `for (k < maxLevel)`로 도는 코드를 쓰면 안 된다(`unlimited`로 가른다).
- `perkOfferViews(state)` -> `PerkOptionView[][]` 대기 묶음별 옵션 `{id,name,emoji,category('tap'|'idle'|'luck'|'strategy'),desc(레벨당 효과),level,maxLevel,unlimited,maxed}`. `pendingPerkCount(state)`는 대기 묶음 수(배지용).
- `choosePerk(state, offerIndex, perkId)` -> 새 state 또는 `null`(묶음에 없음/최대 레벨). 선택한 묶음이 삭제된다. 이미 최대인 옵션은 `maxed`로 비활성 표시.
- `discardPerkOffer(state, offerIndex)` 묶음의 모든 옵션이 최대일 때만 버릴 수 있다(아니면 `null`).
- `perkEffects(state)` 현재 특전 효과 수치 모음(`tapMult, critChance, critMult, feverSec, boxPriceMult, parcelDelayScale, strikeMult(강타·급소 탭 수 배율), streakBonus(연속 퍼펙트 계수에 더하는 값), specialRateMult(특별 상자 확률 배율), feverCharge(피버 게이지 충전 배율)`). 이미 `tapValue`·`tapWithRng`·`boxPrice`·`tick`(택배)·`releaseCharge`·`hitWeak`·`heavyHit`·`gearEffects.specialRate`에 반영돼 있다. 연속 퍼펙트 배수는 `streakMult(streak, bonus = 0)`·`chargeTaps(grade, streak, bonus = 0)`이고 화면이 보여 줄 때는 `perkEffects(state).streakBonus`를 넘긴다(생략하면 기본 계수 0.5만). 피버 게이지 비율을 그릴 땐 `feverRatio(state, perkEffects(state).feverSec)`(두 번째 인자 생략 시 기본 10초). `dexBoostMult(state)`(도감 배율 곱, `collectionMult`에 반영)·`homeBoostMult(state)`(살림 배율 곱, `homeMult`에 반영). `PERKS`(데이터)로 전체 목록(도감식 "내 특전" 화면)을 그릴 수 있다.
- 특전 풀 12종(`data/perks.ts`, 이름 옆은 레벨당 효과·최대): 손목 단련(탭 수익 +110%, 무한)·강타 단련(강타·급소 수익 +30%, 무한)·살림 장인(살림 배율 +25%, 무한)·도감 수집가(도감 배율 +25%, 무한)·손에 익은 리듬(연속 퍼펙트 계수 +0.1, 5)·불씨 모으기(피버 게이지 충전 +15%, 5)·특별 상자 단골(특별 상자 확률 +25%, 4)·촉이 좋은 손가락(치명타 +3%p, 5)·오래가는 열기(피버 +4초, 4)·대박 한 방(치명타 배율 +1, 3)·상자 단골 쿠폰(상자 가격 -8%, 4)·택배 기사님 친구(택배 간격 -15%, 3). 기존 8종은 전부 코드에서 실제로 쓰이고 있어 죽은 특전이 없어 그대로 두었다.

## 탭 상한 (`economy.ts`, `variety.ts`)
- `tapGate({recent, tokens, lastMs}, nowMs)` -> `{ok, damped, recent, tokens, lastMs}`(`initialTapGate()`로 시작). 전액 탭 허용량은 용량 6, 초당 6개씩(`TAPS_PER_SEC_FULL`) 연속으로 다시 찬다. 접수된 탭이 토큰 1 이상이면 1을 쓰고 전액, 아니면 `damped:true`. 최근 1초 12회(`TAPS_PER_SEC_ACCEPT`) 이상이면 `ok:false`(무시). 초당 6회 이하는 전부 전액, 초당 10회면 약 6/10이 전액으로 고르게 섞인다. 오래 쉬어도 토큰은 6을 넘지 않는다.
- 감쇠 탭은 `tapStable x 0.3`만 주고, **치명타가 되지 않으며**(전액 탭에서만 판정, 치명타 gain = 그 순간 전액 탭 값 x `critMult`), 피버는 전액 탭 +1·감쇠 탭 +0.5만큼 채운다(`chargeFever(f, feverSec, amount)`). `tapValue(state, damped=false)`, `applyTap(state, damped=false)`, `tapWithRng(state, rng, damped=false)` -> `TapResult.damped` 포함.

## 상자 가격·택배
`boxPrice`는 피버를 뺀 `tapStable(state)` 기준이다(영구·도감·살림·특전 포함). 택배 상자 포인트 보상은 `tapStable x 2.5 x 20~40초`.

## 이삿짐 상자 풀기 (`unpack.ts`, 데이터 `data/unpack.ts`, 설계 `DESIGN-UNPACK.md`)
`state.unpack = { box, damage, roomDone }`(저장 v5, 이사 때 초기화). 탭은 `tapAndHit(state, rng, damped)` -> `TapResult & { burst: BoxBurst | null }`. 감쇠 탭은 상자 피해 0.
- `boxKind(k)`, `boxHp(k)`, `unpackPower(state)`, `toolOf(level) -> {minLevel,name,emoji}`, `hitBox(state, {crit,damped,feverMult,rng?,critMult?}) -> {state, burst}`.
- `roomProgress(state) -> {opened,total,slotsDone,slotFill,complete}`, `boxCondition(state) -> {kind,k,hp,damage,ratio,stage,stages}`(겉모습 단계: 작은·보통 3, 큰 4).
- `BoxBurst = {kind,k,gain,item?,slot?,slotFill,roomDone,freeBox?}`. 탭 1회 P는 `TAP_BOX_SCALE`(0.6)배, 덜어 낸 몫은 터질 때 `tapValue x K`로 준다.

## 콤보 (`combo.ts`)
순수 함수, 시간(ms)은 인자. `ComboState {n,lastMs,earned}`는 저장 안 함. `comboHit(c, nowMs, comboWindowMs(feverActive), damped)` -> `{combo, tierUp, ended}`, 배율 `comboMult(n)`(10·25·50·100·200 -> x1.2·1.5·2·3·5, `COMBO_TIERS`), 남은 수 `comboNext(n)`, 끝났을 때 정산 `comboBonus(c)`(earned x 10~50%). `tapAndHit(state, rng, damped, comboMult)`의 배율은 gain에만 곱한다. 최고 콤보 `state.bestCombo`는 저장되고 이사해도 남는다(저장 버전은 그대로, 없으면 0).

## 열기 (`heat.ts`)
순수 함수, 시간(ms)은 인자. `HeatState {v 0~100, overMs}`는 저장 안 함(`initialHeat()`). 탭 `heatTap(h)`·급소 `heatAdd(h, HEAT_WEAK)` -> `{heat, overheated}`, 시간 `advanceHeat(h, dtMs, hold)` -> `{heat, recovered}`(초당 12씩 식고 hold 중엔 안 식음, 100이면 과열 3초: 오르지 않고 v가 100 -> 0). `heatZone` cool/warm(40)/hot(70)/over, `heatTapMult`(hot x1.5)·`heatDamped`(과열 중 약한 탭), 강타 `heatStrikeMult(h, grade)`(퍼펙트·굿 1 + v/50)를 `releaseCharge(..., comboMult, tapsMult)`에 숫자나 `(grade) => 배율`로 넘기고, 뗀 뒤 `ventHeat(h)`(20까지).

## 연쇄 강타 (`unpack.ts` `heavyHit`, 데이터 `data/unpack.ts`·`data/tap.ts`)
강타(`releaseCharge`)·급소(`hitWeak`)는 상자를 뚫는다: `hitBox`에 `pierce: true`를 줘 비치명타도 hp/3 제한 없이 깎으므로 탭 한 단위가 상자 하나를 끝낼 수 있다(한 번에 최대 `taps`개). 일반 탭(`tapAndHit`)은 그대로.
- `chainBonus(i) = 1 + CHAIN_BONUS_STEP(0.1) x min(i, CHAIN_BONUS_CAP(20))`: i번째(0부터) 터진 상자 `gain`에 곱한다. `BoxBurst.chain`은 1부터 몇 번째인지.
- `HeavyResult.chain`(터진 수), `prize: {tier: 0|1|2, n, gain} | null`: 5·10·20개 이상이면 `CHAIN_PRIZES`의 가장 높은 단계 하나, 상금 = `tapValue`(피버 제외) x taps, 포인트·누적 수익에 더한다. `state.bestChain`을 갱신한다(이사해도 유지).
- 강타 힘 강화(저장 v7 `strikeLevel`, 이사하면 0): `strikeCost(lv) = 60 x 1.3^lv`, `strikeMult(lv) = 1 + 0.2 x lv`(강타·급소 탭 수에 `round`로 곱함), `buyStrikeUpgrade(state) -> GameState | null`.

## 특별 상자 (`unpack.ts` `specialAt`·`hitChained`·`rushTap`, 상수 `data/unpack.ts`)
상자 줄에 가끔 황금·폭탄·시계가 섞인다. 종류는 난수 없이 `specialAt(state.unpack.salt, k)`로 정해져(salt는 새 게임·이사 때 `rollSalt`로 뽑고 저장 v8) 저장·불러오기 뒤에도 같고, 화면은 `boxSpecial(state, offset)`으로 지금·다음 상자를 미리 볼 수 있다. 큰 상자 자리와 한 집의 처음 20개에는 없고, 확률 `SPECIAL_RATE`(5%), 가중치 황금 5 : 폭탄 3 : 시계 2, 특별 상자 뒤 4개는 일반 상자다.
- 황금: 보상 x`GOLD_GAIN_MULT`(10), 연쇄 보너스와 곱해진다.
- 폭탄: 터지면 뒤따르는 `BOMB_BLAST`(5)개가 내구도와 상관없이 함께 터진다(`BoxBurst.blast`). 휩쓸린 상자도 정상 보상·부수 효과를 받고 연쇄 수·`chainBonus`·연쇄 상금에 들어가며, 휩쓸린 폭탄은 다시 5개를 터뜨린다. 강타는 폭발이 끝난 뒤 남은 타격이 다음 상자로 이어진다.
- 시계: 터지면 `state.unpack.rushSec`에 `RUSH_SEC`(5)초(상한 없음). 러시 중 화면이 초당 `RUSH_RATE`(10)번 `rushTap`을 부른다: 일반 탭과 같은 피해·보상·치명타지만 피버 게이지를 올리지 않는다(열기·콤보는 화면 몫). `tick`이 시간을 줄이고, 이사·오프라인 정산은 0으로 만든다.
- `tapAndHit`·`rushTap`도 `heavyHit`와 같은 모양(`bursts`·`chain`·`prize`, `burst`는 마지막으로 터진 상자)을 돌려준다. 폭탄이 아니면 `bursts`는 0~1개. `bestChain`은 2개 이상 터졌을 때만 갱신한다.

## 공구 강화 (`gear.ts`, 정의 `data/gear.ts`, 설계 `DESIGN-BOXLOOP.md` 3절)
공구 7종: 공구(`tapLevel`, `tapCost`)·오함마(`strikeLevel`, `strikeCost = 60 x 1.3^lv`, `strikeMult = 1 + 0.2 x lv`)는 무한이고 이사하면 0. 아래 5종은 상한이 있는 영구 강화로 `state.gear`에 저장되며 이사해도 남는다.
- 수평계 `level`(최대 5, 퍼펙트 반폭 0.05+0.012xlv, 상한 0.12), 안전모 `helmet`(최대 3, 실드 칸 = lv), 빠루 `crowbar`(최대 5, 연쇄 상한 20+10xlv), 송곳 `awl`(최대 5, 급소 탭 8+4xlv, 등장 간격 x(1-0.08xlv)), 돋보기 `loupe`(최대 5, 특별 상자 5%+1%xlv).
- `gearCost(state, id)` = 현재 집 목표 x `frac` x 2.2^lv(`GEAR_COST_GROWTH`, 상한이면 Infinity). `frac`은 수평계 0.02·안전모 0.03·빠루 0.02·송곳 0.015·돋보기 0.02. `gearUnlocked`: `moves > 0 || unpack.box >= unlockBox`(수평계 15·돋보기 25·빠루 35·안전모 45·송곳 55). `canBuyGear`·`buyGear`는 상한·해금·포인트를 본다.
- `gearEffects(state)`가 효과 값을 모은다. 읽는 곳: `charge.releaseCharge`(구간을 안 넘기면 `perfectHalf`로 기본 구간을 만든다), `unpack`(`chainBonus(i, cap)`, `specialAt(salt, k, rate)`, `hitChained`·`hitBox`·`boxSpecial`), `weak`(`hitWeak`, `advanceWeak(…, delayMult)`).
- 구간은 `chargeZoneAt(center, half)`·`rollChargeZone(rng, prev, half)`로 만든다. 화면은 `gearEffects(state).perfectHalf`를 넘기고, 게이지 그림도 같은 구간을 읽는다.
- 안전모 실드는 저장하지 않는 런타임 값이다: `initialShield(max)` -> `{n, toNext}`(불러오기·이사 때 가득), `resolveStreak(prev, grade, shield, max)` -> `{streak, shield, saved}`. 퍼펙트 `SHIELD_CHARGE_PERFECTS`(8)번마다 한 칸 차고, 굿·미스는 연속이 있고 칸이 있으면 칸 하나를 쓰고 연속을 지킨다(보상은 실제 판정대로). `releaseCharge`의 streak 계산은 그대로라 화면이 이 결과로 연속 수를 덮어쓴다.

## 공구함 덱 (`deck.ts`, 카드 `data/cards.ts`, 설계 `DESIGN-DECK.md`, 4단계: 카드 12장·4칸)
- `state.deck = { slots: {id, star}[], offers: string[][], rerolls, mark, seen }`(저장 v14, 이사하면 `deckAfterMove`로 초기화: 빈 칸·첫 3택 1묶음·mark 1·다시 받기 2, `seen`만 이어받음). 첫 집(`moves 0`)은 빈 덱이고 `unlock.ts`의 `'deck'`은 첫 이사 뒤에 열린다.
- 카드 12장(값은 시뮬으로 맞춘 최종값, `data/cards.ts`): P1 수평 맞추기(퍼펙트 반폭 +0.01, `gearEffects.perfectHalf`, 고정 상한 `DECK_PERFECT_HALF_HARD_MAX` 0.125. `chargeZoneAt`도 0.125까지 받는다)·P2 먹줄 튕기기(연속 계수 +0.3)·P3 줄자 감기·C1 긴 빠루(연쇄 상한 +30)·C3 줄줄이 짐·C4 뚫어뻥(급소 탭 수 x1.5·간격 x0.85, `gearEffects.weakTaps·weakDelayMult`)·S1 금박 포장지(황금 배율 10 -> 25, `hitBox`가 황금일 때만 읽음)·S3 눈썰미(특별 확률 x1.7, `perkEffects.specialRateMult`)·S4 황금 손잡이·F1 불쏘시개(피버 충전 +50%, `perkEffects.feverCharge`)·F2 숯불 유지(피버 +8초, `perkEffects.feverSec`)·F3 풀무질. 상시 효과는 `deckEffects(state)`가 합쳐 준다(`state.deck` 키 WeakMap 캐시, 칸 수만큼만 도는 산술).
- 발동 카드: P3는 `deckStrikeMult(state, grade, streak)`(연속 10의 배수 퍼펙트 강타 탭 수 x3, `releaseCharge`가 곱함). C3(100연쇄마다 탭 1회 x30)·S4(한 강타에서 황금 상자 3개 이상이면 황금 수 x 탭 1회 x150)는 `deckEvent(state, {chain, gold})`가 카드당 한 줄 `{id, times, taps}`로 돌려주고(S4의 `times`는 황금 수), `heavyHit`이 `gain`을 채워 `points`·`earned`·`stats.totalEarned`에 더한다. F3는 `deckFeverFires(state, grade)`: 피버 중(강타 직전 상태) 퍼펙트 강타마다 `releaseCharge`가 `fever.activeSec`에 +2초를 더하고 `{id: 'F3', times: 1, sec: 2}`를 `deckFires`에 붙인다(`feverRatio`는 1을 넘을 수 있으니 화면이 자른다).
- 호출 자리: `unpack.heavyHit`(강타·급소)이 끝에서 `deckEvent`로 보상 P를 더하고, `tapAndHit`·`rushTap`·`heavyHit` 모두 `checkMarks`로 진행 문턱을 본다. 결과에 `deckFires`(터진 카드. 보상은 `gain`, P3의 `mult`·F3의 `sec`는 `releaseCharge`가 앞에 붙임. 뗀 순간 터지는 것은 P3·F3, 강타 끝에 터지는 것은 C3·S4)와 `deckOffered`(새 묶음이 생겼나)가 붙는다. 화면이 따로 부를 필요 없다.
- 칸·문턱(4단계): `deckSlots(moves)` = 4(`DECK_SLOTS`, 5·6칸은 7단계). 고르기 횟수 `DECK_MARKS` = 칸 수 + 3 = 7(이사 직후 1회 + 진행 문턱 6곳. 앞 4번은 칸을 채우고 뒤 3번은 교체). `markThreshold(state, k)` = `houseTarget` x 10^(-d), k=1..6, d는 `DECK_MARK_DIGITS[이사 횟수 1~5][k]`(6 이상은 마지막 행)이고 집 시간의 대략 9·19·31·46·63·80%에 오게 시뮬(현실 정책, 원형 4개 덱 x 시드 20개)으로 잡은 표. `checkMarks`는 넘은 문턱마다 묶음을 1개씩 쌓는다(한 번에 여러 개를 넘어도 `mark`가 그만큼 오르고 `offers`가 그만큼 늘어 고르기 횟수 = 문턱 수). 묶음 추첨은 호출자의 rng를 쓰지 않는 시드 추첨(`offerSeed`, 시뮬 난수열 보호): 서로 다른 3장이고, 안 낀 카드가 3장 이상 남아 있으면 낀 카드는 나오지 않는다(희귀도 추첨·다시 받기는 5단계).
- 화면용 API(`deck.ts`): `deckPicksLeft(state)` = 이 집에서 앞으로 받을 고르기 횟수(안 지난 문턱 수 + 받고 안 고른 묶음 수, 첫 집 0). `deckNextMark(state)` = `{k, at, progress}`(다음 문턱 번호·누적 P 금액·앞 문턱에서 다음 문턱까지 자릿수(로그) 진행률 0~1, 문턱을 다 지났거나 첫 집이면 null). `deckSlots`·`deckFull`은 4칸 기준.
- 저장 v13 -> v14(`MIGRATIONS[13]`): 낀 카드·눈금·묶음·`targetScale`은 그대로, 새 4번째 칸은 빈 칸. `mark`는 새 표로 이미 넘은 문턱 수까지 채우되(묶음은 안 줌) 지금 값보다 줄이지 않는다. 첫 집은 그대로.
- 고르기: `chooseCard(state, offerIndex, cardId | null, replaceSlot?)`(null = 건너뛰기, 칸이 차면 `deckFull(state)`가 true라 `replaceSlot` 필수, 실패는 null).
- **공구함 배율(3단계 로직, v13)**: 낀 카드 칸은 `{id, star, charge}`, `deck.targetScale`(이 집 목표 배수, 이사할 때 `DECK_TARGET_SCALE[새 이사 횟수]`로 고정, 6 이상은 마지막 값, 첫 집 1). 값표는 `data/cards.ts`(`CARD_CHARGE_NEED` 일반 40 = 지금 카드 전부, `CHARGE_NEED_SCALE[이사 횟수]`, `DECK_TARGET_SCALE`, `CHARGE_RULES`). 저장 v12 -> v13(`MIGRATIONS[12]`)은 낀 카드 `charge 0`, `targetScale 1`(지금 집의 목표·진행 그대로).
  - `deckMult(state)` -> number: 낀 카드 배수의 곱(카드 배수 = 1 + (3 + star - 1) x min(1, charge / need), ★1 상한 x4, 3칸 꽉 차면 x64). `state.deck` 키 WeakMap 캐시. **`tapStable`에 곱해진다**(탭·강타·연쇄 상금·상자 가격·보상 카드 P). `multBreakdown`·머리 총 배율(`totalMult`, `checkTier`, 가이드 17단계)에는 **안 들어간다**: 화면이 "공구함 x`deckMult`"를 따로 보여 준다.
  - `houseTarget(state)`(`house.ts`) -> number: `houseInfo(moves).target x deck.targetScale`. 이사 조건·진행 막대(`moveStatus`·`moveProgress`)·특전 상자 가격·영구 공구 가격·덱 문턱(`markThreshold(state, k)`·`marksPassed(state, earned)`)·화면의 목표 표시는 전부 이것을 쓴다. `deckTargetScale(moves)`는 표 값(미리 보기용).
  - `deckSlotViews(state)` -> `{ id, star, charge, need, mult, full }[]`(낀 순서). `cardChargeNeed(moves)` -> 필요 눈금. `deckAllFull(state)` -> 칸이 다 차고 전부 꽉 찼는가.
  - 충전(강타 정산 때만. 일반 탭·`rushTap`·방치는 안 찬다): 정밀 퍼펙트 강타 +1(연속 10의 배수 +3), 연쇄 한 강타의 50연쇄마다 +1(최대 +6), 특별 터진 특별 상자 1개 +2, 피버 피버 중 강타 +1·피버가 켜질 때 +4, 이중 태그(F3)는 두 조건 모두. 러시 조건은 러시 태그 카드가 4단계라 아직 없다. 눈금은 필요 눈금에서 멈추고, 카드를 바꾸면(`chooseCard`) 그 칸은 0, 이사하면 덱과 함께 사라진다.
  - 결과: `heavyHit`·`hitWeak`·`releaseCharge`(와 `tapAndHit`·`rushTap`, 이쪽은 변화 없음)의 결과에 `deckCharge: { full: string[], before: number, after: number, allFull: boolean }`가 붙는다(`full` = 이번에 꽉 찬 카드 id, `before`·`after` = 강타 전·후 `deckMult`, `allFull` = 덱 전체가 이번에 처음 꽉 참). `deckFires`와 같은 시점이다: 호출이 돌아올 때 `state`에는 이미 충전이 들어 있다. 연쇄 재생 끝에 정산되는 것(C3·S4와 연쇄·특별·피버 충전)과 뗀 순간 정산되는 것(P3·F3, 정밀 충전)이 한 호출 결과에 같이 담기니, 화면은 연쇄 재생이 끝날 때 `deckFires`·`deckCharge`를 함께 보여 주면 된다(재생 중에 막대를 올리고 싶으면 `before`·`after`를 보간한다). `releaseCharge`의 `deckCharge`는 정밀 충전까지 합친 값이다.
- **희귀도·★·공명·증폭(5단계 로직, 저장 v15)**: 카드 22장(`CARDS`, 증폭 전설 A1 공구 장인·A2 수집 노트는 태그 없음). `DeckSlot = {id, star 1~3, charge}`, `DeckState.buff = {nextStrike, forceBomb, perfects, boxesInFever}`(C5·S5·F5 진행 값, 이사하면 `emptyBuff()`).
  - 필요 눈금은 카드마다 다르다: `cardChargeNeed(moves, rarity)`, 칸 기준은 `slotNeed(slot, moves)`(일반 40·레어 50·전설 60 x `CHARGE_NEED_SCALE`). 단일 need를 가정한 옛 호출은 `deckMult`·`deckSlotViews`·`deckAllFull`·`deckChargeResult`가 이미 카드별로 바꿨다.
  - 카드 뷰 `deckSlotViews(state)` -> `{id, rarity, star, charge, need, cap(지금 상한 = 3 + ★ + 증폭 보너스), capBonus, mult, full, resonance(0~3, 이중 태그는 높은 쪽), speed(충전 속도 배율)}[]`. 상한 보너스 `slotCapBonuses(state)`.
  - 공명 현황 `deckResonance(state)` -> `{tag, count, level 0~3, speed 1·1.5·2·3}[]`(카드가 있는 태그만, 장수 많은 순). 같은 태그 카드 2·3·4장이면 그 태그 카드의 충전 속도 x1.5·x2·x3(상한은 그대로, `RESONANCE_SPEED`). 이중 태그 카드는 태그별 충전량에 그 태그의 배율을 곱해 합친다. 증폭 전설은 공명을 안 받고 어떤 태그 조건이든 일어나면(충전량 중 최댓값) 찬다.
  - 확률 `deckOfferOdds(state)` -> `{common, rare, legend}`(합 1, 기본 0.6·0.32·0.08. 뽑을 카드가 없는 희귀도는 0으로 빠지고 비율대로 늘어난다). 고르기 3장 모두 희귀도를 따로 굴리고 첫 칸은 가진 태그 카드, 둘째 칸은 없는 태그 카드(증폭 포함), 셋째 칸은 아무 카드다(`rollCardOffer(slots, seed)`, 시그니처 그대로). ★3 카드는 안 나온다.
  - 후보 보기: `isStarUp(state, cardId)` -> 이미 낀 ★3 미만 카드면 true("★ 올리기", 칸을 안 쓰고 `replaceSlot` 불필요). `chooseCard`는 낀 카드를 고르면 ★+1(눈금 유지), ★3 카드는 null.
  - 증폭 상한: 공구 장인(A1)은 꽉 찬 다른 카드 1장마다 +1, 수집 노트(A2)는 완성 도감 세트 1개마다 +1(최대 `AMP_DEX_MAX` = 3). `deckMult(state)`는 이제 `state.collection`도 읽고 캐시 키에 완성 세트 수가 든다. 7번 고르기 안 최대 공구함 배율은 약 x1,470(증폭 2장 + ★ 3개).
- **넘침 스택(S1a, 저장 v16)**: 칸 `{id, star, charge, stacks}`, `deck.chargedStacks`(이 집 충전 스택 누계), `boostPacks`(대기 강화 고르기 묶음), `boostMade`(만든 묶음 수 = 후보 시드). 상수 `STACK_NEED_GROWTH` 1.15·`STACK_STEP` 0.15·`STACK_PICK_EVERY` 6·`STACK_DUP` 3·`STACK_BOOST` 2(`data/cards.ts`).
  - 충전(`addCharge`)은 멈추지 않는다: 눈금이 `stackNeed(need, stacks)` = need x `STACK_NEED_GROWTH`^스택에 닿을 때마다 스택 +1, 남은 눈금은 이어서 찬다(한 번에 여러 스택). 처음 꽉 찬 순간이 첫 스택이다. 충전 스택 누계가 6의 배수를 넘을 때마다 `boostPacks`·`boostMade` +1.
  - 카드 배수 = (스택 0이면 `1 + (상한-1) x min(1, 눈금/필요)`, 1 이상이면 꽉 찬 값) x `stackMult(stacks)` = (1 + 0.15 x 스택). 공구함 배율은 넘침·충전으로 줄지 않는다. `slotFull(slot, moves)` = 스택 1 이상 또는 눈금 >= 필요(`full`·A1·`deckAllFull`이 쓴다).
  - 고르기: ★3 카드도 후보에 나오고 `chooseCard`로 고르면 칸을 안 쓰고 스택 +3(`isStackDup(state, id)`). 교체하면 눈금 0, 스택 절반(내림) 이어받기. 이사하면 전부 0. 고르기·중복·이어받기로 얻은 스택은 누계에 안 들어간다.
  - 강화 고르기: `deckBoostPacks(state)`(대기 수)·`deckBoostIn(state)`(다음 묶음까지 남은 충전 스택 1~6)·`boostOffer(state)` -> `({kind:'boost', slot, stacks:2} | {kind:'card', id})[]`(맨 앞 묶음. 낀 카드 둘 boost + 새 카드 1, 낀 카드 1장이면 boost 1 + 카드 2, 0장이면 카드 3)·`chooseBoost(state, optionIndex | null, replaceSlot?)`(null = 묶음 버리기, card는 `chooseCard`와 같은 규칙).
  - `deckSlotViews`에 `stacks`·`stackNeed`(지금 스택의 필요 눈금)·`stackMult`가 더해졌다.
  - **화면이 쓰는 조회·사건(S1b)**: 칸별 `deckSlotViews(state)[i]` = `{stacks, charge, need(스택 0 기준 완성 눈금), stackNeed(다음 스택까지 눈금), mult, stackMult, nextStackMult(다음 스택이 오르면 이 카드 배수), full}`, 덱 스택 합 `deckStackSum(state)`. "방금 스택이 올랐다"는 정산 결과의 `deckCharge`(`tapAndHit`·`heavyHit`·`releaseCharge` 공통, `DeckChargeResult`)에 실린다: `stacked: StackEvent[]`(`{slot, id, from, to}`, 오른 칸마다 하나, 칸의 카드가 같을 때만), `boostPacks`(이번에 새로 쌓인 강화 묶음 수), `stackSum`(정산 뒤 스택 합). 그 칸의 연출은 `stacked`가 비어 있지 않을 때만 붙이면 된다.
  - 카드 효과 새 필드(`deckEffects`): `shieldAdd`(`gearEffects.shieldMax`에 합쳐져 화면은 그대로), `shieldChargePerfects`(화면이 `resolveStreak(…)`의 실드 충전 퍼펙트 수 `SHIELD_CHARGE_PERFECTS`를 이 값으로 바꿔야 한다. 아직 안 바뀜), `chainStep`(`chainBonus`의 3번째 인자), `bombBlast`(`specialUi`의 문구 "상자 5개"는 화면이 `deckEffects(state).bombBlast`로 바꿔야 한다), `feverMultAdd`(`feverMultOf(fever, add)`, 피버 배율 문구는 x3 고정이라 화면이 바꿔야 한다).
  - 발동 카드: P5는 `releaseCharge`가 `deckFires`에 `{taps, gain}`을 붙이고 P를 더한다, C5·S5는 `deck.buff`(`deckBuffAfterStrike`), S5는 `hitBox`가 다음 일반 상자를 폭탄으로 바꾸고, F5는 `economy.tick`이 피버 종료를 보고 상자 수 x 탭 1회 수익 x 2를 P에 더한다(`deckFeverEnd`; 화면에 알리는 이벤트는 아직 없다).
  - 충전 상수(`CHARGE_RULES`, 5단계 값): 정밀 퍼펙트 +4(연속 10의 배수 +9), 연쇄 150연쇄마다 +1(강타당 최대 +2), 특별 상자 +1(강타당 최대 +1), 피버 중 강타 +1·켜질 때 +4.
- 덱 시뮬: `DECK=없음,정밀,연쇄,특별,피버`(쉼표로 여럿)는 원형별 이사 시각 표·첫 이사 뒤 누적·문턱 통과 시점·문턱 자릿수 d 후보만 출력한다(`DECK`을 안 주면 기본 출력 그대로). 문턱마다 원형 태그 카드를 우선 고르고 칸이 차면 원형 밖 카드부터 바꾼다. `DECK=고정:P2+P3`은 이사마다 그 카드들을 끼고 시작하는 시험용. `SEED_N`(최대 20)·`SEED_FROM`·`DECK_DUMP=파일`·`DECK_LOAD=a.json,b.json`(나눠 돌린 결과 합치기). 시뮬은 추정이다: 집별 시간은 앞 집 결과에 끌려가 잡음이 크고(P3는 퍼펙트 25%라 연속 10이 거의 안 나와 효과가 안 보인다), 같은 카드가 집에 따라 -20%~+30%로 흔들린다.

## 시뮬 도구
`node tools/box-sim.mjs`: 실제 로직을 vite ssr로 불러 한 판을 초 단위로 돈다. 정책 3개(기본·고수·가볍게) x 시드 5개(`SEED_N`으로 최대 10개). 환경변수 `POLICY=기본,고수,가볍게`·`SEED_N`(시드 수)·`GATES=0,0,4e3,...`(가이드 문턱 18개 덮어쓰기)·`NOBOX=1`(선물 상자 없이)·`NOPERK=1`(특전을 안 고르는 비교용)·`PERK_SHARE`(특전 상자 구매 기준, 기본 0.35)·`DBG=1`(단계 완료 때 상태 출력)·`TARGETS=1e10,1e11,...`는 집 목표를 메모리에서만 덮어쓰고 `MAX_MOVES`(기본 6)·`MAX_SEC`(기본 5시간)로 범위를 줄인다. 집 목표를 바꿀 땐 이 도구로 이사 시각을 다시 본다. 정책은 가이드를 따른다(잠긴 요소는 못 쓰고 지금 단계 목표를 우선 수행). 출력에 첫 특전 시각·이사 때까지 산 특전 상자 수(집마다), 가이드 단계별 완료 시각, 첫 집의 누적 P 1e3·1e6·1e9·1e12·1e15 도달 시각, J 커브(자릿수/분)가 더해졌다.
