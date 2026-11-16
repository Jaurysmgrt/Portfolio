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
const DPR = Math.min(devicePixelRatio || 1, TACTILE ? 1.5 : 1.6);
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

function rendu(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
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
  const r = rendu(canvas);
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
  const forme = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, TACTILE ? 36 : 64), mat);
  scene.add(forme);
  const rouge = new THREE.PointLight(0xff2a14, 30, 20, 2); scene.add(rouge);
  const froid = new THREE.PointLight(0x9cc4ff, 25, 20, 2); froid.position.set(-4, 2, 3); scene.add(froid);
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.012, 16, 220), new THREE.MeshBasicMaterial({ color: 0xff3b24 }));
  anneau.rotation.x = Math.PI / 2.2; scene.add(anneau);

  const { c, b } = composer(r, scene, cam, 0.3, 0.45, 0.94);
  if (TACTILE) b.enabled = false;   // sur telephone : pas de halo, la fluidite d'abord
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
    const p = SOBRE ? 0 : P.progression();
    vit += (Math.abs(p - pPrec) * 60 - vit) * 0.08; pPrec = p;
    const s = t / 1000;
    const p1 = doux(clamp(p / 0.45)), p2 = doux(clamp((p - 0.25) / 0.45)), p3 = doux(clamp((p - 0.55) / 0.4));
    U.uT.value = s; U.uAmp.value = 0.16 + p2 * 0.12 + Math.min(0.12, vit * 0.5) + p3 * 0.04;
    U.uFreq.value = 1.1 + p2 * 0.8; U.uTore.value = p3;
    forme.rotation.y = s * 0.12 + p * 5.2; forme.rotation.x = p * 1.4 + my * 0.15;
    forme.scale.setScalar(mix(0.95, 1.12, p1) * mix(1, 1.2, p3));
    const ang = p * 2.4 + mx * 0.15;
    const dz = cam.aspect < 1 ? 9.5 : 6.6;
    const d = mix(dz, dz * 1.08, p2);
    cam.position.set(Math.sin(ang) * d, mix(0.2, 1.4, p2) - p3 * 1.1, Math.cos(ang) * d);
    cam.lookAt(0, 0, 0);
    rouge.position.set(Math.cos(s * 0.6 + p * 6) * 3.2, Math.sin(p * 4) * 1.5 + 1, Math.sin(s * 0.6 + p * 6) * 3.2);
    rouge.intensity = 12 + p3 * 6;
    anneau.scale.setScalar(mix(0.2, 1.25, p3)); anneau.visible = p3 > 0.02; anneau.rotation.z = s * 0.2;
    if (b.enabled) b.strength = 0.25 + p3 * 0.1;
    // la typographie accompagne : le nom s'ecarte, le reste du hero s'efface
    if (hero) { hero.style.setProperty('--o1', p1.toFixed(3)); hero.style.setProperty('--o2', p2.toFixed(3)); }
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
    [...fam.querySelectorAll('.gal-item')].filter(t => !t.classList.contains('brand-secondary')).forEach(t => {
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
      projets.push({ tuile: t, fam: cle, famNom: nom.trim(), famNum: num.trim(), src, w, h, video,
        titre: t.dataset.brand || (t.dataset.title || '').split(',')[0], cat: (t.dataset.cat || '').replace(/&middot;/g, '·') });
    });
  });
  // la longueur de la piste suit le nombre de pieces
  el.style.height = (100 + projets.length * 15) + 'vh';
  const elFam = el.querySelector('.sel-fam'), elNum = el.querySelector('.sel-num'), elT = el.querySelector('.sel-t'), elC = el.querySelector('.sel-c'),
        elX = el.querySelector('.sel-x'), elTot = el.querySelector('.sel-tot'), elB = el.querySelector('.sel-barre i');
  if (elTot) elTot.textContent = '/ ' + String(projets.length).padStart(2, '0');

  const VS = `uniform float uV,uT;varying vec2 vUv;
void main(){vUv=uv;vec3 p=position;
  p.z+=sin(uv.x*3.14159)*uV*0.9; p.y+=sin(uv.x*6.283+uT)*uV*0.08;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
  const FS = `uniform sampler2D uMap;uniform float uV,uOk,uFocus;varying vec2 vUv;
void main(){float s=uV*0.018+0.0015;
  vec4 c=vec4(texture2D(uMap,vUv+vec2(s,0.)).r,texture2D(uMap,vUv).g,texture2D(uMap,vUv-vec2(s,0.)).b,1.);
  c.rgb=mix(vec3(0.06,0.07,0.09),c.rgb,uOk);
  c.rgb*=mix(0.38,1.0,uFocus);
  float e=smoothstep(0.0,0.012,vUv.x)*smoothstep(1.0,0.988,vUv.x)*smoothstep(0.0,0.012,vUv.y)*smoothstep(1.0,0.988,vUv.y);
  c.rgb=mix(vec3(1.0,0.23,0.14)*uFocus,c.rgb,e);
  gl_FragColor=c;}`;

  const R = 7.2, H = 3.1, ECART = 0.55;
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
      if (i > 0 && p.pr.fam !== plans[i - 1].pr.fam) a -= 2.4 / R;
      const da = (p.m.scale.x + ECART) / R; if (i > 0) a -= da / 2; p.piv.rotation.y = a; p.ang = a; a -= da / 2; });
  }
  placer();
  // des pastilles pour sauter d'une famille a l'autre
  const puces = el.querySelector('.sel-fams');
  if (puces) {
    const total0 = plans.length ? -plans[plans.length - 1].ang : 1;
    const vues = {};
    plans.forEach(pl => {
      if (vues[pl.pr.fam]) return; vues[pl.pr.fam] = 1;
      const bt = document.createElement('button'); bt.type = 'button'; bt.dataset.f = pl.pr.fam;
      bt.textContent = pl.pr.famNom; bt.addEventListener('click', () => {
        const top = el.getBoundingClientRect().top + pageYOffset;
        const course = el.offsetHeight - innerHeight;
        window.scrollTo({ top: top + course * clamp(-pl.ang / total0) + 2, behavior: 'smooth' });
      });
      puces.appendChild(bt);
    });
  }
  function charger() {
    if (charge) return; charge = true;
    plans.forEach(pl => chargeur.load(pl.pr.src, tex => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
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
  canvas.addEventListener('click', () => { if (courant >= 0) projets[courant].tuile.click(); });

  function taille() {
    const [w, h] = tailleCadre(canvas); if (w === w0 && h === h0 && qv === Q.v) return; w0 = w; h0 = h; qv = Q.v; r.setPixelRatio(dpr()); c.setPixelRatio(dpr());
    r.setSize(w, h, false); c.setSize(w, h); cam.aspect = w / h; cam.fov = w < h ? 62 : 42; cam.updateProjectionMatrix();
  }

  return function image(t) {
    if (!P.visible()) { P.progression(); return; }
    charger(); taille();
    const p = SOBRE ? 0 : P.progression();
    const dv = (p - pPrec) * 60; pPrec = p;
    vit += (dv - vit) * 0.12;
    const s = t / 1000;
    const total = plans.length ? -plans[plans.length - 1].ang : 0;
    angle += (p * total - angle) * 0.2;
    arc.rotation.y = angle;
    cam.position.set(mx * 0.35, -0.2 - my * 0.2 + Math.min(0.3, Math.abs(vit) * 0.4), 2.2 + Math.min(1.2, Math.abs(vit) * 1.6));
    cam.lookAt(0, -0.38, -R);
    let best = 0, bd = 9;
    plans.forEach((pl, i) => {
      const d = Math.abs(pl.ang + angle);
      if (d < bd) { bd = d; best = i; }
      pl.u.uV.value = clamp(vit * 2.2, -0.6, 0.6); pl.u.uT.value = s;
      pl.u.uFocus.value += (doux(clamp(1 - d / 0.45)) - pl.u.uFocus.value) * 0.15;
      pl.m.position.z = -R + pl.u.uFocus.value * 0.8;
    });
    if (best !== courant && projets[best]) {
      courant = best; const pr = projets[best];
      const n = String(best + 1).padStart(2, '0');
      if (elNum) elNum.textContent = n; if (elX) elX.textContent = n;
      if (elT) { elT.textContent = pr.titre; elT.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' }); }
      if (elC) elC.textContent = pr.cat;
      if (elFam && elFam.dataset.f !== pr.fam) {
        elFam.dataset.f = pr.fam; elFam.textContent = pr.famNum + ' · ' + pr.famNom;
        if (puces) puces.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.f === pr.fam));
        elFam.animate([{ opacity: 0, letterSpacing: '.5em' }, { opacity: 1, letterSpacing: '.26em' }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    }
    if (elB) elB.style.width = (p * 100).toFixed(2) + '%';
    b.strength = 0.45 + Math.min(1, Math.abs(vit) * 2);
    c.render(); return true;
  };
}

function demarrer() {
  if (SOBRE || !webgl()) { document.body.classList.add('sans-3d'); return; }
  document.body.classList.add('avec-3d');
  const scenes = [ouverture(), selection()].filter(Boolean);
  let vivant = true;
  document.addEventListener('visibilitychange', () => { vivant = !document.hidden; if (vivant) requestAnimationFrame(boucle); });
  let tPrec = 0, cumul = 0, n = 0, calme = 0;
  function boucle(t) {
    if (!vivant) return;
    const dt = tPrec ? t - tPrec : 16; tPrec = t;
    const actif = scenes.map(f => f(t)).some(Boolean);
    if (actif && dt < 200) {
      cumul += dt; n++;
      if (n >= 40) {
        const moy = cumul / n; cumul = 0; n = 0;
        if (moy > 18.5 && Q.f > 0.5) { Q.f = Math.max(0.5, Q.f * 0.8); Q.v++; calme = 0; }
        else if (moy < 14 && Q.f < 1 && ++calme > 4) { Q.f = Math.min(1, Q.f * 1.1); Q.v++; calme = 0; }
      }
    }
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
else demarrer();
