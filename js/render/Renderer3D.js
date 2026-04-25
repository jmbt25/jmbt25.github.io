import * as THREE from 'three';
import { Camera3D } from './Camera3D.js';
import { TileRenderer3D } from './TileRenderer3D.js';
import { EntityRenderer3D } from './EntityRenderer3D.js';
import { SkySystem } from './SkySystem.js';
import { WaterPlane } from './WaterPlane.js';
import { ParticleSystem } from './ParticleSystem.js';
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
      powerPreference: 'high-performance',
    });
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webglRenderer.setSize(w, h, false);
    this.webglRenderer.setClearColor(0x070912, 1);
    this.webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.webglRenderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0d1117, WORLD_WIDTH * 0.95, WORLD_WIDTH * 1.9);

    this.camera3d = new Camera3D(canvas, w, h);

    this.tileRenderer3d   = new TileRenderer3D();
    this.entityRenderer3d = new EntityRenderer3D();
    this.skySystem        = new SkySystem(this.scene);
    this.waterPlane       = new WaterPlane();
    this.particles        = new ParticleSystem();

    this.scene.add(this.tileRenderer3d.mesh);
    this.scene.add(this.tileRenderer3d.cursor);
    this.scene.add(this.waterPlane.mesh);
    this.scene.add(this.particles.points);
    for (const m of this.entityRenderer3d.allMeshes) this.scene.add(m);
    this.scene.add(this.entityRenderer3d.highlight);

    this.tileRenderer3d.rebuild(world);

    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._fogScratch = new THREE.Color();
  }

  render() {
    this.skySystem.update(this.scene);
    this.skySystem.getFogColor(this._fogScratch);
    this.waterPlane.setHighlightColor(this._fogScratch);
    this.particles.setColor(this._fogScratch);

    this.camera3d.update();
    this.entityRenderer3d.update(this.registry, this.tileRenderer3d, this.civ);
    this.entityRenderer3d.setHighlighted(this.highlighted, this.tileRenderer3d);
    this.waterPlane.update();
    this.particles.update(this.registry, this.tileRenderer3d);
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

  setCursorTile(tx, ty, brushSize = 1) {
    this.tileRenderer3d.setCursorTile(tx, ty, brushSize);
  }

  clearCursor() {
    this.tileRenderer3d.clearCursor();
  }

  /** Reset camera to its starting orbit pose. */
  resetCamera() {
    this.camera3d.resetToDefault();
  }

  /** Smoothly pan the camera target to (worldX, worldZ). */
  panTo(worldX, worldZ) {
    this.camera3d.panTo(worldX, worldZ);
  }
}
