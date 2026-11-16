// ═══════════════════════════════════════════════════════════════════════
// LE MONDE — le defilement est la timeline.
//
// Un seul espace, traverse d'un bout a l'autre :
//   IDENTITE  un portail monumental se construit autour du nom
//   SAS 02    la camera franchit le portail, qui s'ouvre
//   PROJETS   un hall ou les vrais visuels montent du sol, a plusieurs
//             profondeurs, et que la camera contourne
//   SAS 03    les ecrans se desassemblent et deviennent un escalier
//   PARCOURS  la camera gravit l'escalier
//   SAS 05    tout se retire dans la brume : un horizon rouge, une braise
//
// Rien n'est joue tout seul : chaque mouvement est une fonction de la
// position de defilement, donc on avance, on recule, on saute par le menu,
// et le monde suit. Il ne rend une image que lorsque quelque chose bouge.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from '../vendor/three.module.min.js';

const cv = document.getElementById('hall');
const SOBRE = matchMedia('(prefers-reduced-motion:reduce)').matches;
const TACTILE = !matchMedia('(hover:hover) and (pointer:fine)').matches;

function demarrer() {
  if (!cv) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !TACTILE, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { cv.remove(); return; }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TACTILE ? 1.4 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const FOND = new THREE.Color(0x05070b);
  const scene = new THREE.Scene();
  scene.background = FOND.clone();
  scene.fog = new THREE.FogExp2(FOND.clone(), 0.02);

  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);

  // ── la lumiere ─────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0x8ea4c2, 0x040507, 0.55));
  const cle = new THREE.DirectionalLight(0xdfe9f7, 1.6);
  cle.position.set(-6, 14, 10); scene.add(cle);
  const lanterne = new THREE.PointLight(0xcfe0ff, 60, 40, 2);   // marche devant la camera
  scene.add(lanterne);
  const braiseL = new THREE.PointLight(0xff3a1c, 120, 60, 2);   // le rouge de la marque
  scene.add(braiseL);

  const metal = new THREE.MeshStandardMaterial({ color: 0x3a4656, metalness: 0.7, roughness: 0.34 });
  const sombre = new THREE.MeshStandardMaterial({ color: 0x0a0d12, metalness: 0.3, roughness: 0.85 });
  const rouge = new THREE.MeshBasicMaterial({ color: 0xff3b24 });

  // ── le sol et sa ligne rouge ───────────────────────────────────────
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(120, 420), sombre);
  sol.rotation.x = -Math.PI / 2; sol.position.set(0, 0, -150); scene.add(sol);
  const ligne = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 420), rouge);
  ligne.rotation.x = -Math.PI / 2; ligne.position.set(0, 0.01, -150); scene.add(ligne);

  // ── 1. LE PORTAIL : construit bloc par bloc ─────────────────────────
  const BW = 2.2, BH = 1.9, BD = 1.4;
  const blocsCibles = [];
  for (const cote of [-1, 1]) {
    for (let c = 0; c < 3; c++) for (let r = 0; r < 8; r++) {
      blocsCibles.push({ x: cote * (0.9 + BW / 2 + c * BW), y: BH / 2 + r * BH, cote });
    }
  }
  for (let c = 0; c < 6; c++) blocsCibles.push({ x: (c - 2.5) * BW, y: 8 * BH + BH / 2, cote: 0 });
  const NB = blocsCibles.length;
  const blocs = new THREE.InstancedMesh(new THREE.BoxGeometry(BW * 0.97, BH * 0.95, BD), metal, NB);
  scene.add(blocs);
  const depart = blocsCibles.map((b, i) => ({
    dy: 9 + ((i * 37) % 11), rx: ((i * 13) % 7 - 3) * 0.25, rz: ((i * 7) % 5 - 2) * 0.3, d: (i % 12) * 0.045 + (b.y / 18) * 0.35
  }));
  // la fente lumineuse entre les deux pans
  const fente = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 8 * BH), new THREE.MeshBasicMaterial({ color: 0xff4a30, transparent: true, opacity: 0.0 }));
  fente.position.set(0, 4 * BH, -0.3); scene.add(fente);

  // ── 2. LE HALL : piliers monumentaux ──────────────────────────────
  const NP = 2 * 16;
  const piliers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 22, 1.1), metal, NP);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 16; i++) for (const s of [-1, 1]) {
    m4.makeTranslation(s * 11, 11, -14 - i * 9);
    piliers.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4);
  }
  scene.add(piliers);
  const chapeaux = new THREE.InstancedMesh(new THREE.BoxGeometry(1.14, 0.08, 1.14), rouge, NP);
  for (let i = 0; i < 16; i++) for (const s of [-1, 1]) {
    m4.makeTranslation(s * 11, 2.2, -14 - i * 9);
    chapeaux.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4);
  }
  scene.add(chapeaux);

  // ── 3. LES ECRANS : les vrais projets ─────────────────────────────
  const sources = [...document.querySelectorAll('#gallery .gal-item')]
    .filter(el => !el.classList.contains('gal-video'))
    .map(el => el.querySelector('img'))
    .filter(im => im && im.getAttribute('src') && !/^https?:|^data:/.test(im.getAttribute('src')))
    .slice(0, TACTILE ? 8 : 12);
  const NE = sources.length;
  const Z0 = -30, PAS_E = 6.2;
  const ecrans = sources.map((im, i) => {
    const w0 = +im.getAttribute('width') || 1200, h0 = +im.getAttribute('height') || 800;
    const H = 4.2, W = H * (w0 / h0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.6, metalness: 0.1,
      emissive: 0xffffff, emissiveIntensity: 0.0, side: THREE.DoubleSide });
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    const cadre = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.16, H + 0.16), metal);
    cadre.position.z = -0.02; plan.add(cadre);
    const ang = i * 2.39 + 0.6;                       // angle d'or : jamais deux ecrans alignes
    const cote = Math.cos(ang) >= 0 ? 1 : -1;
    const base = {
      x: cote * (4.2 + (i % 3) * 1.4), y: 3.0 + Math.sin(i * 1.7) * 1.4, z: Z0 - i * PAS_E,
      ry: -cote * (0.55 + (i % 2) * 0.25)
    };
    scene.add(plan);
    return { plan, mat, src: im.getAttribute('src'), W, H, base, charge: false };
  });

  // l'escalier vers lequel les ecrans se reconstruisent
  const STEP_Z0 = Z0 - NE * PAS_E - 10, STEP_D = 3.2, STEP_H = 1.05;
  const marche = i => ({ x: 0, y: i * STEP_H + 0.2, z: STEP_Z0 - i * STEP_D });
  const HAUT = NE * STEP_H;
  const solMarches = new THREE.InstancedMesh(new THREE.BoxGeometry(9, STEP_H, STEP_D), metal, NE);
  for (let i = 0; i < NE; i++) {
    const m = marche(i);
    m4.makeTranslation(0, m.y - STEP_H / 2 - 0.2, m.z); solMarches.setMatrixAt(i, m4);
  }
  scene.add(solMarches);

  // ── 4. LA FIN : un horizon et une braise ──────────────────────────
  const ZF = STEP_Z0 - NE * STEP_D - 60;
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.12), new THREE.MeshBasicMaterial({ color: 0xff3b24, fog: false, transparent: true, opacity: 0 }));
  horizon.position.set(0, HAUT + 1.2, ZF - 40); scene.add(horizon);
  const braise = new THREE.Mesh(new THREE.SphereGeometry(1.6, 40, 24), new THREE.MeshBasicMaterial({ color: 0xff4a28, fog: false, transparent: true, opacity: 0 }));
  braise.position.set(0, HAUT + 4.2, ZF); scene.add(braise);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { o: { value: 0 } },
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 v;uniform float o;void main(){float d=length(v-.5)*2.;gl_FragColor=vec4(vec3(1.,.28,.12)*exp(-d*d*4.)*o,1.);}'
  }));
  halo.position.copy(braise.position); scene.add(halo);

  // ── la partition : ou commence chaque chapitre dans la page ────────
  const vh = () => innerHeight;
  const haut = el => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };
  let A = {};
  function mesurer() {
    const q = s => document.querySelector(s);
    const s1 = q('#sas-projets'), s2 = q('#sas-parcours'), s3 = q('#sas-contact');
    if (!s1 || !s2 || !s3) return;
    const scn = q('#scene');
    const fin = Math.max(1, (scn ? scn.offsetHeight : document.documentElement.scrollHeight) - vh());
    A = {
      i1a: haut(s1) - vh(), i1b: haut(s1) + s1.offsetHeight - vh(),
      i2a: haut(s2) - vh(), i2b: haut(s2) + s2.offsetHeight - vh(),
      i3a: haut(s3) - vh(), i3b: Math.min(fin, haut(s3) + s3.offsetHeight - vh()),
      fin
    };
    sas = [s1, s2, s3].map(el => ({ el, inn: el.querySelector('.sas-in'), top: haut(el), h: el.offsetHeight }));
  }
  let sas = [];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const prog = (y, a, b) => clamp((y - a) / Math.max(1, b - a));
  const doux = t => t * t * t * (t * (t * 6 - 15) + 10);       // smootherstep : on part et on arrive en douceur
  const mix = (a, b, t) => a + (b - a) * t;
  const mixV = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  // les stations de la camera : position, regard
  const ST = {
    hero:   { p: [0, 2.6, 26],  l: [0, 6.5, 0] },
    seuil:  { p: [0, 3.0, 11],  l: [0, 6.0, -12] },
    dedans: { p: [0, 3.2, -16], l: [0, 3.4, -40] },
    finHall:{ p: [0, 3.6, Z0 - NE * PAS_E + 4], l: [0, 3.2, Z0 - NE * PAS_E - 20] },
    bas:    { p: [7, 4.2, STEP_Z0 + 12], l: [0, 4.5, STEP_Z0 - 12] },
    sommet: { p: [0, HAUT + 2.2, STEP_Z0 - NE * STEP_D + 2], l: [0, HAUT + 2.4, STEP_Z0 - NE * STEP_D - 30] },
    vide:   { p: [0, HAUT + 2.6, ZF + 22], l: [0, HAUT + 3.6, ZF] }
  };

  // ── l'etat ─────────────────────────────────────────────────────────
  let yLisse = 0, yPrec = -1, mx = 0, my = 0, mxC = 0, myC = 0;
  let tIntro = -1, raf = null, vivant = true, sasFranchi = -1;
  const t0 = performance.now();
  const cHero = document.querySelector('.hero');
  const glisse = () => document.body.classList.contains('glisse');
  const yVisuel = () => (glisse() && typeof window.__yVisuel === 'number') ? window.__yVisuel : (pageYOffset || 0);

  function chargerEcrans(jusqua) {
    const ldr = new THREE.TextureLoader();
    ecrans.forEach((e, i) => {
      if (e.charge || i > jusqua) return;
      e.charge = true;
      ldr.load(e.src, tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        e.mat.map = tex; e.mat.emissiveMap = tex; e.mat.color.set(0xffffff);
        e.mat.needsUpdate = true; demander();
      });
    });
  }

  const v3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), s3v = new THREE.Vector3();

  function poser(y, t) {
    if (!A.fin) return;
    // ── 0. intro : le portail se construit (temps), puis s'ouvre (scroll)
    const bInt = tIntro < 0 ? 0 : clamp((t - tIntro) / 2200);
    const p0 = prog(y, 0, A.i1a);                    // identite → seuil
    const p1 = prog(y, A.i1a, A.i1b);                // on franchit
    const p2 = prog(y, A.i1b, A.i2a);                // le hall
    const p3 = prog(y, A.i2a, A.i2b);                // la reconstruction
    const p4 = prog(y, A.i2b, A.i3a);                // l'ascension
    const p5 = prog(y, A.i3a, A.i3b);                // le retrait

    const ouvre = doux(clamp(p0 * 0.55 + p1 * 0.9));
    for (let i = 0; i < NB; i++) {
      const b = blocsCibles[i], d = depart[i];
      const k = SOBRE ? 1 : clamp((bInt - d.d) / 0.55);
      const e = 1 - Math.pow(1 - k, 3);
      const ox = b.cote * ouvre * (8 + (b.y / 18) * 3);
      const oy = b.cote === 0 ? ouvre * 7 : 0;
      v3.set(b.x + ox, b.y + d.dy * (1 - e) + oy, 0);
      e3.set(d.rx * (1 - e), 0, d.rz * (1 - e) + b.cote * ouvre * 0.06);
      q4.setFromEuler(e3); s3v.setScalar(0.4 + 0.6 * e);
      m4.compose(v3, q4, s3v); blocs.setMatrixAt(i, m4);
    }
    blocs.instanceMatrix.needsUpdate = true;
    // la fente reste un trait de lumiere : elle s'allume, puis s'eteint quand les pans s'ecartent
    fente.material.opacity = 0.9 * clamp(bInt * 1.4 - 0.4) * (1 - doux(clamp(ouvre * 2.2)));
    fente.scale.x = 0.08 + clamp(p0 * 2) * 0.14;

    // ── les ecrans : ils montent du sol quand on approche, puis deviennent marches
    const morph = doux(p3);
    ecrans.forEach((e, i) => {
      const b = e.base, m = marche(i);
      const zc = mix(ST.dedans.p[2], ST.finHall.p[2], doux(p2));
      const dist = zc - b.z;
      const monte = doux(clamp((26 - dist) / 14)) * (p1 > 0.3 || p2 > 0 ? 1 : 0);
      const flot = Math.sin(t / 1400 + i) * 0.12 * (1 - morph);
      const ki = clamp(morph * 1.6 - (i / NE) * 0.6);          // chaque ecran part a son heure
      const kk = doux(ki);
      const by = b.y - 12 * (1 - monte) + flot;
      e.plan.position.set(mix(b.x, m.x, kk), mix(by, m.y, kk), mix(b.z, m.z, kk));
      e.plan.rotation.set(mix(0, -Math.PI / 2, kk), mix(b.ry, 0, kk), 0);
      const sx = mix(1, 9 / e.W, kk), sy = mix(1, STEP_D / e.H, kk);
      e.plan.scale.set(sx, sy, 1);
      e.mat.emissiveIntensity = e.mat.map ? mix(0.55, 0.22, kk) * monte : 0;
      e.plan.visible = monte > 0.01 || kk > 0;
    });
    solMarches.visible = morph > 0.6;

    // ── la camera, de station en station
    let P, L;
    if (y < A.i1a)      { const k = doux(p0); P = mixV(ST.hero.p, ST.seuil.p, k); L = mixV(ST.hero.l, ST.seuil.l, k); }
    else if (y < A.i1b) { const k = doux(p1); P = mixV(ST.seuil.p, ST.dedans.p, k); L = mixV(ST.seuil.l, ST.dedans.l, k); }
    else if (y < A.i2a) {
      const k = doux(p2); P = mixV(ST.dedans.p, ST.finHall.p, k); L = mixV(ST.dedans.l, ST.finHall.l, k);
      P[0] += Math.sin(p2 * Math.PI * 2.2) * 3.4;               // on contourne les ecrans
      P[1] += Math.sin(p2 * Math.PI) * 1.6;
      L[0] += Math.sin(p2 * Math.PI * 2.2 + 0.8) * 2.0;
    }
    else if (y < A.i2b) { const k = doux(p3); P = mixV(ST.finHall.p, ST.bas.p, k); L = mixV(ST.finHall.l, ST.bas.l, k); }
    else if (y < A.i3a) { const k = doux(p4); P = mixV(ST.bas.p, ST.sommet.p, k); L = mixV(ST.bas.l, ST.sommet.l, k); }
    else                { const k = doux(p5); P = mixV(ST.sommet.p, ST.vide.p, k); L = mixV(ST.sommet.l, ST.vide.l, k); }

    cam.position.set(P[0] + mx * 0.6, P[1] + my * 0.35, P[2]);
    cam.lookAt(L[0] + mx * 1.2, L[1] + my * 0.6, L[2]);
    cam.fov = 50 + Math.sin(p1 * Math.PI) * 14 + Math.sin(p3 * Math.PI) * 6;   // la traversee aspire le cadre
    cam.updateProjectionMatrix();

    lanterne.position.set(cam.position.x, cam.position.y + 2, cam.position.z - 8);
    braiseL.position.set(0, mix(5, HAUT + 4, p4), mix(-2, ZF, doux(p5)) );
    braiseL.intensity = mix(120, 40, clamp(p2 * 3)) + p5 * 90;

    // ── l'atmosphere : plus claire dans les sas, plus sourde sous le texte
    const sasLum = Math.max(Math.sin(p1 * Math.PI), Math.sin(p3 * Math.PI) * 0.9, Math.sin(p5 * Math.PI) * 0.8);
    const sousTexte = (y > A.i1a * 0.35 && y < A.i1a) || (p2 > 0.04 && p2 < 0.96) || (p4 > 0.04 && p4 < 0.96);
    renderer.toneMappingExposure = ((sousTexte ? 0.62 : 1.0) + sasLum * 0.55) * (1 - 0.35 * doux(p5));
    scene.fog.density = mix(0.018, 0.012, clamp(p2 * 4) * (1 - p3)) + p5 * 0.03;
    const teinte = clamp(p5);
    scene.fog.color.setRGB(mix(0.020, 0.022, teinte), mix(0.027, 0.008, teinte), mix(0.043, 0.010, teinte));
    scene.background.copy(scene.fog.color);
    horizon.material.opacity = doux(p5);
    braise.material.opacity = doux(clamp(p5 * 1.4 - 0.3));
    halo.material.uniforms.o.value = braise.material.opacity * 0.9;

    // ── la typographie qui accompagne
    if (cHero) {
      const hp = clamp(y / (vh() * 0.9));
      cHero.style.setProperty('--hp', hp.toFixed(3));
    }
    sas.forEach((s, k) => {
      const p = prog(y, s.top - vh(), s.top + s.h - vh());
      s.el.style.setProperty('--p', p.toFixed(3));
      if (glisse() && s.inn) s.inn.style.transform = 'translate3d(0,' + clamp(y - s.top, 0, s.h - vh()).toFixed(1) + 'px,0)';
      if (p > 0.5 && sasFranchi < k) {
        sasFranchi = k;
        try { document.dispatchEvent(new CustomEvent('hall:porte', { detail: { nature: 1 } })); } catch (e) {}
      }
      if (p < 0.5 && sasFranchi >= k) sasFranchi = k - 1;
    });

    if (p0 > 0.6) chargerEcrans(NE);              // chargement progressif
    else if (p0 > 0.25) chargerEcrans(3);
  }

  function tailler() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    // en portrait on recule un peu pour garder l'architecture dans le cadre
    cam.zoom = w < h ? 0.72 : 1;
    cam.updateProjectionMatrix();
  }

  function image(t) {
    const yC = yVisuel();
    yLisse += (yC - yLisse) * (TACTILE ? 0.22 : 1);    // le bureau est deja lisse par la couche qui glisse
    if (Math.abs(yC - yLisse) < 0.3) yLisse = yC;
    const k = 0.06; mx += (mxC - mx) * k; my += (myC - my) * k;
    const v = Math.abs(yLisse - yPrec);
    if (window.__hallFlux) window.__hallFlux(Math.min(1.2, v / 40));
    yPrec = yLisse;

    poser(yLisse, t);
    renderer.render(scene, cam);
  }
  let dernier = 0;
  // une seule boucle ; au repos (rien ne defile, intro finie) on rend a 30 im/s
  function boucle(t) {
    raf = null;
    if (!vivant) return;
    const repos = Math.abs(yVisuel() - yLisse) < 0.3 && tIntro >= 0 && t - tIntro > 2400
                  && Math.abs(mxC - mx) < 0.002 && Math.abs(myC - my) < 0.002;
    if (!repos || t - dernier >= 32) { dernier = t; image(t); }
    raf = requestAnimationFrame(boucle);
  }
  function demander() { if (!raf && vivant) raf = requestAnimationFrame(boucle); }

  mesurer(); tailler(); yLisse = yVisuel();
  addEventListener('resize', () => { tailler(); mesurer(); demander(); }, { passive: true });
  addEventListener('load', () => { mesurer(); demander(); });
  const scn = document.getElementById('scene');
  if (window.ResizeObserver && scn) new ResizeObserver(() => { mesurer(); demander(); }).observe(scn);
  if (!TACTILE) addEventListener('pointermove', e => { mxC = e.clientX / innerWidth * 2 - 1; myC = -(e.clientY / innerHeight * 2 - 1); }, { passive: true });
  addEventListener('scroll', demander, { passive: true });
  document.addEventListener('visibilitychange', () => { vivant = !document.hidden; if (vivant) demander(); });
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); vivant = false; cv.style.display = 'none'; });

  if (SOBRE) {
    tIntro = 0; poser(yVisuel(), 1e9); renderer.render(scene, cam);
    addEventListener('scroll', () => { poser(yVisuel(), 1e9); renderer.render(scene, cam); }, { passive: true });
  } else {
    (function attendre() {
      if (document.body.classList.contains('loaded')) { tIntro = performance.now() + 150; demander(); }
      else setTimeout(attendre, 60);
    })();
    demander();
  }

  document.body.classList.add('hall-on');
  window.__monde = { mesurer: () => { mesurer(); demander(); } };
}

// le monde arrive apres le contenu : jamais il ne retarde la premiere image
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
else demarrer();
