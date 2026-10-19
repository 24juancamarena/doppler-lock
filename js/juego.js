// constantes
const C = 250;
const W = 900, H = 600;
let TOP = 104; const BOT = H - 72;
let FS = 1;
const fz = n => (n * FS).toFixed(1) + 'px ';
const sf = font => FS === 1 ? font : font.replace(/([\d.]+)px/, (_, n) => (n * FS).toFixed(1) + 'px');
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
cv.addEventListener('click', () => { if (state === 'tut') nextTut(); else if (state === 'brief') play(); });
const HAND = '"Ink Free", "Segoe Print", "Bradley Hand", "Chalkboard SE", cursive';
const BODY = 'Candara, "Segoe UI", "Trebuchet MS", "Gill Sans", sans-serif';
const COL = {
  night: '#141a35', plum: '#4a3a63', paper: '#efe3c8', paper2: '#e2d0a8', ink: '#2e2433', ink2: '#6a5a63',
  gold: '#e6b85c', amber: '#e9964a', rust: '#c4603f', sky: '#7aaed0', sage: '#8fb57a', lilac: '#b49ad1', cream: '#f7eedb',
  rustD: '#a3432a', skyD: '#2f6d96', sageD: '#4e7d3d', amberD: '#a8571c', lilacD: '#6c4f99',
};
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = f => isFinite(f) ? f.toFixed(0) : '—';
const toneSky = (f, base) => f > base * 1.02 ? COL.sky : f < base * .98 ? COL.rust : COL.cream;
const toneInk = (f, base) => f > base * 1.02 ? COL.skyD : f < base * .98 ? COL.rustD : COL.ink;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hstr = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };
function seeded(seed) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
let boil = 0;

const ONDAS_POR_ANILLO = 40;
const ringEveryFor = f => ONDAS_POR_ANILLO / f;

// efecto doppler general
// f' = f · (c + v_obs) / (c − v_src)
function radial(src, obs) {
  const dx = obs.x - src.x, dy = obs.y - src.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  return { vs: src.vx * ux + src.vy * uy, vo: -(obs.vx * ux + obs.vy * uy), d };
}
function doppler(f, src, obs) {
  const { vs, vo } = radial(src, obs);
  if (vs >= C) return Infinity;
  return Math.max(0, f * (C + vo) / (C - vs));
}

// audio
let audio = null, refOn = true;
function initAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain(); master.gain.value = 0.3; master.connect(ac.destination);
  const voice = type => {
    const o = ac.createOscillator(); o.type = type;
    const g = ac.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(master); o.start();
    return { o, g };
  };
  audio = { ac, main: voice('triangle'), ref: voice('sine'), boom: master };
}
function setAudio(f, vol, ref) {
  if (!audio) return;
  const t = audio.ac.currentTime;
  if (isFinite(f)) audio.main.o.frequency.setTargetAtTime(Math.min(Math.max(f, 30), 3000), t, 0.015);
  audio.main.g.gain.setTargetAtTime(!isFinite(f) || f < 30 ? 0 : vol * 0.55, t, 0.03);
  if (ref) audio.ref.o.frequency.setTargetAtTime(ref, t, 0.02);
  audio.ref.g.gain.setTargetAtTime(ref && refOn ? 0.14 : 0, t, 0.05);
}
function boomSound() {
  if (!audio) return;
  const ac = audio.ac, len = ac.sampleRate * 0.6;
  const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = ac.createBufferSource(); s.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
  s.connect(lp); lp.connect(audio.boom); s.start();
}
function tick() {
  if (!audio) return;
  const ac = audio.ac, t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = 2200; o.connect(g); g.connect(audio.boom);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  o.start(t); o.stop(t + 0.04);
}
function chime() {
  if (!audio) return;
  const ac = audio.ac, t = ac.currentTime;
  [660, 990, 1320].forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f; o.connect(g); g.connect(audio.boom);
    g.gain.setValueAtTime(0, t + i * 0.07);
    g.gain.linearRampToValueAtTime(0.25, t + i * 0.07 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.5);
    o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.55);
  });
}

// input
const keys = {};
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (!e.repeat && (e.code === 'KeyP' || (e.code === 'Escape' && state === 'pause'))) { state === 'pause' ? resumeGame() : pauseGame(); return; }
  if (state === 'pause') return;
  if (state === 'tut') {
    if (!e.repeat && ['Enter', 'Space', 'ArrowRight'].includes(e.code)) nextTut();
    if (e.code === 'Escape') endTut();
    return;
  }
  if (state === 'brief') {
    if (!e.repeat && ['Enter', 'Space', 'Escape'].includes(e.code)) play();
    return;
  }
  command(e.code);
});
addEventListener('keyup', e => keys[e.code] = false);
function command(code) {
  if (state !== 'play') return;
  if (code === 'KeyR') { loadLevel(cur); say('Nivel reiniciado', 1.4); }
  if (code === 'KeyH') startTut(cur);
  const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(code);
  if (n >= 0) { if (run) run.ranked = false; startTut(n); }
}

const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, ax: 0, ay: 0 }, JOY_R = 56;
let brakeId = null, touchMode = false;
function setTouch(on) { touchMode = on; FS = on ? 1.25 : 1; TOP = on ? 122 : 104; document.body.classList.toggle('touch', on); }
setTouch(matchMedia('(pointer: coarse)').matches);
const toCanvas = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') setTouch(true);
  if (state !== 'play') return;
  const p = toCanvas(e);
  try { cv.setPointerCapture(e.pointerId); } catch {}
  if (p.x > W * .72) { if (brakeId === null) brakeId = e.pointerId; }
  else if (joy.id === null) Object.assign(joy, { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y, ax: 0, ay: 0 });
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  const p = toCanvas(e);
  let dx = p.x - joy.ox, dy = p.y - joy.oy;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; joy.ox = p.x - dx; joy.oy = p.y - dy; }
  joy.x = p.x; joy.y = p.y;
  const k = Math.hypot(dx, dy) / JOY_R;
  joy.ax = k < .15 ? 0 : dx / JOY_R; joy.ay = k < .15 ? 0 : dy / JOY_R;
});
const release = e => {
  if (e.pointerId === joy.id) { joy.id = null; joy.ax = joy.ay = 0; }
  if (e.pointerId === brakeId) brakeId = null;
};
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
const brakeHint = () => touchMode ? 'frena con el lado derecho' : 'Espacio frena';

// jugador
const P = { x: 0, y: 0, vx: 0, vy: 0, ang: 0, thr: 0 };
const speed = () => Math.hypot(P.vx, P.vy);
let puffs = [], puffT = 0;
function movePlayer(dt, maxV) {
  let ax = 0, ay = 0;
  if (keys.KeyA || keys.ArrowLeft) ax--;
  if (keys.KeyD || keys.ArrowRight) ax++;
  if (keys.KeyW || keys.ArrowUp) ay--;
  if (keys.KeyS || keys.ArrowDown) ay++;
  if (ax && ay) { ax *= Math.SQRT1_2; ay *= Math.SQRT1_2; }
  if (joy.id !== null) { ax = joy.ax; ay = joy.ay; }
  const acc = (keys.ShiftLeft || keys.ShiftRight) ? 60 : 260;
  P.vx += ax * acc * dt; P.vy += ay * acc * dt;
  if (keys.Space || brakeId !== null) { const k = Math.exp(-4 * dt); P.vx *= k; P.vy *= k; }
  const sp = speed();
  if (sp > maxV) { P.vx *= maxV / sp; P.vy *= maxV / sp; }
  P.x += P.vx * dt; P.y += P.vy * dt;
  const r = 14;
  if (P.x < r) { P.x = r; P.vx = Math.abs(P.vx); }
  if (P.x > W - r) { P.x = W - r; P.vx = -Math.abs(P.vx); }
  if (P.y < TOP + r) { P.y = TOP + r; P.vy = Math.abs(P.vy); }
  if (P.y > BOT - r) { P.y = BOT - r; P.vy = -Math.abs(P.vy); }
  const want = (ax || ay) ? Math.atan2(ay, ax) : speed() > 15 ? Math.atan2(P.vy, P.vx) : P.ang;
  P.ang += Math.atan2(Math.sin(want - P.ang), Math.cos(want - P.ang)) * Math.min(1, dt * 10);
  P.thr += (Math.min(1, Math.hypot(ax, ay)) - P.thr) * Math.min(1, dt * 12);
  if (P.thr > .4 && (puffT -= dt) <= 0) {
    puffT = .07;
    const cx = Math.cos(P.ang), sy = Math.sin(P.ang);
    puffs.push({ x: P.x - cx * 22, y: P.y - sy * 22, vx: -cx * 25 + rnd(-8, 8), vy: -sy * 25 + rnd(-8, 8), t0: time, r: rnd(2.5, 4.5) });
  }
}
function solid(o, R) {
  const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy);
  if (d < R && d > 0) {
    const nx = dx / d, ny = dy / d;
    P.x = o.x + nx * R; P.y = o.y + ny * R;
    const vn = (P.vx - (o.vx || 0)) * nx + (P.vy - (o.vy || 0)) * ny;
    if (vn < 0) { P.vx -= 2 * vn * nx; P.vy -= 2 * vn * ny; }
  }
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// texturas
function noiseCanvas(n, paint) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data;
  for (let i = 0; i < d.length; i += 4) paint(d, i, Math.random());
  g.putImageData(img, 0, 0);
  return c;
}
const PAPER_TEX = noiseCanvas(160, (d, i, v) => { d[i] = 96; d[i + 1] = 72; d[i + 2] = 52; d[i + 3] = v < .35 ? v * 95 : 0; });
const FILM_TEX = noiseCanvas(220, (d, i, v) => { const l = v > .5; d[i] = d[i + 1] = d[i + 2] = l ? 255 : 0; d[i + 3] = Math.abs(v - .5) * 44; });
const PAPER_GRAIN = ctx.createPattern(PAPER_TEX, 'repeat'), FILM = ctx.createPattern(FILM_TEX, 'repeat');
document.documentElement.style.setProperty('--paper-grain', `url(${PAPER_TEX.toDataURL()})`);
document.documentElement.style.setProperty('--grain', `url(${FILM_TEX.toDataURL()})`);
function filmGrain() {
  const ox = hash(boil) * 220, oy = hash(boil + 3) * 220;
  ctx.save(); ctx.globalAlpha = .5; ctx.translate(-ox, -oy); ctx.fillStyle = FILM; ctx.fillRect(ox, oy, W, H); ctx.restore();
}

// trazos a mano
function sketchCircle(x, y, r, seed, amp = 1.5) {
  const n = Math.max(20, Math.min(80, r * .45 | 0));
  const p1 = hash(seed) * 6.28, p2 = hash(seed + 1) * 6.28, a0 = hash(seed + 2) * 6.28;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = a0 + (i / n) * (Math.PI * 2 + .22);
    const rr = r + amp * (Math.sin(t * 3 + p1) * .6 + Math.sin(t * 5 + p2) * .4);
    const px = x + Math.cos(t) * rr, py = y + Math.sin(t) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
}
function roughRect(x, y, w, h, seed, j = 2) {
  const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py], i) => [px + (hash(seed + i) - .5) * j * 2, py + (hash(seed + i + 9) - .5) * j * 2]);
  ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]);
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = c[i], [bx, by] = c[(i + 1) % 4];
    ctx.quadraticCurveTo((ax + bx) / 2 + (hash(seed + i + 20) - .5) * j * 1.6, (ay + by) / 2 + (hash(seed + i + 30) - .5) * j * 1.6, bx, by);
  }
  ctx.closePath();
}
function tape(x, y, ang, w = 48) {
  const h = 15;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2);
  for (let i = 1; i <= 4; i++) ctx.lineTo(w / 2 + (i % 2 ? -2.5 : 0), -h / 2 + i * h / 4);
  ctx.lineTo(-w / 2, h / 2);
  for (let i = 3; i >= 0; i--) ctx.lineTo(-w / 2 + (i % 2 ? 2.5 : 0), -h / 2 + i * h / 4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(232,218,178,.8)'; ctx.fill();
  ctx.strokeStyle = 'rgba(110,90,70,.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}
function paper(x, y, w, h, seed, o = {}) {
  const sh = o.sh ?? 4, j = o.j ?? 2;
  roughRect(x + sh, y + sh + 1, w, h, seed, j); ctx.fillStyle = 'rgba(8,6,18,.4)'; ctx.fill();
  roughRect(x, y, w, h, seed, j);
  ctx.fillStyle = o.fill || COL.paper; ctx.fill();
  ctx.save(); ctx.globalAlpha = .6; ctx.fillStyle = PAPER_GRAIN; ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(46,36,51,.6)'; ctx.lineWidth = 1.4; ctx.stroke();
  if (o.tape) for (const [tx, ty, ta] of o.tape) tape(tx, ty, ta);
}
function sparkle(g, x, y, s, col, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col;
  g.beginPath(); g.moveTo(0, -s);
  g.quadraticCurveTo(s * .14, -s * .14, s, 0); g.quadraticCurveTo(s * .14, s * .14, 0, s);
  g.quadraticCurveTo(-s * .14, s * .14, -s, 0); g.quadraticCurveTo(-s * .14, -s * .14, 0, -s);
  g.fill(); g.restore();
}
function doodleStar(g, x, y, s, R) {
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 4 / 5;
    const px = x + Math.cos(a) * s + (R() - .5) * 1.6, py = y + Math.sin(a) * s + (R() - .5) * 1.6;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
}

// cielo pintado
const TONES = [
  { top: '#141a35', bottom: '#2a2146', strokes: ['#4a3a63', '#2c3a66', '#6b4f7a', '#3a2f58', '#7a5a4a'], doodle: 'planet' },
  { top: '#17163a', bottom: '#2e1f47', strokes: ['#5a3f72', '#3b2d5e', '#6e4d80', '#28335f', '#7a4f6a'], doodle: 'moon' },
  { top: '#121c33', bottom: '#1f2a44', strokes: ['#2c4766', '#3a3a62', '#5d4a6e', '#2a3f55', '#7a5a40'], doodle: 'galaxy' },
];
function makeSky(seed, tn) {
  const R = seeded(seed), r = (a, b) => a + R() * (b - a);
  const c = document.createElement('canvas'); c.width = W * DPR; c.height = H * DPR;
  const g = c.getContext('2d'); g.scale(DPR, DPR);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, tn.top); bg.addColorStop(1, tn.bottom);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 170; i++) {
    const col = tn.strokes[i % tn.strokes.length], rx = r(40, 170), ry = r(6, 28);
    g.save(); g.translate(r(-50, W + 50), r(-30, H + 30)); g.rotate(r(-.45, .45));
    g.globalAlpha = r(.04, .11); g.fillStyle = col;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
    if (R() < .45) {
      g.strokeStyle = col; g.lineWidth = .8;
      for (let k = 0; k < 5; k++) { const yy = r(-ry, ry) * .8; g.beginPath(); g.moveTo(-rx * r(.5, .9), yy); g.lineTo(rx * r(.5, .9), yy + r(-2, 2)); g.stroke(); }
    }
    g.restore();
  }
  const tints = ['#f7eedb', '#f3d9a4', '#d9e3ef', '#f0c7b0'];
  for (let i = 0; i < 230; i++) {
    g.globalAlpha = r(.2, .85); g.fillStyle = tints[i % 4];
    g.beginPath(); g.ellipse(r(0, W), r(0, H), r(.5, 1.5), r(.4, 1.1), r(0, 3), 0, 7); g.fill();
  }
  for (let i = 0; i < 20; i++) { g.globalAlpha = r(.45, .95); sparkle(g, r(0, W), r(0, H), r(2.5, 6.5), tints[i % 2], r(-.3, .3)); }
  g.globalAlpha = .5; g.strokeStyle = '#f3d9a4'; g.lineWidth = 1.1; g.lineJoin = 'round';
  for (let i = 0; i < 6; i++) doodleStar(g, r(20, W - 20), r(120, H - 90), r(5, 9), R);
  g.globalAlpha = .42; g.strokeStyle = '#f7eedb'; g.lineWidth = 1.5; g.lineCap = 'round';
  if (tn.doodle === 'planet') {
    g.beginPath(); g.arc(800, 455, 17, 0, 7); g.stroke();
    g.beginPath(); g.ellipse(800, 455, 31, 8, -.35, Math.PI * .95, Math.PI * 2.05); g.stroke();
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(805 + k * 3, 444 + k * 2); g.lineTo(812 + k * 2, 451 + k * 3); g.stroke(); }
  } else if (tn.doodle === 'moon') {
    g.beginPath(); g.arc(90, 470, 20, -1.2, 2.2); g.quadraticCurveTo(100, 470, 90 + Math.cos(-1.2) * 20, 470 + Math.sin(-1.2) * 20); g.stroke();
  } else {
    g.beginPath();
    for (let k = 0; k < 70; k++) { const a = k * .22, rr = 2 + k * .38; g.lineTo(110 + Math.cos(a) * rr * 1.4, 470 + Math.sin(a) * rr * .7); }
    g.stroke();
  }
  g.globalAlpha = 1;
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const v = g.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .72);
  v.addColorStop(0, 'rgba(10,8,20,0)'); v.addColorStop(1, 'rgba(10,8,20,.5)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  return c;
}
const SKIES = TONES.map((tn, i) => makeSky(11 + i * 7, tn));
const TWINKLE = Array.from({ length: 16 }, (_, i) => ({ x: hash(i * 3) * W, y: hash(i * 3 + 1) * H, s: 3 + hash(i * 3 + 2) * 4, p: hash(i + 50) * 6.28 }));
let shoot = null;
function sky(level, t) {
  ctx.drawImage(SKIES[level], 0, 0, W, H);
  for (const s of TWINKLE) {
    const k = .5 + .5 * Math.sin(t * 1.3 + s.p);
    ctx.globalAlpha = .35 + .5 * k; sparkle(ctx, s.x, s.y, s.s * (.6 + .5 * k), '#f7eedb', s.p);
  }
  ctx.globalAlpha = 1;
  if (!shoot || t < shoot.t0) { if (Math.random() < 0.004) shoot = { t0: t, x: rnd(100, 650), y: rnd(130, 260) }; else return; }
  const k = t - shoot.t0; if (k > 1.1) { shoot = null; return; }
  const hx = shoot.x + k * 420, hy = shoot.y + k * 170, a = Math.min(1, (1.1 - k) * 2);
  ctx.strokeStyle = `rgba(247,238,219,${.55 * a})`; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.lineWidth = 2.4 - i * .7; ctx.beginPath(); ctx.moveTo(hx, hy + i * 1.5); ctx.lineTo(hx - 80 + i * 18, hy - 32 + i * 9); ctx.stroke(); }
  ctx.globalAlpha = a; sparkle(ctx, hx, hy, 5, '#f7eedb', k * 4); ctx.globalAlpha = 1;
}

// personajes y objetos
function roundStarPath(x, y, R, r, rot, seed) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? r : R) * (1 + (hash(seed + i) - .5) * .07);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath();
  const m = mid(pts[9], pts[0]); ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < 10; i++) { const p = pts[i], n = mid(p, pts[(i + 1) % 10]); ctx.quadraticCurveTo(p[0], p[1], n[0], n[1]); }
  ctx.closePath();
}
function eye(x, y, look, tall, sleepy) {
  ctx.fillStyle = COL.cream; ctx.beginPath(); ctx.ellipse(x, y, 4.4, tall ? 6.2 : 5.2, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x + look.x * 1.7, y + look.y * 2.2, 2.3, 0, 7); ctx.fill();
  ctx.fillStyle = COL.cream; ctx.beginPath(); ctx.arc(x + look.x * 1.7 - .8, y + look.y * 2.2 - .9, .7, 0, 7); ctx.fill();
  if (sleepy) {
    ctx.fillStyle = '#e8b04f'; ctx.beginPath(); ctx.ellipse(x, y - 1, 5, 5.6, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x + 5, y - 1); ctx.stroke();
  }
}
function drawStarBuddy(x, y, t, look) {
  for (const [r, a] of [[80, .06], [64, .08], [52, .11]]) { sketchCircle(x, y, r, 900 + r + boil % 3, 3); ctx.fillStyle = `rgba(233,150,74,${a})`; ctx.fill(); }
  ctx.strokeStyle = COL.gold; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const a = t * .12 + i * Math.PI / 5 + Math.PI / 10, j = hash(i * 7 + boil) * 3;
    const r0 = 50 + j, r1 = (i % 2 ? 59 : 68) + j;
    ctx.lineWidth = i % 2 ? 2 : 3.2;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
  }
  const cy = y + Math.sin(t * 1.6) * 2, rot = Math.sin(t * .7) * .08, sd = 50 + boil % 4;
  roundStarPath(x, cy, 50, 27, rot, sd);
  ctx.fillStyle = '#f0c45c'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(217,115,63,.42)'; ctx.beginPath(); ctx.arc(x + 16, cy + 18, 42, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,244,214,.55)'; ctx.beginPath(); ctx.ellipse(x - 15, cy - 19, 12, 7, -.6, 0, 7); ctx.fill();
  ctx.restore();
  roundStarPath(x, cy, 50, 27, rot, sd);
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  const blink = (t % 4.3) < .13;
  for (const ex of [-9, 9]) {
    if (blink) { ctx.strokeStyle = COL.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + ex - 4, cy - 2); ctx.quadraticCurveTo(x + ex, cy, x + ex + 4, cy - 2); ctx.stroke(); }
    else eye(x + ex, cy - 3, look, false, false);
  }
  ctx.fillStyle = 'rgba(196,96,63,.4)';
  for (const ex of [-16, 16]) { ctx.beginPath(); ctx.ellipse(x + ex, cy + 6, 4.5, 3, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, cy + 6, 5.5, .35, Math.PI - .35); ctx.stroke();
}
function drawCrystal(x, y, t, mode, seed = 0) {
  const active = mode === 'active', done = mode === 'done', lit = active || done;
  if (lit) { sketchCircle(x, y - 4, 44, 700 + seed + boil % 3, 2.5); ctx.fillStyle = done ? 'rgba(143,181,122,.2)' : 'rgba(180,154,209,.15)'; ctx.fill(); }
  const shards = [[-.42, 17, 7, -11, 4], [.48, 20, 7, 11, 3], [0, 30, 10, 0, 0]];
  for (const [a, h, w, dx, dy] of shards) {
    const path = () => { ctx.beginPath(); ctx.moveTo(-w * .6, 0); ctx.lineTo(-w, -h * .55); ctx.lineTo(0, -h); ctx.lineTo(w, -h * .6); ctx.lineTo(w * .6, 0); ctx.closePath(); };
    ctx.save(); ctx.translate(x + dx, y + dy + 10); ctx.rotate(a + (active ? Math.sin(t * 2 + dx) * .03 : 0));
    path(); ctx.fillStyle = done ? COL.sage : active ? COL.lilac : 'rgba(180,154,209,.2)'; ctx.fill();
    if (lit) { ctx.fillStyle = 'rgba(247,238,219,.45)'; ctx.beginPath(); ctx.moveTo(-w * .6, 0); ctx.lineTo(-w, -h * .55); ctx.lineTo(0, -h); ctx.lineTo(-w * .1, 0); ctx.closePath(); ctx.fill(); }
    path(); ctx.strokeStyle = lit ? COL.ink : 'rgba(239,227,200,.5)'; ctx.lineWidth = lit ? 1.9 : 1.2; ctx.lineJoin = 'round';
    if (!lit) ctx.setLineDash([3, 3]);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.fillStyle = '#3a3150'; ctx.beginPath(); ctx.ellipse(x, y + 12, 21, 5.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = lit ? COL.ink : 'rgba(239,227,200,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (active) for (let i = 0; i < 3; i++) {
    const k = .5 + .5 * Math.sin(t * 3 + i * 2.1);
    ctx.globalAlpha = k; sparkle(ctx, x + [-26, 24, 6][i], y + [-22, -12, -34][i], 3 + 2 * k, COL.cream, i); ctx.globalAlpha = 1;
  }
}
function rockPath(x, y) {
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = i / 10 * 6.283, r = 20 + (hash(31 + i % 10) - .5) * 7 + (hash(boil * 3 + i % 10) - .5) * .8;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function drawComet(x, y, vx, vy, t, look) {
  const sp = Math.hypot(vx, vy), ux = sp ? vx / sp : 1, uy = sp ? vy / sp : 0, nx = -uy, ny = ux, L = 80 + sp * .55;
  ctx.lineCap = 'round';
  [[16, 1, '233,150,74', .5], [10, .8, '247,238,219', .45], [7, 1.15, '180,154,209', .38], [5, .62, '230,184,92', .55]].forEach(([w, k, rgb, a], i) => {
    const len = L * k, off = (i - 1.5) * 5, wave = Math.sin(t * 3 + i) * 6;
    const sx = x + nx * off, sy = y + ny * off;
    const ex = x - ux * len + nx * (off * 2 + wave), ey = y - uy * len + ny * (off * 2 + wave);
    const g = ctx.createLinearGradient(sx, sy, ex, ey); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.strokeStyle = g; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(x - ux * len * .5 + nx * (off + wave * .5), y - uy * len * .5 + ny * (off + wave * .5), ex, ey); ctx.stroke();
  });
  rockPath(x, y); ctx.fillStyle = '#9a7f74'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(46,36,51,.32)'; ctx.beginPath(); ctx.arc(x + 9, y + 10, 19, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(247,238,219,.3)'; ctx.beginPath(); ctx.ellipse(x - 8, y - 11, 8, 4, -.5, 0, 7); ctx.fill();
  ctx.restore();
  rockPath(x, y); ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.3; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = 'rgba(46,36,51,.35)';
  ctx.beginPath(); ctx.arc(x - 10, y + 9, 3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x + 11, y - 8, 2.3, 0, 7); ctx.fill();
  for (const ex of [-6, 6]) eye(x + ex, y - 1, look, false, false);
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 11, y - 9); ctx.lineTo(x - 3, y - 7); ctx.moveTo(x + 11, y - 9); ctx.lineTo(x + 3, y - 7); ctx.stroke();
}
function drawShip(x, y, ang, thr, blink = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.3, 1.3);
  if (thr > .05) {
    const f = thr * (1 + .25 * Math.sin(performance.now() / 25 + x));
    ctx.fillStyle = COL.amber; ctx.beginPath(); ctx.ellipse(-17 - 6 * f, 0, 7 * f + 2, 4.5 * f + 1.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f7d27a'; ctx.beginPath(); ctx.ellipse(-15 - 3 * f, 0, 4 * f + 1.5, 2.6 * f + 1, 0, 0, 7); ctx.fill();
  }
  ctx.lineWidth = 1.9; ctx.strokeStyle = COL.ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = COL.rust;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-5, 7 * s); ctx.quadraticCurveTo(-12, 15 * s, -16, 14 * s); ctx.quadraticCurveTo(-14, 7 * s, -11, 4 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-2, -9); ctx.lineTo(-4, -16); ctx.stroke();
  ctx.fillStyle = COL.paper2; ctx.beginPath(); ctx.arc(-4, -18, 4.2, Math.PI * .1, Math.PI * 1.1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = blink > 0 ? `rgba(230,184,92,${.4 + .6 * blink})` : '#8a7a70';
  ctx.beginPath(); ctx.arc(-1.5, -21.5, 1.8, 0, 7); ctx.fill();
  ctx.fillStyle = COL.cream;
  ctx.beginPath(); ctx.moveTo(15, 0); ctx.bezierCurveTo(14, -9, 2, -11, -8, -8.5); ctx.quadraticCurveTo(-13, 0, -8, 8.5); ctx.bezierCurveTo(2, 11, 14, 9, 15, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.rust;
  ctx.beginPath(); ctx.moveTo(15, 0); ctx.bezierCurveTo(14.6, -5, 11.5, -7.6, 8.5, -8.6); ctx.quadraticCurveTo(10.5, 0, 8.5, 8.6); ctx.bezierCurveTo(11.5, 7.6, 14.6, 5, 15, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3f6f8f'; ctx.beginPath(); ctx.arc(1, 0, 4.4, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(247,238,219,.85)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(1, 0, 2.6, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
}
function drawPuffs() {
  puffs = puffs.filter(p => time - p.t0 < .9);
  for (const p of puffs) {
    const k = time - p.t0;
    ctx.globalAlpha = .5 * (1 - k / .9); ctx.fillStyle = COL.cream;
    ctx.beginPath(); ctx.arc(p.x + p.vx * k, p.y + p.vy * k, p.r + k * 6, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawPortal(p, t) {
  sketchCircle(p.x, p.y, 36, 333 + boil % 3, 2.5); ctx.fillStyle = 'rgba(143,181,122,.2)'; ctx.fill();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.lineCap = 'round';
  for (const [w, c] of [[5.5, COL.ink], [3, COL.sage]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const k = i / 60, a = -t * 2.2 + k * 6.283 * 2.3, r = 3 + k * 26 + (hash(boil + i) - .5) * 1.2;
      const px = p.x + Math.cos(a) * r, py = p.y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) { const a = t + i * 2.1; sparkle(ctx, p.x + Math.cos(a) * 46, p.y + Math.sin(a) * 46, 3.5, COL.cream, a); }
  labelStack(p, 44, [{ text: 'portal', font: '18px ' + HAND, color: COL.sageD }]);
}
function drawArrow(x, y, vx, vy, color, off = 14) {
  const sp = Math.hypot(vx, vy); if (sp < 5) return;
  const ux = vx / sp, uy = vy / sp, len = 20 + sp * 0.2;
  const x0 = x + ux * off, y0 = y + uy * off, x1 = x0 + ux * len, y1 = y0 + uy * len;
  ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 - uy * 2, (y0 + y1) / 2 + ux * 2, x1, y1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1 - ux * 8 - uy * 6, y1 - uy * 8 + ux * 6); ctx.lineTo(x1, y1); ctx.lineTo(x1 - ux * 8 + uy * 6, y1 - uy * 8 - ux * 6); ctx.stroke();
}
function guideArrow(from, to, dir) {
  if (!dir) return;
  const d = dist(from, to) || 1, ux = (to.x - from.x) / d * dir, uy = (to.y - from.y) / d * dir, nx = -uy, ny = ux;
  const k = 4 * Math.sin(time * 7), s = 28, e = 72 + k;
  const pt = (al, sd, i) => [from.x + ux * al + nx * sd + (hash(boil * 7 + i) - .5) * 1.3, from.y + uy * al + ny * sd + (hash(boil * 7 + i + 20) - .5) * 1.3];
  const poly = [pt(s, -4, 0), pt(e - 14, -4.6, 1), pt(e - 16, -11, 2), pt(e + 3, 0, 3), pt(e - 16, 11, 4), pt(e - 14, 4.6, 5), pt(s, 4, 6)];
  ctx.beginPath(); poly.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
  ctx.fillStyle = COL.amber; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
}
function sightLine(a, b, vr) {
  const d = dist(a, b), off = (time * 30) % 12;
  ctx.fillStyle = vr > 0 ? COL.sky : COL.rust; ctx.globalAlpha = .75;
  for (let i = 1; (i * 12 + off) < d - 20; i++) {
    const k = (i * 12 + off) / d;
    ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 1.1 + hash(i) * 1.1, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function holdRing(x, y, r, k) {
  ctx.setLineDash([3, 5]); sketchCircle(x, y, r, 444, .8);
  ctx.strokeStyle = 'rgba(247,238,219,.35)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
  if (k > 0) {
    ctx.lineCap = 'round';
    for (const [w, c] of [[7, COL.ink], [4.2, COL.sage]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, k) * Math.PI * 2); ctx.stroke();
    }
  }
}
function drawLock(x, y, open, fill) {
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.9; ctx.lineCap = 'round';
  ctx.beginPath();
  if (open) { ctx.arc(x + 1, y - 5, 4.2, Math.PI * 1.05, Math.PI * 2.05); }
  else { ctx.moveTo(x - 4.2, y); ctx.lineTo(x - 4.2, y - 2); ctx.arc(x, y - 2, 4.2, Math.PI, 0); ctx.lineTo(x + 4.2, y); }
  ctx.stroke();
  roughRect(x - 6.5, y, 13, 10, hstr(x), .8); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x, y + 4.5, 1.3, 0, 7); ctx.fill();
}
function whale(x, y) {
  ctx.fillStyle = '#6f8fb0'; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 15, y + 2); ctx.quadraticCurveTo(x - 14, y - 9, x + 2, y - 8); ctx.quadraticCurveTo(x + 13, y - 7, x + 14, y + 1);
  ctx.quadraticCurveTo(x + 18, y - 5, x + 21, y - 6); ctx.quadraticCurveTo(x + 19, y + 1, x + 22, y + 5); ctx.quadraticCurveTo(x + 17, y + 4, x + 14, y + 3);
  ctx.quadraticCurveTo(x + 6, y + 8, x - 6, y + 7); ctx.quadraticCurveTo(x - 15, y + 7, x - 15, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x - 8, y - 1, 1.2, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6f8fb0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 3, y - 9); ctx.quadraticCurveTo(x - 5, y - 14, x - 8, y - 15); ctx.moveTo(x - 3, y - 9); ctx.quadraticCurveTo(x - 1, y - 14, x + 2, y - 15); ctx.stroke();
}
function bird(x, y) {
  ctx.fillStyle = COL.sky; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(x, y, 8, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.gold; ctx.beginPath(); ctx.moveTo(x + 7, y - 2); ctx.lineTo(x + 12, y); ctx.lineTo(x + 7, y + 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5c8fb3'; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 1, y - 9, x + 3, y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x + 3.5, y - 2.5, 1.1, 0, 7); ctx.fill();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x + 15, y - 8); ctx.lineTo(x + 15, y - 15); ctx.lineTo(x + 18, y - 14); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.ellipse(x + 13.8, y - 8, 1.8, 1.3, -.4, 0, 7); ctx.fill();
}

// efectos
let rings = [], msgs = [], sparks = [], shake = 0, time = 0, hits = [], pulse = 0, ringId = 0;
function emitRing(o, rgb) { rings.push({ x: o.x, y: o.y, t0: time, rgb }); }
function emitEvery(lv, o, rgb, dt, sup = false) {
  lv.ringT -= dt;
  while (lv.ringT <= 0) {
    const back = -lv.ringT;
    rings.push({ x: o.x - (o.vx || 0) * back, y: o.y - (o.vy || 0) * back, t0: time - back, rgb, sup });
    lv.ringT += lv.ringEvery;
  }
}
function say(text, dur = 2.2, color = COL.ink, big = false) { msgs.push({ text, t: dur, dur, color, big }); }
function holdStep(ok, h, dt) { return ok ? h + dt : Math.max(0, h - dt * 1.5); }
function drawRing(x, y, rad, rgb, a) {
  if (rad < 2 || a <= 0) return;
  ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
}
function burst(x, y) {
  const cols = [COL.gold, COL.amber, COL.lilac, COL.sage, COL.cream];
  for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28, v = rnd(60, 200); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: time, color: cols[i % 5], s: rnd(3, 6) }); }
}
function drawSparks() {
  sparks = sparks.filter(p => time - p.t0 < 1.1);
  for (const p of sparks) {
    const k = time - p.t0;
    ctx.globalAlpha = 1 - k / 1.1;
    sparkle(ctx, p.x + p.vx * k, p.y + p.vy * k + 40 * k * k, p.s * (1 - k * .5), p.color, k * 5);
  }
  ctx.globalAlpha = 1;
}

// texto y etiquetas
function fitFont(text, weight, size, min, maxW, fam = BODY) {
  ctx.font = `${weight} ${size}px ${fam}`;
  while (size > min && ctx.measureText(text).width > maxW) ctx.font = `${weight} ${--size}px ${fam}`;
}
function wrapLines(text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
function fitText(text, x, y, font, color) {
  if (!text) return;
  ctx.font = sf(font); ctx.textAlign = 'center';
  const w = ctx.measureText(text).width, px = Math.min(W - 8 - w / 2, Math.max(8 + w / 2, x)), py = Math.min(H - 8, Math.max(16, y));
  ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,16,30,.9)'; ctx.strokeText(text, px, py);
  ctx.fillStyle = color; ctx.fillText(text, px, py);
}
function labelStack(o, r, items, bottom = BOT - 8, above = false) {
  items = items.filter(it => it.text);
  if (!items.length) return;
  const lh = 18 * FS, h = items.length * lh + 10;
  let w = 0;
  for (const it of items) { ctx.font = sf(it.font || '14px ' + BODY); w = Math.max(w, ctx.measureText(it.text).width); }
  const yBelow = o.y + r + 8, yAbove = o.y - r - 8 - h;
  let y = above ? (yAbove < TOP ? yBelow : yAbove) : (yBelow + h > bottom ? yAbove : yBelow);
  y = Math.max(TOP, Math.min(y, bottom - h));
  const bw = w + 22, x = Math.min(W - 10 - bw / 2, Math.max(10 + bw / 2, o.x)), seed = hstr(items[0].text);
  ctx.save(); ctx.translate(x, y + h / 2); ctx.rotate((hash(seed) - .5) * .06);
  paper(-bw / 2, -h / 2, bw, h, seed, { sh: 2.5, j: 1.3 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  items.forEach((it, i) => { ctx.font = sf(it.font || '14px ' + BODY); ctx.fillStyle = it.color || COL.ink; ctx.fillText(it.text, 0, -h / 2 + 5 + lh * i + lh / 2 + 1); });
  ctx.restore(); ctx.textBaseline = 'alphabetic';
}
function coachFor(heard, lo, hi, vr, base, name) {
  if (!isFinite(heard)) return { ok: false, dir: 0, text: 'más lento: vas más rápido que tus ondas' };
  if (heard >= lo && heard <= hi) return { ok: true, dir: 0, text: '¡así! mantén esa velocidad' };
  if (heard < lo) return { ok: false, dir: 1, text: vr < 0 ? `da la vuelta: ve HACIA ${name}` : `más rápido hacia ${name}` };
  return { ok: false, dir: -1, text: vr > 0 ? (lo > base ? `más lento (${brakeHint()})` : `da la vuelta: ALÉJATE de ${name}`) : 'más rápido alejándote' };
}
const coachItem = (lv) => ({ text: lv.coach, font: 'bold 15px ' + BODY, color: lv.ok ? COL.sageD : COL.ink });
const waveItem = (lv) => ({ text: lv.waveText, font: '12.5px ' + BODY, color: COL.ink2 });

// niveles
const levels = [
{
  name: 'Nivel 1 · La Estrella',
  brief: {
    role: 'Tú ESCUCHAS. La estrella suena siempre a 400 Hz.',
    goal: 'Abre 3 cerraduras cambiando el tono que oyes.',
    rules: [
      [COL.sky, 'Acércate a la estrella → oyes más AGUDO'],
      [COL.rust, 'Aléjate de la estrella → oyes más GRAVE'],
      [COL.sage, 'Deja la perilla en la zona verde 1 segundo'],
    ],
  },
  ringEvery: ringEveryFor(400),
  listener() { return P; },
  why() {
    if (this.vr > 8) return 'Por qué: vas HACIA la estrella → chocas con más ondas por segundo → más agudo';
    if (this.vr < -8) return 'Por qué: te ALEJAS → las ondas tardan en alcanzarte → te llegan menos → más grave';
    return 'Por qué: no te acercas ni te alejas → te llegan al ritmo normal → 400 Hz';
  },
  init() {
    P.x = 110; P.y = 320; P.vx = P.vy = 0; P.ang = 0;
    this.base = 400;
    this.need = 1.0;
    this.src = { x: 450, y: 320, vx: 0, vy: 0 };
    this.locks = [
      { lo: 440, hi: Infinity, label: '>440', tip: 'Acércate a la estrella: el tono sube.' },
      { lo: 0, hi: 360, label: '<360', tip: 'Ahora ALÉJATE de la estrella: el tono baja.' },
      { lo: 480, hi: 580, label: '480-580', tip: 'Acércate DESPACIO: si vas muy rápido te pasas.' },
    ];
    this.i = 0; this.hold = 0; this.portal = null; this.ringT = 0; this.coach = ''; this.dir = 0; this.ok = false;
  },
  update(dt) {
    movePlayer(dt, 300);
    solid(this.src, 42);
    emitEvery(this, this.src, '240,205,140', dt);
    this.heard = doppler(this.base, this.src, P);
    this.vr = radial(this.src, P).vo;
    const lk = this.locks[this.i];
    this.ok = false; this.dir = 0;
    if (lk) {
      const co = coachFor(this.heard, lk.lo, lk.hi, this.vr, this.base, 'la estrella');
      this.ok = co.ok; this.dir = co.dir; this.coach = co.text;
      this.hold = holdStep(this.ok, this.hold, dt);
      if (this.hold >= this.need) {
        burst(P.x, P.y); chime(); say(`¡Cerradura ${this.i + 1} de 3 abierta!`, 2, COL.sageD);
        this.i++; this.hold = 0;
        if (this.i >= this.locks.length) { this.portal = { x: 820, y: 170 }; say('Se abrió el portal → arriba a la derecha', 3); }
      }
    }
    const d = dist(P, this.src);
    setAudio(this.heard, Math.min(1, Math.max(.2, 140 / (d + 40))), 0);
    return this.portal && dist(P, this.portal) < 30;
  },
  draw() {
    const s = this.src, d = dist(P, s) || 1;
    sightLine(P, s, this.vr);
    drawStarBuddy(s.x, s.y, time, { x: (P.x - s.x) / d, y: (P.y - s.y) / d });
    labelStack(s, 56, [{ text: 'la estrella · 400 Hz', font: '17px ' + HAND, color: COL.amberD }]);
    if (!this.portal) guideArrow(P, s, this.dir);
    if (this.locks[this.i]) labelStack(P, 28, [coachItem(this), waveItem(this)], BOT - 8, true);
  },
  hud() {
    const lk = this.locks[this.i];
    return {
      heard: this.heard, base: this.base, lo: lk && lk.lo, hi: lk && lk.hi, hold: this.hold, need: this.need, ok: this.ok,
      step: `paso ${Math.min(this.i + 1, 3)} de 3`, tip: lk ? lk.tip : 'Todas abiertas. Ve al portal verde.',
      who: 'oyes', goal: lk ? lk.label + ' Hz' : '', why: this.why(),
      steps: this.locks.map((l, k) => ({ label: l.label, done: k < this.i, cur: k === this.i })), icon: 'lock',
    };
  },
},
{
  name: 'Nivel 2 · Cristales',
  brief: {
    role: 'Ahora tú SUENAS (300 Hz) y los cristales escuchan.',
    goal: 'Activa 3 cristales receptores: cada uno mide un tono.',
    rules: [
      [COL.sky, 'Vuela hacia el cristal → lo oye más AGUDO'],
      [COL.rust, 'Aléjate del cristal → lo oye más GRAVE'],
      [COL.amber, 'Si vas hacia él a más de 250 px/s, le llega un boom'],
    ],
  },
  ringEvery: ringEveryFor(300),
  listener() { return this.crystals[this.i] || null; },
  why() {
    if (!this.crystals[this.i]) return '';
    if (this.vr > 8) return 'Por qué: vas hacia el cristal → le sueltas las ondas más juntas → más agudo';
    if (this.vr < -8) return 'Por qué: te alejas → le sueltas las ondas más separadas → más grave';
    return 'Por qué: no te acercas ni te alejas → le llegan al ritmo normal → 300 Hz';
  },
  init() {
    P.x = 450; P.y = 320; P.vx = P.vy = 0; P.ang = 0;
    this.base = 300;
    this.need = 1.0;
    this.crystals = [
      { x: 780, y: 320, lo: 360, hi: Infinity, label: '>360', tip: 'Vuela HACIA el cristal que brilla.' },
      { x: 820, y: 470, lo: 0, hi: 250, label: '<250', tip: 'Ahora vuela ALEJÁNDOTE del cristal que brilla.' },
      { x: 120, y: 175, lo: 370, hi: 460, label: '370-460', tip: 'Vuela hacia el cristal sin prisa: ni muy rápido ni muy lento.' },
    ].map(c => Object.assign({ vx: 0, vy: 0, hold: 0, done: false, heard: 0 }, c));
    this.i = 0; this.portal = null; this.ringT = 0; this.supersonic = false; this.shockCd = 0; this.coach = ''; this.dir = 0; this.ok = false;
  },
  update(dt) {
    movePlayer(dt, 340);
    this.crystals.forEach(c => solid(c, 30));
    const c = this.crystals[this.i];
    emitEvery(this, P, '170,205,225', dt, !!c && radial(P, c).vs >= C);
    this.shockCd = Math.max(0, this.shockCd - dt);

    if (speed() > C && !this.supersonic) say('Vas más rápido que el sonido: tus ondas forman un cono', 2.4, COL.rustD);
    this.supersonic = speed() > C;

    this.ok = false; this.dir = 0;
    if (c) {
      c.heard = doppler(this.base, P, c);
      this.vr = radial(P, c).vs;
      const co = coachFor(c.heard, c.lo, c.hi, this.vr, this.base, 'el cristal');
      this.ok = co.ok; this.dir = co.dir; this.coach = co.text;
      c.hold = holdStep(this.ok, c.hold, dt);
      if (c.hold >= this.need) {
        c.done = true; burst(c.x, c.y); chime(); say(`¡Cristal ${this.i + 1} de 3 activado!`, 2, COL.sageD);
        this.i++;
        if (this.i >= this.crystals.length) { this.portal = { x: 450, y: 165 }; say('Se abrió el portal → arriba al centro', 3); }
      }
      const d = dist(P, c);
      setAudio(c.heard, Math.min(1, Math.max(.25, 160 / (d + 40))), 0);
    } else setAudio(this.base, .3, 0);
    return this.portal && dist(P, this.portal) < 30;
  },
  onShock() {
    if (this.shockCd > 0) return;
    this.shockCd = 2; boomSound(); shake = 0.5;
    say('¡BOOM! El cono de choque llegó al cristal', 2.4, COL.rustD);
    const c = this.crystals[this.i]; if (c) c.hold = 0;
  },
  draw() {
    const c = this.crystals[this.i];
    if (c) sightLine(P, c, this.vr);
    this.crystals.forEach((c, k) => {
      if (c.done) {
        drawCrystal(c.x, c.y, time, 'done', k + 1);
        labelStack(c, 24, [{ text: 'midió ' + c.label + ' Hz', font: '15px ' + HAND, color: COL.sageD }]);
        return;
      }
      const active = k === this.i;
      drawCrystal(c.x, c.y, time, active ? 'active' : 'next', k + 1);
      if (!active) { labelStack(c, 24, [{ text: 'después', font: '15px ' + HAND, color: COL.ink2 }]); return; }
      holdRing(c.x, c.y - 3, 44, c.hold / this.need);
      labelStack(c, 48, [
        { text: 'quiere ' + c.label + ' Hz', font: 'bold 14px ' + BODY, color: COL.sageD },
        { text: isFinite(c.heard) ? 'oye ' + fmt(c.heard) + ' Hz' : 'aún no le llega nada', font: '14px ' + BODY, color: toneInk(c.heard, this.base) },
        waveItem(this),
      ], BOT - 8, true);
    });
    if (!c) return;
    guideArrow(P, c, this.dir);
    const it = coachItem(this);
    if (speed() > 200) { it.text = speed() > C ? 'vas más rápido que el sonido (250 px/s)' : '¡cuidado! casi vas a la velocidad del sonido'; it.color = COL.rustD; }
    labelStack(P, 28, [it], BOT - 8, true);
  },
  hud() {
    const c = this.crystals[this.i];
    return {
      heard: c ? c.heard : this.base, base: this.base, lo: c && c.lo, hi: c && c.hi, hold: c ? c.hold : 0, need: this.need, ok: this.ok,
      step: `cristal ${Math.min(this.i + 1, 3)} de 3`, tip: c ? c.tip : 'Todos activados. Ve al portal verde.',
      who: 'el cristal oye', goal: c ? c.label + ' Hz' : '', why: this.why(),
      steps: this.crystals.map((c, k) => ({ label: c.label, done: c.done, cur: k === this.i })), icon: 'crystal',
    };
  },
},
{
  name: 'Nivel 3 · El Cometa',
  brief: {
    role: 'El cometa suena a 350 Hz y no para. Tú también te mueves.',
    goal: 'Abre 3 cerraduras sumando tu movimiento y el suyo.',
    rules: [
      [COL.sky, 'Flecha AZUL: el cometa viene hacia ti → más agudo'],
      [COL.rust, 'Flecha ROJIZA: el cometa se va → más grave'],
      [COL.amber, 'Si chocas con el cometa, pierdes el progreso'],
    ],
  },
  ringEvery: ringEveryFor(350),
  listener() { return P; },
  why() {
    const r = radial(this.src, P);
    const him = r.vs > 8 ? 'el cometa VIENE' : r.vs < -8 ? 'el cometa SE VA' : 'el cometa va de lado';
    const you = r.vo > 8 ? 'tú VAS hacia él' : r.vo < -8 ? 'tú te ALEJAS' : 'tú vas de lado';
    const res = this.heard > this.base * 1.02 ? 'más agudo' : this.heard < this.base * 0.98 ? 'más grave' : 'tono real';
    return `Por qué: ${him} y ${you} → se suman → ${res}`;
  },
  init() {
    P.x = 450; P.y = 470; P.vx = P.vy = 0; P.ang = 0;
    this.base = 350;
    this.need = 1.0;
    this.src = { x: 200, y: 220, vx: 90, vy: 55 };
    this.speeds = [90, 100, 110];
    this.locks = [
      { lo: 330, hi: 370, minSpeed: 70, mirror: true, label: '330-370', tip: 'Vuela IGUAL que el cometa (copia la flecha naranja).' },
      { lo: 580, hi: 760, label: '580-760', tip: 'Ponte DE FRENTE al cometa cuando venga hacia ti.' },
      { lo: 170, hi: 225, label: '170-225', tip: 'Cuando el cometa se aleje, aléjate tú también.' },
    ];
    this.i = 0; this.hold = 0; this.portal = null; this.ringT = 0; this.coach = ''; this.hitCd = 0; this.dir = 0; this.ok = false;
  },
  update(dt) {
    movePlayer(dt, 300);
    const s = this.src;
    const sp = this.speeds[Math.min(this.i, 2)], v = Math.hypot(s.vx, s.vy) || 1;
    s.vx *= sp / v; s.vy *= sp / v;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x < 60) { s.x = 60; s.vx = Math.abs(s.vx); }
    if (s.x > W - 60) { s.x = W - 60; s.vx = -Math.abs(s.vx); }
    if (s.y < 150) { s.y = 150; s.vy = Math.abs(s.vy); }
    if (s.y > 490) { s.y = 490; s.vy = -Math.abs(s.vy); }
    this.hitCd -= dt;
    if (dist(P, s) < 34) {
      solid(s, 34);
      if (this.hitCd <= 0) { this.hitCd = 1; this.hold = 0; shake = 0.3; say('¡Chocaste con el cometa! progreso perdido', 1.8, COL.rustD); }
    }
    emitEvery(this, s, '235,165,105', dt);
    this.heard = doppler(this.base, s, P);
    this.vr = radial(s, P).vo;
    const lk = this.locks[this.i];
    this.ok = false; this.dir = 0;
    if (lk) {
      const co = coachFor(this.heard, lk.lo, lk.hi, this.vr, this.base, 'el cometa');
      this.ok = co.ok; this.dir = co.dir; this.coach = co.text;
      if (co.ok && lk.minSpeed && speed() < lk.minSpeed) { this.ok = false; this.coach = 'tono bien; ahora muévete como el cometa'; }
      this.hold = holdStep(this.ok, this.hold, dt);
      if (this.hold >= this.need) {
        burst(P.x, P.y); chime(); say(`¡Cerradura ${this.i + 1} de 3 abierta!`, 2, COL.sageD);
        this.i++; this.hold = 0;
        if (this.i >= this.locks.length) { this.portal = { x: 820, y: 170 }; say('Se abrió el portal → arriba a la derecha', 3); }
      }
    }
    setAudio(this.heard, Math.min(1, Math.max(.2, 140 / (dist(P, s) + 40))), 0);
    return this.portal && dist(P, this.portal) < 30;
  },
  draw() {
    const s = this.src, r = radial(s, P), lk = this.locks[this.i], d = dist(P, s) || 1;
    sightLine(P, s, this.vr);
    drawComet(s.x, s.y, s.vx, s.vy, time, { x: (P.x - s.x) / d, y: (P.y - s.y) / d });
    const mov = r.vs > 8 ? 'viene' : r.vs < -8 ? 'se va' : 'de lado';
    drawArrow(s.x, s.y, s.vx, s.vy, r.vs > 8 ? COL.sky : r.vs < -8 ? COL.rust : COL.cream, 28);
    labelStack(s, 30, [{ text: 'el cometa · 350 Hz · ' + mov, font: '16px ' + HAND, color: COL.amberD }], BOT - 8, true);
    if (lk && lk.mirror) drawArrow(P.x, P.y, s.vx, s.vy, COL.amber, 22);
    if (!this.portal) guideArrow(P, s, this.dir);
    if (lk) labelStack(P, 28, [
      coachItem(this),
      lk.minSpeed ? { text: `tu velocidad: ${speed().toFixed(0)} (mínimo ${lk.minSpeed})`, font: '13px ' + BODY, color: speed() >= lk.minSpeed ? COL.sageD : COL.amberD } : {},
      waveItem(this),
    ], BOT - 8, true);
  },
  hud() {
    const lk = this.locks[this.i];
    return {
      heard: this.heard, base: this.base, lo: lk && lk.lo, hi: lk && lk.hi, hold: this.hold, need: this.need, ok: this.ok,
      step: `paso ${Math.min(this.i + 1, 3)} de 3`, tip: lk ? lk.tip : 'Todas abiertas. Ve al portal verde.',
      who: 'oyes', goal: lk ? lk.label + ' Hz' : '', why: this.why(),
      steps: this.locks.map((l, k) => ({ label: l.label, done: k < this.i, cur: k === this.i })), icon: 'lock',
    };
  },
}
];

// explicación animada
const TAPE_S = 3;
let sim = null, tut = null;

function simReset(o) {
  sim = {
    mode: o.mode, base: o.base, every: o.every, rgb: o.rgb, ticks: o.ticks !== false,
    src: Object.assign({ vx: 0, vy: 0 }, o.src),
    lis: Object.assign({ vx: 0, vy: 0 }, o.lis),
    rings: [], emits: [], hits: [], t: 0, nextEmit: 0, epoch: 0,
    last: null, heard: 0, pulse: 0, boomReady: true, flash: 0, boomText: 0,
  };
  if (o.warm) {
    const s = sim, v = [s.src.vx, s.src.vy, s.lis.vx, s.lis.vy];
    if (o.warmStill) s.src.vx = s.src.vy = s.lis.vx = s.lis.vy = 0;
    else { s.src.x -= v[0] * o.warm; s.src.y -= v[1] * o.warm; s.lis.x -= v[2] * o.warm; s.lis.y -= v[3] * o.warm; }
    s.silent = true;
    for (let k = 0, n = Math.round(o.warm * 60); k < n; k++) simStep(1 / 60, null);
    s.silent = false; s.pulse = 0;
    [s.src.vx, s.src.vy, s.lis.vx, s.lis.vy] = v;
  }
}
function simTeleportListener(x, y) {
  const s = sim;
  s.lis.x = x; s.lis.y = y; s.last = null;
  for (const r of s.rings) r.prev = (s.t - r.t0) * C - Math.hypot(x - r.x, y - r.y);
}
function simTeleportSource(x, y) { sim.src.x = x; sim.src.y = y; sim.epoch++; sim.boomReady = true; }

function simStep(dt, onHit) {
  const s = sim, tPrev = s.t;
  s.t += dt;
  s.src.x += s.src.vx * dt; s.src.y += s.src.vy * dt;
  s.lis.x += s.lis.vx * dt; s.lis.y += s.lis.vy * dt;
  while (s.nextEmit <= s.t) {
    const back = s.t - s.nextEmit;
    s.rings.push({ x: s.src.x - s.src.vx * back, y: s.src.y - s.src.vy * back, t0: s.nextEmit, epoch: s.epoch, id: ringId++ });
    s.emits.push(s.nextEmit);
    s.nextEmit += s.every;
  }
  for (const r of s.rings) {
    const side = (s.t - r.t0) * C - Math.hypot(s.lis.x - r.x, s.lis.y - r.y);
    if (r.prev < 0 && side >= 0) {
      const tHit = tPrev + dt * (-r.prev) / (side - r.prev);
      s.hits.push(tHit); s.pulse = 1;
      const L = s.last;
      if (L && r.epoch === L.epoch && r.t0 > L.t0 && tHit > L.tHit + 1e-4)
        s.heard = s.base * (r.t0 - L.t0) / (tHit - L.tHit);
      if (!L || r.epoch !== L.epoch || r.t0 > L.t0) s.last = { t0: r.t0, tHit, epoch: r.epoch };
      if (onHit) onHit(r); else if (s.ticks && !s.silent) tick();
    }
    r.prev = side;
  }
  s.rings = s.rings.filter(r => (s.t - r.t0) * C < 1200);
  s.hits = s.hits.filter(t => s.t - t < TAPE_S);
  s.emits = s.emits.filter(t => s.t - t < TAPE_S);
  s.pulse = Math.max(0, s.pulse - dt * 5);
  s.flash = Math.max(0, s.flash - dt * 2);
  s.boomText = Math.max(0, s.boomText - dt);
}

const sceneA = (lis, extra) => Object.assign({ mode: 'A', base: 400, every: ringEveryFor(400), rgb: '240,205,140', src: { x: 280, y: 300 }, lis }, extra);
const sceneB = (src, lis, extra) => Object.assign({ mode: 'B', base: 300, every: ringEveryFor(300), rgb: '170,205,225', src, lis }, extra);
const sceneC = (src, lis, extra) => Object.assign({ mode: 'C', base: 350, every: ringEveryFor(350), rgb: '235,165,105', src, lis }, extra);
const TUT = [
  [
    {
      cap: 'El sonido son ondas que viajan por el gas de la nebulosa.',
      sub: 'La estrella suelta ondas a un ritmo fijo. Cada anillo dibujado representa 40 ondas (400 Hz = 10 anillos por segundo) y suena como un clic al tocar tu nave. Si estás quieto, te llegan al mismo ritmo al que salen: oyes el tono real, 400 Hz.',
      setup() { simReset(sceneA({ x: 640, y: 300 }, { warm: 2 })); },
    },
    {
      cap: 'Si vas HACIA la estrella → el tono sube (más AGUDO).',
      sub: 'Vas al encuentro de las ondas, así que te tocan más seguido. Mira la cinta de abajo: las rayitas salen más juntas. Más ondas por segundo = más agudo.',
      setup() { simReset(sceneA({ x: 840, y: 300, vx: -110 }, { warm: 2.6 })); },
      step() { if (sim.lis.x < 380) simTeleportListener(840, 300); },
    },
    {
      cap: 'Si te ALEJAS de la estrella → el tono baja (más GRAVE).',
      sub: 'Cada onda tiene que perseguirte y tarda más en tocarte. Las rayitas salen más separadas. Menos ondas por segundo = más grave.',
      setup() { simReset(sceneA({ x: 380, y: 300, vx: 110 }, { warm: 1, warmStill: true })); },
      step() { if (sim.lis.x > 860) simTeleportListener(380, 300); },
    },
    {
      cap: 'Resumen: acercarte = agudo · alejarte = grave.',
      sub: 'Cuanto más rápido te mueves, más cambia el tono. En el nivel 1 vas a abrir cerraduras logrando tonos concretos. Clic o Enter para continuar.',
      setup() { simReset(sceneA({ x: 600, y: 300 }, { warm: 1.6, warmStill: true })); },
      step() { sim.lis.vx = 150 * Math.cos(0.9 * sim.t); },
    },
  ],
  [
    {
      cap: 'Ahora TÚ suenas y el cristal escucha.',
      sub: 'Cada onda sale desde donde está tu nave en ese momento. Por delante quedan apretadas: el cristal las recibe más seguido y oye AGUDO. Cuando ya lo pasaste, le llegan estiradas y oye GRAVE. Igual que la sirena de una ambulancia.',
      setup() { simReset(sceneB({ x: 60, y: 240, vx: 130 }, { x: 450, y: 330 }, { warm: 3.8 })); },
      step() { if (sim.src.x > 1000) simTeleportSource(60, 240); },
    },
    {
      cap: 'Cuidado: si vas más rápido que el sonido, ¡BOOM!',
      sub: 'Alcanzas tus propias ondas y se amontonan en un solo frente (el cono). El cristal no oye nada hasta que el cono le llega de golpe. Ojo: el boom no pasa solo al "romper la barrera"; el cono va contigo todo el tiempo y cada quien lo oye cuando le pasa encima.',
      mute: true,
      setup() { simReset(sceneB({ x: -150, y: 190, vx: 425 }, { x: 450, y: 395 }, { ticks: false })); this.wait = 0; },
      step(dt) { if (sim.src.x > 1050 && (this.wait += dt) > 3) { this.wait = 0; simTeleportSource(-150, 190); } },
      onHit(r) {
        if (sim.boomReady && r.epoch === sim.epoch) { sim.boomReady = false; boomSound(); shake = 0.6; sim.flash = 1; sim.boomText = 1.6; }
      },
    },
    {
      cap: 'Resumen: vuela hacia el cristal = oye agudo · aléjate = oye grave.',
      sub: 'En el nivel 2 cada cristal es un receptor (como el de un micrófono) y se activa cuando mide el tono que pide. Clic o Enter para continuar.',
      setup() { simReset(sceneB({ x: 380, y: 300 }, { x: 820, y: 300 }, { warm: 2, warmStill: true })); },
      step() { sim.src.vx = 140 * Math.cos(0.8 * sim.t); },
    },
  ],
  [
    {
      cap: 'Ahora los DOS se mueven: el cometa suena y tú escuchas.',
      sub: 'Si van de frente, los efectos se suman: él te aprieta las ondas y tú chocas contra ellas → MUY agudo. Cuando se cruzan y se alejan los dos → MUY grave.',
      setup() { simReset(sceneC({ x: 130, y: 260, vx: 80 }, { x: 770, y: 340, vx: -80 }, { warm: 4.3 })); },
      step() { if (sim.src.x > 820) this.setup(); },
    },
    {
      cap: 'Truco: al lado del cometa, a su misma velocidad, oyes el tono real.',
      sub: 'Él aprieta las ondas por delante, pero tú te alejas de ellas igual de rápido: se cancela y oyes 350 Hz. (La cámara los sigue; los puntos son el gas quieto.)',
      follow: true,
      setup() { simReset(sceneC({ x: 250, y: 300, vx: 100 }, { x: 560, y: 300, vx: 100 }, { warm: 3 })); },
    },
    {
      cap: 'Resumen: tu movimiento y el del cometa se suman.',
      sub: 'Viene él o vas tú → más agudo. Se va él o te vas tú → más grave. Mira la flecha del cometa: azul = viene hacia ti, rojiza = se va. Clic o Enter para continuar.',
      setup() { simReset(sceneC({ x: 400, y: 300 }, { x: 800, y: 300 }, { warm: 2, warmStill: true })); },
      step() { sim.src.vx = 140 * Math.cos(0.7 * sim.t); },
    },
  ],
];

function startTut(level) {
  state = 'tut'; ov.hidden = true; shake = 0;
  tut = { scenes: TUT[level], i: 0, level };
  tut.scenes[0].setup();
}
function nextTut() {
  if (++tut.i >= tut.scenes.length) return endTut();
  tut.scenes[tut.i].setup();
}
function endTut() { shake = 0; loadLevel(tut.level); state = 'brief'; setAudio(0, 0, 0); }
function play() { state = 'play'; say(lvl.name, 1.8, COL.ink, true); }
function tutFrame(dt) {
  const sc = tut.scenes[tut.i];
  shake = Math.max(0, shake - dt);
  simStep(dt, sc.onHit ? r => sc.onHit(r) : null);
  if (sc.step) sc.step(dt);
  for (const o of [sim.src, sim.lis]) {
    const want = Math.hypot(o.vx, o.vy) > 5 ? Math.atan2(o.vy, o.vx) : (o.ang ?? Math.PI);
    if (o.ang === undefined) o.ang = want;
    o.ang += Math.atan2(Math.sin(want - o.ang), Math.cos(want - o.ang)) * Math.min(1, dt * 8);
  }
  setAudio(sim.heard, sc.mute || !sim.heard ? 0 : 0.8, 0);
  drawTut();
}

function drawTut() {
  const s = sim, sc = tut.scenes[tut.i], src = s.src, lis = s.lis;
  const heard = sc.mute ? 0 : s.heard;
  const cx = sc.follow ? (src.x + lis.x) / 2 - W / 2 : 0;
  const sx = src.x - cx, lx = lis.x - cx;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 24 * shake, (Math.random() - .5) * 24 * shake);
  sky(tut.level, s.t);
  if (sc.follow) {
    ctx.fillStyle = 'rgba(247,238,219,.4)';
    for (let gx = Math.floor(cx / 60) * 60; gx < cx + W + 60; gx += 60)
      for (let gy = 180; gy <= 420; gy += 60) { ctx.beginPath(); ctx.arc(gx - cx + (hash(gx + gy) - .5) * 6, gy + (hash(gx * 2 + gy) - .5) * 6, 1.6, 0, 7); ctx.fill(); }
  }
  for (const r of s.rings) {
    const rad = (s.t - r.t0) * C;
    drawRing(r.x - cx, r.y, rad, s.rgb, Math.max(0, .62 - rad / 1300));
  }

  const rv = radial(src, lis), d = dist(src, lis) || 1, look = { x: (lis.x - src.x) / d, y: (lis.y - src.y) / d };
  const tag = (t, x, y, color) => fitText(t, x, y, '18px ' + HAND, color);
  if (s.mode === 'A') {
    drawStarBuddy(sx, src.y, s.t, look);
    tag('la estrella · 400 Hz', sx, src.y - 86, COL.gold);
  } else if (s.mode === 'C') {
    drawComet(sx, src.y, src.vx, src.vy, s.t, look);
    tag('el cometa · 350 Hz', sx, src.y - 40, COL.amber);
    drawArrow(sx, src.y, src.vx, src.vy, rv.vs > 0 ? COL.sky : COL.rust, 28);
  } else {
    drawShip(sx, src.y, src.ang ?? 0, Math.hypot(src.vx, src.vy) > 5 ? .6 : 0);
    tag('tú', sx, src.y - 30, COL.cream);
    drawArrow(sx, src.y, src.vx, src.vy, rv.vs > 0 ? COL.sky : COL.rust, 22);
  }
  if (s.mode === 'B') {
    drawCrystal(lx, lis.y, s.t, 'active', 1);
    tag('el cristal', lx, lis.y - 50, COL.lilac);
  } else {
    drawShip(lx, lis.y, lis.ang ?? Math.PI, Math.hypot(lis.vx, lis.vy) > 5 ? .6 : 0, s.pulse);
    tag('tú', lx, lis.y - 30, COL.cream);
    drawArrow(lx, lis.y, lis.vx, lis.vy, rv.vo > 0 ? COL.sky : COL.rust, 22);
  }
  if (s.pulse > 0) {
    sketchCircle(lx, lis.y, 20 + (1 - s.pulse) * 18, 77, 1.2);
    ctx.strokeStyle = `rgba(230,184,92,${s.pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
  }
  if (!sc.mute) fitText(heard ? `${s.mode === 'B' ? 'oye' : 'oyes'} ${heard.toFixed(0)} Hz` : '…', lx, lis.y + 58, '24px ' + HAND, heard ? toneSky(heard, s.base) : COL.cream);
  if (s.flash > 0) { ctx.fillStyle = `rgba(247,238,219,${s.flash * 0.45})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  if (s.boomText > 0) {
    ctx.globalAlpha = Math.min(1, s.boomText);
    fitText('¡BOOM!', lx, lis.y - 64, 'bold 58px ' + HAND, COL.rust);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.textAlign = 'left';
  const capF = touchMode ? 24 : 21, subF = touchMode ? 18 : 15.5, capH = capF + 5, subH = subF + 4.5;
  ctx.font = `bold ${capF}px ` + BODY; const capL = wrapLines(sc.cap, W - 150);
  ctx.font = `${subF}px ` + BODY; const subL = wrapLines(sc.sub, W - 72);
  paper(16, 12, W - 32, 50 + capL.length * capH + subL.length * subH, 101, { tape: [[70, 13, -.15], [W - 80, 14, .12]] });
  ctx.font = '17px ' + HAND; ctx.fillStyle = COL.rustD;
  ctx.fillText(`explicación · nivel ${tut.level + 1}`, 34, 40);
  tut.scenes.forEach((_, k) => {
    const dx = W - 104 - (tut.scenes.length - 1 - k) * 18;
    sketchCircle(dx, 34, k === tut.i ? 5.5 : 4.5, 60 + k, .5);
    ctx.fillStyle = k <= tut.i ? COL.ink : 'rgba(46,36,51,0)'; ctx.fill();
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; ctx.stroke();
  });
  let y = 68;
  ctx.font = `bold ${capF}px ` + BODY; ctx.fillStyle = COL.ink;
  for (const l of capL) { ctx.fillText(l, 34, y); y += capH; }
  ctx.font = `${subF}px ` + BODY; ctx.fillStyle = COL.ink2;
  for (const l of subL) { ctx.fillText(l, 34, y); y += subH; }

  const top = 446, x0 = 168, x1 = 752;
  const toX = t => x1 - (s.t - t) * (x1 - x0) / TAPE_S;
  paper(16, top, W - 32, H - top - 14, 202);
  const tapeTitle = 'la cinta: cada rayita es un anillo que llega — juntas = agudo, separadas = grave';
  ctx.textAlign = 'left'; fitFont(tapeTitle, '', 16 * FS, 12, W - 72, HAND); ctx.fillStyle = COL.ink2;
  ctx.fillText(tapeTitle, 34, top + 24);
  const row = (yy, label, times, color, value, valColor, seed) => {
    ctx.textAlign = 'left'; fitFont(label, 'bold', 15 * FS, 11, x0 - 44); ctx.fillStyle = COL.ink; ctx.fillText(label, 34, yy + 5);
    ctx.beginPath(); ctx.rect(x0, yy - 13, x1 - x0, 26); ctx.fillStyle = COL.paper2; ctx.fill();
    ctx.strokeStyle = 'rgba(46,36,51,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'butt';
    for (const t of times) {
      const x = Math.round(toX(t) * DPR) / DPR;
      if (x >= x0 + 3) { ctx.beginPath(); ctx.moveTo(x, yy - 9); ctx.lineTo(x, yy + 9); ctx.stroke(); }
    }
    ctx.font = '22px ' + HAND; ctx.fillStyle = valColor; ctx.fillText(value, x1 + 18, yy + 7);
  };
  const toneC = heard ? toneInk(heard, s.base) : COL.ink;
  row(top + 52, 'sin moverse', s.emits, COL.ink2, s.base + ' Hz', COL.ink2, 210);
  row(top + 90, s.mode === 'B' ? 'el cristal oye' : 'tú oyes', s.hits, toneC, sc.mute ? '—' : heard ? heard.toFixed(0) + ' Hz' : '…', toneC, 220);
  ctx.font = 'italic ' + fz(13) + BODY; ctx.fillStyle = COL.ink2; ctx.textAlign = 'center';
  ctx.fillText(touchMode ? 'toca la pantalla para seguir · ❚❚ para saltar' : 'clic, Enter o → para seguir · Esc para saltar', W / 2, H - 24);
  filmGrain();
}

// estado del juego
let cur = 0, lvl = levels[0], state = 'menu';
const knob = { x: null, v: 0 };
function loadLevel(i) {
  cur = i; lvl = levels[i]; rings = []; msgs = []; hits = []; sparks = []; puffs = []; knob.x = null;
  lvl.init();
  lvl.update(0);
}
const ov = document.getElementById('ov');
const $ = id => document.getElementById(id);
const portraitSmall = matchMedia('(orientation: portrait) and (max-width: 700px)');
const rotateOv = $('rotateOv'), pauseBtn = $('pauseBtn');

// registro, avisos y tabla de posiciones
const REGISTRO_URL = 'https://script.google.com/macros/s/AKfycbzV6WE7QlKHJJRXFl8W4X7INPeRjZJv_aPBPa2Xw04Z9ZrpavqYgUbFqlHF-f4JvWyv/exec';
const CORREO_OK = /^[a-z0-9._%+-]+@cbtis224\.edu\.mx$/;
const store = {
  get(k, d) { try { const v = localStorage.getItem('doppler.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('doppler.' + k, JSON.stringify(v)); } catch {} },
};
let player = store.get('jugador', null);
let run = null;

function sendRemote(data) {
  if (!REGISTRO_URL) return;
  const queue = store.get('pendientes', []);
  if (data) queue.push(data);
  store.set('pendientes', []);
  for (const d of queue)
    fetch(REGISTRO_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(d) })
      .catch(() => store.set('pendientes', [...store.get('pendientes', []), d]));
}
sendRemote();
async function remoteTop() {
  if (!REGISTRO_URL) return null;
  try { const r = await fetch(REGISTRO_URL + '?accion=tabla'); return await r.json(); } catch { return null; }
}
function localTop() {
  const best = {};
  for (const r of store.get('resultados', [])) if (!best[r.correo] || r.total < best[r.correo].total) best[r.correo] = r;
  return Object.values(best).sort((a, b) => a.total - b.total).slice(0, 10);
}
const fmtTime = sec => { const m = Math.floor(sec / 60); return `${m}:${(sec - m * 60).toFixed(1).padStart(4, '0')}`; };
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function boardHTML(rows, note) {
  const head = '<div class="card-h">Mejores tiempos</div>';
  if (!rows.length) return head + `<p>Todavía nadie termina los tres niveles.</p><p class="src">${note}</p>`;
  const me = r => player && r.nombre === player.nombre && r.grupo === player.grupo;
  return head + '<table><thead><tr><th>#</th><th>nombre</th><th>grupo</th><th class="t">tiempo</th></tr></thead><tbody>' +
    rows.map((r, i) => `<tr${me(r) ? ' class="me"' : ''}><td>${i + 1}</td><td>${esc(r.nombre)}</td><td>${esc(r.grupo)}</td><td class="t">${fmtTime(r.total)}</td></tr>`).join('') +
    `</tbody></table><p class="src">${note}</p>`;
}
async function renderBoard(el) {
  const rule = 'Gana quien termine los 3 niveles en menos tiempo (las explicaciones no cuentan).';
  el.innerHTML = boardHTML(localTop(), REGISTRO_URL ? 'Cargando la tabla del grupo…' : 'Resultados guardados en este dispositivo. ' + rule);
  if (!REGISTRO_URL) return;
  const remote = await remoteTop();
  el.innerHTML = remote ? boardHTML(remote, 'Tabla del grupo, en línea. ' + rule) : boardHTML(localTop(), 'Sin conexión: se muestran los resultados de este dispositivo. ' + rule);
}

const PANELS = ['intro', 'outro', 'reg', 'aviso', 'tabla', 'pausa'];
let panel = 'intro', avisoBack = 'intro';
function show(id) {
  if (id === 'aviso' && panel !== 'aviso') avisoBack = panel;
  panel = id;
  for (const k of PANELS) $(k).hidden = k !== id;
  document.querySelector('.ov-grid').classList.toggle('solo', id === 'outro' || id === 'aviso' || id === 'pausa');
  if (id === 'tabla') renderBoard($('boardMain'));
  if (id === 'reg') $('regErr').textContent = '';
  ov.scrollTop = 0;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-show]');
  if (t) { e.preventDefault(); show(t.dataset.show); }
});
$('avisoBack').onclick = () => show(avisoBack);
function updateWho() {
  $('who').hidden = !player;
  if (player) $('who').innerHTML = `Jugando como <b>${esc(player.nombre)}</b> (${esc(player.grupo)}) · <button class="linkbtn" id="logout">no soy yo</button>`;
}
$('who').addEventListener('click', e => {
  if (e.target.id !== 'logout') return;
  player = null; store.set('jugador', null); updateWho(); show('reg');
});
updateWho();
$('regForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target.elements, err = msg => { $('regErr').textContent = msg; };
  const nombre = f.nombre.value.trim().replace(/\s+/g, ' '), grupo = f.grupo.value.trim(), correo = f.correo.value.trim().toLowerCase();
  if (nombre.split(' ').length < 2) return err('Escribe tu nombre completo (nombre y apellido).');
  if (!grupo) return err('Escribe tu grupo.');
  if (!CORREO_OK.test(correo)) return err('Usa tu correo institucional: debe terminar en @cbtis224.edu.mx');
  if (!f.acepto.checked) return err('Para jugar, lee y acepta los avisos y términos.');
  player = { nombre, grupo, correo };
  store.set('jugador', player);
  const reg = { tipo: 'registro', ...player, fecha: new Date().toISOString() };
  store.set('registros', [...store.get('registros', []), reg]);
  sendRemote(reg);
  updateWho();
  begin();
});
if (location.hash === '#profe') $('csvBtn').hidden = false;
$('csvBtn').onclick = () => {
  const cell = v => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const rows = [['tipo', 'fecha', 'nombre', 'grupo', 'correo', 'total_s', 'nivel1_s', 'nivel2_s', 'nivel3_s']];
  for (const r of [...store.get('registros', []), ...store.get('resultados', [])]) rows.push([r.tipo, r.fecha, r.nombre, r.grupo, r.correo, r.total, r.n1, r.n2, r.n3]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
  a.download = 'doppler-lock-datos.csv'; a.click();
};

function begin() {
  if (!player) return show('reg');
  if (!audio) initAudio();
  audio.ac.resume();
  run = { t: [0, 0, 0], ranked: true };
  startTut(0);
  document.activeElement.blur();
}
$('startBtn').onclick = begin;
$('againBtn').onclick = begin;
function win() {
  state = 'win'; setAudio(0, 0, 0);
  if (run && run.ranked && player) {
    const total = run.t[0] + run.t[1] + run.t[2], r1 = v => Math.round(v * 10) / 10;
    const res = { tipo: 'resultado', ...player, total: r1(total), n1: r1(run.t[0]), n2: r1(run.t[1]), n3: r1(run.t[2]), fecha: new Date().toISOString() };
    store.set('resultados', [...store.get('resultados', []), res]);
    sendRemote(res);
    $('outroLead').textContent = `Pasaste los tres niveles en ${fmtTime(total)} (nivel 1: ${fmtTime(run.t[0])} · nivel 2: ${fmtTime(run.t[1])} · nivel 3: ${fmtTime(run.t[2])}).`;
  } else $('outroLead').textContent = 'Pasaste los tres niveles. Como saltaste niveles, este intento no cuenta para la tabla.';
  run = null;
  renderBoard($('boardOutro'));
  show('outro');
  ov.hidden = false;
}

document.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => command(b.dataset.cmd));
function toggleFS() {
  if (document.fullscreenElement) return document.exitFullscreen();
  $('wrap').requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
}
if (document.fullscreenEnabled) {
  $('fsBtn').hidden = $('pFs').hidden = false;
  $('fsBtn').onclick = toggleFS;
}

// pausa
let prevState = null;
function pauseGame() {
  if (state !== 'play' && state !== 'tut') return;
  prevState = state; state = 'pause'; setAudio(0, 0, 0);
  joy.id = brakeId = null; joy.ax = joy.ay = 0; for (const k in keys) keys[k] = false;
  const e = eqNow(prevState);
  tex(e.s || '\\text{—}', $('pausaEq'), true); tex(e.note, $('pausaNote'));
  const inTut = prevState === 'tut';
  $('pausaLvl').textContent = inTut ? `explicación · nivel ${tut.level + 1}` : lvl.name;
  $('pausaWhy').textContent = inTut ? tut.scenes[tut.i].cap : lvl.hud().why.replace(/^Por qué: /, '');
  $('pHelp').hidden = $('pRestart').hidden = inTut;
  $('pSkip').hidden = !inTut;
  show('pausa'); ov.hidden = false;
}
function resumeGame() {
  if (state !== 'pause') return;
  state = prevState; ov.hidden = true;
}
pauseBtn.onclick = () => { pauseBtn.blur(); pauseGame(); };
$('resumeBtn').onclick = resumeGame;
$('pHelp').onclick = () => { resumeGame(); command('KeyH'); };
$('pRestart').onclick = () => { resumeGame(); command('KeyR'); };
$('pSkip').onclick = () => { resumeGame(); endTut(); };
$('pFs').onclick = toggleFS;
$('pQuit').onclick = () => { state = 'menu'; run = null; rings = []; setAudio(0, 0, 0); show('intro'); ov.hidden = false; };

// dibujo
function drawFrame() {
  const h = lvl.hud();
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 24 * shake, (Math.random() - .5) * 24 * shake);
  sky(cur, time);

  rings = rings.filter(r => (time - r.t0) * C < 1100);
  const L = lvl.listener();
  for (const r of rings) {
    const rad = (time - r.t0) * C;
    if (L) {
      const side = rad - Math.hypot(L.x - r.x, L.y - r.y);
      if (r.prev < 0 && side >= 0) { pulse = 1; hits.push(time); if (r.sup && lvl.onShock) lvl.onShock(); }
      r.prev = side;
    }
    drawRing(r.x, r.y, rad, r.rgb, Math.max(0, .6 - rad / 1800));
  }

  if (lvl.portal) drawPortal(lvl.portal, time);
  hits = hits.filter(t => time - t < 2);
  const perSec = hits.length / 2;
  lvl.waveText = L ? `le llegan ${perSec.toFixed(1)} anillos/s × ${ONDAS_POR_ANILLO} ≈ ${(perSec * ONDAS_POR_ANILLO).toFixed(0)} Hz` : '';
  lvl.draw();

  if (L === P && h.lo !== undefined) holdRing(P.x, P.y, 28, h.hold / h.need);
  drawPuffs();
  drawShip(P.x, P.y, P.ang, P.thr, L === P ? pulse : 0);
  if (L && pulse > 0) {
    sketchCircle(L.x, L.y, 18 + (1 - pulse) * 16, 78, 1);
    ctx.strokeStyle = `rgba(230,184,92,${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    pulse = Math.max(0, pulse - 0.12);
  }
  drawSparks();
  ctx.restore();
  drawHud(h);
  drawMsgs();
  drawTouch();
  filmGrain();
}

function drawTouch() {
  if (!touchMode) return;
  const bx = W - 34, by = BOT - 30, on = brakeId !== null;
  ctx.save(); ctx.globalAlpha = on ? .95 : .5;
  sketchCircle(bx, by, 22, 91, 1); ctx.fillStyle = on ? COL.rust : 'rgba(239,227,200,.2)'; ctx.fill();
  ctx.strokeStyle = COL.cream; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.font = '16px ' + HAND; ctx.fillStyle = COL.cream; ctx.textAlign = 'center'; ctx.fillText('frenar', bx, by + 5);
  ctx.restore();
  if (joy.id === null) return;
  ctx.save(); ctx.globalAlpha = .6;
  sketchCircle(joy.ox, joy.oy, JOY_R, 92, 1.5); ctx.fillStyle = 'rgba(239,227,200,.15)'; ctx.fill();
  ctx.strokeStyle = COL.cream; ctx.lineWidth = 2; ctx.stroke();
  ctx.globalAlpha = .9;
  ctx.beginPath(); ctx.arc(joy.x, joy.y, 20, 0, 7); ctx.fillStyle = COL.amber; ctx.fill();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

function drawHud(h) {
  const rx = W - 196, hh = touchMode ? 106 : 86;
  paper(16, 10, W - 32, hh, 11, { tape: [[64, 11, -.14], [W - 74, 12, .1]] });
  ctx.textAlign = 'left';
  ctx.font = fz(19) + HAND; ctx.fillStyle = COL.rustD; ctx.fillText(lvl.name, 34, 37);
  const nw = ctx.measureText(lvl.name).width;
  ctx.font = fz(15) + HAND; ctx.fillStyle = COL.ink2; ctx.fillText('— ' + h.step, 34 + nw + 10, 37);
  fitFont(h.tip, 'bold', 20 * FS, 12, rx - 64); ctx.fillStyle = COL.ink; ctx.fillText(h.tip, 34, touchMode ? 65 : 62);
  if (touchMode) {
    ctx.font = 'italic 19px ' + BODY; let lines = wrapLines(h.why, rx - 60);
    if (lines.length > 2) { ctx.font = 'italic 16px ' + BODY; lines = wrapLines(h.why, rx - 60).slice(0, 2); }
    ctx.fillStyle = COL.ink2; lines.forEach((l, i) => ctx.fillText(l, 34, 88 + i * 20));
  } else { fitFont(h.why, 'italic', 14.5, 10, rx - 64); ctx.fillStyle = COL.ink2; ctx.fillText(h.why, 34, 83); }
  ctx.strokeStyle = 'rgba(46,36,51,.4)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(rx - 18, 22); ctx.quadraticCurveTo(rx - 14 + hash(boil) * 2, 52, rx - 19, 10 + hh); ctx.stroke();
  ctx.font = fz(17) + HAND; ctx.fillStyle = COL.ink2; ctx.fillText(h.who, rx, 34);
  const val = fmt(h.heard);
  ctx.font = 'bold ' + fz(36) + HAND; ctx.fillStyle = h.ok ? COL.sageD : toneInk(h.heard, h.base); ctx.fillText(val, rx, touchMode ? 74 : 68);
  const vw = ctx.measureText(val).width;
  ctx.font = fz(17) + HAND; ctx.fillStyle = COL.ink2; ctx.fillText('Hz', rx + vw + 6, touchMode ? 74 : 68);
  if (h.goal) { ctx.font = 'bold ' + fz(14) + BODY; ctx.fillStyle = COL.sageD; ctx.fillText('meta: ' + h.goal, rx, touchMode ? 100 : 87); }
  drawMeter(h);
}

function drawMeter(h) {
  const py = H - 66, mx = 136, mw = 356, my = py + 29;
  paper(16, py, W - 32, 56, 23, { tape: [[36, py + 4, -.6]] });
  const toX = f => mx + mw * (Math.log2(Math.max(f, 1) / h.base) + 1) / 2;
  whale(46, py + 24);
  ctx.textAlign = 'left';
  ctx.font = '17px ' + HAND; ctx.fillStyle = COL.rustD; ctx.fillText('grave', 74, py + 26);
  ctx.font = fz(12) + BODY; ctx.fillStyle = COL.ink2; ctx.fillText('alejarte', 74, py + 42);
  bird(522, py + 26);
  ctx.font = '17px ' + HAND; ctx.fillStyle = COL.skyD; ctx.fillText('agudo', 548, py + 26);
  ctx.font = fz(12) + BODY; ctx.fillStyle = COL.ink2; ctx.fillText('acercarte', 548, py + 42);

  roughRect(mx - 6, my - 9, mw + 12, 18, 61, 1.2);
  ctx.fillStyle = COL.paper2; ctx.fill();
  ctx.save(); ctx.clip();
  const gr = ctx.createLinearGradient(mx, 0, mx + mw, 0);
  gr.addColorStop(0, 'rgba(196,96,63,.55)'); gr.addColorStop(.5, 'rgba(239,227,200,0)'); gr.addColorStop(1, 'rgba(122,174,208,.6)');
  ctx.fillStyle = gr; ctx.fillRect(mx - 8, my - 10, mw + 16, 20);
  let za, zb;
  if (h.lo !== undefined) {
    za = Math.max(mx - 6, toX(h.lo)); zb = Math.min(mx + mw + 6, toX(Math.min(h.hi, h.base * 4)));
    ctx.fillStyle = h.ok ? 'rgba(143,181,122,.85)' : 'rgba(143,181,122,.5)'; ctx.fillRect(za, my - 10, zb - za, 20);
    ctx.save(); ctx.beginPath(); ctx.rect(za, my - 10, zb - za, 20); ctx.clip();
    ctx.strokeStyle = 'rgba(78,125,61,.75)'; ctx.lineWidth = 1.3;
    for (let xx = za - 20; xx < zb; xx += 6) { ctx.beginPath(); ctx.moveTo(xx, my + 10); ctx.lineTo(xx + 14, my - 10); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
  roughRect(mx - 6, my - 9, mw + 12, 18, 61, 1.2); ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.9; ctx.stroke();
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  [.5, .71, 1, 1.41, 2].forEach((m, i) => {
    const x = toX(h.base * m);
    ctx.beginPath(); ctx.moveTo(x, my + 8); ctx.lineTo(x, my + (m === 1 ? -8 : 2)); ctx.stroke();
  });
  ctx.font = fz(11.5) + BODY; ctx.fillStyle = COL.ink2; ctx.textAlign = 'center';
  for (const m of [.5, 1, 2]) ctx.fillText(h.base * m, toX(h.base * m), py + 51);
  if (za !== undefined) {
    const fx = Math.min(mx + mw - 26, Math.max(mx + 4, (za + zb) / 2 - 14));
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(fx, my - 9); ctx.lineTo(fx, py + 4); ctx.stroke();
    ctx.fillStyle = COL.sage; ctx.beginPath(); ctx.moveTo(fx, py + 4); ctx.lineTo(fx + 9, py + 7); ctx.lineTo(fx, py + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = '15px ' + HAND; ctx.fillStyle = COL.sageD; ctx.textAlign = 'left'; ctx.fillText('meta', fx + 12, py + 13);
  }
  const tx = Math.min(mx + mw, Math.max(mx, toX(h.heard)));
  if (knob.x === null) knob.x = tx;
  knob.v += (tx - knob.x) * .25; knob.v *= .62; knob.x += knob.v;
  ctx.save(); ctx.translate(knob.x, my); ctx.rotate(Math.max(-.4, Math.min(.4, knob.v * .04)));
  ctx.fillStyle = 'rgba(20,14,30,.3)'; ctx.beginPath(); ctx.ellipse(2.5, 13, 8, 2.6, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.quadraticCurveTo(-9, 1, -8, -5); ctx.arc(0, -5, 8, Math.PI, 0); ctx.quadraticCurveTo(9, 1, 0, 12); ctx.closePath();
  ctx.fillStyle = COL.gold; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.9; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,248,225,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -5, 5.2, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  ctx.fillStyle = h.ok ? COL.sage : h.heard > h.base * 1.02 ? COL.sky : h.heard < h.base * .98 ? COL.rust : COL.cream;
  ctx.beginPath(); ctx.arc(0, -5, 3, 0, 7); ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();

  h.steps.forEach((s, k) => {
    const w = 82, x = 622 + k * 88, y = py + 8;
    ctx.save(); ctx.translate(x + w / 2, y + 20); ctx.rotate((hash(k + 40) - .5) * .09);
    paper(-w / 2, -19, w, 38, 300 + k, { sh: 2, j: 1.2, fill: s.done ? '#dfe8c9' : s.cur ? '#f7eedb' : '#ddd0b2' });
    if (h.icon === 'crystal') {
      ctx.beginPath(); ctx.moveTo(-26, 9); ctx.lineTo(-31, -2); ctx.lineTo(-26, -12); ctx.lineTo(-21, -2); ctx.closePath();
      ctx.fillStyle = s.done ? COL.sage : s.cur ? COL.lilac : 'rgba(180,154,209,.35)'; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6; ctx.stroke();
    } else drawLock(-26, -4, s.done, s.done ? COL.sage : s.cur ? COL.gold : '#b9a98a');
    ctx.textAlign = 'left'; fitFont(s.label, 'bold', 13.5 * FS, 10, 54); ctx.fillStyle = s.cur || s.done ? COL.ink : COL.ink2; ctx.fillText(s.label, -14, 5);
    if (s.done) {
      ctx.strokeStyle = COL.sageD; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(22, -2); ctx.lineTo(27, 5); ctx.lineTo(36, -10); ctx.stroke();
    }
    ctx.restore();
  });
}

function drawMsgs() {
  let y = 178;
  for (const m of msgs) {
    const a = Math.max(0, Math.min(1, m.t / 0.5, (m.dur - m.t) / 0.2));
    if (m.big) fitFont(m.text, 'bold', 34, 14, W - 160, HAND); else fitFont(m.text, 'bold', 17 * FS, 11, W - 160);
    const tw = ctx.measureText(m.text).width, bh = m.big ? 54 : 36 * FS, bw = tw + 46, n = 12;
    const drop = (1 - Math.min(1, (m.dur - m.t) / 0.3)) * -12, seed = hstr(m.text);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y + drop); ctx.rotate((hash(seed) - .5) * .05);
    const ribbon = (ox, oy) => {
      ctx.beginPath(); ctx.moveTo(-bw / 2 - n + ox, -bh / 2 + oy); ctx.lineTo(bw / 2 + n + ox, -bh / 2 + oy); ctx.lineTo(bw / 2 + ox, oy);
      ctx.lineTo(bw / 2 + n + ox, bh / 2 + oy); ctx.lineTo(-bw / 2 - n + ox, bh / 2 + oy); ctx.lineTo(-bw / 2 + ox, oy); ctx.closePath();
    };
    ribbon(4, 5); ctx.fillStyle = 'rgba(8,6,18,.4)'; ctx.fill();
    ribbon(0, 0); ctx.fillStyle = COL.paper; ctx.fill();
    ctx.save(); ctx.globalAlpha = a * .6; ctx.fillStyle = PAPER_GRAIN; ctx.fill(); ctx.restore();
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = m.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m.text, 0, 2);
    ctx.restore(); ctx.textBaseline = 'alphabetic';
    y += bh + 12;
  }
}

function drawBrief() {
  drawFrame();
  const b = lvl.brief, cw = 620, ch = touchMode ? 400 : 348, x = (W - cw) / 2, y = (H - ch) / 2 + 6;
  ctx.fillStyle = 'rgba(12,10,26,.55)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.012); ctx.translate(-W / 2, -H / 2);
  paper(x, y, cw, ch, 77, { tape: [[W / 2 - 120, y + 2, -.08], [W / 2 + 130, y + 3, .1]] });
  ctx.textAlign = 'left';
  ctx.font = '18px ' + HAND; ctx.fillStyle = COL.rustD; ctx.fillText('antes de empezar…', x + 36, y + 44);
  ctx.font = 'bold 40px ' + HAND; ctx.fillStyle = COL.ink; ctx.fillText(lvl.name, x + 34, y + 88);
  fitFont(b.role, '', 17 * FS, 12, cw - 72); ctx.fillStyle = COL.ink2; ctx.fillText(b.role, x + 36, y + 120);
  fitFont(b.goal, 'bold', 17 * FS, 12, cw - 170); const gw = ctx.measureText(b.goal).width;
  ctx.strokeStyle = 'rgba(143,181,122,.65)'; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 128, y + 160); ctx.quadraticCurveTo(x + 128 + gw / 2, y + 156 + hash(boil) * 2, x + 140 + gw, y + 159); ctx.stroke();
  ctx.fillStyle = COL.ink; ctx.fillText(b.goal, x + 134, y + 165);
  ctx.font = '17px ' + HAND; ctx.fillStyle = COL.sageD; ctx.fillText('objetivo:', x + 36, y + 165);
  b.rules.forEach(([color, text], k) => {
    const ry = y + 210 + k * 34 * FS;
    sketchCircle(x + 46, ry - 5, 6.5, 500 + k, .8); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6; ctx.stroke();
    fitFont(text, '', 16.5 * FS, 12, cw - 100); ctx.fillStyle = COL.ink; ctx.fillText(text, x + 64, ry);
  });
  if (touchMode) {
    const t = 'izquierda: arrastra para moverte · derecha: mantén para frenar · ❚❚ pausa';
    fitFont(t, 'italic', 18, 11, cw - 72); ctx.fillStyle = COL.ink2; ctx.fillText(t, x + 36, y + 324);
  }
  const bob = Math.sin(performance.now() / 260) * 2, bw = 290, bx = W / 2 - bw / 2, by = y + ch - 58 + bob;
  roughRect(bx + 4, by + 4, bw, 40, 88, 1.6); ctx.fillStyle = COL.ink; ctx.fill();
  roughRect(bx, by, bw, 40, 88, 1.6); ctx.fillStyle = COL.amber; ctx.fill(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.font = 'bold 20px ' + HAND; ctx.fillStyle = COL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(touchMode ? '¡Toca para empezar!' : '¡Enter o clic para empezar!', W / 2, by + 21); ctx.textBaseline = 'alphabetic';
  ctx.restore();
  filmGrain();
}

let ambT = 0;
function drawAmbient(dt) {
  time += dt;
  if ((ambT -= dt) <= 0) { ambT = ringEveryFor(400); emitRing({ x: 680, y: 300 }, '240,205,140'); }
  rings = rings.filter(r => (time - r.t0) * C < 1100);
  sky(0, time);
  for (const r of rings) { const rad = (time - r.t0) * C; drawRing(r.x, r.y, rad, r.rgb, Math.max(0, .5 - rad / 2000)); }
  drawStarBuddy(680, 300, time, { x: Math.cos(time * .5), y: Math.sin(time * .7) * .6 });
  filmGrain();
}

// loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  boil = Math.floor(now / 125);
  const needRotate = touchMode && portraitSmall.matches && (state === 'play' || state === 'tut' || state === 'brief');
  if (rotateOv.hidden === needRotate) rotateOv.hidden = !needRotate;
  const showPause = state === 'play' || state === 'tut';
  if (pauseBtn.hidden === showPause) pauseBtn.hidden = !showPause;
  if (needRotate) { setAudio(0, 0, 0); requestAnimationFrame(frame); return; }
  if (state === 'play') {
    time += dt;
    shake = Math.max(0, shake - dt);
    msgs.forEach(m => m.t -= dt); msgs = msgs.filter(m => m.t > 0);
    if (run) run.t[cur] += dt;
    const done = lvl.update(dt);
    drawFrame();
    if (done) { if (cur + 1 < levels.length) startTut(cur + 1); else win(); }
  } else if (state === 'tut') tutFrame(dt);
  else if (state === 'brief') drawBrief();
  else if (state !== 'pause') drawAmbient(dt);
  updateEq(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

new ResizeObserver(() => ov.style.setProperty('--k', cv.clientWidth / W)).observe(cv);

// fórmulas en latex
const tex = (src, el, block = false) => {
  if (window.katex) katex.render(src, el, { throwOnError: false, displayMode: block });
  else el.textContent = src;
};
for (const el of document.querySelectorAll('.tex')) tex(el.textContent, el, el.classList.contains('block'));

const eqBox = document.getElementById('eq'), eqMath = document.getElementById('eqMath'), eqNote = document.getElementById('eqNote');
let eqT = 0, eqLast = '';
const plus = v => v >= 0 ? `+ ${v}` : `- ${-v}`, minus = v => v >= 0 ? `- ${v}` : `+ ${-v}`;
function eqFor(f, src, lis, who) {
  const r = radial(src, lis), vo = Math.round(r.vo), vf = Math.round(r.vs);
  if (vf >= C) return `v_f = ${vf}\\ \\text{px/s} \\ \\ge\\ c = ${C}\\ \\text{px/s} \\quad\\Rightarrow\\quad \\text{${who} aún no recibe el sonido}`;
  return `f' = f\\,\\dfrac{c + v_o}{c - v_f} = ${f}\\cdot\\dfrac{${C} ${plus(vo)}}{${C} ${minus(vf)}} \\approx ${Math.max(0, f * (C + vo) / (C - vf)).toFixed(0)}\\ \\text{Hz}`;
}
function eqNow(st) {
  let s = '', note = '';
  if (st === 'play') {
    if (cur === 0) { s = eqFor(400, lvl.src, P, 'el oyente'); note = '\\text{Tú eres el oyente } (v_o) \\text{ y la estrella está quieta } (v_f = 0)'; }
    else if (cur === 1) {
      const c = lvl.crystals[lvl.i];
      if (c) { s = eqFor(300, P, c, 'el cristal'); note = '\\text{Tú eres la fuente } (v_f) \\text{ y el cristal está quieto } (v_o = 0)'; }
    } else { s = eqFor(350, lvl.src, P, 'el oyente'); note = '\\text{El cometa es la fuente } (v_f) \\text{ y tú el oyente } (v_o) \\text{: los dos cuentan}'; }
  } else if (st === 'tut' && sim) {
    s = eqFor(sim.base, sim.src, sim.lis, sim.mode === 'B' ? 'el cristal' : 'el oyente');
    note = 'v > 0 \\text{: se acercan} \\qquad v < 0 \\text{: se alejan}';
  }
  return { s, note };
}
function updateEq(dt) {
  const { s, note } = eqNow(state);
  eqBox.hidden = !s;
  if (!s || (eqT -= dt) > 0) return;
  eqT = .15;
  if (s !== eqLast) { tex(s, eqMath, true); eqLast = s; }
  if (note !== eqNote.dataset.src) { tex(note, eqNote); eqNote.dataset.src = note; }
}

for (const el of document.querySelectorAll('[data-split]')) {
  let k = 0;
  const split = node => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const c of ch.textContent) {
          if (c === ' ') { frag.append(' '); continue; }
          const s = document.createElement('span'); s.textContent = c; k++;
          s.style.transform = `rotate(${((hash(k * 3) - .5) * 9).toFixed(1)}deg) translateY(${((hash(k * 5) - .5) * 5).toFixed(1)}px)`;
          frag.append(s);
        }
        ch.replaceWith(frag);
      } else split(ch);
    }
  };
  split(el);
}

(function () {
  const b = document.getElementById('bg'), g = b.getContext('2d'); let a = [];
  function size() {
    b.width = innerWidth; b.height = innerHeight;
    a = Array.from({ length: 140 }, (_, i) => ({ x: rnd(0, b.width), y: rnd(0, b.height), r: rnd(.4, 1.6), p: rnd(0, 6.28), s: rnd(.3, 1.4), sp: i % 9 === 0 }));
  }
  size(); addEventListener('resize', size);
  (function f(t) {
    g.clearRect(0, 0, b.width, b.height);
    for (const s of a) {
      const k = .5 + .5 * Math.sin(t / 1000 * s.s + s.p);
      g.globalAlpha = .2 + .6 * k;
      if (s.sp) sparkle(g, s.x, s.y, 2.5 + 2.5 * k, '#f3d9a4', s.p);
      else { g.fillStyle = '#f7eedb'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
    requestAnimationFrame(f);
  })(0);
})();
