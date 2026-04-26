import { TOOL, ToolManager } from './ToolManager.js';
import { StatsPanel }        from './StatsPanel.js';
import { PopulationGraph }   from './PopulationGraph.js';
import { TribesPanel }       from './TribesPanel.js';
import { Toaster }           from './Toaster.js';
import { Minimap }           from './Minimap.js';
import { Modals }            from './Modals.js';
import { FpsMeter }          from './FpsMeter.js';
import { MomentOverlay }     from './MomentOverlay.js';
import { WorldGen }          from '../world/WorldGen.js';
import { TYPE }              from '../core/constants.js';
import { eventBus }          from '../core/eventBus.js';

const THRONGLET_STAGE_NAMES = {
  0: 'dormant',
  1: 'noticing',
  2: 'offering',
  3: 'symbols',
  4: 'contact',
};
const THRONGLET_STAGE_BLURBS = {
  1: 'Some humans paused and looked toward you.',
  2: 'A small offering has been arranged near your view.',
  3: 'They are spelling something on the ground.',
  4: 'One of them is walking toward you.',
};

const TERRAIN_TOOLS = new Set([
  TOOL.TERRAIN_WATER, TOOL.TERRAIN_GRASS, TOOL.TERRAIN_FOREST,
  TOOL.TERRAIN_DIRT,  TOOL.TERRAIN_SAND,  TOOL.TERRAIN_MOUNTAIN,
]);

const KEY_TO_TOOL = {
  '1': TOOL.SPAWN_PLANT,
  '2': TOOL.SPAWN_HERBIVORE,
  '3': TOOL.SPAWN_PREDATOR,
  '4': TOOL.SPAWN_HUMAN,
  'q': TOOL.INSPECT,
  'e': TOOL.ERASE,
};

const TYPE_EMOJI = {
  plant:     '🌱',
  herbivore: '🐑',
  predator:  '🐺',
  human:     '🧍',
  building:  '🏠',
};

export class UIManager {
  constructor({ canvas, world, registry, renderer, sim, civ }) {
    this.canvas   = canvas;
    this.world    = world;
    this.registry = registry;
    this.sim      = sim;
    this.renderer = renderer;
    this.civ      = civ;

    this.brushSize = 1;       // 1, 2, 3, or 5 — controlled by slider 0..3

    this.toolManager = new ToolManager(
      canvas, world, registry, renderer,
      (entity) => this._onInspect(entity),
      () => this.brushSize,
    );

    this.statsPanel  = new StatsPanel({ sim, registry });
    this.graph       = new PopulationGraph('graph-canvas', sim.history);
    this.tribesPanel = new TribesPanel(civ);
    this.toaster     = new Toaster(civ);
    this.minimap     = new Minimap({ world, registry, civ });
    this.modals      = new Modals();
    this.fpsMeter    = new FpsMeter();
    this.moments     = new MomentOverlay();

    this.minimap.onPan = (tx, ty) => this.renderer.panTo(tx, ty);

    this._currentInspectee = null;

    this._bindControls();
    this._bindToolbar();
    this._bindKeyboard();
    this._bindBrush();
    this._bindCanvasReadout();
    this._bindThrongletBadge();

    // Migration story events — surface the only "respawn" left in the sim
    eventBus.on('world:migration', ({ type, count }) => {
      const label = type === TYPE.HUMAN
        ? `<b>A band of ${count} travellers</b> has arrived from beyond the map.`
        : `<b>${count} predators</b> have wandered into the world.`;
      this.toaster.show(label, {
        kind: 'tribe', icon: type === TYPE.HUMAN ? '🧍' : '🐺',
        key: `migrate-${type}-${count}`,
      });
    });

    // Periodic ticker for HUD readouts (day/night, FPS already self-driven)
    setInterval(() => this._refreshHud(), 250);
  }

  _bindToolbar() {
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTool(btn.dataset.tool);
      });
    });
    this.setTool(TOOL.SPAWN_HERBIVORE);
  }

  setTool(tool) {
    this.toolManager.setTool(tool);
    document.getElementById('brush-dial')?.classList.toggle(
      'visible', TERRAIN_TOOLS.has(tool),
    );
  }

  _bindControls() {
    document.getElementById('btn-pause')?.addEventListener('click', () => this._togglePause());
    document.getElementById('btn-speed-up')?.addEventListener('click', () => this._adjustSpeed(+1));
    document.getElementById('btn-speed-down')?.addEventListener('click', () => this._adjustSpeed(-1));
    document.getElementById('btn-camera-reset')?.addEventListener('click', () => this.renderer.resetCamera());
    document.getElementById('btn-regenerate')?.addEventListener('click', () => this._regenerate());
  }

  _bindBrush() {
    const slider = document.getElementById('brush-size');
    const valEl  = document.getElementById('brush-size-val');
    if (!slider) return;
    const sizes = [1, 2, 3, 5];
    slider.addEventListener('input', () => {
      const idx = +slider.value;
      this.brushSize = sizes[idx];
      if (valEl) valEl.textContent = `${this.brushSize}×${this.brushSize}`;
    });
  }

  _bindThrongletBadge() {
    const badge = document.getElementById('thronglet-badge');
    const stageEl = document.getElementById('thr-stage');
    if (!badge || !stageEl) return;

    eventBus.on('thronglet:stage', ({ stage, restored, forced }) => {
      if (stage <= 0) {
        badge.style.display = 'none';
        return;
      }
      stageEl.textContent = String(stage);
      badge.title = `Thronglet awareness — ${THRONGLET_STAGE_NAMES[stage] ?? 'active'}. Run window.__thronglets.status() for details.`;
      badge.style.display = 'inline-flex';

      // Surface a toast on real stage transitions (skip when this is just
      // a restore-from-localStorage notification).
      if (!restored) {
        const blurb = THRONGLET_STAGE_BLURBS[stage] ?? 'Awareness deepening.';
        const prefix = forced ? 'Forced to ' : '';
        this.toaster.show(
          `<b>${prefix}Stage ${stage}</b> — ${blurb}`,
          { kind: 'skill', icon: '◉', key: `thr-stage-${stage}` },
        );
      }
    });
  }

  _bindCanvasReadout() {
    const el = document.getElementById('coords');
    if (!el) return;
    this.canvas.addEventListener('pointermove', e => {
      const r = this.canvas.getBoundingClientRect();
      const tile = this.renderer.raycastTile(e.clientX - r.left, e.clientY - r.top);
      if (tile) el.textContent = `tile  ${tile.x.toString().padStart(3, ' ')}, ${tile.y.toString().padStart(3, ' ')}`;
      else      el.textContent = '—';
    });
    this.canvas.addEventListener('pointerleave', () => el.textContent = '—');
  }

  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      // Don't intercept while a modal is open or focus is in an input.
      if (e.target?.tagName === 'INPUT') return;
      const open = document.querySelector('.modal-host[data-open="true"]');
      if (open && e.key !== 'h' && e.key !== 'H') return;

      const k = e.key;

      if (KEY_TO_TOOL[k.toLowerCase()]) {
        this.setTool(KEY_TO_TOOL[k.toLowerCase()]);
        e.preventDefault(); return;
      }
      if (k === ' ') { this._togglePause(); e.preventDefault(); return; }
      if (k === ']') { this._adjustSpeed(+1); e.preventDefault(); return; }
      if (k === '[') { this._adjustSpeed(-1); e.preventDefault(); return; }
      if (k === 'r' || k === 'R') { this._regenerate(); e.preventDefault(); return; }
      if (k === 'f' || k === 'F') { this.renderer.resetCamera(); e.preventDefault(); return; }
      if (k === 'h' || k === 'H' || k === '?') {
        this.modals.toggle(this.modals.help); e.preventDefault(); return;
      }
    });
  }

  _togglePause() {
    this.sim.paused = !this.sim.paused;
    const btn = document.getElementById('btn-pause');
    if (btn) {
      btn.title = this.sim.paused ? 'Resume — Space' : 'Pause — Space';
      btn.classList.toggle('active', this.sim.paused);
      btn.innerHTML = this.sim.paused
        ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`;
    }
    document.getElementById('pause-overlay')?.classList.toggle('visible', this.sim.paused);
  }

  _adjustSpeed(delta) {
    this.sim.speed = Math.max(1, Math.min(5, this.sim.speed + delta));
    const el = document.getElementById('stat-speed');
    if (el) el.textContent = `${this.sim.speed}×`;
  }

  _regenerate() {
    this.registry.clear();
    this.civ.reset();
    WorldGen.generate(this.world);
    this.renderer.rebuildTerrain();
    this.minimap.invalidateTerrain();
    this.sim.tick = 0;
    this.sim.resetHistory();
    this.toaster.reset();
    this.moments.reset();
    this._seedWorld();
    this.renderer.highlighted = null;
    this._onInspect(null);
    this.toaster.show('A new world has been generated', { icon: '🌍', kind: 'tribe', key: 'regen' });
  }

  // Called every frame from main.js so the FPS counter stays live.
  tickFrame() {
    this.fpsMeter.tick();
    // Refresh the inspector ~6× / sec so live values (hunger, age) update
    // without burning DOM updates every frame.
    const now = performance.now();
    if (this._currentInspectee && !this._currentInspectee.alive) {
      this._onInspect(null);
    } else if (this._currentInspectee && (now - (this._lastInspRender ?? 0) > 160)) {
      this._renderInspector(this._currentInspectee);
      this._lastInspRender = now;
    }
  }

  _refreshHud() {
    const dayEl = document.getElementById('stat-day');
    if (dayEl && this.renderer?.skySystem) {
      dayEl.textContent = `${this.renderer.skySystem.dayCount} · ${this.renderer.skySystem.getTimeLabel()}`;
    }
  }

  _onInspect(entity) {
    this._currentInspectee = entity ?? null;
    if (!entity) {
      const panel = document.getElementById('inspector-body');
      if (panel) {
        panel.innerHTML = `
          <div class="inspector-empty">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <div>Pick the <b>Inspect</b> tool, then click any creature, plant, or hut.</div>
          </div>`;
      }
      return;
    }
    this._renderInspector(entity);
  }

  _renderInspector(entity) {
    const panel = document.getElementById('inspector-body');
    if (!panel) return;

    const emoji = TYPE_EMOJI[entity.type] ?? '·';
    const headline = entity.name
      ? `<div class="insp-name">${entity.name}</div><div class="insp-sub">${entity.type}</div>`
      : `<div class="insp-name">${this._cap(entity.type)}</div><div class="insp-sub">id #${entity.id}</div>`;

    const tagRow = [];
    if (entity.tribeId != null && this.civ) {
      const t = this.civ.getTribe(entity.tribeId);
      if (t) tagRow.push(`<span class="tag tag-tribe" style="color:${t.color}">● ${t.name}</span>`);
    }
    if (entity.trait) tagRow.push(`<span class="tag tag-trait" title="${entity.trait.desc}">★ ${entity.trait.name}</span>`);
    if (entity.skill) tagRow.push(`<span class="tag tag-skill" title="${entity.skill.desc}">◆ ${entity.skill.name}</span>`);

    const bars = [];
    if (entity.hp !== undefined && entity.maxHp !== undefined) {
      bars.push(this._bar('HP', entity.hp, entity.maxHp, '#ff8b8b', `${entity.hp}/${entity.maxHp}`));
    }
    if (entity.hunger !== undefined) {
      bars.push(this._bar('Hunger', entity.hunger, 1, '#ffb45f', `${(entity.hunger * 100).toFixed(0)}%`, true));
    }
    if (entity.energy !== undefined) {
      bars.push(this._bar('Energy', entity.energy, 1, '#6cd58c', `${(entity.energy * 100).toFixed(0)}%`));
    }
    if (entity.maxAge !== undefined && entity.age !== undefined) {
      bars.push(this._bar('Age', entity.age, entity.maxAge, '#5fa8ff', `${Math.floor(entity.age)} / ${entity.maxAge}`));
    } else if (entity.age !== undefined) {
      bars.push(`<div class="stat-row"><span class="stat-label">Age</span><span class="stat-value">${Math.floor(entity.age)}</span></div>`);
    }

    const rows = [];
    if (entity.state     !== undefined) rows.push(['State',   entity.state]);
    if (entity.sex       !== undefined) rows.push(['Sex',     entity.sex === 'M' ? 'Male' : 'Female']);
    if (entity.gestating !== undefined && entity.gestating)  rows.push(['Gestating', 'Yes']);
    if (entity.stage     !== undefined) rows.push(['Stage', ['Seedling', 'Young', 'Mature'][entity.stage]]);
    // Humans expose a lifeStage getter (child / adult / elder)
    if (entity.lifeStage !== undefined) {
      rows.push(['Life stage', this._cap(entity.lifeStage)]);
    }
    if (entity.tribeId != null && this.civ) {
      const t = this.civ.getTribe(entity.tribeId);
      if (t) {
        rows.push(['Members', t.members.size]);
        rows.push(['Huts',    t.huts.size]);
        const enemies = [...t.enemies].map(id => this.civ.getTribe(id)?.name).filter(Boolean);
        if (enemies.length) rows.push(['At war with', enemies.join(', ')]);
      }
    }

    panel.innerHTML = `
      <div class="insp-card-head">
        <div class="insp-emoji">${emoji}</div>
        <div>${headline}</div>
      </div>
      ${tagRow.length ? `<div class="tag-row">${tagRow.join('')}</div>` : ''}
      ${bars.join('')}
      ${rows.map(([k, v]) =>
        `<div class="stat-row"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`
      ).join('')}
    `;
  }

  _bar(label, value, max, color, displayValue, invertColor = false) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    let barColor = color;
    if (invertColor) {
      // For hunger: red when high, green when low
      if (pct > 70)      barColor = '#ff6577';
      else if (pct > 40) barColor = '#ffb45f';
      else               barColor = '#6cd58c';
    }
    return `
      <div class="stat-bar-row">
        <div class="stat-bar-head">
          <span class="label">${label}</span>
          <span class="value">${displayValue}</span>
        </div>
        <div class="stat-bar"><i style="width:${pct}%; background:${barColor}; color:${barColor}"></i></div>
      </div>`;
  }

  _cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

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
    spawnRandom(TYPE.HERBIVORE, 75);
    spawnRandom(TYPE.PREDATOR,  10);
    spawnRandom(TYPE.HUMAN,     28);
  }
}
