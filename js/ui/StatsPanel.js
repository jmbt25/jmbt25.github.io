import { eventBus } from '../core/eventBus.js';

/**
 * StatsPanel — writes top-left HUD readouts every couple of ticks.
 * Matches the reference mockup: POPULATION, TRIBES, TIME (HH:MM from sky),
 * ENVIRONMENT (DAWN/DUSK/etc.), WATCHERS (Thronglet visit count).
 *
 * Resource bars are owned by ResourceManager + UIManager — not this class.
 */
export class StatsPanel {
  constructor({ sim, registry, civ, thronglets, renderer }) {
    this.sim = sim;
    this.registry = registry;
    this.civ = civ;
    this.thronglets = thronglets;
    this.renderer = renderer;

    this._popEl      = document.getElementById('stat-pop');
    this._tribesEl   = document.getElementById('stat-tribes');
    this._timeEl     = document.getElementById('stat-time');
    this._envEl      = document.getElementById('stat-env');
    this._watchersEl = document.getElementById('stat-watchers');

    this._frame = 0;
    eventBus.on('sim:tick', () => {
      this._frame++;
      if (this._frame % 2 === 0) this._update();
    });
    this._update();
  }

  _update() {
    const counts = this.registry.countByType();
    const totalLiving =
      (counts.herbivore ?? 0) + (counts.predator ?? 0) + (counts.human ?? 0);

    if (this._popEl)    this._popEl.textContent    = totalLiving.toLocaleString();
    if (this._tribesEl) this._tribesEl.textContent = (this.civ?.tribes?.size ?? 0).toString();

    // TIME — use the sky system's day cycle as a synthetic clock.
    if (this._timeEl) {
      const sky = this.renderer?.skySystem;
      let label = '00:00';
      if (sky) {
        // SkySystem phase is 0..1 across one day. Map to HH:MM.
        const phase = (typeof sky.getPhase === 'function') ? sky.getPhase() : 0;
        const totalMinutes = Math.floor(phase * 24 * 60);
        const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
        const mm = String(totalMinutes % 60).padStart(2, '0');
        label = `${hh}:${mm}`;
      }
      this._timeEl.textContent = label;
    }

    if (this._envEl) {
      const sky = this.renderer?.skySystem;
      this._envEl.textContent = (sky?.getTimeLabel?.() ?? '—').toUpperCase();
    }

    if (this._watchersEl && this.thronglets) {
      this._watchersEl.textContent = String(this.thronglets.visitCount ?? 1);
    }
  }
}
