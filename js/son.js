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

  versEcho = ctx.createGain(); versEcho.gain.value = 0.42;
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
  airGain = ctx.createGain(); airGain.gain.value = 0.05;
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
  subGain = ctx.createGain(); subGain.gain.value = 0.045;
  const subLfo = ctx.createOscillator(); subLfo.frequency.value = 0.031;
  const subLfoG = ctx.createGain(); subLfoG.gain.value = 3.2;
  subLfo.connect(subLfoG); subLfoG.connect(sub.frequency); subLfo.start();
  sub.connect(subGain); subGain.connect(sec);
  sub.start();

  boucle();
}

// ── le souffle suit le deplacement : c'est ca, une soufflerie ──
function boucle() {
  if (!ctx) return;
  vitesseLisse += (vitesse - vitesseLisse) * 0.08;
  if (actif && airGain) {
    const v = Math.min(1, vitesseLisse);
    const t = ctx.currentTime;
    airGain.gain.setTargetAtTime(0.045 + v * 0.3, t, 0.12);
    airFiltre.frequency.setTargetAtTime(300 + v * 1250, t, 0.14);
    airFiltre.Q.setTargetAtTime(0.42 + v * 0.5, t, 0.2);
    subGain.gain.setTargetAtTime(0.04 + v * 0.05, t, 0.3);
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
            ton({ f0: 72, f1: 132, dur: 0.6, vol: 0.05, forme: 'sawtooth' }); },

  // mise sous tension : les machines montent en regime
  tension() {
    ton({ f0: 28, f1: 82, dur: 2.1, vol: 0.1, forme: 'sawtooth' });
    souffle({ freq: 130, q: 0.5, dur: 1.9, vol: 0.07, glisse: 7 });
    [0, 0.42, 0.84].forEach((r, i) =>
      ton({ f0: 196 * (i + 1), f1: 196 * (i + 1), dur: 0.8, vol: 0.028, forme: 'triangle', retard: 0.5 + r }));
  },

  // fermeture : un relais qui retombe
  clic() { souffle({ freq: 1500, q: 1.8, dur: 0.04, vol: 0.045 });
           ton({ f0: 120, f1: 88, dur: 0.1, vol: 0.03 }); },

  // on passe devant une piece : elle a une presence, tres faible
  frole() { ton({ f0: 294, f1: 294, dur: 0.9, vol: 0.012, forme: 'triangle' }); }
};

// ── le deplacement pilote le souffle : 0 a l'arret, 1 a pleine vitesse ──
export function flux(v) { vitesse = Math.max(0, Math.min(1.4, v || 0)); }

export function allumer() {
  creer();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume();
  actif = true;
  maitre.gain.cancelScheduledValues(ctx.currentTime);
  maitre.gain.setValueAtTime(maitre.gain.value, ctx.currentTime);
  maitre.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.1);
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
