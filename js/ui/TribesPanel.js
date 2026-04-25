import { eventBus } from '../core/eventBus.js';

/**
 * Tribes panel — sidebar list of currently active tribes, sorted by size.
 * Shows colour, name, member/hut counts, and a war badge with enemy names.
 */
export class TribesPanel {
  constructor(civ, containerId = 'tribes-body') {
    this.civ = civ;
    this.el  = document.getElementById(containerId);
    this.metaEl = document.getElementById('tribe-meta');
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
      .sort((a, b) => b.size() - a.size());
    const top = tribes.slice(0, 6);

    if (this.metaEl) {
      const wars = tribes.reduce((acc, t) => acc + (t.enemies.size > 0 ? 1 : 0), 0);
      this.metaEl.textContent = tribes.length === 0
        ? '—'
        : `${tribes.length} active${wars ? ` · ${Math.floor(wars/2 + (wars%2))} war` : ''}`;
    }

    if (top.length === 0) {
      this.el.innerHTML = `<div class="tribes-empty">No tribes yet — humans need to settle first</div>`;
      return;
    }

    const rows = top.map(t => {
      const enemies = [...t.enemies]
        .map(id => this.civ.getTribe(id))
        .filter(Boolean);
      const warHTML = enemies.length
        ? `<div class="tribe-war" title="${enemies.map(e => e.name).join(', ')}">⚔ vs ${enemies.map(e => `<span style="color:${e.color}">${e.name}</span>`).join(', ')}</div>`
        : '';
      return `
        <div class="tribe-row">
          <div class="tribe-dot" style="background:${t.color}; color:${t.color}"></div>
          <span class="tribe-name">${t.name}</span>
          <span class="tribe-count">
            <span title="Members">${t.members.size}</span>
            <span class="sep">·</span>
            <span title="Huts">${t.huts.size}🏠</span>
          </span>
          ${warHTML}
        </div>`;
    }).join('');

    this.el.innerHTML = rows;
  }
}
