// Cute ghosts, bats, and synthesized Halloween sounds (no audio files needed).
const Spooky = (() => {
  // ---------- sound ----------
  let ctx = null;
  let master = null;
  let ambientTimer = null;
  let muted = false;
  try { muted = localStorage.getItem('pumpkin-muted') === '1'; } catch { /* storage blocked */ }

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      // iOS 17+: play through the silent switch like a media app (the 🔊 button still mutes).
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      // a little echo makes everything feel haunted
      const delay = ctx.createDelay();
      const feedback = ctx.createGain();
      delay.delayTime.value = 0.28;
      feedback.gain.value = 0.3;
      master.connect(ctx.destination);
      master.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq, to, type = 'sine', start = 0, dur = 0.2, vol = 0.2, vibrato = 0 }) {
    const ac = audio();
    if (!ac || muted) return;
    const t = ac.currentTime + start;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    if (vibrato) {
      const lfo = ac.createOscillator();
      const depth = ac.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  const sounds = {
    // candy lands in the bucket: plink-plonk
    drop() {
      tone({ freq: 1400, to: 900, type: 'triangle', dur: 0.12, vol: 0.18 });
      tone({ freq: 1100, to: 700, type: 'triangle', start: 0.1, dur: 0.14, vol: 0.12 });
      tone({ freq: 180, to: 90, start: 0.05, dur: 0.18, vol: 0.2 });
    },
    // cute ghost "wooOOoo"
    boo() {
      tone({ freq: 380, to: 620, dur: 0.35, vol: 0.12, vibrato: 18 });
      tone({ freq: 620, to: 300, start: 0.3, dur: 0.6, vol: 0.12, vibrato: 22 });
    },
    // tapped a locked candy: bonk
    locked() {
      tone({ freq: 220, to: 140, type: 'square', dur: 0.09, vol: 0.06 });
      tone({ freq: 180, to: 110, type: 'square', start: 0.1, dur: 0.12, vol: 0.06 });
    },
    // opening a note: sparkly chime
    open() {
      [659, 784, 988, 1319].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.07, dur: 0.5, vol: 0.1 }));
    },
    // pumpkin created: witchy cackle-ish arpeggio
    carve() {
      [440, 523, 622, 740, 880].forEach((f, i) => tone({ freq: f, type: 'sawtooth', start: i * 0.06, dur: 0.15, vol: 0.04 }));
      setTimeout(() => sounds.boo(), 350);
    },
  };

  // quiet music-box loop in a spooky minor key
  const MELODY = [440, 523, 659, 831, 659, 523, 440, 415, 392, 494, 587, 740, 587, 494, 440, 0];
  function startAmbient() {
    if (ambientTimer || muted || !audio() || ctx.state !== 'running') return;
    let i = 0;
    ambientTimer = setInterval(() => {
      const f = MELODY[i++ % MELODY.length];
      if (f) tone({ freq: f, type: 'sine', dur: 0.9, vol: 0.035 });
      if (i % 8 === 1) tone({ freq: f / 4 || 110, type: 'triangle', dur: 2.2, vol: 0.03 });
    }, 420);
  }
  function stopAmbient() {
    clearInterval(ambientTimer);
    ambientTimer = null;
  }

  // Phones only allow audio after a tap *ends* (touchend/click), and iOS also wants
  // something played inside that gesture. Call this from those events.
  function unlock() {
    const ac = audio();
    if (!ac) return;
    const blip = ac.createBufferSource();
    blip.buffer = ac.createBuffer(1, 1, 22050);
    blip.connect(ac.destination);
    blip.start(0);
    ac.resume().then(() => {
      if (ac.state !== 'running') return;
      ['touchend', 'click', 'keydown'].forEach((type) => window.removeEventListener(type, unlock, true));
      startAmbient();
    });
  }

  function play(name) {
    const ac = audio();
    if (!ac || !sounds[name]) return;
    // If the context is still waking up, wait so notes aren't scheduled on a frozen clock.
    if (ac.state === 'running') sounds[name]();
    else ac.resume().then(() => sounds[name]());
  }

  // ---------- visuals ----------
  const GHOST_SVG = `
  <svg viewBox="0 0 100 120" aria-hidden="true">
    <path d="M50 4C24 4 10 24 10 50v58c0 4 4 6 7 3l9-8 9 9c2 2 5 2 7 0l8-9 8 9c2 2 5 2 7 0l9-9 9 8c3 3 7 1 7-3V50C90 24 76 4 50 4Z" fill="#fdfbff"/>
    <path d="M50 4C24 4 10 24 10 50v58c0 4 4 6 7 3l9-8 9 9c2 2 5 2 7 0l8-9 8 9c2 2 5 2 7 0l9-9 9 8c3 3 7 1 7-3V50C90 24 76 4 50 4Z" fill="none" stroke="#d9cce8" stroke-width="3"/>
    <ellipse cx="36" cy="48" rx="6" ry="8" fill="#2a1a3d"/>
    <ellipse cx="64" cy="48" rx="6" ry="8" fill="#2a1a3d"/>
    <circle cx="38" cy="45" r="2.2" fill="#fff"/>
    <circle cx="66" cy="45" r="2.2" fill="#fff"/>
    <ellipse cx="26" cy="62" rx="7" ry="4" fill="#ffb3c7" opacity=".8"/>
    <ellipse cx="74" cy="62" rx="7" ry="4" fill="#ffb3c7" opacity=".8"/>
    <ellipse cx="50" cy="66" rx="6" ry="7" fill="#2a1a3d"/>
  </svg>`;

  const BAT_SVG = `
  <svg viewBox="0 0 100 50" aria-hidden="true">
    <g fill="#120a1c">
      <path class="wing l" d="M50 25 C40 5 20 5 2 15 C12 18 14 26 12 32 C20 26 28 30 30 36 C36 28 44 28 50 30Z"/>
      <path class="wing r" d="M50 25 C60 5 80 5 98 15 C88 18 86 26 88 32 C80 26 72 30 70 36 C64 28 56 28 50 30Z"/>
      <ellipse cx="50" cy="27" rx="8" ry="10"/>
      <path d="M44 19 L45 11 L48 18 Z M56 19 L55 11 L52 18 Z"/>
    </g>
    <circle cx="47" cy="25" r="1.6" fill="#ffcf40"/>
    <circle cx="53" cy="25" r="1.6" fill="#ffcf40"/>
  </svg>`;

  function spin(el) {
    el.classList.remove('spin');
    void el.offsetWidth;
    el.classList.add('spin');
    play('boo');
  }

  function decorate({ peekInto } = {}) {
    // floating background ghosts
    const layer = document.createElement('div');
    layer.className = 'spooky-layer';
    [
      { left: '5%', top: '90%', size: 46, dur: 7, delay: 0 },
      { left: '82%', top: '47%', size: 42, dur: 9, delay: -3 },
      { left: '84%', top: '86%', size: 34, dur: 8, delay: -5 },
    ].forEach((g) => {
      const el = document.createElement('button');
      el.className = 'ghost float';
      el.setAttribute('aria-label', 'Boo!');
      el.innerHTML = GHOST_SVG;
      Object.assign(el.style, { left: g.left, top: g.top, width: `${g.size}px`, animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` });
      el.addEventListener('click', () => spin(el));
      layer.appendChild(el);
    });
    // bats flapping across now and then
    [{ top: '12%', dur: 14, delay: 2 }, { top: '35%', dur: 18, delay: 9 }].forEach((b) => {
      const el = document.createElement('div');
      el.className = 'bat';
      el.innerHTML = BAT_SVG;
      Object.assign(el.style, { top: b.top, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` });
      layer.appendChild(el);
    });
    document.body.prepend(layer);

    // a shy ghost peeking out from behind the pumpkin
    if (peekInto) {
      const peek = document.createElement('button');
      peek.className = 'ghost peek';
      peek.setAttribute('aria-label', 'Boo!');
      peek.innerHTML = GHOST_SVG;
      peek.addEventListener('click', () => spin(peek));
      peekInto.appendChild(peek);
    }

    // sound toggle
    const btn = document.createElement('button');
    btn.className = 'sound-toggle';
    const paint = () => {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    };
    paint();
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      muted = !muted;
      try { localStorage.setItem('pumpkin-muted', muted ? '1' : '0'); } catch { /* ignore */ }
      paint();
      if (muted) stopAmbient(); else { unlock(); play('boo'); }
    });
    document.body.appendChild(btn);

    // browsers only allow audio after a tap, so unlock (and start the music) on the first one
    ['touchend', 'click', 'keydown'].forEach((type) => window.addEventListener(type, unlock, true));
  }

  return { play, decorate };
})();
