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
    // Sort by living members, then by hut count as a tiebreaker. Living
    // tribes always appear above fallen (hut-only) ones.
    const tribes = [...this.civ.tribes.values()]
      .sort((a, b) => (b.livingSize() - a.livingSize()) || (b.huts.size - a.huts.size));
    const top = tribes.slice(0, 6);

    if (this.metaEl) {
      const living = tribes.filter(t => t.livingSize() > 0);
      // Count active wars only between *living* tribes (fallen tribes are
      // auto-peaced in CivilizationManager._diplomacyTick).
      const warCount = living.reduce((acc, t) => acc + (t.enemies.size > 0 ? 1 : 0), 0);
      this.metaEl.textContent = living.length === 0
        ? '—'
        : `${living.length} active${warCount ? ` · ${Math.floor(warCount/2 + (warCount%2))} war` : ''}`;
    }

    if (top.length === 0) {
      this.el.innerHTML = `<div class="tribes-empty">No tribes yet — humans need to settle first</div>`;
      return;
    }

    const rows = top.map(t => {
      const fallen = t.isFallen();
      const enemies = [...t.enemies]
        .map(id => this.civ.getTribe(id))
        .filter(Boolean);
      const warHTML = !fallen && enemies.length
        ? `<div class="tribe-war" title="${enemies.map(e => e.name).join(', ')}">⚔ vs ${enemies.map(e => `<span style="color:${e.color}">${e.name}</span>`).join(', ')}</div>`
        : '';
      const fallenTag = fallen
        ? `<span class="tribe-fallen" title="No surviving members — only ruins remain">fallen</span>`
        : '';
      const wood  = t.resources?.wood  ?? 0;
      const stone = t.resources?.stone ?? 0;
      const resHTML = (wood > 0 || stone > 0)
        ? `<div class="tribe-res" title="Stockpile">🌲 ${wood} · ⛰ ${stone}</div>`
        : '';
      return `
        <div class="tribe-row${fallen ? ' tribe-row-fallen' : ''}">
          <div class="tribe-dot" style="background:${t.color}; color:${t.color}"></div>
          <span class="tribe-name">${t.name}${fallenTag}</span>
          <span class="tribe-count">
            <span title="Living members">${t.members.size}</span>
            <span class="sep">·</span>
            <span title="Huts">${t.huts.size}🏠</span>
          </span>
          ${resHTML}
          ${warHTML}
        </div>`;
    }).join('');

    this.el.innerHTML = rows;
  }
}
