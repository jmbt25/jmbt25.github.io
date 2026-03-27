import { eventBus } from '../core/eventBus.js';

export class StatsPanel {
  constructor({ sim, registry }) {
    this.sim      = sim;
    this.registry = registry;

    this._tickEl  = document.getElementById('stat-tick');
    this._speedEl = document.getElementById('stat-speed');
    this._countEls = {
      plant:     document.getElementById('count-plant'),
      herbivore: document.getElementById('count-herbivore'),
      predator:  document.getElementById('count-predator'),
      human:     document.getElementById('count-human'),
    };

    // Throttle DOM updates to every other tick event to reduce layout cost
    this._frame = 0;

    eventBus.on('sim:tick', () => {
      this._frame++;
      if (this._frame % 2 === 0) this._update();
    });
  }

  _update() {
    const counts = this.registry.countByType();

    if (this._tickEl)  this._tickEl.textContent  = this.sim.tick;
    if (this._speedEl) this._speedEl.textContent = `${this.sim.speed}×`;

    for (const [type, el] of Object.entries(this._countEls)) {
      if (el) el.textContent = counts[type] ?? 0;
    }
  }
}
