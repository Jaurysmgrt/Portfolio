// ═══════════════════════════════════════════════════════════════════════
// DEUX TEMPS FORTS, PAS UN EFFET PARTOUT
//
//   L'OUVERTURE  un metal liquide derriere le nom. Le scroll le fait
//                tourner, le deforme, puis l'ouvre en anneau rouge pendant
//                que JAURYS et MAIGRET s'ecartent.
//   LA SELECTION les projets phares sur un arc en 3D. Le scroll fait
//                tourner l'arc ; la vitesse courbe les images et les
//                dedouble en rouge et bleu. Un clic ouvre le projet.
//
// Entre les deux, le site reste un site : on lit, on clique, on avance.
// Chaque scene ne calcule que lorsqu'elle est a l'ecran.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from '../vendor/three.module.min.js';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';

const TACTILE = !matchMedia('(hover:hover) and (pointer:fine)').matches;
const SOBRE = matchMedia('(prefers-reduced-motion:reduce)').matches;
const DPR = Math.min(devicePixelRatio || 1, TACTILE ? 2 : 2);
// Gouverneur de fluidite : si les images depassent ~18 ms, on baisse la
// definition du rendu (jamais le contenu) jusqu'a retrouver 60 i/s.
const Q = { f: 1, v: 0 };
const dpr = () => Math.max(0.75, DPR * Q.f);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const doux = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

const glisse = () => document.body.classList.contains('glisse');
const yVisuel = () => (glisse() && typeof window.__yVisuel === 'number') ? window.__yVisuel : (pageYOffset || 0);
const haut = el => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

// Une piste : un long bloc dans la page, et un cadre qui reste a l'ecran
// pendant qu'on la parcourt. Sur ordinateur le contenu glisse dans une
// couche transformee, ou sticky ne peut pas tenir : on epingle a la main.
function piste(el) {
  const colle = el.querySelector('.colle');
  let top = 0, h = 1;
  const mesurer = () => { top = haut(el); h = el.offsetHeight; };
  mesurer();
  addEventListener('resize', mesurer, { passive: true });
  addEventListener('load', mesurer);
  if (window.ResizeObserver) new ResizeObserver(mesurer).observe(document.getElementById('scene') || document.body);
  return {
    el,
    progression() {
      const y = yVisuel(), vh = innerHeight;
      if (glisse()) colle.style.transform = 'translate3d(0,' + clamp(y - top, 0, Math.max(0, h - vh)).toFixed(1) + 'px,0)';
      else if (colle.style.transform) colle.style.transform = '';
      return clamp((y - top) / Math.max(1, h - vh));
    },
    visible() { const y = yVisuel(); return y + innerHeight > top - 200 && y < top + h + 200; }
  };
}

function rendu(canvas, aa) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: !!aa, powerPreference: 'high-performance' });
  r.setPixelRatio(dpr());
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}
function composer(r, scene, cam, force, rayon, seuil) {
  const c = new EffectComposer(r);
  c.addPass(new RenderPass(scene, cam));
  const b = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), force, rayon, seuil);
  c.addPass(b); c.addPass(new OutputPass());
  return { c, b };
}
function tailleCadre(canvas) {
  const r = canvas.getBoundingClientRect();
  return [Math.max(2, Math.round(r.width)), Math.max(2, Math.round(r.height))];
}

// ═══════════════════════════════════════ L'OUVERTURE ═════════════════
function ouverture() {
  const el = document.getElementById('ouverture');
  const canvas = el && el.querySelector('canvas');
  if (!canvas) return null;
  const P = piste(el);
  const r = rendu(canvas, true);
  r.toneMappingExposure = 0.95;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06070a);

  // un studio sombre a refleter : du noir, des bandes de lumiere, une rouge
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x020203);
  const bande = (w, hh, col, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m); };
  bande(14, 1.2, 0xffffff, 0, 9, 4);
  bande(1.4, 12, 0xcfdcff, -10, 0, 2);
  bande(1.0, 12, 0xff2a12, 10, -1, -3);
  bande(10, 0.6, 0x8aa6ff, 0, -8, -6);
  const pmrem = new THREE.PMREMGenerator(r);
  scene.environment = pmrem.fromScene(studio, 0.02).texture;
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

  const mat = new THREE.MeshPhysicalMaterial({ color: 0xc9d0da, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.0 });
  const U = { uT: { value: 0 }, uAmp: { value: 0.25 }, uFreq: { value: 1.2 }, uTore: { value: 0 } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uT,uAmp,uFreq,uTore;
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+2.0*C.xxx;vec3 x3=x0-1.0+3.0*C.xxx;
i=mod(i,289.0);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
vec3 deforme(vec3 p){
  vec3 n=normalize(p);
  float phi=atan(n.z,n.x), th=asin(clamp(n.y,-1.0,1.0))*2.0;
  vec3 tore=vec3((1.3+0.36*cos(th))*cos(phi), 0.36*sin(th), (1.3+0.36*cos(th))*sin(phi));
  vec3 base=mix(p,tore,uTore);
  float d=snoise(base*uFreq+vec3(0.0,uT*0.25,uT*0.12));
  return base+n*d*uAmp;
}`);
    sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', `
vec3 tg=normalize(cross(normal,abs(normal.y)>0.9?vec3(1.,0.,0.):vec3(0.,1.,0.)));
vec3 bt=normalize(cross(normal,tg));
vec3 q0=deforme(position),q1=deforme(position+tg*0.012),q2=deforme(position+bt*0.012);
vec3 objectNormal=normalize(cross(q1-q0,q2-q0));
if(dot(objectNormal,normal)<0.0)objectNormal=-objectNormal;
#ifdef USE_TANGENT
vec3 objectTangent=vec3(tangent.xyz);
#endif`);
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed=q0;');
  };
  const forme = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, TACTILE ? 48 : 80), mat);
  scene.add(forme);
  const rouge = new THREE.PointLight(0xff2a14, 30, 20, 2); scene.add(rouge);
  const froid = new THREE.PointLight(0x9cc4ff, 25, 20, 2); froid.position.set(-4, 2, 3); scene.add(froid);
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.012, 16, 220), new THREE.MeshBasicMaterial({ color: 0xff3b24 }));
  anneau.rotation.x = Math.PI / 2.2; scene.add(anneau);
  // deux anneaux de plus, plus loin : quand on les traverse, ca devient un tunnel
  const anneaux = [0.7, 1.5].map((k, i) => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(2.4 * (1 + k * .35), 0.01, 12, 200), new THREE.MeshBasicMaterial({ color: i ? 0x9cc4ff : 0xff3b24, transparent: true, opacity: .8 }));
    a.rotation.x = Math.PI / 2.2; a.userData.k = k; a.visible = false; scene.add(a); return a;
  });
  let t0 = -1;                      // l'instant ou le rideau s'ouvre
  let pL = 0;                        // progression lissee
  let pv = 0, pmx = 0, pmy = 0;      // vitesse du pointeur : le metal reagit

  // rendu direct, anti-crenele : plus net et moins couteux qu'une chaine de post-traitement
  const c = { setSize() {}, setPixelRatio() {}, render() { r.render(scene, cam); } }, b = { enabled: false, strength: 0 };
  r.compile(scene, cam);   // les shaders sont prepares avant la premiere image : pas d'a-coup au demarrage
  const hero = el.querySelector('.hero');
  let qv = 0, pPrec = 0, vit = 0, mx = 0, my = 0, w0 = 0, h0 = 0;
  if (!TACTILE) addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; }, { passive: true });

  function taille() {
    const [w, h] = tailleCadre(canvas); if (w === w0 && h === h0 && qv === Q.v) return; w0 = w; h0 = h; qv = Q.v; r.setPixelRatio(dpr()); c.setPixelRatio(dpr());
    r.setSize(w, h, false); c.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
  }

  return function image(t) {
    if (!P.visible()) { P.progression(); return; }
    taille();
    // la progression est lissee : meme un defilement brusque donne un mouvement fluide
    const pBrut = SOBRE ? 0 : P.progression();
    pL += (pBrut - pL) * 0.075; if (Math.abs(pBrut - pL) < 0.0004) pL = pBrut;
    const p = pL;
    vit += (Math.abs(p - pPrec) * 60 - vit) * 0.08; pPrec = p;
    const s = t / 1000;
    if (t0 < 0 && document.body.classList.contains('loaded')) t0 = s + 0.15;
    const e = t0 < 0 ? 0 : clamp((s - t0) / 3.2);          // l'arrivee, de 0 a 1
    const ressort = e <= 0 ? 0.001 : (e >= 1 ? 1 : Math.pow(2, -9 * e) * Math.sin((e * 10 - .75) * (2 * Math.PI / 3)) + 1);
    const eclat = Math.pow(1 - e, 3);
    const dpx = mx - pmx, dpy = my - pmy; pmx = mx; pmy = my;
    pv += (Math.min(1, Math.hypot(dpx, dpy) * 14) - pv) * 0.08;
    const p4 = doux(clamp((p - 0.78) / 0.22));             // la traversee de l'anneau
    const p1 = doux(clamp((p - (TACTILE ? 0.08 : 0.03)) / 0.45)), p2 = doux(clamp((p - 0.25) / 0.45)), p3 = doux(clamp((p - 0.55) / 0.4));
    U.uT.value = s; U.uAmp.value = 0.16 + p2 * 0.12 + Math.min(0.12, vit * 0.5) + p3 * 0.04 + eclat * 0.7 + pv * 0.22;
    U.uFreq.value = 1.1 + p2 * 0.8; U.uTore.value = p3;
    forme.rotation.y = s * 0.12 + p * 5.2; forme.rotation.x = p * 1.4 + my * 0.15;
    forme.scale.setScalar(mix(0.95, 1.12, p1) * mix(1, 1.2, p3) * ressort * Math.max(0.001, 1 - p4 * 1.15));
    forme.position.x += (mx * 0.35 * (1 - p2) - forme.position.x) * 0.05; forme.position.y += (-my * 0.22 * (1 - p2) - forme.position.y) * 0.05;
    const ang = p * 2.4 + mx * 0.15;
    const dz = cam.aspect < 1 ? 9.5 : 6.6;
    const d = mix(dz, dz * 1.08, p2) * (1 - p4 * 0.55) * mix(1, 1.35, eclat);
    cam.position.set(Math.sin(ang) * d, mix(0.2, 1.4, p2) - p3 * 1.1, Math.cos(ang) * d);
    cam.lookAt(0, 0, 0);
    rouge.position.set(Math.cos(s * 0.6 + p * 6) * 3.2, Math.sin(p * 4) * 1.5 + 1, Math.sin(s * 0.6 + p * 6) * 3.2);
    rouge.intensity = 12 + p3 * 6;
    anneau.scale.setScalar(mix(0.2, 1.25, p3) * (1 + p4 * 2.2)); anneau.visible = p3 > 0.02; anneau.rotation.z = s * 0.2;
    anneaux.forEach(a => { a.visible = p3 > 0.3; a.scale.setScalar(mix(0.3, 1, p3) * (1 + p4 * (2 + a.userData.k * 2))); a.rotation.z = -s * (0.15 + a.userData.k * .1); a.position.y = -a.userData.k * (1 - p4) * 0.8; });
    r.toneMappingExposure = 0.95 + eclat * 1.6;
    if (b.enabled) b.strength = 0.25 + p3 * 0.1 + eclat * 1.4 + p4 * 0.3;
    // la typographie accompagne : le nom s'ecarte, le reste du hero s'efface
    if (hero) { hero.style.pointerEvents = p1 > 0.6 ? 'none' : ''; hero.style.setProperty('--o1', p1.toFixed(3)); hero.style.setProperty('--o2', p2.toFixed(3)); }
    // la transition « le trait » : un filet rouge traverse l'ecran, puis le monde se referme dessus
    const tl = 0, tc = doux(clamp((pBrut - 0.72) / 0.28)), tf = 0;
    el.style.setProperty('--tl', tl.toFixed(3)); el.style.setProperty('--tc', tc.toFixed(3)); el.style.setProperty('--tf', tf.toFixed(3));
    // une fois effacee, la scene ne se dessine plus (et ne bloque plus l'affichage)
    const colle = el.querySelector('.colle');
    if (tc > 0.995) { if (colle.style.visibility !== 'hidden') colle.style.visibility = 'hidden'; return false; }
    else if (colle.style.visibility) colle.style.visibility = '';
    c.render(); return true;
  };
}

// ═══════════════════════════════════════ LA SELECTION ════════════════
function selection() {
  const el = document.getElementById('selection');
  const canvas = el && el.querySelector('canvas');
  if (!canvas) return null;
  const P = piste(el);
  const r = rendu(canvas);
  r.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06070a);
  scene.fog = new THREE.Fog(0x06070a, 8, 22);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  // Les projets n'existent qu'ici : l'arc presente TOUTE la galerie, famille
  // apres famille (jamais melangees). La grille ne sert plus que de secours
  // sans WebGL. Les visuels secondaires restent dans les pages projet.
  const projets = [];
  const ytId = u => { const m = /(?:youtu\.be\/|v=|shorts\/|live\/)([\w-]{11})/.exec(u || ''); return m ? m[1] : ''; };
  document.querySelectorAll('#gallery .fam').forEach(fam => {
    const cle = fam.dataset.fam;
    const nom = (fam.querySelector('.fam-t') || {}).textContent || '';
    const num = (fam.querySelector('.fam-n') || {}).textContent || '';
    const desc = ((fam.querySelector('.fam-p') || {}).textContent || '').trim();
    const pieces = [...fam.querySelectorAll('.gal-item')].filter(t => !t.classList.contains('brand-secondary'));
    // chaque famille s'ouvre sur sa carte-titre : on sait toujours dans quelle salle on est
    projets.push({ carte: true, fam: cle, famNom: nom.trim(), famNum: num.trim(), desc, nb: pieces.length, w: 4, h: 5,
      titre: nom.trim(), cat: pieces.length + ' pièces' });
    let rang = 0;
    pieces.forEach(t => {
      let src = '', w = 0, h = 0;
      const video = t.classList.contains('gal-video');
      if (video) {
        const id = ytId(t.dataset.vsrc);
        src = t.dataset.poster || (id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '');
        w = 16; h = 9;
      } else {
        const im = t.querySelector('img');
        src = im && im.getAttribute('src') || '';
        w = +(im && im.getAttribute('width')) || 1200; h = +(im && im.getAttribute('height')) || 800;
      }
      if (!src) return;
      projets.push({ tuile: t, fam: cle, famNom: nom.trim(), famNum: num.trim(), src, w, h, video, rang: ++rang, nb: pieces.length,
        titre: t.dataset.brand || (t.dataset.title || '').split(',')[0], cat: (t.dataset.cat || '').replace(/&middot;/g, '·') });
    });
  });
  // la longueur de la piste suit le nombre de pieces
  el.style.height = (100 + projets.length * (TACTILE ? 48 : 56)) + 'vh';
  const tc = el.querySelector('.dc-tc');
  const elFam = el.querySelector('.sel-fam'), elNum = el.querySelector('.sel-num'), elT = el.querySelector('.sel-t'), elC = el.querySelector('.sel-c'),
        elX = el.querySelector('.sel-x'), elTot = el.querySelector('.sel-tot'), elB = el.querySelector('.sel-barre i');

  const VS = `uniform float uV,uT;varying vec2 vUv;
void main(){vUv=uv;vec3 p=position;
  p.z+=sin(uv.x*3.14159)*uV*0.9; p.y+=sin(uv.x*6.283+uT)*uV*0.08;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
  const FS = `uniform sampler2D uMap;uniform float uV,uOk,uFocus;varying vec2 vUv;
void main(){float s=uV*0.0035;
  vec4 c=vec4(texture2D(uMap,vUv+vec2(s,0.)).r,texture2D(uMap,vUv).g,texture2D(uMap,vUv-vec2(s,0.)).b,1.);
  c.rgb=mix(vec3(0.06,0.07,0.09),c.rgb,uOk);
  c.rgb*=mix(0.55,1.0,uFocus);
  float e=smoothstep(0.0,0.012,vUv.x)*smoothstep(1.0,0.988,vUv.x)*smoothstep(0.0,0.012,vUv.y)*smoothstep(1.0,0.988,vUv.y);
  c.rgb=mix(vec3(1.0,0.23,0.14)*uFocus,c.rgb,e);
  gl_FragColor=c;}`;

  const H = 3.1, ECART = 0.55;
  // le rayon s'adapte au nombre de pieces : l'arc ne fait jamais plus de
  // 80 % d'un tour, donc les dernieres pieces ne recouvrent pas les premieres
  let longueur = 0;
  projets.forEach((pr, i) => { longueur += H * pr.w / pr.h + ECART; if (i > 0 && pr.fam !== projets[i - 1].fam) longueur += 1.6; });
  const R = Math.max(7.2, longueur / (Math.PI * 2 * 0.8));
  const RECUL = 9.4 - R;   // la camera garde la meme distance aux images
  const arc = new THREE.Group(); scene.add(arc);
  const chargeur = new THREE.TextureLoader();
  let charge = false;
  const plans = projets.map(pr => {
    const u = { uMap: { value: null }, uV: { value: 0 }, uT: { value: 0 }, uOk: { value: 0 }, uFocus: { value: 0 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, H, 40, 1), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS }));
    m.scale.x = H * pr.w / pr.h;              // jamais recadree : la plaque prend les proportions de l'image
    m.userData.pr = pr;
    const piv = new THREE.Group(); piv.add(m); m.position.z = -R; arc.add(piv);
    return { piv, m, u, pr, ang: 0 };
  });
  function placer() {
    let a = 0;
    plans.forEach((p, i) => {
      // entre deux familles, un vrai vide : les groupes se lisent comme des salles
      if (i > 0 && p.pr.fam !== plans[i - 1].pr.fam) a -= 1.6 / R;
      const da = (p.m.scale.x + ECART) / R; if (i > 0) a -= da / 2; p.piv.rotation.y = a; p.ang = a; a -= da / 2; });
  }
  placer();
  function allerA(pl) {
    const total0 = plans.length ? -plans[plans.length - 1].ang : 1;
    const top = el.getBoundingClientRect().top + pageYOffset;
    const course = el.offsetHeight - innerHeight;
    window.scrollTo({ top: top + course * clamp(-pl.ang / total0) + 2, behavior: 'smooth' });
  }
  // des pastilles pour sauter d'une famille a l'autre
  const puces = el.querySelector('.sel-fams');
  if (puces) {
    const total0 = plans.length ? -plans[plans.length - 1].ang : 1;
    const vues = {};
    plans.forEach(pl => {
      if (vues[pl.pr.fam]) return; vues[pl.pr.fam] = 1;
      const bt = document.createElement('button'); bt.type = 'button'; bt.dataset.f = pl.pr.fam;
      bt.textContent = pl.pr.famNom; bt.addEventListener('click', () => allerA(pl));
      puces.appendChild(bt);
    });
  }
  function dessinerCarte(pr) {
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 1000;
    const g = cv.getContext('2d');
    g.fillStyle = '#0b0e13'; g.fillRect(0, 0, 800, 1000);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.strokeRect(1, 1, 798, 998);
    g.fillStyle = '#ff4433'; g.font = '500 30px "IBM Plex Mono", monospace'; g.fillText('FAMILLE ' + pr.famNum, 64, 96);
    g.fillRect(64, 122, 90, 4);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.font = '400 520px Anton, Impact, sans-serif'; g.fillText(pr.famNum, 300, 860);
    let taille = 112;
    g.font = '400 ' + taille + 'px Anton, Impact, sans-serif';
    const plusLong = Math.max(...pr.famNom.toUpperCase().split(' ').map(m => g.measureText(m).width));
    if (plusLong > 672) { taille = Math.floor(taille * 672 / plusLong); g.font = '400 ' + taille + 'px Anton, Impact, sans-serif'; }
    g.fillStyle = '#ffffff';
    let y = 300; const mots = pr.famNom.toUpperCase().split(' '); let ligne = '';
    mots.forEach(m => { const t = ligne ? ligne + ' ' + m : m; if (g.measureText(t).width > 672 && ligne) { g.fillText(ligne, 64, y); y += taille; ligne = m; } else ligne = t; });
    g.fillText(ligne, 64, y);
    g.fillStyle = '#a9b7c6'; g.font = '400 30px "IBM Plex Sans", sans-serif';
    y += 80; ligne = '';
    pr.desc.split(' ').forEach(m => { const t = ligne ? ligne + ' ' + m : m; if (g.measureText(t).width > 672 && ligne) { g.fillText(ligne, 64, y); y += 44; ligne = m; } else ligne = t; });
    if (ligne) g.fillText(ligne, 64, y);
    g.fillStyle = '#ffffff'; g.font = '500 30px "IBM Plex Mono", monospace'; g.fillText(String(pr.nb).padStart(2, '0') + ' PIÈCES  →', 64, 930);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    return tex;
  }
  setTimeout(() => { if ('requestIdleCallback' in window) requestIdleCallback(() => charger(), { timeout: 4000 }); else charger(); }, 2500);
  function charger() {
    if (charge) return; charge = true;
    const polices = document.fonts ? Promise.all(['400 112px Anton', '500 30px "IBM Plex Mono"', '400 30px "IBM Plex Sans"'].map(f => document.fonts.load(f).catch(() => 0))) : Promise.resolve();
    polices.then(() => plans.forEach(pl => { if (pl.pr.carte) { pl.u.uMap.value = dessinerCarte(pl.pr); pl.u.uOk.value = 1; } }));
    plans.forEach(pl => !pl.pr.carte && chargeur.load(pl.pr.src, tex => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      pl.u.uMap.value = tex; pl.u.uOk.value = 1;
    }, undefined, () => {
      // miniature introuvable : une affiche dessinee plutot qu'un rectangle vide
      const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
      const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 1280, 720); gr.addColorStop(0, '#141a22'); gr.addColorStop(1, '#06070a');
      g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
      g.fillStyle = '#d42a1b'; g.beginPath(); g.arc(640, 300, 74, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(618, 262); g.lineTo(618, 338); g.lineTo(680, 300); g.closePath(); g.fill();
      g.font = '400 64px Anton, Impact, sans-serif'; g.textAlign = 'center';
      g.fillText(pl.pr.titre.toUpperCase().slice(0, 34), 640, 500);
      g.fillStyle = '#a9b7c6'; g.font = '500 26px "IBM Plex Mono", monospace'; g.fillText(pl.pr.cat.toUpperCase().slice(0, 60), 640, 560);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      pl.u.uMap.value = tex; pl.u.uOk.value = 1;
    }));
  }

  const grille = new THREE.GridHelper(60, 60, 0x2a3442, 0x141a22); grille.position.y = -H / 2 - 0.9; scene.add(grille);
  const ligne = new THREE.Mesh(new THREE.PlaneGeometry(60, 0.03), new THREE.MeshBasicMaterial({ color: 0xff3b24 }));
  ligne.rotation.x = -Math.PI / 2; ligne.position.set(0, -H / 2 - 0.89, -R + 0.6); scene.add(ligne);

  const { c, b } = composer(r, scene, cam, 0.22, 0.35, 0.96);
  b.enabled = false;   // les images restent nettes : pas de halo sur les photos
  let qv = 0, pPrec = 0, vit = 0, courant = -1, mx = 0, my = 0, angle = 0, w0 = 0, h0 = 0;
  if (!TACTILE) addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; }, { passive: true });

  // un clic sur l'image au centre ouvre le projet, comme dans la galerie
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  canvas.addEventListener('click', (e) => {
    if (courant < 0) return;
    const rc = canvas.getBoundingClientRect();
    ptr.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const hit = ray.intersectObjects(plans.map(p => p.m))[0];
    if (hit) { const k = plans.findIndex(p => p.m === hit.object); if (k >= 0 && k !== courant) { allerA(plans[k]); return; } }
    const pr = projets[courant];
    if (pr.carte) { const pl = plans[courant + 1]; if (pl) allerA(pl); return; }
    pr.tuile.click();
  });

  function taille() {
    const [w, h] = tailleCadre(canvas); if (w === w0 && h === h0 && qv === Q.v) return; w0 = w; h0 = h; qv = Q.v; r.setPixelRatio(dpr()); c.setPixelRatio(dpr());
    r.setSize(w, h, false); c.setSize(w, h); cam.aspect = w / h; cam.fov = w < h ? 62 : 42; cam.updateProjectionMatrix();
  }

  let dernierDefil = performance.now(), pose = true;
  if (!TACTILE) addEventListener('scroll', () => { dernierDefil = performance.now(); pose = false; }, { passive: true });
  return function image(t) {
    if (!P.visible()) { P.progression(); return; }
    charger(); taille();
    // aimant : a l'arret, l'arc se pose sur la piece la plus proche, centree
    if (!TACTILE && !pose && performance.now() - dernierDefil > 260 && courant >= 0) {
      pose = true; const pr0 = P.progression();
      if (pr0 > 0.001 && pr0 < 0.999) {
        const pl = plans[courant], total0 = plans.length ? -plans[plans.length - 1].ang : 1;
        const cible = el.getBoundingClientRect().top + pageYOffset + (el.offsetHeight - innerHeight) * clamp(-pl.ang / total0) + 2;
        if (Math.abs(cible - pageYOffset) > 6) allerA(pl);
      }
    }
    const p = SOBRE ? 0 : P.progression();
    const dv = (p - pPrec) * 60; pPrec = p;
    vit += (dv - vit) * 0.12;
    const s = t / 1000;
    const total = plans.length ? -plans[plans.length - 1].ang : 0;
    angle += (p * total - angle) * 0.2;
    arc.rotation.y = angle;
    cam.position.set(mx * 0.35, -0.2 - my * 0.2 + Math.min(0.3, Math.abs(vit) * 0.4), RECUL + Math.min(1.2, Math.abs(vit) * 1.6));
    cam.lookAt(0, -0.38, -R);
    let best = 0, bd = 9;
    plans.forEach((pl, i) => {
      const d = Math.abs(pl.ang + angle);
      if (d < bd) { bd = d; best = i; }
      pl.u.uV.value = clamp(vit * 1.2, -0.35, 0.35); pl.u.uT.value = s;
      pl.u.uFocus.value += (doux(clamp(1 - d / 0.45)) - pl.u.uFocus.value) * 0.15;
      pl.m.position.z = -R + pl.u.uFocus.value * 0.8;
    });
    if (best !== courant && projets[best]) {
      courant = best; const pr = projets[best];
      const n = pr.carte ? '' : String(pr.rang).padStart(2, '0');
      if (elNum) elNum.textContent = pr.carte ? 'Famille ' + pr.famNum : n;
      if (elX) elX.textContent = pr.carte ? pr.famNum : n;
      if (elTot) elTot.textContent = pr.carte ? String(pr.nb).padStart(2, '0') + ' pièces' : '/ ' + String(pr.nb).padStart(2, '0');
      el.classList.toggle('sur-carte', !!pr.carte); el.classList.toggle('sur-video', !!pr.video); el.dataset.f = pr.fam;
      if (elT) { elT.textContent = pr.titre; elT.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' }); }
      if (elC) elC.textContent = pr.cat;
      if (elFam && elFam.dataset.f !== pr.fam) {
        elFam.dataset.f = pr.fam; elFam.textContent = pr.famNum + ' · ' + pr.famNom;
        if (puces) puces.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.f === pr.fam));
        if (puces) { const on = puces.querySelector('button.on'); if (on) puces.scrollTo({ left: on.offsetLeft - 12, behavior: 'smooth' }); }
        elFam.animate([{ opacity: 0, letterSpacing: '.5em' }, { opacity: 1, letterSpacing: '.26em' }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    }
    if (elB) elB.style.width = (p * 100).toFixed(2) + '%';
    if (tc && el.classList.contains('sur-video')) {
      const f = Math.floor(s * 25), pad = n => String(n).padStart(2, '0');
      tc.textContent = pad(Math.floor(f / 90000) % 24) + ':' + pad(Math.floor(f / 1500) % 60) + ':' + pad(Math.floor(f / 25) % 60) + ':' + pad(f % 25);
    }
    b.strength = 0.45 + Math.min(1, Math.abs(vit) * 2);
    c.render(); return true;
  };
}

function demarrer() {
  if (SOBRE || !webgl()) { document.body.classList.add('sans-3d'); window.__pret3d && window.__pret3d(); return; }
  document.body.classList.add('avec-3d');
  const scenes = [ouverture(), selection()].filter(Boolean);
  let vivant = true;
  document.addEventListener('visibilitychange', () => { vivant = !document.hidden; if (vivant) requestAnimationFrame(boucle); });
  let tPrec = 0, cumul = 0, n = 0, calme = 0, images = 0;
  function boucle(t) {
    if (!vivant) return;
    // la 3D est prete quand quelques images ont ete dessinees (shaders compiles, textures envoyees)
    if (++images === 6 && window.__pret3d) window.__pret3d();
    const dt = tPrec ? t - tPrec : 16; tPrec = t;
    const actif = scenes.map(f => f(t)).some(Boolean);
    if (actif && dt < 200 && t > 3000) {   // les premieres secondes (chargement) ne comptent pas
      cumul += dt; n++;
      if (n >= 40) {
        const moy = cumul / n; cumul = 0; n = 0;
        if (moy > 18.5 && Q.f > 0.7) { Q.f = Math.max(0.7, Q.f * 0.85); Q.v++; calme = 0; }
        else if (moy < 15 && Q.f < 1 && ++calme > 1) { Q.f = Math.min(1, Q.f * 1.15); Q.v++; calme = 0; }
      }
    }
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
else demarrer();
