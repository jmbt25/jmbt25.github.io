import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';

const DEFAULT_DIST = 70;

export class Camera3D {
  constructor(canvas, canvasW, canvasH) {
    this.camera = new THREE.PerspectiveCamera(50, canvasW / canvasH, 0.1, 800);

    const cx = WORLD_WIDTH / 2;
    const cz = WORLD_HEIGHT / 2;
    this._defaultPos    = new THREE.Vector3(cx, DEFAULT_DIST, cz + WORLD_HEIGHT * 0.85);
    this._defaultTarget = new THREE.Vector3(cx, 0, cz);

    this.camera.position.copy(this._defaultPos);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(this._defaultTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = Math.PI * 0.48;

    // Reserve left-click for ToolManager. Right-drag pans (most users
    // expect a "drag the world" gesture, especially on a top-down sim);
    // middle-drag orbits for the rare case the user wants a different angle.
    this.controls.mouseButtons = {
      LEFT:   null,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT:  THREE.MOUSE.PAN,
    };

    // Reserve single-finger touch for ToolManager. Two-finger = OrbitControls.
    this.controls.touches = {
      ONE: null,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.controls.update();

    this._panTarget = null;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update() {
    if (this._panTarget) {
      // Smoothly tween the controls target toward the requested point.
      const t = this.controls.target;
      t.x += (this._panTarget.x - t.x) * 0.12;
      t.z += (this._panTarget.z - t.z) * 0.12;
      const dx = this._panTarget.x - t.x;
      const dz = this._panTarget.z - t.z;
      if (dx * dx + dz * dz < 0.01) this._panTarget = null;
    }
    this.controls.update();
  }

  resetToDefault() {
    // Animate back to the default pose by setting up a pan + lerp position.
    this._tweenStart = {
      pos: this.camera.position.clone(),
      tgt: this.controls.target.clone(),
      t:   0,
    };
    this._tweenEnd = {
      pos: this._defaultPos.clone(),
      tgt: this._defaultTarget.clone(),
    };
    const start = this._tweenStart;
    const end   = this._tweenEnd;
    const startTime = performance.now();
    const dur = 700;
    const step = () => {
      const now = performance.now();
      const k = Math.min(1, (now - startTime) / dur);
      const e = k * k * (3 - 2 * k);
      this.camera.position.lerpVectors(start.pos, end.pos, e);
      this.controls.target.lerpVectors(start.tgt, end.tgt, e);
      this.controls.update();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  panTo(worldX, worldZ) {
    this._panTarget = new THREE.Vector3(worldX, 0, worldZ);
  }
}
