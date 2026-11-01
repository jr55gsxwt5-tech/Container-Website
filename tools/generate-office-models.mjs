import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

// Metres; front is +Z. Length and width are supplied by the owner. Height,
// joinery and unseen faces are reconstructed from the offer illustrations.
export const officeModels = [
    {
        length: 3, width: 2.4, height: 2.6,
        reference: "bilder/buero/buero-3m.png",
        door: { x: 0.66, width: 0.92, height: 2.13, bottom: 0.15, hinge: "right" },
        windows: [{ x: -0.64, width: 0.94, height: 1.14, bottom: 1.01, panes: 1 }],
    },
    {
        length: 4, width: 2.4, height: 2.6,
        reference: "bilder/buero/buero-4m.png",
        door: { x: -1.25, width: 0.86, height: 2.13, bottom: 0.15, hinge: "left" },
        windows: [{ x: 0.55, width: 1.62, height: 1.06, bottom: 1.06, panes: 2 }],
    },
    {
        length: 6, width: 2.4, height: 2.6,
        reference: "bilder/buero/buero-6m.png",
        door: { x: -0.48, width: 0.91, height: 2.13, bottom: 0.15, hinge: "right" },
        windows: [
            { x: -1.94, width: 1.02, height: 1.05, bottom: 1.03, panes: 1 },
            { x: 1.36, width: 1.30, height: 1.13, bottom: 0.99, panes: 1 },
        ],
    },
];

class NodeFileReader {
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(result => {
            this.result = result;
            this.onloadend?.();
        }).catch(error => this.onerror?.(error));
    }
}
globalThis.FileReader ??= NodeFileReader;

const material = (name, color, roughness, metalness = 0) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    result.name = name;
    return result;
};
const palette = {
    blue: material("Blue powder-coated steel", 0x175c9f, 0.35, 0.28),
    blueEdge: material("Recessed blue steel edges", 0x114b80, 0.44, 0.25),
    panel: material("Light grey insulated wall panels", 0xe7e9e8, 0.73, 0.06),
    seam: material("Fine panel joints", 0xbcc2c4, 0.80, 0.03),
    pvc: material("White bevelled PVC joinery", 0xf6f7f5, 0.39, 0.02),
    door: material("White steel door leaf", 0xeef0ef, 0.50, 0.13),
    interior: material("White interior and ceiling", 0xf1f1ed, 0.86),
    seal: material("Glazing and door gaskets", 0x303b42, 0.87),
    steel: material("Brushed stainless steel fittings", 0xb8c4ca, 0.27, 0.82),
    underside: material("Underfloor steel crossmembers", 0x283c4d, 0.80, 0.34),
    roof: material("Galvanised roof sheet", 0xc6d0d5, 0.58, 0.45),
    skirting: material("Oak coloured skirting", 0x8e6949, 0.88),
    led: new THREE.MeshStandardMaterial({ color: 0xfffbec, emissive: 0xfff4d6, emissiveIntensity: 0.20, roughness: 0.55 }),
    glass: new THREE.MeshPhysicalMaterial({
        name: "Blue-grey clear glazing", color: 0x536e80,
        roughness: 0.16, metalness: 0.08, transparent: true, opacity: 0.72,
        depthWrite: false, side: THREE.DoubleSide, clearcoat: 0.8, clearcoatRoughness: 0.12,
    }),
};
palette.led.name = "Ceiling light diffuser";
const woodColors = [0xaf8b65, 0xb59371, 0xa88561, 0xbb9a76, 0xa27f5c, 0xb08d6a, 0xb89774, 0xad8965];
const wood = woodColors.map((color, i) => material(`Oak flooring tone ${i + 1}`, color, 0.84));
const grain = material("Subtle oak grain", 0x977754, 0.91);

function rectangle(x0, y0, x1, y1) {
    const path = new THREE.Shape();
    path.moveTo(x0, y0);
    path.lineTo(x1, y0);
    path.lineTo(x1, y1);
    path.lineTo(x0, y1);
    path.closePath();
    return path;
}

function roundedRectangle(width, height, radius) {
    const p = new THREE.Shape();
    const x = -width / 2, y = -height / 2;
    const r = Math.min(radius, width / 2, height / 2);
    p.moveTo(x + r, y);
    p.lineTo(x + width - r, y);
    p.quadraticCurveTo(x + width, y, x + width, y + r);
    p.lineTo(x + width, y + height - r);
    p.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    p.lineTo(x + r, y + height);
    p.quadraticCurveTo(x, y + height, x, y + height - r);
    p.lineTo(x, y + r);
    p.quadraticCurveTo(x, y, x + r, y);
    p.closePath();
    return p;
}

function extrude(shape, depth, bevel = 0) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: depth - bevel * 2, steps: 1, curveSegments: 8,
        bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
    });
    geometry.translate(0, 0, -depth / 2 + bevel);
    return geometry;
}

export function createOfficeContainer(spec) {
    const { length: L, width: W, height: H } = spec;
    const group = new THREE.Group();
    group.name = `Office container ${L} x ${W} m`;
    group.userData = {
        dimensionsMetres: { length: L, width: W, height: H },
        confirmedDimensions: ["length", "width"],
        estimatedDimensions: ["height", "openings", "hardware"],
        reference: spec.reference,
        frontOpenings: { door: spec.door, windows: spec.windows },
        representation: "Illustration-based reconstruction, not a surveyed construction model",
    };
    const parts = [];
    function add(name, geometry, mat, x = 0, y = 0, z = 0, rotation = [0, 0, 0]) {
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.name = name;
        mesh.position.set(x, y, z);
        mesh.rotation.set(...rotation);
        group.add(mesh);
        parts.push(name);
        return mesh;
    }
    function box(name, w, h, d, x, y, z, mat, bevel = 0) {
        const geometry = bevel
            ? extrude(rectangle(-w / 2 + bevel, -h / 2 + bevel, w / 2 - bevel, h / 2 - bevel), d, bevel)
            : new THREE.BoxGeometry(w, h, d);
        return add(name, geometry, mat, x, y, z);
    }
    function cylinder(name, radius, height, x, y, z, mat, axis = "y") {
        const rotation = axis === "z" ? [Math.PI / 2, 0, 0] : axis === "x" ? [0, 0, Math.PI / 2] : [0, 0, 0];
        return add(name, new THREE.CylinderGeometry(radius, radius, height, 12), mat, x, y, z, rotation);
    }
    function ring(name, w, h, border, depth, x, y, z, mat, bevel = 0.003) {
        const shape = rectangle(-w / 2 + bevel, -h / 2 + bevel, w / 2 - bevel, h / 2 - bevel);
        shape.holes.push(rectangle(-w / 2 + border, -h / 2 + border, w / 2 - border, h / 2 - border));
        return add(name, extrude(shape, depth, bevel), mat, x, y, z);
    }

    // Structural frame stays within the advertised L x W footprint.
    for (const z of [-1, 1]) {
        for (const y of [0.075, H - 0.075]) {
            box("long blue frame rail", L - 0.30, 0.15, 0.15, 0, y, z * (W / 2 - 0.075), palette.blue, 0.004);
        }
    }
    for (const x of [-1, 1]) {
        for (const y of [0.075, H - 0.075]) {
            box("end blue frame rail", 0.15, 0.15, W - 0.30, x * (L / 2 - 0.075), y, 0, palette.blue, 0.004);
        }
        for (const z of [-1, 1]) {
            box("blue corner upright", 0.15, H - 0.30, 0.15, x * (L / 2 - 0.075), H / 2, z * (W / 2 - 0.075), palette.blue, 0.004);
        }
    }

    // Hollow lifting castings with actual rounded slots on all three exposed faces.
    const castingFace = () => {
        const shape = roundedRectangle(0.15, 0.15, 0.008);
        shape.holes.push(roundedRectangle(0.045, 0.084, 0.020));
        return extrude(shape, 0.018);
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const top of [false, true]) {
        const x = sx * (L / 2 - 0.075), z = sz * (W / 2 - 0.075), y = top ? H - 0.075 : 0.075;
        add("casting front slot", castingFace(), palette.blue, x, y, sz * (W / 2 - 0.009));
        add("casting side slot", castingFace(), palette.blue, sx * (L / 2 - 0.009), y, z, [0, Math.PI / 2, 0]);
        add("casting horizontal slot", castingFace(), palette.blue, x, top ? H - 0.009 : 0.009, z, [Math.PI / 2, 0, 0]);
        box("casting dark interior", 0.062, 0.10, 0.062, x, y, z, palette.blueEdge);
        // Internal cap: a dark recess remains visible through each lifting slot.
        box("casting internal web", 0.15, 0.015, 0.15, x, top ? H - 0.142 : 0.142, z, palette.blueEdge);
    }

    const openings = [spec.door, ...spec.windows].map(o => ({
        x0: o.x - o.width / 2 + 0.022, x1: o.x + o.width / 2 - 0.022,
        y0: o.bottom + 0.008, y1: o.bottom + o.height - 0.022,
    }));
    const frontShape = rectangle(-L / 2 + 0.15, 0.15, L / 2 - 0.15, H - 0.15);
    openings.forEach(o => frontShape.holes.push(rectangle(o.x0, o.y0, o.x1, o.y1)));
    add("front insulated wall with true door and window openings", extrude(frontShape, 0.09), palette.panel, 0, 0, W / 2 - 0.105);
    box("back insulated wall", L - 0.30, H - 0.30, 0.09, 0, H / 2, -W / 2 + 0.105, palette.panel);
    for (const sx of [-1, 1]) {
        box("end insulated wall", 0.09, H - 0.30, W - 0.30, sx * (L / 2 - 0.105), H / 2, 0, palette.panel);
    }

    function uninterruptedSegments(position, holes) {
        let segments = [[0.152, H - 0.152]];
        for (const hole of holes) {
            if (position < hole.x0 - 0.01 || position > hole.x1 + 0.01) continue;
            segments = segments.flatMap(([low, high]) => {
                const result = [];
                if (hole.y0 > low) result.push([low, Math.min(hole.y0 - 0.01, high)]);
                if (hole.y1 < high) result.push([Math.max(hole.y1 + 0.01, low), high]);
                return result.filter(([a, b]) => b - a > 0.006);
            });
        }
        return segments;
    }
    for (let x = -L / 2 + 0.22; x < L / 2 - 0.18; x += 0.095) {
        for (const [low, high] of uninterruptedSegments(x, openings)) {
            box("fine vertical front panel joint", 0.003, high - low, 0.002, x, (low + high) / 2, W / 2 - 0.059, palette.seam);
            box("front panel profile highlight", 0.004, high - low, 0.004, x + 0.004, (low + high) / 2, W / 2 - 0.057, palette.pvc);
        }
        box("fine vertical rear panel joint", 0.003, H - 0.304, 0.003, x, H / 2, -W / 2 + 0.058, palette.seam);
    }
    for (let z = -W / 2 + 0.22; z < W / 2 - 0.18; z += 0.095) {
        for (const sx of [-1, 1]) {
            box("fine vertical end panel joint", 0.003, H - 0.304, 0.003, sx * (L / 2 - 0.058), H / 2, z, palette.seam);
            box("end panel profile highlight", 0.004, H - 0.304, 0.004, sx * (L / 2 - 0.057), H / 2, z + 0.004, palette.pvc);
        }
    }

    // Narrow weather seals and folded panel caps along the steel-to-panel joints.
    for (const sz of [-1, 1]) for (const y of [0.155, H - 0.155]) {
        box("horizontal weather seal", L - 0.31, 0.011, 0.009, 0, y, sz * (W / 2 - 0.052), palette.blueEdge);
    }

    // Glazed PVC casements are recessed into cut wall openings; no opaque wall
    // sits behind the glass. The 4 m model has two separate leaves and a mullion.
    for (const [index, win] of spec.windows.entries()) {
        const y = win.bottom + win.height / 2;
        ring(`window ${index + 1} outer bevelled frame`, win.width, win.height, 0.055, 0.085, win.x, y, W / 2 - 0.025, palette.pvc, 0.006);
        ring(`window ${index + 1} inner reveal`, win.width - 0.07, win.height - 0.07, 0.022, 0.11, win.x, y, W / 2 - 0.115, palette.pvc, 0.002);
        const clearWidth = win.width - 0.10;
        const leafWidth = (clearWidth - (win.panes - 1) * 0.024) / win.panes;
        if (win.panes === 2) box("double window centre mullion", 0.042, win.height - 0.095, 0.080, win.x, y, W / 2 - 0.008, palette.pvc, 0.003);
        for (let i = 0; i < win.panes; i++) {
            const x = win.x - clearWidth / 2 + leafWidth / 2 + i * (leafWidth + 0.024);
            const h = win.height - 0.10;
            ring("window casement profile", leafWidth, h, 0.032, 0.048, x, y, W / 2 - 0.002, palette.pvc, 0.004);
            ring("window glazing gasket", leafWidth - 0.056, h - 0.056, 0.008, 0.012, x, y, W / 2 - 0.005, palette.seal, 0.001);
            add("clear blue-grey window glazing", new THREE.PlaneGeometry(leafWidth - 0.073, h - 0.073), palette.glass, x, y, W / 2 - 0.014);
            const handleX = x + leafWidth / 2 - 0.045;
            box("interior window handle rose", 0.018, 0.070, 0.017, handleX, y, W / 2 - 0.071, palette.pvc, 0.002);
            cylinder("interior window lever", 0.006, 0.067, handleX, y - 0.018, W / 2 - 0.089, palette.pvc);
        }
        box("projecting window sill", win.width + 0.045, 0.022, 0.13, win.x, win.bottom - 0.006, W / 2 - 0.018, palette.pvc, 0.003);
        box("window head drip cap", win.width + 0.025, 0.014, 0.105, win.x, win.bottom + win.height + 0.004, W / 2 - 0.024, palette.pvc, 0.002);
    }

    const door = spec.door, doorY = door.bottom + door.height / 2;
    ring("door outer rebated jamb", door.width, door.height, 0.047, 0.09, door.x, doorY, W / 2 - 0.024, palette.pvc, 0.004);
    ring("door perimeter rubber seal", door.width - 0.081, door.height - 0.081, 0.012, 0.020, door.x, doorY, W / 2 - 0.014, palette.seal, 0.001);
    box("flush white insulated door leaf", door.width - 0.108, door.height - 0.104, 0.048, door.x, doorY, W / 2 - 0.029, palette.door, 0.004);
    box("brushed metal door threshold", door.width - 0.06, 0.018, 0.105, door.x, door.bottom + 0.018, W / 2 - 0.019, palette.steel, 0.002);
    const hingeSign = door.hinge === "right" ? 1 : -1;
    for (const offset of [0.26, 1.00, door.height - 0.27]) {
        const x = door.x + hingeSign * (door.width / 2 - 0.049);
        box("door hinge leaf", 0.032, 0.078, 0.012, x - hingeSign * 0.010, door.bottom + offset, W / 2 + 0.004, palette.pvc, 0.002);
        cylinder("steel door hinge barrel", 0.011, 0.082, x, door.bottom + offset, W / 2 + 0.009, palette.steel);
    }
    const handleX = door.x - hingeSign * (door.width / 2 - 0.132), handleY = 1.03;
    add("rounded stainless lock escutcheon", extrude(roundedRectangle(0.034, 0.153, 0.011), 0.009), palette.steel, handleX, handleY - 0.024, W / 2 + 0.001);
    cylinder("door handle spindle", 0.012, 0.040, handleX, handleY + 0.014, W / 2 + 0.023, palette.steel, "z");
    cylinder("door handle horizontal lever", 0.009, 0.112, handleX + hingeSign * 0.046, handleY + 0.014, W / 2 + 0.043, palette.steel, "x");
    cylinder("door euro cylinder keyhole", 0.006, 0.003, handleX, handleY - 0.061, W / 2 + 0.007, palette.seal, "z");
    box("door keyhole stem", 0.005, 0.010, 0.003, handleX, handleY - 0.068, W / 2 + 0.008, palette.seal);
    for (const y of [handleY + 0.039, handleY - 0.086]) cylinder("lock plate fixing screw", 0.0025, 0.003, handleX, y, W / 2 + 0.007, palette.blueEdge, "z");

    // Roof, finished interior and underside are modelled for a complete orbit.
    box("flat galvanised roof", L - 0.30, 0.065, W - 0.30, 0, H - 0.0925, 0, palette.roof, 0.004);
    for (let x = -L / 2 + 0.45; x < L / 2 - 0.25; x += 0.45) {
        box("roof standing seam", 0.008, 0.008, W - 0.32, x, H - 0.057, 0, palette.roof, 0.002);
    }
    box("white interior ceiling", L - 0.30, 0.055, W - 0.30, 0, H - 0.185, 0, palette.interior);
    box("underfloor board", L - 0.30, 0.055, W - 0.30, 0, 0.1125, 0, palette.skirting);
    const plankWidth = (W - 0.31) / 11;
    for (let row = 0; row < 11; row++) {
        const z = -W / 2 + 0.155 + (row + 0.5) * plankWidth;
        for (let start = -L / 2 + 0.155 - (row % 3) * 0.29; start < L / 2 - 0.155; start += 0.88) {
            const x0 = Math.max(start, -L / 2 + 0.155), x1 = Math.min(start + 0.878, L / 2 - 0.155);
            if (x1 <= x0) continue;
            const tone = (row * 7 + Math.round((start + L) * 11)) % wood.length;
            box("staggered oak floor plank", x1 - x0, 0.022, plankWidth - 0.002, (x0 + x1) / 2, 0.151, z, wood[tone]);
            for (let g = 0; g < 3; g++) {
                const fraction = 0.22 + g * 0.27;
                box("subtle timber grain", (x1 - x0) * (0.45 + g * 0.12), 0.0007, 0.0008, (x0 + x1) / 2, 0.1623, z + plankWidth * (fraction - 0.5), grain);
            }
        }
    }
    for (let x = -L / 2 + 0.30; x <= L / 2 - 0.25; x += 0.55) {
        box("underfloor steel transverse joist", 0.055, 0.09, W - 0.30, x, 0.055, 0, palette.underside);
    }
    for (const sx of [-1, 1]) box("end wall oak skirting", 0.018, 0.065, W - 0.30, sx * (L / 2 - 0.158), 0.1945, 0, palette.skirting);
    box("rear wall oak skirting", L - 0.30, 0.065, 0.018, 0, 0.1945, -W / 2 + 0.158, palette.skirting);
    const doorLeft = door.x - door.width / 2, doorRight = door.x + door.width / 2;
    for (const [left, right] of [[-L / 2 + 0.15, doorLeft], [doorRight, L / 2 - 0.15]]) {
        box("front wall oak skirting beside door", right - left, 0.065, 0.018, (left + right) / 2, 0.1945, W / 2 - 0.158, palette.skirting);
    }
    box("ceiling luminaire housing", Math.min(1.20, L * 0.35), 0.035, 0.105, 0, H - 0.231, 0, palette.pvc, 0.004);
    box("ceiling luminaire diffuser", Math.min(1.14, L * 0.33), 0.010, 0.083, 0, H - 0.251, 0, palette.led, 0.002);

    // Batch opaque surfaces by material: hundreds of authored details remain
    // real geometry, while each model needs only a few dozen GPU draw calls.
    group.updateMatrixWorld(true);
    const buckets = new Map();
    for (const mesh of [...group.children]) {
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        geometry.clearGroups();
        const list = buckets.get(mesh.material) ?? [];
        list.push(geometry);
        buckets.set(mesh.material, list);
        group.remove(mesh);
        mesh.geometry.dispose();
    }
    for (const [mat, geometries] of buckets) {
        const merged = mergeGeometries(geometries.map(g => g.index ? g.toNonIndexed() : g));
        const geometry = mergeVertices(merged, 0.00001);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.name = mat.name;
        group.add(mesh);
        for (const g of geometries) g.dispose();
        merged.dispose();
    }
    group.userData.authoredDetailCount = parts.length;
    group.userData.meshCount = group.children.length;
    return group;
}

async function main() {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    await mkdir(join(root, "models"), { recursive: true });
    const manifest = [];
    for (const spec of officeModels) {
        const model = createOfficeContainer(spec);
        const scene = new THREE.Scene();
        scene.add(model);
        const data = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true });
        const file = `models/buero-${spec.length}m.glb`;
        await writeFile(join(root, file), Buffer.from(data));
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        manifest.push({ ...spec, file, bytes: data.byteLength,
            detailCount: model.userData.authoredDetailCount, meshCount: model.children.length,
            boundingBoxMetres: { x: size.x, y: size.y, z: size.z },
        });
    }
    await writeFile(join(root, "models/office-models.json"), JSON.stringify({
        units: "metres", confirmed: "length and width", estimatedHeight: 2.6,
        basis: "Offer illustrations; oak floor and white interior from supplied photos. Unseen faces are assumed plain.",
        models: manifest,
    }, null, 2) + "\n");
    console.log(JSON.stringify(manifest, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
