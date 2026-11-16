// ═══════════════════════════════════════════════════════════════════════
// LE HALL — le fond du site est la soufflerie elle-meme.
//
// Ce n'est pas un decor pose derriere les pages : faire defiler le site,
// c'est avancer dans la veine d'essai. Les luminaires passent au plafond,
// chaque section commence par un portique qu'on franchit, et le contact
// se trouve au fond du hall, sur la braise rouge — comme dans le monde 3D.
//
// Un seul quad plein ecran et un shader : pas de bibliotheque, quelques Ko.
// Le couloir est calcule analytiquement (quatre plans et un mur), donc ca
// tient sur un telephone. Rien ne tourne quand rien ne bouge.
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var cv = document.getElementById('hall');
  if (!cv) return;

  var gl = null;
  try {
    var opts = { alpha: false, antialias: false, depth: false, stencil: false,
                 powerPreference: 'low-power', preserveDrawingBuffer: false };
    gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
  } catch (e) { gl = null; }
  if (!gl) { cv.parentNode.removeChild(cv); return; }

  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uR;',      // resolution
    'uniform vec2 uP;',      // pointeur lisse, -1..1
    'uniform float uZm;',    // avance, modulo le pas des luminaires
    'uniform float uV;',     // vitesse lissee 0..1
    'uniform float uEnd;',   // distance au mur du fond
    'uniform float uW;',     // demi-largeur du hall
    'uniform float uGain;',
    'uniform float uFlash;', // on franchit un portique
    'uniform float uOn;',    // mise sous tension : 0 eteint, 1 tout le hall
    'uniform vec3 uG[8];',   // portiques : x = distance devant, y = nature',

    'const float H=3.7;',     // plafond
    'const float EYE=1.6;',
    'const float P=7.0;',     // pas des luminaires
    'const float J=3.5;',     // pas des joints
    'const vec3 FOG=vec3(0.020,0.027,0.040);',
    'const vec3 ROUGE=vec3(0.95,0.20,0.12);',
    'const vec3 CHROME=vec3(0.62,0.70,0.80);',
    'const vec3 FROID=vec3(0.80,0.88,1.0);',

    'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
    // un troncon s allume quand on s en approche
    'float allume(float d){return smoothstep(37.0,29.0,d)*smoothstep(uOn*47.0,uOn*47.0-1.5,d);}',

    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy-0.5*uR)/uR.y;',
    '  float F=1.04-0.09*uV;',                      // le champ s ouvre avec la vitesse
    '  vec3 ro=vec3(uP.x*0.42,EYE+uP.y*0.10,0.0);', // le regard suit le pointeur
    '  vec3 rd=normalize(vec3(uv.x+uP.x*0.035,uv.y+0.02+uP.y*0.02,F));',

    '  float t=1.0e5;float id=0.0;float a;',
    '  if(rd.y<-1.0e-4){a=-ro.y/rd.y;if(a<t){t=a;id=1.0;}}',
    '  if(rd.y>1.0e-4){a=(H-ro.y)/rd.y;if(a<t){t=a;id=2.0;}}',
    '  if(abs(rd.x)>1.0e-4){a=((rd.x>0.0?uW:-uW)-ro.x)/rd.x;if(a>0.0&&a<t){t=a;id=3.0;}}',
    '  a=uEnd/rd.z;if(a>0.0&&a<t){t=a;id=4.0;}',

    '  vec3 q=ro+rd*t;',                            // point touche, relatif a l oeil
    '  float zl=uZm+q.z;',                          // z dans le repere du hall
    '  float px=t/(F*uR.y);',                       // taille d un pixel la-bas
    '  float gy=px/max(abs(rd.y),0.03);',           // ... etiree par la rasance
    '  float gx=px/max(abs(rd.x),0.03);',

    // ── la lumiere ──
    '  float seg=floor(zl/P);',
    '  float dseg=(seg+0.5)*P-uZm;',
    '  float on=allume(dseg);',
    '  float dr=length(vec2(q.x,H-q.y));',
    '  float L=on*1.5/(1.0+0.50*dr*dr);',           // la rampe centrale
    '  for(int k=-1;k<=1;k++){',
    '    float zc=(seg+float(k)+0.5)*P-uZm;',
    '    float o=allume(zc);',
    '    vec3 d1=vec3(0.56*uW,H,zc)-q;vec3 d2=vec3(-0.56*uW,H,zc)-q;',
    '    L+=o*0.85*(1.0/(1.0+0.28*dot(d1,d1))+1.0/(1.0+0.28*dot(d2,d2)));',
    '  }',
    '  vec3 lum=FROID*L+vec3(0.030,0.036,0.050)*(0.22+0.78*uOn);',
    // la braise du fond rougit ce qui l entoure
    '  float df=max(uEnd-q.z,0.0);',
    '  lum+=ROUGE*0.75*exp(-df*0.30)/(1.0+0.55*q.y*q.y);',

    '  vec3 alb=vec3(0.0);vec3 em=vec3(0.0);',
    '  float dj=abs(fract(zl/J+0.5)-0.5)*J;',       // distance au joint le plus proche

    '  if(id<1.5){',                                // ── le sol
    '    alb=vec3(0.150,0.180,0.230);',
    '    alb*=0.72+0.50*smoothstep(1.55,1.25,abs(q.x));',     // la piste
    '    float j=(1.0-smoothstep(0.014,0.014+gy,dj))*0.014/(0.014+gy*0.6);',
    '    alb*=1.0-0.34*j;',
    '    float bord=(1.0-smoothstep(0.012,0.012+gx,abs(abs(q.x)-1.4)))*0.012/(0.012+gx*0.5);',
    '    em+=CHROME*bord*0.050*on;',
    // le sol est lisse : la rampe s y reflete en trainee
    '    em+=FROID*on*exp(-q.x*q.x*2.6)*0.30*(1.0-abs(rd.y))*(1.0-abs(rd.y));',
    '  }else if(id<2.5){',                          // ── le plafond
    '    alb=vec3(0.045,0.055,0.075);',
    '    float r=1.0-smoothstep(0.105,0.105+gx,abs(q.x));',
    '    em+=FROID*r*on*1.35;',
    '    float zc2=(seg+0.5)*P-uZm;',
    '    float rect=(1.0-smoothstep(0.66,0.66+gx,abs(abs(q.x)-0.56*uW)))',
    '              *(1.0-smoothstep(0.15,0.15+gy,abs(q.z-zc2)));',
    '    em+=FROID*rect*allume(zc2)*0.95;',
    '  }else if(id<3.5){',                          // ── les parois
    '    alb=vec3(0.098,0.126,0.176);',
    '    alb*=mix(0.55,1.0,smoothstep(0.42,0.50,q.y));',      // la plinthe
    '    float j=(1.0-smoothstep(0.013,0.013+gx,dj))*0.013/(0.013+gx*0.6);',
    '    alb*=1.0-0.26*j;',
    '    float lisse=(1.0-smoothstep(0.010,0.010+px,abs(q.y-2.55)))*0.010/(0.010+px*0.5);',
    '    em+=CHROME*lisse*0.060*on;',
    '  }else{',                                     // ── le mur du fond
    '    alb=vec3(0.095,0.120,0.165);',
    '    float br=1.0-smoothstep(0.045,0.085,abs(q.y-0.075));',
    '    em+=ROUGE*br*2.4;',
    '  }',

    // ── les portiques : un cadre lumineux a chaque changement de section ──
    '  float fl=0.0;',
    '  for(int i=0;i<8;i++){',
    '    float kind=uG[i].y;',
    '    if(kind>0.0){',
    '      float dz=abs(q.z-uG[i].x);',
    '      float e=(id<2.5)?gy:gx;',
    '      float ligne=(1.0-smoothstep(0.034,0.034+e,dz))*0.034/(0.034+e*0.35);',
    '      float halo=exp(-dz*1.5);',
    '      float pres=smoothstep(48.0,34.0,uG[i].x)*step(-0.5,uG[i].x)*smoothstep(0.55,1.0,uOn);',
    '      vec3 cg=mix(CHROME,ROUGE,step(0.75,kind));',
    '      if(id<3.5)em+=cg*(ligne*1.25+halo*0.10)*pres*kind;',
    '    }',
    '  }',

    '  vec3 col=alb*lum+em;',
    '  float fog=1.0-exp(-t*0.036);',
    '  col=mix(col,FOG,fog);',

    // la lumiere au bout : un halo au point de fuite
    '  vec2 pf=vec2(-uP.x*0.035,-0.02-uP.y*0.02);',
    '  col+=vec3(0.30,0.40,0.56)*0.085*uOn*exp(-length((uv-pf)*vec2(1.3,2.1))*3.2);',

    // on franchit un portique : les bords de l image s embrasent un instant
    '  float bordure=smoothstep(0.34,0.86,length(uv*vec2(0.82,1.0)));',
    '  col+=ROUGE*uFlash*bordure*0.42;',

    '  col*=uGain;',
    '  col*=1.0-0.42*smoothstep(0.42,1.05,length(uv*vec2(0.78,1.0)));',  // vignette
    '  col=col/(1.0+col*0.55);',
    '  col=pow(col,vec3(0.4545));',
    '  col+=(hash(gl_FragCoord.xy)-0.5)/255.0*1.6;',                    // contre les aplats en escalier
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function compiler(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (window.console) console.warn('hall:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var vs = compiler(gl.VERTEX_SHADER, VS), fs = compiler(gl.FRAGMENT_SHADER, FS);
  var prog = gl.createProgram();
  if (vs && fs) { gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); }
  if (!vs || !fs || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    cv.parentNode.removeChild(cv); return;       // le site garde son fond uni
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var la = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(la);
  gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['uR', 'uP', 'uZm', 'uV', 'uEnd', 'uW', 'uGain', 'uFlash', 'uOn', 'uG'].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  // ── l echelle : combien de metres de hall par pixel de page ──
  var K = 0.011;
  var PAS = 7.0;
  var sobre = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var fin = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var TAU = fin ? 95 : 55;       // meme constante que le glissement du contenu

  var portes = [];               // {z, kind}
  var zFond = 100;
  var gTab = new Float32Array(24);

  function haut(el) { var y = 0; for (var e = el; e; e = e.offsetParent) y += e.offsetTop; return y; }

  function mesurer() {
    var vh = window.innerHeight;
    var scene = document.getElementById('scene');
    var total = Math.max(1, (scene ? scene.offsetHeight : document.documentElement.scrollHeight) - vh);
    zFond = K * total + 17;
    portes = [];
    // un portique rouge par grande section : on le franchit quand son titre arrive
    ['#about-intro', '#portfolio', '#xp', '#form'].forEach(function (s) {
      var el = document.querySelector(s);
      if (el) portes.push({ z: K * Math.max(0, haut(el) - vh * 0.80), kind: 1.0 });
    });
    // un portique chrome, plus discret, par famille de la galerie
    var fams = document.querySelectorAll('#gallery .fam');
    for (var i = 1; i < fams.length && portes.length < 8; i++) {
      if (fams[i].hidden) continue;
      portes.push({ z: K * Math.max(0, haut(fams[i]) - vh * 0.80), kind: 0.5 });
    }
  }

  function tailler() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(2, Math.round(cv.clientWidth * dpr));
    var h = Math.max(2, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uR, w, h);
    var asp = w / h;
    // en portrait le champ est etroit : on resserre le hall pour garder ses parois
    var k = Math.min(1, Math.max(0, (asp - 0.55) / 1.0));
    gl.uniform1f(U.uW, 1.75 + 1.75 * k * k * (3 - 2 * k));
    gl.uniform1f(U.uGain, asp < 0.8 ? 0.095 : 0.085);
  }

  // ── etat ──
  var z = 0, zCible = 0, vit = 0;
  var px = 0, py = 0, pxC = 0, pyC = 0;
  var flash = 0;
  var tPrec = 0, raf = null, vivant = true;
  var fantome = document.querySelector('.hero-ghost');
  // La mise sous tension : le hall est eteint derriere l'intro, et s'allume
  // troncon apres troncon quand les volets s'ecartent.
  var tension = sobre ? 1 : 0, tDepart = 0;

  function cible() { zCible = K * (window.pageYOffset || document.documentElement.scrollTop || 0); }

  function dessiner() {
    var zm = z % PAS; if (zm < 0) zm += PAS;
    gl.uniform1f(U.uZm, zm);
    gl.uniform1f(U.uV, Math.min(1, vit));
    gl.uniform2f(U.uP, px, py);
    gl.uniform1f(U.uEnd, Math.max(0.5, zFond - z));
    gl.uniform1f(U.uFlash, flash);
    gl.uniform1f(U.uOn, tension);
    for (var i = 0; i < 8; i++) {
      var p = portes[i];
      gTab[i * 3] = p ? p.z - z : 0;
      gTab[i * 3 + 1] = p ? p.kind : 0;
      gTab[i * 3 + 2] = 0;
    }
    gl.uniform3fv(U.uG, gTab);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function boucle(t) {
    raf = null;
    if (!vivant) return;
    var dt = Math.min(64, t - tPrec || 16); tPrec = t;
    var zAvant = z;

    if (tDepart && tension < 1) tension = Math.max(0, Math.min(1, (t - tDepart) / 1500));

    var d = zCible - z;
    if (Math.abs(d) < 0.0006) z = zCible; else z += d * (1 - Math.exp(-dt / TAU));
    var k2 = 1 - Math.exp(-dt / 260);
    px += (pxC - px) * k2; py += (pyC - py) * k2;

    // la vitesse, en metres par seconde ramenee a 0..1
    var v = Math.abs(z - zAvant) / (dt / 1000) / 26;
    vit += (v - vit) * (1 - Math.exp(-dt / 170));

    // a-t-on franchi un portique pendant cette image ?
    var fmax = 0;
    for (var i = 0; i < portes.length; i++) {
      var g = portes[i];
      if ((zAvant < g.z) !== (z < g.z) && zAvant !== z) {
        try {
          document.dispatchEvent(new CustomEvent('hall:porte', { detail: { nature: g.kind, sens: z > zAvant ? 1 : -1 } }));
        } catch (e) {}
      }
      var f = g.kind * Math.exp(-Math.abs(z - g.z) * 1.15);
      if (f > fmax) fmax = f;
    }
    flash = fmax;

    dessiner();

    // le fantome "DA" est entre le hall et le contenu : il glisse a part
    if (fantome) {
      var sy = z / K;
      if (sy < window.innerHeight * 1.3)
        fantome.style.transform = 'translate(-50%,calc(-50% + ' + (sy * 0.34).toFixed(1) + 'px))';
    }
    // le souffle suit l'avance, comme dans la soufflerie
    if (window.__hallFlux) window.__hallFlux(Math.min(1.2, vit * 1.5));

    var enMouvement = (tDepart && tension < 1) || Math.abs(zCible - z) > 0.0006 || vit > 0.004 ||
                      Math.abs(pxC - px) > 0.002 || Math.abs(pyC - py) > 0.002;
    if (enMouvement) raf = requestAnimationFrame(boucle);
    else if (window.__hallFlux) window.__hallFlux(0);
  }
  function reveiller() { if (!raf && vivant) { tPrec = performance.now(); raf = requestAnimationFrame(boucle); } }

  // ── branchements ──
  mesurer(); tailler(); cible(); z = zCible;

  if (sobre) {
    // mouvement reduit : le hall reste une image, on ne le parcourt pas
    z = 0; dessiner();
    window.addEventListener('resize', function () { tailler(); dessiner(); }, { passive: true });
  } else {
    window.addEventListener('scroll', function () { cible(); reveiller(); }, { passive: true });
    if (fin) {
      window.addEventListener('pointermove', function (e) {
        pxC = (e.clientX / window.innerWidth) * 2 - 1;
        pyC = -((e.clientY / window.innerHeight) * 2 - 1);
        reveiller();
      }, { passive: true });
    }
    var deb = null;
    function refaire() { mesurer(); tailler(); cible(); reveiller(); }
    window.addEventListener('resize', function () { clearTimeout(deb); deb = setTimeout(refaire, 120); }, { passive: true });
    window.addEventListener('load', refaire);
    var sc = document.getElementById('scene');
    if (window.ResizeObserver && sc) new ResizeObserver(function () { mesurer(); reveiller(); }).observe(sc);
    document.addEventListener('visibilitychange', function () {
      vivant = !document.hidden; if (vivant) reveiller();
    });
    reveiller();
    (function attendre() {
      if (document.body.classList.contains('loaded')) {
        // on ne rejoue pas l'allumage si la page s'ouvre deja en cours de route
        if ((window.pageYOffset || 0) > window.innerHeight * 0.5) tension = 1;
        tDepart = performance.now() + 180; reveiller();
      } else setTimeout(attendre, 60);
    })();
  }

  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); vivant = false; cv.style.display = 'none'; });

  document.body.classList.add('hall-on');
  window.__hall = { mesurer: function () { mesurer(); reveiller(); } };
})();
