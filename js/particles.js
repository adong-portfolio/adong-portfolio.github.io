/**
 * 首页粒子组件(手写移植版)
 * 行为与原站代码组件逐参数一致:
 *  - 2500 个粒子绕环飞行(半径 145±14),按角度取色(青→蓝→紫→粉的色相环)
 *  - 中心 "Hi" 文字带渐变与辉光,随入场淡入
 *  - 两颗"彗星"高亮沿环扫过
 *  - hover:弹簧(刚度16/阻尼0.75)驱动粒子汇聚成字母 "M",鼠标产生涡旋斥力
 *  - 四层辉光合成(大模糊 screen ×2 + 原图 + 小模糊 lighter)
 */
(function () {
  'use strict';

  // ---- 常数(与原实现一致) ----
  const SIZE = 500;            // 画布逻辑尺寸
  const DISPLAY = 280;         // 显示尺寸
  const RING_R = 145, RING_SD = 14;
  const COUNT = 2500;
  const INTRO = 2.5;           // 入场总时长(s)
  const SPRING_K = 16, DAMPING = 0.75;
  const MORPH_STAGGER = 0.2;
  const MOUSE_R_MORPH = 90, MOUSE_R_RING = 70;
  const CORNER_SMOOTH = 0.08;
  const HI_DELAY = 0.75;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const gaussian = (mean = 0, sd = 1) => {
    const u = Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd + mean;
  };

  // 色相环:按角度分四段插值(青 185 → 蓝 220 → 紫 275 → 粉 245 → 回到青)
  function ringColor(angle, v, morph) {
    const a = ((angle + Math.PI / 2) % (2 * Math.PI)) / (2 * Math.PI);
    let h, s, l;
    if (a < 0.25)      { const t = a / 0.25;          h = 185 + 35 * t;  s = 90 - 10 * t; l = 70 - 12 * t; }
    else if (a < 0.5)  { const t = (a - 0.25) / 0.25; h = 220 + 55 * t;  s = 80 - 15 * t; l = 60 - 12 * t; }
    else if (a < 0.75) { const t = (a - 0.5) / 0.25;  h = 275 - 30 * t;  s = 65 + 10 * t; l = 48 - 5 * t; }
    else               { const t = (a - 0.75) / 0.25; h = 245 - 60 * t;  s = 75 + 15 * t; l = 43 + 27 * t; }
    return { h, s: Math.min(s + morph * 5, 100), l: Math.min(l * v * (1 + morph * 0.15), 95) };
  }
  function morphColor(x, y, cx, cy, v, morph, hueShift) {
    const c = ringColor(Math.atan2(y - cy, x - cx), v, morph);
    c.h = (c.h + hueShift + 360) % 360;
    return c;
  }

  // 字母 "M" 的折线路径(归一化坐标,y 向下)
  const M_PATH = [
    { x1: -0.5, y1: 0.5,  x2: -0.5, y2: -0.5 },
    { x1: -0.5, y1: -0.5, x2: 0,    y2: 0.2 },
    { x1: 0,    y1: 0.2,  x2: 0.5,  y2: -0.5 },
    { x1: 0.5,  y1: -0.5, x2: 0.5,  y2: 0.5 },
  ];

  // 沿路径均匀采样目标点,带法线扰动与转角平滑
  function samplePath(count, scale, sd) {
    const segs = M_PATH.map(s => {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      return { ...s, dx, dy, length: Math.hypot(dx, dy) };
    });
    const total = segs.reduce((acc, s) => acc + s.length, 0);
    const starts = []; let acc = 0;
    for (const s of segs) { starts.push(acc); acc += s.length; }
    const joints = starts.slice(1).map(v => v / total);

    const pts = [];
    for (let i = 0; i < count; i++) {
      const d = Math.random() * total;
      let si = 0, frac = 0;
      for (let k = 0; k < segs.length; k++) {
        if (d < starts[k] + segs[k].length || k === segs.length - 1) { si = k; frac = (d - starts[k]) / segs[k].length; break; }
      }
      const seg = segs[si];
      const pathT = (starts[si] + frac * seg.length) / total;
      let nx = -seg.dy / seg.length, ny = seg.dx / seg.length;     // 法线
      let tx = seg.dx / seg.length, ty = seg.dy / seg.length;      // 切线
      // 接近转角处:法线/切线向相邻段平均值过渡,避免缝隙
      for (let j = 0; j < joints.length; j++) {
        const dist = Math.abs(pathT - joints[j]);
        if (dist < CORNER_SMOOTH) {
          const A = segs[j], B = segs[j + 1];
          const blend = (dist / CORNER_SMOOTH) ** 2;
          const mnx = (-A.dy / A.length + -B.dy / B.length) / 2, mny = (A.dx / A.length + B.dx / B.length) / 2;
          const mtx = (A.dx / A.length + B.dx / B.length) / 2,  mty = (A.dy / A.length + B.dy / B.length) / 2;
          let len = Math.hypot(nx * blend + mnx * (1 - blend), ny * blend + mny * (1 - blend)) || 1;
          nx = (nx * blend + mnx * (1 - blend)) / len; ny = (ny * blend + mny * (1 - blend)) / len;
          len = Math.hypot(tx * blend + mtx * (1 - blend), ty * blend + mty * (1 - blend)) || 1;
          tx = (tx * blend + mtx * (1 - blend)) / len; ty = (ty * blend + mty * (1 - blend)) / len;
        }
      }
      const off = gaussian(0, sd);
      pts.push({
        x: (seg.x1 + seg.dx * frac) * scale + SIZE / 2 + nx * off,
        y: (seg.y1 + seg.dy * frac) * scale + SIZE / 2 + ny * off,
        pathT, nx, ny, tx, ty,
      });
    }
    return pts;
  }

  function createParticles() {
    const targets = samplePath(COUNT, 280, RING_SD);
    const cx = SIZE / 2, cy = SIZE / 2;
    return Array.from({ length: COUNT }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const tier = Math.random();
      const big = tier < 0.1, mid = tier < 0.4;
      const spawnA = Math.random() * Math.PI * 2;
      const spawnR = 250 + Math.random() * 200;
      const t = targets[i];
      return {
        angle,
        radius: RING_R + gaussian(0, RING_SD),
        size: big ? 1.2 + Math.random() : mid ? 0.6 + Math.random() * 0.6 : 0.3 + Math.random() * 0.5,
        brightness: big ? 0.85 + Math.random() * 0.15 : mid ? 0.45 + Math.random() * 0.35 : 0.15 + Math.random() * 0.25,
        orbitSpeed: 0.6 + Math.random() * 0.2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.3 + Math.random() * 0.8,
        driftAmp: 2 + Math.random() * 6,
        twinkleSpeed: 1 + Math.random() * 3,
        twinklePhase: Math.random() * Math.PI * 2,
        tx: t.x, ty: t.y, pathT: t.pathT,
        nX: t.nx, nY: t.ny, tX: t.tx, tY: t.ty,
        spawnX: cx + Math.cos(spawnA) * spawnR,
        spawnY: cy + Math.sin(spawnA) * spawnR,
        spawnDelay: Math.random() * 0.6,
        morphDelay: angle / (Math.PI * 2),
      };
    });
  }

  function mount(host) {
    host.innerHTML = '';
    host.style.display = 'flex';
    host.style.alignItems = 'center';
    host.style.justifyContent = 'center';

    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: 'relative', width: DISPLAY + 'px', height: DISPLAY + 'px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', userSelect: 'none',
    });
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: DISPLAY + 'px', height: DISPLAY + 'px' });
    const hi = document.createElement('span');
    hi.textContent = 'Hi';
    Object.assign(hi.style, { zIndex: '10', pointerEvents: 'none', fontSize: '26px', opacity: '0', willChange: 'transform, opacity, filter' });
    wrap.append(canvas, hi);
    host.appendChild(wrap);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const off = document.createElement('canvas');
    off.width = SIZE * dpr; off.height = SIZE * dpr;
    const octx = off.getContext('2d', { alpha: true });
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = createParticles();
    const mouse = { x: -9999, y: -9999 };
    const spring = { pos: 0, vel: 0 };
    let hovering = false, time = 0, raf = 0;

    wrap.addEventListener('mouseenter', () => { hovering = true; });
    wrap.addEventListener('mouseleave', () => { hovering = false; mouse.x = -9999; mouse.y = -9999; });
    wrap.addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (SIZE / DISPLAY);
      mouse.y = (e.clientY - r.top) * (SIZE / DISPLAY);
    });

    const cx = SIZE / 2, cy = SIZE / 2;

    function frame() {
      time += 0.016;
      const t = time;
      // 弹簧驱动 morph 进度
      const accel = ((hovering ? 1 : 0) - spring.pos) * SPRING_K;
      spring.vel = (spring.vel + accel * 0.016) * DAMPING;
      spring.pos += spring.vel * 0.016;
      const morph = clamp(spring.pos, -0.15, 1.12);
      const cometFade = easeInOut(clamp(morph, 0, 1));
      const intro = Math.min(t / INTRO, 1);

      octx.clearRect(0, 0, SIZE, SIZE);
      const cometA = t * 1.2, cometB = t * 0.7 + Math.PI;

      for (const p of particles) {
        const spawn = clamp((intro - p.spawnDelay) / (1 - p.spawnDelay), 0, 1);
        const alpha = easeOutCubic(spawn);
        if (alpha < 0.01) continue;

        // 环上位置(轨道+漂移)
        const a = p.angle + t * p.orbitSpeed;
        const r = p.radius + Math.sin(t * p.driftSpeed + p.driftPhase) * p.driftAmp;
        const ringX = cx + Math.cos(a) * r, ringY = cy + Math.sin(a) * r;
        let x = p.spawnX + (ringX - p.spawnX) * alpha;
        let y = p.spawnY + (ringY - p.spawnY) * alpha;

        // morph 目标位置(沿法线/切线的波动 + 全局摇摆)
        const waveN = Math.sin(p.pathT * 6 * Math.PI - t * 1.8) * 8;
        const waveT = Math.sin(p.pathT * 4 * Math.PI + t * 2.2 + p.driftPhase * 0.5) * 6;
        const swayX = Math.sin(t * 0.5 + p.pathT * 2 * Math.PI) * 3 + Math.sin(t * p.driftSpeed * 0.7 + p.driftPhase) * p.driftAmp * 0.6;
        const swayY = Math.sin(t * 0.5 + p.pathT * 2 * Math.PI) * 2 + Math.cos(t * p.driftSpeed * 0.5 + p.twinklePhase) * p.driftAmp * 0.5;
        const mx = p.tx + p.nX * waveN + p.tX * waveT + swayX;
        const my = p.ty + p.nY * waveN + p.tY * waveT + swayY;

        // 每个粒子的 morph 进度(按角度错峰)
        const mp = easeInOut(clamp(morph - (p.morphDelay - 0.5) * MORPH_STAGGER, 0, 1));
        x += (mx - x) * mp; y += (my - y) * mp;

        // 过渡途中:滚动速度产生径向爆发
        const burst = Math.sin(mp * Math.PI);
        if (burst > 0.01) {
          const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
          if (d > 0.1) {
            const k = burst * (20 + Math.sin(p.driftPhase * 7) * 12) * Math.abs(spring.vel) * 3;
            x += dx / d * k; y += dy / d * k;
          }
        }
        // morph 态:鼠标涡旋斥力
        if (mp > 0.05) {
          const dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy);
          if (d < MOUSE_R_MORPH) {
            const f = Math.pow(1 - d / MOUSE_R_MORPH, 2);
            const dir = p.driftPhase > Math.PI ? 1 : -1;
            const swirl = Math.atan2(dy, dx) + Math.PI / 2 * dir;
            const amp = f * 35 * mp * Math.sin(t * 2.5 + a * 3);
            x += Math.cos(swirl) * amp; y += Math.sin(swirl) * amp;
            if (d > 0.1) { const push = f * 18 * mp; x += dx / d * push; y += dy / d * push; }
            const jitter = f * 8 * mp;
            x += Math.sin(t * 3 + p.driftPhase * 2) * jitter;
            y += Math.cos(t * 4 + p.twinklePhase * 3) * jitter;
          }
        }
        // 环态:鼠标斥力 + 提亮
        let mouseGlow = 0;
        if (mp < 0.95 && alpha > 0.5) {
          const dx = ringX - mouse.x, dy = ringY - mouse.y, d = Math.hypot(dx, dy);
          if (d < MOUSE_R_RING) {
            const f = Math.pow(1 - d / MOUSE_R_RING, 3), inv = 1 - mp;
            if (d > 0.1) { const push = f * 10 * inv; x += dx / d * push; y += dy / d * push; }
            mouseGlow = f * 0.35 * inv;
          }
        }
        // 闪烁 + 彗星高亮
        const twinkle = 0.5 + 0.5 * Math.sin(t * p.twinkleSpeed + p.twinklePhase);
        let comet = 0;
        if (cometFade < 0.5) {
          const d1 = Math.abs((a - cometA + Math.PI) % (2 * Math.PI) - Math.PI);
          const d2 = Math.abs((a - cometB + Math.PI) % (2 * Math.PI) - Math.PI);
          comet = (Math.exp(-d1 * d1 / 0.5) * 0.5 + Math.exp(-d2 * d2 / 0.5) * 0.25) * (1 - cometFade * 2);
        }
        const v = p.brightness * (0.6 + twinkle * 0.4) + comet + mouseGlow;
        if (v < 0.03) continue;

        // 颜色:环色 ↔ morph 色插值
        let col;
        if (mp < 0.01) col = ringColor(a, v, morph);
        else if (mp > 0.99) col = morphColor(x, y, cx, cy, v, morph, Math.sin(p.pathT * 3 * Math.PI - t * 1.5) * 18 * mp);
        else {
          const c1 = ringColor(a, v, morph);
          const c2 = morphColor(x, y, cx, cy, v, morph, Math.sin(p.pathT * 3 * Math.PI - t * 1.5) * 18 * mp);
          col = { h: c1.h + (c2.h - c1.h) * mp, s: c1.s + (c2.s - c1.s) * mp, l: c1.l + (c2.l - c1.l) * mp };
        }
        octx.globalAlpha = Math.min(v * (1 + morph * 0.2), 1) * alpha;
        octx.fillStyle = `hsl(${col.h}, ${col.s}%, ${col.l}%)`;
        octx.beginPath();
        octx.arc(x, y, p.size * (0.8 + twinkle * 0.2), 0, Math.PI * 2);
        octx.fill();
      }

      // 四层辉光合成
      ctx.clearRect(0, 0, SIZE, SIZE);
      const passes = [
        { blur: (16 + morph * 8) * dpr, alpha: 0.6 + morph * 0.15, mode: 'screen' },
        { blur: (6 + morph * 3) * dpr,  alpha: 0.5 + morph * 0.1,  mode: 'screen' },
        { blur: 0,                       alpha: 0.9,                mode: 'source-over' },
        { blur: 2 * dpr,                 alpha: 0.25 + morph * 0.1, mode: 'lighter' },
      ];
      for (const pass of passes) {
        ctx.save();
        if (pass.blur) ctx.filter = `blur(${pass.blur}px)`;
        ctx.globalAlpha = pass.alpha;
        ctx.globalCompositeOperation = pass.mode;
        ctx.drawImage(off, 0, 0, SIZE, SIZE);
        ctx.restore();
      }

      // "Hi" 文字:渐变 + 辉光,morph 时淡出
      const hiT = easeOutCubic(clamp((intro - HI_DELAY) / 0.25, 0, 1));
      const m01 = clamp(morph, 0, 1);
      const wobble = Math.sin(t * 1.2) * 0.08 + Math.sin(t * 0.7) * 0.04;
      const hue1 = 185 + Math.sin(t * 0.5) * 30;
      const hue2 = 260 + Math.sin(t * 0.3 + 1) * 25;
      const cometNear = Math.cos(cometA + Math.PI / 2);
      const h1 = cometNear > 0 ? hue1 + cometNear * 15 : hue1;
      const l1 = cometNear > 0 ? 75 + cometNear * 10 : 75;
      hi.style.opacity = String(Math.max(0, 0.85 * hiT * (1 - m01) * (1 + wobble)));
      hi.style.filter = `blur(${(1 - hiT) * 6 + m01 * 8}px)`;
      hi.style.transform = `scale(${0.9 + hiT * 0.1 + m01 * 0.06}) translateY(${m01 * -4 + Math.sin(t * 0.8) * 1.5}px)`;
      hi.style.background = `linear-gradient(180deg, hsl(${h1}, 85%, ${l1}%), hsl(${hue2}, 70%, 65%))`;
      hi.style.webkitBackgroundClip = 'text';
      hi.style.backgroundClip = 'text';
      hi.style.webkitTextFillColor = 'transparent';
      hi.style.textShadow = `0 0 12px hsla(${h1}, 80%, 70%, ${0.3 * (1 - m01) * hiT}), 0 0 4px hsla(${hue2}, 70%, 60%, ${0.2 * (1 - m01) * hiT})`;

      raf = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(raf);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-particles]').forEach(mount);
  });
})();
