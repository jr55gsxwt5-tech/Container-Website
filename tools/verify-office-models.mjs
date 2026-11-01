import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { officeModels } from "./generate-office-models.mjs";

// Check the exported files, not just the generator's in-memory objects.
for (const spec of officeModels) {
    const path = new URL(`../models/buero-${spec.length}m.glb`, import.meta.url);
    const bytes = await readFile(path);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, "GLB header");
    assert.equal(bytes.readUInt32LE(4), 2, "glTF version 2");
    assert.equal(bytes.readUInt32LE(8), bytes.length, "complete GLB");
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const { scene } = await new GLTFLoader().parseAsync(data, "");
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x - spec.length) < 1e-5, "correct overall length");
    assert.ok(Math.abs(size.y - spec.height) < 1e-5, "consistent provisional height");
    // Handles and window sills project beyond the nominal 2.4 m steel frame.
    assert.ok(Math.abs(bounds.min.z + spec.width / 2) < 1e-5, "rear frame footprint");
    assert.ok(bounds.max.z < spec.width / 2 + 0.07, "no stray geometry beyond fittings");
    let triangles = 0, meshes = 0;
    scene.traverse(object => {
        if (!object.isMesh) return;
        meshes++;
        const geometry = object.geometry;
        for (const attribute of Object.values(geometry.attributes)) {
            assert.ok([...attribute.array].every(Number.isFinite), "finite vertex data");
        }
        assert.ok(geometry.index, "indexed, merged geometry");
        assert.ok([...geometry.index.array].every(i => i < geometry.attributes.position.count), "valid triangle indices");
        triangles += geometry.index.count / 3;
    });
    assert.ok(meshes <= 25, "batched for interactive viewing");
    assert.ok(triangles < 50000, "suitable browser triangle budget");

    for (const window of spec.windows) {
        const clear = window.width - 0.10;
        const paneWidth = (clear - (window.panes - 1) * 0.024) / window.panes;
        for (let i = 0; i < window.panes; i++) {
            const x = window.x - clear / 2 + paneWidth / 2 + i * (paneWidth + 0.024);
            const y = window.bottom + window.height / 2;
            const ray = new THREE.Raycaster(new THREE.Vector3(x, y, spec.width / 2 + 0.5), new THREE.Vector3(0, 0, -1));
            const hits = ray.intersectObject(scene, true);
            assert.ok(hits.some(h => h.object.material.transparent), "glazing in each pane");
            const firstSolid = hits.find(h => !h.object.material.transparent);
            assert.ok(firstSolid && firstSolid.distance > 2.3, "true wall opening behind each pane");
        }
    }
    const doorRay = new THREE.Raycaster(
        new THREE.Vector3(spec.door.x, 1.2, spec.width / 2 + 0.5), new THREE.Vector3(0, 0, -1),
    );
    const doorHit = doorRay.intersectObject(scene, true).find(h => !h.object.material.transparent);
    assert.ok(doorHit && doorHit.distance < 0.6, "solid door in its correct position");
    console.log(`${fileURLToPath(path)}: OK; ${meshes} meshes, ${triangles} triangles; footprint and all openings checked`);
}
