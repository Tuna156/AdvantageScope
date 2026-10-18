// Copyright (c) 2021-2025 Littleton Robotics
// http://github.com/Mechanical-Advantage
//
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file
// at the root directory of this project.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Config3dRobot } from "../../../AdvantageScopeAssets";
import { getQuaternionFromRotSeq } from "../../Field3dRendererImpl";
import optimizeGeometries from "../OptimizeGeometries";
import { prepareTransfer } from "./prepareTransfer";

self.onmessage = (event) => {
  // WORKER SETUP
  self.onmessage = null;
  let { id, payload } = event.data;
  function resolve(result: any, transfer: Transferable[]) {
    // @ts-expect-error
    self.postMessage({ id: id, payload: result }, transfer);
  }

  // MAIN LOGIC

  const robotConfig: Config3dRobot = payload.robotConfig;
  const isFTC: boolean = payload.isFTC;
  const mode: "cinematic" | "standard" | "low-power" = payload.mode;
  const materialSpecular = new THREE.Color().fromArray(payload.materialSpecular);
  const materialShininess: number = payload.materialShininess;

  const gltfLoader = new GLTFLoader();
  Promise.all([
    loadRobotComponent(robotConfig.path, true), // Load the base of the robot model.
    ...robotConfig.components.map((_, index) => {
      // Load all of the robot component models.
      return loadRobotComponent(robotConfig.path.slice(0, -4) + "_" + index.toString() + ".glb");
    })
  ]).then((meshes) => {
    resolve(meshes, prepareTransfer(meshes));
  });

  async function loadRobotComponent(path: string, applyTransformations?: boolean): Promise<THREE.MeshJSON[]> {
    const model = await gltfLoader.loadAsync(path);
    const scene = model.scene;

    if (applyTransformations) {
      scene.rotation.setFromQuaternion(getQuaternionFromRotSeq(robotConfig!.rotations));
      scene.position.set(...robotConfig!.position);
    }

    let optimized = await optimizeGeometries(
      scene,
      mode,
      materialSpecular,
      materialShininess,
      !robotConfig.disableSimplification,
      isFTC
    );
    let sceneMeshes: THREE.Mesh[] = [];
    if (optimized.normal.length > 0) sceneMeshes.push(optimized.normal[0]);
    if (optimized.transparent.length > 0) sceneMeshes.push(optimized.transparent[0]);
    return sceneMeshes.map((mesh) => mesh.toJSON());
  }
};
