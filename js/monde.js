// ═══════════════════════════════════════════════════════════════════════
// LA SOUFFLERIE — le monde de Jaurys Maigret
//
// Un hall d'essai. On n'y marche pas : le flux vous porte, et ZQSD règle
// le régime. Les pièces ne sont pas accrochées à un mur — elles sont
// MONTÉES dans la veine, chacune sur son socle, son numéro peint au sol,
// sa veilleuse braquée dessus. Le reste est noir.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from '../vendor/three.module.min.js';

const NOIR    = 0x050608;
const SOL     = 0x141b24;
const PAROI   = 0x18212c;
const ACIER   = 0x39434f;
const ROUGE   = 0xd42a1b;

const DEMI_L  = 7.4;
const PLAFOND = 6.2;
const OEIL    = 1.68;
const PAS     = 13;

export async function demarrer() {
  const cv = document.getElementById('veine');

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  // Pas de shadow map : dans un hall noir elle ne se voit pas et coute une
  // passe de rendu par lumiere. Une nappe sombre sous chaque socle suffit.
  renderer.shadowMap.enabled = false;

  const monde = new THREE.Scene();
  monde.background = new THREE.Color(NOIR);
  monde.fog = new THREE.FogExp2(0x070910, 0.016);
  const cam = new THREE.PerspectiveCamera(64, 1, 0.1, 400);

  const pieces = await fetch('data/pieces.json').then(r => r.json());
  const LONG = 60 + pieces.length * PAS;

  const acier = () => new THREE.MeshStandardMaterial({ color: ACIER, roughness: 0.42, metalness: 0.62 });

  // ═══════════ la veine ═══════════
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(DEMI_L * 2, LONG + 80),
    new THREE.MeshStandardMaterial({ color: SOL, roughness: 0.7, metalness: 0.2 })
  );
  sol.rotation.x = -Math.PI / 2;
  sol.position.z = -LONG / 2 + 20;
  monde.add(sol);

  const matParoi = new THREE.MeshStandardMaterial({ color: PAROI, roughness: 0.93, metalness: 0.05, side: THREE.DoubleSide });
  for (const c of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(LONG + 80, PLAFOND), matParoi);
    m.rotation.y = c * Math.PI / 2;
    m.position.set(c * DEMI_L, PLAFOND / 2, -LONG / 2 + 20);
    monde.add(m);
  }
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(DEMI_L * 2, LONG + 80), matParoi);
  pf.rotation.x = Math.PI / 2;
  pf.position.set(0, PLAFOND, -LONG / 2 + 20);
  monde.add(pf);

  // la rampe du plafond, et sa nappe au sol
  const rampe = new THREE.Mesh(new THREE.PlaneGeometry(0.44, LONG + 80),
    new THREE.MeshBasicMaterial({ color: 0xe2edfa }));
  rampe.rotation.x = Math.PI / 2;
  rampe.position.set(0, PLAFOND - 0.02, -LONG / 2 + 20);
  monde.add(rampe);

  const nappe = new THREE.Mesh(new THREE.PlaneGeometry(2.8, LONG + 80),
    new THREE.MeshBasicMaterial({ color: 0x9fc0e0, transparent: true, opacity: 0.075 }));
  nappe.rotation.x = -Math.PI / 2;
  nappe.position.set(0, 0.012, -LONG / 2 + 20);
  monde.add(nappe);

  // ═══════════ lumière ═══════════
  monde.add(new THREE.AmbientLight(0x6c819c, 1.15));
  monde.add(new THREE.HemisphereLight(0x9db4cf, 0x0a0e14, 0.75));
  const lampes = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight(0xdae8f8, 55, 48, 2);
    monde.add(l); lampes.push(l);
  }
  const braise = new THREE.PointLight(ROUGE, 9, 24, 2);
  monde.add(braise);

  // ═══════════ marques de mesure au sol ═══════════
  const matTrait = new THREE.MeshBasicMaterial({ color: 0x2b3642, transparent: true, opacity: 0.8 });
  const geoTrait = new THREE.PlaneGeometry(DEMI_L * 2 - 1.6, 0.035);
  for (let z = 12; z > -LONG; z -= 6.5) {
    const t = new THREE.Mesh(geoTrait, matTrait);
    t.rotation.x = -Math.PI / 2; t.position.set(0, 0.006, z);
    monde.add(t);
  }

  // ═══════════ plaques peintes ═══════════
  function couper(g, texte, max) {
    const mots = String(texte).split(' '); const out = []; let l = '';
    for (const m of mots) {
      const e = l ? l + ' ' + m : m;
      if (g.measureText(e).width > max) { out.push(l); l = m; } else l = e;
    }
    if (l) out.push(l);
    return out;
  }

  function plaque(lignes, larg, haut, ech = 1) {
    const S = 1100;
    const c = document.createElement('canvas');
    c.height = S; c.width = Math.round(S * (larg / haut));
    const g = c.getContext('2d');
    g.fillStyle = '#0d1219'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(190,210,230,.20)'; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
    g.fillStyle = '#d42a1b'; g.fillRect(0, 0, c.width, 8);
    g.textBaseline = 'alphabetic';
    let y = 112;
    for (const l of lignes) {
      if (l.t === 'lbl') {
        g.font = `500 ${28*ech}px "IBM Plex Mono", monospace`; g.fillStyle = '#ff4433';
        g.letterSpacing = `${8*ech}px`; g.fillText(String(l.v).toUpperCase(), 64, y); y += 70*ech;
      } else if (l.t === 'titre') {
        g.font = `${86*ech}px Anton, sans-serif`; g.fillStyle = '#ffffff';
        g.letterSpacing = '1px'; g.fillText(l.v, 64, y); y += 94*ech;
      } else if (l.t === 'sous') {
        g.font = `500 ${30*ech}px "IBM Plex Mono", monospace`; g.fillStyle = '#a9b7c6';
        g.letterSpacing = `${6*ech}px`; g.fillText(String(l.v).toUpperCase(), 64, y); y += 60*ech;
      } else if (l.t === 'vide') {
        y += l.v || 30;
      } else {
        g.font = `300 ${34*ech}px "IBM Plex Sans", sans-serif`;
        g.fillStyle = 'rgba(226,236,246,.70)'; g.letterSpacing = '0px';
        for (const li of couper(g, l.v, c.width - 128)) { g.fillText(li, 64, y); y += 48*ech; }
        y += 14;
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const a = acier();
    const face = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.82, metalness: 0.06,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.62
    });
    return new THREE.Mesh(new THREE.BoxGeometry(larg, haut, 0.09), [a, a, a, a, face, a]);
  }

  // ═══════════ zone 01 — l'entrée ═══════════
  const entree = plaque([
    { t: 'lbl',   v: 'Soufflerie · zone 01' },
    { t: 'titre', v: 'JAURYS' },
    { t: 'titre', v: 'MAIGRET' },
    { t: 'sous',  v: 'Direction artistique · Paris' },
    { t: 'vide',  v: 24 },
    { t: 'p',     v: "Vous êtes dans la veine d'essai. Les pièces sont montées de part et d'autre, chacune sur son socle. Avancez : le flux vous porte." }
  ], 7.2, 4.3, 1.55);
  entree.position.set(0, 2.45, -7);
  monde.add(entree);
  // les deux pieds du totem
  for (const c of [-1, 1]) {
    const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 12), acier());
    pied.position.set(c * 2.6, 0.3, -7);
    monde.add(pied);
  }
  const sEntree = new THREE.SpotLight(0xe8f1fb, 60, 24, 0.7, 0.6, 1.5);
  sEntree.position.set(0, PLAFOND - 0.7, -2.2);
  sEntree.target.position.set(0, 2.45, -7);
  monde.add(sEntree); monde.add(sEntree.target);

  // ═══════════ zone 02 — les montages ═══════════
  const chargeur = new THREE.TextureLoader();
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const cibles = [];
  const veilleuses = [];

  pieces.forEach((p, i) => {
    const cote = i % 2 ? 1 : -1;
    const z = -24 - i * PAS;
    const H = p.h > p.w ? 3.0 : 2.4;
    const L = H * (p.w / p.h);

    const g = new THREE.Group();
    g.position.set(cote * (DEMI_L - 1.45), 0, z);
    g.rotation.y = -cote * (Math.PI / 2 - 0.24);
    monde.add(g);

    const socle = new THREE.Mesh(new THREE.BoxGeometry(L + 0.5, 0.12, 0.72), acier());
    socle.position.y = 0.06;
    g.add(socle);

    const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.074, 1.12, 12), acier());
    mat.position.y = 0.68;
    g.add(mat);

    const tex = chargeur.load(p.src);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
    const bord = acier();
    const tab = new THREE.Mesh(new THREE.BoxGeometry(L, H, 0.07),
      [bord, bord, bord, bord,
       new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05 }), bord]);
    tab.position.y = 1.24 + H / 2;
    tab.userData = { p, i, y0: tab.position.y, k: 0, cible: 0, groupe: g };
    g.add(tab);
    cibles.push(tab);

    // le numéro au sol
    const nc = document.createElement('canvas'); nc.width = nc.height = 256;
    const gn = nc.getContext('2d');
    gn.font = '700 148px "IBM Plex Mono", monospace';
    gn.fillStyle = 'rgba(190,210,230,.32)'; gn.textAlign = 'center';
    gn.fillText(String(i + 1).padStart(2, '0'), 128, 178);
    const tn = new THREE.CanvasTexture(nc); tn.colorSpace = THREE.SRGBColorSpace;
    const num = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({ map: tn, transparent: true, depthWrite: false }));
    num.rotation.x = -Math.PI / 2;
    num.rotation.z = cote > 0 ? Math.PI / 2 : -Math.PI / 2;
    num.position.set(cote * (DEMI_L - 3.4), 0.015, z);
    monde.add(num);

    // la nappe d'ombre, a la place d'une vraie ombre portee
    const ombre = new THREE.Mesh(
      new THREE.PlaneGeometry(L + 1.6, 1.9),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })
    );
    ombre.rotation.x = -Math.PI / 2;
    ombre.position.set(0, 0.004, 0.1);
    g.add(ombre);

    const spot = new THREE.SpotLight(0xe8f1fb, 26, 13, 0.62, 0.6, 1.7);
    spot.position.set(cote * (DEMI_L - 2.5), PLAFOND - 0.85, z + 0.5);
    spot.target.position.set(cote * (DEMI_L - 1.2), 2.5, z);
    spot.visible = false;            // allume seulement a l'approche
    spot.userData.z = z;
    monde.add(spot); monde.add(spot.target);
    veilleuses.push(spot);
  });

  const Z_PIECES_FIN = -24 - (pieces.length - 1) * PAS;

  // ═══════════ zone 03 — le parcours ═══════════
  const Z_PARCOURS = Z_PIECES_FIN - 17;
  const panneaux = [
    { cote: -1, l: [
      { t: 'lbl', v: 'Zone 03 · le parcours' },
      { t: 'titre', v: 'Expériences' },
      { t: 'vide', v: 18 },
      { t: 'sous', v: 'Talon Pointe · 2025 — 2026' },
      { t: 'p', v: "Chargé de communication, en alternance. Contenu photo et vidéo pour une concession de véhicules de luxe, montage et post-production, réseaux sociaux, storytelling de marque." },
      { t: 'sous', v: 'AGCO · 2024' },
      { t: 'p', v: "Contenu social media pour un groupe à dimension mondiale. Newsletters, retouche, analyse de performance." },
      { t: 'sous', v: 'Tredelec · 2024' },
      { t: 'p', v: "Contenu publicitaire, animation des comptes, développement d'idées créatives." }
    ]},
    { cote: 1, l: [
      { t: 'lbl', v: 'Zone 03 · le parcours' },
      { t: 'titre', v: 'Formation' },
      { t: 'vide', v: 18 },
      { t: 'sous', v: '2026 · Master Direction Artistique' },
      { t: 'p', v: "ESP Paris, en alternance. Direction artistique, stratégie créative, brand design, typographie." },
      { t: 'sous', v: '2025 · Bachelor Création Publicitaire' },
      { t: 'p', v: "ESP Paris. Création publicitaire, graphisme, suite Adobe." },
      { t: 'sous', v: '2023 · BTS Communication' },
      { t: 'p', v: "Amiens. Communication, stratégie digitale, production de contenu." },
      { t: 'vide', v: 10 },
      { t: 'sous', v: 'Photoshop · Illustrator · InDesign' },
      { t: 'sous', v: 'Premiere · After Effects · Lightroom' }
    ]}
  ];
  panneaux.forEach((pn, i) => {
    const m = plaque(pn.l, 5.0, 3.6);
    m.position.set(pn.cote * (DEMI_L - 0.6), 2.5, Z_PARCOURS - i * 7);
    m.rotation.y = -pn.cote * (Math.PI / 2 - 0.16);
    monde.add(m);
    const sp = new THREE.SpotLight(0xdfeaf7, 26, 14, 0.68, 0.6, 1.6);
    sp.position.set(pn.cote * (DEMI_L - 2.2), PLAFOND - 0.8, Z_PARCOURS - i * 7 + 1);
    sp.target.position.set(pn.cote * (DEMI_L - 0.6), 2.5, Z_PARCOURS - i * 7);
    monde.add(sp); monde.add(sp.target);
  });

  // ═══════════ zone 04 — contact, le fond du hall ═══════════
  const Z_FOND = Z_PARCOURS - 26;
  const fond = new THREE.Mesh(new THREE.PlaneGeometry(DEMI_L * 2, PLAFOND), matParoi);
  fond.position.set(0, PLAFOND / 2, Z_FOND - 3);
  monde.add(fond);

  const contact = plaque([
    { t: 'lbl', v: 'Zone 04 · contact' },
    { t: 'titre', v: 'Parlons de' },
    { t: 'titre', v: 'votre projet.' },
    { t: 'vide', v: 20 },
    { t: 'sous', v: 'maigretjaurys8@gmail.com' },
    { t: 'sous', v: '06 09 97 74 01' },
    { t: 'sous', v: 'Paris & Île-de-France' },
    { t: 'vide', v: 16 },
    { t: 'p', v: "Disponible dès maintenant pour une alternance en direction artistique." }
  ], 7.0, 4.2);
  contact.position.set(0, 2.6, Z_FOND - 2.9);
  monde.add(contact);
  const sFond = new THREE.SpotLight(0xe8f1fb, 40, 22, 0.66, 0.6, 1.5);
  sFond.position.set(0, PLAFOND - 0.6, Z_FOND + 4);
  sFond.target.position.set(0, 2.6, Z_FOND - 2.9);
  monde.add(sFond); monde.add(sFond.target);
  braise.position.set(0, 1.4, Z_FOND + 2);

  // ═══════════ déplacement : le flux ═══════════
  const pos = new THREE.Vector3(0, OEIL, 8.5);
  const vit = new THREE.Vector3();
  let lacet = 0, tangage = 0;        // 0 = on regarde vers le fond du hall
  const bas = new Set();
  let vol = null;
  const joy = { actif: false, x: 0, y: 0 };

  const ZONES = [
    { n: '01', t: 'Entrée',      z: 8.5 },
    { n: '02', t: 'Les pièces',  z: -24 },
    { n: '03', t: 'Le parcours', z: Z_PARCOURS + 4 },
    { n: '04', t: 'Contact',     z: Z_FOND + 7 }
  ];

  const elZN = document.getElementById('zoneN');
  const elZT = document.getElementById('zoneT');
  const elX  = document.getElementById('coordX');
  const elZ  = document.getElementById('coordZ');
  const elCT = document.getElementById('cartelT');
  const elCC = document.getElementById('cartelC');

  // ── souris : regard ──
  let verrou = false;
  cv.addEventListener('click', () => {
    if (vise) { ouvrir(vise); return; }
    if (!verrou && cv.requestPointerLock) cv.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => { verrou = document.pointerLockElement === cv; });
  document.addEventListener('mousemove', e => {
    if (!verrou) return;
    lacet   -= e.movementX * 0.0022;
    tangage -= e.movementY * 0.0019;
    tangage = Math.max(-1.1, Math.min(1.1, tangage));
  });
  // sans verrou : le regard suit doucement le curseur, on n'est jamais bloqué
  let sx = 0, sy = 0;
  addEventListener('pointermove', e => {
    if (verrou) return;
    sx = (e.clientX / innerWidth) * 2 - 1;
    sy = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  // ── clavier ──
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    bas.add(k);
    if (k === 'r') allerA(0);
    if (k === 'escape' && document.exitPointerLock) document.exitPointerLock();
    if (['z','q','s','d','w','a','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', e => bas.delete(e.key.toLowerCase()));
  addEventListener('blur', () => bas.clear());

  // ── manette tactile ──
  const man = document.getElementById('manette');
  const manP = document.getElementById('manetteP');
  if (man) {
    const rayonMan = 44;
    const prendre = e => {
      const t = e.touches ? e.touches[0] : e;
      const r = man.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width / 2);
      let dy = t.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / rayonMan);
      joy.x = (dx / d) * k; joy.y = (dy / d) * k; joy.actif = true;
      manP.style.transform = `translate(${joy.x * rayonMan}px,${joy.y * rayonMan}px)`;
    };
    man.addEventListener('touchstart', e => { e.preventDefault(); prendre(e); }, { passive: false });
    man.addEventListener('touchmove',  e => { e.preventDefault(); prendre(e); }, { passive: false });
    man.addEventListener('touchend',   () => { joy.actif = false; joy.x = joy.y = 0; manP.style.transform = ''; });
    // le reste de l'écran oriente la caméra
    addEventListener('touchmove', e => {
      if (joy.actif) return;
      const t = e.touches[0];
      if (tPrec) { lacet -= (t.clientX - tPrec.x) * 0.004; tangage -= (t.clientY - tPrec.y) * 0.003;
        tangage = Math.max(-1, Math.min(1, tangage)); }
      tPrec = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    addEventListener('touchend', () => { tPrec = null; });
  }
  let tPrec = null;

  // ── menu : approche automatique ──
  function allerA(i) {
    const z = ZONES[i].z;
    vol = { t: 0, de: pos.clone(), vers: new THREE.Vector3(0, OEIL, z),
            lacetDe: lacet, lacetVers: 0 };
  }
  document.querySelectorAll('#menu button[data-zone]').forEach(b => {
    b.addEventListener('click', () => { allerA(+b.dataset.zone); b.blur(); });
  });

  // ── viser une pièce ──
  const rayon = new THREE.Raycaster();
  const centre = new THREE.Vector2(0, 0);
  let vise = null;

  function ouvrir(tab) {
    const p = tab.userData.p;
    const cible = p.groupe ? 'index.html#p-' + p.groupe : 'index.html#portfolio';
    location.href = cible;
  }

  // ═══════════ boucle ═══════════
  function dimensionner() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  addEventListener('resize', dimensionner); dimensionner();

  const AV = new THREE.Vector3(), LAT = new THREE.Vector3();
  let dernier = performance.now();

  function boucle(t) {
    requestAnimationFrame(boucle);
    const dt = Math.min((t - dernier) / 1000, 0.05); dernier = t;

    // approche automatique
    if (vol) {
      vol.t = Math.min(1, vol.t + dt / 1.5);
      const e = vol.t < 0.5 ? 4 * vol.t ** 3 : 1 - Math.pow(-2 * vol.t + 2, 3) / 2;
      pos.lerpVectors(vol.de, vol.vers, e);
      lacet = vol.lacetDe + (vol.lacetVers - vol.lacetDe) * e;
      if (vol.t >= 1) vol = null;
    } else {
      // le flux : ZQSD règle le régime, l'inertie fait le reste
      let av = 0, lat = 0;
      if (bas.has('z') || bas.has('w') || bas.has('arrowup')) av += 1;
      if (bas.has('s') || bas.has('arrowdown')) av -= 1;
      if (bas.has('q') || bas.has('a') || bas.has('arrowleft')) lat -= 1;
      if (bas.has('d') || bas.has('arrowright')) lat += 1;
      if (joy.actif) { av -= joy.y; lat += joy.x; }

      AV.set(-Math.sin(lacet), 0, -Math.cos(lacet));
      LAT.set(Math.cos(lacet), 0, -Math.sin(lacet));
      const pousse = bas.has('shift') ? 42 : 26;
      vit.addScaledVector(AV, av * pousse * dt);
      vit.addScaledVector(LAT, lat * pousse * dt);
      // la soufflerie souffle toujours un peu vers le fond
      vit.z -= 0.9 * dt;
      vit.multiplyScalar(Math.pow(0.0016, dt));   // traînée
      pos.addScaledVector(vit, dt);

      // on reste dans la veine
      pos.x = Math.max(-DEMI_L + 1.1, Math.min(DEMI_L - 1.1, pos.x));
      pos.z = Math.max(Z_FOND + 2.4, Math.min(11, pos.z));
      pos.y = OEIL;
    }

    if (!verrou) {
      lacet   += ((-sx * 0.85) - lacet) * 0.055;
      tangage += (-sy * 0.3 - tangage) * 0.055;
    }

    cam.position.copy(pos);
    cam.rotation.set(0, 0, 0, 'YXZ');
    cam.rotation.y = lacet; cam.rotation.x = tangage;

    // seules les veilleuses proches sont allumees : quatre lumieres au plus
    for (const v of veilleuses) {
      const d = Math.abs(v.userData.z - pos.z);
      const on = d < 26;
      if (v.visible !== on) v.visible = on;
    }

    // les lampes suivent
    lampes[0].position.set(pos.x * 0.4, PLAFOND - 1.2, pos.z + 4);
    lampes[1].position.set(pos.x * 0.4, PLAFOND - 1.2, pos.z - 10);
    lampes[2].position.set(pos.x * 0.4, 1.4, pos.z - 2);
    lampes[2].intensity = 12;

    // visée
    rayon.setFromCamera(centre, cam);
    const touche = rayon.intersectObjects(cibles, false);
    const n = (touche.length && touche[0].distance < 17) ? touche[0].object : null;
    if (n !== vise) {
      vise = n;
      cibles.forEach(c => c.userData.cible = (c === vise ? 1 : 0));
      document.body.classList.toggle('vise', !!vise);
      if (vise) { elCT.textContent = vise.userData.p.titre || ''; elCC.textContent = vise.userData.p.cat || ''; }
    }
    for (const c of cibles) {
      const u = c.userData;
      u.k += (u.cible - u.k) * Math.min(1, dt * 7);
      c.position.y = u.y0 + u.k * 0.075;
      c.rotation.z = u.k * 0.012;
    }

    // instruments
    const vz = -pos.z;
    elX.textContent = (pos.x >= 0 ? '+' : '−') + Math.abs(pos.x).toFixed(1).padStart(4, '0');
    elZ.textContent = (vz >= 0 ? '' : '−') + Math.abs(vz).toFixed(1).padStart(5, '0') + ' m';
    let zi = 0;
    for (let i = 0; i < ZONES.length; i++) if (pos.z <= ZONES[i].z + 6) zi = i;
    if (elZT.textContent !== ZONES[zi].t) { elZN.textContent = 'Zone ' + ZONES[zi].n; elZT.textContent = ZONES[zi].t; }
    document.querySelectorAll('#menu button[data-zone]').forEach((b, i) => b.classList.toggle('ici', i === zi));

    renderer.render(monde, cam);
  }
  requestAnimationFrame(boucle);

  return { pieces: pieces.length };
}
