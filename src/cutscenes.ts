// Story scenes. Lines paraphrase 1 Samuel in plain Korean; chapter:verse goes in narration only.

/**
 * A figure on stage. `from` = walk in from this x when the line starts; k = size (Goliath is big); down = lying on the ground.
 * anim 'fight' = trading blows (two frames); 'fall' = topples over and stays down.
 */
export interface Actor { id: string; x: number; y: number; anim?: string; flip?: boolean; from?: number; k?: number; down?: boolean }
/** One line. `actors` replaces who is on stage (omit to keep the previous set). */
/** qte = presses needed (mash the attack button; can't fail); banner = big gold line that pops up (item get). */
/**
 * bg switches the backdrop from this line on. fx (1 Sam 31): 'battle' = arrows flying over Mount Gilboa; 'dusk' = the light fading.
 */
export interface Beat { who?: keyof typeof NAMES; text: string; actors?: Actor[]; fx?: 'anoint' | 'battle' | 'dusk'; qte?: number; banner?: string; bg?: Cutscene['bg'] }
export interface Cutscene { bg: 'beth' | 'field' | 'elah' | 'gibeah' | 'wild' | 'ziklag' | 'jebus' | 'zion' | 'gilboa'; title?: string; beats: Beat[]; next: { scene: 'stage' | 'cutscene'; id: string } | { scene: 'title' } | { scene: 'credits' } }

export const NAMES = { samuel: '사무엘', saul: '사울', jesse: '이새', david: '다윗', goliath: '골리앗', jonathan: '요나단', michal: '미갈', priest: '아히멜렉', achish: '아기스 왕', egypt: '이집트 소년', elder: '이스라엘 장로', lord: '여부스 성주' } as const;

const SAMUEL = { id: 'samuel', x: 176, y: 192 };
const SAUL = { id: 'saul', x: 292, y: 194, flip: true };
const FAMILY = [
  { id: 'bro1', x: 52, y: 160 }, { id: 'bro2', x: 74, y: 158 }, { id: 'bro3', x: 98, y: 161 }, { id: 'bro4', x: 156, y: 159 },
  { id: 'jesse', x: 122, y: 178 },
];
const GOLIATH = { id: 'goliath', x: 380, y: 190, flip: true, k: 1.6, anim: 'laugh' };
const FLOCK = (x: number) => [{ id: 'sheep', x: x + 40, y: 186, flip: true }, { id: 'sheep', x: x + 62, y: 176, flip: true }, { id: 'sheep', x: x + 82, y: 191, flip: true }];

export const CUTSCENES: Record<string, Cutscene> = {
  prologue: {
    bg: 'field',
    title: '목동왕 다윗',
    beats: [
      { text: '사사 시대가 저물 무렵, 이스라엘 백성은 다른 나라들처럼 왕을 원했다. (삼상 8:5)', actors: [SAMUEL] },
      { text: '사무엘은 베냐민 사람 사울에게 기름을 부었다. 누구보다 어깨 위만큼 키가 큰 사람이었다. (삼상 10:1)', actors: [SAMUEL, SAUL] },
      { who: 'saul', text: '블레셋이 몰려오는데 사무엘이 늦는구려. 기다릴 수 없소, 내가 직접 번제를 드리겠소!' },
      { who: 'samuel', text: '왕께서 어리석은 일을 하셨소. 여호와의 명령을 지키지 않으셨구려. (삼상 13:13)' },
      { text: '아말렉과 싸울 때도 사울은 좋은 것들을 남겨 두었다. 이번에도 순종하지 않은 것이다. (삼상 15:9)' },
      { who: 'samuel', text: '순종하는 것이 제사보다 낫습니다. 왕이 여호와의 말씀을 버렸으니, 여호와께서도 왕을 버리셨소.' },
      { text: '여호와께서 사무엘에게 말씀하셨다. "베들레헴 사람 이새에게로 가라. 그 아들 가운데 왕을 보았다." (삼상 16:1)', actors: [SAMUEL] },
      { text: '그 무렵, 베들레헴 들판에서는 이새의 막내아들이 양 떼를 지키고 있었다.', actors: [{ id: 'david', x: 240, y: 196 }, ...FLOCK(170)] },
    ],
    next: { scene: 'stage', id: 'field' },
  },
  anoint: {
    bg: 'beth',
    beats: [
      { text: '베들레헴, 이새의 집. 사무엘은 이새의 아들들을 한 사람씩 만나 보았다.', actors: [...FAMILY, { ...SAMUEL, x: 200, y: 184, flip: true }] },
      { who: 'samuel', text: '여호와께서 이들 가운데 아무도 택하지 않으셨소. 아들이 이들뿐이오?' },
      { who: 'jesse', text: '막내가 하나 더 있긴 합니다만… 지금 들에서 양을 치고 있지요.' },
      { who: 'david', text: '헉, 헉… 사자랑 곰까지 쫓아내고 양들 데리고 뛰어왔어요! 무슨 일이세요?', actors: [...FAMILY, { ...SAMUEL, x: 200, y: 184 }, { id: 'david', x: 290, y: 188, flip: true, from: 420 }, ...FLOCK(290)] },
      { who: 'samuel', text: '사람은 겉모습을 보지만, 여호와께서는 마음을 보신다. (삼상 16:7)' },
      { who: 'samuel', text: '바로 이 아이다. 무릎을 꿇어라, 다윗.', fx: 'anoint', actors: [...FAMILY, { id: 'samuel', x: 218, y: 186, anim: 'anoint' }, { id: 'david', x: 240, y: 188, anim: 'kneel', flip: true }, ...FLOCK(290)] },
      { text: '그날부터 여호와의 영이 다윗에게 크게 임하였다. (삼상 16:13)' },
      { text: '얼마 뒤, 블레셋 군대가 엘라 골짜기에 진을 쳤다. 다윗의 형들도 사울의 군대에 있었다. (삼상 17:1-13)', actors: [] },
    ],
    next: { scene: 'stage', id: 'elah' },
  },
  goliath: {
    bg: 'elah',
    beats: [
      { text: '블레셋 진영에서 거인이 걸어 나왔다. 키가 여섯 규빗 한 뼘, 가드 사람 골리앗이었다. (삼상 17:4)', actors: [GOLIATH] },
      { who: 'goliath', text: '이스라엘아, 사내가 있거든 하나 내보내라! 나를 이기면 우리가 너희 종이 되어 주마! (삼상 17:9)' },
      { text: '사십 일 동안 아침저녁으로 조롱이 이어졌지만, 사울과 이스라엘 군대는 두려워 떨기만 했다. (삼상 17:11, 16)' },
      { who: 'david', text: '저 블레셋 사람이 누구길래 살아 계신 하나님의 군대를 모욕한단 말입니까? 제가 나가 싸우겠습니다!', actors: [{ id: 'saul', x: 180, y: 188 }, { id: 'david', x: 250, y: 190, flip: true }] },
      { who: 'saul', text: '너는 소년이고, 저자는 어려서부터 용사였다. 네가 어찌 이기겠느냐? (삼상 17:33)' },
      { who: 'david', text: '사자와 곰의 발톱에서 저를 건지신 여호와께서 저 블레셋 사람의 손에서도 건지실 겁니다. (삼상 17:37)' },
      { who: 'saul', text: '그렇다면 가거라. 여호와께서 너와 함께하시기를. 내 놋 투구와 갑옷을 입고 가거라.' },
      { who: 'david', text: '으윽… 너무 무거워서 한 걸음도 못 걷겠어요. 이건 익숙하지 않아요. (삼상 17:39)' },
      { text: '다윗은 갑옷을 벗고, 막대기를 들고, 시냇가에서 매끄러운 돌 다섯 개를 골라 주머니에 넣었다. (삼상 17:40)', actors: [{ id: 'david', x: 220, y: 190 }] },
      { who: 'goliath', text: '막대기를 들고 오다니, 내가 개냐? 이리 와라. 네 살을 새와 들짐승에게 주겠다! (삼상 17:43-44)', actors: [{ id: 'david', x: 150, y: 190 }, { ...GOLIATH, x: 360 }] },
      { who: 'david', text: '너는 칼과 창으로 오지만, 나는 만군의 여호와의 이름으로 간다! 전쟁은 여호와께 속한 것이다! (삼상 17:45-47)' },
    ],
    next: { scene: 'stage', id: 'goliath' },
  },
  victory: {
    bg: 'elah',
    beats: [
      { text: '돌이 이마에 박히자, 거인은 땅에 얼굴을 박고 쓰러졌다. 다윗의 손에는 칼이 없었다. (삼상 17:49-50)', actors: [{ ...GOLIATH, x: 330, y: 186, down: true }, { id: 'david', x: 230, y: 190 }] },
      { text: '블레셋 사람들은 자기들의 용사가 죽은 것을 보고 도망쳤고, 이스라엘이 함성을 지르며 뒤쫓았다. (삼상 17:51-52)' },
      { who: 'saul', text: '소년아, 너는 누구의 아들이냐? (삼상 17:58)', actors: [{ id: 'saul', x: 170, y: 188 }, { id: 'jonathan', x: 130, y: 184 }, { id: 'david', x: 250, y: 190, flip: true }] },
      { who: 'david', text: '베들레헴 사람, 주의 종 이새의 아들입니다.' },
      { text: '그날 사울의 아들 요나단의 마음이 다윗과 하나가 되었다. 요나단은 다윗을 자기 생명처럼 사랑했다. (삼상 18:1)' },
      { who: 'jonathan', text: '다윗, 이 겉옷과 칼과 활을 받게. 오늘부터 우리는 형제일세. (삼상 18:3-4)' },
    ],
    next: { scene: 'cutscene', id: 'jealousy' },
  },
  jealousy: {
    bg: 'gibeah',
    beats: [
      { text: '다윗이 돌아오자 여인들이 소고를 치며 노래했다. "사울이 죽인 자는 천천이요, 다윗은 만만이로다!" (삼상 18:7)', actors: [{ id: 'saul', x: 330, y: 188, flip: true }, { id: 'david', x: 200, y: 190 }] },
      { who: 'saul', text: '다윗에게는 만만을 돌리고 내게는 천천만 돌리는구나… 이제 그에게 더 돌아갈 것은 나라밖에 없겠구나. (삼상 18:8)' },
      { text: '그날부터 사울은 다윗을 의심의 눈으로 지켜보았다. (삼상 18:9)' },
      { text: '사울의 마음이 어두워질 때면 다윗이 수금을 탔다. 그러면 사울의 마음이 상쾌해졌다. (삼상 16:23)', actors: [{ id: 'saul', x: 330, y: 188, flip: true }, { id: 'david', x: 220, y: 190, anim: 'harp' }] },
      { text: '그러나 어느 날, 수금을 듣는 사울의 손에 창이 들려 있었다. (삼상 18:10)' },
      { who: 'jonathan', text: '다윗, 아버지가 자네를 해치려 하네. 몸을 조심하게! (삼상 19:2)', actors: [{ id: 'jonathan', x: 260, y: 186, flip: true }, { id: 'david', x: 200, y: 190 }] },
      { text: '다시 블레셋과 전쟁이 일어나자, 다윗은 천부장이 되어 블레셋을 치러 나갔다. (삼상 18:13, 19:8)', actors: [] },
    ],
    next: { scene: 'stage', id: 'gibeah' },
  },
  escape: {
    bg: 'gibeah',
    beats: [
      { text: '창이 벽에 박혔다. 다윗은 사울 앞을 피해 그 밤에 집으로 달아났다. (삼상 19:10)', actors: [{ id: 'david', x: 180, y: 190 }] },
      { who: 'michal', text: '오늘 밤 피하지 않으면 내일은 죽어요! 창문으로 내려가요, 어서! (삼상 19:11)', actors: [{ id: 'michal', x: 260, y: 186, flip: true }, { id: 'david', x: 200, y: 190 }] },
      { text: '미갈은 다윗을 창문으로 달아 내리고, 침상에 우상을 눕힌 뒤 염소털을 씌웠다. (삼상 19:12-13)' },
      { text: '사울의 부하들이 들이닥쳤지만, 이불 속에는 염소털 베개만 있었다.', actors: [{ id: 'michal', x: 260, y: 186, flip: true }] },
      { text: '다윗은 라마에 있는 사무엘에게로 피했다. 쫓기는 도망자의 길이 시작되었다. (삼상 19:18)', actors: [{ id: 'samuel', x: 260, y: 188, flip: true }, { id: 'david', x: 200, y: 190 }] },
    ],
    next: { scene: 'cutscene', id: 'flight' },
  },
  flight: {
    bg: 'wild',
    beats: [
      { text: '다윗은 놉 땅의 제사장 아히멜렉을 찾아갔다. 배는 고팠고, 손에는 무기도 없었다. (삼상 21:1)', actors: [{ id: 'priest', x: 290, y: 186, flip: true }, { id: 'david', x: 200, y: 190 }] },
      { who: 'priest', text: '여기 거룩한 떡이 있소. 그리고… 엘라 골짜기에서 그대가 쓰러뜨린 골리앗의 칼이 보자기에 싸여 있소. (삼상 21:6, 9)' },
      { who: 'david', text: '그만한 칼이 없지요. 제게 주십시오! (삼상 21:9)', banner: '골리앗의 칼을 얻었다!' },
      { text: '다윗은 사울을 피해 가드 왕 아기스에게로 갔다. 그러나 신하들이 그를 알아보았다. "만만을 죽였다는 그 다윗이다!" (삼상 21:10-11)', actors: [{ id: 'achish', x: 320, y: 186, flip: true }, { id: 'davidS', x: 200, y: 190 }] },
      { text: '다윗은 미친 척하며 대문짝에 마구 낙서를 했다! (삼상 21:13)  공격 버튼을 연타하세요!', qte: 14, actors: [{ id: 'achish', x: 340, y: 186, flip: true }, { id: 'davidS', x: 200, y: 190, anim: 'flail' }] },
      { who: 'achish', text: '아니, 미친 사람을 왜 내게 데려왔느냐! 내게 미친 사람이 모자라더냐? (삼상 21:15)' },
      { text: '다윗은 아둘람 굴로 피했다. 형제들과, 쫓기고 빚지고 마음이 원통한 사람 사백 명이 모여들었다. (삼상 22:1-2)', actors: [{ id: 'davidS', x: 200, y: 190 }, { id: 'ally1', x: 250, y: 184, flip: true }, { id: 'ally2', x: 290, y: 192, flip: true }, { id: 'ally3', x: 330, y: 186, flip: true }] },
      { text: '그때 소식이 왔다. 블레셋 사람들이 그일라를 쳐서 타작마당의 곡식을 빼앗고 있다! (삼상 23:1)' },
      { who: 'david', text: '여호와께서 가라고 하셨다. 그일라를 구하러 가자! (삼상 23:2-4)', banner: '동료를 부를 수 있다! (G)' },
    ],
    next: { scene: 'stage', id: 'keilah' },
  },
  ziklag: {
    bg: 'ziklag',
    beats: [
      { text: '다윗과 사람들이 시글락에 돌아와 보니, 아말렉이 성을 불사르고 아내와 자녀들을 모두 사로잡아 갔다. (삼상 30:1-3)', actors: [{ id: 'davidS', x: 200, y: 190 }, { id: 'ally1', x: 250, y: 186 }, { id: 'ally3', x: 290, y: 190 }] },
      { text: '사람들은 울 기운이 없을 때까지 울었고, 다윗을 돌로 치자는 말까지 나왔다. (삼상 30:4-6)' },
      { text: '그러나 다윗은 그의 하나님 여호와를 힘입고 용기를 얻었다. (삼상 30:6)' },
      { who: 'david', text: '여호와께서 쫓아가라고 하셨다. 반드시 따라잡고, 모두 되찾을 것이다! (삼상 30:8)' },
      { text: '브솔 시내에 이르자 너무 지친 이백 명은 그곳에 남았다. 다윗은 사백 명과 함께 계속 쫓아갔다. (삼상 30:9-10)', actors: [{ id: 'davidS', x: 200, y: 190 }, { id: 'ally2', x: 250, y: 186 }] },
      { who: 'egypt', text: '먹을 것을 주셔서 고맙습니다… 제 주인이 아말렉 사람인데, 진영으로 가는 길을 알려 드릴게요! (삼상 30:11-15)', actors: [{ id: 'davidS', x: 200, y: 190 }, { id: 'egypt', x: 270, y: 188, flip: true }] },
    ],
    next: { scene: 'stage', id: 'ziklag' },
  },
  gilboa: {
    bg: 'ziklag',
    beats: [
      { text: '다윗은 아말렉이 빼앗아 간 모든 것을 되찾았다. 작은 것 하나 잃은 것이 없었다. (삼상 30:18-19)', actors: [{ id: 'davidS', x: 200, y: 190 }, { id: 'villager', x: 260, y: 186, flip: true }, { id: 'child', x: 300, y: 190, flip: true }] },
      { who: 'david', text: '싸우러 나간 사람의 몫이나, 짐 곁에 남은 사람의 몫이나 똑같아야 한다! (삼상 30:24)' },
      {
        text: '그 무렵, 블레셋 사람들이 길보아 산에서 이스라엘과 싸웠다. 사울과 요나단도 맨 앞에서 싸웠다. (삼상 31:1)', bg: 'gilboa', fx: 'battle',
        actors: [
          { id: 'guard', x: 70, y: 182, anim: 'fight' }, { id: 'jonathanB', x: 122, y: 172, anim: 'fight' }, { id: 'saul', x: 178, y: 186, anim: 'fight' },
          { id: 'philB', x: 262, y: 184, flip: true, anim: 'fight' }, { id: 'philA', x: 300, y: 174, flip: true, anim: 'fight' }, { id: 'philC', x: 344, y: 190, flip: true, anim: 'fight' },
          { id: 'philD', x: 404, y: 170, flip: true, anim: 'fight' }, { id: 'philD', x: 446, y: 184, flip: true, anim: 'fight' },
        ],
      },
      {
        text: '블레셋 사람들이 사울과 그 아들들을 바짝 뒤쫓았다. 요나단도 아버지 곁에서 쓰러졌다. (삼상 31:2)', fx: 'battle',
        actors: [
          { id: 'jonathanB', x: 132, y: 178, anim: 'fall' }, { id: 'saul', x: 188, y: 184, anim: 'hurt' },
          { id: 'philA', x: 250, y: 176, flip: true, anim: 'fight' }, { id: 'philB', x: 290, y: 188, flip: true, anim: 'fight' }, { id: 'philD', x: 410, y: 178, flip: true, anim: 'fight' },
        ],
      },
      {
        text: '싸움이 사울에게 거세졌다. 활 쏘는 사람들이 사울을 찾아내어, 사울은 크게 다쳤다. (삼상 31:3)', fx: 'battle',
        actors: [
          { id: 'jonathanB', x: 132, y: 178, down: true }, { id: 'saul', x: 196, y: 184, anim: 'kneel' },
          { id: 'philC', x: 320, y: 188, flip: true }, { id: 'philD', x: 380, y: 172, flip: true, anim: 'fight' }, { id: 'philD', x: 430, y: 186, flip: true, anim: 'fight' },
        ],
      },
      { who: 'saul', text: '요나단… 내 아들아… 여호와께서 나를 떠나셨구나.' },
      {
        text: '그날 사울과 그의 세 아들, 그리고 그의 사람들이 다 함께 죽었다. (삼상 31:6)', fx: 'dusk',
        actors: [{ id: 'jonathanB', x: 132, y: 178, down: true }, { id: 'saul', x: 196, y: 184, anim: 'fall' }],
      },
      { text: '소식을 들은 다윗은 옷을 찢고, 저녁이 될 때까지 울며 금식했다. (삼하 1:11-12)', bg: 'wild', actors: [{ id: 'davidS', x: 230, y: 190, anim: 'kneel' }] },
      { who: 'david', text: '이스라엘아, 어찌하여 용사들이 엎드러졌는가! 사울과 요나단은 살아 있을 때 사랑스럽고 아름다웠으니… (삼하 1:19, 23)' },
      { who: 'david', text: '내 형 요나단이여, 그대 때문에 내 마음이 아프오. 그대는 내게 참으로 귀한 사람이었소. (삼하 1:26)' },
    ],
    next: { scene: 'cutscene', id: 'hebron' },
  },
  hebron: {
    bg: 'wild',
    beats: [
      { text: '다윗이 여호와께 여쭙고 헤브론으로 올라가자, 유다 사람들이 그에게 기름을 부어 유다의 왕으로 삼았다. (삼하 2:1-4)', actors: [{ id: 'davidS', x: 220, y: 190 }, { id: 'elder', x: 280, y: 186, flip: true }, { id: 'ally1', x: 160, y: 186 }] },
      { text: '사울의 집과 다윗의 집 사이에 오랜 다툼이 있었지만, 다윗은 점점 강해졌다. (삼하 3:1)' },
      { who: 'elder', text: '우리는 왕의 한 핏줄입니다. 여호와께서 "네가 내 백성 이스라엘의 목자가 되리라" 하셨습니다. (삼하 5:1-2)', actors: [{ id: 'davidS', x: 210, y: 190 }, { id: 'elder', x: 270, y: 186, flip: true }, { id: 'priest', x: 320, y: 188, flip: true }] },
      { text: '이스라엘의 모든 장로가 다윗에게 기름을 부어 온 이스라엘의 왕으로 세웠다. 그때 다윗은 서른 살이었다. (삼하 5:3-4)', banner: '이스라엘의 왕 다윗!', actors: [{ id: 'davidK', x: 220, y: 190 }, { id: 'elder', x: 280, y: 186, flip: true }, { id: 'priest', x: 330, y: 188, flip: true }] },
      { text: '왕이 된 다윗은 여부스 사람들이 지키는 예루살렘으로 올라갔다. (삼하 5:6)', bg: 'jebus', actors: [{ id: 'davidK', x: 180, y: 190 }, { id: 'ally2', x: 130, y: 186 }] },
      { who: 'lord', text: '하하! 이 성벽은 아무도 넘지 못한다. 너희는 결코 여기 들어오지 못할 것이다! (삼하 5:6)', actors: [{ id: 'davidK', x: 180, y: 190 }, { id: 'lord', x: 340, y: 186, flip: true }] },
      { who: 'david', text: '물 긷는 수구로 올라가라! 시온 산성을 되찾자! (삼하 5:8)' },
    ],
    next: { scene: 'stage', id: 'jerusalem' },
  },
  ending: {
    bg: 'zion',
    beats: [
      { text: '다윗은 시온 산성을 빼앗았다. 그곳이 바로 다윗 성이다. (삼하 5:7)', banner: '다윗 성', actors: [{ id: 'davidK', x: 240, y: 190 }, { id: 'ally1', x: 180, y: 186 }, { id: 'ally3', x: 300, y: 188, flip: true }] },
      { text: '다윗은 그 산성에 살면서 성을 둘러 쌓았다. (삼하 5:9)' },
      { who: 'david', text: '들에서 양 떼를 따라다니던 저를, 여호와께서 이스라엘의 목자로 세우셨습니다.', actors: [{ id: 'davidK', x: 240, y: 190 }, { id: 'sheep', x: 290, y: 192 }, { id: 'sheep', x: 312, y: 184 }] },
      { text: '다윗은 점점 강해졌다. 만군의 하나님 여호와께서 그와 함께 계셨기 때문이다. (삼하 5:10)' },
    ],
    next: { scene: 'credits' },
  },
  spare: {
    bg: 'wild',
    beats: [
      { text: '동굴에서 나온 사울 뒤로, 다윗이 따라 나와 땅에 엎드려 절했다. (삼상 24:8)', actors: [{ id: 'saul', x: 330, y: 188, flip: true }, { id: 'davidS', x: 210, y: 190 }] },
      { who: 'david', text: '내 아버지여, 보십시오. 왕의 옷자락을 베었지만 왕을 해치지 않았습니다. 여호와께서 기름 부으신 분께 손댈 수 없습니다. (삼상 24:6, 11)' },
      { who: 'saul', text: '내 아들 다윗아… 너는 나보다 의롭구나. 나는 너를 악으로 갚았는데, 너는 나를 선으로 갚았다. (삼상 24:16-17)' },
      { text: '얼마 뒤 십 광야에서도, 다윗은 잠든 사울의 창과 물병만 가지고 나왔다. 여호와께서 그들을 깊이 잠들게 하셨다. (삼상 26:12)', actors: [{ id: 'davidS', x: 160, y: 190 }, { id: 'saul', x: 360, y: 188, flip: true }] },
      { who: 'david', text: '아브넬아, 왕을 지키지 않고 무엇을 했느냐? 왕의 창과 물병이 어디 있는지 찾아보아라! (삼상 26:15-16)' },
      { who: 'saul', text: '내 아들 다윗아, 네게 복이 있기를 바란다. 네가 큰일을 하겠고, 반드시 이기리라. (삼상 26:25)' },
      { text: '그래도 다윗은 사울을 피해 블레셋 땅으로 가서, 시글락 성읍에 머물게 되었다. (삼상 27:1-6)', actors: [] },
    ],
    next: { scene: 'cutscene', id: 'ziklag' },
  },
  keilahAfter: {
    bg: 'wild',
    beats: [
      { text: '다윗은 블레셋을 크게 무찌르고 그일라 사람들을 구원했다. (삼상 23:5)', actors: [{ id: 'davidS', x: 220, y: 190 }, { id: 'ally1', x: 270, y: 186 }, { id: 'ally3', x: 310, y: 190 }] },
      { text: '그러나 사울이 군대를 이끌고 내려오자, 다윗은 십 광야의 요새로 몸을 피했다. 사울은 날마다 그를 찾았다. (삼상 23:13-14)', actors: [{ id: 'davidS', x: 220, y: 190 }] },
      { who: 'jonathan', text: '두려워 말게. 아버지의 손이 자네에게 미치지 못할 걸세. 자네는 이스라엘의 왕이 되고, 나는 그 다음이 될 걸세. (삼상 23:16-17)', actors: [{ id: 'jonathan', x: 280, y: 186, flip: true }, { id: 'davidS', x: 210, y: 190 }] },
      { text: '두 사람은 여호와 앞에서 언약을 맺고, 요나단은 집으로 돌아갔다. 다윗은 엔게디 요새로 올라갔다. (삼상 23:18, 29)', actors: [{ id: 'davidS', x: 230, y: 190 }] },
    ],
    next: { scene: 'stage', id: 'engedi' },
  },
};
