// ═══════════════════════════════════════════════════════════════════════
// LA SOUFFLERIE — le monde de Jaurys Maigret
//
// Un hall d'essai. On n'y marche pas : le flux vous porte, et ZQSD règle
// le régime. Les pièces ne sont pas accrochées à un mur — elles sont
// MONTÉES dans la veine, chacune sur son socle, son numéro peint au sol,
// sa veilleuse braquée dessus. Le reste est noir.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/addons/environments/RoomEnvironment.js';

const NOIR    = 0x040405;
const SOL     = 0x17171a;
const PAROI   = 0x3b3835;
const ACIER   = 0x2c2c31;
const ROUGE   = 0xd42a1b;

const DEMI_L  = 7.4;
const PLAFOND = 6.2;
const OEIL    = 1.68;
const PAS     = 9.5;      // on resserre : le hall etait interminable

// le son, s'il est demande : synthetise, jamais charge
let SON = null;
function bruitage(nom) { if (SON && SON.estActif()) SON.son[nom](); }

export async function demarrer() {
  const cv = document.getElementById('veine');

  (function brancherSon() {
    const btn = document.getElementById('son');
    if (!btn) return;
    let on = false;
    const etat = v => { on = v; btn.setAttribute('aria-pressed', v ? 'true' : 'false');
      try { localStorage.setItem('jm-son', v ? '1' : '0'); } catch (e) {} };
    const charger = () => import('./son.js?v=5').then(m => { SON = m; m.allumer(); etat(true); m.son.tension(); });
    btn.addEventListener('click', () => {
      if (!SON) return charger();
      if (on) { SON.eteindre(); etat(false); } else { SON.allumer(); etat(true); SON.son.tic(); }
    });
    let voulu = false;
    try { voulu = localStorage.getItem('jm-son') === '1'; } catch (e) {}
    if (voulu) {
      const reveil = () => { document.removeEventListener('pointerdown', reveil);
        document.removeEventListener('keydown', reveil);
        import('./son.js?v=5').then(m => { SON = m; m.allumer(); etat(true); }); };
      document.addEventListener('pointerdown', reveil, { once: true });
      document.addEventListener('keydown', reveil, { once: true });
    }
  })();

  // ── la salle bat avec la musique ──
  // les halos des projecteurs respirent sur chaque temps, un peu plus sur le premier
  let pouls = 0;
  (function () {
    const racine = document.documentElement;
    const barres = document.querySelectorAll('#son .son-onde i');
    let dernier = 0;
    const sobre = matchMedia('(prefers-reduced-motion:reduce)').matches;
    addEventListener('jm-temps', e => {
      dernier = Date.now(); racine.classList.add('musique');
      if (sobre) return;
      const fort = e.detail.temps === 0;
      pouls = fort ? 1 : 0.6;
      barres.forEach((i, k) => {
        i.style.transition = 'none'; i.style.height = (4 + Math.random() * (fort ? 7 : 5) + (k === 1 || k === 2 ? 2 : 0)) + 'px';
        requestAnimationFrame(() => requestAnimationFrame(() => { i.style.transition = 'height .5s cubic-bezier(.2,.8,.3,1)'; i.style.height = '3px'; }));
      });
    });
    setInterval(() => { if (Date.now() - dernier > 1600) racine.classList.remove('musique'); }, 800);
  })();

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // De vraies ombres portees : les cadres en jettent sur le mur, les bancs
  // sur le sol. C'est ce qui fait qu'on croit a la salle. Sur telephone on
  // s'en passe, pour garder la fluidite.
  const PETIT = matchMedia('(pointer:coarse)').matches;
  renderer.shadowMap.enabled = !PETIT;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const monde = new THREE.Scene();
  monde.background = new THREE.Color(NOIR);
  monde.fog = new THREE.FogExp2(0x0a0a0a, 0.0095);
  // un champ de vision humain : a 64 degres on se croyait dans un jeu
  const cam = new THREE.PerspectiveCamera(56, 1, 0.1, 400);
  // un environnement doux pour que les metaux et le sol aient de vrais reflets
  const pmrem = new THREE.PMREMGenerator(renderer);
  monde.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  monde.environmentIntensity = 0.16;

  // Toutes les pieces servent aux fiches ; seule la piece principale de
  // chaque projet est accrochee. Un projet = une oeuvre au mur.
  const pieces = await fetch('data/pieces.json').then(r => r.json());
  const expos = pieces.filter(p => !p.secondaire);
  const LONG = 60 + expos.length * PAS;
  const MILIEU = -LONG / 2 + 20, ETENDUE = LONG + 80;

  const acier = () => new THREE.MeshStandardMaterial({ color: ACIER, roughness: 0.42, metalness: 0.62 });

  // petites toiles peintes une fois : halos, faisceaux, fondus
  function toile(w, h, peindre, lin) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    peindre(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (!lin) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const texHalo = toile(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.62)');
    r.addColorStop(0.62, 'rgba(255,255,255,.16)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const texDegrade = toile(4, 256, (g, w, h) => {   // fort en haut, nul en bas
    const l = g.createLinearGradient(0, 0, 0, h);
    l.addColorStop(0, 'rgba(255,255,255,1)'); l.addColorStop(0.22, 'rgba(255,255,255,.42)');
    l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l; g.fillRect(0, 0, w, h);
  });
  const texFondu = toile(4, 256, (g, w, h) => {     // masque des reflets (canal vert)
    const l = g.createLinearGradient(0, 0, 0, h);
    l.addColorStop(0, '#fff'); l.addColorStop(0.45, '#333'); l.addColorStop(1, '#000');
    g.fillStyle = l; g.fillRect(0, 0, w, h);
  }, true);
  const additif = (map, color, opacity) => new THREE.MeshBasicMaterial({
    map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  // ═══════════ les matieres ═══════════
  // Tout est peint ici, sur des toiles : pas de fichier a charger.
  // Un bruit fractal sert a tout : beton du sol, enduit des murs.
  function bruitFractal(w, h, octaves, graine) {
    const out = new Float32Array(w * h);
    let amp = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
      const cell = Math.max(2, Math.floor(w / Math.pow(2, o + 2)));
      const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
      const grille = new Float32Array(gw * gh);
      for (let k = 0; k < grille.length; k++) { const x = Math.sin((k + 1) * (graine + o * 13.37) * 12.9898) * 43758.5453; grille[k] = x - Math.floor(x); }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = grille[y0 * gw + x0], b = grille[y0 * gw + x0 + 1], c = grille[(y0 + 1) * gw + x0], d = grille[(y0 + 1) * gw + x0 + 1];
        out[y * w + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
      total += amp; amp *= 0.55;
    }
    for (let k = 0; k < out.length; k++) out[k] /= total;
    return out;
  }
  function texBruit(w, h, peindre, lin) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); const img = g.createImageData(w, h);
    peindre(img.data, w, h); g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (!lin) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  // le beton cire : nuages sombres, grain fin, et les joints de sciage
  const nBeton = bruitFractal(512, 512, 6, 3.1);
  const texBeton = texBruit(512, 512, (d, w, h) => {
    for (let k = 0; k < w * h; k++) {
      const x = k % w, y = (k / w) | 0;
      const grain = (Math.sin(k * 91.7) * 43758.5453) % 1;
      let v = 20 + nBeton[k] * 22 + Math.abs(grain) * 5;
      if (x < 1 || y < 1) v *= 0.7;                     // le joint, tous les quatre metres
      d[k * 4] = v * 1.02; d[k * 4 + 1] = v; d[k * 4 + 2] = v * 0.97; d[k * 4 + 3] = 255;
    }
  });
  const texBetonR = texBruit(512, 512, (d, w, h) => {
    for (let k = 0; k < w * h; k++) {
      const x = k % w, y = (k / w) | 0;
      let v = 95 + nBeton[(k * 7) % (w * h)] * 55;      // un cire legerement inegal
      if (x < 1 || y < 1) v = 200;
      d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255;
    }
  }, true);
  // l'enduit des murs : un relief a peine perceptible
  const nEnduit = bruitFractal(256, 256, 5, 7.7);
  const texEnduit = texBruit(256, 256, (d, w, h) => {
    for (let k = 0; k < w * h; k++) { const v = 110 + nEnduit[k] * 90 + ((Math.sin(k * 12.7) * 43758.5) % 1) * 14;
      d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true);
  // l'ombre des angles : la ou deux surfaces se rencontrent, la lumiere entre moins
  const texAngle = toile(4, 256, (g, w, h) => {
    const l = g.createLinearGradient(0, 0, 0, h);
    l.addColorStop(0, 'rgba(0,0,0,1)'); l.addColorStop(0.35, 'rgba(0,0,0,.45)'); l.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = l; g.fillRect(0, 0, w, h);
  });
  const matAngle = (op) => new THREE.MeshBasicMaterial({ map: texAngle, transparent: true, opacity: op, depthWrite: false, fog: true });
  function angle(larg, haut, op) { const m = new THREE.Mesh(new THREE.PlaneGeometry(larg, haut), matAngle(op)); m.renderOrder = 3; return m; }

  // ═══════════ la salle ═══════════
  // Le sol est un beton cire, legerement transparent : sous lui, les oeuvres
  // sont recopiees a l'envers, floues et sombres. C'est le reflet.
  texBeton.repeat.set(DEMI_L * 2 / 4, ETENDUE / 4);
  texBetonR.repeat.copy(texBeton.repeat);
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(DEMI_L * 2, ETENDUE),
    new THREE.MeshStandardMaterial({ map: texBeton, roughnessMap: texBetonR, roughness: 1, metalness: 0,
      transparent: true, opacity: 0.9 })
  );
  sol.rotation.x = -Math.PI / 2;
  sol.position.z = MILIEU;
  sol.renderOrder = 2;
  sol.receiveShadow = true;
  monde.add(sol);

  texEnduit.repeat.set(ETENDUE / 3, PLAFOND / 3);
  const matParoi = new THREE.MeshStandardMaterial({ color: PAROI, roughness: 0.94, metalness: 0,
    bumpMap: texEnduit, bumpScale: 0.6 });
  for (const c of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ETENDUE, PLAFOND), matParoi);
    m.rotation.y = -c * Math.PI / 2;          // face tournee vers l'allee
    m.position.set(c * DEMI_L, PLAFOND / 2, MILIEU);
    m.receiveShadow = true;
    monde.add(m);

    // les ombres des angles : pied de mur, haut de mur, bord du sol, bord du plafond
    const a1 = angle(ETENDUE, 0.9, 0.5);  a1.rotation.y = -c * Math.PI / 2; a1.rotation.z = Math.PI;
    a1.position.set(c * (DEMI_L - 0.01), 0.45, MILIEU); monde.add(a1);
    const a2 = angle(ETENDUE, 1.2, 0.55); a2.rotation.y = -c * Math.PI / 2;
    a2.position.set(c * (DEMI_L - 0.01), PLAFOND - 0.6, MILIEU); monde.add(a2);
    const a3 = angle(1.3, ETENDUE, 0.55); a3.rotation.x = -Math.PI / 2; a3.rotation.z = -c * Math.PI / 2;
    a3.position.set(c * (DEMI_L - 0.65), 0.004, MILIEU); monde.add(a3);
    const a4 = angle(1.6, ETENDUE, 0.7);  a4.rotation.x = Math.PI / 2; a4.rotation.z = -c * Math.PI / 2;
    a4.position.set(c * (DEMI_L - 0.8), PLAFOND - 0.005, MILIEU); monde.add(a4);

    // la plinthe, sombre et mate
    const plinthe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, ETENDUE),
      new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.55, metalness: 0.1 }));
    plinthe.position.set(c * (DEMI_L - 0.015), 0.06, MILIEU);
    monde.add(plinthe);
    // le rail des projecteurs
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, ETENDUE),
      new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.35, metalness: 0.8 }));
    rail.position.set(c * (DEMI_L - 2.3), PLAFOND - 0.03, MILIEU);
    monde.add(rail);
  }
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(DEMI_L * 2, ETENDUE),
    new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.96, side: THREE.DoubleSide }));
  pf.rotation.x = Math.PI / 2;
  pf.position.set(0, PLAFOND, MILIEU);
  monde.add(pf);

  // ═══════════ lumière ═══════════
  // Peu d'ambiance : comme dans une vraie salle, ce sont les projecteurs qui
  // eclairent. Trois lumieres douces accompagnent le visiteur pour qu'on
  // devine toujours les murs.
  monde.add(new THREE.AmbientLight(0xc8beb2, 0.55));
  monde.add(new THREE.HemisphereLight(0xe8dccb, 0x0e0e10, 0.42));
  const lampes = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight(0xffe6cc, 16, 26, 2);
    monde.add(l); lampes.push(l);
  }
  const braise = new THREE.PointLight(ROUGE, 9, 24, 2);
  monde.add(braise);

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

  // Le texte s'ajuste a la plaque : on mesure d'abord la hauteur qu'il prend a
  // l'echelle 1, puis on choisit l'echelle pour qu'il occupe la plaque. Sans
  // ca, une plaque large restait aux trois quarts vide.
  // Le texte des plaques etait pose avec des avances codees en dur : 70 px
  // apres un libelle, 94 apres un titre. Or un titre en Anton occupe environ
  // 71 px de capitales pour 70 d'avance : huit pixels de marge sur mille.
  // A la moindre variation de police, le libelle rouge et le titre se
  // telescopaient. On mesure maintenant chaque ligne pour de vrai.
  function reglage(t, e) {
    // ls est un ratio de la taille : l'interlettrage suit la reduction.
    if (t === 'lbl')   return { px: 28*e, fam: '"IBM Plex Mono", monospace', poids: '500 ',
                                c: '#ff4433',               ls: 0.286, maj: true,  ap: 30*e };
    if (t === 'titre') return { px: 86*e, fam: 'Anton, sans-serif',         poids: '',
                                c: '#ffffff',               ls: 0.012, maj: false, ap: 22*e };
    if (t === 'sous')  return { px: 30*e, fam: '"IBM Plex Mono", monospace', poids: '500 ',
                                c: '#a9b7c6',               ls: 0.2,   maj: true,  ap: 24*e };
    return             { px: 34*e, fam: '"IBM Plex Sans", sans-serif', poids: '300 ',
                                c: 'rgba(226,236,246,.70)', ls: 0,     maj: false, ap: 16*e };
  }
  function appliquer(g, r, px) {
    g.font = r.poids + px.toFixed(1) + 'px ' + r.fam;
    g.letterSpacing = (px * r.ls).toFixed(2) + 'px';
  }

  // Un seul parcours sert a deux choses : mesurer la hauteur reelle du bloc,
  // puis le dessiner. Les deux ne peuvent donc pas diverger.
  // Et aucune ligne ne sort de la plaque : les paragraphes se coupent, les
  // titres et les intitules se reduisent jusqu'a tenir. Avant, un intitule
  // trop long comme "2026 · MASTER DIRECTION ARTISTIQUE" etait simplement
  // tranche par le bord de la texture.
  function poser(g, lignes, e, largeurUtile, dessiner, marge) {
    let y = 44 * e;
    for (const l of lignes) {
      if (l.t === 'vide') { y += (l.v || 30) * e; continue; }
      const r = reglage(l.t, e);
      appliquer(g, r, r.px);
      const txt = r.maj ? String(l.v).toUpperCase() : l.v;
      const morceaux = (l.t === 'p') ? couper(g, txt, largeurUtile) : [txt];
      for (const m of morceaux) {
        let px = r.px;
        appliquer(g, r, px);
        const w = g.measureText(m).width;
        if (w > largeurUtile) { px = r.px * (largeurUtile / w); appliquer(g, r, px); }
        const me = g.measureText(m);
        const haut = me.actualBoundingBoxAscent  || px * 0.74;
        const bas  = me.actualBoundingBoxDescent || px * 0.2;
        y += haut;
        if (dessiner) { g.fillStyle = r.c; g.fillText(m, marge, y); }
        y += bas + r.ap * (px / r.px);
      }
    }
    return y;
  }

  function plaque(lignes, larg, haut, ech) {
    const S = 1100;
    const c = document.createElement('canvas');
    c.height = S; c.width = Math.round(S * (larg / haut));
    const g = c.getContext('2d');
    g.textBaseline = 'alphabetic';
    const marge = 64, utile = c.width - marge * 2;

    if (!ech) {
      // deux passes : la coupure des paragraphes depend de l'echelle, donc
      // une seule mesure se trompe des que le texte se reorganise.
      ech = Math.max(0.6, Math.min(3.2, (S * 0.88) / Math.max(1, poser(g, lignes, 1, utile, false, marge))));
      const h2 = poser(g, lignes, ech, utile, false, marge);
      if (h2 > S * 0.94) ech *= (S * 0.9) / h2;
    }

    g.fillStyle = '#0d1219'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(190,210,230,.20)'; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
    g.fillStyle = '#d42a1b'; g.fillRect(0, 0, c.width, 8);
    poser(g, lignes, ech, utile, true, marge);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const a = acier();
    const face = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.82, metalness: 0.06,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3
    });
    return new THREE.Mesh(new THREE.BoxGeometry(larg, haut, 0.09), [a, a, a, a, face, a]);
  }

  // Au fond du hall, le texte n'est pas sur une pancarte : il est peint sur
  // la paroi. Pas de cadre, pas de fond, pas de filet rouge — on arrive au
  // bout d'une veine d'essai, pas devant un panneau de plus.
  function lettrage(lignes, larg, haut) {
    const S = 900;
    const c = document.createElement('canvas');
    c.height = S; c.width = Math.round(S * (larg / haut));
    const g = c.getContext('2d');
    g.textBaseline = 'alphabetic';
    let y = 92;
    for (const l of lignes) {
      if (l.t === 'lbl') {
        g.font = '500 30px "IBM Plex Mono", monospace'; g.fillStyle = '#ff4433';
        g.letterSpacing = '10px'; g.fillText(String(l.v).toUpperCase(), 0, y); y += 86;
      } else if (l.t === 'titre') {
        g.font = '150px Anton, sans-serif'; g.fillStyle = '#ffffff';
        g.letterSpacing = '2px'; g.fillText(l.v, 0, y + 110); y += 158;
      } else {
        g.font = '500 34px "IBM Plex Mono", monospace'; g.fillStyle = '#a9b7c6';
        g.letterSpacing = '7px'; g.fillText(String(l.v).toUpperCase(), 0, y + 34); y += 62;
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    return new THREE.Mesh(new THREE.PlaneGeometry(larg, haut),
      new THREE.MeshStandardMaterial({
        map: tex, transparent: true, depthWrite: false, roughness: 0.9, metalness: 0,
        emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5
      }));
  }

  // Une plaque sur laquelle on peut AGIR. Jusqu'ici la fin du hall affichait
  // une adresse e-mail gravee dans une texture : illisible de loin, et
  // impossible a copier. Celles-ci repondent au clic et se redessinent.
  const actions = [];
  function plaqueAction(lbl, val, indice, larg, haut, faire) {
    const S = 512;
    const c = document.createElement('canvas');
    c.height = S; c.width = Math.round(S * (larg / haut));
    const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

    function peindre(valeur, bas, chaud) {
      g.fillStyle = chaud ? '#1b242f' : '#0d1219';
      g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = chaud ? 'rgba(255,68,51,.9)' : 'rgba(190,210,230,.22)';
      g.lineWidth = 5; g.strokeRect(2.5, 2.5, c.width - 5, c.height - 5);
      g.fillStyle = '#d42a1b'; g.fillRect(0, 0, c.width, 7);
      g.textBaseline = 'alphabetic';
      g.font = '500 30px "IBM Plex Mono", monospace';
      g.fillStyle = '#ff4433'; g.letterSpacing = '8px';
      g.fillText(String(lbl).toUpperCase(), 46, 112);
      // la valeur prend toute la largeur disponible : c'est elle qu'on vient lire
      let t = 62; g.letterSpacing = '1px';
      g.font = `600 ${t}px "IBM Plex Mono", monospace`;
      while (g.measureText(valeur).width > c.width - 92 && t > 20) {
        t -= 2; g.font = `600 ${t}px "IBM Plex Mono", monospace`;
      }
      g.fillStyle = chaud ? '#ffffff' : '#e8f0f8';
      g.fillText(valeur, 46, 250);
      g.font = '500 26px "IBM Plex Mono", monospace';
      g.fillStyle = chaud ? 'rgba(255,68,51,.95)' : 'rgba(169,183,198,.65)';
      g.letterSpacing = '6px';
      g.fillText(String(bas).toUpperCase(), 46, 420);
      tex.needsUpdate = true;
    }
    peindre(val, indice, false);

    const a = acier();
    const face = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.82, metalness: 0.06,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.62
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(larg, haut, 0.09), [a, a, a, a, face, a]);
    m.userData = {
      act: faire, lbl: lbl, val: val, indice: indice, k: 0, cible: 0,
      chaud: function (v) { peindre(m.userData.val, m.userData.indice, v); },
      dire: function (valeur, bas) {
        m.userData.val = valeur; m.userData.indice = bas; peindre(valeur, bas, true);
      }
    };
    actions.push(m);
    return m;
  }

  // En portrait, le champ horizontal est trois fois plus etroit qu'en
  // paysage : ce qui tient a l'ecran d'un cote ne tient pas de l'autre.
  const ETROIT = innerWidth < innerHeight;

  // ═══════════ zone 01 — l'entrée ═══════════
  const entree = plaque([
    { t: 'lbl',   v: 'Soufflerie · zone 01' },
    { t: 'titre', v: 'JAURYS' },
    { t: 'titre', v: 'MAIGRET' },
    { t: 'sous',  v: 'Direction artistique · Paris' },
    { t: 'vide',  v: 24 },
    { t: 'p',     v: "Bienvenue dans la galerie. Chaque projet est accroché sous sa lumière, avec son cartel. Avancez, approchez-vous, cliquez pour l'ouvrir." }
  ], 7.2, 4.3);
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

  // ═══════════ zone 02 — l'accrochage ═══════════
  const chargeur = new THREE.TextureLoader();
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const cibles = [];
  const oeuvres = [];               // pour les projecteurs : ou braquer la lumiere
  const HAUT_C = 2.7;               // hauteur du centre des oeuvres
  const BAS = new THREE.Vector3(0, -1, 0);

  const matCadre = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.32, metalness: 0.75 });
  const matPasse = new THREE.MeshStandardMaterial({ color: 0xebe6dc, roughness: 0.92, metalness: 0 });
  const matBoitier = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.35, metalness: 0.7 });
  const matBouche = new THREE.MeshBasicMaterial({ color: 0xfff4e6 });

  // le cartel : une petite carte blanche a cote de l'oeuvre, comme au musee
  function cartel(p, i) {
    const W = 760, H = 460;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#ece7dd'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';
    g.font = '500 30px "IBM Plex Mono", monospace'; g.letterSpacing = '6px';
    g.fillStyle = '#d42a1b'; g.fillText(String(i + 1).padStart(2, '0'), 52, 84);
    g.fillStyle = '#8a857c'; g.fillText((p.marque || 'Jaurys Maigret').toUpperCase(), 140, 84);
    g.letterSpacing = '0px';
    let t = 50; g.font = `600 ${t}px "IBM Plex Sans", sans-serif`;
    const titre = String(p.titre || '');
    const mots = titre.split(' '); const lignes = []; let l = '';
    for (const m of mots) { const e = l ? l + ' ' + m : m; if (g.measureText(e).width > W - 104) { lignes.push(l); l = m; } else l = e; }
    if (l) lignes.push(l);
    g.fillStyle = '#141417';
    lignes.slice(0, 3).forEach((ln, k) => g.fillText(ln, 52, 166 + k * 60));
    g.font = '500 24px "IBM Plex Mono", monospace'; g.letterSpacing = '4px';
    g.fillStyle = '#6f6a62';
    g.fillText(String(p.cat || '').toUpperCase().slice(0, 44), 52, H - 52);
    g.fillStyle = '#d42a1b'; g.fillRect(52, H - 30, 64, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    return new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.484), new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.9, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.28 }));
  }

  expos.forEach((p, i) => {
    const cote = i % 2 ? 1 : -1;
    const z = -24 - i * PAS;
    const H = p.h > p.w ? 3.05 : 2.3;
    const L = H * (p.w / p.h);
    const M = 0.13, C = 0.06;       // passe-partout, baguette

    // l'oeuvre est accrochee au mur, face a l'allee
    const g = new THREE.Group();
    g.position.set(cote * (DEMI_L - 0.02), 0, z);
    g.rotation.y = -cote * Math.PI / 2;
    monde.add(g);

    // le cadre se detache du mur de quelques centimetres : il porte son ombre
    const cadre = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * (M + C), H + 2 * (M + C), 0.05), matCadre);
    cadre.position.set(0, HAUT_C, 0.055);
    cadre.castShadow = true;
    g.add(cadre);
    const passe = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * M, H + 2 * M), matPasse);
    passe.position.set(0, HAUT_C, 0.0805);
    g.add(passe);

    let reflet = null;
    const tex = chargeur.load(p.src, () => { if (reflet) reflet.needsUpdate = true; });
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
    reflet = tex.clone(); reflet.repeat.set(1, -1); reflet.offset.set(0, 1);

    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 });
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(L, H), mat);
    tab.position.set(0, HAUT_C, 0.082);
    g.add(tab);

    // le halo du projecteur sur le mur, au-dessus et autour du cadre
    const halo = new THREE.Mesh(new THREE.PlaneGeometry((L + 1.2) * 1.75, (H + 1.2) * 1.6),
      additif(texHalo, 0xffd6a6, 0.12));
    halo.position.set(0, HAUT_C + 0.3, 0.01);
    halo.renderOrder = 3;
    g.add(halo);

    // son reflet dans la pierre polie
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(L, H), new THREE.MeshBasicMaterial({
      map: reflet, alphaMap: texFondu, transparent: true, opacity: 0.2, depthWrite: false }));
    refl.position.set(0, -HAUT_C, 0.084);
    refl.renderOrder = 1;
    g.add(refl);
    const reflHalo = new THREE.Mesh(new THREE.PlaneGeometry((L + 1.2) * 1.75, (H + 1.2) * 1.2),
      additif(texHalo, 0xffd6a6, 0.05));
    reflHalo.position.set(0, -HAUT_C, 0.01);
    reflHalo.renderOrder = 1;
    g.add(reflHalo);

    const ct = cartel(p, i);
    ct.position.set(L / 2 + M + C + 0.72, 1.58, 0.012);
    g.add(ct);

    tab.userData = { p, i, k: 0, cible: 0, groupe: g, mat, halo };
    cibles.push(tab);

    // le projecteur sur son rail
    const P = new THREE.Vector3(cote * (DEMI_L - 2.3), PLAFOND - 0.36, z + 0.25);
    const T = new THREE.Vector3(cote * (DEMI_L - 0.1), HAUT_C + 0.15, z);
    const dir = T.clone().sub(P).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(BAS, dir);
    const boitier = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.34, 18), matBoitier);
    boitier.position.copy(P).addScaledVector(dir, -0.1);
    boitier.quaternion.copy(q);
    monde.add(boitier);
    const bouche = new THREE.Mesh(new THREE.CircleGeometry(0.11, 18), matBouche);
    bouche.position.copy(P).addScaledVector(dir, 0.075);
    bouche.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    monde.add(bouche);
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), matBoitier);
    tige.position.set(P.x, PLAFOND - 0.17, P.z);
    monde.add(tige);

    oeuvres.push({ P, T, z, tab });
  });

  // L'architecture : des passages tous les trois projets decoupent l'allee
  // en salles, comme une enfilade de musee.
  const matArche = new THREE.MeshStandardMaterial({ color: PAROI, roughness: 0.94, metalness: 0 });
  for (let k = 2; k < expos.length - 1; k += 3) {
    const za = -24 - (k + 0.5) * PAS;
    for (const c of [-1, 1]) {
      const pilier = new THREE.Mesh(new THREE.BoxGeometry(0.9, PLAFOND, 0.8), matArche);
      pilier.position.set(c * (DEMI_L - 0.45), PLAFOND / 2, za);
      pilier.castShadow = true; pilier.receiveShadow = true;
      monde.add(pilier);
    }
    const linteau = new THREE.Mesh(new THREE.BoxGeometry(DEMI_L * 2, 0.7, 0.8), matArche);
    linteau.position.set(0, PLAFOND - 0.35, za);
    monde.add(linteau);
  }
  // Un banc au milieu de chaque salle : cuir sombre, pieds d'acier. On en
  // fait le tour, on ne le traverse pas.
  const bancs = [];
  const matCuir = new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.55, metalness: 0 });
  const matPied = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.3, metalness: 0.85 });
  for (let k = 1; k < expos.length - 1; k += 3) {
    const zb = -24 - k * PAS - PAS / 2;
    const b = new THREE.Group();
    const assise = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 2.4), matCuir);
    assise.position.y = 0.44; assise.castShadow = true; assise.receiveShadow = true;
    b.add(assise);
    const coussin = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 2.36), matCuir);
    coussin.position.y = 0.52; coussin.castShadow = true;
    b.add(coussin);
    for (const dx of [-0.24, 0.24]) for (const dz of [-1.0, 1.0]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.38, 0.035), matPied);
      pied.position.set(dx, 0.19, dz); pied.castShadow = true;
      b.add(pied);
    }
    for (const dz of [-1.0, 1.0]) {
      const traverse = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), matPied);
      traverse.position.set(0, 0.36, dz); b.add(traverse);
    }
    const ombre = angle(1.1, 2.9, 0.0);   // place pour une ombre douce meme sans projecteur
    ombre.material = new THREE.MeshBasicMaterial({ map: texHalo, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false });
    ombre.rotation.x = -Math.PI / 2; ombre.position.y = 0.005;
    b.add(ombre);
    b.position.set(0, 0, zb);
    monde.add(b);
    bancs.push({ x: 0, z: zb, dx: 0.31 + 0.45, dz: 1.2 + 0.45 });
  }

  // Quatre projecteurs reels seulement, deplaces vers les oeuvres les plus
  // proches : le nombre de lumieres ne change jamais, donc aucun shader a
  // recompiler en marchant (c'etait la cause des a-coups).
  const projecteurs = [];
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.SpotLight(0xffe2bd, 95, 16, 0.5, 0.55, 2);
    if (!PETIT) {
      sp.castShadow = true;
      sp.shadow.mapSize.set(1024, 1024);
      sp.shadow.bias = -0.0004; sp.shadow.normalBias = 0.02;
      sp.shadow.camera.near = 0.3; sp.shadow.camera.far = 14;
    }
    monde.add(sp); monde.add(sp.target);
    projecteurs.push(sp);
  }

  const Z_PIECES_FIN = -24 - (expos.length - 1) * PAS;

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
  const P_X = ETROIT ? 2.5 : 4.4;    // ecart a l'axe : la voie reste libre
  const P_L = ETROIT ? 3.4 : 5.4;    // largeur du panneau
  const P_H = ETROIT ? 4.2 : 3.7;    // en portrait, un panneau debout
  panneaux.forEach((pn, i) => {
    const z = Z_PARCOURS - i * 8;
    const x = pn.cote * P_X;
    const m = plaque(pn.l, P_L, P_H);
    m.position.set(x, 2.45, z);
    m.rotation.y = -pn.cote * 0.26;   // juste tourne vers l'axe, pas de profil
    monde.add(m);
    const sp = new THREE.SpotLight(0xdfeaf7, 30, 16, 0.7, 0.6, 1.6);
    sp.position.set(x * 0.5, PLAFOND - 0.8, z + 2.6);
    sp.target.position.set(x, 2.45, z);
    monde.add(sp); monde.add(sp.target);
    // un pied, comme le totem d'entree : le panneau est pose, pas accroche
    const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.62, 12), acier());
    pied.position.set(x, 0.31, z);
    monde.add(pied);
  });

  // ═══════════ zone 04 — contact, le fond du hall ═══════════
  const Z_FOND = Z_PARCOURS - 26;
  // le mur du fond a son propre enduit : celui des murs longs y serait etire
  const enduitFond = texEnduit.clone(); enduitFond.repeat.set(DEMI_L * 2 / 3, PLAFOND / 3); enduitFond.needsUpdate = true;
  const matFond = matParoi.clone(); matFond.bumpMap = enduitFond;
  const fond = new THREE.Mesh(new THREE.PlaneGeometry(DEMI_L * 2, PLAFOND), matFond);
  fond.receiveShadow = true;
  fond.position.set(0, PLAFOND / 2, Z_FOND - 3);
  monde.add(fond);

  // On arrive au bout apres pres de 200 metres. Ce qui attendait ici, c'etait
  // une adresse e-mail gravee dans une texture : trop petite pour etre lue,
  // impossible a copier, et aucun moyen de repartir. Maintenant le titre est
  // peint a meme la paroi, et les trois plaques en dessous FONT quelque chose.
  // En portrait, trois plaques cote a cote debordent de l'ecran : on les
  // empile. Le telephone lit une colonne, pas une frise.
  const titreFin = lettrage([
    { t: 'lbl',   v: 'Zone 04 · la sortie' },
    { t: 'titre', v: 'Parlons de' },
    { t: 'titre', v: 'votre projet.' },
    { t: 'sous',  v: 'Alternance · dès maintenant · Paris & IDF' }
  ], ETROIT ? 5.2 : 6.6, ETROIT ? 2.3 : 2.9);
  titreFin.position.set(0, ETROIT ? 4.85 : 3.75, Z_FOND - 2.94);
  monde.add(titreFin);

  const PL_L = ETROIT ? 5.0 : 3.5;          // largeur d'une plaque
  const PL_H = ETROIT ? 1.05 : 1.3;
  // ou se pose chacune des trois : en colonne, ou en ligne
  const PLACES = ETROIT
    ? [[0, 3.25], [0, 2.02], [0, 0.79]]
    : [[-3.65, 1.62], [0, 1.62], [3.65, 1.62]];

  const MAIL = 'maigretjaurys8@gmail.com';
  const TEL  = '06 09 97 74 01';

  function flash(m, texte, indice) {
    const v0 = m.userData.val, i0 = m.userData.indice;
    m.userData.dire(texte, indice);
    setTimeout(function () { m.userData.dire(v0, i0); m.userData.chaud(vise === m); }, 2200);
  }

  const pMail = plaqueAction('E-mail', MAIL, 'Clic · copier', PL_L, PL_H, function (m) {
    bruitage('clac');
    const fini = function () { flash(m, 'Copié dans le presse-papier', 'Clic · copier'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(MAIL).then(fini, function () {
        window.location.href = 'mailto:' + MAIL;
      });
    } else {
      window.location.href = 'mailto:' + MAIL;
    }
  });
  pMail.position.set(PLACES[0][0], PLACES[0][1], Z_FOND - 2.86);
  monde.add(pMail);

  const pTel = plaqueAction('Téléphone', TEL, 'Clic · appeler', PL_L, PL_H, function (m) {
    bruitage('clac');
    window.location.href = 'tel:+33609977401';
  });
  pTel.position.set(PLACES[1][0], PLACES[1][1], Z_FOND - 2.86);
  monde.add(pTel);

  // la sortie : on ne laisse personne au fond d'un couloir sans porte
  const pSortie = plaqueAction('Le site', 'Revenir au portfolio', 'Clic · quitter la soufflerie', PL_L, PL_H, function () {
    bruitage('balai');
    window.location.href = 'index.html#portfolio';
  });
  pSortie.position.set(PLACES[2][0], PLACES[2][1], Z_FOND - 2.86);
  monde.add(pSortie);

  // un socle sous chaque plaque : elles sont posees, pas collees au mur
  PLACES.forEach(function (q) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(PL_L + 0.2, 0.1, 0.5), acier());
    s.position.set(q[0], q[1] - PL_H / 2 - 0.05, Z_FOND - 2.72);
    monde.add(s);
  });

  const sFond = new THREE.SpotLight(0xf2f7ff, 55, 26, 0.72, 0.55, 1.4);
  sFond.position.set(0, PLAFOND - 0.5, Z_FOND + 5.5);
  sFond.target.position.set(0, 2.6, Z_FOND - 2.85);
  monde.add(sFond); monde.add(sFond.target);

  // la lueur rouge du fond : on sait qu'on arrive au bout
  const cl = document.createElement('canvas'); cl.width = 512; cl.height = 32;
  const gl = cl.getContext('2d');
  const dg = gl.createLinearGradient(0, 0, 512, 0);
  dg.addColorStop(0, 'rgba(212,42,27,0)');
  dg.addColorStop(0.5, 'rgba(255,68,51,1)');
  dg.addColorStop(1, 'rgba(212,42,27,0)');
  gl.fillStyle = dg; gl.fillRect(0, 0, 512, 32);
  const tl = new THREE.CanvasTexture(cl); tl.colorSpace = THREE.SRGBColorSpace;
  const lueur = new THREE.Mesh(
    new THREE.PlaneGeometry(DEMI_L * 2, 0.16),
    new THREE.MeshBasicMaterial({ map: tl, transparent: true, depthWrite: false })
  );
  lueur.position.set(0, 0.07, Z_FOND - 2.72);
  monde.add(lueur);
  // son reflet sur le sol, couche a plat : c'est ca qui fait la braise
  const reflet = new THREE.Mesh(
    new THREE.PlaneGeometry(DEMI_L * 2, 3.2),
    new THREE.MeshBasicMaterial({ map: tl, transparent: true, opacity: 0.17, depthWrite: false })
  );
  reflet.rotation.x = -Math.PI / 2;
  reflet.position.set(0, 0.012, Z_FOND - 1.3);
  monde.add(reflet);
  braise.position.set(0, 0.9, Z_FOND - 1.4);
  braise.intensity = 16;

  // Tout ce qui repond au pointeur. Les pieces ouvrent une fiche, les
  // plaques du fond declenchent une action : un seul lancer de rayon.
  const cliquables = cibles.concat(actions);
  let dernierAct = 0;
  function activer(obj) {
    if (obj && obj.userData && typeof obj.userData.act === 'function') {
      const t = performance.now();
      if (t - dernierAct < 350) return true;   // pointerup puis click : une seule fois
      dernierAct = t;
      obj.userData.act(obj); return true;
    }
    return false;
  }

  // ═══════════ déplacement : le flux ═══════════
  const pos = new THREE.Vector3(0, OEIL, 8.5);
  const vit = new THREE.Vector3();
  let lacet = 0, tangage = 0, foulee = 0;        // 0 = on regarde vers le fond du hall
  const bas = new Set();
  let vol = null;
  const joy = { actif: false, x: 0, y: 0 };

  const ZONES = [
    { n: '01', t: 'Entrée',      z: 8.5 },
    { n: '02', t: 'Les pièces',  z: -24 },
    { n: '03', t: 'Le parcours', z: Z_PARCOURS + (ETROIT ? 14 : 9) },
    { n: '04', t: 'Contact',     z: Z_FOND + 7 }
  ];

  const elZN = document.getElementById('zoneN');
  const elZT = document.getElementById('zoneT');
  const elX  = document.getElementById('coordX');
  const elZ  = document.getElementById('coordZ');
  const elCT = document.getElementById('cartelT');
  const elCC = document.getElementById('cartelC');
  const railC = document.getElementById('railCurseur');
  const railEl = document.getElementById('rail');
  let railH = railEl ? railEl.getBoundingClientRect().height : 200;
  const elCA = document.getElementById('cartelA');
  const elFiche = document.getElementById('fiche');
  const elGuide = document.getElementById('guide');

  // ── souris : regard ──
  let verrou = false;
  cv.addEventListener('click', () => {
    if (vise) { if (!activer(vise)) ouvrir(vise); return; }
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
  const souris = new THREE.Vector2(0, 0);
  addEventListener('pointermove', e => {
    souris.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    if (verrou) return;
    // Zone morte : au centre, le curseur DESIGNE. Ce n'est qu'en s'approchant
    // des bords qu'il fait tourner la tete. Sans ca, viser et tourner se battent.
    const MORT = 0.46;
    const bx = (e.clientX / innerWidth) * 2 - 1;
    const by = (e.clientY / innerHeight) * 2 - 1;
    sx = Math.abs(bx) > MORT ? (bx - Math.sign(bx) * MORT) / (1 - MORT) : 0;
    sy = Math.abs(by) > MORT ? (by - Math.sign(by) * MORT) / (1 - MORT) : 0;
  }, { passive: true });

  // ── clavier ──
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    bas.add(k);
    if (k === 'r') allerA(0);
    if (k === 'escape') { if (ouverte) fermerFiche(); else if (document.exitPointerLock) document.exitPointerLock(); }
    if (['z','q','s','d','w','a','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) { compris(); e.preventDefault(); }
  });
  addEventListener('keyup', e => bas.delete(e.key.toLowerCase()));
  addEventListener('blur', () => bas.clear());

  // ── au doigt ──
  // Un joystick pour parcourir un couloir, c'etait une mauvaise idee : sur un
  // telephone on glisse pour regarder et on TAPE une piece pour s'y rendre.
  // La manette reste, en appoint, pour qui veut se deplacer librement.
  var TACTILE = matchMedia('(pointer:coarse)').matches;
  var doigt = new THREE.Vector2();
  if(typeof compris!=='function'){ /* defini plus bas, fonction hissee */ }
  var depart=null, aGlisse=false;

  cv.addEventListener('pointerdown', function(e){
    if(e.pointerType==='mouse' && !TACTILE) return;
    compris();
    depart={x:e.clientX, y:e.clientY, t:performance.now()};
    aGlisse=false;
  });
  cv.addEventListener('pointermove', function(e){
    if(!depart) return;
    var dx=e.clientX-depart.x, dy=e.clientY-depart.y;
    if(!aGlisse && Math.hypot(dx,dy)>12) aGlisse=true;
    if(aGlisse){
      lacet   -= dx*0.0055;
      tangage -= dy*0.0035;
      tangage = Math.max(-0.95, Math.min(0.95, tangage));
      depart.x=e.clientX; depart.y=e.clientY;
    }
  });
  cv.addEventListener('pointerup', function(e){
    if(!depart) return;
    var fugace = performance.now()-depart.t < 600;
    depart=null;
    if(aGlisse || !fugace) return;
    // une tape : on pointe la ou le doigt s'est pose
    var r=cv.getBoundingClientRect();
    doigt.set(((e.clientX-r.left)/r.width)*2-1, -(((e.clientY-r.top)/r.height)*2-1));
    rayon.setFromCamera(doigt, cam);
    var t=rayon.intersectObjects(cliquables, false);
    if(t.length){ var o=t[0].object; if(!activer(o)) ouvrir(o); return; }
    // Au doigt, une piece lointaine fait quelques dizaines de pixels : exiger
    // de la toucher au pixel pres serait cruel. On prend la plus proche dans
    // un rayon raisonnable autour du point touche.
    var meilleure=null, dMin=1e9;
    var v=new THREE.Vector3();
    for(var i=0;i<cliquables.length;i++){
      cliquables[i].getWorldPosition(v);
      var d=v.clone().project(cam);
      if(d.z>1) continue;
      var sx=(d.x*0.5+0.5)*r.width, sy=(-d.y*0.5+0.5)*r.height;
      var dist=Math.hypot(sx-(e.clientX-r.left), sy-(e.clientY-r.top));
      if(dist<dMin){ dMin=dist; meilleure=cliquables[i]; }
    }
    if(meilleure && dMin < Math.min(r.width,r.height)*0.17){
      if(!activer(meilleure)) ouvrir(meilleure);
    }
    else if(ouverte) fermerFiche();
  });
  cv.addEventListener('pointercancel', function(){ depart=null; });

  // la manette, pour se deplacer librement
  var man = document.getElementById('manette');
  var manP = document.getElementById('manetteP');
  if (man) {
    var RAYON = 48, idDoigt = null;
    function prendre(e){
      var r = man.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);
      var d = Math.hypot(dx, dy) || 1;
      var k = Math.min(1, d / RAYON);
      joy.x = (dx / d) * k; joy.y = (dy / d) * k; joy.actif = true;
      manP.style.transform = 'translate(' + (joy.x*RAYON) + 'px,' + (joy.y*RAYON) + 'px)';
      compris();
    }
    man.addEventListener('pointerdown', function(e){
      e.preventDefault(); e.stopPropagation();
      idDoigt = e.pointerId; man.setPointerCapture(e.pointerId); prendre(e);
    });
    man.addEventListener('pointermove', function(e){
      if (idDoigt !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation(); prendre(e);
    });
    function lacher(e){
      if (idDoigt !== e.pointerId) return;
      idDoigt = null; joy.actif = false; joy.x = joy.y = 0;
      manP.style.transform = '';
    }
    man.addEventListener('pointerup', lacher);
    man.addEventListener('pointercancel', lacher);
  }

  // ── menu : approche automatique ──
  let apresVol = null;
  function allerA(i) {
    fermerFiche();
    bruitage('balai');
    const z = ZONES[i].z;
    vol = { t: 0, duree: 1.6, de: pos.clone(), vers: new THREE.Vector3(0, OEIL, z),
            lacetDe: lacet, lacetVers: 0, tangageDe: tangage, tangageVers: 0 };
    majHash(i);
  }
  function majHash(i) {
    const h = ['entree', 'pieces', 'parcours', 'contact'][i];
    if (location.hash !== '#' + h) history.replaceState(null, '', '#' + h);
  }
  document.querySelectorAll('[data-zone]').forEach(b => {
    b.addEventListener('click', () => { allerA(+b.dataset.zone); b.blur(); });
  });

  // le guidage parle la langue de l'appareil
  if (matchMedia('(pointer:coarse)').matches) {
    const t = elGuide && elGuide.querySelector('.guide-t');
    if (t) t.innerHTML = 'Touchez une pi&egrave;ce pour l\'ouvrir &middot; glissez pour regarder';
  }

  // le guidage disparait des qu'on a compris
  let aBouge = false;
  function compris() {
    if (aBouge) return; aBouge = true;
    elGuide.classList.add('parti');
    setTimeout(() => elGuide.remove(), 800);
  }

  // on peut arriver directement sur une zone
  const zoneDepart = ['#entree', '#pieces', '#parcours', '#contact'].indexOf(location.hash);
  if (zoneDepart > 0) { pos.z = ZONES[zoneDepart].z; compris(); }

  // ── viser une pièce ──
  const rayon = new THREE.Raycaster();
  const centre = new THREE.Vector2(0, 0);
  let vise = null;

  let ouverte = null;

  const _wp = new THREE.Vector3(), _q = new THREE.Quaternion(), _n = new THREE.Vector3();

  function ouvrir(tab) {
    if (ouverte === tab) return;
    ouverte = tab;
    bruitage('clac');
    const p = tab.userData.p;

    tab.getWorldPosition(_wp);
    tab.getWorldQuaternion(_q);
    _n.set(0, 0, 1).applyQuaternion(_q);

    const vers = _wp.clone().addScaledVector(_n, 5.2);
    vers.y = OEIL;
    vers.x = Math.max(-DEMI_L + 1.2, Math.min(DEMI_L - 1.2, vers.x));

    const dx = _wp.x - vers.x, dz = _wp.z - vers.z;
    // sur grand ecran la fiche occupe la droite : on tourne un peu la tete
    // pour que l'oeuvre se pose dans la partie libre, a gauche
    const lv = Math.atan2(-dx, -dz) - (innerWidth > 900 ? 0.36 : 0);
    const tv = Math.atan2(_wp.y - OEIL, Math.hypot(dx, dz)) * 0.8;

    if (document.exitPointerLock) document.exitPointerLock();
    vol = { t: 0, duree: 1.15, de: pos.clone(), vers,
            lacetDe: lacet, lacetVers: lv, tangageDe: tangage, tangageVers: tv };
    apresVol = () => { sx = 0; sy = 0; };

    document.getElementById('ficheN').textContent = String(tab.userData.i + 1).padStart(2, '0');
    document.getElementById('ficheT').textContent = p.titre || '';
    document.getElementById('ficheC').textContent = p.cat || '';
    document.getElementById('ficheD').textContent = p.desc || '';
    const vis = document.getElementById('ficheVis');
    vis.innerHTML = '';
    if (p.groupe) {
      pieces.filter(q => q.groupe === p.groupe && q.src !== p.src).slice(0, 4).forEach(q => {
        const im = document.createElement('img');
        im.src = q.src; im.alt = q.titre || ''; im.loading = 'lazy';
        vis.appendChild(im);
      });
    }
    document.getElementById('ficheGo').href =
      p.groupe ? 'index.html#p-' + p.groupe : 'index.html#portfolio';

    elFiche.classList.add('on');
    elFiche.setAttribute('aria-hidden', 'false');
    document.body.classList.add('fiche-ouverte');
  }

  function fermerFiche() {
    if (!ouverte) return;
    ouverte = null;
    bruitage('clic');
    elFiche.classList.remove('on');
    elFiche.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('fiche-ouverte');
  }
  document.getElementById('ficheX').addEventListener('click', fermerFiche);

  // ═══════════ boucle ═══════════
  function dimensionner() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  addEventListener('resize', () => { dimensionner(); if (railEl) railH = railEl.getBoundingClientRect().height; });
  dimensionner();

  const AV = new THREE.Vector3(), LAT = new THREE.Vector3();
  let dernier = performance.now();

  function boucle(t) {
    requestAnimationFrame(boucle);
    const dt = Math.min((t - dernier) / 1000, 0.05); dernier = t;

    // approche automatique
    if (vol) {
      vol.t = Math.min(1, vol.t + dt / (vol.duree || 1.5));
      const e = vol.t < 0.5 ? 4 * vol.t ** 3 : 1 - Math.pow(-2 * vol.t + 2, 3) / 2;
      pos.lerpVectors(vol.de, vol.vers, e);
      lacet   = vol.lacetDe   + (vol.lacetVers   - vol.lacetDe)   * e;
      tangage = vol.tangageDe + ((vol.tangageVers || 0) - vol.tangageDe) * e;
      vit.set(0, 0, 0);
      if (vol.t >= 1) { vol = null; if (apresVol) { apresVol(); apresVol = null; } }
    } else {
      // le flux : ZQSD règle le régime, l'inertie fait le reste
      let av = 0, lat = 0;
      if (bas.has('z') || bas.has('w') || bas.has('arrowup')) av += 1;
      if (bas.has('s') || bas.has('arrowdown')) av -= 1;
      if (bas.has('q') || bas.has('a') || bas.has('arrowleft')) lat -= 1;
      if (bas.has('d') || bas.has('arrowright')) lat += 1;
      if (joy.actif) { av -= joy.y; lat += joy.x; }
      if (ouverte && (av || lat)) fermerFiche();

      AV.set(-Math.sin(lacet), 0, -Math.cos(lacet));
      LAT.set(Math.cos(lacet), 0, -Math.sin(lacet));
      const pousse = bas.has('shift') ? 42 : 26;
      vit.addScaledVector(AV, av * pousse * dt);
      vit.addScaledVector(LAT, lat * pousse * dt);
      // Pas de derive automatique : on reste ou on s'arrete. L'idee du flux
      // qui porte etait jolie, mais on se retrouvait au bout du hall sans
      // avoir rien touche — surtout au doigt, ou l'on ne maintient rien.
      vit.multiplyScalar(Math.pow(0.0016, dt));   // traînée
      pos.addScaledVector(vit, dt);

      // on reste dans la veine
      pos.x = Math.max(-DEMI_L + 1.1, Math.min(DEMI_L - 1.1, pos.x));
      pos.z = Math.max(Z_FOND + 2.4, Math.min(11, pos.z));
      // on contourne les bancs
      for (const b of bancs) {
        const ox = pos.x - b.x, oz = pos.z - b.z;
        if (Math.abs(ox) < b.dx && Math.abs(oz) < b.dz) {
          const px = b.dx - Math.abs(ox), pz = b.dz - Math.abs(oz);
          if (px < pz) pos.x = b.x + Math.sign(ox || 1) * b.dx; else pos.z = b.z + Math.sign(oz || 1) * b.dz;
        }
      }
      // le pas : une oscillation a peine sensible quand on marche
      const allure = Math.min(1, vit.length() / 5);
      foulee += dt * (4 + allure * 4) * allure;
      pos.y = OEIL + Math.sin(foulee * 2) * 0.012 * allure;
    }

    if (!verrou) {
      lacet   -= sx * 1.35 * dt;              // on tourne tant que le curseur est au bord
      tangage += ((-sy * 0.42) - tangage) * 0.07;
    }

    // le souffle suit le deplacement reel : a l'arret il retombe
    if (SON && SON.estActif()) SON.flux(Math.min(1.3, vit.length() / 5.5));

    cam.position.copy(pos);
    cam.rotation.set(0, 0, 0, 'YXZ');
    cam.rotation.y = lacet; cam.rotation.x = tangage;

    // les projecteurs suivent le visiteur : les quatre oeuvres les plus proches
    // (un peu devant soi de preference) recoivent la vraie lumiere
    const proches = oeuvres.slice().sort((a, b) => Math.abs(a.z - pos.z + 4) - Math.abs(b.z - pos.z + 4));
    for (let i = 0; i < projecteurs.length; i++) {
      const o = proches[i], sp = projecteurs[i];
      if (!o) { sp.visible = false; continue; }
      sp.position.copy(o.P); sp.target.position.copy(o.T);
    }


    // les lampes suivent
    // une lumiere douce qui accompagne le visiteur, a hauteur d'oeil : elle
    // eclaire les murs sans faire de tache au plafond ni au sol
    lampes[0].position.set(pos.x * 0.4, 3.2, pos.z + 2);
    lampes[1].position.set(pos.x * 0.4, 3.2, pos.z - 10);
    lampes[2].position.set(pos.x * 0.4, 3.2, pos.z - 22);

    // visée
    rayon.setFromCamera(verrou ? centre : souris, cam);
    const touche = rayon.intersectObjects(cliquables, false);
    const n = (touche.length && touche[0].distance < 26) ? touche[0].object : null;
    if (n !== vise) {
      const avant = vise;
      vise = n;
      cliquables.forEach(c => c.userData.cible = (c === vise ? 1 : 0));
      document.body.classList.toggle('vise', !!vise);
      // une plaque du fond se rallume : le cadre passe au rouge, le texte blanchit
      if (avant && avant.userData.chaud) avant.userData.chaud(false);
      if (vise && vise.userData.chaud) vise.userData.chaud(true);
      if (vise) {
        const u = vise.userData;
        elCT.textContent = u.p ? (u.p.titre || '') : u.val;
        elCC.textContent = u.p ? (u.p.cat || '') : u.indice;
        // la plaque dit deja ce qu'elle fait : pas de "clic pour ouvrir" en plus
        if (elCA) elCA.style.display = u.p ? '' : 'none';
        bruitage('tic');
      }
    }
    // l'oeuvre visee s'eclaire, son halo s'intensifie
    for (const c of cibles) {
      const u = c.userData;
      u.k += (u.cible - u.k) * Math.min(1, dt * 7);
      u.mat.emissiveIntensity = 0.06 + u.k * 0.2;
      u.halo.material.opacity = 0.3 + u.k * 0.22 + pouls * 0.07;
    }
    pouls *= Math.pow(0.02, dt);      // le battement retombe en un demi-temps

    // instruments
    const vz = -pos.z;
    elX.textContent = (pos.x >= 0 ? '+' : '−') + Math.abs(pos.x).toFixed(1).padStart(4, '0');
    elZ.textContent = (vz >= 0 ? '' : '−') + Math.abs(vz).toFixed(1).padStart(5, '0') + ' m';
    let zi = 0;
    for (let i = 0; i < ZONES.length; i++) if (pos.z <= ZONES[i].z + 6) zi = i;
    if (elZT.textContent !== ZONES[zi].t) {
      elZN.textContent = 'Zone ' + ZONES[zi].n;
      elZT.textContent = ZONES[zi].t;
      elZT.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],
                   {duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
      if (!vol) majHash(zi);
    }
    document.querySelectorAll('[data-zone]').forEach(b => b.classList.toggle('ici', +b.dataset.zone === zi));
    // le curseur du rail glisse selon l'avancee reelle dans le hall
    if (railC) {
      const k = Math.max(0, Math.min(1, (ZONES[0].z - pos.z) / (ZONES[0].z - ZONES[3].z)));
      railC.style.top = (4 + k * (railH - 8)) + 'px';
    }

    renderer.render(monde, cam);
  }
  requestAnimationFrame(boucle);

  return { pieces: pieces.length };
}
