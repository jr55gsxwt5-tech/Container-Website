import { t, initLanguage, setLanguage } from "./i18n.js";

let THREE;
let OrbitControls;
let GLTFLoader;
let libraryPromise;

const modal = document.querySelector("[data-model-modal]");
const title = document.querySelector("#model-title");
const status = document.querySelector("[data-model-status]");
const stage = document.querySelector("[data-model-stage]");
const canvas = document.querySelector("#model-canvas");
const previewButtons = document.querySelectorAll("[data-preview]");
const closeButtons = document.querySelectorAll("[data-close-preview]");
const spinToggle = document.querySelector("[data-spin-toggle]");
const galleryModal = document.querySelector("[data-gallery-modal]");
const galleryTitle = document.querySelector("#gallery-title");
const galleryStatus = document.querySelector("[data-gallery-status]");
const galleryStage = document.querySelector("[data-gallery-stage]");
const galleryImage = document.querySelector("[data-gallery-image]");
const galleryCaption = document.querySelector("[data-gallery-caption]");
const galleryFallback = document.querySelector("[data-gallery-fallback]");
const galleryButtons = document.querySelectorAll("[data-gallery]");
const closeGalleryButtons = document.querySelectorAll("[data-close-gallery]");
const galleryPrev = document.querySelector("[data-gallery-prev]");
const galleryNext = document.querySelector("[data-gallery-next]");
const galleryThumbs = document.querySelector("[data-gallery-thumbs]");
const reviewCarousel = document.querySelector("[data-reviews-carousel]");
const reviewTrack = document.querySelector("[data-review-track]");
const reviewSlides = document.querySelectorAll("[data-review-slide]");
const reviewPrev = document.querySelector("[data-review-prev]");
const reviewNext = document.querySelector("[data-review-next]");
const reviewDots = document.querySelector("[data-review-dots]");

let renderer;
let scene;
let camera;
let controls;
let loader;
let activeModel;
let animationId;
let resizeObserver;
let isSpinning = true;
let galleryImages = [];
let galleryIndex = 0;
let galleryPointerStartX = null;
let viewerRunning = false;
let reviewIndex = 0;
let lastFocusedElement = null;
let modelRequestId = 0;
const modelCache = new Map();
const fallbackCache = new Map();

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
const ensureViewer = async () => {
    if (renderer) {
        return;
    }

    libraryPromise ??= Promise.all([
        import("three"),
        import("three/addons/controls/OrbitControls.js"),
        import("three/addons/loaders/GLTFLoader.js"),
    ]).catch((error) => {
        libraryPromise = null;
        throw error;
    });
    const modules = await libraryPromise;
    if (renderer) return;
    [THREE, { OrbitControls }, { GLTFLoader }] = modules;

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;

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

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e467a, 1.5);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(5, 7, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    fillLight.position.set(-4, 3, -5);
    scene.add(fillLight);

    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(4.8, 96),
        new THREE.MeshStandardMaterial({
            color: 0x173b68,
            roughness: 0.82,
            metalness: 0.05,
            transparent: true,
            opacity: 0.92,
        }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.80;
    scene.add(ground);

    resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(stage);

    animate();
};

const resizeRenderer = () => {
    if (!renderer || !stage) {
        return;
    }

    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (activeModel) fitCameraToModel();
};

const animate = () => {
    if (!viewerRunning) {
        return;
    }

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
    const label = t(shouldSpin ? "spin-pause" : "spin-start");
    spinToggle.setAttribute("aria-label", label);
    spinToggle.setAttribute("title", label);
};

const updateModalOpenState = () => {
    const isModelOpen = modal && !modal.hidden;
    const isGalleryOpen = galleryModal && !galleryModal.hidden;
    document.body.classList.toggle("modal-open", isModelOpen || isGalleryOpen);
    document.querySelectorAll("header, main, footer, .skip-link").forEach((element) => {
        element.inert = isModelOpen || isGalleryOpen;
    });
};

const clearActiveModel = () => {
    if (!activeModel) {
        return;
    }

    scene.remove(activeModel);
    activeModel = null;
};

const showReview = (nextIndex) => {
    if (!reviewSlides.length || !reviewTrack) {
        return;
    }

    reviewIndex = (nextIndex + reviewSlides.length) % reviewSlides.length;
    reviewTrack.style.transform = `translateX(-${reviewIndex * 100}%)`;

    reviewSlides.forEach((slide, index) => {
        const isActive = index === reviewIndex;
        slide.classList.toggle("is-active", isActive);
        slide.setAttribute("aria-hidden", String(!isActive));
    });

    Array.from(reviewDots?.children ?? []).forEach((dot, index) => {
        const isActive = index === reviewIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
};

reviewSlides.forEach((slide, index) => {
    const dot = document.createElement("button");
    dot.className = "review-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", t("review-dot", { index: index + 1 }));
    dot.addEventListener("click", () => showReview(index));
    reviewDots?.append(dot);
});

reviewPrev?.addEventListener("click", () => showReview(reviewIndex - 1));
reviewNext?.addEventListener("click", () => showReview(reviewIndex + 1));
showReview(0);

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

const fitCameraToModel = () => {
    const sphere = new THREE.Box3().setFromObject(activeModel).getBoundingSphere(new THREE.Sphere());
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const distance = sphere.radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.12;
    const direction = new THREE.Vector3(1, 0.65, 1).normalize();
    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    controls.target.copy(sphere.center);
    controls.minDistance = sphere.radius * 1.25;
    controls.maxDistance = distance * 2.5;
    controls.update();
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

    fitCameraToModel();
};

const showFallback = (type) => {
    clearActiveModel();
    if (!fallbackCache.has(type)) {
        fallbackCache.set(type, createContainerFallback(type));
    }
    activeModel = fallbackCache.get(type).clone();
    scene.add(activeModel);
    status.textContent = t("model-demo");
    frameModel(activeModel);
};

const loadModel = ({ modelPath, type }) => {
    const requestId = ++modelRequestId;
    clearActiveModel();
    status.textContent = t("model-loading");

    if (modelCache.has(modelPath)) {
        activeModel = modelCache.get(modelPath).clone();
        scene.add(activeModel);
        status.textContent = t("model-ready");
        frameModel(activeModel);
        return;
    }

    loader.load(
        modelPath,
        (gltf) => {
            if (requestId !== modelRequestId) {
                return;
            }

            modelCache.set(modelPath, gltf.scene);
            activeModel = gltf.scene.clone();
            activeModel.traverse((object) => {
                if (object.isMesh) {
                    object.castShadow = false;
                    object.receiveShadow = false;
                }
            });
            scene.add(activeModel);
            status.textContent = t("model-ready");
            frameModel(activeModel);
        },
        undefined,
        () => {
            if (requestId === modelRequestId) {
                showFallback(type);
            }
        },
    );
};

const openPreview = async (button) => {
    const openingRequest = ++modelRequestId;
    lastFocusedElement = button;
    galleryModal.hidden = true;
    modal.hidden = false;
    updateModalOpenState();
    title.textContent = button.dataset.title ?? "Container";
    status.textContent = t("model-loading");
    spinToggle.disabled = true;
    modal.querySelector(".modal-close")?.focus();

    try {
        await ensureViewer();
        if (openingRequest !== modelRequestId || modal.hidden) return;
        spinToggle.disabled = false;
        setSpinState(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        resizeRenderer();
        viewerRunning = true;
        if (!animationId) animate();
        loadModel({ modelPath: button.dataset.model, type: button.dataset.type });
    } catch {
        if (openingRequest === modelRequestId && !modal.hidden) {
            status.textContent = t("model-error");
        }
    }
};

const closePreview = () => {
    modelRequestId += 1;
    modal.hidden = true;
    viewerRunning = false;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    updateModalOpenState();
    lastFocusedElement?.focus?.();
};

const parseGalleryImages = (value) => (value ?? "")
    .split("|")
    .map((path) => path.trim())
    .filter(Boolean);

const updateGalleryControls = () => {
    const hasMultipleImages = galleryImages.length > 1;
    galleryPrev.disabled = !hasMultipleImages;
    galleryNext.disabled = !hasMultipleImages;

    Array.from(galleryThumbs.children).forEach((thumb, index) => {
        const isActive = index === galleryIndex;
        thumb.classList.toggle("is-active", isActive);
        thumb.setAttribute("aria-current", isActive ? "true" : "false");
    });
};

const showGalleryImage = (nextIndex) => {
    if (!galleryImages.length) {
        galleryImage.hidden = true;
        galleryFallback.hidden = false;
        galleryFallback.textContent = t("gallery-empty");
        galleryCaption.textContent = "";
        galleryStatus.textContent = t("gallery-label");
        updateGalleryControls();
        return;
    }

    galleryIndex = (nextIndex + galleryImages.length) % galleryImages.length;
    const src = galleryImages[galleryIndex];
    const displayIndex = galleryIndex + 1;

    galleryStatus.textContent = t("gallery-status", { index: displayIndex, count: galleryImages.length });
    galleryCaption.textContent = t("gallery-image", { product: galleryTitle.textContent, index: displayIndex });
    galleryImage.alt = galleryCaption.textContent;
    galleryFallback.hidden = true;
    galleryImage.hidden = false;
    galleryImage.src = src;
    updateGalleryControls();
};

const renderGalleryThumbs = () => {
    galleryThumbs.replaceChildren();

    galleryImages.forEach((src, index) => {
        const thumb = document.createElement("button");
        thumb.className = "gallery-thumb";
        thumb.type = "button";
        thumb.setAttribute("aria-label", t("gallery-thumb", { index: index + 1 }));

        const thumbImage = document.createElement("img");
        thumbImage.src = src;
        thumbImage.alt = "";
        thumbImage.loading = "lazy";
        thumbImage.decoding = "async";
        thumbImage.addEventListener("error", () => {
            thumbImage.remove();
            const fallback = document.createElement("span");
            fallback.textContent = String(index + 1);
            thumb.append(fallback);
        }, { once: true });

        thumb.append(thumbImage);
        thumb.addEventListener("click", () => showGalleryImage(index));
        galleryThumbs.append(thumb);
    });
};

const openGallery = (button) => {
    if (!modal.hidden) closePreview();
    lastFocusedElement = button;
    modal.hidden = true;
    galleryImages = parseGalleryImages(button.dataset.images);
    galleryIndex = 0;

    galleryTitle.textContent = button.dataset.title ?? "Container";
    galleryModal.hidden = false;
    updateModalOpenState();
    renderGalleryThumbs();
    showGalleryImage(0);
    galleryModal.querySelector(".modal-close")?.focus();
};

const closeGallery = () => {
    galleryModal.hidden = true;
    updateModalOpenState();
    lastFocusedElement?.focus?.();
};

previewButtons.forEach((button) => {
    button.addEventListener("click", () => openPreview(button));
});

closeButtons.forEach((button) => {
    button.addEventListener("click", closePreview);
});

galleryButtons.forEach((button) => {
    const hasImages = parseGalleryImages(button.dataset.images).length > 0;
    button.disabled = !hasImages;

    button.addEventListener("click", () => openGallery(button));
});

closeGalleryButtons.forEach((button) => {
    button.addEventListener("click", closeGallery);
});

spinToggle.addEventListener("click", () => {
    setSpinState(!isSpinning);
});

galleryPrev.addEventListener("click", () => {
    showGalleryImage(galleryIndex - 1);
});

galleryNext.addEventListener("click", () => {
    showGalleryImage(galleryIndex + 1);
});

galleryImage.addEventListener("error", () => {
    galleryImage.hidden = true;
    galleryFallback.hidden = false;
    galleryFallback.textContent = t("gallery-error");
});

galleryStage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) {
        return;
    }

    galleryPointerStartX = event.clientX;
});

galleryStage.addEventListener("pointerup", (event) => {
    if (galleryPointerStartX === null) {
        return;
    }

    const deltaX = event.clientX - galleryPointerStartX;
    galleryPointerStartX = null;

    if (Math.abs(deltaX) < 50) {
        return;
    }

    showGalleryImage(galleryIndex + (deltaX < 0 ? 1 : -1));
});

galleryStage.addEventListener("pointercancel", () => {
    galleryPointerStartX = null;
});

window.addEventListener("keydown", (event) => {
    const dialog = !modal.hidden ? modal.querySelector("[role='dialog']") : !galleryModal.hidden ? galleryModal.querySelector("[role='dialog']") : null;
    if (dialog && event.key === "Tab") {
        const items = Array.from(dialog.querySelectorAll("button:not(:disabled), a[href], [tabindex='0']"));
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    }
    if (!galleryModal.hidden) {
        if (event.key === "Escape") {
            closeGallery();
        }

        if (event.key === "ArrowLeft") {
            showGalleryImage(galleryIndex - 1);
        }

        if (event.key === "ArrowRight") {
            showGalleryImage(galleryIndex + 1);
        }

        return;
    }

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


const header = document.querySelector('[data-elevate]');
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
const langButton = document.querySelector('#selected-lang');
const langDropdown = document.querySelector('#lang-dropdown');
const mobileNavigation = window.matchMedia('(max-width: 900px)');

const closeLanguages = () => {
    langDropdown.classList.remove('show');
    langButton.setAttribute('aria-expanded', 'false');
};

const setNavOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', t(open ? 'nav-close' : 'nav-open'));
    if (!open) closeLanguages();
};

toggle.addEventListener('click', () => setNavOpen(!nav.classList.contains('is-open')));
nav.addEventListener('click', event => {
    if (event.target.closest('a[href^="#"]') && !event.target.closest('.lang-menu')) setNavOpen(false);
});
document.addEventListener('click', event => {
    if (!event.target.closest('.lang-menu')) closeLanguages();
    if (mobileNavigation.matches && !nav.contains(event.target) && !toggle.contains(event.target)) setNavOpen(false);
});
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !modal.hidden || !galleryModal.hidden) return;
    if (langDropdown.classList.contains('show')) {
        closeLanguages();
        langButton.focus();
    } else if (nav.classList.contains('is-open')) {
        setNavOpen(false);
        toggle.focus();
    }
});
mobileNavigation.addEventListener('change', () => setNavOpen(false));
langButton.addEventListener('click', () => {
    const open = langDropdown.classList.toggle('show');
    langButton.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.lang-menu [data-value]').forEach(link => {
    link.addEventListener('click', event => {
        event.preventDefault();
        const chosenLanguage = link.dataset.value;
        setNavOpen(false);
        setLanguage(chosenLanguage);
        if (mobileNavigation.matches) toggle.focus();
        else langButton.focus();
    });
});
const setHeaderState = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
window.addEventListener('scroll', setHeaderState, { passive: true });
setHeaderState();

document.addEventListener('languagechange', () => {
    toggle.setAttribute('aria-label', t(nav.classList.contains('is-open') ? 'nav-close' : 'nav-open'));
    setSpinState(isSpinning);
    Array.from(reviewDots.children).forEach((dot, index) => dot.setAttribute('aria-label', t('review-dot', { index: index + 1 })));
    if (!galleryModal.hidden) {
        galleryTitle.textContent = lastFocusedElement?.dataset.title || 'Container';
        renderGalleryThumbs();
        showGalleryImage(galleryIndex);
    }
    if (!modal.hidden) title.textContent = lastFocusedElement?.dataset.title || 'Container';
});

initLanguage();
