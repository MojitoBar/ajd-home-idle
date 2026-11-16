# 로직 공개 API (M2)
모두 순수 함수. 난수 `rng: () => number`(0 이상 1 미만)와 시간은 인자로 넘긴다. 상태 변경 함수는 새 `GameState`를 돌려준다.

## 상자·도감 (`gacha.ts`, 데이터 `data/collectibles.ts`)
- `oddsTable()` -> `{rarities[], variants[]}` 각 항목 `{id,name,prob,percent,weight,...}`. 상자 화면에 항상 표시(합 100%).
- `boxPrice(state)` 가격. `openBox(state, rng)` -> `{state, result}` 또는 P 부족 시 `null`. `result={item,variant,isNew,count,prevLevel,level,nextNeed,completedSets}`. 가격은 `max(5000, 60 x ppsStable) x 1.06^boxesThisRun x 특전 할인`.
- `openBoxes(state, rng, 10)` -> `{state, results[]}` (P 모자라면 중간에 멈춤, 0개면 빈 배열). 10개를 모두 열 수 있고 앞 9개가 전부 일반이면 10번째는 레어 이상(`rollBox(rng, true)`, 난수 호출 순서는 그대로).
- 칸 레벨(`collection.ts`): `slotLevel(count)`(1·3·7·15·31개 = Lv 1~5), `slotNextNeed(count)`, 칸 기여 = 등급 가중 x 변이 가중 x (1 + 0.5 x (Lv-1)). 등급 세트(`SETS` 데이터, `setProgress`, `setEffects`)는 `perkEffects`에 합쳐지고 오프라인 보상은 `offlineMult`로 곱한다. 저장 형식은 v4 그대로(개수만 저장).
- `collectionProgress(state)` -> `{mult(C), registered, total(80), byRarity[]}`. `isRegistered(state,itemId,variant)`.
- 도감 전체 목록: `COLLECTIBLES`(id,name,emoji,rarity), `VARIANTS`(emoji/name). 슬롯 개수는 `state.collection[id][variant]`(0=미등록, 중복은 개수만 증가).
- C는 `economy.collectionMult`로 `globalMult`(탭·pps)에 자동 반영.

## "모르면 손해" 이벤트 (`event.ts`)
호출 순서: `tick(state, dt, rng)` 가 타이머 진행 -> `state.event.bannerSec > 0` 이면 배너 표시 -> 클릭 시 `startQuestion(state, rng)`(배너 없으면 `null`) -> `state.event.question` 으로 카드 표시(`order`=[왼,오른] 카드 라벨, A=고정형·B=할인형, 계산 도우미·힌트 없음) -> `answerQuestion(state, 'A'|'B', rng?)` (문제 없으면 `null`).
- 문제 시간 15초(`questionSec`)는 tick이 줄이고 0이 되면 시간 초과(오답) 처리. 배너 20초 지나면 소멸.
- 결과는 `state.event.result`(`correct,choice,timedOut,answer,totalA,totalB,rewardSec`). 해설을 띄운 뒤 `clearEventResult(state)`.
- 배율 배지: `eventMult(state)`(x3 또는 1), 남은 시간 `state.event.remainSec`. 연속 정답 `event.streak`.
- 탭이 안 보일 땐 `tick`을 호출하지 말 것(타이머 정지). tick의 `rng`는 다음 발생 시각(8~12분) 추첨용(생략 시 10분).

## 상태 필드 (v2)
`event`: `nextInSec`(대기), `remainSec`(E 남은 초), `streak`, `bannerSec`, `question`, `questionSec`, `result`. 배너·문제·결과는 저장되지 않음(불러오면 대기 상태). 이사 시 도감·streak 유지, 상자 개봉 수·E·진행 중 이벤트는 초기화. 오프라인 보상에는 E 미적용. 저장 버전 2(`migrate` 1->2 포함).

## 탭 (`economy.ts`)
- 탭 1회 수익 `tapValue(state) = (tapBase(L) x 영구 x 도감 + tapRatio(L) x S) x 탭 특전 x 이벤트 x 피버`. S = `ppsStable / 서비스 특전 배율`(서비스 특전·피버·이벤트·약정 제외 초당 수익). 서비스가 없으면 예전 값(`tapBase`)과 같다. 피버·이벤트는 한 번만 곱한다. 약정은 탭 몫에 넣지 않는다.
- `tapRatio(L)` = 0.01 + 0.0005 L + 마일스톤(10·25·50·100)별 +0.01/+0.02/+0.03/+0.05. `nextTapRatio(L)` = `tapRatio(L+1)`. `tapCost(L)` = 20 x 1.25^L(초당 수익과 무관). 상수는 `data/services.ts`의 `TAP_*`.
- `tapBreakdown(state)` -> `{level, ratio, flat, fromPps, total}`: 탭 특전·이벤트·피버 적용 후 기본값 몫(flat)과 초당 수익 몫(fromPps). `total === tapValue`. `tapFlatValue(state)`는 flat만(택배 상자 최소 보장 기준).
- `multBreakdown(state,'tap')`은 기본값 몫 배율만 뜻한다(`total x tapBase = flat`, 초당 수익 몫은 포함 안 됨).
- 탭 특전 손목 단련은 +100%/레벨(기존 +40%), 초당 탭 6회(`TAPS_PER_SEC_FULL`)까지 전액, 12회(`TAPS_PER_SEC_ACCEPT`)까지는 접수하되 기본값 몫만, 초과는 무시(아래 탭 상한 절).
- 저장값 정리(`sanitize`): 약정이 칸 수(`BASE_CONTRACT_SLOTS` + 약정 칸 특전)를 넘으면 초과분을 버린다(같은 서비스 중복은 기존대로 버림).
- 화면에서 바꿔야 할 문구: 탭 강화 설명("탭 +N" 같은 고정 증가량)을 "탭 비율 x% -> y%"와 `tapBreakdown`의 기본값 몫·초당 수익 몫으로, 탭 1회 표시값은 `tapValue`(치명타는 `tapWithRng`의 gain), 강화 후보 가격은 `tapCost`(1.25배씩), 상한 안내 "초당 12회"는 6회, 손목 단련은 +100%(데이터 `desc`에서 가져오면 자동).

## 탭 변주 (`fever.ts` 상수·타이머, `variety.ts` 동작)
- `tapWithRng(state, rng)` -> `{state, gain, crit}`: 치명타(5%, x6) 판정 + 피버 충전 + 포인트 반영. 기존 `applyTap`(난수 없음)은 치명타·충전 없이 그대로. UI 탭은 `tapWithRng`로 교체.
- 피버: `state.fever={gauge(0~45탭, 초당 1.2 감쇠), activeSec, cooldownSec}`, `feverRatio(state)`(0~1, 피버 중엔 남은 시간 비율). 발동 중엔 `tapValue`·`pps`(globalMult)에 x3 자동 반영. `tick`이 감쇠·종료·재충전 제한 진행.
- 택배 상자: `state.parcel={nextInSec, remainSec}`, `parcelVisible(state)`(remainSec>0이면 떠 있음, 남은 시간 표시). `tick(state, dt, rng)`이 등장(60~120초 간격)·8초 만료 처리(rng 생략 시 90초).
- 잡기: `catchParcel(state, rng)` -> `{state, reward}` 또는 `null`(안 떠 있음). `reward`는 `{kind:'points', gain, seconds}` 또는 `{kind:'box', result: BoxResult}`(무료 상자, 가격·개봉 수 불변).
- 호출 순서: 탭 `tapWithRng` -> 매 프레임 `tick` -> 상자 클릭 `catchParcel`. 피버·택배는 저장 안 함(불러오면 초기값), 이사 시 피버만 초기화, 오프라인엔 피버 미적용.
- 이사 목표가 상향됨(원룸 8e6 등, `data/houses.ts`): 변주 3종이 속도를 높이므로 10~15분 목표 유지용.

## 누르는 방식 변주 (`charge.ts`, `weak.ts`; 공용 `unpack.heavyHit`, `combo.comboAdd`)
- `heavyHit(state, rng, taps, comboMult, feverCharge)` -> `tapAndHit`과 같은 필드 + `bursts[]`: 탭 taps번어치 수익·상자 타격을 한 번에(치명타 1회, 피버는 feverCharge). 콤보는 `comboAdd(c, nowMs, add)`로 따로 올린다.
- 꾹 눌러 강타: `CHARGE_HOLD_MS` 넘게 누르면 `chargePos(elapsedMs, chargeSpeed(streak))`가 0~1을 왕복, 뗀 자리로 `releaseCharge(state, rng, pos, streak, comboMult)` -> `{...heavyHit, grade, streak, comboAdd}`. 보상은 `CHARGE_REWARD`.
  - 스윙마다 구간이 바뀐다: `rollChargeZone(rng, prev?)`(가운데 0.35~0.87, 직전과 0.15 이상 떨어짐) -> `ChargeZone {perfect, good}`, `chargeGrade(pos, zone)`·`releaseCharge(..., tapsMult, zone)`에 넘긴다(생략하면 `CHARGE_ZONE_DEFAULT`, 가운데 0.83).
- 급소: `WeakState`(`initialWeak`, `advanceWeak(w, dt, active, rng)` -> `{weak, appeared, vanished}`, `weakHitTest(w,u,v,radius)`, `hitWeak(state, rng, w, comboMult)` -> `{...heavyHit, weak, comboAdd}`). 저장 안 함.

# 전략 요소 (v4): 결합 할인 · 이사 특전 3택 · 약정
저장 버전 4(`migrate` 2->3, 3->4). 기존 export는 시그니처 그대로이고, 아래는 새 함수·새 state 필드다. 규칙·수치는 `DESIGN.md` 16절.

## 새 state 필드 (모두 저장됨)
- `perks: Record<perkId, 레벨>` 영구 특전 레벨. 이사해도 유지.
- `perkOffers: string[][]` 선택 대기 중인 특전 3택 묶음(오래된 순, 묶음당 perkId 3개). 새로고침해도 같은 후보가 유지된다. 이사 시 1묶음 추가, 선택하면 그 묶음 삭제. 여러 묶음이 쌓여도 게임은 막히지 않는다.
- `contracts: {service, kind:'short'|'normal'|'long', remainSec, totalSec, penaltyBase}[]` 진행 중 약정. `totalSec`·`penaltyBase`는 체결 때 고정(v4에서 추가, 3->4 migrate가 현재 집 목표와 종류로 채움, `sanitize`가 누락·음수·NaN·과대값을 고침). `tick`이 줄이고, `applyOffline`이 실제 경과 시간만큼 줄인다. 이사하면 비움.

## 호출 시점 요약
- 매 프레임 `tick(state, dt, rng)` 하나로 약정 시간·약정 수익이 함께 처리된다(별도 호출 없음).
- 시작·복귀 시 `applyOffline(state, now)`: 약정 남은 시간만큼만 배율 반영, 남은 초는 실제 경과만큼 감소. 상한·효율은 특전 반영값이므로 문구엔 `offlineCapSec(state)`·`offlineRate(state)`(`offline.ts`)를 쓴다(`OFFLINE_CAP_SEC` 상수는 기본값 8시간이라 특전을 못 본다).
- 이사: `moveStatus(state)`로 버튼 상태·사유를 그리고, 확인 시 `move(state, rng?)`. 인자 rng는 특전 3택 추첨용(`() => Math.random()`을 넘길 것, 생략하면 이사 횟수 기반 결정적). **주의**: `move`/`canMove`는 이제 위약금(약정이 남은 채 이사)을 보유 P가 못 내면 `null`/`false`다. 이사하면 P는 0으로 초기화되므로 위약금은 사실상 이사 자격 조건이다.

## 결합 할인 (`bundle.ts`, 데이터 `data/bundles.ts`)
- `bundleStatuses(state)` -> `BundleStatus[]` 5개: `{id,name,emoji,services:[{index,name,level}],minLevel,stage(0~4),mult(현재 배율,1이면 없음),nextLevel|null,nextMult|null,lacking:[{index,name,level,need}]}`. `lacking`은 다음 단계까지 레벨이 모자란 서비스와 필요한 추가 레벨(화면 문구 "휴대폰 +13레벨이면 x2").
- `bundleMultFor(state, serviceIndex)` 서비스 하나에 걸린 결합 배율(두 결합이면 곱). 서비스 수익(`serviceProd`·`pps`)에 자동 반영.

## 이사 특전 3택 (`perks.ts`, 데이터 `data/perks.ts`)
- `perkOfferViews(state)` -> `PerkOptionView[][]` 대기 묶음별 옵션 `{id,name,emoji,category('tap'|'idle'|'luck'|'strategy'),desc(레벨당 효과),level,maxLevel,maxed}`. `pendingPerkCount(state)`는 대기 묶음 수(배지용).
- `choosePerk(state, offerIndex, perkId)` -> 새 state 또는 `null`(묶음에 없음/최대 레벨). 선택한 묶음이 삭제된다. 이미 최대인 옵션은 `maxed`로 비활성 표시.
- `discardPerkOffer(state, offerIndex)` 묶음의 모든 옵션이 최대일 때만 버릴 수 있다(아니면 `null`).
- `perkEffects(state)` 현재 특전 효과 수치 모음(`tapMult, critChance, critMult, feverSec, serviceMult, offlineRate, offlineCapSec, boxPriceMult, parcelDelayScale, bundleBoost, extraSlots, penaltyMult`). 이미 `tapValue`·`tapWithRng`·`pps`·`boxPrice`·`tick`(택배)·`applyOffline`·결합·약정·위약금에 반영돼 있다. 피버 게이지 비율을 그릴 땐 `feverRatio(state, perkEffects(state).feverSec)`(두 번째 인자 생략 시 기본 10초). `PERKS`(데이터)로 전체 목록(도감식 "내 특전" 화면)을 그릴 수 있다.

## 약정 (`contract.ts`, 데이터 `data/contracts.ts`)
- `CONTRACTS`: 짧게 5분 x1.5 / 보통 15분 x2 / 길게 60분 x3.
- `startContract(state, serviceIndex, kind)` -> 새 state 또는 `null`. 중도 해지 없음.
- `contractBlock(state, serviceIndex)` -> `null`(가능) | `'locked'`(레벨 0) | `'busy'`(이미 약정 중) | `'full'`(빈 칸 없음). 버튼 비활성 사유용.
- `contractStatuses(state)` -> `{service,kind,remainSec,mult,penalty}[]`(남은 초·약정별 현재 위약금(특전 감면 반영) 표시). `contractOf(state, i)`, `contractMultFor(state, i)`.
- `contractSlots(state)` 전체 칸(기본 2 + 특전), `freeContractSlots(state)` 빈 칸.
- `contractExtraPps(state, serviceIndex)`(`economy.ts`) 약정이 늘려 주는 초당 수익("약정으로 +N/초" 표시용).
- 위약금(`prestige.ts`, 새 규칙): **체결하는 순간 기준 금액이 정해지고 그 뒤로는 줄어들기만 한다.** `penaltyBase = houseInfo(moves).target x 종류별 비율(`penaltyRate`: 5분 2%·15분 5%·60분 15%) x 집별 보정 계수(`PENALTY_HOUSE_SCALE`, 데이터 `data/contracts.ts`)`. `contractPenalty(state)` = Σ `penaltyBase x remainSec/totalSec` x 특전 감면(`penaltyMult`, 계산 시점 값). 서비스 레벨·결합·도감·피버·이벤트·탭과 무관. 이사하면 0. 예(특전 없음): 원룸 5분 1.1M·15분 2.75M·60분 8.25M P, 아파트 5분 60M·15분 150M·60분 450M P.
- 미리 보기: `contractPenaltyPreview(state, kind)`(`contract.ts`) = 지금 그 종류를 걸면 시작하는 위약금(특전 감면 반영). 보조: `contractPenaltyBase(moves, kind)`, `contractPenaltyNow(contract)`(감면 전). `houseInfo`는 `house.ts`로 옮겼고 `prestige.ts`가 그대로 재수출한다.
- `moveStatus(state)` -> `{ok, reason:null|'target'|'penalty', targetReached, penalty, penaltyShortfall}`. 이사 확인창에 "위약금 N P가 빠져요"를 띄우고, `reason==='penalty'`면 "P가 N 모자라요 / 약정 만료를 기다려요".
- 집별 보정 계수는 [1, 1, 1, 0.07, 0.02](이사 횟수 0~4), 표를 넘는 집은 마지막 값(미검증). 이유: 이사 시점 "목표 ÷ 초당 수익"이 원룸~아파트 약 200~300초인데 펜트하우스 이후는 수천 초라 단일 비율로는 위약금이 초반엔 장식이거나 후반엔 수십 분어치가 된다(시뮬레이션).

## 탭 상한 (`economy.ts`, `variety.ts`)
- `tapGate({recent, tokens, lastMs}, nowMs)` -> `{ok, damped, recent, tokens, lastMs}`(`initialTapGate()`로 시작). 전액 탭 허용량은 용량 6, 초당 6개씩(`TAPS_PER_SEC_FULL`) 연속으로 다시 찬다. 접수된 탭이 토큰 1 이상이면 1을 쓰고 전액, 아니면 `damped:true`. 최근 1초 12회(`TAPS_PER_SEC_ACCEPT`) 이상이면 `ok:false`(무시). 초당 6회 이하는 전부 전액, 초당 10회면 약 6/10이 전액으로 고르게 섞인다. 오래 쉬어도 토큰은 6을 넘지 않는다.
- 감쇠 탭은 초당 수익 비례 몫 없이 기본값 몫(`tapFlatValue`)만 주고, **치명타가 되지 않으며**(전액 탭에서만 판정, 치명타 gain = 그 순간 전액 탭 값 x `critMult`), 피버는 전액 탭 +1·감쇠 탭 +0.5만큼 채운다(`chargeFever(f, feverSec, amount)`). `tapValue(state, damped=false)`, `applyTap(state, damped=false)`, `tapWithRng(state, rng, damped=false)` -> `TapResult.damped` 포함.
- 시뮬레이션(상한 12회): 연타/무탭 달 기지 속도 균형 x3.24, 탭 특전 x3.74, 방치 특전 x2.64(전부 4배 이하).

## 화면에서 바꿔야 할 것
1. **탭 처리(가장 먼저)**: `src/ui/app.ts`의 `doTap`이 `tapWithRng(state, rng, gate.damped)`로 `gate.damped`를 넘겨야 한다. 지금은 안 넘겨서 7~12번째 탭이 전액으로 들어간다. 감쇠 탭이면 `r.damped`로 약한 이펙트(작은 숫자 등)를 줘도 좋다.
2. 약정 시트: 종류 버튼마다 "지금 이사하면 위약금 ○○ P부터, 시간이 지날수록 줄어요"(`contractPenaltyPreview(state, kind)`). 진행 중 약정 줄에는 `contractStatuses(state)[i].penalty`.
3. 이사 확인창·약정 설명의 옛 문구 "남은 초 x 약정 수익 x 0.5"를 새 규칙(체결 순간 정해지고 줄어듦, 서비스를 사도 안 늘어남)으로.
4. 탭 강화 설명(탭 개편에서 넘어온 항목): "탭 +N" 대신 "탭 비율 x% -> y%"(`tapRatio`)와 `tapBreakdown`의 기본값 몫·초당 수익 몫.
5. 탭 상한 안내: 옛 "초당 12회" 문구 대신 "초당 6회까지 전액, 12회까지 접수(초과분은 기본값만)".
6. 손목 단련 +100%/레벨(데이터 `desc`에서 가져오면 자동).


## 배율 분해 (`economy.ts`)
`multBreakdown(state, target)` target은 서비스 인덱스 또는 `'tap'` -> `{permanent, collection, event, fever, bundle, contract, perk, total}`. 서비스면 `total x 서비스 기본 수익 = serviceProd`, 탭이면 `total x tapBase = 기본값 몫`(초당 수익 몫은 `tapBreakdown`, 치명타 제외, 확률은 `perkEffects.critChance`). 탭은 bundle·contract가 1, perk는 탭 특전. 기존 `globalMult`는 영구·도감·이벤트·피버만 포함한 그대로다(결합·약정·특전은 서비스별이라 빠져 있음). 서비스별 수익 `serviceProd(state,i)`, 약정 제외 `serviceProdNoContract`, 전체 `pps`(약정 포함)/`ppsNoContract`.

## 상자 가격 (버그 수정)
`boxPrice`는 일시 배율(피버·이벤트 E·약정)을 뺀 `ppsStable(state)` 기준이다. 영구·도감·결합·특전 배율은 포함하고 상자 가격 할인 특전을 곱한다. 택배 상자 포인트 보상은 현재 `pps`(일시 배율 포함) 기준 그대로.

## 이삿짐 상자 풀기 (`unpack.ts`, 데이터 `data/unpack.ts`, 설계 `DESIGN-UNPACK.md`)
`state.unpack = { box, damage, roomDone }`(저장 v5, 이사 때 초기화). 탭은 `tapAndHit(state, rng, damped)` -> `TapResult & { burst: BoxBurst | null }`. 감쇠 탭은 상자 피해 0.
- `boxKind(k)`, `boxHp(k)`, `unpackPower(state)`, `toolOf(level) -> {minLevel,name,emoji}`, `hitBox(state, {crit,damped,feverMult,rng?,critMult?}) -> {state, burst}`.
- `roomProgress(state) -> {opened,total,slotsDone,slotFill,complete}`, `boxCondition(state) -> {kind,k,hp,damage,ratio,stage,stages}`(겉모습 단계: 작은·보통 3, 큰 4).
- `BoxBurst = {kind,k,gain,item?,slot?,slotFill,roomDone,freeBox?}`. 탭 1회 P는 `TAP_BOX_SCALE`(0.6)배, 덜어 낸 몫은 터질 때 `tapValue x K`로 준다.

## 콤보 (`combo.ts`)
순수 함수, 시간(ms)은 인자. `ComboState {n,lastMs,earned}`는 저장 안 함. `comboHit(c, nowMs, comboWindowMs(feverActive), damped)` -> `{combo, tierUp, ended}`, 배율 `comboMult(n)`(10·25·50·100·200 -> x1.2·1.5·2·3·5, `COMBO_TIERS`), 남은 수 `comboNext(n)`, 끝났을 때 정산 `comboBonus(c)`(earned x 10~50%). `tapAndHit(state, rng, damped, comboMult)`의 배율은 gain에만 곱한다. 최고 콤보 `state.bestCombo`는 저장되고 이사해도 남는다(저장 버전은 그대로, 없으면 0).

## 열기 (`heat.ts`)
순수 함수, 시간(ms)은 인자. `HeatState {v 0~100, overMs}`는 저장 안 함(`initialHeat()`). 탭 `heatTap(h)`·급소 `heatAdd(h, HEAT_WEAK)` -> `{heat, overheated}`, 시간 `advanceHeat(h, dtMs, hold)` -> `{heat, recovered}`(초당 12씩 식고 hold 중엔 안 식음, 100이면 과열 3초: 오르지 않고 v가 100 -> 0). `heatZone` cool/warm(40)/hot(70)/over, `heatTapMult`(hot x1.5)·`heatDamped`(과열 중 약한 탭), 강타 `heatStrikeMult(h, grade)`(퍼펙트·굿 1 + v/50)를 `releaseCharge(..., comboMult, tapsMult)`에 숫자나 `(grade) => 배율`로 넘기고, 뗀 뒤 `ventHeat(h)`(20까지).
