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
  constructor({ sim, registry }) {
    this.sim      = sim;
    this.registry = registry;

    this._tickEl  = document.getElementById('stat-tick');
    this._speedEl = document.getElementById('stat-speed');
    this._totalEl = document.getElementById('pop-total');
    this._countEls = {};
    this._barEls   = {};
    for (const k of Object.keys(POP_SCALE)) {
      this._countEls[k] = document.getElementById(`count-${k}`);
      this._barEls[k]   = document.querySelector(`.pop-row[data-pop="${k}"] .pop-bar i`);
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

    if (this._tickEl)  this._tickEl.textContent  = this.sim.tick.toLocaleString();
    if (this._speedEl) this._speedEl.textContent = `${this.sim.speed}×`;

    let total = 0;
    for (const [type, scale] of Object.entries(POP_SCALE)) {
      const c = counts[type] ?? 0;
      total += c;
      const el = this._countEls[type];
      if (el) el.textContent = c.toLocaleString();
      const bar = this._barEls[type];
      if (bar) bar.style.width = Math.min(100, (c / scale) * 100) + '%';
    }
    if (this._totalEl) this._totalEl.textContent = total.toLocaleString();
  }
}
