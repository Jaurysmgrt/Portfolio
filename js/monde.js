// ═══════════════════════════════════════════════════════════════════════
// L'APPARTEMENT — un appartement haussmannien de Jaurys Maigret, la nuit
//
// On n'y marche pas : on fait defiler, et la camera glisse sur un rail,
// comme un travelling de cinema, un arret par geste. Trois pieces en
// enfilade : le salon et sa cheminee (les affiches, la 991 en miniature),
// la galerie (les photographies), et le bureau, ou la visite se termine.
// Mobilier : modeles glTF du Khronos Group (voir modeles/CREDITS.md).
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/addons/environments/RoomEnvironment.js';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/addons/postprocessing/ShaderPass.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/addons/libs/meshopt_decoder.module.js';
import { Reflector } from '../vendor/addons/objects/Reflector.js';
import { GTAOPass } from '../vendor/addons/postprocessing/GTAOPass.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

const ROUGE = 0xd42a1b;
const DEMI = 3;          // demi-largeur de l'appartement
const HAUT = 3.3;        // hauteur sous plafond
const MAIL = 'maigretjaurys8@gmail.com';
const TEL = '06 09 97 74 01';

// le son, s'il est demande : synthetise, jamais charge
let SON = null;
function bruitage(nom) { if (SON && SON.estActif() && SON.son[nom]) SON.son[nom](); }

export async function demarrer() {
  const cv = document.getElementById('veine');
  const PETIT = matchMedia('(pointer:coarse)').matches || innerWidth < 760;
  const TACTILE = matchMedia('(pointer:coarse)').matches;

  // ── le son ──
  (function brancherSon() {
    const btn = document.getElementById('son');
    if (!btn) return;
    let on = false;
    const etat = v => { on = v; btn.setAttribute('aria-pressed', v ? 'true' : 'false');
      try { localStorage.setItem('jm-son', v ? '1' : '0'); } catch (e) {} };
    const charger = () => import('./son.js?v=8').then(m => { SON = m; m.allumer(); etat(true); m.son.tension(); });
    btn.addEventListener('click', () => {
      if (!SON) return charger();
      if (on) { SON.eteindre(); etat(false); } else { SON.allumer(); etat(true); SON.son.tic(); }
    });
    let voulu = false;
    try { voulu = localStorage.getItem('jm-son') === '1'; } catch (e) {}
    if (voulu) {
      const reveil = () => { document.removeEventListener('pointerdown', reveil);
        document.removeEventListener('keydown', reveil);
        import('./son.js?v=8').then(m => { SON = m; m.allumer(); etat(true); }); };
      document.addEventListener('pointerdown', reveil, { once: true });
      document.addEventListener('keydown', reveil, { once: true });
    }
  })();

  // ── l'atelier bat avec la musique : le neon et les ampoules respirent ──
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

  // ═══════════ le rendu ═══════════
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  let densite = Math.min(devicePixelRatio || 1, PETIT ? 1.5 : 1.5);
  renderer.setPixelRatio(densite);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !PETIT;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;           // rien ne bouge : les ombres sont calculees une fois
  const majOmbres = () => { renderer.shadowMap.needsUpdate = true; };

  const monde = new THREE.Scene();
  monde.background = new THREE.Color(0x030304);
  const cam = new THREE.PerspectiveCamera(PETIT ? 62 : 52, 1, 0.05, 200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  monde.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  monde.environmentIntensity = 0.18;

  // les neons et les ampoules diffusent leur lumiere dans l'image (ordinateur)
  let composer = null, bloom = null, pellicule = null, passeAO = null;
  if (!PETIT) {
    // un rendu anticrenele, et l'occlusion ambiante : les ombres de contact des angles et des objets
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(monde, cam));
    const ao = new GTAOPass(monde, cam, innerWidth, innerHeight);
    ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
    ao.blendIntensity = 0.9; composer.addPass(ao); passeAO = ao;
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.5, 0.95);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // la pellicule : grain, vignettage, un soupcon d'aberration de l'objectif sur les bords
    pellicule = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float t; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec2 d = vUv - 0.5; float r = dot(d, d);
          vec2 o = d * r * 0.012;
          vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
          c *= 1.0 - smoothstep(0.12, 0.62, r) * 0.42;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c += (h(gl_FragCoord.xy + fract(t) * 91.7) - 0.5) * (0.055 - l * 0.03);
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    composer.addPass(pellicule);
  }

  // ═══════════ les donnees ═══════════
  const pieces = await fetch('data/pieces.json').then(r => r.json());
  // les videos sont lues dans le site lui-meme : une seule source
  let videos = [];
  try {
    const html = await fetch('index.html').then(r => r.text());
    const doc = new DOMParser().parseFromString(html, 'text/html');
    videos = [...doc.querySelectorAll('.gal-video')].map(v => ({
      titre: v.dataset.title || '', cat: (v.dataset.cat || '').replace(/&middot;/g, '·'), desc: v.dataset.desc || '',
      vsrc: v.dataset.vsrc || '', poster: v.dataset.poster || '' }));
  } catch (e) {}

  // ═══════════ les matieres, peintes ici ═══════════
  function toile(w, h, peindre, lin) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    peindre(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (!lin) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  function bruitFractal(w, h, octaves, graine) {
    const out = new Float32Array(w * h);
    let amp = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
      const cell = Math.max(2, Math.floor(w / Math.pow(2, o + 2)));
      const gw = Math.ceil(w / cell) + 2;
      const grille = new Float32Array(gw * (Math.ceil(h / cell) + 2));
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
  function texPixels(w, h, peindre, lin, apres) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); const img = g.createImageData(w, h);
    peindre(img.data, w, h); g.putImageData(img, 0, 0);
    if (apres) apres(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (!lin) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const hasard = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  // des rayures fines, tracees au hasard (sol, metal, plastique)
  function rayures(g, w, n, couleur, graine) {
    g.strokeStyle = couleur; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = hasard(graine + i) * w, y = hasard(graine + i * 3.1) * w, a = hasard(graine + i * 7.7) * Math.PI, l = (0.02 + hasard(i * 1.3 + graine) * 0.12) * w;
      g.lineWidth = 0.5 + hasard(i * 9.1) * (w / 700); g.globalAlpha = 0.25 + hasard(i * 4.4) * 0.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + l * 0.08, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // le beton cire du sol : joints de sciage, taches, rayures, brillance irreguliere
  const RES = PETIT ? 512 : 1024;
  const nB = bruitFractal(RES, RES, 7, 3.1);
  const nM = bruitFractal(RES, RES, 7, 9.3);
  const Q = RES / 512;
  const tache = (x, y) => nM[y * RES + (RES - 1 - x)];        // un bruit decorrele du grain
  // le noyer du bureau : lames, cernes, pores
  const texBois = texPixels(1024, 256, (d, w, h) => {
    for (let k = 0; k < w * h; k++) { const x = k % w, y = (k / w) | 0, lame = (y / 64) | 0;
      const o = hasard(lame * 7.1) * 40, fy = y + o + nB[((y * 3) % RES) * RES + (x % RES)] * 10;
      const cerne = Math.pow(Math.sin(fy * 0.21 + Math.sin(x * 0.006 + lame) * 4 + nB[(y % RES) * RES + ((x * 2) % RES)] * 5) * 0.5 + 0.5, 3);
      let v = 0.7 + cerne * 0.13 + nB[k % nB.length] * 0.2 + (hasard(k) > 0.97 ? -0.12 : 0);
      v *= 0.88 + hasard(lame * 2.9) * 0.2;
      if (y % 64 < 1) v *= 0.45;
      d[k * 4] = 104 * v; d[k * 4 + 1] = 74 * v; d[k * 4 + 2] = 52 * v; d[k * 4 + 3] = 255; }
  });
  const texBoisR = texPixels(512, 128, (d, w, h) => {
    for (let k = 0; k < w * h; k++) { const v = 120 + nB[k % nB.length] * 80 + hasard(k) * 20; d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true, (g, w) => rayures(g, w, 30, 'rgba(255,255,255,1)', 8.8));
  // le grain de toute chose : un rien de relief et de brillance irreguliere
  const texGrainR = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const v = 200 + nB[k * 3 % nB.length] * 45 + hasard(k) * 10; d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true, (g, w) => rayures(g, w, 25, 'rgba(255,255,255,1)', 2.5));
  const texGrainB = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const v = 128 + (hasard(k * 2.3) - 0.5) * 50 + (nM[k * 5 % nM.length] - 0.5) * 60; d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true);
  // le metal brosse
  const texBrosse = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const y = (k / w) | 0; const v = 150 + hasard(y * 1.7) * 60 + hasard(k) * 25 + nB[k % nB.length] * 30; d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true, (g, w) => rayures(g, w, 40, 'rgba(255,255,255,1)', 6.6));
  const texToileB = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const x = k % w, y = (k / w) | 0;
      const v = 128 + Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) * 70 + (hasard(k) - 0.5) * 30; d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true);
  texToileB.repeat.set(5, 5);
  const texHalo = toile(256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const additif = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  // chaque matiere recoit un grain : metal brosse pour le metal, micro-relief pour le reste
  texGrainR.repeat.set(2, 2); texGrainB.repeat.set(2, 2); texBrosse.repeat.set(1, 3);
  const mat = (color, roughness = 0.8, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness,
    roughnessMap: metalness > 0.5 ? texBrosse : texGrainR, bumpMap: texGrainB, bumpScale: metalness > 0.5 ? 0.15 : 0.35 }, extra));
  const acier = mat(0x1d1e21, 0.35, 0.85);
  const noirMat = mat(0x0b0b0c, 0.6, 0.2);
  function boite(w, h, d, m, x, y, z, parent) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; (parent || monde).add(b); return b; }

  // ═══════════ l'appartement ═══════════
  // trois pieces en enfilade, du salon au bureau. Le mur gauche (x = -3) est
  // le mur des cadres, le mur droit (x = +3) donne sur la rue.
  const XG = -DEMI, XD = DEMI;
  const Z1 = 0, Z2 = -7, Z3 = -12.5, Z4 = -18;
  const PORTE1 = [0.7, 2.2], PORTE2 = [0.4, 1.9], HP = 2.7;
  const EP = 0.24;                                   // epaisseur des cloisons

  // ── les matieres ──
  const texEnduit = texPixels(512, 512, (d, w) => {
    for (let k = 0; k < w * w; k++) { const v = 232 + (nM[(k * 2) % nM.length] - 0.5) * 14 + (hasard(k) - 0.5) * 5;
      d[k * 4] = v; d[k * 4 + 1] = v * 0.985; d[k * 4 + 2] = v * 0.955; d[k * 4 + 3] = 255; }
  });
  texEnduit.repeat.set(1.5, 1.5);
  const matPeinture = new THREE.MeshStandardMaterial({ color: 0xe6ded2, map: texEnduit, bumpMap: texEnduit, bumpScale: 0.25, roughness: 0.93, shadowSide: THREE.DoubleSide });
  const matMoulure = new THREE.MeshStandardMaterial({ color: 0xf2ede3, roughness: 0.55, bumpMap: texGrainB, bumpScale: 0.15 });
  const matPlafond = new THREE.MeshStandardMaterial({ color: 0xf1ece4, roughness: 0.96, map: texEnduit });
  // le marbre blanc veine de la cheminee
  const texMarbre = texPixels(512, 512, (d, w) => {
    for (let k = 0; k < w * w; k++) { const x = k % w, y = (k / w) | 0;
      const t = Math.sin((x * 0.012 + y * 0.02) + nM[k] * 9 + nB[(k * 3) % nB.length] * 4);
      const veine = Math.pow(1 - Math.abs(t), 18) * 0.55 + Math.pow(1 - Math.abs(Math.sin(x * 0.03 - y * 0.008 + nB[k] * 12)), 40) * 0.25;
      const v = 236 - veine * 120 + (nB[k] - 0.5) * 10;
      d[k * 4] = v; d[k * 4 + 1] = v * 0.99; d[k * 4 + 2] = v * 0.98; d[k * 4 + 3] = 255; }
  });
  const matMarbre = new THREE.MeshPhysicalMaterial({ map: texMarbre, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.12 });
  const matLaiton = mat(0xb8913f, 0.3, 1);
  const matOr = mat(0xc9a24e, 0.32, 1);

  // ── le parquet en point de Hongrie, taille dans de vraies lames de chene ──
  const cvParquet = document.createElement('canvas'); cvParquet.width = cvParquet.height = 2048;
  const texParquet = new THREE.CanvasTexture(cvParquet); texParquet.colorSpace = THREE.SRGBColorSpace;
  texParquet.wrapS = texParquet.wrapT = THREE.RepeatWrapping; texParquet.anisotropy = 8;
  const texParquetB = new THREE.CanvasTexture(cvParquet); texParquetB.wrapS = texParquetB.wrapT = THREE.RepeatWrapping;
  const imgChene = new Image();
  imgChene.onload = () => {
    const g = cvParquet.getContext('2d'), C = 256, H = 256;         // 2048 px = 2 m : colonnes de 25 cm
    let n = 0;
    for (let col = 0; col < 2048 / C; col++) for (let row = -2; row < 2048 / H + 2; row++) {
      n++; const x0 = col * C, y0 = row * H, s = col % 2 ? -1 : 1;
      g.save(); g.beginPath();
      g.moveTo(x0, y0); g.lineTo(x0 + C, y0 - C * s); g.lineTo(x0 + C, y0 - C * s + H); g.lineTo(x0, y0 + H); g.closePath(); g.clip();
      g.translate(x0 + C / 2, y0 + H / 2 - C * s / 2); g.rotate(-s * Math.PI / 4);
      const sx = hasard(n * 1.7) * (imgChene.width - 800), sy = Math.floor(hasard(n * 3.3) * 7) * (imgChene.height / 8);
      g.filter = 'brightness(' + (0.82 + hasard(n * 5.1) * 0.3).toFixed(2) + ') saturate(' + (0.8 + hasard(n) * 0.2).toFixed(2) + ')';
      g.drawImage(imgChene, sx, sy, 800, imgChene.height / 8, -400, -H * 0.4, 800, H * 0.8);
      g.filter = 'none'; g.restore();
      g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + C, y0 - C * s); g.stroke();
    }
    g.fillStyle = 'rgba(20,12,6,.5)'; for (let col = 0; col <= 2048 / C; col++) g.fillRect(col * C - 1, 0, 2, 2048);
    texParquet.needsUpdate = true; texParquetB.needsUpdate = true;
  };
  imgChene.src = 'textures/hardwood2_diffuse.jpg';

  // ── un morceau d'architecture, dans le repere d'un mur ──
  // u le long du mur, v vers le haut, w vers l'interieur de la piece
  const geosMoulures = [];
  function moulure(G, u0, v0, u1, v1, prof, larg) {       // un cadre de moulure
    const p = prof || 0.018, l = larg || 0.035;
    for (const [cu, cv, w, h] of [[(u0 + u1) / 2, v0, u1 - u0 + l, l], [(u0 + u1) / 2, v1, u1 - u0 + l, l], [u0, (v0 + v1) / 2, l, v1 - v0], [u1, (v0 + v1) / 2, l, v1 - v0]]) {
      const b = new THREE.BoxGeometry(w, h, p); b.translate(cu, cv, p / 2);
      G.updateMatrixWorld(true); b.applyMatrix4(G.matrixWorld); geosMoulures.push(b);
    }
  }
  function regle(G, u0, u1, v, h, p) { const b = new THREE.BoxGeometry(u1 - u0, h, p); b.translate((u0 + u1) / 2, v, p / 2); G.updateMatrixWorld(true); b.applyMatrix4(G.matrixWorld); geosMoulures.push(b); }
  function paroi(ox, oz, theta, long, trous, panneaux) {
    const G = new THREE.Group(); G.position.set(ox, 0, oz); G.rotation.y = theta; monde.add(G);
    const forme = new THREE.Shape(); forme.moveTo(0, 0); forme.lineTo(long, 0); forme.lineTo(long, HAUT); forme.lineTo(0, HAUT); forme.closePath();
    for (const t of trous) { const h = new THREE.Path(); h.moveTo(t[0], t[2]); h.lineTo(t[1], t[2]); h.lineTo(t[1], t[3]); h.lineTo(t[0], t[3]); h.closePath(); forme.holes.push(h); }
    const geo = new THREE.ShapeGeometry(forme);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    const m = new THREE.Mesh(geo, matPeinture); m.receiveShadow = true; m.castShadow = true; G.add(m);
    // segments pleins, entre les ouvertures
    const bords = [0]; trous.slice().sort((a, b) => a[0] - b[0]).forEach(t => { bords.push(t[0], t[1]); }); bords.push(long);
    const pleins = []; for (let k = 0; k < bords.length; k += 2) if (bords[k + 1] - bords[k] > 0.05) pleins.push([bords[k], bords[k + 1], trous.find(t => Math.abs(t[1] - bords[k]) < 1e-6 || Math.abs(t[0] - bords[k + 1]) < 1e-6)]);
    for (const [a, b] of pleins) {
      regle(G, a, b, 0.11, 0.22, 0.022);                  // la plinthe
      regle(G, a, b, 0.23, 0.02, 0.03);
      regle(G, a, b, 0.95, 0.045, 0.028);                 // la cimaise
      if (panneaux !== false) {                           // les cadres de moulure, bas et haut
        const n = Math.max(1, Math.round((b - a - 0.2) / 1.5)), lp = (b - a - 0.16) / n;
        for (let k = 0; k < n; k++) { const u0 = a + 0.08 + k * lp + 0.09, u1 = a + 0.08 + (k + 1) * lp - 0.09;
          if (u1 - u0 < 0.25) continue;
          moulure(G, u0, 0.36, u1, 0.82);
          moulure(G, u0, 1.12, u1, HAUT - 0.55); }
      }
    }
    // la corniche : un profil en gradins et une gorge
    regle(G, 0, long, HAUT - 0.03, 0.06, 0.16);
    regle(G, 0, long, HAUT - 0.1, 0.06, 0.1);
    regle(G, 0, long, HAUT - 0.17, 0.05, 0.06);
    regle(G, 0, long, HAUT - 0.24, 0.025, 0.035);
    const gorge = new THREE.CylinderGeometry(0.1, 0.1, long, 12, 1, true, 0, Math.PI / 2); gorge.rotateZ(Math.PI / 2); gorge.translate(long / 2, HAUT - 0.16, 0.0);
    G.updateMatrixWorld(true); gorge.applyMatrix4(G.matrixWorld); geosMoulures.push(gorge);
    return G;
  }
  // l'embrasure d'une ouverture dans une cloison epaisse, et son chambranle
  function embrasure(x0, x1, z, haut) {
    for (const x of [x0, x1]) { const b = boite(0.02, haut, EP, matMoulure, x + (x === x0 ? -0.01 : 0.01), haut / 2, z); b.castShadow = true; }
    boite(x1 - x0, 0.02, EP, matMoulure, (x0 + x1) / 2, haut + 0.01, z);
    for (const s of [1, -1]) {
      const zz = z + s * (EP / 2 + 0.012);
      boite(0.09, haut + 0.09, 0.024, matMoulure, x0 - 0.045, (haut + 0.09) / 2, zz);
      boite(0.09, haut + 0.09, 0.024, matMoulure, x1 + 0.045, (haut + 0.09) / 2, zz);
      boite(x1 - x0 + 0.18, 0.09, 0.024, matMoulure, (x0 + x1) / 2, haut + 0.045, zz);
    }
    // les deux vantaux, ouverts contre l'embrasure
    const lv = (x1 - x0) / 2;
    for (const [xc, sg] of [[x0, 1], [x1, -1]]) {
      const v = new THREE.Group(); v.position.set(xc, 0, z - EP / 2 - 0.035); v.rotation.y = sg * Math.PI * 0.95; monde.add(v);     // rabattu contre le mur
      boite(lv - 0.01, haut - 0.02, 0.045, matMoulure, sg * lv / 2, haut / 2, -0.02, v);
      for (const [v0, v1] of [[0.25, 0.9], [1.1, haut - 0.25]]) for (const fz of [0.004, -0.044]) {
        const pn = new THREE.Group(); pn.position.set(0, 0, fz); v.add(pn);
        const a = sg > 0 ? 0.1 : -lv + 0.1, b = sg > 0 ? lv - 0.1 : -0.1;
        for (const [cu, cv, w, h] of [[(a + b) / 2, v0, b - a, 0.03], [(a + b) / 2, v1, b - a, 0.03], [a, (v0 + v1) / 2, 0.03, v1 - v0], [b, (v0 + v1) / 2, 0.03, v1 - v0]])
          boite(w, h, 0.012, matMoulure, cu, cv, 0, pn);
      }
      const poignee = new THREE.Mesh(new THREE.SphereGeometry(0.025, 14, 10), matLaiton); poignee.position.set(sg * (lv - 0.08), 1.05, 0.02); v.add(poignee);
    }
  }

  // ── les murs ──
  const FEN = [[-1.9, 1.25], [-5.1, 1.25], [-15.2, 1.25]];          // fenetres du mur droit : centre z, largeur
  // mur gauche : les cadres
  const murG = paroi(XG, Z1, Math.PI / 2, Z1 - Z4, [], true);
  // mur droit : les fenetres sur rue (u = z - Z4)
  const murD = paroi(XD, Z4, -Math.PI / 2, Z1 - Z4, FEN.map(([zc, l]) => [zc - Z4 - l / 2, zc - Z4 + l / 2, 0.32, 2.98]), true);
  // le mur d'entree et le mur du fond
  paroi(XD, Z1, Math.PI, XD - XG, [], true);
  paroi(XG, Z4, 0, XD - XG, [], true);
  // les cloisons, sur leurs deux faces, percees d'une porte
  for (const [z, P] of [[Z2, PORTE1], [Z3, PORTE2]]) {
    paroi(XG, z + EP / 2, 0, XD - XG, [[P[0] - XG, P[1] - XG, 0, HP]], true);                  // face vers l'entree
    paroi(XD, z - EP / 2, Math.PI, XD - XG, [[XD - P[1], XD - P[0], 0, HP]], true);            // face vers le fond
    embrasure(P[0], P[1], z, HP);
  }
  // le sol, le plafond, les rosaces
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(XD - XG, Z1 - Z4), new THREE.MeshStandardMaterial({ map: texParquet, color: 0xa08a76, roughness: 0.42, bumpMap: texParquetB, bumpScale: 0.6 }));
  texParquet.repeat.set((XD - XG) / 2, (Z1 - Z4) / 2); texParquetB.repeat.copy(texParquet.repeat);
  sol.rotation.x = -Math.PI / 2; sol.position.set(0, 0, (Z1 + Z4) / 2); sol.receiveShadow = true; monde.add(sol);
  const plafond = new THREE.Mesh(new THREE.PlaneGeometry(XD - XG, Z1 - Z4), matPlafond); plafond.rotation.x = Math.PI / 2; plafond.position.set(0, HAUT, (Z1 + Z4) / 2); monde.add(plafond);
  const centres = [(Z1 + Z2) / 2, (Z2 + Z3) / 2, (Z3 + Z4) / 2];
  for (const zc of centres) {
    const pts = []; for (let k = 0; k <= 16; k++) { const r = k / 16 * 0.42; pts.push(new THREE.Vector2(r, -(Math.cos(k / 16 * Math.PI * 3) * 0.012 + (1 - k / 16) * 0.05))); }
    const ros = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), matMoulure); ros.position.set(0, HAUT, zc); monde.add(ros);
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.018, 8, 64), matMoulure); anneau.rotation.x = Math.PI / 2; anneau.position.set(0, HAUT - 0.01, zc); monde.add(anneau);
  }

  // ── les fenetres a la francaise, les rideaux, le balcon, la rue ──
  const matVitreF = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false });
  const matFer = mat(0x141516, 0.55, 0.6);
  const texVelours = texPixels(256, 256, (d, w) => { for (let k = 0; k < w * w; k++) { const x = k % w; const v = 0.75 + Math.sin(x * 0.4 + nB[k] * 3) * 0.08 + (hasard(k) - 0.5) * 0.06;
    d[k * 4] = 255 * v; d[k * 4 + 1] = 255 * v; d[k * 4 + 2] = 255 * v; d[k * 4 + 3] = 255; } });
  function rideau(x, z, l) {
    const g = new THREE.PlaneGeometry(l, HAUT - 0.35, 28, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i); p.setZ(i, Math.sin(u / l * Math.PI * 7) * 0.05); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x40372d, map: texVelours, roughness: 0.9, sheen: 1, sheenColor: 0x8a7a62, sheenRoughness: 0.5, side: THREE.DoubleSide }));
    m.rotation.y = -Math.PI / 2; m.position.set(x, (HAUT - 0.35) / 2 + 0.05, z); m.castShadow = true; m.receiveShadow = true; monde.add(m);
  }
  for (const [zc, l] of FEN) {
    const z0 = zc - l / 2, z1 = zc + l / 2;
    // l'embrasure et l'appui
    for (const z of [z0, z1]) boite(0.36, 2.66, 0.02, matMoulure, XD + 0.16, 0.32 + 1.33, z);
    boite(0.36, 0.02, l, matMoulure, XD + 0.16, 2.98, zc); boite(0.42, 0.04, l + 0.06, matMarbre, XD + 0.12, 0.32, zc);
    // les deux vantaux et leurs petits bois
    for (const s of [-1, 1]) {
      const zz = zc + s * l / 4;
      for (const [w, h, dz, dy] of [[0.05, 2.62, s * (l / 4 - 0.025), 0], [0.05, 2.62, -s * (l / 4 - 0.025), 0]]) boite(0.06, h, w, matMoulure, XD + 0.3, 0.33 + 1.31 + dy, zz + dz);
      for (const y of [0.34, 0.95, 1.6, 2.28, 2.96]) boite(0.06, 0.05, l / 2, matMoulure, XD + 0.3, y, zz);
      const vitre = new THREE.Mesh(new THREE.PlaneGeometry(l / 2 - 0.05, 2.6), matVitreF); vitre.rotation.y = -Math.PI / 2; vitre.position.set(XD + 0.29, 1.64, zz); monde.add(vitre);
    }
    // le garde-corps en fer forge
    boite(0.03, 0.03, l + 0.2, matFer, XD + 0.5, 1.02, zc);
    boite(0.03, 0.03, l + 0.2, matFer, XD + 0.5, 0.42, zc);
    for (let k = 0; k <= 14; k++) { const z = z0 - 0.08 + k * (l + 0.16) / 14; boite(0.014, 0.6, 0.014, matFer, XD + 0.5, 0.72, z); }
    for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 20), matFer); r.rotation.y = Math.PI / 2; r.position.set(XD + 0.5, 0.72, z0 + (k + 0.5) * l / 7); monde.add(r); }
    // les rideaux de velours, tires de chaque cote
    rideau(XD - 0.08, z0 - 0.32, 0.6); rideau(XD - 0.08, z1 + 0.32, 0.6);
    boite(0.03, 0.03, l + 1.6, matLaiton, XD - 0.12, HAUT - 0.32, zc);
  }
  // la rue : l'immeuble d'en face, la nuit
  const texRue = toile(2048, 1024, (g, w, h) => {
    const ciel = g.createLinearGradient(0, 0, 0, h * 0.3); ciel.addColorStop(0, '#05070d'); ciel.addColorStop(1, '#1a1f2e'); g.fillStyle = ciel; g.fillRect(0, 0, w, h * 0.3);
    // le toit de zinc, les cheminees
    g.fillStyle = '#2a2e35'; g.beginPath(); g.moveTo(0, h * 0.3); for (let x = 0; x <= w; x += 64) g.lineTo(x, h * 0.2 + (x / 64 % 2) * 2); g.lineTo(w, h * 0.3); g.fill();
    for (let x = 60; x < w; x += 230) { g.fillStyle = '#3a3430'; g.fillRect(x, h * 0.1, 42, h * 0.11); g.fillStyle = '#5a3e30'; for (let k = 0; k < 4; k++) g.fillRect(x + 4 + k * 10, h * 0.085, 6, h * 0.02); }
    for (let x = 30; x < w; x += 128) { g.fillStyle = '#20242b'; g.fillRect(x + 30, h * 0.215, 50, h * 0.07); g.fillStyle = hasard(x) > 0.6 ? '#e8b66a' : '#1a1d24'; g.fillRect(x + 38, h * 0.23, 34, h * 0.045); }
    // la facade de pierre, eclairee d'en bas par la rue
    const f = g.createLinearGradient(0, h * 0.3, 0, h); f.addColorStop(0, '#4a4136'); f.addColorStop(0.6, '#6b5a45'); f.addColorStop(1, '#a37a4a'); g.fillStyle = f; g.fillRect(0, h * 0.3, w, h * 0.7);
    for (let y = h * 0.3; y < h; y += 14) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, y, w, 1); }
    for (let et = 0; et < 4; et++) {
      const y = h * 0.35 + et * h * 0.165;
      for (let x = 30; x < w; x += 128) {
        const allume = hasard(x * 3.1 + et * 17) > 0.58;
        g.fillStyle = '#d8cbb4'; g.fillRect(x + 20, y - 6, 88, 8);                       // corniche de fenetre
        if (allume) { const l = g.createLinearGradient(0, y, 0, y + 120); l.addColorStop(0, '#f6c77e'); l.addColorStop(1, '#b0743a'); g.fillStyle = l; }
        else g.fillStyle = '#151a22';
        g.fillRect(x + 30, y + 6, 68, 118);
        if (allume) { g.fillStyle = 'rgba(120,70,30,.55)'; g.fillRect(x + 30, y + 6, 14, 118); g.fillRect(x + 84, y + 6, 14, 118); }
        g.fillStyle = 'rgba(30,25,20,.8)'; g.fillRect(x + 63, y + 6, 2, 118); g.fillRect(x + 30, y + 46, 68, 2); g.fillRect(x + 30, y + 86, 68, 2);
        if (et === 0 || et === 3 || hasard(x + et) > 0.7) { g.fillStyle = '#0d0d0f'; g.fillRect(x + 22, y + 104, 84, 3); for (let b = 0; b < 12; b++) g.fillRect(x + 24 + b * 7, y + 84, 1.5, 20); g.fillRect(x + 22, y + 84, 84, 2); }
      }
      if (et === 0) { g.fillStyle = '#0d0d0f'; g.fillRect(0, y + 104, w, 4); }
    }
    const lampe = g.createRadialGradient(w * 0.3, h, 0, w * 0.3, h, h * 0.5); lampe.addColorStop(0, 'rgba(255,170,80,.35)'); lampe.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = lampe; g.fillRect(0, h * 0.4, w, h * 0.6);
    const lampe2 = g.createRadialGradient(w * 0.78, h, 0, w * 0.78, h, h * 0.45); lampe2.addColorStop(0, 'rgba(255,170,80,.3)'); lampe2.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = lampe2; g.fillRect(0, h * 0.4, w, h * 0.6);
  });
  const rue = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: texRue }));
  rue.material.color.setScalar(0.75); rue.rotation.y = -Math.PI / 2; rue.position.set(XD + 14, 2.5, -9); monde.add(rue);
  const balcon = new THREE.Mesh(new THREE.PlaneGeometry(0.7, Z1 - Z4), mat(0x2b2a28, 0.9)); balcon.rotation.x = -Math.PI / 2; balcon.position.set(XD + 0.35, 0.3, (Z1 + Z4) / 2); monde.add(balcon);

  // ═══════════ lumiere ═══════════
  monde.add(new THREE.AmbientLight(0xd8cbb8, 0.16));
  monde.add(new THREE.HemisphereLight(0xc9d6ea, 0x2a2018, 0.22));
  // la lune et la rue entrent par les fenetres, et dessinent leurs carreaux au sol
  const lune = new THREE.DirectionalLight(0xa9bfe6, PETIT ? 0.5 : 1.3); lune.position.set(XD + 9, 6.5, -6); lune.target.position.set(0, 0, -9);
  if (!PETIT) { lune.castShadow = true; lune.shadow.mapSize.set(2048, 2048); Object.assign(lune.shadow.camera, { left: -12, right: 12, top: 8, bottom: -8, near: 1, far: 30 }); lune.shadow.bias = -0.0005; lune.shadow.normalBias = 0.03; }
  monde.add(lune); monde.add(lune.target);
  const lumieres = [];                              // les lampes de la maison, qui battent avec la musique
  function lampeChaude(x, y, z, i, d) { const l = new THREE.PointLight(0xffc98e, i, d || 7, 2); l.position.set(x, y, z); monde.add(l); lumieres.push({ l, i }); return l; }

  // ═══════════ les objets cliquables ═══════════
  const cliquables = [];      // { mesh, nom, cat, faire }
  function cliquable(mesh, nom, cat, faire) { mesh.userData.clic = { nom, cat, faire }; cliquables.push(mesh); }
  const chargeur = new THREE.TextureLoader();
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  function texture(src) { const t = chargeur.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
  const oeuvres = [];   // tout ce qui compte pour la chasse
  function oeuvre(p, mesh) { const id = oeuvres.length; oeuvres.push({ p, mesh }); mesh.userData.oeuvre = id;
    cliquable(mesh, p.titre, p.cat, () => ouvrirFiche(id)); return id; }
  const matOmbre = new THREE.MeshBasicMaterial({ map: texHalo, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
  function ombreSol(x, z, w, d, op) { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matOmbre.clone()); o.material.opacity = op || 0.6;
    o.rotation.x = -Math.PI / 2; o.position.set(x, 0.006, z); monde.add(o); return o; }

  // ═══════════ les cadres ═══════════
  // chene clair, passe-partout blanc casse, verre ; une lampe de tableau en laiton
  // au-dessus, et un cartel a droite, comme chez un collectionneur
  const matChene = mat(0xc7a57c, 0.5, 0, { map: texBois });
  const matPP = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95 });
  const matVerre = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.1, depthWrite: false });
  const matLavis = additif(texHalo, 0xffd9a8, 0.07);
  const cadres = [];
  function cadre(G, u, v, p, hMax, wMax) {
    let h = hMax, w = h * p.w / p.h; if (w > wMax) { w = wMax; h = w * p.h / p.w; }
    const pp = Math.min(w, h) * 0.14, bord = 0.035;
    const F = new THREE.Group(); F.position.set(u, v, 0.026); G.add(F);     // devant les moulures du mur
    const W = w + pp * 2, H = h + pp * 2;
    // l'ombre portee du cadre sur le mur
    const om = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.22, H + 0.26), matOmbre.clone()); om.material.opacity = 0.45; om.position.set(0.02, -0.05, -0.024); F.add(om);
    for (const [cu, cv, ww, hh] of [[0, H / 2 + bord / 2, W + bord * 2, bord], [0, -H / 2 - bord / 2, W + bord * 2, bord], [-W / 2 - bord / 2, 0, bord, H], [W / 2 + bord / 2, 0, bord, H]])
      boite(ww, hh, 0.066, matChene, cu, cv, 0.007, F);
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matPP); fond.position.z = 0.012; fond.receiveShadow = true; F.add(fond);
    const biseau = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.012, h + 0.012), mat(0xfbfaf6, 0.9)); biseau.position.z = 0.0125; F.add(biseau);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture(p.src), roughness: 0.6 })); img.position.z = 0.013; F.add(img);
    const verre = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matVerre); verre.position.z = 0.036; F.add(verre);
    // la lampe de tableau
    const bras = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), matLaiton); bras.rotation.x = Math.PI / 2 - 0.5; bras.position.set(0, H / 2 + bord + 0.06, 0.07); F.add(bras);
    const reglette = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, Math.min(W * 0.55, 0.5), 18), matLaiton); reglette.rotation.z = Math.PI / 2; reglette.position.set(0, H / 2 + bord + 0.1, 0.14); F.add(reglette);
    const lavis = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, H * 1.1), matLavis); lavis.position.set(0, H * 0.12, -0.022); F.add(lavis);
    // le cartel
    const tc = toile(400, 230, (g, cw, ch) => { g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, cw, ch);
      g.fillStyle = '#16161a'; g.font = '600 30px "IBM Plex Sans", sans-serif'; const t = (p.titre || '').split(','); g.fillText(t[0].slice(0, 22), 24, 60);
      g.font = 'italic 400 24px "IBM Plex Sans", sans-serif'; g.fillStyle = '#44454c'; if (t[1]) g.fillText(t[1].trim().slice(0, 26), 24, 98);
      g.font = '500 17px "IBM Plex Mono", monospace'; g.fillStyle = '#a3241a'; g.fillText((p.cat || '').toUpperCase().slice(0, 30), 24, 160);
      g.fillStyle = '#7b7c82'; g.fillText('J. MAIGRET', 24, 196); });
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.086), new THREE.MeshStandardMaterial({ map: tc, roughness: 0.8 }));
    cartel.position.set(W / 2 + bord + 0.16, -H / 2 + 0.2, -0.02); F.add(cartel);
    cadres.push({ F, img });
    return img;
  }

  // ═══════════ l'accrochage ═══════════
  const prim = g => pieces.find(p => p.groupe === g && !p.secondaire);
  const autos = pieces.filter(p => !p.groupe && !/nuit-/.test(p.src));
  const nuits = pieces.filter(p => /nuit-/.test(p.src));
  const OEIL = 1.62;
  // un arret regarde un mur : la camera recule dans la piece, face aux cadres
  function arretMur(nom, mur, zMil, ids, recul, extra) {
    const s = mur === 'G' ? 1 : -1, x = mur === 'G' ? XG : XD;
    return Object.assign({ cam: new THREE.Vector3(x + s * (recul || 2.0), 1.58, zMil + 0.15), vise: new THREE.Vector3(x, OEIL - 0.08, zMil), ids, nom }, extra || {});
  }
  // mur gauche : u = Z1 - z
  const surG = (z, v, p, hM, wM) => cadre(murG, Z1 - z, v, p, hM, wM);
  const surD = (z, v, p, hM, wM) => cadre(murD, z - Z4, v, p, hM, wM);

  // ── le salon : les affiches, de part et d'autre de la cheminee ──
  const zCh = -3.5;
  const idHermes = oeuvre(prim('hermes'), surG(-1.35, OEIL, prim('hermes'), 1.05, 0.9));
  const idAtol = oeuvre(prim('atol'), surG(-5.65, OEIL, prim('atol'), 1.05, 0.9));
  // sur la cloison du fond du salon, a gauche de la porte : Five Guys et Halloween
  const cloison1 = new THREE.Group(); cloison1.position.set(XG, 0, Z2 + EP / 2 + 0.001); monde.add(cloison1);
  const idFive = oeuvre(prim('fiveguys'), cadre(cloison1, 1.0, OEIL, prim('fiveguys'), 1.05, 0.9));
  const idHall = oeuvre(prim('halloween'), cadre(cloison1, 2.55, OEIL, prim('halloween'), 1.05, 0.9));

  // la cheminee de marbre, le feu, le miroir
  const ch = new THREE.Group(); ch.position.set(XG, 0, zCh); ch.rotation.y = Math.PI / 2; monde.add(ch);
  for (const s of [-1, 1]) { boite(0.24, 1.0, 0.3, matMarbre, s * 0.68, 0.5, 0.15, ch); boite(0.3, 0.08, 0.34, matMarbre, s * 0.68, 0.04, 0.16, ch);
    const cons = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.16, 16, 1, false, 0, Math.PI), matMarbre); cons.rotation.x = Math.PI / 2; cons.position.set(s * 0.68, 0.94, 0.3); ch.add(cons); }
  boite(1.6, 0.2, 0.3, matMarbre, 0, 0.92, 0.15, ch);
  boite(1.76, 0.055, 0.38, matMarbre, 0, 1.05, 0.19, ch);
  boite(1.8, 0.04, 0.5, matMarbre, 0, 0.02, 0.4, ch);
  boite(1.12, 0.82, 0.02, mat(0x0a0807, 0.95), 0, 0.41, 0.01, ch);                // le foyer
  for (const s of [-1, 1]) boite(0.02, 0.82, 0.28, mat(0x14100d, 0.9), s * 0.56, 0.41, 0.15, ch);
  boite(1.12, 0.02, 0.28, mat(0x14100d, 0.9), 0, 0.82, 0.15, ch);
  // les buches et les flammes
  for (const [dx, ry] of [[-0.15, 0.3], [0.12, -0.25], [0, 0.05]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.6, 12), mat(0x3a2618, 0.9, 0, { map: texBois }));
    b.rotation.z = Math.PI / 2; b.rotation.y = ry; b.position.set(dx, 0.1 + (dx === 0 ? 0.08 : 0), 0.15); ch.add(b); }
  const texFlamme = toile(128, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h * 0.78, 2, w / 2, h * 0.62, h * 0.55);
    r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(0.25, 'rgba(255,170,60,.9)'); r.addColorStop(0.6, 'rgba(220,70,20,.45)'); r.addColorStop(1, 'rgba(120,20,0,0)');
    g.fillStyle = r; g.beginPath(); g.moveTo(w / 2, 0); g.bezierCurveTo(w * 0.95, h * 0.45, w, h, w / 2, h); g.bezierCurveTo(0, h, w * 0.05, h * 0.45, w / 2, 0); g.fill(); });
  const flammes = [];
  for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.42), additif(texFlamme, 0xffffff, 0.85)); f.material.toneMapped = false;
    f.position.set(-0.28 + k * 0.14, 0.3, 0.13 + (k % 2) * 0.04); ch.add(f); flammes.push({ f, ph: k * 1.7 }); }
  const feu = new THREE.PointLight(0xff8a3a, 2.4, 6, 2); feu.position.set(XG + 0.45, 0.45, zCh); monde.add(feu);
  // le miroir au-dessus, dans son cadre dore
  let miroir = null;
  if (!PETIT) {
    miroir = new Reflector(new THREE.PlaneGeometry(1.36, 1.5), { textureWidth: 768, textureHeight: 768, color: 0xa8a49c, clipBias: 0.003 });
    miroir.position.set(0, 1.92, 0.012); ch.add(miroir);
  } else { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.5), mat(0x30343a, 0.05, 1)); m.position.set(0, 1.92, 0.012); ch.add(m); }
  for (const [cu, cv, ww, hh] of [[0, 2.7, 1.52, 0.08], [0, 1.14, 1.52, 0.08], [-0.72, 1.92, 0.08, 1.64], [0.72, 1.92, 0.08, 1.64]]) boite(ww, hh, 0.05, matOr, cu, cv, 0.03, ch);
  const fronton = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24, Math.PI), matOr); fronton.position.set(0, 2.74, 0.04); ch.add(fronton);
  ombreSol(XG + 0.35, zCh, 0.9, 2.2, 0.5);

  // ── la galerie : les photographies ──
  const idsAuto = [];
  // mur gauche : trois tirages, mur droit : VOSS, Uber, un tirage
  [[-8.15, 0], [-9.75, 1], [-11.35, 2]].forEach(([z, k]) => { const p = autos[k]; idsAuto[k] = oeuvre(p, surG(z, OEIL, p, 0.95, 0.95)); });
  const idVoss = oeuvre(prim('voss'), surD(-8.15, OEIL, prim('voss'), 0.8, 0.95));
  const idUber = oeuvre(prim('uber'), surD(-9.75, OEIL, prim('uber'), 0.8, 0.95));
  idsAuto[3] = oeuvre(autos[3], surD(-11.35, OEIL, autos[3], 0.95, 0.95));
  // la serie de nuit : quatre tirages en grille, sur la cloison du fond
  const cloison2 = new THREE.Group(); cloison2.position.set(XG, 0, Z3 + EP / 2 + 0.001); monde.add(cloison2);
  const idsNuit = nuits.map((p, k) => oeuvre(p, cadre(cloison2, 1.25 + (k % 2) * 1.1, OEIL + 0.42 - Math.floor(k / 2) * 0.84, p, 0.5, 0.75)));

  // ── le bureau : l'ecran des videos, deux tirages ──
  idsAuto[4] = oeuvre(autos[4], surG(-13.55, OEIL, autos[4], 0.8, 0.8));
  idsAuto[5] = oeuvre(autos[5], surG(-16.85, OEIL, autos[5], 0.8, 0.8));
  const zTV = -15.2;
  const tv = new THREE.Group(); tv.position.set(XG + 0.04, 1.5, zTV); tv.rotation.y = Math.PI / 2; monde.add(tv);
  boite(1.42, 0.82, 0.035, mat(0x0c0c0d, 0.35, 0.3), 0, 0, 0, tv);
  const texCartes = videos.slice(0, 5).map(v => {
    const id = (v.vsrc.match(/(?:youtu\.be\/|v=)([\w-]{11})/) || [])[1];
    const carte = toile(960, 540, (g, W, H) => { g.fillStyle = '#0b0d11'; g.fillRect(0, 0, W, H); g.fillStyle = '#d42a1b'; g.fillRect(0, 0, W, 10);
      g.font = '64px Anton, sans-serif'; g.fillStyle = '#fff'; g.fillText(v.titre.slice(0, 26), 50, 300); g.font = '500 24px "IBM Plex Mono", monospace'; g.fillStyle = '#a9b7c6'; g.fillText(v.cat.toUpperCase().slice(0, 48), 50, 350);
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(W - 140, H - 130); g.lineTo(W - 140, H - 60); g.lineTo(W - 80, H - 95); g.fill(); });
    const src = v.poster || (id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '');
    const t = { map: carte };
    if (src) chargeur.load(src, tx => { tx.colorSpace = THREE.SRGBColorSpace; t.map = tx; }, undefined, () => {});
    return t;
  });
  const matEcran = new THREE.MeshBasicMaterial({ map: texCartes.length ? texCartes[0].map : null, toneMapped: false }); matEcran.color.setScalar(0.85);
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.78), matEcran); ecran.position.z = 0.019; tv.add(ecran);
  const halTV = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), additif(texHalo, 0x9fc0ff, 0.07)); halTV.position.z = -0.01; tv.add(halTV);
  const idsVideos = videos.slice(0, 5).map(v => { const o = { titre: v.titre, cat: v.cat, desc: v.desc, video: v.vsrc };
    const id = oeuvres.length; oeuvres.push({ p: o, mesh: ecran }); return id; });
  let vCourante = 0;
  cliquable(ecran, 'Mes vidéos', 'Clic · ouvrir celle-ci', () => ouvrirFiche(idsVideos[vCourante]));
  // le buffet sous l'ecran
  boite(1.7, 0.55, 0.42, mat(0xb08c68, 0.45, 0, { map: texBois }), XG + 0.22, 0.42, zTV).rotation.y = Math.PI / 2;
  for (const dz of [-0.75, 0.75]) for (const dx of [0.06, 0.38]) boite(0.03, 0.15, 0.03, matLaiton, XG + dx, 0.075, zTV + dz);

  // ═══════════ le bureau de Jaurys ═══════════
  const zD = -16.55, xD = 0.35;
  const plateau = boite(1.7, 0.05, 0.82, mat(0xb08c68, 0.42, 0, { map: texBois, roughnessMap: texBoisR }), xD, 0.76, zD);
  const cuir = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.55), mat(0x1d2b24, 0.75)); cuir.rotation.x = -Math.PI / 2; cuir.position.set(xD, 0.787, zD + 0.04); monde.add(cuir);
  for (const dx of [-0.78, 0.78]) for (const dz of [-0.34, 0.34]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.017, 0.74, 12), mat(0xb08c68, 0.45, 0, { map: texBois })); p.position.set(xD + dx, 0.37, zD + dz); p.castShadow = true; monde.add(p); }
  boite(1.6, 0.1, 0.03, mat(0xb08c68, 0.45, 0, { map: texBois }), xD, 0.69, zD + 0.38);
  ombreSol(xD, zD, 2.2, 1.3, 0.5);
  // le CV, le telephone, le portable, la tasse
  const cvPapier = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshStandardMaterial({ map: texture('images/cv-apercu.jpg'), roughness: 0.85 }));
  cvPapier.rotation.x = -Math.PI / 2; cvPapier.rotation.z = 0.08; cvPapier.position.set(xD - 0.3, 0.79, zD + 0.12); cvPapier.castShadow = true; monde.add(cvPapier);
  cliquable(cvPapier, 'Mon CV', 'Clic · ouvrir le PDF', () => window.open('CV-Jaurys-Maigret.pdf', '_blank'));
  const texTel = toile(256, 512, (g, w, h) => { g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h); g.fillStyle = '#d42a1b'; g.beginPath(); g.arc(w / 2, 200, 46, 0, 7); g.fill();
    g.font = '600 30px "IBM Plex Mono", monospace'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('Jaurys', w / 2, 300); g.font = '500 22px "IBM Plex Mono", monospace'; g.fillStyle = '#a9b7c6'; g.fillText(TEL, w / 2, 340); g.fillText('Appeler', w / 2, 420); });
  const tel = boite(0.075, 0.009, 0.155, mat(0x0d0e10, 0.3, 0.5), xD + 0.22, 0.788, zD + 0.24); tel.rotation.y = -0.3;
  const telEcran = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.145), new THREE.MeshBasicMaterial({ map: texTel, toneMapped: false })); telEcran.rotation.x = -Math.PI / 2; telEcran.position.y = 0.005; tel.add(telEcran);
  for (const m of [tel, telEcran]) cliquable(m, TEL, 'Clic · appeler', () => { location.href = 'tel:+33609977401'; });
  const texMail = toile(800, 500, (g, w, h) => { g.fillStyle = '#f2efe9'; g.fillRect(0, 0, w, h); g.fillStyle = '#d42a1b'; g.fillRect(0, 0, w, 10);
    g.fillStyle = '#121214'; g.font = '600 34px "IBM Plex Sans", sans-serif'; g.fillText('Nouveau message', 40, 80);
    g.font = '500 26px "IBM Plex Mono", monospace'; g.fillStyle = '#555'; g.fillText('À : ' + MAIL, 40, 150);
    g.fillText('Objet : Alternance en direction artistique', 40, 195); g.fillStyle = '#121214'; g.font = '400 28px "IBM Plex Sans", sans-serif';
    g.fillText('Bonjour Jaurys,', 40, 270); g.fillText('nous aimerions vous rencontrer…', 40, 315);
    g.fillStyle = '#d42a1b'; g.fillRect(40, 380, 220, 64); g.fillStyle = '#fff'; g.font = '600 26px "IBM Plex Mono", monospace'; g.fillText('Envoyer ↗', 70, 422); });
  const alu = mat(0xb9bcc2, 0.3, 0.9);
  const portable = new THREE.Group(); portable.position.set(xD + 0.42, 0.786, zD - 0.1); portable.rotation.y = -0.4; monde.add(portable);
  boite(0.42, 0.014, 0.29, alu, 0, 0.007, 0, portable);
  const capot = new THREE.Group(); capot.position.set(0, 0.014, -0.145); capot.rotation.x = -0.3; portable.add(capot);
  boite(0.42, 0.28, 0.008, alu, 0, 0.14, 0, capot);
  const ecranMail = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.245), new THREE.MeshBasicMaterial({ map: texMail, toneMapped: false })); ecranMail.position.set(0, 0.14, 0.005); capot.add(ecranMail);
  ecranMail.material.color.setScalar(0.8);
  cliquable(ecranMail, MAIL, 'Clic · écrire', () => { location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Alternance en direction artistique'); });
  // au-dessus du bureau, une affiche typographique encadree
  const texTitre = toile(1000, 1300, (g, w, h) => { g.fillStyle = '#f3efe6'; g.fillRect(0, 0, w, h);
    g.font = '500 30px "IBM Plex Mono", monospace'; g.letterSpacing = '10px'; g.fillStyle = '#c0291b'; g.fillText('ALTERNANCE · DÈS MAINTENANT', 70, 130);
    g.letterSpacing = '0px'; g.font = '200px Anton, sans-serif'; g.fillStyle = '#121214'; g.fillText('Parlons', 64, 420); g.fillText('de votre', 64, 640); g.fillText('projet.', 64, 860);
    g.fillStyle = '#c0291b'; g.fillRect(70, 960, 140, 10);
    g.font = '500 30px "IBM Plex Mono", monospace'; g.fillStyle = '#33343a'; g.fillText('JAURYS MAIGRET', 70, 1060); g.fillText('DIRECTION ARTISTIQUE · PARIS', 70, 1110); });
  const murFond = new THREE.Group(); murFond.position.set(XG, 0, Z4 + 0.001); monde.add(murFond);
  const pTitre = { titre: 'Parlons de votre projet.', cat: 'Contact', w: 1000, h: 1300, src: '' };
  const imgTitre = cadre(murFond, xD - XG, 1.75, pTitre, 0.95, 0.8); imgTitre.material.map = texTitre;
  cliquable(imgTitre, 'Parlons de votre projet.', 'Clic · écrire à Jaurys', () => { location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Alternance en direction artistique'); });

  // ═══════════ le mobilier : de vrais objets, modelises et photographies ═══════════
  // (modeles glTF d'exemple du Khronos Group, CC0 et CC-BY 4.0 : voir modeles/CREDITS.md)
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const modeles = {}, chargements = [];
  function modele(nom) {
    return modeles[nom] || (modeles[nom] = gltf.loadAsync('modeles/' + nom + '.glb').then(g => {
      const lum = []; g.scene.traverse(o => { if (o.isLight) lum.push(o); if (o.isMesh) { o.castShadow = !PETIT; o.receiveShadow = true; } });
      g.scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) {
        if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.28; m.roughness = Math.min(m.roughness, 0.08); m.depthWrite = false; m.thickness = 0; }
        if (m.diffuseTransmission) m.diffuseTransmission = 0; } });
      lum.forEach(l => l.removeFromParent()); return g.scene; }));
  }
  function poser(nom, x, y, z, ry, ech, apres) {
    const pr = modele(nom).then(sc => { const o = sc.clone(true); o.position.set(x, y, z); o.rotation.y = ry || 0; o.scale.setScalar(ech || 1);
      monde.add(o); if (apres) apres(o); majOmbres(); return o; }).catch(e => { console.warn('modele', nom, e && e.message); return null; });
    chargements.push(pr); return pr;
  }
  // un tapis de laine : motif tisse, franges, fibres
  function tapis(x, z, w, d, ry, c) {
    // un tapis d'Orient use : champ marbre, medaillon, bordures a motifs, franges
    const t = toile(768, 1152, (g, W, H) => {
      const [fond, ivoire, bleu, ocre] = c;
      g.fillStyle = fond; g.fillRect(0, 0, W, H);
      const bande = (m, e, col) => { g.strokeStyle = col; g.lineWidth = e; g.strokeRect(m, m, W - m * 2, H - m * 2); };
      bande(22, 26, bleu); bande(52, 6, ivoire); bande(92, 62, bleu); bande(130, 6, ivoire); bande(140, 8, ocre);
      // les motifs de la grande bordure
      g.fillStyle = ocre;
      const motif = (cx, cy, r) => { g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
      for (let xx = 120; xx < W - 100; xx += 64) { motif(xx, 92, 20); motif(xx, H - 92, 20); }
      for (let yy = 150; yy < H - 120; yy += 64) { motif(92, yy, 20); motif(W - 92, yy, 20); }
      g.fillStyle = ivoire; for (let xx = 152; xx < W - 120; xx += 64) { g.fillRect(xx - 3, 89, 6, 6); g.fillRect(xx - 3, H - 95, 6, 6); }
      // le medaillon central et les ecoincons
      const med = (cx, cy, rx, ry2, col) => { g.fillStyle = col; g.beginPath(); for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2; const ond = 1 + Math.sin(a * 12) * 0.05;
        g.lineTo(cx + Math.cos(a) * rx * ond, cy + Math.sin(a) * ry2 * ond); } g.fill(); };
      med(W / 2, H / 2, 190, 270, bleu); med(W / 2, H / 2, 150, 225, ivoire); med(W / 2, H / 2, 112, 175, fond); med(W / 2, H / 2, 46, 70, ocre);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; motif(W / 2 + Math.cos(a) * 80, H / 2 + Math.sin(a) * 125, 14); }
      for (const [cx, cy] of [[160, 160], [W - 160, 160], [160, H - 160], [W - 160, H - 160]]) { g.fillStyle = bleu; g.beginPath(); g.arc(cx, cy, 120, 0, Math.PI * 2); g.fill(); g.fillStyle = fond; g.fillRect(cx < W / 2 ? cx : cx - 140, cy < H / 2 ? cy : cy - 140, 140, 140); }
      // la laine : fibres, usure, teinture irreguliere (abrash)
      const img = g.getImageData(0, 0, W, H), dd = img.data;
      for (let k = 0; k < dd.length; k += 4) { const px = (k / 4) % W, py = (k / 4 / W) | 0;
        const abrash = (nM[((py >> 1) * 512 + (px >> 1)) % nM.length] - 0.5) * 34, n = (hasard(k * 0.25) - 0.5) * 26 + (px % 3 === 0 ? -6 : 0);
        const use = nB[((py * 3) % 1024) * 1024 + ((px * 3) % 1024)] > 0.62 ? 18 : 0;
        for (let q = 0; q < 3; q++) dd[k + q] = dd[k + q] * 0.92 + abrash + n + use; }
      g.putImageData(img, 0, 0);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 1, bumpMap: texToileB, bumpScale: 0.6 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = ry || 0; m.position.set(x, 0.008, z); m.receiveShadow = true; monde.add(m);
    // les franges
    const fr = toile(64, 32, (g, W, H) => { g.clearRect(0, 0, W, H); g.strokeStyle = '#e7dcc4'; g.lineWidth = 1.2; for (let k = 0; k < W; k += 3) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + (hasard(k) - 0.5) * 3, H * (0.7 + hasard(k * 2) * 0.3)); g.stroke(); } });
    fr.wrapS = THREE.RepeatWrapping; fr.repeat.set(w * 6, 1);
    for (const sg of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.08), new THREE.MeshStandardMaterial({ map: fr, transparent: true, roughness: 1 }));
      f.rotation.x = -Math.PI / 2; f.position.set(0, 0, 0.0005); const h = new THREE.Group(); h.position.set(x, 0.008, z); h.rotation.y = ry || 0; monde.add(h);
      f.position.z = sg * (d / 2 + 0.04); if (sg < 0) f.rotation.z = Math.PI; h.add(f); }
    return m;
  }
  // une bibliotheque encastree, pleine de livres
  const tons = [0x1c1c20, 0x8a2a1e, 0xcfc6b5, 0x2d3c55, 0x6f6a5d, 0xb7a27a, 0x121212, 0xe6e0d4, 0x4d5b43];
  function bibliotheque(x, z, ry, larg, haut) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; monde.add(g);
    const nT = Math.floor((haut - 0.5) / 0.38);
    for (const dx of [-larg / 2, larg / 2]) boite(0.04, haut, 0.36, matMoulure, dx, haut / 2, 0, g);
    boite(larg + 0.08, 0.5, 0.38, matMoulure, 0, 0.25, 0.01, g);
    for (let k = 0; k <= nT; k++) boite(larg, 0.025, 0.34, matMoulure, 0, 0.5 + k * 0.38, 0, g);
    boite(larg + 0.1, 0.06, 0.4, matMoulure, 0, haut, 0.02, g);
    const L = []; let n = 0;
    for (let r = 0; r < nT; r++) { const y = 0.513 + r * 0.38; let xx = -larg / 2 + 0.03;
      while (xx < larg / 2 - 0.08) { n++; const h = hasard(n * 1.3 + x * 7);
        if (h < 0.07) { xx += 0.14; continue; }
        if (h > 0.91) { for (let k = 0; k < 4; k++) L.push([0.24, 0.025, 0.2, xx + 0.13, y + 0.013 + k * 0.026, 0, 0, (k - 1.5) * 0.06, tons[(n + k) % tons.length]]); xx += 0.3; continue; }
        const e = 0.022 + hasard(n * 2.7) * 0.035, hh = 0.21 + hasard(n * 3.1) * 0.12, pr = 0.17 + hasard(n * 5.3) * 0.08;
        L.push([e, hh, pr, xx + e / 2, y + hh / 2, 0.02, 0, 0, tons[(n * 7) % tons.length]]); xx += e + 0.002; } }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff, 0.8), L.length);
    const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E4 = new THREE.Euler(), C4 = new THREE.Color();
    L.forEach((l, i) => { Q4.setFromEuler(E4.set(0, l[7], l[6])); M4.compose(new THREE.Vector3(l[3], l[4], l[5]), Q4, new THREE.Vector3(l[0], l[1], l[2]));
      im.setMatrixAt(i, M4); im.setColorAt(i, C4.setHex(l[8]).multiplyScalar(0.7 + hasard(i * 3.3) * 0.35)); });
    im.receiveShadow = true; im.castShadow = !PETIT; g.add(im);
    return g;
  }

  // le salon : canape de velours face a la cheminee, poufs, lampadaire, plantes
  tapis(-0.6, zCh, 2.3, 3.1, 0, ['#7c3a2c', '#d8c7a4', '#283247', '#a9763f']);
  poser('Sofa_01', 1.25, 0, zCh, -Math.PI / 2, 1.18);                               // canape Louis XV
  poser('ArmChair_01', -1.3, 0, zCh + 1.3, -2.78, 1.0);                               // deux fauteuils medaillon
  poser('ArmChair_01', -1.3, 0, zCh - 1.3, -0.36, 1.0);
  poser('antique_ceramic_vase_01', XG + 0.32, 0, zCh + 1.2, 0.4, 1.6);
  poser('Chandelier_01', 0, HAUT - 0.02, zCh, 0, 1.2, () => lampeChaude(0, HAUT - 0.9, zCh, 2.2, 7));
  poser('LightsPunctualLamp', 2.45, 0, -6.35, -0.7, 1.0, () => lampeChaude(2.0, 1.75, -6.0, 3.2, 6));
  poser('DiffuseTransmissionPlant', -2.45, 0, -0.45, 0.6, 1.5);
  poser('DiffuseTransmissionPlant', 2.45, 0, -6.45, 2.0, 1.4);
  // sur la cheminee : la miniature de la 991, un vase, des bougies
  const zMini = zCh + 0.35;
  const idVoiture = oeuvre({ titre: 'La 991 de Talon Pointe', cat: 'Alternance · concession de véhicules de luxe',
    desc: "Chargé de communication en alternance chez Talon Pointe : photo, vidéo, réseaux sociaux et storytelling pour une concession de véhicules de luxe. Cliquez sur la miniature pour l'entendre.",
    groupe: 'halloween', src: prim('halloween').src }, new THREE.Object3D());
  poser('ToyCar', XG + 0.2, 1.085, zMini, Math.PI / 2 + 0.5, 6.5, o => {
    o.traverse(m => { if (m.isMesh) cliquable(m, 'La 991 de Talon Pointe', 'Clic · démarrer le moteur', () => { demarrage(); ouvrirFiche(idVoiture); }); });
  });
  poser('GlassVaseFlowers', XG + 0.18, 1.08, zCh - 0.55, 0.3, 1.7);
  poser('mantel_clock_01', XG + 0.16, 1.078, zCh - 0.08, Math.PI / 2, 1.35);
  for (const dz of [-0.78, 0.78]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 16), matLaiton); b.position.set(XG + 0.14, 1.095, zCh + dz); monde.add(b);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 12), mat(0xf3eee2, 0.6)); c.position.set(XG + 0.14, 1.21, zCh + dz); monde.add(c);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.06), additif(texFlamme, 0xffffff, 0.9)); fl.material.toneMapped = false; fl.position.set(XG + 0.14, 1.34, zCh + dz); fl.rotation.y = Math.PI / 2; monde.add(fl); flammes.push({ f: fl, ph: dz * 3, bougie: true }); }

  // la galerie : une banquette au centre, un gueridon, la chambre photographique
  poser('SpecularSilkPouf', -0.1, 0, -9.35, 0.2, 1.05);
  poser('SpecularSilkPouf', -0.1, 0, -10.15, -0.4, 1.05);
  tapis(-0.1, -9.75, 1.7, 2.6, 0, ['#2c3547', '#d6c6a2', '#7b3328', '#a9803f']);
  const gueridon = new THREE.Group(); gueridon.position.set(2.35, 0, -12.0); monde.add(gueridon);
  const plateauG = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 40), matMarbre); plateauG.position.y = 0.72; plateauG.castShadow = true; gueridon.add(plateauG);
  const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 16), matLaiton); pied.position.y = 0.36; gueridon.add(pied);
  const socle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 32), matLaiton); socle.position.y = 0.015; gueridon.add(socle);
  poser('IridescentDishWithOlives', 2.35, 0.735, -12.0, 0.4, 0.9);
  poser('AntiqueCamera', 2.1, 0, -7.75, -2.3, 0.2, o => {
    o.traverse(m => { if (m.isMesh) cliquable(m, "L'appareil photo", 'Cliquez pour déclencher', () => declencher()); });
  });
  poser('DiffuseTransmissionPlant', -2.45, 0, -12.0, 1.1, 1.3);
  // une suspension de verre opalin dans chaque piece
  const matOpalin = new THREE.MeshStandardMaterial({ color: 0xfff4e2, emissive: 0xffd9a0, emissiveIntensity: 1.6, roughness: 0.4 });
  poser('Chandelier_02', 0, HAUT - 0.98, -9.75, 0, 1.08, () => lampeChaude(0, HAUT - 0.75, -9.75, 2.6, 7));
  poser('ClassicConsole_01', XD - 0.3, 0, -9.75, -Math.PI / 2, 1.0);
  poser('marble_bust_01', XD - 0.3, 0.95, -10.25, -Math.PI / 2 - 0.35, 1.0);
  poser('Camera_01', XD - 0.32, 0.95, -9.45, -Math.PI / 2 + 0.5, 1.15);
  poser('potted_plant_04', XD - 0.3, 0.95, -9.05, 0, 1.0);
  poser('vintage_grandfather_clock_01', -2.35, 0, Z2 - EP / 2 - 0.26, Math.PI, 1.0);
  for (const zc of [-15.25]) {
    const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.9, 6), matLaiton); fil.position.set(0, HAUT - 0.45, zc); monde.add(fil);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), matOpalin); globe.position.set(0, HAUT - 1.05, zc); monde.add(globe);
    lampeChaude(0, HAUT - 1.25, zc, 2.6, 7);
  }
  // le bureau : le fauteuil, la tasse, le vase, les bibliotheques, le lampadaire
  poser('GreenChair_01', xD, 0, zD - 0.72, 0, 1.0);
  poser('DiffuseTransmissionTeacup', xD + 0.02, 0.787, zD - 0.22, 0.8, 1.15);
  poser('GlassVaseFlowers', xD - 0.72, 0.787, zD - 0.28, -0.5, 1.5);
  poser('standing_picture_frame_01', xD - 0.45, 0.787, zD - 0.26, 0.35, 1.0);
  poser('round_spectacles', xD - 0.02, 0.795, zD + 0.3, 0.5, 1.0);
  poser('vintage_video_camera', XG + 0.24, 0.695, zTV - 0.55, Math.PI / 2 - 0.3, 1.7);
  poser('filmstrip_projector_8mm', XG + 0.26, 0.695, zTV + 0.5, Math.PI / 2 + 0.4, 0.9);
  poser('book_encyclopedia_set_01', -2.85, 2.78, Z4 + 0.2, 0, 1.0);
  poser('book_encyclopedia_set_01', -1.75, 2.78, Z4 + 0.2, 0, 1.0);
  bibliotheque(-1.95, Z4 + 0.2, 0, 1.9, 2.75);
  bibliotheque(2.3, Z4 + 0.2, 0, 1.3, 2.75);
  poser('LightsPunctualLamp', 1.55, 0, zD - 0.5, Math.PI - 0.25, 1.0, () => lampeChaude(1.0, 1.65, zD - 0.2, 3.4, 6));
  poser('ArmChair_01', 2.25, 0, -13.55, -2.4, 1.0);
  poser('DiffuseTransmissionPlant', 2.45, 0, -16.4, 2.6, 1.4);
  tapis(xD, zD + 0.25, 2.0, 2.8, Math.PI / 2, ['#6b3a2a', '#dccaa6', '#2a2f3c', '#9c7840']);

  // la chambre photographique declenche un flash
  const flashs = [{ lum: new THREE.PointLight(0xf4f6ff, 0, 9, 2), k: 0 }];
  flashs[0].lum.position.set(1.7, 1.9, -8.3); monde.add(flashs[0].lum);
  function declencher() { bruitage('obturateur'); flashs.forEach(f => { f.k = 1; }); }
  function devoiler() {}
  let demarre = 0;
  function demarrage() {
    if (!SON || !SON.estActif() || !SON.moteur) { bruitage('klaxon'); return; }
    if (demarre) return; const t0 = performance.now(); demarre = 1;
    (function pas() {
      const t = (performance.now() - t0) / 1000;
      let r = 900; if (t < 0.25) r = 900 + t * 2400; else if (t < 0.9) r = 1500 + Math.sin((t - 0.25) / 0.65 * Math.PI) * 5200; else if (t < 1.4) r = 1500 + Math.sin((t - 0.9) / 0.5 * Math.PI) * 3600; else r = 900;
      SON.moteur({ regime: r, charge: t < 1.4 ? 0.8 : 0.15, volume: t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 0.8), pan: 0, pop: t > 0.85 && t < 1.6 && Math.random() < 0.12 });
      if (t < 3.4) requestAnimationFrame(pas); else { if (SON.moteurCoupe) SON.moteurCoupe(); demarre = 0; }
    })();
  }

  // toutes les moulures en un seul objet
  if (geosMoulures.length) { const mg = new THREE.Mesh(mergeGeometries(geosMoulures, false), matMoulure); mg.castShadow = !PETIT; mg.receiveShadow = true; monde.add(mg); }

  // ═══════════ le rail : les arrets de la camera ═══════════
  const arrets = [
    { cam: new THREE.Vector3(2.1, 1.62, -0.35), vise: new THREE.Vector3(-1.4, 1.3, -6.0), ids: [], nom: "L'entrée" },
    arretMur('Le salon', 'G', -1.35, [idHermes], 2.55),
    { cam: new THREE.Vector3(-0.55, 1.5, zCh + 0.25), vise: new THREE.Vector3(XG, 1.25, zCh), ids: [idVoiture], nom: 'Le salon', voiture: true },
    arretMur('Le salon', 'G', -5.65, [idAtol], 2.55),
    { cam: new THREE.Vector3(-1.2, 1.58, -3.25), vise: new THREE.Vector3(-1.2, OEIL - 0.08, Z2), ids: [idFive, idHall], nom: 'Le salon' },
    arretMur('La galerie', 'D', -8.95, [idVoss, idUber], 2.75),
    arretMur('La galerie', 'D', -11.35, [idsAuto[3]], 2.45, { studio: true }),
    arretMur('La galerie', 'G', -11.35, [idsAuto[2]], 2.45),
    arretMur('La galerie', 'G', -8.95, [idsAuto[0], idsAuto[1]], 2.75),
    { cam: new THREE.Vector3(0.75, 1.58, -9.6), vise: new THREE.Vector3(-1.4, OEIL, Z3), ids: idsNuit, nom: 'La galerie' },
    { cam: new THREE.Vector3(0.85, 1.58, -15.0), vise: new THREE.Vector3(XG, 1.48, -15.2), ids: idsVideos.concat([idsAuto[4], idsAuto[5]]), nom: 'Le bureau' },
    { cam: new THREE.Vector3(0.3, 1.62, -13.45), vise: new THREE.Vector3(xD, 1.15, zD - 0.6), ids: [], nom: 'Le bureau', fin: true },
  ];
  const STATIONS = [];
  arrets.forEach((a, i) => { if (!STATIONS.length || STATIONS[STATIONS.length - 1].nom !== a.nom) STATIONS.push({ nom: a.nom, i }); });
  const rail = new THREE.CatmullRomCurve3(arrets.map(a => a.cam), false, 'centripetal', 0.5);
  const N = arrets.length;
  // quand tout est la, on prepare tous les materiaux d'un coup : plus d'a-coups
  // pendant le travelling quand un meuble entre dans le champ
  setTimeout(() => Promise.all(chargements).then(() => {
    const fin = () => majOmbres();
    if (renderer.compileAsync) renderer.compileAsync(monde, cam).then(fin, fin); else { renderer.compile(monde, cam); fin(); }
  }), 0);

  // ═══════════ ce qui bouge : le feu, les flashs, l'ecran, la musique ═══════════
  let tEcran = 0;
  function animer(dt, t) {
    for (const fl of flashs) { fl.k *= Math.pow(0.002, dt); fl.lum.intensity = fl.k * 40; }
    const tt = t * 0.001;
    for (const { f, ph, bougie } of flammes) { const a = 0.85 + Math.sin(tt * 9 + ph) * 0.08 + Math.sin(tt * 23 + ph * 2) * 0.06;
      f.scale.set(bougie ? 1 : 0.9 + Math.sin(tt * 5 + ph) * 0.1, a, 1); f.material.opacity = bougie ? 0.85 : 0.6 + Math.sin(tt * 13 + ph) * 0.2; }
    feu.intensity = 2.2 + Math.sin(tt * 11) * 0.35 + Math.sin(tt * 27) * 0.25 + pouls * 0.4;
    for (const { l, i } of lumieres) l.intensity = i * (0.94 + pouls * 0.08);
    tEcran += dt;
    if (texCartes.length && tEcran > 4.5) { tEcran = 0; vCourante = (vCourante + 1) % texCartes.length; matEcran.map = texCartes[vCourante].map; matEcran.needsUpdate = true; }
  }

  // ═══════════ les projecteurs qui suivent la visite ═══════════
  // une lumiere douce, de galerie, sur ce que l'on regarde
  const projecteurs = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.SpotLight(0xffe7c8, 10, 7, 0.5, 0.8, 2);
    monde.add(sp); monde.add(sp.target); projecteurs.push(sp);
  }
  function placerProjecteurs(s) {
    const base = Math.round(s);
    for (let i = 0; i < projecteurs.length; i++) {
      const a = arrets[Math.max(0, Math.min(N - 1, base - 1 + i))];
      const sp = projecteurs[i];
      const dir = a.cam.clone().sub(a.vise).setY(0).normalize();
      sp.position.copy(a.vise).addScaledVector(dir, 1.3).setY(HAUT - 0.3);
      sp.target.position.copy(a.vise);
      sp.intensity = a.fin ? 4 : a.voiture ? 5 : 6;
    }
  }
  // ═══════════ l'interface ═══════════
  const $ = id => document.getElementById(id);
  const elZN = $('zoneN'), elZT = $('zoneT'), elX = $('coordX'), elZ = $('coordZ');
  const elCT = $('cartelT'), elCC = $('cartelC'), elCA = $('cartelA');
  const railC = $('railCurseur'), railEl = $('rail'), elGuide = $('guide');
  const elFiche = $('fiche');
  let railH = railEl ? railEl.getBoundingClientRect().height : 200;
  // le rail et le menu affichent les six lieux
  if (railEl) {
    railEl.querySelectorAll('.rail-pt').forEach(b => b.remove());
    STATIONS.forEach((st, k) => { const b = document.createElement('button'); b.className = 'rail-pt'; b.dataset.zone = k;
      b.innerHTML = '<b>' + String(k + 1).padStart(2, '0') + '</b><i>' + st.nom + '</i>'; railEl.appendChild(b); });
  }
  const menu = $('menu');
  if (menu) menu.querySelectorAll('button[data-zone]').forEach(b => b.remove());   // le rail de droite suffit
  document.querySelectorAll('[data-zone]').forEach(b => b.addEventListener('click', () => { allerA(STATIONS[+b.dataset.zone].i); b.blur(); }));

  // ── la chasse ──
  const elCases = $('cases'), elCompte = $('compte'), elVisite = $('visite'), elBillet = $('billet');
  const vues = new Set(); let billetMontre = false;
  if (elCases) for (let i = 0; i < oeuvres.length; i++) elCases.appendChild(document.createElement('i'));
  const majCompte = () => { if (elCompte) elCompte.innerHTML = '&OElig;uvres vues <b>' + vues.size + '</b>/' + oeuvres.length; };
  majCompte();
  function vue(id) {
    if (vues.has(id)) return; vues.add(id);
    const c = elCases && elCases.children[id]; if (c) c.classList.add('vu');
    majCompte(); bruitage('cran');
  }
  function montrerBillet() {
    if (billetMontre || !elBillet) return; billetMontre = true;
    $('billetN').textContent = String(1 + Math.floor(Math.random() * 9998)).padStart(4, '0');
    const complet = vues.size >= oeuvres.length;
    elBillet.querySelector('h2').textContent = complet ? 'Vous avez tout vu.' : 'Fin de la visite.';
    elBillet.querySelector('.tampon').textContent = complet ? 'Visite complète' : vues.size + ' / ' + oeuvres.length + ' vues';
    elBillet.classList.add('on'); elBillet.setAttribute('aria-hidden', 'false');
    setTimeout(() => bruitage('tampon'), 520);
    arreterVisite();
  }
  $('billetX').addEventListener('click', () => { elBillet.classList.remove('on'); elBillet.setAttribute('aria-hidden', 'true'); });

  // ── la fiche ──
  let ouverte = null;
  function ouvrirFiche(id) {
    const o = oeuvres[id]; if (!o) return; vue(id);
    ouverte = id; bruitage('clac');
    const p = o.p;
    $('ficheN').textContent = String(id + 1).padStart(2, '0');
    $('ficheT').textContent = p.titre || ''; $('ficheC').textContent = p.cat || ''; $('ficheD').textContent = p.desc || '';
    const vis = $('ficheVis'); vis.innerHTML = '';
    if (p.groupe) pieces.filter(q => q.groupe === p.groupe && q.src !== p.src).slice(0, 4).forEach(q => {
      const im = document.createElement('img'); im.src = q.src; im.alt = q.titre || ''; im.loading = 'lazy'; vis.appendChild(im); });
    const go = $('ficheGo');
    if (p.video) { go.href = p.video; go.target = '_blank'; go.rel = 'noopener'; go.textContent = 'Voir la vidéo ↗'; }
    else { go.href = p.groupe ? 'index.html#p-' + p.groupe : 'index.html#portfolio'; go.removeAttribute('target'); go.textContent = 'Voir la fiche complète →'; }
    elFiche.classList.add('on'); elFiche.setAttribute('aria-hidden', 'false'); document.body.classList.add('fiche-ouverte');
  }
  function fermerFiche() {
    if (ouverte === null) return; ouverte = null; bruitage('clic');
    elFiche.classList.remove('on'); elFiche.setAttribute('aria-hidden', 'true'); document.body.classList.remove('fiche-ouverte');
  }
  $('ficheX').addEventListener('click', fermerFiche);

  // ═══════════ le defilement pilote la camera ═══════════
  let s = 0, sCible = 0, dernierGeste = 0, aBouge = false;
  const zoneDepart = location.hash === '#fin' || location.hash === '#contact' ? N - 1 : 0;
  s = sCible = zoneDepart;
  function compris() { if (aBouge) return; aBouge = true; if (elGuide) { elGuide.classList.add('parti'); setTimeout(() => elGuide.remove(), 800); } }
  let trajet = null;
  function allerA(i) {
    const c = Math.max(0, Math.min(N - 1, i)); if (c === sCible && trajet) return;
    sCible = c; dernierGeste = 0; compris(); fermerFiche(); bruitage('balai');
    const d = Math.abs(sCible - s); trajet = { de: s, vers: sCible, t0: performance.now(), duree: 1000 * (1.9 + Math.min(2.2, (d - 1) * 0.6)) };
  }
  // un geste = un arret : on cumule la molette, on avance d'un cran, puis on
  // ignore l'elan du geste (pave tactile, molette libre) tant qu'il dure
  let cumul = 0, verrou = 0, derniereMolette = 0;
  addEventListener('wheel', e => {
    if (elBillet && elBillet.classList.contains('on')) return;
    e.preventDefault(); arreterVisite();
    const now = performance.now(), d = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
    const calme = now - derniereMolette > 220; derniereMolette = now;
    if (now < verrou && !calme) { verrou = Math.max(verrou, now + 120); return; }
    if (calme) cumul = 0;
    cumul += d;
    if (Math.abs(cumul) > 60) { allerA(Math.round(sCible) + Math.sign(cumul)); cumul = 0; verrou = now + 1300; }
  }, { passive: false });
  addEventListener('keydown', e => {
    const k = e.key;
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' ', 's', 'd'].includes(k)) { e.preventDefault(); arreterVisite(); allerA(Math.round(sCible) + 1); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp', 'z', 'q'].includes(k)) { e.preventDefault(); arreterVisite(); allerA(Math.round(sCible) - 1); }
    else if (k === 'Home' || k === 'r') allerA(0);
    else if (k === 'End') allerA(N - 1);
    else if (k === 'Escape') fermerFiche();
  });
  // au doigt : on glisse pour avancer, on tape pour ouvrir
  let doigt = null;
  cv.addEventListener('pointerdown', e => { doigt = { x: e.clientX, y: e.clientY, t: performance.now(), glisse: false }; arreterVisite(); });
  addEventListener('pointermove', e => {
    souris.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    if (!doigt || e.pointerType === 'mouse') return;
    const dx = e.clientX - doigt.x, dy = e.clientY - doigt.y;
    if (!doigt.glisse && Math.hypot(dx, dy) > 10) doigt.glisse = true;
    if (doigt.glisse && !doigt.fait && Math.abs(dy + dx * 0.6) > 55) { doigt.fait = true; allerA(Math.round(sCible) + (dy + dx * 0.6 < 0 ? 1 : -1)); }
  }, { passive: true });
  addEventListener('pointerup', e => {
    const d = doigt; doigt = null;
    if (!d || d.glisse || performance.now() - d.t > 600 || e.target !== cv) return;
    const r = cv.getBoundingClientRect();
    pointeur.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    rayon.setFromCamera(pointeur, cam);
    const t = rayon.intersectObjects(cliquables, false);
    if (t.length && t[0].object.userData.clic) t[0].object.userData.clic.faire();
    else if (ouverte !== null) fermerFiche();
  });
  if (matchMedia('(pointer:coarse)').matches && elGuide) { const t = elGuide.querySelector('.guide-t'); if (t) t.innerHTML = 'Glissez pour avancer &middot; touchez pour ouvrir'; }

  // ── la visite automatique ──
  let visite = null;
  function arreterVisite() { if (!visite) return; clearTimeout(visite); visite = null;
    if (elVisite) { elVisite.setAttribute('aria-pressed', 'false'); elVisite.innerHTML = '&#9654; Visite auto'; } }
  function etape() { if (Math.round(sCible) >= N - 1) { arreterVisite(); return; } allerA(Math.round(sCible) + 1); visite = setTimeout(etape, 7500); }
  if (elVisite) {
    elVisite.innerHTML = '&#9654; Visite auto';
    elVisite.addEventListener('click', e => { e.stopPropagation(); if (visite) { arreterVisite(); return; }
      elVisite.setAttribute('aria-pressed', 'true'); elVisite.innerHTML = '&#9632; Arr&ecirc;ter'; visite = setTimeout(etape, 300); });
  }

  // ═══════════ la boucle ═══════════
  const rayon = new THREE.Raycaster(), souris = new THREE.Vector2(), sourisL = new THREE.Vector2(), pointeur = new THREE.Vector2();
  let survole = null;
  function dimensionner() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); if (composer) { composer.setSize(w, h); bloom.setSize(w, h); }
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  addEventListener('resize', () => { dimensionner(); if (railEl) railH = railEl.getBoundingClientRect().height; });
  dimensionner();
  // le clic de souris
  cv.addEventListener('click', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (survole && survole.userData.clic) survole.userData.clic.faire();
    else if (ouverte !== null) fermerFiche();
  });

  const pCam = new THREE.Vector3(), pVise = new THREE.Vector3(), vTmp = new THREE.Vector3();
  let dernier = performance.now(), arretPrec = -1, lieuPrec = '';
  const mesure = { n: 0, t: 0 }; let niveau = 0;
  function alleger(n) {
    if (n === 1 && passeAO) passeAO.enabled = false;                                   // l'occlusion ambiante
    if (n === 2) { densite = Math.min(densite, 1.1); renderer.setPixelRatio(densite); if (composer) composer.setPixelRatio(densite); dimensionner(); }
    if (n === 3) { if (bloom) bloom.enabled = false; if (miroir) { miroir.removeFromParent(); miroir = null; } }
    if (n === 4) { densite = 0.85; renderer.setPixelRatio(densite); if (composer) composer.setPixelRatio(densite); dimensionner(); }
  }
  function boucle(t) {
    requestAnimationFrame(boucle);
    const dt = Math.min((t - dernier) / 1000, 0.05); dernier = t;

    // quand on ne fait plus defiler, la camera se pose sur l'arret le plus proche
    // un travelling de cinema : une seule courbe douce, qui demarre et se pose lentement
    if (trajet) { const u = Math.min(1, (performance.now() - trajet.t0) / trajet.duree);
      const k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      s = trajet.de + (trajet.vers - trajet.de) * k; if (u >= 1) { s = trajet.vers; trajet = null; } }
    const i0 = Math.min(N - 2, Math.floor(s)), e = s - i0;
    rail.getPoint((i0 + e) / (N - 1), pCam);
    pVise.copy(arrets[i0].vise).lerp(arrets[i0 + 1].vise, e);
    // un leger mouvement de tete : la camera respire, et suit un peu la souris
    pCam.x += Math.sin(t * 0.00031) * 0.03; pCam.y += Math.sin(t * 0.00047) * 0.02;
    vTmp.copy(pVise).sub(pCam).normalize();
    const lat = new THREE.Vector3(-vTmp.z, 0, vTmp.x);
    sourisL.lerp(souris, 1 - Math.exp(-dt * 3));
    pVise.addScaledVector(lat, sourisL.x * 0.3).y += sourisL.y * 0.18;
    cam.position.copy(pCam); cam.lookAt(pVise);

    // l'arret courant : la chasse, le studio, la voiture, le bureau
    const ia = Math.round(s), a = arrets[ia];
    if (Math.abs(s - ia) < 0.12 && ia !== arretPrec) {
      arretPrec = ia;
      a.ids.forEach(vue);
      if (a.studio) setTimeout(declencher, 400);
      if (a.voiture) setTimeout(devoiler, 300);
      if (a.fin) setTimeout(montrerBillet, 1500);
    }
    placerProjecteurs(s);
    // le lieu ou l'on est
    if (a.nom !== lieuPrec) {
      lieuPrec = a.nom;
      const k = STATIONS.findIndex(st => st.nom === a.nom);
      elZN.textContent = 'Station ' + String(k + 1).padStart(2, '0'); elZT.textContent = a.nom;
      elZT.animate && elZT.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      document.querySelectorAll('[data-zone]').forEach(b => b.classList.toggle('ici', +b.dataset.zone === k));
      if (ia > 0) bruitage('page');
    }
    elX.textContent = String(ia + 1).padStart(2, '0'); elZ.textContent = String(N).padStart(2, '0');
    if (railC) railC.style.top = (4 + (s / (N - 1)) * (railH - 8)) + 'px';

    animer(dt, t);

    // ce que la souris designe (au doigt, on tape directement : pas de survol)
    if (!doigt && !TACTILE) {
      rayon.setFromCamera(souris, cam);
      const touche = rayon.intersectObjects(cliquables, false);
      const n = touche.length && touche[0].distance < 14 ? touche[0].object : null;
      if (n !== survole) {
        survole = n; document.body.classList.toggle('vise', !!n); cv.style.cursor = n ? 'pointer' : '';
        if (n) { elCT.textContent = n.userData.clic.nom; elCC.textContent = n.userData.clic.cat || ''; if (elCA) elCA.style.display = n.userData.oeuvre !== undefined ? '' : 'none'; bruitage('tic'); }
      }
    }

    if (miroir) miroir.visible = pCam.z > Z2 - 0.3;
    // la qualite s'adapte a la machine : si les images tardent, on allege
    mesure.n++; mesure.t += dt;
    if (mesure.t > 2.5) { const fps = mesure.n / mesure.t; mesure.n = 0; mesure.t = 0;
      if (performance.now() > 6000 && fps < 45 && niveau < 4) { niveau++; alleger(niveau); } }
    if (pellicule) pellicule.uniforms.t.value = performance.now() * 0.001;
    if (composer) composer.render(); else renderer.render(monde, cam);
  }
  placerProjecteurs(s);
  requestAnimationFrame(boucle);
  return { arrets: N, oeuvres: oeuvres.length };
}
