import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';

export class Camera3D {
  constructor(canvas, canvasW, canvasH) {
    this.camera = new THREE.PerspectiveCamera(50, canvasW / canvasH, 0.1, 500);

    const cx = WORLD_WIDTH / 2;
    const cz = WORLD_HEIGHT / 2;
    this.camera.position.set(cx, 70, cz + WORLD_HEIGHT * 0.85);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(cx, 0, cz);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = Math.PI * 0.48;

    // Reserve left-click for ToolManager. Right = rotate, Middle = pan.
    this.controls.mouseButtons = {
      LEFT:   null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT:  THREE.MOUSE.ROTATE,
    };

    // Reserve single-finger touch for ToolManager. Two-finger = OrbitControls.
    this.controls.touches = {
      ONE: null,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.controls.update();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update() {
    this.controls.update();
  }
}
