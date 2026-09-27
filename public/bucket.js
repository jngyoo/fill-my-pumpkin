// Shared pumpkin bucket rendering, used by both pages.
const CANDY_EMOJI = {
  candy: '🍬',
  lollipop: '🍭',
  chocolate: '🍫',
  donut: '🍩',
  cookie: '🍪',
  cupcake: '🧁',
};

const BUCKET_SVG = `
<svg class="bucket" viewBox="0 0 300 250" aria-hidden="true">
  <path d="M60 70 Q150 -40 240 70" fill="none" stroke="#3a2a1a" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="150" cy="150" rx="140" ry="100" fill="#ff7a1a"/>
  <path d="M95 60 Q70 150 95 245 M205 60 Q230 150 205 245 M150 50 L150 250" stroke="#e05a00" stroke-width="6" fill="none" opacity=".55"/>
  <ellipse cx="150" cy="62" rx="100" ry="18" fill="#4a1e00"/>
  <path d="M85 125 L115 110 L115 140 Z" fill="#2a1000"/>
  <path d="M215 125 L185 110 L185 140 Z" fill="#2a1000"/>
  <path d="M90 175 Q150 225 210 175 L195 180 L185 195 L170 184 L150 200 L130 184 L115 195 L105 180 Z" fill="#2a1000"/>
  <ellipse cx="95" cy="95" rx="18" ry="30" fill="#fff" opacity=".18" transform="rotate(-25 95 95)"/>
</svg>`;

// Deterministic pseudo-random so the pile looks the same on every reload.
function seeded(i) {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// Candies stack into a mound: fill rows from the bottom, each row a bit narrower.
function candyPosition(i) {
  let row = 0;
  let start = 0;
  let perRow = 7;
  while (i >= start + perRow) {
    start += perRow;
    row += 1;
    perRow = Math.max(3, perRow - 1);
  }
  const slot = i - start;
  const width = perRow / 7; // fraction of pile width this row spans
  const x = 50 + (((slot + 0.5) / perRow) - 0.5) * 100 * width + (seeded(i) - 0.5) * 8;
  const bottom = row * 14 + seeded(i + 7) * 5;
  const rot = Math.round((seeded(i + 3) - 0.5) * 70);
  return { x, bottom, rot };
}

const MAX_VISIBLE = 31;

function renderPile(pileEl, kinds, { newCount = 0, clickable = false } = {}) {
  pileEl.innerHTML = '';
  const shown = kinds.slice(0, MAX_VISIBLE);
  shown.forEach((kind, i) => {
    const el = document.createElement(clickable ? 'button' : 'span');
    el.className = 'c';
    el.dataset.index = i;
    el.textContent = CANDY_EMOJI[kind] || '🍬';
    const { x, bottom, rot } = candyPosition(i);
    el.style.left = `${x}%`;
    el.style.bottom = `${bottom}%`;
    el.style.setProperty('--r', `${rot}deg`);
    if (clickable) el.setAttribute('aria-label', `Open candy ${i + 1}`);
    if (i >= shown.length - newCount) {
      el.classList.add('new');
      el.style.animationDelay = `${(i - (shown.length - newCount)) * 0.08}s`;
    }
    pileEl.appendChild(el);
  });
}

function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function ownerTokenFor(id) {
  try { return localStorage.getItem(`pumpkin-owner:${id}`); } catch { return null; }
}

function saveOwnerToken(id, token, name) {
  try {
    localStorage.setItem(`pumpkin-owner:${id}`, token);
    const mine = JSON.parse(localStorage.getItem('my-pumpkins') || '[]').filter((p) => p.id !== id);
    mine.unshift({ id, name });
    localStorage.setItem('my-pumpkins', JSON.stringify(mine.slice(0, 10)));
  } catch { /* storage blocked — owner link still works */ }
}

function myPumpkins() {
  try { return JSON.parse(localStorage.getItem('my-pumpkins') || '[]'); } catch { return []; }
}
