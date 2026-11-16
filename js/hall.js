// ═══════════════════════════════════════════════════════════════════════
// LES SCENES — le fond du site est un nuage de lumiere qui se recompose.
//
// Chaque section a sa scene : on traverse un tunnel de lumiere sur le
// hero, il se replie en sphere pour « A propos », s'etale en onde pour les
// projets, tourne en galaxie pour le parcours, et se resserre en braise
// rouge au contact. C'est le defilement qui fait passer d'une scene a
// l'autre et qui deplace la camera : on ne regarde pas un decor, on avance.
//
// WebGL brut, des points en melange additif : pas de bibliotheque.
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var cv = document.getElementById('hall');
  if (!cv) return;

  var gl = null;
  try {
    var o = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' };
    gl = cv.getContext('webgl', o) || cv.getContext('experimental-webgl', o);
  } catch (e) { gl = null; }
  if (!gl) { cv.parentNode.removeChild(cv); return; }

  var tactile = !matchMedia('(hover:hover) and (pointer:fine)').matches;
  var sobre = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var N = tactile ? 5200 : 11000;
  var NS = 5;                                   // nombre de scenes

  // ── les formations ─────────────────────────────────────────────────
  function rnd(i, k) { var x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }
  var P = [], i;
  for (var s = 0; s < NS; s++) P.push(new Float32Array(N * 3));
  var R = new Float32Array(N);

  for (i = 0; i < N; i++) {
    var r1 = rnd(i, 1), r2 = rnd(i, 2), r3 = rnd(i, 3), r4 = rnd(i, 4);
    R[i] = r1;
    var a, rr, b;

    // 0 · le tunnel : des anneaux de lumiere qu'on traverse
    var ring = Math.floor(r2 * 24);
    a = r3 * Math.PI * 2;
    rr = 2.4 + (r4 - 0.5) * 0.12;
    P[0][i * 3] = Math.cos(a) * rr;
    P[0][i * 3 + 1] = Math.sin(a) * rr;
    P[0][i * 3 + 2] = 6 - ring * 2.6 - r1 * 0.06;

    // 1 · la sphere : une coque, legerement vivante
    var u = r2 * 2 - 1, th = r3 * Math.PI * 2, sq = Math.sqrt(1 - u * u);
    rr = 3.0 + (r4 - 0.5) * 0.10 + (r1 < 0.12 ? (r1 - 0.06) * 6 : 0);
    P[1][i * 3] = sq * Math.cos(th) * rr;
    P[1][i * 3 + 1] = u * rr;
    P[1][i * 3 + 2] = sq * Math.sin(th) * rr - 6.5;

    // 2 · l'onde : un champ de points qui ondule sous la galerie
    var gx = (r2 - 0.5) * 30, gz = -r3 * 34 + 4;
    P[2][i * 3] = gx;
    P[2][i * 3 + 1] = -1.7 + Math.sin(gx * 0.45) * 0.7 + Math.cos(gz * 0.38) * 0.7;
    P[2][i * 3 + 2] = gz;

    // 3 · la galaxie : quatre bras en spirale, inclines
    var bras = Math.floor(r2 * 4), d = Math.pow(r3, 0.7) * 9;
    a = bras * Math.PI / 2 + d * 0.62 + (r4 - 0.5) * 0.55;
    var gy = (r1 - 0.5) * 0.5 * (1.2 - d / 9);
    var px = Math.cos(a) * d, pz = Math.sin(a) * d;
    P[3][i * 3] = px;
    P[3][i * 3 + 1] = gy + pz * 0.38;
    P[3][i * 3 + 2] = pz * 0.92 - 6;

    // 4 · la braise : un noyau rouge et ses etincelles
    u = r2 * 2 - 1; th = r3 * Math.PI * 2; sq = Math.sqrt(1 - u * u);
    rr = r1 < 0.8 ? 1.25 * Math.cbrt(r4) : 1.6 + r4 * 4.5;
    P[4][i * 3] = sq * Math.cos(th) * rr;
    P[4][i * 3 + 1] = u * rr * 0.9;
    P[4][i * 3 + 2] = sq * Math.sin(th) * rr - 1;
  }

  // ── shaders ────────────────────────────────────────────────────────
  var VS = [
    'precision highp float;',
    'attribute vec3 p0,p1,p2,p3,p4;attribute float r;',
    'uniform mat4 M;uniform float S;uniform float T;uniform float V;uniform float Fl;',
    'uniform float Px;uniform float Dpr;',
    'varying vec3 c;varying float al;',
    'vec3 pick(float k){',
    '  if(k<0.5)return p0;if(k<1.5)return p1;if(k<2.5)return p2;if(k<3.5)return p3;return p4;}',
    'vec3 teinte(float k,float r){',
    '  vec3 a,b;',
    '  if(k<0.5){a=vec3(1.0,0.22,0.12);b=vec3(1.0,0.86,0.80);}',        // tunnel : rouge et blanc
    '  else if(k<1.5){a=vec3(0.30,0.50,0.85);b=vec3(0.62,0.66,0.75);}',  // sphere : chrome froid
    '  else if(k<2.5){a=vec3(0.20,0.85,1.0);b=vec3(0.75,0.50,1.0);}',  // onde : cyan, violet
    '  else if(k<3.5){a=vec3(0.65,0.40,1.0);b=vec3(1.0,0.55,0.75);}',  // galaxie
    '  else{a=vec3(1.0,0.20,0.08);b=vec3(1.0,0.62,0.25);}',            // braise
    '  return mix(a,b,step(0.62,r));}',
    'void main(){',
    '  float a=floor(S),b=min(a+1.0,4.0);',
    '  float f=clamp((fract(S)-r*0.28)/0.72,0.0,1.0);',                  // chaque point part a son heure
    '  f=f*f*(3.0-2.0*f);',
    '  vec3 A=pick(a),B=pick(b);',
    // le tunnel defile vers nous : plus on scrolle vite, plus ca file
    '  if(a<0.5){A.z=mod(A.z+T*1.6+V*8.0+56.4,62.4)-56.4;}',
    // la sphere respire, la galaxie et l onde tournent / ondulent
    '  float w=sin(T*0.6+r*40.0)*0.04;',
    '  A+=normalize(A+vec3(0.001))*w;B+=normalize(B+vec3(0.001))*w;',
    '  if(a>2.5&&a<3.5){float ca=cos(T*0.05),sa=sin(T*0.05);A.xz=mat2(ca,-sa,sa,ca)*(A.xz+vec2(0.,6.))-vec2(0.,6.);}',
    '  if(a>1.5&&a<2.5){A.y+=sin(A.x*0.5+T*0.9)*0.25;}',
    // pendant la transition les points s ecartent : une explosion maitrisee
    '  vec3 p=mix(A,B,f)+vec3(sin(r*91.0),cos(r*57.0),sin(r*23.0))*sin(f*3.14159)*1.6;',
    '  vec4 q=M*vec4(p,1.0);',
    '  gl_Position=q;',
    '  float z=max(q.w,0.05);',
    '  gl_PointSize=clamp((3.0+r*4.5)*Px*Dpr/z,1.5,56.0*Dpr);',
    '  c=mix(teinte(a,r),teinte(b,r),f);',
    '  al=(0.70+0.30*sin(T*2.0+r*60.0))*smoothstep(55.0,4.0,z)*smoothstep(0.3,1.6,z)*(1.0+Fl*1.4);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec3 c;varying float al;uniform float G;',
    'void main(){',
    '  vec2 d=gl_PointCoord-0.5;float k=dot(d,d);',
    '  if(k>0.25)discard;',
    '  float g=exp(-k*18.0);',
    '  gl_FragColor=vec4(c*g*al*G,1.0);',
    '}'
  ].join('\n');

  function sh(t, src) {
    var x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x);
    if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn('hall', gl.getShaderInfoLog(x)); return null; }
    return x;
  }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  var prog = gl.createProgram();
  if (vs && fs) { gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); }
  if (!vs || !fs || !gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.parentNode.removeChild(cv); return; }
  gl.useProgram(prog);

  function attr(nom, data, n) {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    var l = gl.getAttribLocation(prog, nom); if (l < 0) return;
    gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0);
  }
  for (s = 0; s < NS; s++) attr('p' + s, P[s], 3);
  attr('r', R, 1);

  var U = {};
  ['M', 'S', 'T', 'V', 'Fl', 'Px', 'Dpr', 'G'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);                    // la lumiere s additionne
  gl.clearColor(0.016, 0.020, 0.032, 1);

  // ── matrices ───────────────────────────────────────────────────────
  function persp(fov, asp, n, f) {
    var t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
  }
  function regard(e, c) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz);
    zx /= l; zy /= l; zz /= l;
    var xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;   // haut = y
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }

  // ── ou commence chaque scene dans la page ──────────────────────────
  var ancres = [0, 1, 2, 3, 4];
  function haut(el) { var y = 0; for (var e = el; e; e = e.offsetParent) y += e.offsetTop; return y; }
  function mesurer() {
    var vh = innerHeight, sc = document.getElementById('scene');
    var total = Math.max(1, (sc ? sc.offsetHeight : document.documentElement.scrollHeight) - vh);
    var cibles = ['#about-intro', '#portfolio', '#xp', '#contact'];
    ancres = [0];
    cibles.forEach(function (q) {
      var el = document.querySelector(q);
      var y = el ? Math.min(total, Math.max(0, haut(el) - vh * 0.55)) : total;
      ancres.push(Math.max(y, ancres[ancres.length - 1] + 1));
    });
  }
  function scenePour(y) {
    for (var k = 0; k < ancres.length - 1; k++) {
      if (y < ancres[k + 1]) return k + (y - ancres[k]) / (ancres[k + 1] - ancres[k]);
    }
    return ancres.length - 1;
  }

  var dpr = 1, asp = 1;
  function tailler() {
    dpr = Math.min(devicePixelRatio || 1, tactile ? 1.5 : 1.75);
    var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h); asp = w / h;
    gl.uniform1f(U.Dpr, dpr);
    gl.uniform1f(U.Px, h / 900 * 9);
    gl.uniform1f(U.G, asp < 0.8 ? 0.80 : 1.0);
  }

  // ── etat ───────────────────────────────────────────────────────────
  var sc = 0, scC = 0, vit = 0, t0 = performance.now(), tp = t0;
  var mx = 0, my = 0, mxC = 0, myC = 0, flash = 0, derniere = 0, vivant = true, raf = null;
  var fantome = document.querySelector('.hero-ghost');

  function cible() { scC = scenePour(pageYOffset || 0); }

  function image(t) {
    raf = null; if (!vivant) return;
    var dt = Math.min(64, t - tp); tp = t;
    var av = sc;
    sc += (scC - sc) * (1 - Math.exp(-dt / 140));
    if (Math.abs(scC - sc) < 1e-4) sc = scC;
    var v = Math.abs(sc - av) / (dt / 1000);
    vit += (v - vit) * (1 - Math.exp(-dt / 160));
    var k = 1 - Math.exp(-dt / 300); mx += (mxC - mx) * k; my += (myC - my) * k;

    // on change de scene : le flash et le son
    var idx = Math.round(sc);
    if (idx !== derniere) {
      flash = 1; derniere = idx;
      try { document.dispatchEvent(new CustomEvent('hall:porte', { detail: { nature: 1 } })); } catch (e) {}
    }
    flash *= Math.exp(-dt / 260);

    // la camera : elle avance dans le tunnel, puis tourne autour de chaque scene
    var fr = sc - Math.floor(sc), ang = sc * 0.9 + mx * 0.25;
    var dist = 9 - Math.sin(fr * Math.PI) * 2.2;
    var eye = [Math.sin(ang) * dist * 0.35 + mx * 0.8, 0.6 + my * 0.6 + Math.sin(sc * 1.3) * 1.2, Math.cos(ang * 0.35) * dist];
    if (sc < 1) { eye = [mx * 0.5, my * 0.4, 7.5 - sc * 3]; }
    var M = mul(persp(asp < 0.8 ? 1.15 : 0.95, asp, 0.1, 80), regard(eye, [0, 0, -2]));

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(U.M, false, new Float32Array(M));
    gl.uniform1f(U.S, Math.min(sc, NS - 1 - 1e-4));
    gl.uniform1f(U.T, (t - t0) / 1000);
    gl.uniform1f(U.V, Math.min(3, vit));
    gl.uniform1f(U.Fl, flash);
    gl.drawArrays(gl.POINTS, 0, N);

    if (fantome) {
      var y = pageYOffset || 0;
      if (y < innerHeight * 1.3) fantome.style.transform = 'translate(-50%,calc(-50% + ' + (y * 0.34).toFixed(1) + 'px))';
    }
    if (window.__hallFlux) window.__hallFlux(Math.min(1.2, vit * 0.9));

    raf = requestAnimationFrame(image);           // la scene respire en permanence
  }
  function lancer() { if (!raf && vivant) { tp = performance.now(); raf = requestAnimationFrame(image); } }

  mesurer(); tailler(); cible(); sc = scC; derniere = Math.round(sc);

  if (sobre) {
    gl.uniform1f(U.T, 0); image(performance.now()); cancelAnimationFrame(raf); raf = null; vivant = false;
  } else {
    addEventListener('scroll', cible, { passive: true });
    if (!tactile) addEventListener('pointermove', function (e) {
      mxC = e.clientX / innerWidth * 2 - 1; myC = -(e.clientY / innerHeight * 2 - 1);
    }, { passive: true });
    var deb;
    addEventListener('resize', function () { clearTimeout(deb); deb = setTimeout(function () { mesurer(); tailler(); cible(); }, 120); }, { passive: true });
    addEventListener('load', function () { mesurer(); cible(); });
    var scn = document.getElementById('scene');
    if (window.ResizeObserver && scn) new ResizeObserver(function () { mesurer(); cible(); }).observe(scn);
    document.addEventListener('visibilitychange', function () {
      vivant = !document.hidden; if (vivant) lancer(); else if (raf) { cancelAnimationFrame(raf); raf = null; }
    });
    lancer();
  }
  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); vivant = false; cv.style.display = 'none'; });

  document.body.classList.add('hall-on');
  window.__hall = { mesurer: function () { mesurer(); cible(); } };
})();
