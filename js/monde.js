// ═══════════════════════════════════════════════════════════════════════
// L'ATELIER — le lieu de travail de Jaurys Maigret, la nuit
//
// On n'y marche pas : on fait defiler, et la camera glisse sur un rail,
// comme un travelling de cinema. Elle s'arrete devant chaque piece, puis
// repart. Six stations : l'entree, le mur d'affiches, le coin studio photo
// avec ses tirages, la 991 sous son drap, le poste de montage, et le
// bureau de Jaurys, ou la visite se termine.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/addons/environments/RoomEnvironment.js';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/addons/postprocessing/ShaderPass.js';

const ROUGE = 0xd42a1b;
const DEMI = 9;          // demi-largeur de l'atelier
const HAUT = 5.4;        // hauteur sous plafond
const Z_ENTREE = 10, Z_FOND = -64;
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
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, PETIT ? 1.5 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !PETIT;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const monde = new THREE.Scene();
  monde.background = new THREE.Color(0x030304);
  monde.fog = new THREE.FogExp2(0x070707, 0.014);
  const cam = new THREE.PerspectiveCamera(PETIT ? 62 : 52, 1, 0.05, 200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  monde.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  monde.environmentIntensity = 0.18;

  // les neons et les ampoules diffusent leur lumiere dans l'image (ordinateur)
  let composer = null, bloom = null, pellicule = null;
  if (!PETIT) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(monde, cam));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.45, 0.93);
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
  const texSol = texPixels(RES, RES, (d, w) => {
    for (let k = 0; k < w * w; k++) {
      const x = k % w, y = (k / w) | 0;
      let v = 30 + nB[k] * 30 + hasard(k) * 6;
      v *= 0.72 + tache(x, y) * 0.5;                              // nuages du cirage
      if (x < 2.5 * Q || y < 2.5 * Q) v *= 0.3; else if (x < 5 * Q || y < 5 * Q) v *= 0.82;
      d[k * 4] = v * 1.04; d[k * 4 + 1] = v; d[k * 4 + 2] = v * 0.94; d[k * 4 + 3] = 255;
    }
  }, false, (g, w) => {
    rayures(g, w, 70, 'rgba(120,114,104,1)', 4.2);
    for (let i = 0; i < 5; i++) {                                 // auréoles de liquide seche
      const x = hasard(i * 2.3) * w, y = hasard(i * 5.9) * w, r = (0.04 + hasard(i) * 0.08) * w;
      const gr = g.createRadialGradient(x, y, r * 0.75, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.85, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  const texSolR = texPixels(RES, RES, (d, w) => {
    for (let k = 0; k < w * w; k++) { const x = k % w, y = (k / w) | 0;
      let v = 70 + tache(x, y) * 110 + nB[k] * 30;                // cire usee par endroits
      if (x < 5 * Q || y < 5 * Q) v = 235;
      d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true, (g, w) => rayures(g, w, 70, 'rgba(255,255,255,1)', 4.2));
  const texSolB = texPixels(RES, RES, (d, w) => {
    for (let k = 0; k < w * w; k++) { const x = k % w, y = (k / w) | 0;
      let v = 150 + (nB[k] - 0.5) * 60 + (hasard(k * 1.7) - 0.5) * 14;
      if (x < 2.5 * Q || y < 2.5 * Q) v = 40;
      d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true);
  // le beton brut des murs : empreinte des planches de coffrage, joints, trous de tiges, coulures
  const PL = 21 * Q;                                              // hauteur d'une planche
  const texMur = texPixels(RES, RES, (d, w) => {
    for (let k = 0; k < w * w; k++) {
      const x = k % w, y = (k / w) | 0, pl = (y / PL) | 0, fy = (y % PL) / PL;
      let v = 46 + nM[k] * 34 + hasard(k) * 7;
      v *= 0.9 + hasard(pl * 3.3 + ((x / (160 * Q)) | 0) * 0.71) * 0.2;      // chaque planche sa teinte
      v += Math.sin(x * 0.11 / Q + nB[k] * 9 + pl * 4.1) * 2.6;               // le fil du bois imprime
      if (fy < 0.06) v *= 0.78;                                                // arete entre planches
      const col = (x / (6 * Q)) | 0, h = hasard(col * 5.31);                   // coulures depuis le haut
      if (h > 0.9) v *= 1 - (1 - y / w) * (h - 0.9) * 5 * (0.6 + nB[k] * 0.6);
      if (x < 2 * Q || y < 2 * Q) v *= 0.55;                                    // joint de banche
      const tx = (x % (128 * Q)) - 64 * Q, ty = (y % (170 * Q)) - 85 * Q, r2 = tx * tx + ty * ty;
      if ((x / (128 * Q) | 0) % 2 === 0) { if (r2 < 18 * Q * Q) v *= 0.4; else if (r2 < 40 * Q * Q) v *= 0.85; }
      v *= 1 - Math.pow(y / w, 6) * 0.35;                                       // remontee d'humidite en bas
      d[k * 4] = v; d[k * 4 + 1] = v * 0.98; d[k * 4 + 2] = v * 0.95; d[k * 4 + 3] = 255;
    }
  });
  const texMurB = texPixels(RES, RES, (d, w) => {
    for (let k = 0; k < w * w; k++) { const x = k % w, y = (k / w) | 0, fy = (y % PL) / PL;
      let v = 120 + (nM[k] - 0.5) * 110 + (hasard(k * 3.1) - 0.5) * 40;
      if (hasard(k * 0.37) > 0.985) v -= 90;                                    // bulles d'air du beton
      if (fy < 0.06) v -= 50;
      if (x < 2 * Q || y < 2 * Q) v = 20;
      const tx = (x % (128 * Q)) - 64 * Q, ty = (y % (170 * Q)) - 85 * Q;
      if ((x / (128 * Q) | 0) % 2 === 0 && tx * tx + ty * ty < 18 * Q * Q) v = 0;
      d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true);
  // le liege du tableau
  const texLiege = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const r = Math.random(); const v = 0.55 + nM[k] * 0.3 + r * 0.25;
      d[k * 4] = 150 * v; d[k * 4 + 1] = 104 * v; d[k * 4 + 2] = 64 * v; d[k * 4 + 3] = 255; }
  });
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
  // le beton du plafond, plus sombre et plus doux
  const texPlafond = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const v = 14 + nM[k * 4 % nM.length] * 14 + hasard(k) * 3; d[k * 4] = v; d[k * 4 + 1] = v; d[k * 4 + 2] = v * 1.02; d[k * 4 + 3] = 255; }
  });
  // la toile de coton de la housse : trame, fils irreguliers, salissures
  const texToile = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const x = k % w, y = (k / w) | 0;
      const trame = (Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) > 0 ? 1 : 0.86) * (0.93 + hasard(((y / 2) | 0) * 1.9) * 0.1);
      const v = trame * (0.78 + nM[(k * 3) % nM.length] * 0.3);
      d[k * 4] = 255 * v; d[k * 4 + 1] = 248 * v; d[k * 4 + 2] = 236 * v; d[k * 4 + 3] = 255; }
  });
  const texToileB = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const x = k % w, y = (k / w) | 0;
      const v = 128 + Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) * 70 + (hasard(k) - 0.5) * 30; d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
  }, true);
  texToile.repeat.set(5, 5); texToileB.repeat.set(5, 5);
  // le papier de fond studio : fibres et legeres marbrures
  const texPapier = texPixels(256, 256, (d, w) => {
    for (let k = 0; k < w * w; k++) { const v = 0.93 + (nB[(k * 5) % nB.length] - 0.5) * 0.1 + (hasard(k) - 0.5) * 0.04;
      d[k * 4] = 255 * v; d[k * 4 + 1] = 254 * v; d[k * 4 + 2] = 250 * v; d[k * 4 + 3] = 255; }
  }, false, (g, w) => rayures(g, w, 18, 'rgba(150,146,138,.6)', 3.3));
  const texHalo = toile(256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const texAngle = toile(4, 256, (g, w, h) => {
    const l = g.createLinearGradient(0, 0, 0, h);
    l.addColorStop(0, 'rgba(0,0,0,1)'); l.addColorStop(0.35, 'rgba(0,0,0,.45)'); l.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = l; g.fillRect(0, 0, w, h);
  });
  const additif = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  // chaque matiere recoit un grain : metal brosse pour le metal, micro-relief pour le reste
  texGrainR.repeat.set(2, 2); texGrainB.repeat.set(2, 2); texBrosse.repeat.set(1, 3);
  const mat = (color, roughness = 0.8, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness,
    roughnessMap: metalness > 0.5 ? texBrosse : texGrainR, bumpMap: texGrainB, bumpScale: metalness > 0.5 ? 0.15 : 0.35 }, extra));
  const acier = mat(0x1d1e21, 0.35, 0.85);
  const noirMat = mat(0x0b0b0c, 0.6, 0.2);
  function boite(w, h, d, m, x, y, z, parent) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; (parent || monde).add(b); return b; }

  // ═══════════ le lieu ═══════════
  const LONG = Z_ENTREE - Z_FOND, MIL = (Z_ENTREE + Z_FOND) / 2;
  texSol.repeat.set(DEMI * 2 / 4, LONG / 4); texSolR.repeat.copy(texSol.repeat); texSolB.repeat.copy(texSol.repeat);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(DEMI * 2, LONG),
    new THREE.MeshStandardMaterial({ map: texSol, roughnessMap: texSolR, roughness: 1, metalness: 0, bumpMap: texSolB, bumpScale: 0.45 }));
  sol.rotation.x = -Math.PI / 2; sol.position.z = MIL; sol.receiveShadow = true; monde.add(sol);

  texMur.repeat.set(LONG / 5, HAUT / 5); texMurB.repeat.copy(texMur.repeat);
  const matMur = new THREE.MeshStandardMaterial({ map: texMur, bumpMap: texMurB, bumpScale: 0.8, roughness: 0.95, metalness: 0 });
  for (const c of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(LONG, HAUT), matMur);
    m.rotation.y = -c * Math.PI / 2; m.position.set(c * DEMI, HAUT / 2, MIL); m.receiveShadow = true; monde.add(m);
    // l'ombre des angles
    const a1 = new THREE.Mesh(new THREE.PlaneGeometry(LONG, 0.8), new THREE.MeshBasicMaterial({ map: texAngle, transparent: true, opacity: 0.5, depthWrite: false }));
    a1.rotation.y = -c * Math.PI / 2; a1.rotation.z = Math.PI; a1.position.set(c * (DEMI - 0.01), 0.4, MIL); monde.add(a1);
    const a2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, LONG), new THREE.MeshBasicMaterial({ map: texAngle, transparent: true, opacity: 0.55, depthWrite: false }));
    a2.rotation.x = -Math.PI / 2; a2.rotation.z = -c * Math.PI / 2; a2.position.set(c * (DEMI - 0.6), 0.004, MIL); monde.add(a2);
  }
  const texMurF = texMur.clone(); texMurF.repeat.set(DEMI * 2 / 5, HAUT / 5); texMurF.needsUpdate = true;
  const matMurF = matMur.clone(); matMurF.map = texMurF;
  for (const [z, ry] of [[Z_FOND, 0], [Z_ENTREE, Math.PI]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(DEMI * 2, HAUT), matMurF);
    f.position.set(0, HAUT / 2, z); f.rotation.y = ry; f.receiveShadow = true; monde.add(f);
  }
  texPlafond.repeat.set(DEMI * 2 / 3, LONG / 3);
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(DEMI * 2, LONG), mat(0xffffff, 0.95, 0, { map: texPlafond, bumpMap: texPlafond, bumpScale: 0.6 }));
  pf.rotation.x = Math.PI / 2; pf.position.set(0, HAUT, MIL); monde.add(pf);
  // les poutres metalliques, et les suspensions industrielles
  const ampoules = [];
  const matAmpoule = new THREE.MeshBasicMaterial({ color: 0xffd39a });
  for (let z = Z_ENTREE - 4; z > Z_FOND; z -= 6) {
    boite(DEMI * 2, 0.34, 0.2, acier, 0, HAUT - 0.17, z);
    const cordon = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.5, 6), noirMat);
    cordon.position.set(0, HAUT - 0.75, z - 3); monde.add(cordon);
    const abat = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 24, 1, true), mat(0x111214, 0.4, 0.8, { side: THREE.DoubleSide }));
    abat.position.set(0, HAUT - 1.6, z - 3); monde.add(abat);
    const amp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), matAmpoule.clone());
    amp.position.set(0, HAUT - 1.72, z - 3); monde.add(amp); ampoules.push(amp);
  }
  // les verrieres de nuit, en haut du mur gauche
  const matVitre = new THREE.MeshBasicMaterial({ color: 0x0e1b2e });
  for (let z = 6; z > -22; z -= 3.2) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), matVitre);
    v.rotation.y = Math.PI / 2; v.position.set(-DEMI + 0.02, 4.25, z); monde.add(v);
    for (const dy of [-0.8, 0, 0.8]) boite(0.05, 0.05, 2.9, acier, -DEMI + 0.05, 4.25 + dy, z);
    for (const dz of [-1.4, -0.47, 0.47, 1.4]) boite(0.05, 1.65, 0.05, acier, -DEMI + 0.05, 4.25, z + dz);
  }

  // ═══════════ lumiere ═══════════
  monde.add(new THREE.AmbientLight(0xc8beb2, 0.34));
  monde.add(new THREE.HemisphereLight(0xe8dccb, 0x0e0e10, 0.32));
  const lune = new THREE.DirectionalLight(0x8fb2e8, 0.35); lune.position.set(-12, 9, -6); monde.add(lune);
  const suit = new THREE.PointLight(0xffe6cc, 10, 16, 2); monde.add(suit);

  // ═══════════ les objets cliquables ═══════════
  const cliquables = [];      // { mesh, nom, cat, faire }
  function cliquable(mesh, nom, cat, faire) { mesh.userData.clic = { nom, cat, faire }; cliquables.push(mesh); }

  // ═══════════ le neon de l'entree ═══════════
  const texNeon = toile(1024, 300, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = '170px Anton, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff3322'; g.shadowBlur = 30; g.fillStyle = '#ff5a44'; g.fillText("L'ATELIER", w / 2, h / 2 - 20);
    g.shadowBlur = 0; g.fillStyle = '#ffd9d2'; g.fillText("L'ATELIER", w / 2, h / 2 - 20);
    g.font = '500 26px "IBM Plex Mono", monospace'; g.letterSpacing = '7px'; g.fillStyle = '#ff8a7a';
    g.fillText('JAURYS MAIGRET · DIRECTION ARTISTIQUE', w / 2, h - 40);
  });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.35), new THREE.MeshBasicMaterial({ map: texNeon, transparent: true, depthWrite: false, toneMapped: false }));
  neon.position.set(0, 3.5, -1.5); monde.add(neon);
  for (const dx of [-1.6, 1.6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, HAUT - 4.2, 4), noirMat); c.position.set(dx, (HAUT + 4.2) / 2, -1.52); monde.add(c); }
  const halNeon = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.6), additif(texHalo, 0xff3a22, 0.05)); halNeon.position.set(0, 3.5, -1.56); monde.add(halNeon);
  const lumNeon = new THREE.PointLight(0xff3a22, 6, 9, 2); lumNeon.position.set(0, 3.2, -1.2); monde.add(lumNeon);

  // ═══════════ les pieces ═══════════
  const chargeur = new THREE.TextureLoader();
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  function texture(src) { const t = chargeur.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
  const oeuvres = [];   // tout ce qui compte pour la chasse
  function oeuvre(p, mesh) { const id = oeuvres.length; oeuvres.push({ p, mesh }); mesh.userData.oeuvre = id;
    cliquable(mesh, p.titre, p.cat, () => ouvrirFiche(id)); return id; }

  // une feuille de papier n'est jamais plate : elle ondule un peu
  function papierGeo(W, H) {
    const g = new THREE.PlaneGeometry(W, H, 16, 20); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.sin(x * 5.1 + y * 1.3) * 0.006 + Math.sin(y * 7.3) * 0.004 + (Math.abs(x) / W) * 0.012); }
    g.computeVertexNormals(); return g;
  }
  // l'ombre douce qu'un objet pose laisse au sol
  const matOmbre = new THREE.MeshBasicMaterial({ map: texHalo, color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
  function ombreSol(x, z, w, d, op) { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matOmbre.clone()); o.material.opacity = op || 0.6;
    o.rotation.x = -Math.PI / 2; o.position.set(x, 0.006, z); monde.add(o); return o; }
  // un cable qui court au sol
  const matCable = mat(0x070708, 0.55);
  function cable(points) { const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1] === undefined ? 0.012 : p[1], p[2])));
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 60, 0.011, 6), matCable); m.castShadow = true; monde.add(m); return m; }

  // ── station 1 : le mur d'affiches (mur gauche) ──
  const DA = ['hermes', 'atol', 'fiveguys', 'halloween', 'uber', 'voss'];
  const matScotch = new THREE.MeshStandardMaterial({ color: 0xb9b09a, roughness: 0.7, transparent: true, opacity: 0.55 });
  const matPunaise = mat(ROUGE, 0.35, 0.3);
  const affiches = [];
  function scotcher(parent, w, h, z0) {
    for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), matScotch);
      s.position.set(sx * (w / 2 - 0.02), sy * (h / 2 - 0.01), z0 + 0.003); s.rotation.z = sx * sy * 0.7; parent.add(s);
    }
  }
  const stationsAffiches = [];
  let zA = -1.4;
  DA.forEach(g => {
    const prim = pieces.find(p => p.groupe === g && !p.secondaire); if (!prim) return;
    const H = prim.h > prim.w ? 1.75 : 1.25, W = H * prim.w / prim.h;
    const zc = zA - W / 2;
    const grp = new THREE.Group(); grp.position.set(-DEMI + 0.03, 0, zc); grp.rotation.y = Math.PI / 2; monde.add(grp);
    const m = new THREE.Mesh(papierGeo(W, H), new THREE.MeshStandardMaterial({ map: texture(prim.src), roughness: 0.75 }));
    m.position.set(0, 1.95, 0.025); m.receiveShadow = true; m.castShadow = true; grp.add(m); scotcher(m, W, H, 0.012);
    // dessous, des restes d'anciennes affiches arrachees
    for (let r = 0; r < 5; r++) {
      const lam = new THREE.Mesh(papierGeo(0.18 + Math.random() * 0.32, 0.1 + Math.random() * 0.28),
        new THREE.MeshStandardMaterial({ color: [0x8f8a7e, 0x7a7468, 0x6e2a22, 0x9a958a][r % 4], roughness: 0.95 }));
      lam.position.set((Math.random() - 0.5) * (W + 0.5), 1.95 + (Math.random() - 0.5) * (H + 0.3), 0.004 + r * 0.0008);
      lam.rotation.z = (Math.random() - 0.5) * 0.5; lam.receiveShadow = true; grp.add(lam);
    }
    const id = oeuvre(prim, m);
    // les epreuves du meme projet, punaisees en dessus, plus petites
    const secs = pieces.filter(p => p.groupe === g && p.secondaire).slice(0, 3);
    secs.forEach((s, k) => {
      const h2 = 0.62, w2 = h2 * s.w / s.h;
      const e = new THREE.Mesh(new THREE.PlaneGeometry(w2, h2), new THREE.MeshStandardMaterial({ map: texture(s.src), roughness: 0.75, side: THREE.DoubleSide }));
      const ex = (k - (secs.length - 1) / 2) * Math.max(0.78, w2 + 0.12);
      e.position.set(ex, 3.32 + (k % 2) * 0.06, 0.012); e.rotation.z = (k % 2 ? 1 : -1) * 0.03; grp.add(e);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), matPunaise); pu.position.set(0, h2 / 2 - 0.05, 0.012); e.add(pu);
      e.userData.repos = { pos: e.position.clone(), rot: e.rotation.clone() };
      cliquable(e, s.titre, 'Épreuve · cliquez', () => decoller(e));
      affiches.push(e);
    });
    stationsAffiches.push({ cam: new THREE.Vector3(-4.4, 1.7, zc + 0.6), vise: new THREE.Vector3(-DEMI, 2.15, zc), ids: [id], nom: "Le mur d'affiches" });
    zA -= W + 1.45;
  });
  // une epreuve se decolle et tombe, puis on la repunaise
  const chutes = [];
  function decoller(e) {
    if (e.userData.tombe) return;
    e.userData.tombe = { t: 0, vr: (Math.random() - 0.5) * 3 };
    bruitage('chute'); chutes.push(e);
  }

  // ── station 2 : le coin studio photo (tirages a droite, fond papier a gauche) ──
  const photos = pieces.filter(p => !p.groupe && !/nuit-/.test(p.src));
  const nuits = pieces.filter(p => /nuit-/.test(p.src));
  // une tablette pour poser les tirages contre le mur droit
  const zT0 = -21;
  boite(0.32, 0.05, 15, mat(0x16110d, 0.7), DEMI - 0.17, 0.92, zT0 - 7);
  const stationsPhotos = [];
  let zP = zT0;
  const matCadreP = mat(0x0e0e10, 0.4, 0.6);
  photos.forEach((p, k) => {
    const H = p.h > p.w ? 1.25 : 0.95, W = H * p.w / p.h;
    const zc = zP - W / 2;
    const grp = new THREE.Group(); grp.position.set(DEMI - 0.22, 0.95, zc); grp.rotation.y = -Math.PI / 2; grp.rotation.x = -0.12; monde.add(grp);
    boite(W + 0.06, H + 0.06, 0.03, matCadreP, 0, H / 2, -0.02, grp);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: texture(p.src), roughness: 0.5 }));
    m.position.set(0, H / 2, 0.0); grp.add(m);
    const id = oeuvre(p, m);
    if (k % 2 === 0) stationsPhotos.push({ cam: null, vise: null, ids: [id], z: [zc] });
    else { const s = stationsPhotos[stationsPhotos.length - 1]; s.ids.push(id); s.z.push(zc); }
    zP -= W + 0.45;
  });
  stationsPhotos.forEach(s => {
    const zm = s.z.reduce((a, b) => a + b, 0) / s.z.length;
    s.cam = new THREE.Vector3(4.1, 1.6, zm + 0.5); s.vise = new THREE.Vector3(DEMI, 1.45, zm); s.nom = 'Le studio photo';
  });
  // la serie de nuit : quatre tirages en grille, au mur
  const zN = zP - 2.2;
  const idsNuit = [];
  nuits.forEach((p, k) => {
    const W = 1.5, H = W * p.h / p.w;
    const grp = new THREE.Group(); grp.position.set(DEMI - 0.04, 0, zN - (k % 2) * 1.75); grp.rotation.y = -Math.PI / 2; monde.add(grp);
    const y = k < 2 ? 2.75 : 1.55;
    boite(W + 0.08, H + 0.08, 0.04, matCadreP, 0, y, 0.01, grp);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: texture(p.src), roughness: 0.45 }));
    m.position.set(0, y, 0.035); grp.add(m);
    idsNuit.push(oeuvre(p, m));
  });
  const stationNuit = { cam: new THREE.Vector3(3.6, 1.8, zN - 0.4), vise: new THREE.Vector3(DEMI, 2.15, zN - 0.88), ids: idsNuit, nom: 'Le studio photo' };

  // le plateau photo : un fond papier qui descend du mur et s'arrondit sur le
  // sol, deux flashs de part et d'autre, l'appareil sur pied, et sur le
  // papier une bouteille VOSS, comme en pleine prise de vue
  const zS = -28.5;
  const profil = new THREE.Shape();
  profil.moveTo(0, 3.6); profil.lineTo(0, 0.9); profil.absarc(0.9, 0.9, 0.9, Math.PI, Math.PI * 1.5, false); profil.lineTo(2.6, 0);
  profil.lineTo(2.6, 0.015); profil.lineTo(0.9, 0.015); profil.absarc(0.9, 0.9, 0.885, Math.PI * 1.5, Math.PI, true); profil.lineTo(0.015, 3.6); profil.closePath();
  const geoFond = new THREE.ExtrudeGeometry(profil, { depth: 4.4, bevelEnabled: false, curveSegments: 24 }); geoFond.translate(0, 0, -2.2);
  texPapier.repeat.set(0.6, 0.6);
  const fond = new THREE.Mesh(geoFond, mat(0xbdbcb7, 0.93, 0, { map: texPapier, bumpMap: texPapier, bumpScale: 0.4 })); fond.position.set(-DEMI + 0.25, 0.004, zS); fond.receiveShadow = true; monde.add(fond);
  for (const dz of [-2.25, 2.25]) boite(0.03, 3.7, 0.03, acier, -DEMI + 0.25, 1.85, zS + dz);
  const rouleau = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 16), mat(0xa9a8a3, 0.9)); rouleau.rotation.x = Math.PI / 2; rouleau.position.set(-DEMI + 0.3, 3.68, zS); monde.add(rouleau);
  // la bouteille
  const bouteille = new THREE.Group(); bouteille.position.set(-DEMI + 1.9, 0.02, zS); monde.add(bouteille);
  const verre = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 32), new THREE.MeshPhysicalMaterial({ color: 0xdfe6ea, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.38, clearcoat: 1 }));
  verre.position.y = 0.15; bouteille.add(verre);
  const eau = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 24), new THREE.MeshPhysicalMaterial({ color: 0xbfd0da, roughness: 0.1, transparent: true, opacity: 0.3 })); eau.position.y = 0.135; bouteille.add(eau);
  const bouchon = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.06, 32), mat(0x6c7076, 0.35, 0.8)); bouchon.position.y = 0.33; bouteille.add(bouchon);
  const texVoss = toile(256, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.font = '300 40px Helvetica, Arial, sans-serif'; g.letterSpacing = '14px'; g.fillStyle = '#f4f6f8'; g.textAlign = 'center'; g.fillText('VOSS', w / 2 + 7, 46); });
  const etiq = new THREE.Mesh(new THREE.CylinderGeometry(0.0565, 0.0565, 0.05, 32, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ map: texVoss, transparent: true })); etiq.position.y = 0.17; etiq.rotation.y = Math.PI / 2; bouteille.add(etiq);
  const flashs = [];
  [-1, 1].forEach(c => {
    const pied = new THREE.Group(); pied.position.set(-4.9, 0, zS + c * 2.7); monde.add(pied);
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), acier); l.position.set(Math.cos(i * 2.1) * 0.25, 0.48, Math.sin(i * 2.1) * 0.25); l.rotation.set(Math.sin(i * 2.1) * 0.45, 0, -Math.cos(i * 2.1) * 0.45); pied.add(l); }
    const mat2 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 8), acier); mat2.position.y = 1.7; pied.add(mat2);
    // la boite a lumiere vise le centre du plateau
    const boitier = new THREE.Group(); boitier.position.y = 2.4; pied.add(boitier);
    boitier.lookAt(new THREE.Vector3(-DEMI + 1.9, 0.6, zS).sub(pied.position).add(new THREE.Vector3(0, 0, 0)));
    const sb = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.55, 4, 1, true), mat(0x0c0c0d, 0.8, 0, { side: THREE.DoubleSide })); sb.rotation.x = -Math.PI / 2; sb.rotation.y = Math.PI / 4; sb.position.z = 0.2; boitier.add(sb);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.84), new THREE.MeshBasicMaterial({ color: 0x2a2826, toneMapped: false })); face.position.z = 0.47; boitier.add(face);
    const lum = new THREE.PointLight(0xf4f6ff, 0, 12, 2); lum.position.set(0, 0, 0.9); boitier.add(lum);
    flashs.push({ face, lum, k: 0 });
    cliquable(face, 'Flash de studio', 'Cliquez pour déclencher', () => declencher());
    cliquable(sb, 'Flash de studio', 'Cliquez pour déclencher', () => declencher());
  });
  function declencher() { bruitage('obturateur'); flashs.forEach((f, i) => setTimeout(() => { f.k = 1; }, i * 35)); }
  // l'appareil photo sur son trepied, face a la bouteille
  const trepied = new THREE.Group(); trepied.position.set(-4.3, 0, zS - 0.2); trepied.rotation.y = -Math.PI / 2 + 0.05; monde.add(trepied);
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 6), acier); l.position.set(Math.cos(i * 2.1) * 0.2, 0.55, Math.sin(i * 2.1) * 0.2); l.rotation.set(Math.sin(i * 2.1) * 0.32, 0, -Math.cos(i * 2.1) * 0.32); trepied.add(l); }
  const boitierP = boite(0.15, 0.1, 0.09, noirMat, 0, 1.2, 0, trepied);
  const objectif = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.11, 18), mat(0x111111, 0.3, 0.6)); objectif.rotation.x = Math.PI / 2; objectif.position.set(0, 1.19, 0.09); trepied.add(objectif);
  cliquable(boitierP, "L'appareil photo", 'Cliquez pour déclencher', () => declencher());
  cliquable(verre, 'VOSS, sur le plateau', 'Cliquez pour déclencher', () => declencher());
  const stationStudio = { cam: new THREE.Vector3(-0.6, 1.55, zS + 0.4), vise: new THREE.Vector3(-DEMI + 1.6, 0.9, zS), ids: [], nom: 'Le studio photo', studio: true };

  // ── station 3 : la 991 sous son drap ──
  const zC = Math.min(zN - 7.5, -45);
  const voiture = construire991();
  voiture.groupe.position.set(0.4, 0.09, zC); voiture.groupe.rotation.y = -0.32; monde.add(voiture.groupe);
  const estrade = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.4, 0.09, 64), mat(0x0d0d0f, 0.35, 0.5));
  estrade.position.set(0.4, 0.045, zC); estrade.receiveShadow = true; monde.add(estrade);
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(3.36, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: 0xff2a14, toneMapped: false }));
  anneau.rotation.x = Math.PI / 2; anneau.position.set(0.4, 0.07, zC); monde.add(anneau);
  const tpOeuvre = pieces.find(p => p.groupe === 'halloween') || { titre: 'Talon Pointe', cat: 'Automobile', desc: '' };
  const idVoiture = oeuvre({ titre: 'La 991 de Talon Pointe', cat: 'Alternance · concession de véhicules de luxe',
    desc: "Chargé de communication en alternance chez Talon Pointe : photo, vidéo, réseaux sociaux et storytelling pour une concession de véhicules de luxe. Cliquez sur la voiture pour l'entendre.",
    groupe: 'halloween', src: tpOeuvre.src }, voiture.corps);
  cliquables.splice(cliquables.indexOf(voiture.corps), 1);
  [voiture.corps, voiture.drap].forEach(m => cliquable(m, 'La 991 de Talon Pointe', 'Cliquez : moteur', () => { if (!voiture.devoile) devoiler(); else demarrage(); }));
  const stationVoiture = { cam: new THREE.Vector3(-1.9, 1.3, zC + 6.2), vise: new THREE.Vector3(0.3, 0.7, zC), ids: [idVoiture], nom: 'La 991', voiture: true };
  function devoiler() {
    if (voiture.devoile) return; voiture.devoile = true; voiture.tDrap = 0;
    bruitage('rideau');
  }
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

  // ── station 4 : le poste de montage (mur gauche) ──
  const zM = zC - 8;
  boite(2.8, 0.05, 0.85, mat(0xa89684, 0.55, 0, { map: texBois, roughnessMap: texBoisR }), -DEMI + 0.6, 0.76, zM).rotation.y = Math.PI / 2;
  for (const dz of [-1.3, 1.3]) for (const dx of [-0.35, 0.35]) boite(0.04, 0.74, 0.04, acier, -DEMI + 0.6 + dx, 0.37, zM + dz);
  const idsVideos = [];
  const posEcrans = [[-DEMI + 0.85, 1.2, zM + 0.95, 0.78], [-DEMI + 0.75, 1.24, zM, 0.95], [-DEMI + 0.85, 1.2, zM - 0.95, 0.78], [-DEMI + 0.06, 2.45, zM + 0.8, 1.25], [-DEMI + 0.06, 2.45, zM - 0.8, 1.25]];
  const ecrans = [];
  videos.slice(0, 5).forEach((v, k) => {
    const [x, y, z, w] = posEcrans[k]; const h = w * 9 / 16;
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = Math.PI / 2 + (k < 3 ? (k - 1) * -0.25 : 0); monde.add(grp);
    boite(w + 0.04, h + 0.04, 0.03, noirMat, 0, 0, -0.02, grp);
    if (k < 3) { boite(0.04, 0.32, 0.04, acier, 0, -h / 2 - 0.14, -0.03, grp); boite(0.22, 0.012, 0.16, acier, 0, -h / 2 - 0.3, -0.03, grp); }
    const id = (v.vsrc.match(/(?:youtu\.be\/|v=)([\w-]{11})/) || [])[1];
    const titreCarte = toile(640, 360, (g, W, H) => { g.fillStyle = '#0b0d11'; g.fillRect(0, 0, W, H); g.fillStyle = '#d42a1b'; g.fillRect(0, 0, W, 8);
      g.font = '42px Anton, sans-serif'; g.fillStyle = '#fff'; g.fillText(v.titre.slice(0, 26), 30, 200); g.font = '500 18px "IBM Plex Mono", monospace'; g.fillStyle = '#a9b7c6'; g.fillText(v.cat.toUpperCase().slice(0, 42), 30, 240); });
    const ecranMat = new THREE.MeshBasicMaterial({ map: titreCarte, toneMapped: false });
    ecranMat.color.setScalar(0.78);
    const src = v.poster || (id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '');
    if (src) chargeur.load(src, t => { t.colorSpace = THREE.SRGBColorSpace; ecranMat.map = t; ecranMat.needsUpdate = true; }, undefined, () => {});
    const ecran = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ecranMat); ecran.position.z = 0.0; grp.add(ecran);
    const lecture = new THREE.Mesh(new THREE.CircleGeometry(h * 0.13, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false }));
    lecture.position.z = 0.004; lecture.rotation.z = 0; grp.add(lecture);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.2, h * 2.4), additif(texHalo, 0x9fc0ff, 0.06)); halo.position.z = -0.04; grp.add(halo);
    ecrans.push(ecranMat);
    idsVideos.push(oeuvre({ titre: v.titre, cat: v.cat, desc: v.desc, video: v.vsrc }, ecran));
  });
  // le clavier, le casque
  boite(0.44, 0.02, 0.15, noirMat, -DEMI + 0.4, 0.79, zM).rotation.y = Math.PI / 2;
  const casque = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24, Math.PI), noirMat); casque.position.set(-DEMI + 0.5, 0.86, zM - 1.15); casque.rotation.set(-Math.PI / 2, 0, 0.4); monde.add(casque);
  const stationMontage = { cam: new THREE.Vector3(-3.4, 1.6, zM + 0.3), vise: new THREE.Vector3(-DEMI + 0.5, 1.55, zM), ids: idsVideos, nom: 'Le poste de montage' };

  // ── station 5 : le bureau de Jaurys, au fond ──
  const zD = Z_FOND + 2.4;
  boite(2.2, 0.06, 0.95, mat(0xb8a594, 0.5, 0, { map: texBois, roughnessMap: texBoisR }), 0, 0.76, zD);
  for (const dx of [-1, 1]) for (const dz of [-0.4, 0.4]) boite(0.05, 0.74, 0.05, acier, dx, 0.37, zD + dz);
  // le CV pose sur le bureau
  const cvPapier = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.48), new THREE.MeshStandardMaterial({ map: texture('images/cv-apercu.jpg'), roughness: 0.85 }));
  cvPapier.rotation.x = -Math.PI / 2; cvPapier.rotation.z = 0.08; cvPapier.position.set(-0.35, 0.795, zD + 0.12); cvPapier.castShadow = true; monde.add(cvPapier);
  cliquable(cvPapier, 'Mon CV', 'Clic · ouvrir le PDF', () => window.open('CV-Jaurys-Maigret.pdf', '_blank'));
  // le telephone
  const texTel = toile(256, 512, (g, w, h) => { g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h); g.fillStyle = '#d42a1b'; g.beginPath(); g.arc(w / 2, 200, 46, 0, 7); g.fill();
    g.font = '600 30px "IBM Plex Mono", monospace'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('Jaurys', w / 2, 300); g.font = '500 22px "IBM Plex Mono", monospace'; g.fillStyle = '#a9b7c6'; g.fillText(TEL, w / 2, 340); g.fillText('Appeler', w / 2, 420); });
  const tel = boite(0.085, 0.01, 0.17, noirMat, 0.25, 0.795, zD + 0.22); tel.rotation.y = -0.3;
  const telEcran = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.155), new THREE.MeshBasicMaterial({ map: texTel, toneMapped: false }));
  telEcran.rotation.x = -Math.PI / 2; telEcran.position.y = 0.006; tel.add(telEcran);
  cliquable(tel, TEL, 'Clic · appeler', () => { location.href = 'tel:+33609977401'; });
  cliquable(telEcran, TEL, 'Clic · appeler', () => { location.href = 'tel:+33609977401'; });
  // l'ordinateur portable, ouvert sur un mail
  const texMail = toile(800, 500, (g, w, h) => { g.fillStyle = '#f2efe9'; g.fillRect(0, 0, w, h); g.fillStyle = '#d42a1b'; g.fillRect(0, 0, w, 10);
    g.fillStyle = '#121214'; g.font = '600 34px "IBM Plex Sans", sans-serif'; g.fillText('Nouveau message', 40, 80);
    g.font = '500 26px "IBM Plex Mono", monospace'; g.fillStyle = '#555'; g.fillText('À : ' + MAIL, 40, 150);
    g.fillText('Objet : Alternance en direction artistique', 40, 195); g.fillStyle = '#121214'; g.font = '400 28px "IBM Plex Sans", sans-serif';
    g.fillText('Bonjour Jaurys,', 40, 270); g.fillText('nous aimerions vous rencontrer…', 40, 315);
    g.fillStyle = '#d42a1b'; g.fillRect(40, 380, 220, 64); g.fillStyle = '#fff'; g.font = '600 26px "IBM Plex Mono", monospace'; g.fillText('Envoyer ↗', 70, 422); });
  const portable = new THREE.Group(); portable.position.set(0.55, 0.79, zD - 0.12); portable.rotation.y = -0.35; monde.add(portable);
  boite(0.44, 0.018, 0.3, acier, 0, 0.009, 0, portable);
  const capot = new THREE.Group(); capot.position.set(0, 0.018, -0.15); capot.rotation.x = -0.28; portable.add(capot);
  boite(0.44, 0.3, 0.012, acier, 0, 0.15, 0, capot);
  const ecranMail = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.26), new THREE.MeshBasicMaterial({ map: texMail, toneMapped: false })); ecranMail.position.set(0, 0.15, 0.007); capot.add(ecranMail);
  ecranMail.material.color.setScalar(0.85);
  cliquable(ecranMail, MAIL, 'Clic · écrire', () => { location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Alternance en direction artistique'); });
  // la lampe de bureau
  const lampe = new THREE.Group(); lampe.position.set(-0.85, 0.79, zD - 0.25); monde.add(lampe);
  const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.025, 24), noirMat); lampe.add(pl);
  const bras1 = boite(0.018, 0.42, 0.018, noirMat, 0, 0.21, 0, lampe); bras1.rotation.z = 0.25;
  const tetel = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 24, 1, true), mat(0x101012, 0.4, 0.7, { side: THREE.DoubleSide }));
  tetel.position.set(0.16, 0.44, 0.05); tetel.rotation.z = -1.0; lampe.add(tetel);
  const ampL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffdba8, toneMapped: false })); ampL.position.set(0.2, 0.41, 0.05); lampe.add(ampL);
  const lumLampe = new THREE.SpotLight(0xffd3a0, 8, 4, 0.8, 0.6, 2); lumLampe.position.set(-0.65, 1.2, zD - 0.2); lumLampe.target.position.set(-0.2, 0.78, zD + 0.1);
  if (!PETIT) { lumLampe.castShadow = true; lumLampe.shadow.mapSize.set(512, 512); }
  monde.add(lumLampe); monde.add(lumLampe.target);
  let lampeOn = true;
  const basculer = () => { lampeOn = !lampeOn; lumLampe.intensity = lampeOn ? 8 : 0; ampL.material.color.set(lampeOn ? 0xffdba8 : 0x222222); bruitage('clic'); };
  cliquable(tetel, 'La lampe', 'Clic · allumer, éteindre', basculer);
  cliquable(pl, 'La lampe', 'Clic · allumer, éteindre', basculer);
  // la tasse, aux initiales
  const tasse = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 24), mat(0xefebe3, 0.4)); tasse.position.set(0.05, 0.84, zD - 0.3); monde.add(tasse);
  // le mur du fond : le titre peint, le tableau de liege du parcours, la porte
  const texTitre = toile(1400, 520, (g, w, h) => { g.font = '500 32px "IBM Plex Mono", monospace'; g.letterSpacing = '12px'; g.fillStyle = '#ff4433'; g.fillText('LE BUREAU · ALTERNANCE DÈS MAINTENANT', 10, 60);
    g.letterSpacing = '2px'; g.font = '190px Anton, sans-serif'; g.fillStyle = '#ece8e1'; g.fillText('Parlons de', 0, 260); g.fillText('votre projet.', 0, 450); });
  const titre = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.5), new THREE.MeshStandardMaterial({ map: texTitre, transparent: true, roughness: 0.9, emissive: 0xffffff, emissiveMap: texTitre, emissiveIntensity: 0.22 }));
  titre.position.set(0.3, 1.62, Z_FOND + 0.02); monde.add(titre);
  // le parcours, sur le liege
  const liege = boite(2.1, 1.25, 0.03, new THREE.MeshStandardMaterial({ map: texLiege, roughness: 0.95 }), -5.2, 1.85, Z_FOND + 0.03);
  function feuille(lignes, x, y, rz) {
    const t = toile(600, 760, (g, w, h) => { g.fillStyle = '#f3efe6'; g.fillRect(0, 0, w, h); let yy = 70;
      for (const [type, txt] of lignes) {
        if (type === 'h') { g.font = '60px Anton, sans-serif'; g.fillStyle = '#121214'; g.fillText(txt, 40, yy + 30); yy += 80; }
        else if (type === 's') { g.font = '500 22px "IBM Plex Mono", monospace'; g.fillStyle = '#d42a1b'; g.fillText(txt.toUpperCase(), 40, yy + 20); yy += 40; }
        else { g.font = '400 25px "IBM Plex Sans", sans-serif'; g.fillStyle = '#33343a'; const mots = txt.split(' '); let l = '';
          for (const m of mots) { if (g.measureText(l + m).width > w - 80) { g.fillText(l, 40, yy + 20); yy += 34; l = ''; } l += m + ' '; } g.fillText(l, 40, yy + 20); yy += 50; }
      } });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.04), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    f.position.set(x, y, Z_FOND + 0.06); f.rotation.z = rz; monde.add(f);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), matPunaise); pu.position.set(0, 0.47, 0.01); f.add(pu);
  }
  feuille([['h', 'Expériences'], ['s', 'Talon Pointe · 2025-2026'], ['p', 'Chargé de communication en alternance : photo, vidéo, réseaux sociaux.'],
           ['s', 'AGCO · 2024'], ['p', 'Social media, newsletters, retouche.'], ['s', 'Tredelec · 2024'], ['p', 'Contenu publicitaire, idées créatives.']], -5.65, 1.85, -0.03);
  feuille([['h', 'Formation'], ['s', '2026 · Master DA (M1)'], ['p', 'ESP Paris, en cours.'], ['s', '2025 · Bachelor (B3)'], ['p', 'Création publicitaire, ESP Paris.'],
           ['s', '2023 · BTS Communication'], ['p', 'Amiens.']], -4.75, 1.82, 0.04);
  // la porte : on revient au portfolio
  const porte = boite(1.1, 2.3, 0.06, mat(0x141416, 0.5, 0.6), 5.4, 1.15, Z_FOND + 0.04);
  const texPorte = toile(400, 160, (g, w, h) => { g.fillStyle = '#d42a1b'; g.fillRect(0, 0, w, h); g.font = '600 34px "IBM Plex Mono", monospace'; g.fillStyle = '#fff'; g.fillText('SORTIE', 30, 70); g.font = '500 22px "IBM Plex Mono", monospace'; g.fillText('← le portfolio', 30, 120); });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: texPorte, toneMapped: false })); plaque.position.set(5.4, 1.75, Z_FOND + 0.08); monde.add(plaque);
  cliquable(porte, 'Sortie', 'Clic · revenir au portfolio', () => { location.href = 'index.html#portfolio'; });
  cliquable(plaque, 'Sortie', 'Clic · revenir au portfolio', () => { location.href = 'index.html#portfolio'; });
  const stationBureau = { cam: new THREE.Vector3(0.15, 1.5, zD + 2.05), vise: new THREE.Vector3(0, 0.95, zD - 0.2), ids: [], nom: 'Le bureau', fin: true };

  // ═══════════ les details : l'atelier vit ═══════════
  // le batiment : gaines au plafond, tableau electrique, extincteur, sortie de secours
  for (const x of [-6.2, 6.2]) {
    const gaine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, LONG, 10), acier); gaine.rotation.x = Math.PI / 2; gaine.position.set(x, HAUT - 0.45, MIL); monde.add(gaine);
    for (let z = Z_ENTREE - 2; z > Z_FOND; z -= 3) { boite(0.1, 0.06, 0.06, acier, x, HAUT - 0.45, z); }
  }
  const gaine2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, LONG, 16), mat(0x2a2b2e, 0.45, 0.7)); gaine2.rotation.x = Math.PI / 2; gaine2.position.set(3.2, HAUT - 0.6, MIL); monde.add(gaine2);
  boite(0.12, 0.7, 0.5, mat(0x3a3d42, 0.5, 0.6), DEMI - 0.06, 1.6, 6.2);
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 18), mat(0xb3130c, 0.35, 0.2)); ext.position.set(DEMI - 0.14, 0.75, 4.6); ext.castShadow = true; monde.add(ext);
  const extT = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10), noirMat); extT.position.set(DEMI - 0.14, 1.03, 4.6); monde.add(extT);
  const texSortie = toile(256, 96, (g, w, h) => { g.fillStyle = '#0a7a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9fff2'; g.font = '600 44px "IBM Plex Sans", sans-serif'; g.textAlign = 'center'; g.fillText('SORTIE', w / 2 + 18, 64);
    g.beginPath(); g.arc(34, 46, 16, 0, 7); g.fill(); });
  const sortie = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: texSortie, toneMapped: false })); sortie.position.set(5.4, 2.55, Z_FOND + 0.05); monde.add(sortie);
  sortie.material.color.setScalar(1.6);

  // le mur d'affiches : une palette avec des tubes, un chariot de tirages
  const zPal = zA + 0.6;
  boite(1.2, 0.14, 0.8, mat(0xf0dcc0, 0.85, 0, { map: texBois, roughnessMap: texBoisR }), -DEMI + 0.9, 0.07, zPal); ombreSol(-DEMI + 0.9, zPal, 1.6, 1.2);
  for (let k = 0; k < 7; k++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9 + (k % 3) * 0.12, 14), mat([0xd9d4c7, 0x1a1a1c, 0xb0a993][k % 3], 0.8));
    t.rotation.z = Math.PI / 2; t.rotation.y = 0.1 * (k % 2); t.position.set(-DEMI + 0.9, 0.19 + Math.floor(k / 4) * 0.09, zPal - 0.3 + (k % 4) * 0.1); t.castShadow = true; monde.add(t); }
  // sur le mur, un nuancier punaise et des croquis
  const texNuancier = toile(256, 128, (g, w, h) => { const cs = ['#d42a1b', '#f2efe9', '#121214', '#e0b347', '#2a4b7c', '#7c8a96']; cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 6, 0, w / 6 - 3, h * 0.72); });
    g.fillStyle = '#eee'; g.fillRect(0, h * 0.72, w, h * 0.28); g.fillStyle = '#333'; g.font = '500 14px monospace'; g.fillText('PALETTE · CAMPAGNES', 8, h - 12); });
  const nuancier = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: texNuancier, roughness: 0.8 })); nuancier.rotation.y = Math.PI / 2; nuancier.position.set(-DEMI + 0.04, 1.0, zA + 0.4); monde.add(nuancier);

  // le studio : marques de scotch au sol, sacs de sable, reflecteur, cables
  const matGaffer = mat(0xe8e2cf, 0.7);
  for (const [x, z, r] of [[-DEMI + 1.9, zS, 0.6], [-4.9, zS - 2.7, 0.2], [-4.9, zS + 2.7, -0.3], [-4.3, zS - 0.2, 0.9]]) for (const a of [0.78, -0.78]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.045), matGaffer); t.rotation.x = -Math.PI / 2; t.rotation.z = a + r; t.position.set(x, 0.008, z); monde.add(t); }
  for (const c of [-1, 1]) { const sac = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 10), mat(0x2c2a26, 0.95)); sac.rotation.z = Math.PI / 2; sac.position.set(-4.9, 0.09, zS + c * 2.7 + 0.18); sac.castShadow = true; monde.add(sac);
    ombreSol(-4.9, zS + c * 2.7, 1.0, 1.0, 0.5);
    cable([[-4.9, , zS + c * 2.7], [-4.0, , zS + c * 2.2], [-3.0, , zS + c * 3.4], [-DEMI + 0.3, , zS + c * 3.9]]); }
  const refl = new THREE.Mesh(new THREE.CircleGeometry(0.45, 40), mat(0xe4e6e8, 0.35, 0.55, { side: THREE.DoubleSide }));
  refl.position.set(-6.6, 0.9, zS - 1.4); refl.rotation.y = -0.9; monde.add(refl); boite(0.02, 0.9, 0.02, acier, -6.6, 0.45, zS - 1.4);
  ombreSol(-4.3, zS - 0.2, 0.8, 0.8, 0.45);

  // la 991 : l'ombre de contact sous la caisse
  ombreSol(0.4, zC, 5.2, 2.6, 0.75).rotation.z = -0.32;

  // le poste de montage : chaise, enceintes, tasse, post-it, cables
  function chaise(x, z, ry) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; monde.add(c);
    const assise = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.48), mat(0x161618, 0.7)); assise.position.y = 0.5; assise.castShadow = true; c.add(assise);
    const dos = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.06), mat(0x161618, 0.7)); dos.position.set(0, 0.85, -0.24); dos.rotation.x = -0.12; dos.castShadow = true; c.add(dos);
    const fut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 10), acier); fut.position.y = 0.27; c.add(fut);
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.3), acier); b.position.set(Math.sin(k * 1.2566) * 0.15, 0.06, Math.cos(k * 1.2566) * 0.15); b.rotation.y = k * 1.2566; c.add(b);
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), noirMat); r.position.set(Math.sin(k * 1.2566) * 0.29, 0.025, Math.cos(k * 1.2566) * 0.29); c.add(r); }
    ombreSol(x, z, 1.0, 1.0, 0.55);
  }
  chaise(-DEMI + 1.55, zM + 0.1, -Math.PI / 2 - 0.25);
  for (const dz of [-1.25, 1.25]) { boite(0.14, 0.24, 0.16, noirMat, -DEMI + 0.4, 0.9, zM + dz);
    const hp = new THREE.Mesh(new THREE.CircleGeometry(0.045, 18), mat(0x2a2a2c, 0.5, 0.4)); hp.rotation.y = Math.PI / 2; hp.position.set(-DEMI + 0.475, 0.88, zM + dz); monde.add(hp); }
  const tasseM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 20), mat(0x15151a, 0.4)); tasseM.position.set(-DEMI + 0.75, 0.83, zM - 0.6); monde.add(tasseM);
  for (const [dz, dy, c] of [[0.3, 0.02, 0xf2d04a], [0.38, -0.06, 0xf08ab0]]) { const pi = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), mat(c, 0.9)); pi.rotation.y = Math.PI / 2 + 0.25; pi.position.set(-DEMI + 0.8, 1.48 + dy, zM + 0.95 + dz); monde.add(pi); }
  cable([[-DEMI + 0.3, 0.78, zM + 0.9], [-DEMI + 0.25, 0.4, zM + 0.6], [-DEMI + 0.2, , zM], [-DEMI + 0.05, , zM - 0.8]]);
  ombreSol(-DEMI + 0.6, zM, 1.4, 3.2, 0.5);

  // le bureau de Jaurys : livres, stylos, plante, cartes de visite, chaise
  const livres = [[0x1b1b1f, 0.04], [0x9c2116, 0.03], [0x8f897d, 0.035]];
  let yL = 0.79; livres.forEach(([c, h], k) => { const l = boite(0.24, h, 0.17, mat(c, 0.75), -0.95 + (k % 2) * 0.01, yL + h / 2, zD + 0.3, null); l.rotation.y = 0.2 - k * 0.08; yL += h; });
  for (let k = 0; k < 2; k++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 8), mat(k ? 0xd42a1b : 0x111111, 0.4)); st.rotation.z = Math.PI / 2; st.rotation.y = 0.3 + k * 0.2; st.position.set(0.0 + k * 0.03, 0.8, zD + 0.32); monde.add(st); }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.048, 0.11, 18), mat(0xcfc8bb, 0.85)); pot.position.set(0.92, 0.845, zD - 0.3); monde.add(pot);
  for (let k = 0; k < 9; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.22 + Math.random() * 0.1, 5), mat(0x2f5a33, 0.8)); const a = k * 0.7;
    f.position.set(0.92 + Math.cos(a) * 0.03, 0.98, zD - 0.3 + Math.sin(a) * 0.03); f.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); monde.add(f); }
  const texCarte = toile(256, 150, (g, w, h) => { g.fillStyle = '#0b0c0f'; g.fillRect(0, 0, w, h); g.fillStyle = '#d42a1b'; g.fillRect(0, h - 10, w, 10);
    g.fillStyle = '#fff'; g.font = '40px Anton, sans-serif'; g.fillText('J.M', 18, 60); g.font = '500 14px "IBM Plex Mono", monospace'; g.fillStyle = '#a9b7c6'; g.fillText('DIRECTION ARTISTIQUE', 18, 92); g.fillText(TEL, 18, 116); });
  for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.002, 0.05), [noirMat, noirMat, new THREE.MeshStandardMaterial({ map: texCarte, roughness: 0.7 }), noirMat, noirMat, noirMat]);
    c.position.set(0.32, 0.79 + k * 0.002, zD + 0.38); c.rotation.y = 0.15 + k * 0.05; monde.add(c); }
  chaise(0.05, zD - 0.85, Math.PI);
  ombreSol(0, zD, 3.0, 1.6, 0.55);
  cable([[0.6, 0.78, zD - 0.3], [0.7, 0.5, zD - 0.45], [0.9, , zD - 0.5], [3.0, , Z_FOND + 0.2]]);

  // ═══════════ le rail : les arrets de la camera ═══════════
  const arrets = [{ cam: new THREE.Vector3(0, 1.7, 7.6), vise: new THREE.Vector3(0, 2.6, -6), ids: [], nom: "L'entrée" }]
    .concat(stationsAffiches, stationsPhotos.slice(0, 2), [stationStudio], stationsPhotos.slice(2), [stationNuit, stationVoiture, stationMontage, stationBureau]);
  // les stations du menu : le premier arret de chaque lieu
  const STATIONS = [];
  arrets.forEach((a, i) => { if (!STATIONS.length || STATIONS[STATIONS.length - 1].nom !== a.nom) STATIONS.push({ nom: a.nom, i }); });
  const rail = new THREE.CatmullRomCurve3(arrets.map(a => a.cam), false, 'centripetal', 0.5);
  const N = arrets.length;

  // ═══════════ la 991, d'apres son profil ═══════════
  function construire991() {
    const k = 4.5 / 605, sol0 = 209.7;
    const P = (x, y) => new THREE.Vector2((x - 320) * k, (sol0 - y) * k);
    function forme(d) {
      const s = new THREE.Shape(); const t = d.match(/[MLCAZ]|-?\d*\.?\d+/g); let i = 0, cx = 0, cy = 0;
      const n = () => parseFloat(t[i++]);
      while (i < t.length) {
        const c = t[i++];
        if (c === 'M') { cx = n(); cy = n(); const p = P(cx, cy); s.moveTo(p.x, p.y); }
        else if (c === 'L') { cx = n(); cy = n(); const p = P(cx, cy); s.lineTo(p.x, p.y); }
        else if (c === 'C') { const a = P(n(), n()), b = P(n(), n()); cx = n(); cy = n(); const e = P(cx, cy); s.bezierCurveTo(a.x, a.y, b.x, b.y, e.x, e.y); }
        else if (c === 'A') { // arc en cercle : on le decoupe en segments
          const r = n(); n(); n(); const grand = n(), sens = n(), x2 = n(), y2 = n();
          const mx = (cx - x2) / 2, my = (cy - y2) / 2; const d2 = mx * mx + my * my;
          const f = Math.sqrt(Math.max(0, (r * r - d2) / d2)) * (grand === sens ? -1 : 1);
          const ox = f * my + (cx + x2) / 2, oy = -f * mx + (cy + y2) / 2;
          let a0 = Math.atan2(cy - oy, cx - ox), a1 = Math.atan2(y2 - oy, x2 - ox);
          let da = a1 - a0; if (sens && da < 0) da += Math.PI * 2; if (!sens && da > 0) da -= Math.PI * 2;
          for (let j = 1; j <= 16; j++) { const a = a0 + da * j / 16; const p = P(ox + r * Math.cos(a), oy + r * Math.sin(a)); s.lineTo(p.x, p.y); }
          cx = x2; cy = y2;
        } else if (c === 'Z') s.closePath();
      }
      return s;
    }
    const CAISSE = 'M34 188 L104 183 A50 50 0 1 1 197.5 183 L429.5 183 A51 51 0 1 1 525 183 L590 180 C606 180 614 176 617 168 L621 140 C622 122 620 108 612 98 C606 94 600 92 592 90 C560 80 520 60 474 48 C434 38 396 33 364 34 C348 35 338 39 328 45 L252 86 C210 90 150 96 108 101 C80 104 52 112 36 122 C24 130 17 142 16 156 C15 170 20 184 34 188 Z';
    const V1 = 'M264 88 L330 49 C342 42 354 39 368 39 L404 40 L406 88 Z';
    const V2 = 'M414 41 C440 44 466 52 488 66 C496 72 496 82 488 86 L414 88 Z';
    const g = new THREE.Group();
    const LARG = 1.5;
    const geo = new THREE.ExtrudeGeometry(forme(CAISSE), { depth: LARG, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.09, bevelSegments: 6, curveSegments: 28 });
    geo.translate(0, 0, -LARG / 2);
    const peinture = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0f, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
    const corps = new THREE.Mesh(geo, peinture); corps.castShadow = true; corps.receiveShadow = true; g.add(corps);
    const verre = new THREE.MeshPhysicalMaterial({ color: 0x2a3644, metalness: 0.85, roughness: 0.05, clearcoat: 1 });
    const joint = mat(0x9aa3ad, 0.3, 0.9);
    for (const v of [V1, V2]) {
      const gv = new THREE.ExtrudeGeometry(forme(v), { depth: LARG + 0.44, bevelEnabled: false, curveSegments: 16 }); gv.translate(0, 0, -(LARG + 0.44) / 2); g.add(new THREE.Mesh(gv, verre));
      const gj = new THREE.ExtrudeGeometry(forme(v), { depth: LARG + 0.43, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.012, bevelSegments: 1, curveSegments: 16 }); gj.translate(0, 0, -(LARG + 0.43) / 2);
      const mj = new THREE.Mesh(gj, joint); mj.scale.set(1, 1, 0.999); g.add(mj);
    }
    // les roues
    const pneu = mat(0x0a0a0b, 0.85), etrier = mat(ROUGE, 0.4, 0.2);
    // la jante a cinq branches, dessinee une fois
    const texJante = toile(256, 256, (c, w) => {
      c.fillStyle = '#16181b'; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, 7); c.fill();
      c.strokeStyle = '#c9ced4'; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 9, 0, 7); c.stroke();
      c.fillStyle = '#c3c8cf';
      for (let k = 0; k < 5; k++) { c.save(); c.translate(w / 2, w / 2); c.rotate(k * Math.PI * 2 / 5);
        c.beginPath(); c.moveTo(-13, -20); c.lineTo(-22, -w / 2 + 14); c.lineTo(22, -w / 2 + 14); c.lineTo(13, -20); c.fill(); c.restore(); }
      c.fillStyle = '#2a2e33'; c.beginPath(); c.arc(w / 2, w / 2, 26, 0, 7); c.fill();
      c.fillStyle = '#c3c8cf'; c.beginPath(); c.arc(w / 2, w / 2, 12, 0, 7); c.fill();
    });
    const jante = new THREE.MeshStandardMaterial({ map: texJante, metalness: 0.85, roughness: 0.28 });
    for (const x of [151, 477]) for (const c of [-1, 1]) {
      const p = P(x, 165);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.333, 0.333, 0.27, 40), pneu); r.rotation.x = Math.PI / 2; r.position.set(p.x, p.y, c * 0.78); r.castShadow = true; g.add(r);
      const j = new THREE.Mesh(new THREE.CircleGeometry(0.25, 40), jante); j.position.set(p.x, p.y, c * 0.916); if (c < 0) j.rotation.y = Math.PI; g.add(j);
      const e = boite(0.09, 0.12, 0.03, etrier, p.x - 0.12 * (x < 300 ? -1 : 1), p.y + 0.08, c * 0.9, g);
    }
    // les details : disques de frein, retroviseurs, poignees, aileron, echappements, plaque
    for (const x of [151, 477]) for (const c of [-1, 1]) {
      const p = P(x, 165);
      const disque = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 32), mat(0x55595f, 0.35, 0.9)); disque.rotation.x = Math.PI / 2; disque.position.set(p.x, p.y, c * 0.885); g.add(disque);
    }
    const chrome = mat(0x111214, 0.25, 0.8);
    for (const c of [-1, 1]) {
      const pm = P(262, 92);
      const tige = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.1), chrome); tige.position.set(pm.x, pm.y, c * 0.98); g.add(tige);
      const retro = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), peinture); retro.scale.set(1.1, 0.7, 0.55); retro.position.set(pm.x - 0.02, pm.y + 0.03, c * 1.06); g.add(retro);
      const ph = P(366, 110);
      boite(0.13, 0.025, 0.012, chrome, ph.x, ph.y, c * 0.955, g);
      const ps = P(320, 178);
      boite(2.3, 0.03, 0.012, mat(0x050506, 0.5), ps.x, ps.y, c * 0.95, g);     // le bas de caisse
    }
    const pa = P(585, 84);
    const aileron = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.025, 1.35), peinture); aileron.position.set(pa.x, pa.y + 0.035, 0); aileron.rotation.z = 0.12; g.add(aileron);
    for (const c of [-0.35, -0.22, 0.22, 0.35]) { const pe = P(612, 180); const e = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 18), mat(0x8c9198, 0.2, 0.95)); e.rotation.z = Math.PI / 2; e.position.set(pe.x + 0.04, pe.y, c); g.add(e); }
    const texPlaque = toile(256, 56, (cx, w, h) => { cx.fillStyle = '#f3f3f1'; cx.fillRect(0, 0, w, h); cx.fillStyle = '#1a3fa0'; cx.fillRect(0, 0, 22, h); cx.fillStyle = '#111'; cx.font = '600 34px "IBM Plex Mono", monospace'; cx.fillText('TP-991-JM', 30, 40); });
    const plaque2 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.095), new THREE.MeshStandardMaterial({ map: texPlaque, roughness: 0.5 }));
    const pp2 = P(622, 145); plaque2.position.set(pp2.x + 0.012, pp2.y, 0); plaque2.rotation.y = Math.PI / 2; g.add(plaque2);
    // les feux : le bandeau arriere rouge, les phares ronds
    const feu = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, LARG + 0.2), new THREE.MeshBasicMaterial({ color: 0xff2414, toneMapped: false }));
    const pf2 = P(616, 100); feu.position.set(pf2.x + 0.02, pf2.y, 0); g.add(feu);
    for (const c of [-1, 1]) { const ph = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 12), new THREE.MeshBasicMaterial({ color: 0xeaf2ff, toneMapped: false }));
      const pp = P(40, 120); ph.position.set(pp.x + 0.08, pp.y, c * 0.58); ph.scale.set(0.6, 1, 1); g.add(ph); }
    // le drap : la forme de la voiture, elargie, tombant jusqu'au sol, plissee
    const gd = geo.clone(); const pos = gd.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) * 1.05, y = pos.getY(i), z = pos.getZ(i) * 1.18;
      if (y < 0.42) y = 0.01 + Math.max(0, y - 0.3) * 0.2;
      y = y * 1.06 + 0.02;
      const pli = Math.sin(x * 9 + z * 3) * 0.018 + Math.sin(x * 23 - z * 7) * 0.008;
      pos.setXYZ(i, x, y + pli, z + pli);
    }
    gd.computeVertexNormals();
    const drap = new THREE.Mesh(gd, new THREE.MeshStandardMaterial({ color: 0x5f5b56, roughness: 0.97, side: THREE.DoubleSide, transparent: true, opacity: 1, map: texToile, bumpMap: texToileB, bumpScale: 0.6 }));
    drap.castShadow = true; drap.receiveShadow = true; g.add(drap);
    return { groupe: g, corps, drap, devoile: false, tDrap: -1 };
  }

  // ═══════════ les projecteurs qui suivent la visite ═══════════
  const projecteurs = [];
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.SpotLight(0xffe2bd, 30, 14, 0.46, 0.55, 2);
    if (!PETIT) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0004; sp.shadow.normalBias = 0.02; sp.shadow.camera.near = 0.3; sp.shadow.camera.far = 16; }
    monde.add(sp); monde.add(sp.target); projecteurs.push(sp);
  }
  function placerProjecteurs(s) {
    const base = Math.round(s);
    for (let i = 0; i < projecteurs.length; i++) {
      const a = arrets[Math.max(0, Math.min(N - 1, base - 1 + i))];
      const sp = projecteurs[i];
      const dir = a.cam.clone().sub(a.vise).setY(0).normalize();
      sp.position.copy(a.vise).addScaledVector(dir, 1.8).setY(HAUT - 0.4);
      sp.target.position.copy(a.vise);
      sp.intensity = a.voiture ? 60 : a.fin ? 34 : a.studio ? 18 : 30;
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
  function pousser(d) { sCible = Math.max(0, Math.min(N - 1, sCible + d)); dernierGeste = performance.now(); compris(); if (ouverte !== null) fermerFiche(); }
  function allerA(i) { sCible = Math.max(0, Math.min(N - 1, i)); dernierGeste = 0; compris(); fermerFiche(); bruitage('balai'); }
  addEventListener('wheel', e => {
    if (elBillet && elBillet.classList.contains('on')) return;
    e.preventDefault(); arreterVisite();
    const d = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
    pousser(Math.max(-0.9, Math.min(0.9, d / 260)));
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
    if (doigt.glisse) { pousser(-(dy + dx * 0.6) / 260); doigt.x = e.clientX; doigt.y = e.clientY; }
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
  function etape() { if (Math.round(sCible) >= N - 1) { arreterVisite(); return; } allerA(Math.round(sCible) + 1); visite = setTimeout(etape, 4200); }
  if (elVisite) {
    elVisite.innerHTML = '&#9654; Visite auto';
    elVisite.addEventListener('click', e => { e.stopPropagation(); if (visite) { arreterVisite(); return; }
      elVisite.setAttribute('aria-pressed', 'true'); elVisite.innerHTML = '&#9632; Arr&ecirc;ter'; visite = setTimeout(etape, 300); });
  }

  // ═══════════ la boucle ═══════════
  const rayon = new THREE.Raycaster(), souris = new THREE.Vector2(), pointeur = new THREE.Vector2();
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
  function boucle(t) {
    requestAnimationFrame(boucle);
    const dt = Math.min((t - dernier) / 1000, 0.05); dernier = t;

    // quand on ne fait plus defiler, la camera se pose sur l'arret le plus proche
    if (performance.now() - dernierGeste > 260) sCible += (Math.round(sCible) - sCible) * Math.min(1, dt * 6);
    s += (sCible - s) * (1 - Math.exp(-dt * 3.2));
    const i0 = Math.min(N - 2, Math.floor(s)), f = s - i0;
    const e = f * f * (3 - 2 * f);                     // on ralentit pres de chaque arret
    rail.getPoint((i0 + e) / (N - 1), pCam);
    pVise.copy(arrets[i0].vise).lerp(arrets[i0 + 1].vise, e);
    // un leger mouvement de tete : la camera respire, et suit un peu la souris
    pCam.x += Math.sin(t * 0.00031) * 0.03; pCam.y += Math.sin(t * 0.00047) * 0.02;
    vTmp.copy(pVise).sub(pCam).normalize();
    const lat = new THREE.Vector3(-vTmp.z, 0, vTmp.x);
    pVise.addScaledVector(lat, souris.x * 0.35).y += souris.y * 0.22;
    cam.position.copy(pCam); cam.lookAt(pVise);
    suit.position.set(pCam.x, 3.2, pCam.z - 1);

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

    // le flash retombe, la 991 se devoile, les epreuves tombent
    for (const fl of flashs) { fl.k *= Math.pow(0.0015, dt); fl.lum.intensity = fl.k * 260; fl.face.material.color.setScalar(0.16 + fl.k * 3); }
    if (voiture.devoile && voiture.tDrap >= 0 && voiture.tDrap < 1) {
      voiture.tDrap = Math.min(1, voiture.tDrap + dt / 1.6); const u = voiture.tDrap, ee = u * u;
      voiture.drap.position.set(ee * 4.2, Math.sin(u * Math.PI) * 1.1, 0); voiture.drap.rotation.z = -ee * 0.5; voiture.drap.material.opacity = 1 - Math.max(0, (u - 0.55) / 0.45);
      if (u >= 1) voiture.drap.visible = false;
    }
    for (let k = chutes.length - 1; k >= 0; k--) {
      const ep = chutes[k], d = ep.userData.tombe; d.t += dt;
      if (d.t < 1.1) { ep.position.y = ep.userData.repos.pos.y - d.t * d.t * 2.6; ep.position.z = ep.userData.repos.pos.z + d.t * 0.5; ep.rotation.z += d.vr * dt; ep.rotation.x = -d.t * 1.1; }
      else if (d.t > 5) { ep.position.copy(ep.userData.repos.pos); ep.rotation.copy(ep.userData.repos.rot); ep.userData.tombe = null; chutes.splice(k, 1); bruitage('punaise'); }
    }
    // le neon et les ampoules battent avec la musique, et le neon gresille parfois
    pouls *= Math.pow(0.02, dt);
    const gres = Math.random() < 0.004 ? 0.4 : 1;
    neon.material.color.setScalar((0.9 + pouls * 0.25) * gres); lumNeon.intensity = (6 + pouls * 3) * gres;
    for (const amp of ampoules) amp.material.color.setRGB(1 * (0.85 + pouls * 0.3), 0.83 * (0.85 + pouls * 0.3), 0.6 * (0.85 + pouls * 0.3));

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

    if (pellicule) pellicule.uniforms.t.value = performance.now() * 0.001;
    if (composer) composer.render(); else renderer.render(monde, cam);
  }
  placerProjecteurs(s);
  requestAnimationFrame(boucle);
  return { arrets: N, oeuvres: oeuvres.length };
}
