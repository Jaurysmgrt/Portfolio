// ═══════════════════════════════════════════════════════════════════════
// LA SOUFFLERIE — le monde de Jaurys Maigret
//
// Un hall d'essai. On n'y marche pas : le flux vous porte, et ZQSD règle
// le régime. Les pièces ne sont pas accrochées à un mur — elles sont
// MONTÉES dans la veine, chacune sur son socle, son numéro peint au sol,
// sa veilleuse braquée dessus. Le reste est noir.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from '../vendor/three.module.min.js';

const NOIR    = 0x040405;
const SOL     = 0x17171a;
const PAROI   = 0x34312f;
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
    const charger = () => import('./son.js').then(m => { SON = m; m.allumer(); etat(true); m.son.tension(); });
    btn.addEventListener('click', () => {
      if (!SON) return charger();
      if (on) { SON.eteindre(); etat(false); } else { SON.allumer(); etat(true); SON.son.tic(); }
    });
    let voulu = false;
    try { voulu = localStorage.getItem('jm-son') === '1'; } catch (e) {}
    if (voulu) {
      const reveil = () => { document.removeEventListener('pointerdown', reveil);
        document.removeEventListener('keydown', reveil);
        import('./son.js').then(m => { SON = m; m.allumer(); etat(true); }); };
      document.addEventListener('pointerdown', reveil, { once: true });
      document.addEventListener('keydown', reveil, { once: true });
    }
  })();

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
  monde.fog = new THREE.FogExp2(0x0c0b0b, 0.0105);
  const cam = new THREE.PerspectiveCamera(64, 1, 0.1, 400);

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
  const texGrain = toile(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const additif = (map, color, opacity) => new THREE.MeshBasicMaterial({
    map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  // ═══════════ la galerie ═══════════
  // Un sol de pierre polie : il est legerement transparent, et sous lui
  // les oeuvres sont recopiees a l'envers. C'est ce qui fait le reflet.
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(DEMI_L * 2, ETENDUE),
    new THREE.MeshStandardMaterial({ color: SOL, roughness: 0.6, metalness: 0.12, transparent: true, opacity: 0.8 })
  );
  sol.rotation.x = -Math.PI / 2;
  sol.position.z = MILIEU;
  sol.renderOrder = 2;
  monde.add(sol);

  const matParoi = new THREE.MeshStandardMaterial({ color: PAROI, roughness: 0.96, metalness: 0.02, side: THREE.DoubleSide });
  for (const c of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ETENDUE, PLAFOND), matParoi);
    m.rotation.y = c * Math.PI / 2;
    m.position.set(c * DEMI_L, PLAFOND / 2, MILIEU);
    monde.add(m);

    // la corniche lumineuse : une ligne chaude sous le plafond, qui lave le mur
    const corniche = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, ETENDUE),
      new THREE.MeshBasicMaterial({ color: 0xffe2bf }));
    corniche.position.set(c * (DEMI_L - 0.12), PLAFOND - 0.34, MILIEU);
    monde.add(corniche);
    const lavis = new THREE.Mesh(new THREE.PlaneGeometry(ETENDUE, 2.6), additif(texDegrade, 0xffd8ad, 0.42));
    lavis.rotation.y = c * Math.PI / 2;
    lavis.position.set(c * (DEMI_L - 0.015), PLAFOND - 0.34 - 1.3, MILIEU);
    lavis.renderOrder = 3;
    monde.add(lavis);

    // la plinthe, et son fil rouge : le seul rouge de la salle
    const plinthe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, ETENDUE),
      new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.5, metalness: 0.3 }));
    plinthe.position.set(c * (DEMI_L - 0.02), 0.08, MILIEU);
    monde.add(plinthe);
    const fil = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, ETENDUE),
      new THREE.MeshBasicMaterial({ color: 0xff3a24 }));
    fil.position.set(c * (DEMI_L - 0.045), 0.17, MILIEU);
    monde.add(fil);
    // le rail des projecteurs
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, ETENDUE),
      new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.4, metalness: 0.6 }));
    rail.position.set(c * (DEMI_L - 2.3), PLAFOND - 0.04, MILIEU);
    monde.add(rail);
  }
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(DEMI_L * 2, ETENDUE),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95, side: THREE.DoubleSide }));
  pf.rotation.x = Math.PI / 2;
  pf.position.set(0, PLAFOND, MILIEU);
  monde.add(pf);

  // ═══════════ lumière ═══════════
  // Une salle de musee : peu de lumiere d'ambiance, tout vient des projecteurs.
  monde.add(new THREE.AmbientLight(0xc9beb0, 1.1));
  monde.add(new THREE.HemisphereLight(0xeadcc8, 0x111114, 0.9));
  const lampes = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight(0xffe9d2, 20, 30, 2);
    monde.add(l); lampes.push(l);
  }
  const braise = new THREE.PointLight(ROUGE, 9, 24, 2);
  monde.add(braise);

  // la poussiere qui flotte dans la lumiere
  const NB_GRAINS = 650;
  const grainsPos = new Float32Array(NB_GRAINS * 3);
  const grainsVit = new Float32Array(NB_GRAINS);
  for (let i = 0; i < NB_GRAINS; i++) {
    grainsPos[i * 3] = (Math.random() * 2 - 1) * (DEMI_L - 0.4);
    grainsPos[i * 3 + 1] = 0.3 + Math.random() * (PLAFOND - 0.8);
    grainsPos[i * 3 + 2] = 8 - Math.random() * 40;
    grainsVit[i] = 0.02 + Math.random() * 0.05;
  }
  const geoGrains = new THREE.BufferGeometry();
  geoGrains.setAttribute('position', new THREE.BufferAttribute(grainsPos, 3));
  const grains = new THREE.Points(geoGrains, new THREE.PointsMaterial({
    map: texGrain, color: 0xffe7c8, size: 0.03, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  grains.frustumCulled = false;
  grains.renderOrder = 5;
  monde.add(grains);

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
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.62
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

  const matCadre = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.38, metalness: 0.45 });
  const matPasse = new THREE.MeshStandardMaterial({ color: 0xebe6dc, roughness: 0.92, metalness: 0 });
  const matBoitier = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.35, metalness: 0.7 });
  const matBouche = new THREE.MeshBasicMaterial({ color: 0xfff1de });

  // Le faisceau : un cone dont les bords s'effacent (plus on le voit de
  // profil, plus il est transparent) et qui s'eteint vers le mur. C'est ce
  // qui donne l'impression d'un volume de lumiere, pas d'un triangle.
  const matFaisceau = new THREE.ShaderMaterial({
    uniforms: { teinte: { value: new THREE.Color(0xffdcb0) }, force: { value: 0.16 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){ vH = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 teinte; uniform float force; varying vec3 vN; varying vec3 vV; varying float vH;
      void main(){ float face = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float fondu = pow(vH, 1.4);
        gl_FragColor = vec4(teinte * face * fondu * force, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });

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

    const cadre = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * (M + C), H + 2 * (M + C), 0.08), matCadre);
    cadre.position.set(0, HAUT_C, 0.04);
    g.add(cadre);
    const passe = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * M, H + 2 * M), matPasse);
    passe.position.set(0, HAUT_C, 0.081);
    g.add(passe);

    let reflet = null;
    const tex = chargeur.load(p.src, () => { if (reflet) reflet.needsUpdate = true; });
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
    reflet = tex.clone(); reflet.repeat.set(1, -1); reflet.offset.set(0, 1);

    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 });
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(L, H), mat);
    tab.position.set(0, HAUT_C, 0.084);
    g.add(tab);

    // le halo du projecteur sur le mur, au-dessus et autour du cadre
    const halo = new THREE.Mesh(new THREE.PlaneGeometry((L + 1.2) * 1.75, (H + 1.2) * 1.6),
      additif(texHalo, 0xffd6a6, 0.3));
    halo.position.set(0, HAUT_C + 0.3, 0.01);
    halo.renderOrder = 3;
    g.add(halo);

    // son reflet dans la pierre polie
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(L, H), new THREE.MeshBasicMaterial({
      map: reflet, alphaMap: texFondu, transparent: true, opacity: 0.38, depthWrite: false }));
    refl.position.set(0, -HAUT_C, 0.084);
    refl.renderOrder = 1;
    g.add(refl);
    const reflHalo = new THREE.Mesh(new THREE.PlaneGeometry((L + 1.2) * 1.75, (H + 1.2) * 1.2),
      additif(texHalo, 0xffd6a6, 0.08));
    reflHalo.position.set(0, -HAUT_C, 0.01);
    reflHalo.renderOrder = 1;
    g.add(reflHalo);

    const ct = cartel(p, i);
    ct.position.set(L / 2 + M + C + 0.72, 1.58, 0.012);
    g.add(ct);

    tab.userData = { p, i, k: 0, cible: 0, groupe: g, mat, halo };
    cibles.push(tab);

    // le projecteur sur son rail, et le faisceau qu'on voit dans la poussiere
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

    const lg = P.distanceTo(T) * 1.08;
    const geoF = new THREE.ConeGeometry(Math.max(L, H) * 0.6, lg, 40, 1, true);
    geoF.translate(0, -lg / 2, 0);
    const faisceau = new THREE.Mesh(geoF, matFaisceau);
    faisceau.position.copy(P);
    faisceau.quaternion.copy(q);
    faisceau.renderOrder = 4;
    monde.add(faisceau);

    oeuvres.push({ P, T, z, tab });
  });

  // L'architecture : des passages tous les trois projets decoupent l'allee
  // en salles, et des dalles diffusantes rythment le plafond.
  const matArche = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.9, metalness: 0.05 });
  const matArete = new THREE.MeshBasicMaterial({ color: 0xffe2bf });
  for (let k = 2; k < expos.length - 1; k += 3) {
    const za = -24 - (k + 0.5) * PAS;
    for (const c of [-1, 1]) {
      const pilier = new THREE.Mesh(new THREE.BoxGeometry(0.9, PLAFOND, 0.8), matArche);
      pilier.position.set(c * (DEMI_L - 0.45), PLAFOND / 2, za);
      monde.add(pilier);
    }
    const linteau = new THREE.Mesh(new THREE.BoxGeometry(DEMI_L * 2, 0.7, 0.8), matArche);
    linteau.position.set(0, PLAFOND - 0.35, za);
    monde.add(linteau);
    // un filet de lumiere sous le linteau : on passe d'une salle a l'autre
    const arete = new THREE.Mesh(new THREE.BoxGeometry(DEMI_L * 2 - 1.8, 0.02, 0.05), matArete);
    arete.position.set(0, PLAFOND - 0.71, za + 0.41);
    monde.add(arete);
  }
  // dalles diffusantes : un verre depoli tres doux, cerne d'un filet plus clair
  const matDalle = new THREE.MeshBasicMaterial({ color: 0x2f2924 });
  const matFilet = new THREE.MeshBasicMaterial({ color: 0x8a7a68 });
  for (let z = 4; z > -LONG; z -= PAS) {
    const zc = z - PAS / 2;
    const dalle = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), matDalle);
    dalle.rotation.x = Math.PI / 2;
    dalle.position.set(0, PLAFOND - 0.01, zc);
    monde.add(dalle);
    for (const [w, h, x, dz] of [[2.24, 0.025, 0, 1.6], [2.24, 0.025, 0, -1.6], [0.025, 3.2, 1.1, 0], [0.025, 3.2, -1.1, 0]]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matFilet);
      f.rotation.x = Math.PI / 2;
      f.position.set(x, PLAFOND - 0.012, zc + dz);
      monde.add(f);
    }
  }

  // Quatre projecteurs reels seulement, deplaces vers les oeuvres les plus
  // proches : le nombre de lumieres ne change jamais, donc aucun shader a
  // recompiler en marchant (c'etait la cause des a-coups).
  const projecteurs = [];
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.SpotLight(0xffe4c2, 70, 14, 0.56, 0.6, 1.5);
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
  const fond = new THREE.Mesh(new THREE.PlaneGeometry(DEMI_L * 2, PLAFOND), matParoi);
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
  let lacet = 0, tangage = 0;        // 0 = on regarde vers le fond du hall
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
      pos.y = OEIL;
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

    // la poussiere derive doucement et suit le visiteur
    const gp = geoGrains.attributes.position.array;
    for (let i = 0; i < NB_GRAINS; i++) {
      gp[i * 3 + 1] += Math.sin(t * 0.0004 + i) * 0.0009 + grainsVit[i] * dt * 0.15;
      gp[i * 3] += Math.cos(t * 0.0003 + i * 1.7) * 0.0006;
      if (gp[i * 3 + 1] > PLAFOND - 0.3) gp[i * 3 + 1] = 0.3;
      if (gp[i * 3 + 2] > pos.z + 8) gp[i * 3 + 2] -= 40;
      else if (gp[i * 3 + 2] < pos.z - 32) gp[i * 3 + 2] += 40;
    }
    geoGrains.attributes.position.needsUpdate = true;

    // les lampes suivent
    // une lumiere douce qui accompagne le visiteur, a hauteur d'oeil : elle
    // eclaire les murs sans faire de tache au plafond ni au sol
    lampes[0].position.set(pos.x * 0.4, 2.6, pos.z + 3);
    lampes[1].position.set(pos.x * 0.4, 2.6, pos.z - 12);
    lampes[2].position.set(pos.x * 0.4, 2.6, pos.z - 26);

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
      u.halo.material.opacity = 0.3 + u.k * 0.22;
    }

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
