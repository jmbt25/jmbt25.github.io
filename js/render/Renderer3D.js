import * as THREE from 'three';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }       from 'three/addons/postprocessing/OutputPass.js';
import { Camera3D } from './Camera3D.js';
import { TileRenderer3D } from './TileRenderer3D.js';
import { EntityRenderer3D } from './EntityRenderer3D.js';
import { TerrainDecorations } from './TerrainDecorations.js';
import { SkySystem } from './SkySystem.js';
import { WaterPlane } from './WaterPlane.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Fireflies } from './Fireflies.js';
import { StatusBubbles } from './StatusBubbles.js';
import { EffectsSystem } from './EffectsSystem.js';
import { ThrongletGlyphs } from './ThrongletGlyphs.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';

export class Renderer3D {
  constructor(canvas, world, registry) {
    this.canvas   = canvas;
    this.world    = world;
    this.registry = registry;
    this.civ      = null;
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

    // Shadows transform the look from "flat polygons" to "real 3D world".
    // PCF soft shadows are a good speed/quality compromise.
    this.webglRenderer.shadowMap.enabled = true;
    this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0d1117, WORLD_WIDTH * 1.05, WORLD_WIDTH * 2.0);

    this.camera3d = new Camera3D(canvas, w, h);

    this.tileRenderer3d   = new TileRenderer3D();
    this.entityRenderer3d = new EntityRenderer3D();
    this.decorations      = new TerrainDecorations(world, this.tileRenderer3d);
    this.skySystem        = new SkySystem(this.scene);
    this.waterPlane       = new WaterPlane();
    this.particles        = new ParticleSystem();
    this.fireflies        = new Fireflies();
    this.statusBubbles    = new StatusBubbles();
    this.effects          = new EffectsSystem(this.tileRenderer3d, registry);
    this.thrGlyphs        = new ThrongletGlyphs(this.tileRenderer3d);

    // The sky's directional sun casts shadows. Set up shadow camera bounds once.
    const sun = this.skySystem.sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 600;
    const sb = Math.max(WORLD_WIDTH, WORLD_HEIGHT) * 0.85;
    sun.shadow.camera.left   = -sb;
    sun.shadow.camera.right  =  sb;
    sun.shadow.camera.top    =  sb;
    sun.shadow.camera.bottom = -sb;
    sun.shadow.bias          = -0.0006;
    sun.shadow.normalBias    =  0.06;
    sun.shadow.radius        =  3;

    this.scene.add(this.tileRenderer3d.mesh);
    this.scene.add(this.tileRenderer3d.cursor);
    this.scene.add(this.waterPlane.mesh);
    this.scene.add(this.particles.points);
    this.scene.add(this.fireflies.points);
    this.scene.add(this.effects.points);
    this.scene.add(this.thrGlyphs.mesh);
    this.scene.add(this.thrGlyphs.beaconMesh);
    for (const m of this.decorations.allMeshes) this.scene.add(m);
    for (const m of this.entityRenderer3d.allMeshes) this.scene.add(m);
    for (const m of this.statusBubbles.allMeshes) this.scene.add(m);
    this.scene.add(this.entityRenderer3d.highlight);

    this.tileRenderer3d.rebuild(world);
    this.decorations.rebuild();
    this.waterPlane.setShoreFromWorld(world);
    this.fireflies.scatter(world, this.tileRenderer3d);

    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._fogScratch = new THREE.Color();

    // Postprocessing — soft bloom for the cyan Thronglet beacon, fireflies,
    // sun disc, and any window-glow on huts. Threshold is high enough that
    // ordinary terrain doesn't bloom; strength keeps things tasteful.
    this.composer = new EffectComposer(this.webglRenderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(this.scene, this.camera3d.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      0.55,    // strength
      0.45,    // radius
      0.78,    // threshold (only bright pixels bloom)
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  render() {
    this.skySystem.update(this.scene);
    this.skySystem.getFogColor(this._fogScratch);
    this.waterPlane.setHighlightColor(this._fogScratch);
    this.particles.setColor(this._fogScratch);

    // Keep the sun's shadow camera centred on the scene so the sun's arc
    // motion doesn't drag the shadow frustum off the world.
    const sun = this.skySystem.sun;
    if (sun.castShadow) {
      sun.target.position.set(WORLD_WIDTH / 2, 0, WORLD_HEIGHT / 2);
    }

    this.camera3d.update();
    this.entityRenderer3d.update(this.registry, this.tileRenderer3d, this.civ);
    this.entityRenderer3d.setHighlighted(this.highlighted, this.tileRenderer3d);
    this.waterPlane.update();
    this.particles.update(this.registry, this.tileRenderer3d);
    this.fireflies.update(this.skySystem.getPhase());
    this.statusBubbles.update(this.registry, this.tileRenderer3d);
    this.effects.update();
    this.thrGlyphs.update();
    this.composer.render();
  }

  resize(w, h) {
    this.webglRenderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
    this.camera3d.resize(w, h);
  }

  rebuildTerrain() {
    this.tileRenderer3d.rebuild(this.world);
    this.decorations.rebuild();
    this.waterPlane.setShoreFromWorld(this.world);
    this.fireflies.scatter(this.world, this.tileRenderer3d);
    this.thrGlyphs.refreshElevations();
  }

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

  resetCamera() {
    this.camera3d.resetToDefault();
  }

  panTo(worldX, worldZ) {
    this.camera3d.panTo(worldX, worldZ);
  }
}
