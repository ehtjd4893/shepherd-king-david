import Phaser from 'phaser';
import { TitleScene } from './TitleScene.ts';
import { CutsceneScene } from './CutsceneScene.ts';
import { StageScene } from './StageScene.ts';
import { ShaftScene } from './ShaftScene.ts';
import { CreditsScene } from './CreditsScene.ts';

// Wait briefly for the Korean UI font so HUD text doesn't render in a fallback face first.
await Promise.race([document.fonts.load('10px "Do Hyeon"'), new Promise(r => setTimeout(r, 1500))]).catch(() => {});

const game = new Phaser.Game({
  // dev: ?canvas forces the 2D renderer (background test tabs may get no WebGL context)
  type: import.meta.env.DEV && new URLSearchParams(location.search).has('canvas') ? Phaser.CANVAS : Phaser.AUTO,
  width: 480,
  height: 270,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  input: { gamepad: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, CutsceneScene, StageScene, ShaftScene, CreditsScene],
});
if (import.meta.env.DEV) Object.assign(window, { game }); // dev-only handle for poking at state from the console

// Installable + offline (production build only): register the service worker, then hand it every file this page loaded.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(async () => {
    const reg = await navigator.serviceWorker.ready;
    const urls = [location.href.split('#')[0], ...performance.getEntriesByType('resource').map(r => r.name)];
    reg.active?.postMessage({ type: 'cache', urls });
  }).catch(err => console.warn('offline mode unavailable:', err));
}
