// ═══════════════════════════════════════════════════════════════════════
// LE SON DE LA SOUFFLERIE
//
// Rien n'est chargé : tout est synthétisé. Pas un fichier, pas un octet,
// et surtout pas une nappe d'ambiance générique prise sur une banque.
// Un souffle d'air filtré, des déclics d'instrument, un balayage pour les
// passages. Coupé par défaut — on n'embusque personne avec du son.
// ═══════════════════════════════════════════════════════════════════════

let ctx = null, bed = null, bedGain = null, maitre = null, bruit = null;
let actif = false;

function creer() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  maitre = ctx.createGain();
  maitre.gain.value = 0;
  maitre.connect(ctx.destination);

  // deux secondes de bruit, bouclées : la matière première de tout le reste
  const n = ctx.sampleRate * 2;
  bruit = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

  // ── le lit : l'air qui circule dans la veine ──
  bed = ctx.createBufferSource();
  bed.buffer = bruit; bed.loop = true;

  const passeBande = ctx.createBiquadFilter();
  passeBande.type = 'bandpass';
  passeBande.frequency.value = 380;
  passeBande.Q.value = 0.55;

  const passeBas = ctx.createBiquadFilter();
  passeBas.type = 'lowpass';
  passeBas.frequency.value = 1100;

  bedGain = ctx.createGain();
  bedGain.gain.value = 0.055;

  bed.connect(passeBande); passeBande.connect(passeBas);
  passeBas.connect(bedGain); bedGain.connect(maitre);

  // le souffle n'est jamais constant : il respire
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 130;
  lfo.connect(lfoG); lfoG.connect(passeBande.frequency);
  lfo.start();

  bed.start();
}

function burst({ freq = 1800, q = 1, dur = 0.06, vol = 0.1, type = 'bandpass', glisse = 0 }) {
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

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(f); f.connect(g); g.connect(maitre);
  src.start(t); src.stop(t + dur + 0.02);
}

function ton({ f0 = 90, f1 = 90, dur = 0.18, vol = 0.07, forme = 'sine' }) {
  if (!ctx || !actif) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = forme;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(maitre);
  o.start(t); o.stop(t + dur + 0.02);
}

// ── le vocabulaire ──
export const son = {
  // le doigt passe sur une pièce : un déclic d'instrument
  tic()    { burst({ freq: 2600, q: 2.2, dur: 0.035, vol: 0.055 }); },
  // on ouvre : la mécanique s'enclenche
  clac()   { ton({ f0: 150, f1: 62, dur: 0.14, vol: 0.075 });
             burst({ freq: 900, q: 1.1, dur: 0.07, vol: 0.07, glisse: 0.35 }); },
  // on change de zone : l'air balaie
  balai()  { burst({ freq: 260, q: 0.5, dur: 0.52, vol: 0.1, glisse: 9 }); },
  // mise sous tension
  tension(){ ton({ f0: 36, f1: 96, dur: 1.5, vol: 0.09, forme: 'sawtooth' });
             burst({ freq: 180, q: 0.6, dur: 1.2, vol: 0.05, glisse: 5 }); },
  // fermeture
  clic()   { burst({ freq: 1400, q: 1.6, dur: 0.045, vol: 0.05 }); }
};

export function allumer() {
  creer();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume();
  actif = true;
  maitre.gain.cancelScheduledValues(ctx.currentTime);
  maitre.gain.setValueAtTime(maitre.gain.value, ctx.currentTime);
  maitre.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.9);
  return true;
}

export function eteindre() {
  if (!ctx) { actif = false; return; }
  maitre.gain.cancelScheduledValues(ctx.currentTime);
  maitre.gain.setValueAtTime(maitre.gain.value, ctx.currentTime);
  maitre.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  setTimeout(() => { actif = false; }, 420);
}

export function estActif() { return actif; }

// on se tait quand l'onglet part au second plan
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else if (actif) ctx.resume();
});
