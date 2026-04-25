import { TYPE }    from '../core/constants.js';
import { TERRAIN } from '../world/TerrainType.js';

export const TOOL = Object.freeze({
  INSPECT:          'inspect',
  ERASE:            'erase',
  SPAWN_PLANT:      'spawn_plant',
  SPAWN_HERBIVORE:  'spawn_herbivore',
  SPAWN_PREDATOR:   'spawn_predator',
  SPAWN_HUMAN:      'spawn_human',
  TERRAIN_WATER:    'terrain_water',
  TERRAIN_GRASS:    'terrain_grass',
  TERRAIN_FOREST:   'terrain_forest',
  TERRAIN_DIRT:     'terrain_dirt',
  TERRAIN_MOUNTAIN: 'terrain_mountain',
  TERRAIN_SAND:     'terrain_sand',
});

const TOOL_TO_TERRAIN = {
  [TOOL.TERRAIN_WATER]:    TERRAIN.WATER,
  [TOOL.TERRAIN_GRASS]:    TERRAIN.GRASS,
  [TOOL.TERRAIN_FOREST]:   TERRAIN.FOREST,
  [TOOL.TERRAIN_DIRT]:     TERRAIN.DIRT,
  [TOOL.TERRAIN_MOUNTAIN]: TERRAIN.MOUNTAIN,
  [TOOL.TERRAIN_SAND]:     TERRAIN.SAND,
};

const TOOL_TO_ENTITY = {
  [TOOL.SPAWN_PLANT]:     TYPE.PLANT,
  [TOOL.SPAWN_HERBIVORE]: TYPE.HERBIVORE,
  [TOOL.SPAWN_PREDATOR]:  TYPE.PREDATOR,
  [TOOL.SPAWN_HUMAN]:     TYPE.HUMAN,
};

export class ToolManager {
  constructor(canvas, world, registry, renderer, onInspect) {
    this.canvas    = canvas;
    this.world     = world;
    this.registry  = registry;
    this.renderer  = renderer;
    this.onInspect = onInspect;

    this.activeTool = TOOL.SPAWN_HERBIVORE;
    this._pressing  = false;

    this._bind();
  }

  setTool(tool) {
    this.activeTool = tool;
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  _bind() {
    const el = this.canvas;
    el.addEventListener('pointerdown',  e => this._onDown(e));
    el.addEventListener('pointermove',  e => this._onMove(e));
    el.addEventListener('pointerup',    e => this._onUp(e));
    el.addEventListener('pointerleave', e => this._onUp(e));
    el.addEventListener('contextmenu',  e => e.preventDefault());
  }

  _getCanvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _onDown(e) {
    if (e.button !== 0) return;   // OrbitControls owns middle/right
    const pos = this._getCanvasPos(e);
    this._pressing = true;
    this._applyTool(pos.x, pos.y);
  }

  _onMove(e) {
    const pos = this._getCanvasPos(e);
    const tile = this.renderer.raycastTile(pos.x, pos.y);
    if (tile) {
      this.renderer.setCursorTile(tile.x, tile.y);
    } else {
      this.renderer.clearCursor();
    }

    if (this._pressing) this._applyTool(pos.x, pos.y);
  }

  _onUp() {
    this._pressing = false;
  }

  _applyTool(screenX, screenY) {
    const tile = this.renderer.raycastTile(screenX, screenY);
    if (!tile) return;
    const { x, y } = tile;
    if (!this.world.inBounds(x, y)) return;

    const tool = this.activeTool;

    if (TOOL_TO_TERRAIN[tool] !== undefined) {
      this.world.setTerrain(x, y, TOOL_TO_TERRAIN[tool]);
      this.renderer.rebuildTerrain();
      return;
    }

    if (TOOL_TO_ENTITY[tool]) {
      const type = TOOL_TO_ENTITY[tool];
      if (type === TYPE.PLANT) {
        if (this.world.getFertility(x, y) > 0) this.registry.spawn(type, x, y);
      } else {
        if (this.world.isPassable(x, y)) this.registry.spawn(type, x, y);
      }
      return;
    }

    if (tool === TOOL.ERASE) {
      for (const id of [...this.world.getEntitiesAt(x, y)]) {
        this.registry.killById(id);
      }
      return;
    }

    if (tool === TOOL.INSPECT) {
      const ids = [...this.world.getEntitiesAt(x, y)];
      const ent = ids.length ? this.registry.get(ids[0]) : null;
      this.renderer.highlighted = ent || null;
      this.onInspect(ent || null, x, y);
    }
  }
}
