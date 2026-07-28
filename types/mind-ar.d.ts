declare module "mind-ar/dist/mindar-image-three.prod.js" {
  import * as THREE from "three";

  export interface MindARAnchor {
    group: THREE.Group;
    targetIndex: number;
    onTargetFound?: () => void;
    onTargetLost?: () => void;
  }

  export interface MindARThreeOptions {
    container: HTMLElement;
    imageTargetSrc: string;
    maxTrack?: number;
    uiLoading?: string | boolean;
    uiScanning?: string | boolean;
    uiError?: string | boolean;
    filterMinCF?: number;
    filterBeta?: number;
    warmupTolerance?: number;
    missTolerance?: number;
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions);
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    addAnchor(targetIndex: number): MindARAnchor;
    start(): Promise<void>;
    stop(): void;
  }
}
