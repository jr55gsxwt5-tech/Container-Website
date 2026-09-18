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
// haupt-Menü schließen, wenn außerhalb geklickt wird

document.addEventListener("click", function (event) {
    const nav = document.querySelector(".site-nav");
    const navToggle = document.querySelector(".nav-toggle");
    const langMenu = document.querySelector(".lang-menu");
    const dropdown = document.querySelector(".lang-menu ul");

    // Nur auf Handy
    if (window.innerWidth > 620) return;

    // Wenn außerhalb von Menü und Hamburger geklickt wird
    if (
        !nav.contains(event.target) &&
        !navToggle.contains(event.target)
    ) {
        nav.classList.remove("is-open");      // Navigation schließen
        navToggle.classList.remove("is-open"); // Hamburger zurücksetzen
        dropdown.classList.remove("show");     // Sprachmenü schließen
    }
});

// Sprachmenü schließen, wenn ein Link geklickt wird
document.querySelectorAll(".lang-menu ul li a").forEach(link => {
    link.addEventListener("click", function () {
        if (window.innerWidth <= 620) {

            // Sprachmenü schließen
            document.querySelector(".lang-menu ul").classList.remove("show");

            // Navigationsmenü schließen
            document.querySelector(".site-nav").classList.remove("is-open");

            // Hamburger-Button zurücksetzen
            document.querySelector(".nav-toggle").classList.remove("is-open");
        }
    });
});

// Menü umschalten
const ensureViewer = () => {
    if (renderer) {
        return;
    }

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

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x24332f, 1.5);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(5, 7, 4);
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
    spinToggle.setAttribute("aria-label", shouldSpin ? "Drehung pausieren" : "Drehung starten");
    spinToggle.setAttribute("title", shouldSpin ? "Drehung pausieren" : "Drehung starten");
};

const updateModalOpenState = () => {
    const isModelOpen = modal && !modal.hidden;
    const isGalleryOpen = galleryModal && !galleryModal.hidden;
    document.body.classList.toggle("modal-open", isModelOpen || isGalleryOpen);
};

const clearActiveModel = () => {
    if (!activeModel) {
        return;
    }

    scene.remove(activeModel);
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
    if (!fallbackCache.has(type)) {
        fallbackCache.set(type, createContainerFallback(type));
    }
    activeModel = fallbackCache.get(type).clone();
    scene.add(activeModel);
    status.textContent = "Demo-Modell";
    frameModel(activeModel);
};

const loadModel = ({ modelPath, type }) => {
    clearActiveModel();
    status.textContent = "Modell wird geladen";

    if (modelCache.has(modelPath)) {
        activeModel = modelCache.get(modelPath).clone();
        scene.add(activeModel);
        status.textContent = "Blender-Modell";
        frameModel(activeModel);
        return;
    }

    loader.load(
        modelPath,
        (gltf) => {
            modelCache.set(modelPath, gltf.scene);
            activeModel = gltf.scene.clone();
            activeModel.traverse((object) => {
                if (object.isMesh) {
                    object.castShadow = false;
                    object.receiveShadow = false;
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

    galleryModal.hidden = true;
    modal.hidden = false;

    updateModalOpenState();
    title.textContent = button.dataset.title ?? "Container";
    setSpinState(true);
    resizeRenderer();

    viewerRunning = true;

    if (!animationId) {
        animate();
    }

    loadModel({
        modelPath: button.dataset.model,
        type: button.dataset.type,
    });
};

const closePreview = () => {
    modal.hidden = true;
    viewerRunning = false;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    updateModalOpenState();
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
        galleryFallback.textContent = "Noch keine Bildpfade eingetragen.";
        galleryCaption.textContent = "";
        galleryStatus.textContent = "Keine Bilder";
        updateGalleryControls();
        return;
    }

    galleryIndex = (nextIndex + galleryImages.length) % galleryImages.length;
    const src = galleryImages[galleryIndex];
    const displayIndex = galleryIndex + 1;

    galleryStatus.textContent = `Bild ${displayIndex} von ${galleryImages.length}`;
    galleryCaption.textContent = `${galleryTitle.textContent} - Bild ${displayIndex}`;
    galleryImage.alt = `${galleryTitle.textContent} Bild ${displayIndex}`;
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
        thumb.setAttribute("aria-label", `Bild ${index + 1} anzeigen`);

        const thumbImage = document.createElement("img");
        thumbImage.src = src;
        thumbImage.alt = "";
        thumbImage.loading = "lazy";
        thumbImage.decoding = "async";
        thumbImage.addEventListener("error", () => {
            thumbImage.remove();
            const fallback = document.createElement("span");
            fallback.textContent = `Bild ${index + 1}`;
            thumb.append(fallback);
        }, { once: true });

        thumb.append(thumbImage);
        thumb.addEventListener("click", () => showGalleryImage(index));
        galleryThumbs.append(thumb);
    });
};

const openGallery = (button) => {
    modal.hidden = true;
    galleryImages = parseGalleryImages(button.dataset.images);
    galleryIndex = 0;

    galleryTitle.textContent = button.dataset.title ?? "Container";
    galleryModal.hidden = false;
    updateModalOpenState();
    renderGalleryThumbs();
    showGalleryImage(0);
};

const closeGallery = () => {
    galleryModal.hidden = true;
    updateModalOpenState();
};

previewButtons.forEach((button) => {
    button.addEventListener("click", () => openPreview(button));
});

closeButtons.forEach((button) => {
    button.addEventListener("click", closePreview);
});

galleryButtons.forEach((button) => {
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
    const missingPath = galleryImages[galleryIndex] ?? "";
    galleryImage.hidden = true;
    galleryFallback.hidden = false;
    galleryFallback.textContent = `Bilddatei noch nicht gefunden: ${missingPath}`;
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
        const revealItems = document.querySelectorAll('.reveal');

        const setHeaderState = () => {
            header.classList.toggle('is-scrolled', window.scrollY > 12);
        };

        toggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('is-open');
            toggle.classList.toggle('is-open', isOpen);
            toggle.setAttribute('aria-expanded', String(isOpen));
        });

        nav.addEventListener('click', (event) => {
            if (event.target.matches('a:not(.lang-menu a)')) {
                nav.classList.remove('is-open');
                toggle.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.18 });

        revealItems.forEach((item) => revealObserver.observe(item));
        setHeaderState();
        window.addEventListener('scroll', setHeaderState, { passive: true });


         // Funktion zum Wechseln der Sprache in den Texten
        function changeLanguage(lang) {
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[lang] && translations[lang][key]) {
                    el.textContent = translations[lang][key];
                }
            });
            document.documentElement.lang = lang;
        }

        // Funktion zum Aktualisieren des sichtbaren Flaggen-Buttons
        function updateDropdownUI(lang) {
            const selectedUI = document.getElementById("selected-lang");
            selectedUI.textContent = lang;
            selectedUI.className = `selected-lang ${lang}`;
        }

        // KLICK-MODUS FÜR DAS DROPDOWN-MENÜ
        const langBtn = document.getElementById("selected-lang");
        const langDropdown = document.getElementById("lang-dropdown");

        // Öffnen/Schließen bei Klick auf den aktuellen Sprach-Button
        langBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Verhindert sofortiges Schließen durch den Document-Klick
            langDropdown.classList.toggle("show");
        });

        // Schließen, wenn man irgendwo anders auf die Seite klickt
        document.addEventListener("click", () => {
            langDropdown.classList.remove("show");
        });

        // Event-Listener für die Auswahl einer Sprache im Dropdown
        const langLinks = document.querySelectorAll('.lang-menu ul li a');
        langLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault(); 
                
                const selectedLang = e.target.getAttribute('data-value');
                
                // 1. Sprache speichern
                localStorage.setItem("lang", selectedLang);
                
                // 2. Dropdown UI anpassen und Menü schließen
                updateDropdownUI(selectedLang);
                langDropdown.classList.remove("show");
                
                // 3. Texte übersetzen
                changeLanguage(selectedLang);
            });
        });

        // Beim Laden der Seite ausführen
        window.addEventListener("DOMContentLoaded", () => {
            const savedLang = localStorage.getItem("lang") || "de";
            updateDropdownUI(savedLang);
            changeLanguage(savedLang);
        });
