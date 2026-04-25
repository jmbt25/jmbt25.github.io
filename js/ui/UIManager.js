import { TOOL, ToolManager } from './ToolManager.js';
import { StatsPanel }        from './StatsPanel.js';
import { PopulationGraph }   from './PopulationGraph.js';
import { TribesPanel }       from './TribesPanel.js';
import { WorldGen }          from '../world/WorldGen.js';
import { TYPE }              from '../core/constants.js';

export class UIManager {
  constructor({ canvas, world, registry, renderer, sim, civ }) {
    this.world    = world;
    this.registry = registry;
    this.sim      = sim;
    this.renderer = renderer;
    this.civ      = civ;

    // Wire up tool manager
    this.toolManager = new ToolManager(
      canvas, world, registry, renderer,
      (entity, tx, ty) => this._onInspect(entity, tx, ty),
    );

    // Stats, graph, tribes
    this.statsPanel  = new StatsPanel({ sim, registry });
    this.graph       = new PopulationGraph('graph-canvas', sim.history);
    this.tribesPanel = new TribesPanel(civ);

    this._bindControls();
    this._bindToolbar();
  }

  // ── Toolbar buttons ────────────────────────────────────────────────────────

  _bindToolbar() {
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.toolManager.setTool(btn.dataset.tool);
      });
    });
    // Set initial active
    this.toolManager.setTool(TOOL.SPAWN_HERBIVORE);
  }

  // ── Sim control buttons ────────────────────────────────────────────────────

  _bindControls() {
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this.sim.paused = !this.sim.paused;
      const btn = document.getElementById('btn-pause');
      btn.textContent   = this.sim.paused ? '▶' : '⏸';
      btn.title         = this.sim.paused ? 'Resume' : 'Pause';
    });

    document.getElementById('btn-speed')?.addEventListener('click', () => {
      this.sim.speed = (this.sim.speed % 5) + 1;
      const speedBtn = document.getElementById('btn-speed');
      speedBtn.textContent = `${this.sim.speed}×`;
      const speedStat = document.getElementById('stat-speed');
      if (speedStat) speedStat.textContent = `${this.sim.speed}×`;
    });

    document.getElementById('btn-regenerate')?.addEventListener('click', () => {
      this.registry.clear();
      this.civ.reset();
      WorldGen.generate(this.world);
      this.renderer.rebuildTerrain();
      this.sim.tick = 0;
      this.sim.resetHistory();
      this._seedWorld();
      this.renderer.highlighted = null;
      this._onInspect(null, 0, 0);
    });
  }

  // ── Inspect panel ──────────────────────────────────────────────────────────

  _onInspect(entity, tx, ty) {
    const panel = document.getElementById('inspector-body');
    if (!panel) return;

    if (!entity) {
      panel.innerHTML = `<div class="inspector-empty">Click an entity<br>to inspect it</div>`;
      return;
    }

    const rows = [
      ['Type',  entity.kind ?? entity.type],
      ['Age',   entity.age],
    ];
    if (entity.hp        !== undefined && entity.maxHp !== undefined) {
      rows.push(['HP', `${entity.hp}/${entity.maxHp}`]);
    }
    if (entity.hunger    !== undefined) rows.push(['Hunger',  `${(entity.hunger  * 100).toFixed(0)}%`]);
    if (entity.energy    !== undefined) rows.push(['Energy',  `${(entity.energy  * 100).toFixed(0)}%`]);
    if (entity.state     !== undefined) rows.push(['State',   entity.state]);
    if (entity.sex       !== undefined) rows.push(['Sex',     entity.sex === 'M' ? 'Male' : 'Female']);
    if (entity.gestating !== undefined) rows.push(['Gestating', entity.gestating ? 'Yes' : 'No']);
    if (entity.stage     !== undefined) rows.push(['Stage',   ['Seedling','Young','Mature'][entity.stage]]);

    if (entity.tribeId != null && this.civ) {
      const t = this.civ.getTribe(entity.tribeId);
      if (t) {
        const enemies = t.enemies.size > 0
          ? [...t.enemies].map(id => this.civ.getTribe(id)?.name).filter(Boolean).join(', ')
          : 'none';
        rows.push(['Tribe', `<span style="color:${t.color}">●</span> ${t.name}`]);
        rows.push(['Members', t.members.size]);
        rows.push(['Huts', t.huts.size]);
        rows.push(['At war with', enemies]);
      }
    }

    if (entity.trait) {
      rows.push(['Trait', `<span style="color:#ffd34d">★ ${entity.trait.name}</span> — ${entity.trait.desc}`]);
    }

    panel.innerHTML = rows.map(([k, v]) =>
      `<div class="stat-row"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`
    ).join('');
  }

  // ── World seeding ──────────────────────────────────────────────────────────

  _seedWorld() {
    const W = this.world.width;
    const H = this.world.height;
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
    spawnRandom(TYPE.HERBIVORE, 55);
    spawnRandom(TYPE.PREDATOR,  12);
    spawnRandom(TYPE.HUMAN,     14);
  }
}
