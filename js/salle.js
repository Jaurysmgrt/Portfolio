// ═══════════════════════════════════════════════════════════════════════
// LA SALLE — le travail de Jaurys Maigret, accroché dans un volume réel.
//
// Pas de décor abstrait : les pièces sont les vraies affiches et photos,
// à leurs vraies proportions, épaisses de quelques millimètres, éclairées
// par une lumière rasante et posant leur ombre sur le mur du fond.
// On glisse dans la salle, on s'approche d'une pièce, on l'ouvre.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from '../vendor/three.module.min.js';

export function demarrer(scene, cv, legende) {

  // ── la matière de la salle ───────────────────────────────────────────
  const FOND      = 0x06070a;   // le noir du hall
  const MUR       = 0x0d1219;   // le mur du fond, que la lumiere vient lecher
  const TRANCHE   = 0x2a333e;   // l'épaisseur des plaques
  const HAUTEUR   = 2.6;        // hauteur commune des pièces
  const ECART     = 1.05;       // respiration entre deux pièces

  const renderer = new THREE.WebGLRenderer({
    canvas: cv, antialias: true, alpha: false, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const monde = new THREE.Scene();
  monde.background = new THREE.Color(FOND);

  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  cam.position.set(0, 0, 4.9);

  // ── la lumière : une fenêtre haute à gauche, rasante ──────────────────
  monde.add(new THREE.HemisphereLight(0x9fb4cc, 0x05070a, 0.55));

  const cle = new THREE.DirectionalLight(0xfff4e8, 2.6);
  cle.position.set(-3.6, 5.0, 5.4);
  cle.castShadow = true;
  cle.shadow.mapSize.set(2048, 2048);
  cle.shadow.camera.near = 1;
  cle.shadow.camera.far = 40;
  cle.shadow.camera.left = -14;
  cle.shadow.camera.right = 14;
  cle.shadow.camera.top = 8;
  cle.shadow.camera.bottom = -8;
  cle.shadow.bias = -0.0006;
  cle.shadow.radius = 3;
  monde.add(cle);

  // un appoint froid côté droit, pour que les tranches ne soient pas noires
  const appoint = new THREE.DirectionalLight(0x7fa6d6, 0.75);
  appoint.position.set(6.5, 0.6, 2.5);
  monde.add(appoint);

  // ── le volume : mur du fond et sol ───────────────────────────────────
  // Un mur de galerie : surface parfaitement plate, sur laquelle on ne voit
  // que l'ombre portee. ShadowMaterial ne dessine rien d'autre que l'ombre,
  // donc le blanc reste blanc quoi que fasse le tone mapping.
  const mur = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 60),
    new THREE.MeshStandardMaterial({ color: MUR, roughness: 1, metalness: 0 })
  );
  mur.position.z = -1.9;
  mur.receiveShadow = true;
  monde.add(mur);

  // Une nappe de lumiere qui tombe sur le mur : c'est elle qui donne le volume.
  const lampe = new THREE.PointLight(0xdce8f6, 26, 26, 2);
  lampe.position.set(-1.2, 3.2, 1.6);
  monde.add(lampe);

  // ── les pièces ───────────────────────────────────────────────────────
  const pieces = [];
  const chargeur = new THREE.TextureLoader();
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  // on lit la galerie existante : rien n'est dupliqué, rien n'est inventé
  const sources = [...document.querySelectorAll('#gallery .gal-item')]
    .filter(el => !el.classList.contains('gal-video'))
    .filter(el => {
      const i = el.querySelector('img');
      return i && i.getAttribute('src') && !/^https?:/.test(i.getAttribute('src'));
    });

  let x = 0;
  sources.forEach((src, i) => {
    const img = src.querySelector('img');
    const w = +img.getAttribute('width') || 800;
    const h = +img.getAttribute('height') || 1200;
    const larg = HAUTEUR * (w / h);

    const tex = chargeur.load(img.getAttribute('src'));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;

    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.04 });
    const bord = new THREE.MeshStandardMaterial({ color: TRANCHE, roughness: 0.52, metalness: 0.35 });
    // ordre des faces d'un Box : +x, -x, +y, -y, +z, -z
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(larg, HAUTEUR, 0.05),
      [bord, bord, bord, bord, face, bord]
    );

    // rythme éditorial : les pièces ne sont pas alignées au cordeau
    const y = (i % 3 === 1 ? 0.26 : (i % 3 === 2 ? -0.2 : 0));
    const z = (i % 2 ? 0.05 : -0.05);
    plaque.position.set(x + larg / 2, y, z);
    plaque.castShadow = true;
    plaque.receiveShadow = false;
    plaque.userData = { src, base: plaque.position.clone(), vise: 0, cible: 0 };
    monde.add(plaque);
    pieces.push(plaque);

    x += larg + ECART;
  });

  const LARGEUR_TOTALE = Math.max(x - ECART, 1);
  // on recentre la salle sur son contenu
  pieces.forEach(p => { p.position.x -= LARGEUR_TOTALE / 2; p.userData.base.copy(p.position); });

  const X_MIN = pieces.length ? pieces[0].position.x : 0;
  const X_MAX = pieces.length ? pieces[pieces.length-1].position.x : 0;

  // ── déplacement ──────────────────────────────────────────────────────
  let camX = X_MIN, camViseX = X_MIN;
  let souris = { x: 0, y: 0 }, sourisLisse = { x: 0, y: 0 };
  let survol = null, enCours = false, derniereX = 0, aGlisse = false;

  function borner(v) { return Math.max(X_MIN, Math.min(X_MAX, v)); }

  scene.addEventListener('pointerdown', e => {
    enCours = true; aGlisse = false; derniereX = e.clientX;
    scene.setPointerCapture?.(e.pointerId);
    scene.classList.add('glisse');
  });
  scene.addEventListener('pointermove', e => {
    const r = scene.getBoundingClientRect();
    souris.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    souris.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    if (enCours) {
      const d = e.clientX - derniereX; derniereX = e.clientX;
      if (Math.abs(d) > 2) aGlisse = true;
      camViseX = borner(camViseX - d * 0.011);
    }
  });
  function relacher(e) {
    if (enCours && !aGlisse && survol) survol.userData.src.click();
    enCours = false; scene.classList.remove('glisse');
  }
  scene.addEventListener('pointerup', relacher);
  scene.addEventListener('pointerleave', () => { enCours = false; scene.classList.remove('glisse'); souris.x = souris.y = 0; });

  scene.addEventListener('wheel', e => {
    // molette horizontale ou trackpad : on parcourt. Vertical : on laisse la page.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      camViseX = borner(camViseX + e.deltaX * 0.006);
    }
  }, { passive: false });

  // clavier : la salle est parcourable sans souris
  scene.tabIndex = 0;
  scene.setAttribute('role', 'application');
  scene.setAttribute('aria-label', 'Salle d\'exposition. Flèches pour parcourir, Entrée pour ouvrir une pièce.');
  scene.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { camViseX = borner(camViseX + 1.4); e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { camViseX = borner(camViseX - 1.4); e.preventDefault(); }
    if ((e.key === 'Enter' || e.key === ' ') && survol) { survol.userData.src.click(); e.preventDefault(); }
  });

  // ── survol ───────────────────────────────────────────────────────────
  const rayon = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();

  function majSurvol() {
    pointeur.set(souris.x, souris.y);
    rayon.setFromCamera(pointeur, cam);
    const touches = rayon.intersectObjects(pieces, false);
    const nouveau = touches.length ? touches[0].object : null;
    if (nouveau === survol) return;
    survol = nouveau;
    pieces.forEach(p => { p.userData.cible = (p === survol ? 1 : 0); });
    scene.classList.toggle('pointe', !!survol);
    if (survol) {
      const d = survol.userData.src.dataset;
      legende.querySelector('.salle-cap-t').textContent = d.title || '';
      legende.querySelector('.salle-cap-c').textContent = d.cat || '';
      legende.classList.add('on');
    } else {
      legende.classList.remove('on');
    }
  }

  // ── boucle ───────────────────────────────────────────────────────────
  let visible = false, raf = null;

  function dimensionner() {
    const r = scene.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    cam.aspect = r.width / r.height;
    cam.updateProjectionMatrix();
  }

  function rendu() {
    raf = null;
    if (!visible) return;

    camX += (camViseX - camX) * 0.075;
    sourisLisse.x += (souris.x - sourisLisse.x) * 0.06;
    sourisLisse.y += (souris.y - sourisLisse.y) * 0.06;

    cam.position.x = camX + sourisLisse.x * 0.42;
    cam.position.y = sourisLisse.y * 0.32;
    cam.lookAt(camX + sourisLisse.x * 0.9, sourisLisse.y * 0.12, 0);

    for (const p of pieces) {
      const u = p.userData;
      u.vise += (u.cible - u.vise) * 0.11;
      p.position.z = u.base.z + u.vise * 0.42;
      p.position.y = u.base.y + u.vise * 0.045;
      p.rotation.y = -sourisLisse.x * 0.045 + u.vise * 0.02;
    }

    majSurvol();
    renderer.render(monde, cam);
    raf = requestAnimationFrame(rendu);
  }
  function relancer() { if (!raf && visible) raf = requestAnimationFrame(rendu); }

  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible) { dimensionner(); relancer(); }
  }, { threshold: 0.05 }).observe(scene);

  let deb;
  addEventListener('resize', () => { clearTimeout(deb); deb = setTimeout(dimensionner, 160); }, { passive: true });

  dimensionner();
  scene.classList.add('prete');

  return { pieces: pieces.length };
}
