/**
 * UIManager — wires the new pixel HUD:
 *   - top-left WORLD SIMULATION panel (StatsPanel)
 *   - top-right transport controls + event feed (Toaster)
 *   - bottom-center resource bars (ResourceManager)
 *   - bottom-left minimap
 *   - bottom-right WORLD SEED + reseed
 *   - cinematic moment overlay (Thronglet captions)
 *   - centered title that fades after a few seconds
 */
import { StatsPanel }       from './StatsPanel.js';
import { Toaster }          from './Toaster.js';
import { Minimap }          from './Minimap.js';
import { FpsMeter }         from './FpsMeter.js';
import { MomentOverlay }    from './MomentOverlay.js';
import { WorldGen }         from '../world/WorldGen.js';
import { TYPE }             from '../core/constants.js';
import { eventBus }         from '../core/eventBus.js';
import { ResourceManager }  from '../sim/ResourceManager.js';

const TITLE_FADE_MS = 4500;

export class UIManager {
  constructor({ canvas, world, registry, renderer, sim, civ, thronglets, initialSeed }) {
    this.canvas     = canvas;
    this.world      = world;
    this.registry   = registry;
    this.sim        = sim;
    this.renderer   = renderer;
    this.civ        = civ;
    this.thronglets = thronglets ?? null;
    this.worldSeed  = initialSeed ?? generateSeed();

    this.statsPanel = new StatsPanel({ sim, registry, civ, thronglets: this.thronglets, renderer });
    this.toaster    = new Toaster(civ);
    this.minimap    = new Minimap({ world, registry, civ });
    this.fpsMeter   = new FpsMeter();
    this.moments    = new MomentOverlay();
    this.resources  = new ResourceManager({ world, registry, civ, sim });

    this.minimap.onPan = (tx, ty) => this.renderer.panTo(tx, ty);

    this._renderSeed();
    this._bindControls();
    this._bindKeyboard();
    this._scheduleTitleFade();

    eventBus.on('world:migration', ({ type, count }) => {
      // Toaster handles its own copy; this is a no-op stub for future hooks
    });

    setInterval(() => this._refreshHud(), 250);
  }

  _bindControls() {
    document.getElementById('btn-pause')?.addEventListener('click', () => this._togglePause());
    document.getElementById('btn-play')?.addEventListener('click', () => this._setSpeed(1));
    document.getElementById('btn-fast')?.addEventListener('click', () => this._setSpeed(3));
    document.getElementById('btn-reseed')?.addEventListener('click', () => this._regenerate(true));
  }

  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target?.tagName === 'INPUT') return;
      const k = e.key;
      if (k === ' ') { this._togglePause(); e.preventDefault(); return; }
      if (k === ']') { this._adjustSpeed(+1); e.preventDefault(); return; }
      if (k === '[') { this._adjustSpeed(-1); e.preventDefault(); return; }
      if (k === 'r' || k === 'R') { this._regenerate(true); e.preventDefault(); return; }
      if (k === 'f' || k === 'F') { this.renderer.resetCamera?.(); e.preventDefault(); return; }
    });
  }

  _scheduleTitleFade() {
    const t = document.getElementById('world-title');
    if (!t) return;
    setTimeout(() => t.classList.add('faded'), TITLE_FADE_MS);
  }

  _togglePause() {
    this.sim.paused = !this.sim.paused;
    const btn = document.getElementById('btn-pause');
    if (btn) btn.classList.toggle('active', this.sim.paused);
    document.getElementById('pause-overlay')?.classList.toggle('visible', this.sim.paused);
  }

  _setSpeed(s) {
    this.sim.speed = Math.max(1, Math.min(5, s));
    this._renderSpeed();
  }

  _adjustSpeed(delta) {
    this.sim.speed = Math.max(1, Math.min(5, this.sim.speed + delta));
    this._renderSpeed();
  }

  _renderSpeed() {
    const el = document.getElementById('stat-speed');
    if (el) el.textContent = `${this.sim.speed}×`;
    document.getElementById('btn-fast')?.classList.toggle('active', this.sim.speed >= 3);
    document.getElementById('btn-play')?.classList.toggle('active', this.sim.speed === 1 && !this.sim.paused);
  }

  _regenerate(reseed = false) {
    if (reseed) this.worldSeed = generateSeed();
    this._renderSeed();
    this.registry.clear();
    this.civ.reset();
    this.world.clearHutInfluence?.();
    WorldGen.generate(this.world, seedToInt(this.worldSeed));
    this.renderer.rebuildTerrain();
    this.minimap.invalidateTerrain?.();
    this.resources.refreshTerrain();
    this.sim.tick = 0;
    this.sim.resetHistory?.();
    this.toaster.reset();
    this.moments.reset();
    this._seedWorld();
    this.renderer.highlighted = null;
  }

  _renderSeed() {
    const el = document.getElementById('seed-value');
    if (el) el.textContent = this.worldSeed;
  }

  tickFrame() {
    this.fpsMeter.tick();
  }

  _refreshHud() {
    // Resource bars
    const r = this.resources.update();
    this._writeResourceBar('energy',    r.energy);
    this._writeResourceBar('food',      r.food);
    this._writeResourceBar('wood',      r.wood);
    this._writeResourceBar('stone',     r.stone);
    this._writeResourceBar('happiness', r.happiness);
  }

  _writeResourceBar(key, value01) {
    const pct = Math.round(value01 * 100);
    const bar = document.getElementById(`bar-${key}`);
    const lbl = document.getElementById(`count-${key}`);
    if (bar) bar.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `${pct}%`;
  }

  _seedWorld() {
    const W = this.world.width, H = this.world.height;
    const spawnRandom = (type, count) => {
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 20) {
        tries++;
        const x = Math.floor(Math.random() * W);
        const y = Math.floor(Math.random() * H);
        if (!this.world.isPassable(x, y)) continue;
        if (this.registry.spawn(type, x, y)) placed++;
      }
    };
    spawnRandom(TYPE.HERBIVORE, 90);
    spawnRandom(TYPE.PREDATOR,  6);
    spawnRandom(TYPE.HUMAN,     60);
  }
}

export function generateSeed() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () => {
    let s = '';
    for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  };
  return `${group()}-${group()}-${group()}`;
}

export function seedToInt(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
