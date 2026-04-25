import { eventBus } from '../core/eventBus.js';

/**
 * Renders the list of active tribes in the right sidebar:
 *   ●  Aurelians  (12)  ⚔ Drovaks
 * Each row colored by tribe color. Updates throttled to every 4th sim:tick.
 */
export class TribesPanel {
  constructor(civ, containerId = 'tribes-body') {
    this.civ = civ;
    this.el  = document.getElementById(containerId);
    this._frame = 0;

    eventBus.on('sim:tick', () => {
      this._frame++;
      if (this._frame % 4 === 0) this._render();
    });
    this._render();
  }

  _render() {
    if (!this.el) return;
    const tribes = [...this.civ.tribes.values()]
      .sort((a, b) => b.size() - a.size())
      .slice(0, 6);

    if (tribes.length === 0) {
      this.el.innerHTML = `<div class="tribes-empty">No tribes yet</div>`;
      return;
    }

    const rows = tribes.map(t => {
      const enemies = [...t.enemies]
        .map(id => this.civ.getTribe(id)?.name)
        .filter(Boolean);
      const warHTML = enemies.length
        ? `<span class="tribe-war" title="At war with: ${enemies.join(', ')}">⚔ ${enemies.length}</span>`
        : '';
      return `
        <div class="tribe-row">
          <div class="tribe-dot" style="background:${t.color}"></div>
          <span class="tribe-name">${t.name}</span>
          <span class="tribe-count">${t.members.size}/${t.huts.size}</span>
          ${warHTML}
        </div>`;
    }).join('');

    this.el.innerHTML = rows;
  }
}
