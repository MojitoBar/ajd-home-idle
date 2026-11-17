// 방 한 칸의 자리표. 모든 값은 도트 단위(1도트 = 화면 2px). 그림 크기는 여기 두지 않고 그림 자연 크기에서 계산한다.
// 원점은 방 그림 왼쪽 위, x는 그림의 가운데, y는 그림의 발(아랫변)이다. art/pixel/manifest.json의 원룸 좌표를 옮겼다.
export interface RoomPlace {
  x: number;
  y: number;
  on: 'floor' | 'counter';
}

export interface RoomDef {
  /** public/assets/px/ 아래 방 배경 */
  bg: string;
  /** 방 그림 크기(도트) */
  w: number;
  h: number;
  floorY: number;
  counterTop: number;
  /** 살림 id별 자리 */
  items: Record<string, RoomPlace>;
  /** 상자 발 자리(가운데)와 대기 상자 2개(상자 가운데 기준 도트 이동) */
  box: { x: number; y: number; wait: readonly { dx: number; dy: number }[] };
  /** 서비스 선반 판자: 윗면 y(아이콘 바닥), 판자 x 범위. 아이콘 자리는 shelfSlots() */
  shelf: { y: number; p0: number; x1: number };
  /** short: 아래로 늘어진 줄(스프라이트 아래 3행)을 잘라 몸통만 그린다 */
  wallPhone: { x: number; y: number; short?: boolean };
  /** 선반 판자·받침 색. 비우면 --w1, 벽이 같은 색인 집(화성)만 'w2' */
  plank?: 'w2';
}

/** 조리대 윗면(y)과 벽 전화 자리만 방마다 다르다. 나머지는 모든 방이 같다 */
const room = (theme: string, counterTop: number, wallPhone: RoomDef['wallPhone'] = { x: 132, y: 28 }, counterX = 0): RoomDef => ({
  bg: `room/${theme}`,
  w: 180,
  h: 130,
  floorY: 80,
  counterTop,
  items: {
    fridge: { x: 20, y: 86, on: 'floor' },
    washer: { x: 45, y: 86, on: 'floor' },
    smart_tv: { x: 28, y: 108, on: 'floor' },
    fan: { x: 142, y: 104, on: 'floor' },
    air_purifier: { x: 160, y: 94, on: 'floor' },
    rice_cooker: { x: 133 + counterX, y: counterTop + 3, on: 'counter' },
    kettle: { x: 146 + counterX, y: counterTop + 3, on: 'counter' },
    coffee_machine: { x: 159 + counterX, y: counterTop + 3, on: 'counter' },
  },
  box: { x: 90, y: 114, wait: [{ dx: -18, dy: -12 }, { dx: 18, dy: -12 }] },
  shelf: { y: 24, p0: 6, x1: 174 },
  wallPhone,
});

export const ONE_ROOM: RoomDef = room('blue', 58);

/** 집 테마(houses.ts의 theme)별 방. 값은 art/pixel/manifest.json의 room 항목(조리대 윗면)과 시트의 창 범위에서 옮겼다. night·nebula는 창 오른쪽 끝(x124) 밖에 줄을 자른 짧은 전화기(short)를 판자 아래 y26에 걸고, 조리대 빈 점선 칸 여백을 1도트로 줄여 닿지 않게 한다. jupiter는 원래 모양. edge는 창 사이(x104~119)에 벽 기둥을 손으로 만들어(edge.png) 그 가운데 x112에 원래 모양 전화를 건다. 노을·달·화성은 전화 아랫면이 살림 칸 윗변에 닿지 않게 1도트 올린다 */
export const ROOMS: Record<string, RoomDef> = {
  blue: ONE_ROOM,
  mint: room('mint', 58),
  sunset: room('sunset', 56, { x: 132, y: 27 }),
  night: room('night', 54, { x: 140, y: 26, short: true }),
  moon: room('moon', 58, { x: 132, y: 27 }),
  mars: { ...room('mars', 56, { x: 132, y: 27 }), plank: 'w2' },
  jupiter: room('jupiter', 58, { x: 140, y: 28 }),
  nebula: room('nebula', 54, { x: 140, y: 26, short: true }),
  edge: room('edge', 52, { x: 112, y: 28 }, 0),
};

export const roomFor = (theme: string): RoomDef => ROOMS[theme] ?? ONE_ROOM;

/**
 * 선반 공구 아이콘(24도트 그림)의 [왼쪽 투명 여백, 불투명 폭]. 순서: 공구(현재 단계 그림), 오함마, 수평계, 안전모, 빠루, 송곳, 돋보기.
 * 공구 칸은 단계마다 그림이 바뀌는데 맨손·커터칼·드라이버가 같은 [1, 22]라 그 값으로 잡는다.
 * 그림을 바꾸면 public/assets/px/tool/*.png의 불투명 범위(알파 bbox)에서 다시 잴 것.
 */
export const SHELF_ICON_EXTENT: readonly (readonly [number, number])[] = [
  [1, 22], // 공구(gloves·cutter·drill)
  [3, 18], // 오함마(sledge)
  [1, 22], // 수평계(level)
  [2, 20], // 안전모(hardhat)
  [0, 22], // 빠루(crowbar)
  [3, 20], // 송곳(awl)
  [2, 21], // 돋보기(magnifier)
];

/** 선반 그림 아래쪽 투명 행 수(도트). 불투명 바닥이 판자 윗면에 닿게 이만큼 내려 놓는다. SHELF_ICON_EXTENT와 같은 순서 */
export const SHELF_ICON_DROP: readonly number[] = [2, 1, 7, 10, 1, 3, 1];
/** 공구 칸의 단계별 그림(tool id)의 아래쪽 투명 행 수. 위 표의 첫 값은 이 중 drill 기준 */
export const SHELF_TOOL_DROP: Readonly<Record<string, number>> = { gloves: 4, cutter: 8, hammer: 1, drill: 2, 'robot-arm': 1 };

/** 이웃 그림 사이 간격(도트). 묶음 폭 158도트라 360 폭 판자(8~172) 안에 들어간다 */
export const SHELF_GAP = 2;

/**
 * 7종이 다 있다고 보고 고정한 아이콘 자리: 아이콘 스프라이트 왼쪽 끝 x(도트)와 불투명 그림 범위.
 * 묶음 전체를 방 가운데(w/2)에 맞춘다(폭이 홀수면 왼쪽으로 반 도트 쏠림). 가진 공구가 적어도 자리는 그대로다.
 */
export function shelfSlots(roomW = 180, gap = SHELF_GAP): { x: number; ink0: number; ink1: number }[] {
  const total = SHELF_ICON_EXTENT.reduce((a, [, w]) => a + w, 0) + gap * (SHELF_ICON_EXTENT.length - 1);
  let ink = Math.floor((roomW - total) / 2);
  return SHELF_ICON_EXTENT.map(([m, w]) => {
    const slot = { x: ink - m, ink0: ink, ink1: ink + w };
    ink += w + gap;
    return slot;
  });
}
