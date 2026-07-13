/**
 * 交互引擎(手写)——参数全部来自设计图纸,由 build.py 写入 data-* 属性:
 *  - data-appear        进场动画(位移+淡入,精确时长/延迟/贝塞尔)
 *  - data-scrollfx      滚动联动(数字滚轮 / 导航高亮 / 页面进度)
 *  - data-hoverfx       悬停位移
 *  - data-cursor        自定义鼠标指针
 *  - data-scroll-to     导航锚点平滑滚动
 * 变体 hover 切换(SWAP_STATE)由生成器输出纯 CSS(.v-alt 叠层),无需 JS。
 *
 * 动画偏移一律写 CSS 变量 --fx(build.py 已把它编译进每个行为元素的 transform:
 * `var(--fx,translate(0,0)) <旋转矩阵>`),JS 不直接写 transform,
 * 否则内联值会顶掉类里的旋转矩阵(倾斜卡片会跳回原点)。
 */
(function () {
  'use strict';

  /* 中间宽度(平板/小笔记本):整站等比缩放跟随屏宽,避免固定 1920 布局留白/右侧溢出。
     手机(<=768)走反流式重排,不缩放;>=1920 原生。(zoom 是布局级,sticky/滚动正常) */
  const fitZoom = () => {
    const w = window.innerWidth;
    document.body.style.zoom = (w > 768 && w < 1920) ? (w / 1920).toString() : '';
  };
  fitZoom();
  window.addEventListener('resize', fitZoom, { passive: true });

  if (location.search.includes('noanim')) {
    document.addEventListener('DOMContentLoaded', () => {
      for (const el of document.querySelectorAll('[data-appear],[data-scrollfx],[data-hoverfx]')) {
        el.style.opacity = '1'; el.style.transition = 'none';
      }
    });
    return;
  }

  const bezier = (e) => `cubic-bezier(${e.join(',')})`;
  const byNid = (nid) => document.querySelector(`[data-nid="${nid}"]`);
  const fx = (el, dx, dy) => el.style.setProperty('--fx', `translate(${dx}px, ${dy}px)`);

  /* ---------- 顶部导航 scroll-spy:当前区块对应项高亮(文字 1+下划线 1,其余 0.3/0) ----------
     设计自带的 appear/scrollfx 高亮逻辑不工作(永远只亮首页),这里接管 */
  (function navSpy() {
    const defs = [
      { t: '421:11708', u: '421:11709', sec: 'home' },
      { t: '421:11711', u: '421:11712', sec: 'about' },
      { t: '421:11714', u: '421:11715', sec: 'collab' },
      { t: '421:11717', u: '421:11718', sec: 'skills' },
      { t: '421:11720', u: '421:11721', sec: 'projects' },
    ].map(d => ({ t: byNid(d.t), u: byNid(d.u), sec: document.getElementById(d.sec) })).filter(d => d.t && d.sec);
    if (!defs.length) return;
    for (const d of defs) for (const el of [d.t, d.u]) {
      if (!el) continue;
      el.removeAttribute('data-appear');    // 去掉设计自带高亮逻辑,避免抢 opacity
      el.removeAttribute('data-scrollfx');
      el.style.transition = 'opacity .35s ease';
    }
    const update = () => {
      const ref = scrollY + innerHeight * 0.38;   // 参考线略偏视口上方
      let active = 0;
      defs.forEach((d, i) => { if (ref >= d.sec.getBoundingClientRect().top + scrollY - 1) active = i; });
      defs.forEach((d, i) => {
        const on = i === active;
        d.t.style.opacity = on ? '1' : '0.3';
        if (d.u) d.u.style.opacity = on ? '1' : '0';
      });
    };
    addEventListener('scroll', update, { passive: true });
    update();
  })();

  /* ---------- 进场动画 ---------- */
  const appearEls = [...document.querySelectorAll('[data-appear]')];
  for (const el of appearEls) {
    const cfg = JSON.parse(el.dataset.appear);
    el.style.opacity = String(cfg.op);
    fx(el, cfg.dx, cfg.dy);
    el.__appear = cfg;
  }
  const playAppear = (el) => {
    const cfg = el.__appear;
    el.style.transition =
      `opacity ${cfg.dur}s ${bezier(cfg.ease)} ${cfg.delay}s, ` +
      `transform ${cfg.dur}s ${bezier(cfg.ease)} ${cfg.delay}s`;
    el.style.opacity = '1';
    fx(el, 0, 0);
    // 进场完成后清掉内联 transition,把控制权还给类规则——
    // 宿主的 :hover 尺寸过渡(项目行增高/胶囊撑宽)写在类里,内联值会把它们顶掉,悬停变成硬跳
    setTimeout(() => { el.style.transition = ''; }, (cfg.delay + cfg.dur) * 1000 + 80);
  };
  const appearIO = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting || !en.target.__appear) continue;
      playAppear(en.target);
      appearIO.unobserve(en.target);
    }
  }, { threshold: 0.1 });
  for (const el of appearEls) {
    const watch = el.__appear.watch && byNid(el.__appear.watch);
    if (watch) {
      // OTHER_LAYER_IN_VIEW:监听目标层,触发自己
      const io = new IntersectionObserver((ens) => {
        for (const en of ens) if (en.isIntersecting) { playAppear(el); io.disconnect(); }
      }, { threshold: 0.1 });
      io.observe(watch);
    } else {
      appearIO.observe(el);
    }
  }

  /* ---------- 悬停区块置顶(弹层可垂出区块底边,不被下一区块背景盖住) ---------- */
  for (const sec of document.querySelectorAll('.page > *')) {
    sec.addEventListener('pointerenter', () => { sec.style.zIndex = '1'; });
    sec.addEventListener('pointerleave', () => { sec.style.zIndex = ''; });
  }

  /* ---------- 二级弹层触发(配合生成的 .__vs-* 规则;代替 :has(...:hover)) ---------- */
  for (const trig of document.querySelectorAll('[data-variant-hover]')) {
    const flag = '__vs-' + trig.dataset.variantHover.replace(':', '-');
    const layer = trig.closest('.v-alt, .v-sub');
    const host = layer && layer.parentElement;
    if (!host) continue;
    trig.addEventListener('pointerenter', () => host.classList.add(flag));
    trig.addEventListener('pointerleave', () => host.classList.remove(flag));
  }

  /* ---------- 首屏大标题:机械扫描杆逐字"弹出"进场 ----------
     发光绿杆从左横扫,扫到哪个字 → 该字机械弹起(回弹)+绿色高光闪一下 */
  const heroTitle = document.querySelector('[data-nid="160:649"]');
  if (heroTitle) {
    const items = [];
    for (const seg of [...heroTitle.children]) {
      if (seg.dataset && seg.dataset.nid === '160:612') { items.push(seg); continue; }  // 中间图标整体作一个
      const walk = (node) => {
        for (const child of [...node.childNodes]) {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            for (const ch of child.textContent) {
              if (ch.trim() === '') { frag.appendChild(document.createTextNode(ch)); continue; }
              const s = document.createElement('span');
              s.textContent = ch; s.style.display = 'inline-block';
              frag.appendChild(s); items.push(s);
            }
            node.replaceChild(frag, child);
          } else walk(child);
        }
      };
      walk(seg);
    }
    for (const el of items) {
      el.style.opacity = '0';
      // 一点机械感:出现瞬间极轻微下沉硬切归位(steps,非平滑)
      el.style.transition = 'opacity .01s, transform .09s steps(2,end)';
      el.style.transform = 'translateY(1.5px)';
    }
    // 打字机光标(细竖条,硬闪)
    if (!document.getElementById('__caret-kf')) {
      const kf = document.createElement('style');
      kf.id = '__caret-kf';
      kf.textContent = '@keyframes hero-caret{0%,49%{opacity:1}50%,100%{opacity:0}}';
      document.head.appendChild(kf);
    }
    const caret = document.createElement('span');
    caret.style.cssText = 'display:inline-block;width:2px;height:.92em;background:currentColor;vertical-align:-.08em;margin:0 .02em;animation:hero-caret .9s steps(1,end) infinite;';
    // 逐字"敲出":硬切出现 + 匀速节拍,光标跟随
    let i = 0;
    const type = () => {
      if (i < items.length) {
        const el = items[i];
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        if (el.tagName === 'SPAN') el.after(caret);   // 光标跟在刚敲出的字后(图标项不移)
        i++;
        setTimeout(type, 68);   // 匀速打字节拍
      } else {
        // 打完:光标再闪一会儿后淡出
        setTimeout(() => { caret.style.animation = 'none'; caret.style.transition = 'opacity .4s'; caret.style.opacity = '0'; setTimeout(() => caret.remove(), 420); }, 1100);
      }
    };
    setTimeout(type, 250);
  }

  /* ---------- 首屏平台行:无限横向滚动跑马灯 ---------- */
  const platRow = document.querySelector('[data-nid="220:4650"]');
  if (platRow) {
    const items = [...platRow.children];
    const track = document.createElement('div');
    track.className = 'plat-marquee';
    for (const it of items) track.appendChild(it);                 // 原件
    for (const it of items) track.appendChild(it.cloneNode(true)); // 克隆一份,无缝循环
    platRow.appendChild(track);
    platRow.style.overflow = 'hidden';
    platRow.style.justifyContent = 'flex-start';
  }

  /* ---------- 自我介绍正文:随滚动逐字"阅读式"显隐(左→右、上→下扫过) ---------- */
  const aboutSec = document.getElementById('about');
  for (const tx of document.querySelectorAll('[data-nid="118:1355"], [data-nid="298:1239"]')) {
    const full = 1.0;    // 已读字透明度(全亮)
    const dim = 0.04;    // 未读字透明度(近全黑,加大明暗反差)
    // 整段透明度归一,逐字透明度交给 span 控制
    tx.style.opacity = '1';
    // 把文字逐字包进 <span>(保留 <br>),空白不包
    const chars = [];
    const wrap = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of child.textContent) {
            if (ch.trim() === '') { frag.appendChild(document.createTextNode(ch)); continue; }
            const s = document.createElement('span');
            s.textContent = ch;
            // 保持纯内联(不设 inline-block、不做 translateY):避免字符基线错位,只做亮度变化
            s.style.transition = 'opacity .25s linear';
            frag.appendChild(s);
            chars.push(s);
          }
          node.replaceChild(frag, child);
        } else if (child.nodeName !== 'BR') {
          wrap(child);
        }
      }
    };
    wrap(tx);
    const N = chars.length;
    const band = Math.max(5, N * 0.05);  // 过渡带收窄→明暗分界更锐利,反差更明显
    const update = () => {
      const r = tx.getBoundingClientRect();
      const vh = innerHeight;
      const sy = scrollY;
      const blockTopAbs = r.top + sy;                              // 段落顶绝对位置(恒定)
      const secBottomAbs = aboutSec.getBoundingClientRect().bottom + sy;  // 自我介绍区底绝对位置
      // 开始:段落顶刚从视口底进入;结束:整区底刚框进视窗(=你看到的取景位)
      // → 行程跨越整个区高,逐字慢扫,到整区完全展示时刚好全部点亮
      const startSy = blockTopAbs - vh;
      const endSy = secBottomAbs - vh;
      const p = endSy > startSy ? Math.min(1, Math.max(0, (sy - startSy) / (endSy - startSy))) : 1;
      const front = p * (N + band);
      for (let i = 0; i < N; i++) {
        const t = Math.min(1, Math.max(0, (front - i) / band));  // 该字已读程度
        chars[i].style.opacity = (dim + (full - dim) * t).toFixed(3);  // 只变亮度,不位移→不错位
      }
    };
    addEventListener('scroll', update, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
    update();
  }

  /* ---------- 自我介绍:标题/标签错位上浮进场 ---------- */
  if (aboutSec) {
    // 按从上到下的视觉顺序排,依次错位上浮(标题两组 + 标签胶囊行)
    const floaters = ['296:1224', '298:1233', '335:3344']
      .map(id => document.querySelector(`[data-nid="${id}"]`)).filter(Boolean);
    floaters.forEach((el, i) => {
      // 起始态:下移 + 透明;不动原 transform(标签行 hover 靠类规则,进场结束清掉内联)
      el.style.opacity = '0';
      el.style.transform = 'translateY(26px)';
      el.__floatDelay = i * 0.14;
    });
    const playFloat = (el) => {
      if (el.__floated) return;
      el.__floated = true;
      el.style.transition = `opacity .7s cubic-bezier(.215,.61,.355,1) ${el.__floatDelay}s, transform .7s cubic-bezier(.215,.61,.355,1) ${el.__floatDelay}s`;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      // 进场结束清内联(还原类规则控制,标签行 hover 尺寸过渡才不被顶掉)
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, (el.__floatDelay + 0.7) * 1000 + 100);
    };
    // 用滚动检测触发(后台标签页 IntersectionObserver 会被节流不触发)
    const floatCheck = () => {
      const vh = innerHeight;
      for (const el of floaters) {
        if (el.__floated) continue;
        if (el.getBoundingClientRect().top < vh * 0.85) playFloat(el);
      }
    };
    addEventListener('scroll', floatCheck, { passive: true });
    floatCheck();

    /* 手写体签名(dong- ux designer):进视野时从左到右"书写"出来
       (SVG 是填充路径不能描边,用裁剪从左揭示;书写本就左→右,缓出读作落笔成字) */
    const sign = document.querySelector('[data-nid="335:20582"]');
    if (sign) {
      sign.style.clipPath = 'inset(0 100% 0 0)';
      sign.style.willChange = 'clip-path';
      const signCheck = () => {
        if (sign.__written) return;
        if (sign.getBoundingClientRect().top < innerHeight * 0.82) {
          sign.__written = true;
          sign.style.transition = 'clip-path 1.4s cubic-bezier(.65,.02,.3,1) .1s';
          sign.style.clipPath = 'inset(0 0 0 0)';
        }
      };
      addEventListener('scroll', signCheck, { passive: true });
      signCheck();
    }
  }

  /* ---------- 技能区定制:数字滚轮重写 ----------
   * 设计数据的 from/to 偏移带残差(终点停在半格,数字上下错位),不再使用;
   * 改为按几何吸附:终点 = 最接近设计静止位的整数字格(格高=可视窗高),从 0 滚入 */
  const skills = document.getElementById('skills');
  if (skills) {
    // 所有几何量在"应用时刻"现测(字体加载会让文本列移位,提前算好的修正会过期)
    const fxY = (el) => {
      const m = (el.style.getPropertyValue('--fx') || '').match(/,\s*(-?[\d.]+)px\)/);
      return m ? parseFloat(m[1]) : 0;
    };
    const layoutTop = (strip) =>  // 类布局顶位(剔除当前 --fx 偏移)
      strip.getBoundingClientRect().top - strip.parentElement.getBoundingClientRect().top - fxY(strip);
    const snapEnd = (strip) => {  // 终点:最接近设计静止位的整数字格
      const h = strip.parentElement.getBoundingClientRect().height;
      const total = strip.getBoundingClientRect().height;
      if (!h || !total) return 0;
      const y0 = layoutTop(strip);
      const k = Math.min(Math.max(0, Math.round(-y0 / h)), Math.round(total / h) - 1);
      return -k * h - y0;
    };
    const setFx = (strip, y) => strip.style.setProperty('--fx', `translate(0px, ${y.toFixed(1)}px)`);
    const rollers = [], statics = [];
    for (const strip of skills.querySelectorAll('[data-scrollfx]')) {
      if (!/^[\d ]+$/.test(strip.dataset.name || '')) continue;
      strip.removeAttribute('data-scrollfx');
      rollers.push(strip);
      setFx(strip, -layoutTop(strip));  // 起点:第 0 格
      // 每次进入视野都重滚(上滚下滚均触发):完全离开时无动画复位到 0 格
      new IntersectionObserver((ens) => {
        for (const en of ens) {
          if (en.isIntersecting && en.intersectionRatio >= 0.3 && !strip.__rolled) {
            strip.__rolled = true;
            strip.style.transition = 'transform 1.4s cubic-bezier(0.215, 0.61, 0.355, 1) 0.1s';
            setFx(strip, snapEnd(strip));
          } else if (!en.isIntersecting && strip.__rolled) {
            strip.__rolled = false;
            strip.style.transition = 'none';
            setFx(strip, -layoutTop(strip));
          }
        }
      }, { threshold: [0, 0.3] }).observe(strip.parentElement);
    }
    // 变体副本里的静态数字列同样吸附,避免 hover 切换前后错半格
    for (const strip of skills.querySelectorAll('.v-alt [data-pid], .v-sub [data-pid]')) {
      if (!/^[\d ]+$/.test(strip.dataset.name || '')) continue;
      statics.push(strip);
      setFx(strip, snapEnd(strip));
    }
    // 字体就绪后版面可能移位,全部重新吸附(未滚的回到第 0 格,已滚/静态的吸到终格)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
      for (const s of rollers) setFx(s, s.__rolled ? snapEnd(s) : -layoutTop(s));
      for (const s of statics) setFx(s, snapEnd(s));
    });
    /* 彩色柱条:设计是整条左滑入场,改成从左到右的填充(scaleX 0→1) */
    for (const bar of skills.querySelectorAll('[data-name="Rectangle 34624843"]')) {
      bar.removeAttribute('data-scrollfx');
      bar.style.transformOrigin = 'left center';
      bar.style.setProperty('--fx', 'scaleX(0)');
      new IntersectionObserver((ens, io) => {
        for (const en of ens) {
          if (!en.isIntersecting) continue;
          bar.style.transition = 'transform 1.1s cubic-bezier(0.215, 0.61, 0.355, 1) 0.15s';
          bar.style.setProperty('--fx', 'scaleX(1)');
          io.disconnect();
        }
      }, { threshold: 0.3 }).observe(bar.parentElement);
    }
  }

  /* ---------- 滚动联动 ---------- */
  const fxState = (el, s, dur, ease) => {
    el.style.transition = `transform ${dur}s ${bezier(ease)}, opacity ${dur}s ${bezier(ease)}`;
    fx(el, s.dx || 0, s.dy || 0);
    el.style.opacity = String(s.op);
  };
  for (const el of document.querySelectorAll('[data-scrollfx]')) {
    const cfg = JSON.parse(el.dataset.scrollfx);
    if (cfg.trigger === 'OTHER_LAYER_IN_VIEW' && cfg.watch) {
      const watch = byNid(cfg.watch);
      if (!watch) continue;
      fxState(el, cfg.from, 0, cfg.ease);
      new IntersectionObserver((ens) => {
        for (const en of ens) fxState(el, en.isIntersecting ? cfg.to : cfg.from, cfg.dur, cfg.ease);
      }, { rootMargin: '-40% 0px -40% 0px' }).observe(watch);
    } else if (cfg.trigger === 'PAGE_HEIGHT') {
      // 页面滚动进度驱动(线性插值)
      const lerp = (a, b, t) => a + (b - a) * t;
      const onScroll = () => {
        const doc = document.documentElement;
        const t = Math.min(1, Math.max(0, doc.scrollTop / (doc.scrollHeight - doc.clientHeight)));
        fx(el, lerp(cfg.from.dx, cfg.to.dx, t), lerp(cfg.from.dy, cfg.to.dy, t));
        el.style.opacity = String(lerp(cfg.from.op, cfg.to.op, t));
      };
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    } else {
      // THIS_LAYER_IN_VIEW:入视口后 from → to(数字滚轮等)
      // 被裁剪的元素(数字列 464px 高只露 58px)可见比例永远到不了阈值,改观察裁剪容器
      let watchEl = el;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflow.includes('hidden')) { watchEl = p; break; }
      }
      fxState(el, cfg.from, 0, cfg.ease);
      const io = new IntersectionObserver((ens) => {
        for (const en of ens) {
          if (!en.isIntersecting) continue;
          requestAnimationFrame(() => fxState(el, cfg.to, cfg.dur, cfg.ease));
          io.disconnect();
        }
      }, { threshold: 0.3 });
      io.observe(watchEl);
    }
  }

  /* ---------- 悬停位移 ---------- */
  for (const el of document.querySelectorAll('[data-hoverfx]')) {
    const cfg = JSON.parse(el.dataset.hoverfx);
    // 含缩放矩阵的悬停(证书卡)用带回弹的弹性曲线;进场动画播放时会覆盖 transition,
    // 所以每次悬停/离开都重设,不能只在初始化时设一次
    const elastic = !!cfg.mtx;
    const ease = elastic ? 'cubic-bezier(.3,1.45,.45,1)' : bezier(cfg.ease);
    const dur = elastic ? Math.max(cfg.dur, 0.45) : cfg.dur;
    const setTrans = () => {
      el.style.transition = `transform ${dur}s ${ease}, opacity ${dur}s ${ease}`;
    };
    el.addEventListener('mouseenter', () => {
      setTrans();
      // 记住悬停前的内联透明度:进场动画结束后是 '1',清空会回落到 [data-appear]{opacity:0} 导致元素消失
      el.__preHoverOp = el.style.opacity;
      // 含缩放/旋转的悬停态用完整矩阵(如倾斜卡片悬停时放大并回正)
      if (cfg.mtx) el.style.setProperty('--fx', `matrix(${cfg.mtx.join(',')})`);
      else fx(el, cfg.dx, cfg.dy);
      el.style.opacity = String(cfg.op);
    });
    el.addEventListener('mouseleave', () => {
      setTrans();
      fx(el, 0, 0);
      el.style.opacity = el.__preHoverOp ?? '';
    });
  }

  /* ---------- 自定义指针 ---------- */
  for (const el of document.querySelectorAll('[data-cursor]')) {
    const cfg = JSON.parse(el.dataset.cursor);
    el.style.cursor = `url('${cfg.url}') ${cfg.x} ${cfg.y}, pointer`;
  }

  /* ---------- 导航锚点(按 sticky 头部高度偏移,避免区块顶被头部盖住) ---------- */
  const stickyHeader = document.getElementById('site-header');
  for (const el of document.querySelectorAll('[data-scroll-to]')) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      const target = byNid(el.dataset.scrollTo);
      if (!target) return;
      const headerH = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;
      const top = target.getBoundingClientRect().top + scrollY - headerH;
      scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }

  /* ---------- 外链跳转 ---------- */
  for (const el of document.querySelectorAll('[data-href]')) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.dataset.newtab) window.open(el.dataset.href, '_blank', 'noopener');
      else window.location.href = el.dataset.href;
    });
  }

  /* ---------- 联系按钮:从鼠标进入点扩散填充 ---------- */
  for (const el of document.querySelectorAll('.component-425--40')) {
    let hoverFrame = 0;
    const setHoverOrigin = (event) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      el.style.setProperty('--hover-x', `${x}px`);
      el.style.setProperty('--hover-y', `${y}px`);
    };
    el.addEventListener('pointerenter', (event) => {
      cancelAnimationFrame(hoverFrame);
      setHoverOrigin(event);
      el.classList.remove('is-social-hovered');
      hoverFrame = requestAnimationFrame(() => {
        el.classList.add('is-social-hovered');
      });
    });
    el.addEventListener('pointerleave', (event) => {
      cancelAnimationFrame(hoverFrame);
      setHoverOrigin(event);
      el.classList.remove('is-social-hovered');
    });
    el.addEventListener('focusin', () => {
      el.style.setProperty('--hover-x', '50%');
      el.style.setProperty('--hover-y', '50%');
      el.classList.add('is-social-hovered');
    });
    el.addEventListener('focusout', () => {
      el.classList.remove('is-social-hovered');
    });
  }
})();
