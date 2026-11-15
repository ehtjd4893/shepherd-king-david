import type { Section } from './combat.ts';

/** Where to go after the stage is cleared. */
export type Next = { scene: 'cutscene'; id: string } | { scene: 'title' } | { scene: 'shaft' };
/** On-screen tip shown once when David passes world x `at`. */
export interface Hint { at: number; pc: string; touch: string }
export interface StageDef {
  title: string; width: number; bg: 'field' | 'elah' | 'gibeah' | 'wild' | 'keilah' | 'ziklag' | 'jebus' | 'zion'; sheep: number; sections: Section[]; hints: Hint[]; next: Next;
  /** David's start x (default 60); stones he starts with (default 5); brook = stones wash up while he's short */
  start?: number; ammo?: number; brook?: boolean;
  /** skip the stage-title banner at the start */
  noBanner?: boolean;
  /** the faith special becomes the harp (from stage 3) */
  harp?: boolean;
  /** Goliath's sword in hand (stage 4 on) / Adullam companions can be called */
  sword?: boolean; allies?: boolean;
}

// Spawn x is screen-relative (<0 / >480 = walks in from that side). t = enemy kind (default philA).
export const STAGES: Record<string, StageDef> = {
  field: {
    title: 'STAGE 1 · 베들레헴 들판',
    width: 2400,
    bg: 'field',
    sheep: 5,
    hints: [
      { at: 0, pc: '←→↑↓ 이동 · Z 연타 3단 공격 · ←← / →→ 달리기', touch: '왼쪽 조이스틱 이동 · 공격 연타 3단 공격 · 끝까지 밀면 달리기' },
      { at: 260, pc: 'X 점프 → 점프 중 Z 내려찍기 · 달리며 Z 돌진', touch: '점프 → 점프 중 공격 내려찍기 · 달리며 공격 돌진' },
      { at: 700, pc: '양 도둑! 양을 끌고 가기 전에 때려서 구하세요 · C 물매 (돌 5개)', touch: '양 도둑! 양을 끌고 가기 전에 때려서 구하세요 · 물매 (돌 5개)' },
      { at: 1260, pc: 'Z+X(또는 F) 회오리 · 게이지 가득 차면 V 믿음의 일격', touch: '회전: 둘러싸였을 때 · 게이지 가득 차면 믿음' },
    ],
    sections: [
      { at: 0, waves: [[{ x: 520, y: 200, t: 'jackal' }, { x: 540, y: 232, t: 'jackal' }]] },
      {
        at: 640, waves: [
          [{ x: 520, y: 196, t: 'jackal' }, { x: -40, y: 226, t: 'thief' }, { x: 540, y: 236, t: 'jackal' }],
          [{ x: 520, y: 206, t: 'thief' }, { x: -50, y: 186, t: 'thief' }, { x: 540, y: 232, t: 'jackal' }, { x: -40, y: 240, t: 'jackal' }],
        ],
      },
      { at: 1260, waves: [[{ x: 520, y: 210, t: 'bear' }]] },
      {
        at: 1600, waves: [
          [{ x: 520, y: 190, t: 'jackal' }, { x: 540, y: 220, t: 'jackal' }, { x: -40, y: 206, t: 'thief' }], // first stage: kept to three right after the bear
        ],
      },
      { at: 1920, waves: [[{ x: 520, y: 208, t: 'lion' }]] },
    ],
    next: { scene: 'cutscene', id: 'anoint' },
  },
  elah: {
    title: 'STAGE 2 · 엘라 골짜기',
    width: 1920,
    bg: 'elah',
    sheep: 0,
    hints: [],
    sections: [
      { at: 0, waves: [[{ x: 520, y: 200 }, { x: 540, y: 232 }, { x: -40, y: 214 }]] },
      {
        at: 620, waves: [
          [{ x: 520, y: 190 }, { x: -40, y: 228 }, { x: 540, y: 240, t: 'philB' }],
          [{ x: 520, y: 205 }, { x: 540, y: 238 }, { x: -40, y: 182 }, { x: -60, y: 220, t: 'philB' }],
        ],
      },
      {
        at: 1440, waves: [
          [{ x: 520, y: 186, t: 'philB' }, { x: 540, y: 214 }, { x: -40, y: 200 }, { x: -60, y: 236 }],
          [{ x: 520, y: 196 }, { x: 540, y: 226, t: 'philB' }, { x: 560, y: 244 }, { x: -40, y: 186, t: 'philB' }, { x: -60, y: 214 }],
        ],
      },
    ],
    next: { scene: 'cutscene', id: 'goliath' },
  },
  goliath: {
    title: '결전 · 골리앗',
    noBanner: true, // the cutscene just introduced him; his name bar does the rest
    width: 480,
    bg: 'elah',
    sheep: 0,
    start: 210, // the arena locks at once
    ammo: 5,
    brook: true,
    hints: [
      { at: 0, pc: '정면은 놋 갑옷에 막힌다! 창을 찌른 뒤 빈틈이 생기면 C 물매로 이마를 노려라', touch: '정면은 놋 갑옷에 막힌다! 창을 찌른 뒤 빈틈이 생기면 물매로 이마를 노려라' },
    ],
    sections: [{ at: 0, waves: [[{ x: 410, y: 206, t: 'goliath' }, { x: 340, y: 214, t: 'philC' }]] }],
    next: { scene: 'cutscene', id: 'victory' },
  },
  gibeah: {
    title: 'STAGE 3 · 기브아',
    width: 2400,
    bg: 'gibeah',
    sheep: 0,
    harp: true,
    hints: [
      { at: 0, pc: '게이지가 가득 차면 V 수금 연주: 적을 잠재우고 체력을 회복합니다', touch: '게이지가 가득 차면 믿음 버튼: 수금 연주로 적을 잠재우고 체력 회복' },
      { at: 700, pc: '궁수! 붉은 선이 보이면 줄을 바꾸거나 점프해서 화살을 피하세요', touch: '궁수! 붉은 선이 보이면 줄을 바꾸거나 점프해서 화살을 피하세요' },
      { at: 2000, pc: '사울 왕에게는 손댈 수 없다! 날아오는 창을 세 번 피하세요 (줄 바꾸기·점프)', touch: '사울 왕에게는 손댈 수 없다! 날아오는 창을 세 번 피하세요 (줄 바꾸기·점프)' },
    ],
    sections: [
      { at: 0, waves: [[{ x: 520, y: 200 }, { x: 540, y: 232 }, { x: 560, y: 214, t: 'philD' }]] },
      {
        at: 640, waves: [
          [{ x: 520, y: 190, t: 'philB' }, { x: 560, y: 226, t: 'philD' }, { x: -40, y: 210 }],
          [{ x: 520, y: 236, t: 'philC' }, { x: 560, y: 196, t: 'philD' }, { x: -40, y: 222 }, { x: 540, y: 206, t: 'philB' }],
        ],
      },
      { at: 1280, waves: [[{ x: 540, y: 190, t: 'philD' }, { x: -50, y: 236, t: 'philD' }, { x: 520, y: 214 }, { x: -40, y: 200 }, { x: 560, y: 226, t: 'philC' }]] },
      { at: 1920, waves: [[{ x: 430, y: 196, t: 'saul' }]] },
    ],
    next: { scene: 'cutscene', id: 'escape' },
  },
  keilah: {
    title: 'STAGE 4 · 그일라',
    width: 2400,
    bg: 'keilah',
    sheep: 0,
    harp: true,
    sword: true,
    allies: true,
    hints: [
      { at: 0, pc: '골리앗의 칼! 공격이 세고 길어졌다 · G 동료 호출: 아둘람 용사들이 돌진한다', touch: '골리앗의 칼! 공격이 세고 길어졌다 · 동료 버튼: 아둘람 용사들이 돌진한다' },
      { at: 1940, pc: '대장이 방패를 들고 웅크리면 붉은 선! 돌진을 옆으로 피하세요', touch: '대장이 방패를 들고 웅크리면 붉은 선! 돌진을 옆으로 피하세요' },
    ],
    sections: [
      { at: 0, waves: [[{ x: 520, y: 200 }, { x: 540, y: 232 }, { x: 560, y: 214, t: 'philD' }]] },
      {
        at: 640, waves: [
          [{ x: 520, y: 190, t: 'philB' }, { x: 560, y: 226, t: 'philD' }, { x: -40, y: 210 }],
          [{ x: 520, y: 236, t: 'philC' }, { x: 560, y: 196, t: 'philD' }, { x: -40, y: 222 }, { x: 540, y: 206, t: 'philB' }],
        ],
      },
      { at: 1280, waves: [[{ x: 520, y: 190, t: 'philD' }, { x: 540, y: 220 }, { x: -40, y: 206, t: 'philB' }, { x: -60, y: 238, t: 'philC' }]] },
      { at: 1920, waves: [[{ x: 520, y: 210, t: 'captain' }, { x: 560, y: 186 }, { x: -40, y: 236 }]] },
    ],
    next: { scene: 'cutscene', id: 'keilahAfter' },
  },
  engedi: {
    title: 'STAGE 5 · 엔게디와 십 광야',
    width: 1920,
    bg: 'wild',
    sheep: 0,
    harp: true,
    sword: true,
    allies: true,
    hints: [
      { at: 0, pc: '광야 약탈자들이다! 동료(G)와 함께 물리치세요', touch: '광야 약탈자들이다! 동료 버튼과 함께 물리치세요' },
      { at: 560, pc: '사울의 군사는 공격할 수 없다! 노란 시야를 피해 다가가 사울의 옷자락을 베세요 (Z)', touch: '사울의 군사는 공격할 수 없다! 노란 시야를 피해 다가가 사울의 옷자락을 베세요 (공격)' },
      { at: 1440, pc: '모두 깊이 잠들었다. 달리면 깨니 걸어서 다가가 창과 물병을 챙기세요 (Z)', touch: '모두 깊이 잠들었다. 달리면 깨니 걸어서 다가가 창과 물병을 챙기세요 (공격)' },
    ],
    sections: [
      { at: 0, waves: [[{ x: 520, y: 200, t: 'raider' }, { x: 540, y: 232, t: 'raider' }, { x: -40, y: 214, t: 'jackal' }]] },
      {
        at: 560, waves: [],
        stealth: {
          mood: 'cave', saul: { x: 440, y: 200 },
          guards: [{ x: 300, y: 196, from: 220, to: 380 }, { x: 360, y: 232, from: 260, to: 420 }],
          goals: [{ x: 418, y: 214, kind: 'robe' }],
        },
      },
      { at: 1100, waves: [[{ x: 520, y: 196, t: 'raider' }, { x: 540, y: 226, t: 'raider' }, { x: -40, y: 210, t: 'raider' }, { x: -60, y: 238, t: 'jackal' }, { x: 560, y: 186, t: 'jackal' }]] },
      {
        at: 1440, waves: [],
        stealth: {
          mood: 'night', saul: { x: 360, y: 214 },
          guards: [{ x: 210, y: 196, asleep: true }, { x: 290, y: 238, asleep: true }, { x: 430, y: 204, asleep: true }, { x: 300, y: 184, asleep: true }],
          goals: [{ x: 386, y: 206, kind: 'spear' }, { x: 336, y: 224, kind: 'jug' }],
        },
      },
    ],
    next: { scene: 'cutscene', id: 'spare' },
  },
  ziklag: {
    title: 'STAGE 6 · 시글락',
    width: 2400,
    bg: 'ziklag',
    sheep: 0,
    harp: true,
    sword: true,
    allies: true,
    hints: [
      { at: 0, pc: '낙타 기병! 붉은 선이 깔리면 그 줄을 비키세요', touch: '낙타 기병! 붉은 선이 깔리면 그 줄을 비키세요' },
      { at: 1280, pc: '아말렉 진영이다. 포로들 곁에서 Z를 눌러 밧줄을 풀어 주세요', touch: '아말렉 진영이다. 포로들 곁에서 공격 버튼을 눌러 밧줄을 풀어 주세요' },
      { at: 1920, pc: '아말렉 대장! 지치면 낙타 기병을 부른다', touch: '아말렉 대장! 지치면 낙타 기병을 부른다' },
    ],
    sections: [
      { at: 0, waves: [[{ x: 520, y: 200, t: 'amalek' }, { x: 540, y: 232, t: 'amalek' }, { x: -40, y: 210, t: 'camel' }]] },
      {
        at: 640, waves: [
          [{ x: 520, y: 196, t: 'amalek' }, { x: -40, y: 226, t: 'amalek' }, { x: 540, y: 210, t: 'camel' }, { x: -40, y: 210, t: 'camel' }],
          [{ x: 520, y: 236, t: 'amalek' }, { x: 560, y: 190, t: 'amalek' }, { x: -40, y: 214, t: 'amalek' }, { x: 540, y: 210, t: 'camel' }],
        ],
      },
      {
        at: 1280, waves: [[{ x: 520, y: 200, t: 'amalek' }, { x: -40, y: 230, t: 'amalek' }, { x: 560, y: 214, t: 'camel' }]],
        captives: [{ x: 300, y: 196, who: 'villager' }, { x: 350, y: 226, who: 'child' }, { x: 400, y: 204, who: 'villager' }, { x: 250, y: 238, who: 'child' }],
      },
      { at: 1920, waves: [[{ x: 520, y: 210, t: 'chief' }, { x: -40, y: 196, t: 'amalek' }]] },
    ],
    next: { scene: 'cutscene', id: 'gilboa' },
  },
  jerusalem: {
    title: 'STAGE 7 · 여부스',
    width: 1600,
    bg: 'jebus',
    sheep: 0,
    harp: true,
    sword: true,
    allies: true,
    hints: [
      { at: 0, pc: '여부스 병사는 창이 길다. 찌르기 끝을 노려 파고드세요', touch: '여부스 병사는 창이 길다. 찌르기 끝을 노려 파고드세요' },
    ],
    sections: [
      { at: 0, waves: [[{ x: 520, y: 200, t: 'jebusite' }, { x: 540, y: 232, t: 'jebusite' }, { x: -40, y: 214 , t: 'jebusite' }]] },
      {
        at: 560, waves: [
          [{ x: 520, y: 196, t: 'jebusite' }, { x: 560, y: 226, t: 'jebArcher' }, { x: -40, y: 210, t: 'jebusite' }],
          [{ x: 520, y: 236, t: 'jebusite' }, { x: 560, y: 196, t: 'jebArcher' }, { x: -40, y: 222, t: 'jebArcher' }, { x: 540, y: 206, t: 'jebusite' }],
        ],
      },
      { at: 1120, waves: [[{ x: 520, y: 190, t: 'jebArcher' }, { x: 540, y: 220, t: 'jebusite' }, { x: -40, y: 206, t: 'jebusite' }, { x: -60, y: 238, t: 'jebusite' }]] },
    ],
    next: { scene: 'shaft' },
  },
  zion: {
    title: '시온 산성',
    width: 1120,
    bg: 'zion',
    sheep: 0,
    harp: true,
    sword: true,
    allies: true,
    hints: [
      { at: 640, pc: '여부스 성주! 방패를 들고 웅크리면 붉은 선, 돌진을 피하세요', touch: '여부스 성주! 방패를 들고 웅크리면 붉은 선, 돌진을 피하세요' },
    ],
    sections: [
      { at: 0, waves: [[{ x: 520, y: 200, t: 'jebusite' }, { x: 540, y: 232, t: 'jebArcher' }, { x: -40, y: 214, t: 'jebusite' }]] },
      { at: 640, waves: [[{ x: 520, y: 210, t: 'lord' }, { x: -40, y: 196, t: 'jebusite' }]] },
    ],
    next: { scene: 'cutscene', id: 'ending' },
  },
};
