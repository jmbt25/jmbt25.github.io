import * as THREE from 'three';
import { Camera3D } from './Camera3D.js';
import { TileRenderer3D } from './TileRenderer3D.js';
import { EntityRenderer3D } from './EntityRenderer3D.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';

export class Renderer3D {
  constructor(canvas, world, registry) {
    this.canvas   = canvas;
    this.world    = world;
    this.registry = registry;
    this.civ      = null;     // injected by main.js after construction
    this.highlighted = null;

    const w = canvas.width;
    const h = canvas.height;

    this.webglRenderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false,
    });
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webglRenderer.setSize(w, h, false);
    this.webglRenderer.setClearColor(0x0d1117, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0d1117, WORLD_WIDTH * 0.9, WORLD_WIDTH * 1.8);

    this.camera3d = new Camera3D(canvas, w, h);

    this.tileRenderer3d   = new TileRenderer3D();
    this.entityRenderer3d = new EntityRenderer3D();

    this.scene.add(this.tileRenderer3d.mesh);
    this.scene.add(this.tileRenderer3d.cursor);
    for (const m of this.entityRenderer3d.allMeshes) this.scene.add(m);
    this.scene.add(this.entityRenderer3d.highlight);

    this._setupLighting();
    this.tileRenderer3d.rebuild(world);

    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
  }

  _setupLighting() {
    this.scene.add(new THREE.AmbientLight(0x6688aa, 0.55));

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
    sun.position.set(WORLD_WIDTH * 0.4, 80, -WORLD_HEIGHT * 0.3);
    sun.target.position.set(WORLD_WIDTH / 2, 0, WORLD_HEIGHT / 2);
    this.scene.add(sun);
    this.scene.add(sun.target);

    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5a28, 0.35));
  }

  render() {
    this.camera3d.update();
    this.entityRenderer3d.update(this.registry, this.tileRenderer3d, this.civ);
    this.entityRenderer3d.setHighlighted(this.highlighted, this.tileRenderer3d);
    this.webglRenderer.render(this.scene, this.camera3d.camera);
  }

  resize(w, h) {
    this.webglRenderer.setSize(w, h, false);
    this.camera3d.resize(w, h);
  }

  rebuildTerrain() {
    this.tileRenderer3d.rebuild(this.world);
  }

  /** Convert canvas pixel coords → tile coords by raycasting onto the terrain mesh. */
  raycastTile(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    this._ndc.x = (screenX / rect.width) * 2 - 1;
    this._ndc.y = -(screenY / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, this.camera3d.camera);
    const hits = this._raycaster.intersectObject(this.tileRenderer3d.mesh, false);
    if (!hits.length) return null;
    const p = hits[0].point;
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.z);
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return null;
    return { x: tx, y: ty };
  }

  setCursorTile(tx, ty) {
    this.tileRenderer3d.setCursorTile(tx, ty);
  }

  clearCursor() {
    this.tileRenderer3d.clearCursor();
  }
}
