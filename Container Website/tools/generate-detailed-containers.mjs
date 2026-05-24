import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const modelsDir = join(projectRoot, "models");
const downloadsDir = "C:\\Users\\ilian\\Downloads";

const container = {
    length: 6.058,
    width: 2.438,
    height: 2.591,
};

class NodeFileReader {
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then((buffer) => {
            this.result = buffer;
            this.onloadend?.();
        }).catch((error) => {
            this.error = error;
            this.onerror?.(error);
        });
    }

    readAsDataURL(blob) {
        blob.arrayBuffer().then((buffer) => {
            const base64 = Buffer.from(buffer).toString("base64");
            this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
            this.onloadend?.();
        }).catch((error) => {
            this.error = error;
            this.onerror?.(error);
        });
    }
}

globalThis.FileReader = globalThis.FileReader ?? NodeFileReader;

const materials = {
    storageBlue: new THREE.MeshStandardMaterial({ color: 0x1f5f86, roughness: 0.78, metalness: 0.34 }),
    storageDarkBlue: new THREE.MeshStandardMaterial({ color: 0x174b6c, roughness: 0.84, metalness: 0.36 }),
    storageEdge: new THREE.MeshStandardMaterial({ color: 0x12364d, roughness: 0.7, metalness: 0.42 }),
    officeWall: new THREE.MeshStandardMaterial({ color: 0xdfe4e2, roughness: 0.62, metalness: 0.18 }),
    officePanel: new THREE.MeshStandardMaterial({ color: 0xf1f2ee, roughness: 0.58, metalness: 0.12 }),
    officeTrim: new THREE.MeshStandardMaterial({ color: 0xf7f8f5, roughness: 0.48, metalness: 0.14 }),
    glass: new THREE.MeshPhysicalMaterial({
        color: 0xa8d8f0,
        roughness: 0.08,
        metalness: 0,
        transmission: 0.18,
        transparent: true,
        opacity: 0.48,
    }),
    darkGlass: new THREE.MeshStandardMaterial({ color: 0x23313a, roughness: 0.24, metalness: 0.06 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x171b1a, roughness: 0.84, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8c0be, roughness: 0.34, metalness: 0.82 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf7f7f4, roughness: 0.52, metalness: 0.12 }),
    shadow: new THREE.MeshStandardMaterial({ color: 0x1a1d1c, roughness: 0.9, metalness: 0.05 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x5a4936, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.34 }),
    scratchLight: new THREE.MeshStandardMaterial({ color: 0xc8d0cc, roughness: 0.72, metalness: 0.38 }),
    scratchDark: new THREE.MeshStandardMaterial({ color: 0x27312e, roughness: 0.92, metalness: 0.12 }),
    warning: new THREE.MeshStandardMaterial({ color: 0xffb433, roughness: 0.5, metalness: 0.12 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x4c5451, roughness: 0.92, metalness: 0.04 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc8a37f, roughness: 0.72, metalness: 0 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0x415365, roughness: 0.72, metalness: 0.04 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x242a2f, roughness: 0.74, metalness: 0.05 }),
};

const makeSeeded = (seed) => {
    let value = seed;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 0x100000000;
    };
};

const box = (name, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.name = name;
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

const cylinder = (name, radius, height, position, material, axis = "y", segments = 24) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
    mesh.name = name;
    mesh.position.copy(position);

    if (axis === "x") {
        mesh.rotation.z = Math.PI / 2;
    }

    if (axis === "z") {
        mesh.rotation.x = Math.PI / 2;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

const addLights = (scene) => {
    const sun = new THREE.PointLight(0xffffff, 2.8, 24, 2);
    sun.name = "soft-daylight-key-point";
    sun.position.set(6, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const fill = new THREE.PointLight(0x9ed9ff, 0.85, 18, 2);
    fill.name = "soft-blue-fill-point";
    fill.position.set(-5, 4, -6);
    scene.add(fill);

    const lowFill = new THREE.PointLight(0xfff2d8, 0.45, 12, 2);
    lowFill.name = "warm-low-industrial-fill-point";
    lowFill.position.set(0, 2.2, -4);
    scene.add(lowFill);
};

const addCornerCasting = (group, x, y, z, material) => {
    const casting = box("corner-casting-steel-block", new THREE.Vector3(0.27, 0.2, 0.27), new THREE.Vector3(x, y, z), material);
    group.add(casting);

    const insetPositions = [
        new THREE.Vector3(x + Math.sign(x) * 0.136, y, z),
        new THREE.Vector3(x, y, z + Math.sign(z) * 0.136),
    ];

    insetPositions.forEach((position, index) => {
        const inset = cylinder(`corner-casting-dark-oval-${index + 1}`, 0.055, 0.012, position, materials.shadow, index === 0 ? "x" : "z", 18);
        inset.scale.set(index === 0 ? 1 : 1.7, 1, index === 0 ? 1.7 : 1);
        group.add(inset);
    });
};

const addFrameRails = (group, material) => {
    const { length, width, height } = container;
    const x = length / 2;
    const z = width / 2;

    group.add(box("top-left-side-rail", new THREE.Vector3(length, 0.16, 0.13), new THREE.Vector3(0, height - 0.08, -z), material));
    group.add(box("top-right-side-rail", new THREE.Vector3(length, 0.16, 0.13), new THREE.Vector3(0, height - 0.08, z), material));
    group.add(box("bottom-left-side-rail", new THREE.Vector3(length, 0.17, 0.15), new THREE.Vector3(0, 0.085, -z), material));
    group.add(box("bottom-right-side-rail", new THREE.Vector3(length, 0.17, 0.15), new THREE.Vector3(0, 0.085, z), material));
    group.add(box("top-front-rail", new THREE.Vector3(0.16, 0.16, width), new THREE.Vector3(x, height - 0.08, 0), material));
    group.add(box("top-back-rail", new THREE.Vector3(0.16, 0.16, width), new THREE.Vector3(-x, height - 0.08, 0), material));
    group.add(box("bottom-front-rail", new THREE.Vector3(0.17, 0.17, width), new THREE.Vector3(x, 0.085, 0), material));
    group.add(box("bottom-back-rail", new THREE.Vector3(0.17, 0.17, width), new THREE.Vector3(-x, 0.085, 0), material));

    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            group.add(box("vertical-corner-post", new THREE.Vector3(0.18, height, 0.18), new THREE.Vector3(sx * x, height / 2, sz * z), material));
            addCornerCasting(group, sx * x, height - 0.07, sz * z, material);
            addCornerCasting(group, sx * x, 0.08, sz * z, material);
        }
    }
};

const addCorrugation = (group, side, material, options = {}) => {
    const { length, width, height } = container;
    const spacing = options.spacing ?? 0.28;
    const ribWidth = options.ribWidth ?? 0.055;
    const ribDepth = options.ribDepth ?? 0.055;
    const panelHeight = height - 0.42;
    const y = height / 2;

    if (side === "long-negative-z" || side === "long-positive-z") {
        const z = (side === "long-negative-z" ? -1 : 1) * (width / 2 + ribDepth / 2 + 0.012);
        const start = -length / 2 + 0.36;
        const end = length / 2 - 0.36;

        for (let x = start; x <= end; x += spacing) {
            group.add(box("vertical-corrugated-rib-long-wall", new THREE.Vector3(ribWidth, panelHeight, ribDepth), new THREE.Vector3(x, y, z), material));
            group.add(box("recess-shadow-between-corrugations", new THREE.Vector3(ribWidth * 0.42, panelHeight * 0.96, 0.012), new THREE.Vector3(x + spacing * 0.42, y, z - Math.sign(z) * 0.034), materials.scratchDark));
        }
    }

    if (side === "front-positive-x" || side === "back-negative-x") {
        const x = (side === "front-positive-x" ? 1 : -1) * (length / 2 + ribDepth / 2 + 0.012);
        const start = -width / 2 + 0.24;
        const end = width / 2 - 0.24;

        for (let z = start; z <= end; z += spacing * 0.7) {
            group.add(box("vertical-corrugated-rib-end-wall", new THREE.Vector3(ribDepth, panelHeight, ribWidth), new THREE.Vector3(x, y, z), material));
        }
    }
};

const addRoofCorrugation = (group, material) => {
    const { length, width, height } = container;
    const y = height + 0.035;

    for (let x = -length / 2 + 0.38; x <= length / 2 - 0.38; x += 0.34) {
        group.add(box("roof-cross-corrugation", new THREE.Vector3(0.055, 0.05, width - 0.36), new THREE.Vector3(x, y, 0), material));
    }
};

const addStorageDoors = (group) => {
    const { length, width, height } = container;
    const x = length / 2 + 0.035;
    const doorWidth = width / 2 - 0.08;
    const doorHeight = height - 0.44;
    const y = height / 2;

    group.add(box("left-steel-door-panel", new THREE.Vector3(0.06, doorHeight, doorWidth), new THREE.Vector3(x, y, -doorWidth / 2), materials.storageBlue));
    group.add(box("right-steel-door-panel", new THREE.Vector3(0.06, doorHeight, doorWidth), new THREE.Vector3(x, y, doorWidth / 2), materials.storageBlue));
    group.add(box("center-door-seal", new THREE.Vector3(0.08, doorHeight + 0.08, 0.045), new THREE.Vector3(x + 0.035, y, 0), materials.rubber));

    for (let z of [-0.72, -0.42, 0.42, 0.72]) {
        group.add(cylinder("vertical-locking-bar", 0.025, doorHeight - 0.18, new THREE.Vector3(x + 0.08, y, z), materials.steel, "y", 20));
        group.add(box("locking-bar-bracket-top", new THREE.Vector3(0.08, 0.07, 0.16), new THREE.Vector3(x + 0.09, height - 0.42, z), materials.steel));
        group.add(box("locking-bar-bracket-bottom", new THREE.Vector3(0.08, 0.07, 0.16), new THREE.Vector3(x + 0.09, 0.42, z), materials.steel));
        group.add(cylinder("door-lock-handle", 0.018, 0.32, new THREE.Vector3(x + 0.13, 1.18, z + 0.08), materials.steel, "z", 18));
        group.add(box("lock-handle-catch", new THREE.Vector3(0.055, 0.09, 0.12), new THREE.Vector3(x + 0.14, 1.05, z + 0.24), materials.steel));
    }

    for (let z of [-width / 2 + 0.1, width / 2 - 0.1]) {
        for (let yHinge of [0.6, 1.25, 1.9]) {
            group.add(cylinder("large-visible-door-hinge", 0.055, 0.22, new THREE.Vector3(x + 0.09, yHinge, z), materials.steel, "z", 24));
            group.add(box("door-hinge-leaf", new THREE.Vector3(0.035, 0.18, 0.28), new THREE.Vector3(x + 0.07, yHinge, z - Math.sign(z) * 0.12), materials.steel));
        }
    }
};

const addForkliftPockets = (group) => {
    const { length, width } = container;

    for (let x of [-1.25, 1.25]) {
        for (let z of [-width / 2 - 0.018, width / 2 + 0.018]) {
            group.add(box("forklift-pocket-dark-opening", new THREE.Vector3(0.62, 0.22, 0.028), new THREE.Vector3(x, 0.35, z), materials.shadow));
            group.add(box("forklift-pocket-top-lip", new THREE.Vector3(0.7, 0.045, 0.04), new THREE.Vector3(x, 0.485, z), materials.steel));
            group.add(box("forklift-pocket-bottom-lip", new THREE.Vector3(0.7, 0.045, 0.04), new THREE.Vector3(x, 0.215, z), materials.steel));
        }
    }
};

const addWear = (group, target = "storage") => {
    const rand = makeSeeded(target === "storage" ? 1309 : 2207);
    const { length, width } = container;
    const baseMaterial = target === "storage" ? materials.scratchLight : materials.scratchDark;

    for (let i = 0; i < 56; i += 1) {
        const onSide = rand() > 0.42;
        const sx = 0.04 + rand() * 0.24;
        const sy = 0.012 + rand() * 0.022;
        const y = 0.65 + rand() * 1.65;

        if (onSide) {
            const zSign = rand() > 0.5 ? 1 : -1;
            const x = -length / 2 + 0.42 + rand() * (length - 0.84);
            const z = zSign * (width / 2 + 0.082);
            const mark = box("random-thin-paint-scratch-on-side", new THREE.Vector3(sx, sy, 0.01), new THREE.Vector3(x, y, z), baseMaterial);
            mark.rotation.z = (rand() - 0.5) * 0.3;
            group.add(mark);
        } else {
            const xSign = rand() > 0.5 ? 1 : -1;
            const x = xSign * (length / 2 + 0.085);
            const z = -width / 2 + 0.32 + rand() * (width - 0.64);
            const mark = box("random-thin-paint-scratch-on-end", new THREE.Vector3(0.01, sy, sx), new THREE.Vector3(x, y, z), baseMaterial);
            mark.rotation.y = (rand() - 0.5) * 0.2;
            group.add(mark);
        }
    }

    for (let i = 0; i < 18; i += 1) {
        const zSign = rand() > 0.5 ? 1 : -1;
        const dirt = box("lower-edge-dirt-and-road-grime", new THREE.Vector3(0.36 + rand() * 0.8, 0.09 + rand() * 0.16, 0.012), new THREE.Vector3(-length / 2 + 0.4 + rand() * (length - 0.8), 0.28 + rand() * 0.38, zSign * (width / 2 + 0.092)), materials.dirt);
        group.add(dirt);
    }
};

const createStorageContainer = () => {
    const group = new THREE.Group();
    group.name = "20ft-detailed-storage-container";
    const { length, width, height } = container;

    group.add(box("main-steel-container-shell", new THREE.Vector3(length, height - 0.28, width), new THREE.Vector3(0, height / 2, 0), materials.storageBlue));
    group.add(box("left-long-wall-base-panel", new THREE.Vector3(length - 0.28, height - 0.42, 0.055), new THREE.Vector3(0, height / 2, -width / 2 - 0.004), materials.storageBlue));
    group.add(box("right-long-wall-base-panel", new THREE.Vector3(length - 0.28, height - 0.42, 0.055), new THREE.Vector3(0, height / 2, width / 2 + 0.004), materials.storageBlue));
    group.add(box("rear-wall-corrugated-base", new THREE.Vector3(0.055, height - 0.42, width - 0.18), new THREE.Vector3(-length / 2 - 0.004, height / 2, 0), materials.storageDarkBlue));

    addFrameRails(group, materials.storageEdge);
    addCorrugation(group, "long-negative-z", materials.storageDarkBlue);
    addCorrugation(group, "long-positive-z", materials.storageDarkBlue);
    addCorrugation(group, "back-negative-x", materials.storageDarkBlue, { spacing: 0.32 });
    addStorageDoors(group);
    addRoofCorrugation(group, materials.storageDarkBlue);
    addForkliftPockets(group);
    addWear(group, "storage");

    group.position.y = -height / 2;
    return group;
};

const addOfficeWindow = (group, x, y, z, width, height, name) => {
    group.add(box(`${name}-white-window-frame-outer`, new THREE.Vector3(width + 0.12, height + 0.12, 0.065), new THREE.Vector3(x, y, z - 0.018), materials.officeTrim));
    group.add(box(`${name}-dark-window-reveal`, new THREE.Vector3(width + 0.03, height + 0.03, 0.078), new THREE.Vector3(x, y, z - 0.035), materials.darkGlass));
    group.add(box(`${name}-blue-glass-pane`, new THREE.Vector3(width - 0.04, height - 0.04, 0.035), new THREE.Vector3(x, y, z - 0.07), materials.glass));
    group.add(box(`${name}-center-mullion`, new THREE.Vector3(0.045, height + 0.06, 0.09), new THREE.Vector3(x, y, z - 0.095), materials.officeTrim));
    group.add(box(`${name}-lower-sill`, new THREE.Vector3(width + 0.2, 0.065, 0.14), new THREE.Vector3(x, y - height / 2 - 0.085, z - 0.05), materials.officeTrim));

    for (let i = 0; i < 6; i += 1) {
        const slatY = y + height / 2 - 0.12 - i * 0.12;
        group.add(box(`${name}-interior-horizontal-blind-slat`, new THREE.Vector3(width - 0.14, 0.018, 0.045), new THREE.Vector3(x, slatY, z - 0.12), materials.white));
    }
};

const addOfficeDoor = (group, x, y, z) => {
    group.add(box("full-height-office-entry-door", new THREE.Vector3(0.86, 1.98, 0.075), new THREE.Vector3(x, y, z), materials.white));
    group.add(box("door-grey-inner-panel", new THREE.Vector3(0.68, 1.45, 0.085), new THREE.Vector3(x, y - 0.12, z - 0.02), materials.officePanel));
    group.add(box("door-small-upper-glass-panel", new THREE.Vector3(0.42, 0.42, 0.094), new THREE.Vector3(x, y + 0.57, z - 0.045), materials.glass));
    group.add(cylinder("brushed-metal-door-handle", 0.022, 0.22, new THREE.Vector3(x + 0.28, y + 0.02, z - 0.095), materials.steel, "x", 20));
    group.add(box("door-lock-cylinder", new THREE.Vector3(0.055, 0.055, 0.035), new THREE.Vector3(x + 0.28, y - 0.1, z - 0.105), materials.steel));

    for (let hingeY of [y - 0.62, y, y + 0.62]) {
        group.add(cylinder("white-door-hinge", 0.035, 0.14, new THREE.Vector3(x - 0.48, hingeY, z - 0.045), materials.steel, "y", 18));
    }

    group.add(box("metal-door-threshold-step", new THREE.Vector3(1.02, 0.08, 0.26), new THREE.Vector3(x, 0.09, z - 0.12), materials.steel));
};

const addOfficeUtilityDetails = (group) => {
    const { length, width, height } = container;
    const z = -width / 2 - 0.09;

    group.add(box("small-exterior-air-conditioner-body", new THREE.Vector3(0.62, 0.38, 0.18), new THREE.Vector3(2.36, 1.95, z), materials.officeTrim));
    group.add(cylinder("air-conditioner-fan-ring", 0.13, 0.025, new THREE.Vector3(2.36, 1.95, z - 0.1), materials.steel, "z", 32));

    for (let x of [2.18, 2.28, 2.44, 2.54]) {
        group.add(box("air-conditioner-front-grille-line", new THREE.Vector3(0.018, 0.29, 0.018), new THREE.Vector3(x, 1.95, z - 0.12), materials.shadow));
    }

    group.add(box("exterior-electrical-junction-box", new THREE.Vector3(0.28, 0.42, 0.1), new THREE.Vector3(2.9, 1.23, z), materials.officeTrim));
    group.add(box("electrical-box-dark-latch", new THREE.Vector3(0.045, 0.12, 0.025), new THREE.Vector3(3.045, 1.23, z - 0.065), materials.shadow));
    group.add(cylinder("vertical-electrical-conduit", 0.022, 0.86, new THREE.Vector3(2.9, 1.72, z - 0.055), materials.steel, "y", 16));
    group.add(box("small-vent-grille", new THREE.Vector3(0.42, 0.22, 0.055), new THREE.Vector3(-2.65, 1.98, z), materials.officeTrim));

    for (let i = 0; i < 5; i += 1) {
        group.add(box("vent-horizontal-slat", new THREE.Vector3(0.36, 0.014, 0.022), new THREE.Vector3(-2.65, 2.05 - i * 0.045, z - 0.04), materials.shadow));
    }

    group.add(box("front-gutter-channel", new THREE.Vector3(length - 0.28, 0.08, 0.08), new THREE.Vector3(0, height - 0.12, z), materials.officeTrim));
};

const createOfficeContainer = () => {
    const group = new THREE.Group();
    group.name = "20ft-detailed-office-container";
    const { length, width, height } = container;

    group.add(box("insulated-office-container-shell", new THREE.Vector3(length, height - 0.24, width), new THREE.Vector3(0, height / 2, 0), materials.officeWall));
    group.add(box("front-smooth-office-wall", new THREE.Vector3(length - 0.28, height - 0.42, 0.07), new THREE.Vector3(0, height / 2, -width / 2 - 0.014), materials.officePanel));
    group.add(box("back-smooth-office-wall", new THREE.Vector3(length - 0.28, height - 0.42, 0.07), new THREE.Vector3(0, height / 2, width / 2 + 0.014), materials.officeWall));

    addFrameRails(group, materials.officeTrim);
    addRoofCorrugation(group, materials.officeTrim);

    for (let x = -2.72; x <= 2.72; x += 0.68) {
        group.add(box("subtle-vertical-office-panel-joint", new THREE.Vector3(0.025, height - 0.5, 0.025), new THREE.Vector3(x, height / 2, -width / 2 - 0.07), materials.steel));
    }

    addOfficeDoor(group, -2.1, 1.11, -width / 2 - 0.075);
    addOfficeWindow(group, -0.62, 1.45, -width / 2 - 0.082, 1.0, 0.76, "left-office-window");
    addOfficeWindow(group, 0.94, 1.45, -width / 2 - 0.082, 1.0, 0.76, "right-office-window");
    addOfficeUtilityDetails(group);
    addForkliftPockets(group);
    addWear(group, "office");

    group.add(box("black-underfloor-skid-shadow", new THREE.Vector3(length - 0.7, 0.09, width - 0.36), new THREE.Vector3(0, 0.12, 0), materials.shadow));

    group.position.y = -height / 2;
    return group;
};

const createHumanFigure = () => {
    const group = new THREE.Group();
    group.name = "simple-1-75m-human-scale-reference";

    group.add(cylinder("left-leg", 0.075, 0.82, new THREE.Vector3(-0.09, 0.41, 0), materials.pants, "y", 18));
    group.add(cylinder("right-leg", 0.075, 0.82, new THREE.Vector3(0.09, 0.41, 0), materials.pants, "y", 18));
    group.add(box("neutral-shoes", new THREE.Vector3(0.42, 0.08, 0.16), new THREE.Vector3(0, 0.04, -0.02), materials.shadow));
    group.add(cylinder("torso-neutral-shirt", 0.18, 0.58, new THREE.Vector3(0, 1.09, 0), materials.shirt, "y", 24));
    group.add(cylinder("neck", 0.055, 0.1, new THREE.Vector3(0, 1.43, 0), materials.skin, "y", 16));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), materials.skin));
    group.children.at(-1).name = "plain-head-no-face";
    group.children.at(-1).position.set(0, 1.62, 0);

    const leftArm = cylinder("left-arm", 0.055, 0.62, new THREE.Vector3(-0.25, 1.08, 0), materials.skin, "y", 16);
    leftArm.rotation.z = 0.18;
    group.add(leftArm);

    const rightArm = cylinder("right-arm", 0.055, 0.62, new THREE.Vector3(0.25, 1.08, 0), materials.skin, "y", 16);
    rightArm.rotation.z = -0.18;
    group.add(rightArm);

    group.scale.setScalar(1.08);
    return group;
};

const centerForExport = (object) => {
    const bounds = new THREE.Box3().setFromObject(object);
    const center = bounds.getCenter(new THREE.Vector3());
    object.position.sub(center);
    const after = new THREE.Box3().setFromObject(object);
    object.position.y -= after.min.y;
};

const createExportScene = (object) => {
    const scene = new THREE.Scene();
    scene.name = `${object.name}-export-scene`;
    scene.background = new THREE.Color(0xdce7eb);
    addLights(scene);
    scene.add(object);
    return scene;
};

const createComparisonScene = () => {
    const scene = new THREE.Scene();
    scene.name = "container-comparison-scene-two-20ft-containers-with-human";
    scene.background = new THREE.Color(0xbfd1dc);
    addLights(scene);

    const ground = box("large-industrial-concrete-asphalt-pad", new THREE.Vector3(14, 0.08, 8), new THREE.Vector3(0, -0.04, 0), materials.ground);
    scene.add(ground);

    const storage = createStorageContainer();
    storage.position.set(-3.22, 0, 0);
    storage.rotation.y = 0.02;
    scene.add(storage);

    const office = createOfficeContainer();
    office.position.set(3.22, 0, 0);
    office.rotation.y = -0.02;
    scene.add(office);

    const person = createHumanFigure();
    person.position.set(0.08, 0, -2.45);
    scene.add(person);

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 60);
    camera.name = "three-quarter-realistic-preview-camera";
    camera.position.set(6.8, 3.5, 6.2);
    camera.lookAt(0, 1.2, 0);
    scene.add(camera);

    return scene;
};

const exportGlb = async (scene, filePath) => {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(scene, {
        binary: true,
        trs: false,
        onlyVisible: true,
        maxTextureSize: 2048,
        includeCustomExtensions: false,
    });

    const data = Buffer.from(result);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return data.length;
};

const main = async () => {
    await mkdir(modelsDir, { recursive: true });

    const storage = createStorageContainer();
    centerForExport(storage);

    const office = createOfficeContainer();
    centerForExport(office);

    const storageDownloads = join(downloadsDir, "lager-container-detailliert.glb");
    const officeDownloads = join(downloadsDir, "büro-container-detailliert.glb");
    const comparisonDownloads = join(downloadsDir, "container-vergleich-szene.glb");

    const storageSize = await exportGlb(createExportScene(storage), storageDownloads);
    const officeSize = await exportGlb(createExportScene(office), officeDownloads);
    const comparisonSize = await exportGlb(createComparisonScene(), comparisonDownloads);

    await copyFile(storageDownloads, join(modelsDir, "lager-container.glb"));
    await copyFile(officeDownloads, join(modelsDir, "büro-container.glb"));

    console.log(JSON.stringify({
        storageDownloads,
        officeDownloads,
        comparisonDownloads,
        websiteStorage: join(modelsDir, "lager-container.glb"),
        websiteOffice: join(modelsDir, "büro-container.glb"),
        sizes: {
            storageSize,
            officeSize,
            comparisonSize,
        },
    }, null, 2));
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
