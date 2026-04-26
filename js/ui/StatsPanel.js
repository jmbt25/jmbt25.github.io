import { eventBus } from '../core/eventBus.js';

// Per-species "expected scale" — used to size the population bars so a single
// 100-strong herd doesn't make every other species look empty.
const POP_SCALE = {
  plant:     800,
  herbivore: 200,
  predator:  60,
  human:     90,
};

export class StatsPanel {
  constructor({ sim, registry, civ, thronglets }) {
    this.sim         = sim;
    this.registry    = registry;
    this.civ         = civ;
    this.thronglets  = thronglets;

    this._tickEl     = document.getElementById('stat-tick-tag');
    this._speedEl    = document.getElementById('stat-speed');
    this._popEl      = document.getElementById('stat-pop');
    this._tribesEl   = document.getElementById('stat-tribes');
    this._watchersEl = document.getElementById('stat-watchers');
    this._awareValEl = document.getElementById('count-awareness');
    this._awareBarEl = document.getElementById('bar-awareness');

    this._countEls = {};
    this._barEls   = {};
    for (const k of Object.keys(POP_SCALE)) {
      this._countEls[k] = document.getElementById(`count-${k}`);
      this._barEls[k]   = document.getElementById(`bar-${k}`);
    }

    this._frame = 0;

    eventBus.on('sim:tick', () => {
      this._frame++;
      if (this._frame % 2 === 0) this._update();
    });
    this._update();
  }

  _update() {
    const counts = this.registry.countByType();

    if (this._tickEl)  this._tickEl.textContent  = `tick ${this.sim.tick.toLocaleString()}`;
    if (this._speedEl) this._speedEl.textContent = `${this.sim.speed}×`;

    let totalLiving = 0;
    for (const [type, scale] of Object.entries(POP_SCALE)) {
      const c = counts[type] ?? 0;
      if (type !== 'plant') totalLiving += c;
      const el = this._countEls[type];
      if (el) el.textContent = c.toLocaleString();
      const bar = this._barEls[type];
      if (bar) bar.style.width = Math.min(100, (c / scale) * 100) + '%';
    }

    if (this._popEl)    this._popEl.textContent    = totalLiving.toLocaleString();
    if (this._tribesEl) this._tribesEl.textContent = (this.civ?.tribes?.size ?? 0).toString();

    // Awareness — Thronglet awareness as 0–100% against Stage 4 threshold (CONTACT = 150_000).
    if (this.thronglets) {
      const aw = Math.max(0, this.thronglets.awareness ?? 0);
      const pct = Math.min(100, (aw / 150_000) * 100);
      if (this._awareValEl) this._awareValEl.textContent = `${pct.toFixed(0)}%`;
      if (this._awareBarEl) this._awareBarEl.style.width = pct + '%';
      if (this._watchersEl) this._watchersEl.textContent = String(this.thronglets.visitCount ?? 1);
    } else {
      if (this._awareValEl) this._awareValEl.textContent = '0%';
      if (this._awareBarEl) this._awareBarEl.style.width = '0%';
    }
  }
}
