import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const modal = document.querySelector("[data-model-modal]");
const title = document.querySelector("#model-title");
const status = document.querySelector("[data-model-status]");
const stage = document.querySelector("[data-model-stage]");
const canvas = document.querySelector("#model-canvas");
const previewButtons = document.querySelectorAll("[data-preview]");
const closeButtons = document.querySelectorAll("[data-close-preview]");
const spinToggle = document.querySelector("[data-spin-toggle]");

let renderer;
let scene;
let camera;
let controls;
let loader;
let activeModel;
let animationId;
let resizeObserver;
let isSpinning = true;

const modelMaterials = {
    Office: {
        body: 0xf4f1e8,
        trim: 0x0f5f4f,
        accent: 0x26c89f,
    },
    Storage: {
        body: 0xd86631,
        trim: 0x17221f,
        accent: 0xffb36f,
    },
    Modular: {
        body: 0xe8eef1,
        trim: 0x2a5a72,
        accent: 0xff8a3d,
    },
};

const ensureViewer = () => {
    if (renderer) {
        return;
    }

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(6, 4, 6);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    controls.minDistance = 4;
    controls.maxDistance = 13;
    controls.target.set(0, 0.55, 0);

    loader = new GLTFLoader();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x24332f, 1.5);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(5, 7, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x26c89f, 1.2);
    fillLight.position.set(-4, 3, -5);
    scene.add(fillLight);

    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(4.8, 96),
        new THREE.MeshStandardMaterial({
            color: 0x1f2c28,
            roughness: 0.82,
            metalness: 0.05,
            transparent: true,
            opacity: 0.92,
        }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.80;
    ground.receiveShadow = true;
    scene.add(ground);

    resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(stage);

    animate();
};

const resizeRenderer = () => {
    if (!renderer || !stage) {
        return;
    }

    const width = Math.max(stage.clientWidth, 320);
    const height = Math.max(stage.clientHeight, 320);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
};

const animate = () => {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
};

const setSpinState = (shouldSpin) => {
    isSpinning = shouldSpin;

    if (controls) {
        controls.autoRotate = shouldSpin;
    }

    spinToggle.classList.toggle("is-paused", !shouldSpin);
    spinToggle.setAttribute("aria-label", shouldSpin ? "Drehung pausieren" : "Drehung starten");
    spinToggle.setAttribute("title", shouldSpin ? "Drehung pausieren" : "Drehung starten");
};

const clearActiveModel = () => {
    if (!activeModel) {
        return;
    }

    scene.remove(activeModel);
    activeModel.traverse((object) => {
        if (object.geometry) {
            object.geometry.dispose();
        }
        if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
        }
    });
    activeModel = null;
};

const createBox = (size, position, color, metalness = 0.06) => {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshStandardMaterial({
            color,
            roughness: 0.64,
            metalness,
        }),
    );
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
};

const createContainerFallback = (type) => {
    const colors = modelMaterials[type] ?? modelMaterials.Modular;
    const group = new THREE.Group();

    const body = createBox(
        new THREE.Vector3(4.4, 1.85, 1.85),
        new THREE.Vector3(0, 1.05, 0),
        colors.body,
        0.14,
    );
    group.add(body);

    for (let i = -5; i <= 5; i += 1) {
        const x = i * 0.38;
        group.add(createBox(new THREE.Vector3(0.045, 1.92, 1.94), new THREE.Vector3(x, 1.06, 0), colors.trim, 0.18));
    }

    for (let side of [-1, 1]) {
        group.add(createBox(new THREE.Vector3(4.55, 0.12, 0.08), new THREE.Vector3(0, 1.94, side * 0.96), colors.trim, 0.16));
        group.add(createBox(new THREE.Vector3(4.55, 0.12, 0.08), new THREE.Vector3(0, 0.16, side * 0.96), colors.trim, 0.16));
    }

    for (let x of [-2.28, 2.28]) {
        group.add(createBox(new THREE.Vector3(0.1, 1.95, 1.95), new THREE.Vector3(x, 1.06, 0), colors.trim, 0.18));
    }

    const door = createBox(
        new THREE.Vector3(0.08, 1.46, 1.44),
        new THREE.Vector3(2.34, 1.03, 0),
        colors.accent,
        0.1,
    );
    group.add(door);

    for (let z of [-0.38, 0.38]) {
        group.add(createBox(new THREE.Vector3(0.1, 1.34, 0.05), new THREE.Vector3(2.42, 1.03, z), colors.trim, 0.2));
    }

    if (type === "Office") {
        for (let x of [-1.3, -0.35, 0.6]) {
            const windowMesh = createBox(
                new THREE.Vector3(0.58, 0.48, 0.05),
                new THREE.Vector3(x, 1.28, -0.96),
                0x9ed9ff,
                0.02,
            );
            group.add(windowMesh);
        }
    }

    if (type === "Storage") {
        for (let z of [-0.46, 0, 0.46]) {
            group.add(createBox(new THREE.Vector3(0.06, 1.38, 0.04), new THREE.Vector3(2.45, 1.02, z), 0x101816, 0.16));
        }
    }

    if (type === "Modular") {
        group.add(createBox(new THREE.Vector3(4.7, 0.14, 2.05), new THREE.Vector3(0, 2.08, 0), colors.accent, 0.12));
        group.add(createBox(new THREE.Vector3(4.7, 0.14, 2.05), new THREE.Vector3(0, 0.03, 0), colors.trim, 0.12));
    }

    group.rotation.y = -0.42;
    return group;
};

const frameModel = (model) => {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4.9 / largest;

    model.scale.multiplyScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    model.position.y += 0.12;

    camera.position.set(6, 4, 6);
    controls.target.set(0, 0.75, 0);
    controls.update();
};

const showFallback = (type) => {
    clearActiveModel();
    activeModel = createContainerFallback(type);
    scene.add(activeModel);
    status.textContent = "Demo-Modell";
    frameModel(activeModel);
};

const loadModel = ({ modelPath, type }) => {
    clearActiveModel();
    status.textContent = "Modell wird geladen";

    loader.load(
        modelPath,
        (gltf) => {
            activeModel = gltf.scene;
            activeModel.traverse((object) => {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            });
            scene.add(activeModel);
            status.textContent = "Blender-Modell";
            frameModel(activeModel);
        },
        undefined,
        () => showFallback(type),
    );
};

const openPreview = (button) => {
    ensureViewer();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    title.textContent = button.dataset.title ?? "Container";
    setSpinState(true);
    resizeRenderer();
    loadModel({
        modelPath: button.dataset.model,
        type: button.dataset.type,
    });
};

const closePreview = () => {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
};

previewButtons.forEach((button) => {
    button.addEventListener("click", () => openPreview(button));
});

closeButtons.forEach((button) => {
    button.addEventListener("click", closePreview);
});

spinToggle.addEventListener("click", () => {
    setSpinState(!isSpinning);
});

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
        closePreview();
    }
});

window.addEventListener("beforeunload", () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
});
