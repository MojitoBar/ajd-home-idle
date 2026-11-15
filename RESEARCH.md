# 로블록스 무한 성장·증분·방치·수집형 게임 레퍼런스 조사

기준일 2026-11-13. 조사 방법은 Aside 공식 CLI(`aside-real exec`)로 하고, 수치는 출처 URL을 붙였다. 확인 못 한 것은 "미검증", 필자 추정은 "(추정)"으로 표시했다. 동접은 집계처와 시각에 따라 크게 달라서 기준 시각을 함께 적었다.

## 0. 요약
- 2025년 대세는 Grow a Garden과 Steal a Brainrot이었다. 2026년 11월 현재 1위는 **Steal An Egg**(훔치기+알 부화+펫 수익)이고, 11/13 동접이 83.9만이었다(Endgame Tools).
- 2025년 히트작은 대부분 동접이 크게 줄었다. Grow a Garden은 최고 약 2,160만에서 약 1.1만으로, Steal a Brainrot은 최고 약 2,500만대에서 4.7만~6만 수준으로 내려왔다.
- 2026년 신작은 "훔치기 + 부화/수집 + 업그레이드"를 한데 묶은 조합이고, 파생작이 빠르게 나온다(Break and Steal an Egg, Throw Food For Animals). Roblox 3분기 주주서한은 일부 게임이 AI로 거의 전부 만들어졌다고 언급했다.
- 한국에서는 영문명을 줄인 "그로우 어 가든(GAG)", "브레인롯 훔치기(브훔)"로 불린다. "○○ 키우기"라는 로블록스 호칭은 확인하지 못했다. "○○ 키우기"는 모바일 방치형 RPG 장르명으로 쓰인다.
- 앱 내 키우기 게임은 올웨이즈 올팜(실물 배송 보상)이 대표 사례다. 모바일 방치형 RPG는 쿠키런 키우기(출시 한 달 매출 200억 원, 회사 발표)와 메이플 키우기가 성과를 냈다.

## 1. 2025~2026 로블록스 무한 성장·증분·방치·수집형 게임

### 표 1. 개요와 코어 루프

| # | 게임 (제작, 출시) | 한 줄 설명 | 코어 루프 | 출처 |
|---|---|---|---|---|
| 1 | Grow a Garden (The Garden Game, 2025-03-25) | 씨앗을 심고 기다렸다 수확하는 농장 방치형 | 씨앗 구매, 심기, 성장 대기(오프라인에도 자람), 수확·판매, 기어·펫으로 강화, 재투자 | [roblox.com](https://www.roblox.com/games/126884695634066/Grow-a-Garden) |
| 2 | Steal a Brainrot (BRAZILIAN SPYDER, 2025-05-16) | 밈 캐릭터를 사서 기지에 두면 돈이 나오고 남의 캐릭터를 훔치는 수집형 PvP | 구매, 기지 슬롯 배치, 초당 수입, 다른 기지 털기, 환생 | [roblox.com](https://www.roblox.com/games/109983668079237/Steal-a-Brainrot) |
| 3 | Steal An Egg (2026-07-25) | 알을 훔쳐 부화시키고 펫으로 돈 버는 2026 최대 히트 | 알 훔치기, 부화, 펫 수익, 트레드밀·기지 업그레이드, 남의 알 훔치기 | [roblox.com](https://www.roblox.com/games/107778070777162/Steal-An-Egg) |
| 4 | Break and Steal an Egg (ILGames x Eggs, 2026-09-05) | 곡괭이로 알을 깨 동물을 얻고 경비를 피해 기지로 옮기는 파생작 | 알 깨기, 부화, 탈출, 기지 주차로 현금, 곡괭이 업그레이드 | [maccus.fr](https://maccus.fr/en/roblox-ai-built-games) |
| 5 | Throw Food For Animals (Goofy Chupacabra, 2026-09-18) | 음식을 멀리 던져 동물을 모으는 타이쿤 | 음식 던지기, 동물 유인·수집, 동물 수입, 더 좋은 음식, 던지는 힘 훈련, 새 지역 | [roblox.com](https://www.roblox.com/games/120219252362013/Throw-Food-For-Animals) |
| 6 | Pet Simulator 99 (BIG Games Pets, 2022-02) | 펫 부화·강화·거래 중심의 장수 증분 수집 게임 | 알 부화, 코인 파괴, 펫 강화, 희귀 펫(Huge/Titanic) 거래 | [bloxg](https://bloxg.com/games/pet-simulator-99) |
| 7 | +1 Speed Keyboard Escape (SecretVerse Studio, 2026-01-18) | 키보드 키 모양 길을 달리며 +1 속도를 쌓는 증분 장애물 게임 | 달리기, 속도 누적, 배율 해금, 경쟁 | [secretverse-studio.com](https://secretverse-studio.com/games/speed-keyboard-escape) |
| 8 | +1 Venom Evolution (Bottled Potential, 2026-10) | 훈련으로 스탯을 올리고 진화 단계를 여는 증분 배틀 | 훈련, 적 처치, Wins로 진화 해금, 새 지역 | [bloxg](https://bloxg.com/games/1-venom-evolution) |
| 9 | Tap Simulator REBORN (Cursor Makers, 2026-08) | 탭하면 코인이 나오는 클릭 방치형 | 탭, 코인, 알 부화, 환생, 섬 해금 | [bloxg](https://bloxg.com/games/tap-simulator-reborn) |
| 10 | Depth Incremental (Core Loop, 2026-10) | 계단을 내려가며 업그레이드 트리를 여는 증분 던전 | 계단 구매, 하강, 업그레이드 트리, 보스, 환생 | [bloxg](https://bloxg.com/games/depth-incremental) |
| 11 | Fish It! (Fish Atelier, 2024-10) | 낚시로 물고기를 모으는 채집형 증분 | 낚시, 수집, 판매, 장비 업그레이드, 이벤트 | [bloxg](https://bloxg.com/games/fish-it) |
| 12 | 99 Nights in the Forest (Grandma's Favourite Games, 출시일 미검증) | 협동 생존. 증분형은 아니지만 2025 히트작이라 비교용으로 포함 | 낮 채집·제작, 밤 방어, 기지 확장, 부활 | [roblox.com](https://www.roblox.com/games/79546208627805/99-Nights-in-the-Forest) |

### 표 2. 인기 지표와 흥행 이유

| # | 게임 | 동접 (기준 시각) | 누적 방문 | 왜 떴나 | 출처 |
|---|---|---|---|---|---|
| 1 | Grow a Garden | 11,043 (11/12). 2025-06 최고 21.6M(Guinness 기록 보도). 22.3M으로 적은 자료도 있음 | 36.0B | 16세 제작자가 단기간에 만들고 라이브 업데이트를 이어감. 친구 수에 따라 돈 보너스(+10%/인)를 주는 구조 | [bloxg](https://bloxg.com/games/grow-a-garden), [SecretBlox](https://secretblox.com/grow-a-garden/stats), [Roblox 뉴스룸](https://about.roblox.com/newsroom/2025/06/roblox-infrastructure-supporting-record-breaking-games), [GamesBeat](https://gamesbeat.com/janzen-madsen-interview/) |
| 2 | Steal a Brainrot | 47,154 (rblxdb 11/12), 61,400 (bloxodes), 31,383 (bloxg 11/13). 2025-10 최고 25.4M~25.9M(자료마다 다름) | 74.4B | 밈 수집과 훔치기 루프. 2026-01 Bruno Mars 가상 콘서트 최대 동시 시청 12.7M 전후. 2026년 들어 피크가 계속 감소 | [rblxdb](https://rblxdb.com/best-roblox-games/most-popular), [Guinness](https://www.guinnessworldrecords.com/world-records/503322-most-concurrent-players-for-a-videogame-made-in-roblox), [Guinness 2026](https://www.guinnessworldrecords.com/news/commercial/2026/2/bruno-mars-hosts-largest-concert-in-a-videogame-during-steal-a-brainrot-on-roblox) |
| 3 | Steal An Egg | 838,755 (11/13 11:21 UTC). 2026 최고 14.3M (9/19). 집계처별로 59만~120만 차이 | 11.1B | 훔치기+수집+업그레이드를 한 번에 묶고 희귀도·크기·변이 시스템을 넣음. 7월 말 출시 후 9월 폭발 | [Endgame Tools](https://endgametools.com/en/roblox/charts), [Statroblox](https://statroblox.com/top-100/2026), [Player.One](https://www.player.one/robloxs-steal-egg-beating-some-platforms-biggest-games-164086) |
| 4 | Break and Steal an Egg | 91,851 (11/13). 2026 최고 1.31M | 423.2M | Steal An Egg 파생작. Roblox 3분기 주주서한에서 AI로 거의 전부 만든 사례로 언급 | [Endgame Tools](https://endgametools.com/en/roblox/charts), [MACCUS](https://maccus.fr/en/roblox-ai-built-games) |
| 5 | Throw Food For Animals | 330,667 (11/13, 2위). 2026 최고 1.59M | 196.3M | 9월 출시 후 약 7주 만에 상위권. 조작이 단순하고 동물 수집과 지역 해금 구조 (추정) | [Endgame Tools](https://endgametools.com/en/roblox/charts), [Timesaver](https://timesaver.gg/blog/throw-food-for-animals-codes) |
| 6 | Pet Simulator 99 | 50,607 (11/12). 2026 평균 68,923 | 2.7B | 2022년부터 운영 중인 장수 게임. 3,000종 이상 펫과 거래 경제 | [bloxg](https://bloxg.com/games/pet-simulator-99), [Statroblox](https://statroblox.com/top-100/2026) |
| 7 | +1 Speed Keyboard Escape | 13,990 (11/12). 2026 평균 182,359. 8월 관측 피크 5.55M | 6.7B | 한 가지 스탯만 올리는 극단적으로 단순한 루프와 ASMR 감성 연출 (추정) | [bloxg](https://bloxg.com/games/x100-1-speed-keyboard-escape-candy-chocolate), [Statroblox](https://statroblox.com/top-100/2026) |
| 8 | +1 Venom Evolution | 9,791 (10/22). 피크 24,248 | 5.2M | 2026-10 신작. 좋아요 97%, 즐겨찾기 33.5K. 최신 수치 미검증 | [bloxg](https://bloxg.com/games/1-venom-evolution) |
| 9 | Tap Simulator REBORN | 36,225 (10/28). 피크 77,714 | 24.2M | 즐겨찾기 128.5K, 좋아요 95%. 최신 수치 미검증 | [bloxg](https://bloxg.com/games/tap-simulator-reborn) |
| 10 | Depth Incremental | 4,335 (10/29) | 725K | 출시 초기. 현재 수치 미검증 | [bloxg](https://bloxg.com/games/depth-incremental) |
| 11 | Fish It! | 63,050 (11/12). 피크 160,550 | 4.8B | 2024년 출시 후 장기 상위권. 이벤트 업데이트가 계속됨 | [bloxg](https://bloxg.com/games/fish-it), [Statroblox](https://statroblox.com/top-100/2026) |
| 12 | 99 Nights in the Forest | 139,692 (11/13). 2026 평균 205,006 | 30.5B | 공포와 협동 생존 콘셉트로 장기간 상위권 | [Endgame Tools](https://endgametools.com/en/roblox/charts) |

### 표 3. 2026-11-13 동접 상위 10 ([Endgame Tools, 11/13 11:21 UTC](https://endgametools.com/en/roblox/charts))

| 순위 | 게임 | 동접 |
|---|---|---|
| 1 | Steal An Egg | 838,755 |
| 2 | Throw Food For Animals | 330,667 |
| 3 | Blox Fruits | 314,505 |
| 4 | Brookhaven RP | 301,504 |
| 5 | Adopt Me! | 164,881 |
| 6 | RIVALS | 142,345 |
| 7 | 99 Nights in the Forest | 139,692 |
| 8 | Murder Mystery 2 | 132,339 |
| 9 | Break and Steal an Egg | 91,851 |
| 10 | Anime Adventures | 84,548 |

2026년 평균 동접(8/7~11/10, [Statroblox](https://statroblox.com/top-100/2026)): Steal An Egg 1.51M, +1 Speed 182K, 99 Nights 205K, Steal a Brainrot 163K.

관찰: 10위 안에 순수 증분 게임은 드물고 "훔치기·수집·타이쿤" 하이브리드가 상위를 차지한다. 한 게임의 절정 기간은 몇 주~몇 달이며, 이후 파생작에 유저를 뺏긴다.

## 2. 장르 공통 설계 패턴

이 절은 위 게임들의 루프와 일반 장르 지식을 종합한 분석이다. 개별 수치는 출처가 없으며 설계 일반론으로 읽을 것(출처 검증 안 됨).

| 패턴 | 내용 | 대표 예 |
|---|---|---|
| 코어 루프 | 행동 한 가지(탭/달리기/던지기/심기)가 재화로 바뀌고, 재화가 그 행동의 효율을 올린다. 첫 30초 안에 첫 구매가 일어나게 한다 | +1 Speed, Tap Simulator, Throw Food |
| 숫자 성장 | 비용은 지수(대략 1.1~1.5배/레벨), 수익은 선형~약한 지수로 둬서 "다음 구매까지 대기"가 점점 길어진다. 큰 숫자 표기(K, M, B)로 성장 체감을 줌 | 전반 |
| 환생(prestige) | 진행을 초기화하고 영구 배율을 얻는다. 한 판이 끝나는 지점을 만들어 반복 동기를 준다 | Steal a Brainrot, Tap Simulator, Depth Incremental |
| 오프라인/방치 보상 | 접속하지 않아도 자라거나 수입이 쌓인다. 복귀 이유를 만든다 | Grow a Garden(오프라인 성장), 기지 자동 수입 |
| 희귀도·돌연변이·뽑기 | 알 부화, 크기·변이, 희귀 등급으로 "대박" 순간을 만든다. 확률형이므로 한국에서는 표시 의무 이슈가 있다(1-3 참고) | Steal An Egg, Pet Simulator 99 |
| 수집 도감 | 종류가 많을수록 콜렉션 동기. 도감 완성 보상이 목표가 됨 | Pet Simulator 99(3,000종 이상), Fish It!(약 1,000종) |
| 순위표 | 전체/친구 순위로 경쟁 동기 | 대부분 |
| 사회 요소 | 약탈(훔치기), 거래, 친구 보너스(GAG +10%/인), 협동. 훔치기는 흥행 요인이자 아이들 갈등 원인이기도 하다 | Steal 계열, GAG, Pet Simulator 99 |
| 한정 이벤트 | 주간·시즌 업데이트와 한정 아이템, 코드 배포로 복귀 유도 | GAG, Fish It!(Halloween) |
| 세션 길이 | 1~5분 단위 짧은 구매 사이클이 반복되고, 총 세션은 길게 이어진다. 방치로 짧은 방문도 가능 | 전반 |

## 3. 한국에서의 반응

### 3-1. 규모와 보도

| 항목 | 내용 | 출처 |
|---|---|---|
| 20대 MAU | 127만 8,789명, 전년 동월 대비 약 +41.3% (2026-09) | [재경일보](https://news.jkn.co.kr/post/1019149) |
| 10대 이하 MAU | 239만 9,746명, 약 -3.4% (2026-09) | [재경일보](https://news.jkn.co.kr/post/1019149) |
| 초등학생 이용률 | 약 90% (2023년 한국언론진흥재단 조사 인용) | [게임제너레이션](https://www.gamegeneration.or.kr/article/58077160-3aa6-4af8-80e1-6702aff5fb80) |
| PC방 | 6월 27일 10위 진입, 7월 5일 최대 20,964명 (2026-07) | [아이러브PC방](https://www.ilovepcbang.com/news/articleView.html?idxno=130027) |
| 2030 확산 | SNS 플레이 영상으로 성인 유입, 힐링 게임으로 언급 (2026-10-12) | [한국경제](https://www.hankyung.com/article/202610126062H) |

### 3-2. 한국에서 불리는 이름

| 한국 호칭 | 원제 | 한국 쪽 정보 | 출처 |
|---|---|---|---|
| 그로우 어 가든 (GAG) | Grow a Garden | 위키백과 항목 있음 | [위키백과](https://ko.wikipedia.org/wiki/%EA%B7%B8%EB%A1%9C%EC%9A%B0_%EC%96%B4_%EA%B0%80%EB%93%A0) |
| 브레인롯 훔치기 (브훔) | Steal a Brainrot | 나무위키에 문제점·비판 문서. 초등학교 "훔치기 게임 금지" 안내문 언급은 1차 출처 미확인 | [나무위키](https://namu.wiki/w/Steal%20a%20Brainrot) |
| 스틸 언 에그 | Steal An Egg | 위버스 매거진 소개 | [위버스 매거진](https://magazine.weverse.io/article/view/1997) |
| 99 나이츠 인 더 포레스트 | 99 Nights in the Forest | 동접 최고 1,420만 (위버스) | [위버스 매거진](https://magazine.weverse.io/article/view/1997) |
| ASMR 타워 | ASMR Tower | 촉감 놀이형 점프맵. 수치 미검증 | [위버스 매거진](https://magazine.weverse.io/article/view/1997) |

"○○ 키우기" 형태의 로블록스 호칭은 확인하지 못했다. 한국어 유튜브/디시/에펨코리아 반응은 직접 검색하지 않았다(미검증).

### 3-3. 학부모 우려

| 우려 | 내용 | 출처 |
|---|---|---|
| 확률형 아이템 표시 | 인기 게임이 랜덤 뽑기를 팔면서 확률을 결제 화면에 표시하지 않았다는 보도 | [전자신문 2026-03-18](https://www.etnews.com/20260318000328) |
| 결제 한도 | 18세 미만 월 7만 원 한도, 14세 미만은 보호자 승인. 부모 몰래 소액 결제는 걸러지지 않음 | [이코노미톡](https://www.economytalk.kr/news/articleView.html?idxno=423018) |
| 훔치기 갈등 | 아이템 빼앗기고 우는 영상이 틱톡·유튜브에서 수천만 뷰 | [게임와이 2026-03-06](http://www.gamey.kr/news/articleView.html?idxno=3016372) |
| 낯선 접촉 | 채팅·음성으로 낯선 성인 접근 가능 | [이코노미톡](https://www.economytalk.kr/news/articleView.html?idxno=423018) |

시사점: 우리 프로젝트에서 뽑기를 넣는다면 확률 공개가 필요하고, 훔치기 같은 PvP 약탈은 사내 토이프로젝트에서도 갈등 소지가 있어 피하는 편이 안전하다(분석).

## 4. 로블록스 밖 유사 사례

### 4-1. 앱 내 키우기/미니게임

| 사례 | 구조 | 성과 | 미검증/주의 | 출처 |
|---|---|---|---|---|
| 토스 (만보기, 고양이 키우기, 행운퀴즈) | 걸음 수로 포인트 적립, 방문 미션, 결제 시 가상 고양이 키우기 | 만보기 누적 400만 명(2022-05). 2024년 이용자 약 1,150만 명. 고양이 키우기 노출 455만, 유입 119만, 아이템 수령 98만(2025 캠페인) | 이용자 수 출처마다 다름. 행운퀴즈 공식 수치 미확인 | [토스](https://toss.im/tossfeed/article/toss-pedometer-four-million), [토스 2024 결산](https://toss.im/newsroom/2024benefit), [토스 광고](https://tossads.toss.im/insights/meovv) |
| 올웨이즈 올팜 | 물·비료로 작물 성장(광고 시청으로 비료, 친구 초대로 물), 수확 시 실물 무료 배송 | Google Play 500만+ 다운로드. 2023-08 가입자 700만, MAU 250만(앱 전체). 자체 주장 "매일 100만 명" | 올팜 단독 성과는 불분명, 평점 스냅샷 편차, 광고 보상 오류 불만 | [AppBrain](https://www.appbrain.com/app/%EC%98%AC%EC%9B%A8%EC%9D%B4%EC%A6%88-%ED%8C%80%EA%B5%AC%EB%A7%A4%EB%A1%9C-%EC%B4%88%ED%8A%B9%EA%B0%80-%EC%87%BC%ED%95%91/com.ilevit.alwayz.android), [매일경제](https://www.mk.co.kr/news/business/10801638) |
| 당근 커뮤니티 게임 | 키우기는 없음. 두더지 잡기, 당근런, 팡팡 사과게임, 2048 | 2026-06-09 전국 공개. 앱 MAU 2,064만(2026-02) | 게임 이용 수치 미확인 | [전자신문](https://www.etnews.com/20260616000178) |
| 카카오톡 게임칩 | HTML5 캐주얼. 키우기 여부 미확인 | 2026-06-19 출시, 연내 50종 계획 | 성과 미발표 | [연합뉴스](https://www.yna.co.kr/view/AKR20260619062400017) |

### 4-2. 웹/모바일 방치형

| 게임 | 성과 | 주의 | 출처 |
|---|---|---|---|
| Cookie Clicker | Steam 판매 추정 257만 장, 매출 추정 $10.2M (11/12 기준) | 추정치, 신뢰도 중간 | [Raijin](https://raijin.gg/app/1454400/Cookie_Clicker), [Sensor Tower](https://app.sensortower.com/vgi/game/cookie-clicker) |
| 쿠키런 키우기 (데브시스터즈, 2026-07-30) | 출시 4일 100만 명, 한 달 매출 200억 원·이용자 250만 명(회사 발표). 이후 순위 하락 | 회사 발표 포함, "손이 많이 간다" 피로감 지적 | [뉴시스](https://mobile.newsis.com/view/NISX20260810_0003743004), [ZDNet](https://zdnet.co.kr/view?no=20260928094626) |
| 메이플 키우기 (넥슨, 2025-11) | 2026-08-19 양대 마켓 매출 1위 복귀, 9월 10위권 유지 | 일매출은 추정 | [데일리게임](https://www.dailygame.co.kr/view.php?ud=20260819153021713421ad998911_26), [ZDNet](https://zdnet.co.kr/view?no=20260928105523) |

시장 흐름: 한국 방치형 RPG는 다운로드가 30% 줄었지만 인앱 구매 수익은 57% 늘었다([디지털인사이트](https://ditoday.com/%ED%95%9C%EA%B5%AD-%EB%AA%A8%EB%B0%94%EC%9D%BC-%EA%B2%8C%EC%9E%84-%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C-%EC%A4%84%EC%97%88%EB%8A%94%EB%8D%B0-rpd-%EC%97%AD%EB%8C%80-%EC%B5%9C%EA%B3%A0)).

앱 내 키우기 게임의 구조적 공통점(분석): 보상형 광고·친구 초대·일일 접속이 성장 속도를 높이는 "재방문 + 유입" 장치로 쓰이며, 실물/포인트 보상이 동기를 만든다.

## 5. 1인 1~2주 토이프로젝트로 옮기기 쉬운 메커니즘 Top 5

| 순위 | 메커니즘 | 이유 |
|---|---|---|
| 1 | 단일 스탯 증분 + 구간 해금 ("+1 Speed", Tap Simulator) | 코어 루프가 1개이고 상태가 숫자 몇 개라 하루면 프로토타입이 나온다. 큰 숫자 표기와 해금 구간만 있어도 재미가 성립한다 |
| 2 | 환생(prestige) 배율 | 구현은 "초기화 + 영구 배율 변수" 정도로 가볍다. 반복 플레이 동기를 한 번에 만든다 |
| 3 | 방치/오프라인 수익 (Grow a Garden, 올팜) | 접속 시각 저장 후 경과 시간×수익만 계산하면 된다. 서버 없이 localStorage나 간단한 DB로 가능하며 복귀 이유를 만든다 |
| 4 | 알 부화 + 희귀도·변이 + 도감 (Steal An Egg, Pet Simulator 99) | 확률 테이블과 아이템 리스트만 있으면 되고 에셋은 이모지·간단한 도형으로 대체 가능하다. "대박" 연출과 컬렉션 목표가 동시에 생긴다. 확률 공개는 필수 |
| 5 | 순위표 + 주간 한정 이벤트 | 회사 내 동료끼리 순위만 보여줘도 경쟁 동기가 생긴다. 이벤트는 설정값 교체로 운영 가능해 구현 비용이 낮다 |

제외 권장: 훔치기/약탈(실시간 동기화·밸런스·갈등 이슈), 실시간 거래(경제 부정 방지 비용), 수천 종 콘텐츠.

## 6. 한계와 미검증
- rotrends 메인과 roblox.com 공식 차트는 직접 열람하지 못했다. Fandom 위키는 검색 발췌만 확인했다.
- 동접은 집계처별 차이가 크다(Steal An Egg 59만~120만, Steal a Brainrot 최고 25.4M~25.9M).
- 99 Nights 출시일, 일부 신작(Depth Incremental, Venom Evolution, Tap Simulator)의 최신 동접은 미검증.
- 한국어 유튜브·디시·에펨코리아 직접 검색은 하지 않았다. "○○ 키우기" 로블록스 호칭은 확인 못 함.
- 학부모 700만 원 결제 사례와 학교 금지 안내문은 1차 출처 미확인.
- 토스 행운퀴즈, 당근 게임, 카카오 게임칩의 성과 수치는 찾지 못했다.
- 2절(설계 패턴)과 5절(Top 5)은 위 조사 자료와 일반 지식 기반의 분석이며, 개별 수치 근거는 없다.
- Aside CLI 업데이트 프롬프트(1.26.1028 -> 1.26.1113)는 응답하지 않아 구버전으로 진행했다.
