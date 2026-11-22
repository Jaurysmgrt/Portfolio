// ═══════════════════════════════════════════════════════════════════════
// LE SON DE LA SOUFFLERIE
//
// Rien n'est charge : tout est synthetise. Pas un fichier, pas un octet,
// et surtout pas une nappe d'ambiance prise sur une banque de sons.
//
// Ce qui fait qu'on y croit, ce n'est pas le timbre, c'est l'ESPACE : une
// reverberation de hall calculee ici meme, dans laquelle tout est envoye.
// Et le souffle n'est pas une boucle : il reagit au deplacement. On avance,
// l'air monte. On s'arrete, il retombe.
//
// Coupe par defaut. On n'embusque personne avec du son.
// ═══════════════════════════════════════════════════════════════════════

let ctx = null, actif = false;
let maitre, sec, versEcho, echo, bruit;
let air, airFiltre, airGain, sub, subGain;
let vitesse = 0, vitesseLisse = 0;
let nappeFiltre = null, hatBus = null;

// ── la reverberation : un hall long, beton, un peu mat ──
function impulsion(duree = 2.9, chute = 2.6) {
  const n = Math.floor(ctx.sampleRate * duree);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      // un peu de retard au debut : le son part, puis la salle repond
      const tete = i < ctx.sampleRate * 0.012 ? 0.15 : 1;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, chute) * tete;
    }
  }
  return buf;
}

function creer() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  // un compresseur en sortie : rien ne saute aux oreilles
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.ratio.value = 4;
  comp.attack.value = 0.004; comp.release.value = 0.22;
  comp.connect(ctx.destination);

  maitre = ctx.createGain();
  maitre.gain.value = 0;
  maitre.connect(comp);

  sec = ctx.createGain(); sec.gain.value = 0.82;
  sec.connect(maitre);

  echo = ctx.createConvolver();
  echo.buffer = impulsion();
  const echoGain = ctx.createGain(); echoGain.gain.value = 0.9;
  echo.connect(echoGain); echoGain.connect(maitre);

  versEcho = ctx.createGain(); versEcho.gain.value = 0.2;
  versEcho.connect(echo);

  // deux secondes de bruit : la matiere premiere de tout le reste
  const n = ctx.sampleRate * 2;
  bruit = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

  // ── le souffle ──
  air = ctx.createBufferSource(); air.buffer = bruit; air.loop = true;
  airFiltre = ctx.createBiquadFilter();
  airFiltre.type = 'bandpass'; airFiltre.frequency.value = 300; airFiltre.Q.value = 0.42;
  const airHaut = ctx.createBiquadFilter();
  airHaut.type = 'lowpass'; airHaut.frequency.value = 1400;
  airGain = ctx.createGain(); airGain.gain.value = 0;
  air.connect(airFiltre); airFiltre.connect(airHaut);
  airHaut.connect(airGain);
  airGain.connect(sec); airGain.connect(versEcho);
  air.start();

  // la respiration lente du hall, pour que rien ne soit jamais fige
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.055;
  const lfoG = ctx.createGain(); lfoG.gain.value = 70;
  lfo.connect(lfoG); lfoG.connect(airFiltre.frequency); lfo.start();

  // ── le socle : une basse tres profonde, presque sous l'audition ──
  sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 41;
  subGain = ctx.createGain(); subGain.gain.value = 0;
  const subLfo = ctx.createOscillator(); subLfo.frequency.value = 0.031;
  const subLfoG = ctx.createGain(); subLfoG.gain.value = 3.2;
  subLfo.connect(subLfoG); subLfoG.connect(sub.frequency); subLfo.start();
  sub.connect(subGain); subGain.connect(sec);
  sub.start();

  creerMusique();
  boucle();
}

// ── le souffle suit le deplacement : c'est ca, une soufflerie ──
function boucle() {
  if (!ctx) return;
  vitesseLisse += (vitesse - vitesseLisse) * 0.08;
  if (actif && airGain) {
    const v = Math.min(1, vitesseLisse);
    const t = ctx.currentTime;
    airGain.gain.setTargetAtTime(v * 0.09, t, 0.25);
    airFiltre.frequency.setTargetAtTime(300 + v * 1250, t, 0.14);
    airFiltre.Q.setTargetAtTime(0.42 + v * 0.5, t, 0.2);
    subGain.gain.setTargetAtTime(v * 0.02, t, 0.4);
    // la musique s'ouvre quand on bouge : nappes plus claires, charleston plus present
    if (nappeFiltre) {
      nappeFiltre.frequency.setTargetAtTime(780 + v * 2100, t, 0.6);
      hatBus.gain.setTargetAtTime(0.75 + v * 0.6, t, 0.4);
    }
  }
  requestAnimationFrame(boucle);
}

function enveloppe(dur, vol) {
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.015, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(sec); g.connect(versEcho);
  return g;
}

function souffle({ freq = 1800, q = 1, dur = 0.06, vol = 0.1, type = 'bandpass', glisse = 0 }) {
  if (!ctx || !actif) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = bruit;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  if (glisse) {
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * glisse), t + dur);
  }
  src.connect(f); f.connect(enveloppe(dur, vol));
  src.start(t); src.stop(t + dur + 0.05);
}

function ton({ f0 = 90, f1 = 90, dur = 0.18, vol = 0.07, forme = 'sine', retard = 0 }) {
  if (!ctx || !actif) return;
  const t = ctx.currentTime + retard;
  const o = ctx.createOscillator();
  o.type = forme;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sec); g.connect(versEcho);
  o.start(t); o.stop(t + dur + 0.05);
}

// ── les sons reels ──
// Un impact : un objet frappe vibre sur quelques frequences propres qui
// s'eteignent chacune a son rythme, et le contact lui-meme fait un bruit
// tres court. C'est ce qui distingue un vrai clic d'un « bip ».
function impact({ modes, bruitF = 3000, bruitQ = 0.8, bruitDur = 0.008, bruitVol = 0.08, retard = 0, vol = 1 }) {
  if (!ctx || !actif) return;
  const t = ctx.currentTime + retard;
  for (const [f, dec, a] of modes) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.02);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, a * vol * 0.42), t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec * 4);
    o.connect(g); g.connect(sec); g.connect(versEcho);
    o.start(t); o.stop(t + dec * 4 + 0.02);
  }
  if (bruitVol) {
    const src = ctx.createBufferSource(); src.buffer = bruit;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bruitF; f.Q.value = bruitQ;
    const g = ctx.createGain();
    g.gain.setValueAtTime(bruitVol * vol * 2.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + bruitDur);
    src.connect(f); f.connect(g); g.connect(sec); g.connect(versEcho);
    src.start(t, Math.random() * 1.5); src.stop(t + bruitDur + 0.02);
  }
}
// Le papier : un nuage de micro-craquements. On les « grave » dans un
// tampon une fois, puis on le joue dans un filtre : leger et tres realiste.
function papier({ dur = 0.3, densite = 900, freq = 3500, q = 0.7, vol = 0.1, retard = 0, forme = 'cloche' }) {
  if (!ctx || !actif) return;
  const sr = ctx.sampleRate, n = Math.floor(dur * sr);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const nb = Math.floor(dur * densite);
  for (let k = 0; k < nb; k++) {
    const u = Math.random();
    const env = forme === 'monte' ? u : forme === 'chute' ? 1 - u : Math.sin(Math.PI * u);
    const pos = Math.floor(u * (n - 400)), lg = 20 + Math.floor(Math.random() * 180);
    const a = (0.3 + Math.random() * 0.7) * env;
    for (let i = 0; i < lg; i++) d[pos + i] += (Math.random() * 2 - 1) * a * Math.exp(-i / (lg * 0.3));
  }
  // un fond de frottement sous les craquements
  for (let i = 0; i < n; i++) { const u = i / n; const env = forme === 'monte' ? u : forme === 'chute' ? 1 - u : Math.sin(Math.PI * u); d[i] += (Math.random() * 2 - 1) * 0.06 * env; }
  const t = ctx.currentTime + retard;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
  const g = ctx.createGain(); g.gain.value = vol * 3.2;
  src.connect(hp); hp.connect(f); f.connect(g); g.connect(sec); g.connect(versEcho);
  src.start(t);
}
// L'air qui passe : un bruit filtre dont la couleur glisse, avec une
// enveloppe douce. Pas de note, seulement du mouvement.
function passage({ de = 400, vers = 2000, dur = 0.5, vol = 0.08, q = 0.6, retard = 0, flottement = 0 }) {
  if (!ctx || !actif) return;
  const t = ctx.currentTime + retard;
  const src = ctx.createBufferSource(); src.buffer = bruit; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(de, t); f.frequency.exponentialRampToValueAtTime(vers, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * 3.2, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  if (flottement) {   // le tissu, le papier qui ondule : une modulation rapide
    const am = ctx.createGain(); am.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = flottement;
    const lg = ctx.createGain(); lg.gain.value = 0.4;
    lfo.connect(lg); lg.connect(am.gain); f.connect(am); am.connect(g);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  } else f.connect(g);
  g.connect(sec); g.connect(versEcho);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

// ── le vocabulaire ──
export const son = {
  // le regard se pose sur une piece : un petit cran mecanique
  tic() { impact({ modes: [[2600, 0.01, 0.35], [5400, 0.005, 0.2]], bruitF: 6000, bruitDur: 0.004, bruitVol: 0.04 }); },
  // on ouvre : un loquet qui s'enclenche, puis l'air
  clac() { impact({ modes: [[170, 0.05, 0.7], [1150, 0.025, 0.35], [2900, 0.012, 0.2]], bruitF: 2400, bruitDur: 0.012, bruitVol: 0.12 });
           passage({ de: 300, vers: 1400, dur: 0.35, vol: 0.05 }); },
  // on change de zone : un passage d'air
  balai() { passage({ de: 260, vers: 2600, dur: 0.6, vol: 0.09, q: 0.5 }); },
  // mise sous tension : un relais, puis le ronronnement qui s'installe et retombe
  tension() { impact({ modes: [[140, 0.06, 0.6], [900, 0.02, 0.3]], bruitF: 1800, bruitDur: 0.015, bruitVol: 0.1 });
              passage({ de: 120, vers: 420, dur: 1.4, vol: 0.05, q: 0.8, retard: 0.05 }); },
  // fermeture : un petit clic
  clic() { impact({ modes: [[1800, 0.01, 0.35], [4100, 0.005, 0.2]], bruitF: 4500, bruitDur: 0.005, bruitVol: 0.05 }); },

  // ── l'histoire ──
  // un reflex : le miroir se leve, le rideau passe, le miroir retombe
  obturateur() { impact({ modes: [[3100, 0.008, 0.45], [5800, 0.005, 0.3], [950, 0.02, 0.35]], bruitF: 4200, bruitDur: 0.007, bruitVol: 0.14 });
                 impact({ modes: [[2700, 0.009, 0.4], [5200, 0.005, 0.25], [820, 0.025, 0.35]], bruitF: 3600, bruitDur: 0.009, bruitVol: 0.12, retard: 0.07 }); },
  // une punaise s'enfonce dans le liege
  punaise() { impact({ modes: [[3800, 0.004, 0.25], [140, 0.035, 0.6], [430, 0.018, 0.25]], bruitF: 1300, bruitDur: 0.012, bruitVol: 0.08 }); },
  // une feuille tourne
  feuille() { papier({ dur: 0.22, densite: 700, freq: 3800, vol: 0.12 }); passage({ de: 800, vers: 1600, dur: 0.25, vol: 0.025 }); },
  // on arrache la page
  arrache() { papier({ dur: 0.38, densite: 3200, freq: 2600, q: 0.6, vol: 0.2, forme: 'monte' }); },
  // un tampon s'ecrase sur le papier
  tampon() { impact({ modes: [[95, 0.07, 0.8], [260, 0.035, 0.35], [700, 0.012, 0.15]], bruitF: 900, bruitQ: 0.6, bruitDur: 0.03, bruitVol: 0.12 }); },
  // le pinceau du colleur d'affiches
  colle() { papier({ dur: 0.45, densite: 1500, freq: 5200, q: 0.5, vol: 0.08 }); passage({ de: 1200, vers: 2200, dur: 0.45, vol: 0.03 }); },
  // les projecteurs s'allument : le relais claque, la lampe gresille un instant
  lampe() { impact({ modes: [[160, 0.04, 0.5], [1300, 0.015, 0.25]], bruitF: 2000, bruitDur: 0.01, bruitVol: 0.08 });
            papier({ dur: 0.18, densite: 1200, freq: 6000, q: 1.5, vol: 0.04, forme: 'chute', retard: 0.03 }); },
  // la voiture a son propre moteur : ces deux-la ne font plus rien
  arrivee() {}, depart() {},
  // une touche de machine a ecrire
  touche() { impact({ modes: [[1700 + Math.random() * 300, 0.014, 0.4], [3600, 0.007, 0.25], [230, 0.025, 0.3]], bruitF: 3000, bruitDur: 0.006, bruitVol: 0.07 }); },
  // on change de chapitre : un souffle de papier
  page() { papier({ dur: 0.3, densite: 500, freq: 3200, vol: 0.07 }); passage({ de: 400, vers: 1500, dur: 0.35, vol: 0.035 }); },

  // le klaxon double ton d'une voiture : deux notes dissonantes, saturees
  klaxon() {
    if (!ctx || !actif) return;
    const coup = (debut, duree) => {
      const t = ctx.currentTime + debut;
      const sat = ctx.createWaveShaper(); sat.curve = courbe(3);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.01);
      g.gain.setValueAtTime(0.13, t + duree - 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      sat.connect(bp); bp.connect(g); g.connect(sec); g.connect(versEcho);
      for (const f of [415, 495]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(sat); o.start(t); o.stop(t + duree + 0.02); }
    };
    coup(0, 0.16); coup(0.22, 0.28);
  },
  // appel de phares : deux relais
  phares() { [0, 0.18].forEach(r => impact({ modes: [[1500, 0.008, 0.3], [3300, 0.004, 0.15]], bruitF: 4000, bruitDur: 0.004, bruitVol: 0.04, retard: r })); },
  // l'avion en papier : l'air, et la feuille qui vibre
  avion() { passage({ de: 500, vers: 1800, dur: 1.1, vol: 0.06, flottement: 18 }); },
  // le rideau de la page projet : un tissu lourd qui glisse
  rideau() { passage({ de: 300, vers: 900, dur: 0.95, vol: 0.1, q: 0.45, flottement: 11 }); },
  // la traversee des anneaux de l'ouverture : un grand passage d'air
  tunnel() { passage({ de: 120, vers: 2400, dur: 1.5, vol: 0.12, q: 0.4 }); },
  // une lettre qui tombe en place
  lettre() { impact({ modes: [[600 + Math.random() * 150, 0.018, 0.3], [1900, 0.008, 0.18]], bruitF: 2500, bruitDur: 0.005, bruitVol: 0.04 }); },
  // un post-it qui se decroche et tombe
  chute() { papier({ dur: 0.5, densite: 260, freq: 3000, vol: 0.06, forme: 'chute' }); passage({ de: 900, vers: 500, dur: 0.5, vol: 0.03, flottement: 9 }); },
  // une piece de l'arc passe au centre : un cran
  cran() { impact({ modes: [[3200, 0.005, 0.2]], bruitF: 5000, bruitDur: 0.003, bruitVol: 0.025 }); },
  // un pas sur le beton cire : le talon, puis la semelle qui frotte
  pas() { impact({ modes: [[85 + Math.random() * 20, 0.03, 0.45], [230, 0.018, 0.2]], bruitF: 1600 + Math.random() * 600, bruitQ: 0.7, bruitDur: 0.035, bruitVol: 0.05, vol: 0.8 });
          papier({ dur: 0.06, densite: 400, freq: 4200, vol: 0.015, forme: 'chute', retard: 0.03 }); },
  // on passe devant une piece : un souffle a peine audible
  frole() { passage({ de: 600, vers: 900, dur: 0.7, vol: 0.015 }); }
};

const dernier = {};
for (const nom of Object.keys(son)) {
  const f = son[nom];
  son[nom] = function () {
    const t = performance.now();
    if (dernier[nom] && t - dernier[nom] < 260) return;
    dernier[nom] = t;
    f.apply(son, arguments);
  };
}


// ═══════════════════════════════════════════════════════════════════════
// LA MUSIQUE
//
// Un morceau original, joue en direct : 98 BPM, re mineur, quatre accords
// (Rem9, Sib7M, Fa7M, Do add9), deux mesures chacun. Grosse caisse douce,
// charleston a contretemps, basse, nappes chaudes qui « respirent » sur la
// grosse caisse, et quelques notes pincees avec un echo.
//
// Le morceau se cale sur l'horloge reelle : de la page d'accueil a la
// Soufflerie, on retombe sur le meme temps et le meme accord. Chaque temps
// est annonce a la page (evenement « jm-temps ») pour que l'image suive.
// ═══════════════════════════════════════════════════════════════════════
const BPM = 98;
const DOUBLE = 60 / BPM / 4;            // une double croche
const ACCORDS = [
  { basse: 38, notes: [50, 53, 57, 60, 64] },   // Rem9
  { basse: 34, notes: [50, 53, 57, 58, 62] },   // Sib7M
  { basse: 41, notes: [53, 57, 60, 64, 65] },   // Fa7M
  { basse: 36, notes: [52, 55, 60, 62, 67] }    // Do add9
];
const GAMME = [62, 65, 67, 69, 72, 74, 77, 79];  // pentatonique de re, en haut
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// un hasard qui ne change pas : la meme mesure joue toujours les memes notes
const des = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };

let musBus, musVol, nappeBus, nappeDuck, echoPince, musiqueVoulue = true;
let prochain = null, ecart = null, minuteur = null;

function creerMusique() {
  musVol = ctx.createGain(); musVol.gain.value = 0;
  musVol.connect(maitre);
  musBus = ctx.createGain(); musBus.gain.value = 1.15;
  musBus.connect(musVol);

  // les nappes : filtre commun, et un « pompage » sur chaque grosse caisse
  nappeFiltre = ctx.createBiquadFilter();
  nappeFiltre.type = 'lowpass'; nappeFiltre.frequency.value = 900; nappeFiltre.Q.value = 0.6;
  nappeDuck = ctx.createGain(); nappeDuck.gain.value = 1;
  nappeBus = ctx.createGain(); nappeBus.gain.value = 1;
  nappeBus.connect(nappeFiltre); nappeFiltre.connect(nappeDuck);
  nappeDuck.connect(musBus);
  const envoiNappe = ctx.createGain(); envoiNappe.gain.value = 0.55;
  nappeDuck.connect(envoiNappe); envoiNappe.connect(echo);

  hatBus = ctx.createGain(); hatBus.gain.value = 0.8;
  hatBus.connect(musBus);

  // l'echo des notes pincees : une croche pointee, qui s'eteint
  echoPince = ctx.createDelay(1.5);
  echoPince.delayTime.value = DOUBLE * 3;
  const retour = ctx.createGain(); retour.gain.value = 0.38;
  const sombre = ctx.createBiquadFilter(); sombre.type = 'lowpass'; sombre.frequency.value = 2600;
  echoPince.connect(sombre); sombre.connect(retour); retour.connect(echoPince);
  sombre.connect(musBus);
  const envoiEcho = ctx.createGain(); envoiEcho.gain.value = 0.35;
  sombre.connect(envoiEcho); envoiEcho.connect(echo);
}

function voix(type, f, t, dur, vol, sortie, attaque = 0.005, detune = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sortie);
  o.start(t); o.stop(t + dur + 0.05);
}

function nappe(accord, t, dur) {
  for (const m of accord.notes) {
    for (const d of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(m); o.detune.value = d + (Math.random() * 4 - 2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.011, t + 0.9);
      g.gain.setValueAtTime(0.011, t + dur - 0.2);
      g.gain.linearRampToValueAtTime(0, t + dur + 1.4);
      o.connect(g); g.connect(nappeBus);
      o.start(t); o.stop(t + dur + 1.5);
    }
  }
}

function grosseCaisse(t, vol) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o.connect(g); g.connect(musBus);
  o.start(t); o.stop(t + 0.5);
  // les nappes s'effacent un instant : c'est ce qui fait respirer le morceau
  nappeDuck.gain.cancelScheduledValues(t);
  nappeDuck.gain.setValueAtTime(0.45, t);
  nappeDuck.gain.linearRampToValueAtTime(1, t + DOUBLE * 3.2);
}

function bruitCourt(t, { freq, q = 1, type = 'highpass', dur, vol, sortie, reverb = 0 }) {
  const src = ctx.createBufferSource(); src.buffer = bruit;
  src.playbackRate.value = 1;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sortie);
  if (reverb) { const r = ctx.createGain(); r.gain.value = reverb; g.connect(r); r.connect(echo); }
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

// une double croche du morceau
function jouer(k, t) {
  const pas = ((k % 16) + 16) % 16;
  const mesure = Math.floor(k / 16);
  const bloc = ((Math.floor(mesure / 8) % 4) + 4) % 4;   // intro, groove, plein, respiration
  const accord = ACCORDS[((Math.floor(mesure / 2) % 4) + 4) % 4];
  const grave = bloc !== 3;

  if (pas === 0 && mesure % 2 === 0) nappe(accord, t, DOUBLE * 32);

  if (grave && pas % 4 === 0) grosseCaisse(t, bloc === 0 ? 0.2 : 0.3);
  if (bloc >= 1 && bloc !== 3 && (pas === 4 || pas === 12))
    bruitCourt(t, { freq: 1500, q: 0.8, type: 'bandpass', dur: 0.16, vol: 0.07, sortie: musBus, reverb: 0.5 });
  if (pas % 4 === 2) bruitCourt(t, { freq: 7200, dur: 0.045, vol: 0.03, sortie: hatBus });
  else if (bloc >= 1 && pas % 2 === 1 && des(mesure, pas) < 0.35)
    bruitCourt(t, { freq: 8000, dur: 0.025, vol: 0.012, sortie: hatBus });

  if (bloc >= 1 && grave && [0, 3, 6, 10, 11].includes(pas)) {
    const m = accord.basse + (pas === 10 ? 12 : 0);
    voix('triangle', hz(m), t, DOUBLE * (pas === 0 ? 3 : 1.8), 0.13, musBus, 0.008);
    voix('sine', hz(m), t, DOUBLE * 2.5, 0.09, musBus, 0.008);
  }

  if ((bloc === 2 || bloc === 3) && pas % 2 === 0 && des(mesure * 3, pas) < (bloc === 3 ? 0.4 : 0.26)) {
    const n = GAMME[Math.floor(des(mesure, pas * 7) * GAMME.length)];
    voix('triangle', hz(n), t, 0.55, 0.045, echoPince, 0.004);
    voix('triangle', hz(n), t, 0.55, 0.03, musBus, 0.004);
  }

  // la page suit le temps
  if (pas % 4 === 0) {
    const temps = pas / 4, d = Math.max(0, (t - ctx.currentTime) * 1000);
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent('jm-temps', { detail: { temps, mesure, bloc } })); } catch (e) {}
    }, d);
  }
}

function planifier() {
  if (!ctx || !actif || !musiqueVoulue || ctx.state !== 'running') { prochain = null; return; }
  const absolu = (performance.timeOrigin + performance.now()) / 1000;
  const e = absolu - ctx.currentTime;
  if (ecart === null || Math.abs(e - ecart) > 0.05) { ecart = e; prochain = null; }
  if (prochain === null) prochain = Math.ceil((absolu + 0.05) / DOUBLE);
  // on prepare 0,4 s d'avance : si la page rame un instant, le morceau ne trebuche pas
  while (prochain * DOUBLE - ecart < ctx.currentTime + 0.4) {
    const t = prochain * DOUBLE - ecart;
    if (t > ctx.currentTime - 0.01) jouer(prochain, t);
    prochain++;
  }
}

function lancerMusique() {
  if (!ctx || !musVol) return;
  if (!minuteur) minuteur = setInterval(planifier, 50);
  const t = ctx.currentTime;
  musVol.gain.cancelScheduledValues(t);
  musVol.gain.setValueAtTime(musVol.gain.value, t);
  musVol.gain.linearRampToValueAtTime(attenue ? 0 : 1, t + 3.5);   // elle arrive, elle ne surgit pas
}
let attenue = false;
// quand une video joue, la musique se met en retrait
export function attenuer(v) {
  attenue = !!v;
  if (!ctx || !musVol || !actif) return;
  const t = ctx.currentTime;
  musVol.gain.cancelScheduledValues(t);
  musVol.gain.setValueAtTime(musVol.gain.value, t);
  musVol.gain.linearRampToValueAtTime(attenue ? 0.0 : 1, t + 0.8);
}
export function musique(v) {
  musiqueVoulue = !!v;
  try { localStorage.setItem('jm-musique', v ? '1' : '0'); } catch (e) {}
  if (v) lancerMusique();
  else if (ctx && musVol) { const t = ctx.currentTime; musVol.gain.cancelScheduledValues(t);
    musVol.gain.setValueAtTime(musVol.gain.value, t); musVol.gain.linearRampToValueAtTime(0, t + 0.8); }
}
try { musiqueVoulue = localStorage.getItem('jm-musique') !== '0'; } catch (e) {}


// ═══════════════════════════════════════════════════════════════════════
// LE MOTEUR DE LA 991
// Un six cylindres a plat : trois explosions par tour, donc une
// fondamentale a regime / 60 x 3. Dent de scie et carre pour le grain,
// une saturation douce pour l'echappement, un filtre qui s'ouvre avec la
// charge. Les pneus crissent avec un bruit filtre tres serre. La voiture
// pilote tout, image par image : regime, charge, crissement, position.
// ═══════════════════════════════════════════════════════════════════════
let mot = null, motPret = false, motCharge = false;
// Le moteur n'est plus fait d'ondes continues : chaque explosion est
// generee echantillon par echantillon, comme dans un vrai moteur.
const PROCESSEUR = `
class Boxer extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'regime', defaultValue: 900, minValue: 300, maxValue: 9500, automationRate: 'k-rate' },
            { name: 'charge', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    this.ph = 0; this.cyl = 0; this.env = 0; this.jit = 1;
    // les six cylindres ne sonnent pas pareil : collecteurs, ordre d'allumage
    this.motif = [1, 0.74, 0.92, 0.7, 0.96, 0.78];
    this.y1 = 0; this.y2 = 0; this.z1 = 0; this.z2 = 0; this.lp = 0;
  }
  process(entrees, sorties, p) {
    const o = sorties[0][0], sr = sampleRate;
    const rpm = p.regime[0], ch = p.charge[0];
    const cadence = rpm / 20;                      // explosions par seconde (six cylindres)
    // le corps de l'echappement : une resonance grave, et une plus aigue
    const f1 = 70 + rpm * 0.012, f2 = 260 + rpm * 0.05;
    const r1 = Math.exp(-Math.PI * f1 / (sr * 2.2)), r2 = Math.exp(-Math.PI * f2 / (sr * 4));
    const a1 = -2 * r1 * Math.cos(2 * Math.PI * f1 / sr), b1 = r1 * r1;
    const a2 = -2 * r2 * Math.cos(2 * Math.PI * f2 / sr), b2 = r2 * r2;
    const decroit = Math.exp(-1 / (sr * (0.0028 + (1 - ch) * 0.0035)));
    for (let i = 0; i < o.length; i++) {
      this.ph += cadence / sr * this.jit;
      if (this.ph >= 1) {
        this.ph -= 1; this.cyl = (this.cyl + 1) % 6;
        // chaque explosion varie un peu : en force et en instant
        this.env = this.motif[this.cyl] * (0.82 + Math.random() * 0.36) * (0.3 + ch * 0.7);
        this.jit = 1 + (Math.random() - 0.5) * (rpm < 1300 ? 0.16 : 0.05);
      }
      const x = (Math.random() * 2 - 1) * this.env;
      this.env *= decroit;
      const y = x - a1 * this.y1 - b1 * this.y2; this.y2 = this.y1; this.y1 = y;
      const z = x - a2 * this.z1 - b2 * this.z2; this.z2 = this.z1; this.z1 = z;
      let s = y * 0.055 + z * 0.028 + x * 0.22;
      this.lp += (s - this.lp) * 0.5;
      o[i] = this.lp;
    }
    return true;
  }
}
registerProcessor('boxer', Boxer);`;

function courbe(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
function creerMoteur() {
  if (motCharge || !ctx || !ctx.audioWorklet) return;
  motCharge = true;
  const url = URL.createObjectURL(new Blob([PROCESSEUR], { type: 'application/javascript' }));
  ctx.audioWorklet.addModule(url).then(() => {
    const m = {};
    m.boxer = new AudioWorkletNode(ctx, 'boxer', { numberOfOutputs: 1, outputChannelCount: [1] });
    m.sortie = ctx.createGain(); m.sortie.gain.value = 0;
    m.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    m.sortie.connect(m.pan); m.pan.connect(sec);
    const envoi = ctx.createGain(); envoi.gain.value = 0.3; m.pan.connect(envoi); envoi.connect(versEcho);

    // la ligne d'echappement : les formants du tube, une saturation douce,
    // un filtre qui s'ouvre avec le regime et la charge
    const bas = ctx.createBiquadFilter(); bas.type = 'highpass'; bas.frequency.value = 32;
    const f1 = ctx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 160; f1.Q.value = 1.1; f1.gain.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 520; f2.Q.value = 1.4; f2.gain.value = 4;
    const f3 = ctx.createBiquadFilter(); f3.type = 'peaking'; f3.frequency.value = 1700; f3.Q.value = 2; f3.gain.value = 3;
    m.sature = ctx.createWaveShaper(); m.sature.curve = courbe(1.8); m.sature.oversample = '2x';
    m.filtre = ctx.createBiquadFilter(); m.filtre.type = 'lowpass'; m.filtre.Q.value = 0.5; m.filtre.frequency.value = 1200;
    m.gainEntree = ctx.createGain(); m.gainEntree.gain.value = 2.2;
    m.boxer.connect(bas); bas.connect(f1); f1.connect(f2); f2.connect(f3); f3.connect(m.gainEntree);
    m.gainEntree.connect(m.sature); m.sature.connect(m.filtre); m.filtre.connect(m.sortie);

    // l'admission : un souffle qui monte avec l'accelerateur
    m.air = ctx.createBufferSource(); m.air.buffer = bruit; m.air.loop = true;
    m.airF = ctx.createBiquadFilter(); m.airF.type = 'bandpass'; m.airF.Q.value = 0.9; m.airF.frequency.value = 900;
    m.airG = ctx.createGain(); m.airG.gain.value = 0;
    m.air.connect(m.airF); m.airF.connect(m.airG); m.airG.connect(m.sortie);

    // les pneus
    m.cri = ctx.createBufferSource(); m.cri.buffer = bruit; m.cri.loop = true;
    m.criF = ctx.createBiquadFilter(); m.criF.type = 'bandpass'; m.criF.frequency.value = 2300; m.criF.Q.value = 9;
    m.criF2 = ctx.createBiquadFilter(); m.criF2.type = 'bandpass'; m.criF2.frequency.value = 3400; m.criF2.Q.value = 12;
    m.criG = ctx.createGain(); m.criG.gain.value = 0;
    m.cri.connect(m.criF); m.cri.connect(m.criF2); m.criF.connect(m.criG); m.criF2.connect(m.criG); m.criG.connect(m.pan);
    const criLfo = ctx.createOscillator(); criLfo.frequency.value = 5.5;
    const criLfoG = ctx.createGain(); criLfoG.gain.value = 260;
    criLfo.connect(criLfoG); criLfoG.connect(m.criF.frequency);
    [m.air, m.cri, criLfo].forEach(o => o.start());
    mot = m; motPret = true;
  }).catch(() => {});
}
// une petarade a la decelere : un claquement sourd dans l'echappement
function petarade(pan) {
  if (!ctx || !actif) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = bruit;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
  const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 1400 + Math.random() * 900; bp.gain.value = 8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045 + Math.random() * 0.03);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if (p.pan) p.pan.value = pan || 0;
  src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(p); p.connect(sec);
  const r = ctx.createGain(); r.gain.value = 0.9; p.connect(r); r.connect(echo);
  src.start(t, Math.random() * 1.5); src.stop(t + 0.1);
  ton({ f0: 75, f1: 42, dur: 0.06, vol: 0.09 });
}
// appele a chaque image par la voiture
export function moteur({ regime = 900, charge = 0.3, crisse = 0, pan = 0, volume = 1, pop = false } = {}) {
  if (!ctx || !actif) return;
  creerMoteur();
  if (!motPret) return;
  const t = ctx.currentTime;
  mot.boxer.parameters.get('regime').setTargetAtTime(regime, t, 0.025);
  mot.boxer.parameters.get('charge').setTargetAtTime(charge, t, 0.05);
  mot.filtre.frequency.setTargetAtTime(700 + regime * (0.35 + charge * 0.6), t, 0.05);
  mot.airF.frequency.setTargetAtTime(500 + regime * 0.25, t, 0.06);
  mot.airG.gain.setTargetAtTime(charge * charge * 0.05 * (regime / 7000), t, 0.06);
  mot.sortie.gain.setTargetAtTime(0.32 * volume, t, 0.03);
  mot.criG.gain.setTargetAtTime(crisse * 0.09 * volume, t, crisse > 0 ? 0.015 : 0.09);
  if (mot.pan.pan) mot.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05);
  if (pop) petarade(pan);
}
export function moteurCoupe() {
  if (!mot || !ctx) return;
  const t = ctx.currentTime;
  mot.sortie.gain.setTargetAtTime(0, t, 0.25);
  mot.criG.gain.setTargetAtTime(0, t, 0.1);
}

// ── le deplacement pilote le souffle : 0 a l'arret, 1 a pleine vitesse ──
export function flux(v) { vitesse = Math.max(0, Math.min(1.4, v || 0)); }

export function allumer() {
  creer();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume();
  actif = true;
  maitre.gain.cancelScheduledValues(ctx.currentTime);
  maitre.gain.setValueAtTime(maitre.gain.value, ctx.currentTime);
  maitre.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 1.1);
  if (musiqueVoulue) lancerMusique();
  // le moteur de la 991 se prepare des maintenant : quand la voiture
  // arrive, il doit demarrer a la meme image, pas une demi-seconde apres
  creerMoteur();
  return true;
}

export function eteindre() {
  if (!ctx) { actif = false; return; }
  maitre.gain.cancelScheduledValues(ctx.currentTime);
  maitre.gain.setValueAtTime(maitre.gain.value, ctx.currentTime);
  maitre.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  setTimeout(() => { actif = false; }, 520);
}

export function estActif() { return actif; }

// on se tait quand l'onglet part au second plan
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else if (actif) ctx.resume();
});
