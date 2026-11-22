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

// ── le vocabulaire ──
export const son = {
  // le regard se pose sur une piece : un relais d'instrument
  tic() { souffle({ freq: 3100, q: 3, dur: 0.028, vol: 0.05 });
          ton({ f0: 1760, f1: 1760, dur: 0.05, vol: 0.016, forme: 'triangle' }); },

  // on ouvre : la mecanique s'enclenche, le hall repond
  clac() { ton({ f0: 168, f1: 58, dur: 0.17, vol: 0.09 });
           souffle({ freq: 1100, q: 1.2, dur: 0.09, vol: 0.08, glisse: 0.3 });
           ton({ f0: 392, f1: 392, dur: 0.5, vol: 0.022, forme: 'triangle', retard: 0.04 }); },

  // on change de zone : l'air balaie la veine
  balai() { souffle({ freq: 220, q: 0.45, dur: 0.75, vol: 0.12, glisse: 11 });
            ton({ f0: 72, f1: 132, dur: 0.6, vol: 0.05, forme: 'triangle' }); },

  // mise sous tension : les machines montent en regime
  tension() {
    ton({ f0: 28, f1: 82, dur: 2.1, vol: 0.1, forme: 'triangle' });
    souffle({ freq: 130, q: 0.5, dur: 1.9, vol: 0.07, glisse: 7 });
    [0, 0.42, 0.84].forEach((r, i) =>
      ton({ f0: 196 * (i + 1), f1: 196 * (i + 1), dur: 0.8, vol: 0.028, forme: 'triangle', retard: 0.5 + r }));
  },

  // fermeture : un relais qui retombe
  clic() { souffle({ freq: 1500, q: 1.8, dur: 0.04, vol: 0.045 });
           ton({ f0: 120, f1: 88, dur: 0.1, vol: 0.03 }); },

  // ── l'histoire ──
  // declencheur d'appareil photo : miroir qui monte, rideau, miroir qui retombe
  obturateur() { souffle({ freq: 4200, q: 2.5, dur: 0.025, vol: 0.12 });
                 ton({ f0: 900, f1: 300, dur: 0.05, vol: 0.05, forme: 'triangle' });
                 setTimeout(() => { souffle({ freq: 2600, q: 2, dur: 0.035, vol: 0.1 }); ton({ f0: 220, f1: 90, dur: 0.07, vol: 0.06 }); }, 70);
                 ton({ f0: 2400, f1: 5200, dur: 0.6, vol: 0.008, forme: 'sine', retard: 0.12 }); },
  // une punaise s'enfonce dans le liege
  punaise() { ton({ f0: 140, f1: 60, dur: 0.09, vol: 0.09 }); souffle({ freq: 900, q: 1, dur: 0.03, vol: 0.06 }); },
  // une feuille de calendrier tourne
  feuille() { souffle({ freq: 3600, q: 1.2, dur: 0.035, vol: 0.035, type: 'highpass' }); },
  // on arrache la page
  arrache() { souffle({ freq: 2200, q: 0.6, dur: 0.38, vol: 0.12, glisse: 0.35 }); souffle({ freq: 5000, q: 1, dur: 0.2, vol: 0.05, type: 'highpass' }); },
  // un tampon s'ecrase
  tampon() { ton({ f0: 110, f1: 45, dur: 0.16, vol: 0.13 }); souffle({ freq: 600, q: 0.8, dur: 0.06, vol: 0.09 }); },
  // le pinceau du colleur d'affiches
  colle() { souffle({ freq: 900, q: 0.7, dur: 0.42, vol: 0.07, glisse: 2.2 }); },
  // les projecteurs s'allument et gresillent
  lampe() { ton({ f0: 100, f1: 100, dur: 0.5, vol: 0.02, forme: 'triangle' }); souffle({ freq: 3000, q: 4, dur: 0.05, vol: 0.05 }); },
  // la 991 arrive : flat-six qui retombe, puis les pneus
  arrivee() { ton({ f0: 210, f1: 70, dur: 1.4, vol: 0.06, forme: 'triangle' });
              ton({ f0: 105, f1: 38, dur: 1.5, vol: 0.07, forme: 'triangle' });
              souffle({ freq: 2600, q: 6, dur: 0.9, vol: 0.05, glisse: 0.7 }); },
  // elle repart : patinage puis montee en regime
  depart() { souffle({ freq: 2400, q: 5, dur: 0.5, vol: 0.07 });
             ton({ f0: 60, f1: 260, dur: 1.3, vol: 0.07, forme: 'triangle', retard: 0.35 });
             ton({ f0: 120, f1: 520, dur: 1.2, vol: 0.03, forme: 'triangle', retard: 0.4 }); },
  // une touche de machine a ecrire
  touche() { souffle({ freq: 2000 + Math.random() * 800, q: 3, dur: 0.02, vol: 0.05 }); ton({ f0: 300, f1: 160, dur: 0.03, vol: 0.02 }); },
  // on change de chapitre : un souffle court
  page() { souffle({ freq: 500, q: 0.6, dur: 0.35, vol: 0.06, glisse: 4 }); },

  // le klaxon de la 991, deux notes
  klaxon() { ton({ f0: 392, f1: 392, dur: 0.16, vol: 0.06, forme: 'triangle' }); ton({ f0: 494, f1: 494, dur: 0.16, vol: 0.05, forme: 'triangle' });
             ton({ f0: 392, f1: 392, dur: 0.22, vol: 0.06, forme: 'triangle', retard: 0.22 }); ton({ f0: 494, f1: 494, dur: 0.22, vol: 0.05, forme: 'triangle', retard: 0.22 }); },
  // appel de phares : deux relais
  phares() { [0, 0.18].forEach(r => ton({ f0: 1400, f1: 1400, dur: 0.03, vol: 0.03, forme: 'triangle', retard: r })); },
  // l'avion en papier
  avion() { souffle({ freq: 700, q: 0.8, dur: 1.1, vol: 0.06, glisse: 5 }); },
  // le rideau de la page projet
  rideau() { souffle({ freq: 260, q: 0.5, dur: 1.0, vol: 0.09, glisse: 6 }); ton({ f0: 60, f1: 120, dur: 0.9, vol: 0.04, forme: 'triangle' }); },
  // la traversee des anneaux de l'ouverture
  tunnel() { souffle({ freq: 150, q: 0.4, dur: 1.6, vol: 0.12, glisse: 14 }); ton({ f0: 40, f1: 160, dur: 1.4, vol: 0.06, forme: 'triangle' }); },
  // une lettre qui tombe en place
  lettre() { ton({ f0: 180 + Math.random() * 60, f1: 70, dur: 0.08, vol: 0.05 }); },
  // un post-it qui se decroche
  chute() { souffle({ freq: 1800, q: 0.7, dur: 0.3, vol: 0.06, glisse: 0.4 }); ton({ f0: 600, f1: 200, dur: 0.3, vol: 0.02, forme: 'triangle' }); },
  // une piece de l'arc passe au centre
  cran() { souffle({ freq: 2600, q: 4, dur: 0.02, vol: 0.03 }); },

  // on passe devant une piece : elle a une presence, tres faible
  frole() { ton({ f0: 294, f1: 294, dur: 0.9, vol: 0.012, forme: 'triangle' }); }
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
