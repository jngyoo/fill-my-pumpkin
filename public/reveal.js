// Halloween reveal: the pumpkin shakes, goes POP, and the notes come out as wrapped candies
// that the owner unwraps one by one into little handwritten letters.
const Reveal = (() => {
  const PAPER = { candy: '#efe2ff', lollipop: '#ffe1ef', chocolate: '#f4e3d3', donut: '#ffe7d6', cookie: '#fff1cf', cupcake: '#dcf6ea' };
  const INK = { candy: '#7a4bb3', lollipop: '#c03a78', chocolate: '#7a4726', donut: '#c0612a', cookie: '#9a7018', cupcake: '#23865e' };
  const SPARKS = ['✨', '⭐', '💜', '🧡', '🌟'];

  let o = null; // { bucket, pile, count, openBtn, haul, jar, title, progress, modal, messages, key }
  let opened = new Set();
  let celebrated = false;
  let busy = false;

  const $ = (s) => document.querySelector(s);

  function read(suffix, fallback) {
    if (!o.key) return fallback;
    try { const v = localStorage.getItem(o.key + suffix); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  }
  function write(suffix, value) {
    if (!o.key) return;
    try { localStorage.setItem(o.key + suffix, JSON.stringify(value)); } catch { /* storage blocked */ }
  }

  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Emoji confetti flying out from (x, y) and falling with a little gravity.
  function burst(x, y, emojis, { count = 36, power = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = emojis[i % emojis.length];
      const angle = Math.random() * Math.PI * 2;
      const dist = (110 + Math.random() * 170) * power;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * dist - 110 * power}px`);
      p.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
      p.style.fontSize = `${16 + Math.random() * 22}px`;
      p.style.animationDelay = `${Math.random() * 0.08}s`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1700);
    }
  }

  function flash(x, y) {
    const f = document.createElement('div');
    f.className = 'flash';
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  function spinGhosts() {
    document.querySelectorAll('.ghost').forEach((g) => {
      g.classList.remove('spin');
      void g.offsetWidth;
      g.classList.add('spin');
    });
  }

  // ---------- the POP ----------
  function pop() {
    if (busy || read(':popped', false)) return;
    busy = true;
    o.openBtn.classList.add('hidden');
    o.bucket.classList.add('charging');
    Spooky.play('rumble');
    setTimeout(() => {
      const { x, y } = center(o.bucket);
      const candies = [...o.pile.querySelectorAll('.c')].map((c) => c.textContent);
      o.bucket.classList.remove('charging');
      o.bucket.classList.add('popping');
      o.pile.innerHTML = '';
      Spooky.play('pop');
      flash(x, y);
      burst(x, y - 40, [...(candies.length ? candies : ['🍬']), ...SPARKS], { count: 44, power: 1.1 });
      spinGhosts();
      write(':popped', true);
      setTimeout(() => {
        o.bucket.classList.remove('popping');
        showHaul(true);
        o.haul.scrollIntoView({ behavior: 'smooth', block: 'start' });
        busy = false;
      }, 650);
    }, 1300);
  }

  // ---------- the candy haul ----------
  function progressText() {
    const n = o.messages.length;
    if (opened.size === n) return 'All unwrapped! Tap any candy to read it again 💜';
    return `${opened.size} / ${n} unwrapped · tap a candy to open it`;
  }

  function showHaul(animate) {
    const n = o.messages.length;
    o.count.textContent = n ? 'The candies are out! 🎉' : 'No candies this year… 👻';
    o.pile.innerHTML = '';
    o.haul.classList.remove('hidden');
    o.title.textContent = n ? `You got ${n} ${n === 1 ? 'candy' : 'candies'}!` : 'Nobody dropped a candy 🥲';
    o.progress.textContent = n ? progressText() : 'Maybe next Halloween!';
    o.jar.innerHTML = '';
    o.messages.forEach((m, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `wrapped${opened.has(i) ? ' opened' : ''}${animate ? ' enter' : ''}`;
      b.dataset.i = i;
      b.setAttribute('aria-label', `Unwrap candy ${i + 1}`);
      b.style.setProperty('--paper', PAPER[m.candy] || PAPER.candy);
      b.style.setProperty('--ink', INK[m.candy] || INK.candy);
      b.style.setProperty('--r', `${Math.round((seeded(i + 11) - 0.5) * 30)}deg`);
      b.style.setProperty('--d', `${(i * 0.07).toFixed(2)}s`);
      b.style.setProperty('--bob', `${(2.4 + seeded(i + 5) * 1.4).toFixed(2)}s`);
      b.innerHTML = '<span class="sweet"></span>';
      b.querySelector('.sweet').textContent = CANDY_EMOJI[m.candy] || '🍬';
      o.jar.appendChild(b);
    });
  }

  // ---------- unwrapping a candy into a letter ----------
  function unwrap(i) {
    const m = o.messages[i];
    const modal = o.modal;
    modal.style.setProperty('--paper', PAPER[m.candy] || PAPER.candy);
    modal.style.setProperty('--ink', INK[m.candy] || INK.candy);
    $('#unwrap-candy').textContent = CANDY_EMOJI[m.candy] || '🍬';
    $('#letter-sticker').textContent = CANDY_EMOJI[m.candy] || '🍬';
    $('#letter-text').textContent = m.text;
    $('#letter-from').textContent = `— ${m.sender}${m.sender === 'Anonymous ghost' ? ' 👻' : ''}`;
    $('#letter-count').textContent = `candy ${i + 1} of ${o.messages.length}`;
    modal.className = 'modal open stage-spin';
    Spooky.play('unwrap');
    setTimeout(() => {
      modal.className = 'modal open stage-letter';
      const { x, y } = center($('#letter'));
      burst(x, y - 60, SPARKS, { count: 14, power: 0.55 });
      Spooky.play('open');
    }, 560);

    opened.add(i);
    write(':read', [...opened]);
    const b = o.jar.querySelector(`[data-i="${i}"]`);
    if (b) b.classList.add('opened');
    o.progress.textContent = progressText();
  }

  function closeLetter() {
    if (!o.modal.classList.contains('stage-letter')) return;
    o.modal.className = 'modal';
    if (!celebrated && opened.size === o.messages.length) {
      celebrated = true;
      write(':celebrated', true);
      const { x, y } = center(o.jar);
      burst(x, y, [...SPARKS, '🎃', '🍬', '🍭'], { count: 40, power: 1 });
      Spooky.play('pop');
      spinGhosts();
      toast('You unwrapped them all! Happy Halloween 🎃');
    }
  }

  function show(opts) {
    o = opts;
    opened = new Set(read(':read', []));
    celebrated = read(':celebrated', false);
    if (read(':popped', false)) {
      o.openBtn.classList.add('hidden');
      showHaul(false);
    } else {
      o.haul.classList.add('hidden');
      o.openBtn.classList.remove('hidden');
    }
  }

  function hide() {
    if (!o) return;
    o.openBtn.classList.add('hidden');
    o.haul.classList.add('hidden');
  }

  function wire({ openBtn, jar, modal }) {
    openBtn.addEventListener('click', () => pop());
    jar.addEventListener('click', (e) => {
      const b = e.target.closest('.wrapped');
      if (b) unwrap(Number(b.dataset.i));
    });
    modal.addEventListener('click', closeLetter);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLetter(); });
  }

  return { show, hide, pop, wire };
})();
