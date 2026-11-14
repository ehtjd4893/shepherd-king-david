import Phaser from 'phaser';
import { frameOf, sheepFrame } from './art.ts';

const FONT = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
const LINES = [
  ['목동왕 다윗', 30], ['', 10],
  ['양 치던 소년이 왕이 되기까지', 13], ['사무엘상 8장 – 사무엘하 5장', 11], ['', 18],
  ['등장인물', 15], ['다윗 · 사무엘 · 사울 · 요나단 · 미갈', 12], ['이새와 형들 · 아히멜렉 · 아기스 왕 · 아둘람의 용사들', 12],
  ['골리앗 · 블레셋 군대 · 아말렉 · 여부스 사람들', 12], ['그리고 양 떼, 곰과 사자', 12], ['', 18],
  ['그림', 15], ['코드로 한 점씩 찍은 픽셀아트', 12], ['', 12],
  ['엔진', 15], ['Phaser 4 · TypeScript · Vite', 12], ['', 18],
  ['"여호와는 나의 목자시니 내게 부족함이 없으리로다"', 13], ['(시편 23:1)', 11], ['', 24],
  ['끝까지 함께해 주셔서 고맙습니다', 15], ['', 10], ['THE END', 26],
] as const;

/** Rolling credits after the ending; any button skips. */
export class CreditsScene extends Phaser.Scene {
  private T = 0;
  private roll!: Phaser.GameObjects.Container;
  private height = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() { super('credits'); }

  create() {
    this.T = 0;
    this.add.rectangle(0, 0, 480, 270, 0x0d0a14).setOrigin(0);
    this.roll = this.add.container(240, 280);
    let y = 0;
    for (const [text, size] of LINES) {
      if (text) this.roll.add(this.add.text(0, y, text, { fontFamily: FONT, fontSize: `${size}px`, color: size >= 15 ? '#f2c14e' : '#f3ecd9', align: 'center' }).setOrigin(0.5, 0));
      y += size + 8;
    }
    // David the king with his flock, at the very end
    const add = (key: string, s: { c: HTMLCanvasElement; ox: number; oy: number }, x: number) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, s.c);
      this.roll.add(this.add.image(x, y + 60, key).setOrigin(s.ox / s.c.width, s.oy / s.c.height));
    };
    add('credits_david', frameOf('davidK', 'idle', 0), 0);
    add('credits_sheep0', sheepFrame(0), -50);
    add('credits_sheep1', sheepFrame(1), 50);
    this.height = y + 80;
    this.keys = this.input.keyboard!.addKeys('Z,X,J,K,ENTER,SPACE,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', () => { if (this.T > 1.5) this.scene.start('title'); });
  }

  update(_: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05);
    this.T += dt;
    // stop once the last line (David and the sheep) sits mid-screen
    this.roll.y = Math.max(140 - this.height + 40, this.roll.y - 24 * dt);
    const skip = this.T > 1.5 && Object.values(this.keys).some(k => Phaser.Input.Keyboard.JustDown(k));
    if (skip || this.T > (this.height + 100) / 24 + 6) this.scene.start('title'); // ~6 s on the last picture
  }
}
