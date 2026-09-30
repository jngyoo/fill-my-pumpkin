// Instagram story card (1080×1920) + the share flow.
// Instagram doesn't let a web page attach a link to a story, so we do what NGL and similar apps do:
// copy the link, hand the image to the story editor, and show the viewer where to drop a Link sticker.
const Story = (() => {
  const W = 1080;
  const H = 1920;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function svgImage(svg, w, h) {
    const src = svg.trim().replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"`);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // decorations are optional
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
    });
  }

  // Draw the bucket directly: avoid SVG image compositing and image shadows on mobile.
  function drawBucket(ctx, x, y, width, height) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(width / 300, height / 250);
    const path = (d, fill, stroke, lineWidth = 1) => {
      const shape = new Path2D(d);
      if (fill) { ctx.fillStyle = fill; ctx.fill(shape); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(shape); }
    };
    const ellipse = (x, y, rx, ry, fill, rotation = 0) => {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
    };
    ctx.lineCap = 'round';
    path('M60 70 Q150 -40 240 70', null, '#3a2a1a', 9);
    ellipse(150, 157, 140, 93, 'rgba(0,0,0,0.2)');
    ellipse(150, 150, 140, 100, '#ff7a1a');
    path('M95 60 Q70 150 95 245 M205 60 Q230 150 205 245 M150 50 L150 250', null, 'rgba(224,90,0,0.55)', 6);
    ellipse(150, 62, 100, 18, '#4a1e00');
    path('M85 125 L115 110 L115 140 Z', '#2a1000');
    path('M215 125 L185 110 L185 140 Z', '#2a1000');
    path('M90 175 Q150 225 210 175 L195 180 L185 195 L170 184 L150 200 L130 184 L115 195 L105 180 Z', '#2a1000');
    ellipse(95, 95, 18, 30, 'rgba(255,255,255,0.18)', -25 * Math.PI / 180);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(ctx, str, x, y, { font, color = '#fff4e6', shadow = null, align = 'center' } = {}) {
    ctx.save();
    ctx.font = `${font}, ${EMOJI_FONT}`; // emoji fall back to the system emoji font
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (shadow) { ctx.fillStyle = shadow; ctx.fillText(str, x, y + 8); ctx.fillStyle = color; }
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function daysLeft(unlockAt) {
    const d = Math.ceil((unlockAt - Date.now()) / 864e5);
    if (d <= 0) return 'Opening now!';
    if (d === 1) return 'Opens tomorrow — last chance!';
    return `Opens on Halloween · ${d} days left`;
  }

  async function makeCard({ count, kinds, unlockAt, url }) {
    await Promise.all([
      document.fonts.load('120px Griffy'),
      document.fonts.load('600 60px Fredoka'),
      document.fonts.load('500 40px Fredoka'),
    ]).catch(() => {});

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // night sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a1026');
    sky.addColorStop(0.65, '#2a1a3d');
    sky.addColorStop(1, '#43246a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 70; i++) {
      const r = seeded(i + 100) * 2.6 + 0.8;
      ctx.beginPath();
      ctx.arc(seeded(i) * W, seeded(i + 50) * H, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const [ghost, moon] = await Promise.all([
      svgImage(Spooky.GHOST_SVG, 100, 120),
      svgImage(Spooky.MOON_SVG, 100, 100),
    ]);

    // Instagram covers roughly the top and bottom 250px with its own UI; keep the message between.
    if (moon) ctx.drawImage(moon, 880, 95, 130, 130);
    text(ctx, 'Fill my pumpkin!', W / 2, 330, { font: '400 128px Griffy', color: '#ff7a1a', shadow: '#7a2e00' });
    text(ctx, 'Drop me an anonymous', W / 2, 455, { font: '500 56px Fredoka' });
    text(ctx, 'candy note 🍬', W / 2, 525, { font: '500 56px Fredoka' });

    // the bucket with its candy pile (same geometry as the page's .bucket-wrap)
    const wrapW = 640;
    const wrapH = wrapW * 0.9;
    const wrapX = (W - wrapW) / 2;
    const wrapY = 590;
    const bucketH = wrapW * (250 / 300);
    if (ghost) {
      ctx.drawImage(ghost, 70, 900, 120, 144);
      ctx.save();
      ctx.translate(955, 700);
      ctx.rotate(0.18);
      ctx.drawImage(ghost, -50, -60, 100, 120);
      ctx.restore();
    }
    drawBucket(ctx, wrapX, wrapY + wrapH - bucketH, wrapW, bucketH);
    const pileX = wrapX + wrapW * 0.2;
    const pileW = wrapW * 0.6;
    const pileH = wrapH * 0.4;
    const pileBottom = wrapY + wrapH * (1 - 0.68);
    kinds.slice(0, 31).forEach((kind, i) => {
      const { x, bottom, rot } = candyPosition(i);
      ctx.save();
      ctx.translate(pileX + (x / 100) * pileW, pileBottom - (bottom / 100) * pileH - 30);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.font = `66px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(CANDY_EMOJI[kind] || '🍬', 0, 0);
      ctx.restore();
    });

    const countLine = count === 0 ? 'Be my first candy 👀' : `${count} ${count === 1 ? 'candy' : 'candies'} so far`;
    text(ctx, countLine, W / 2, 1225, { font: '600 62px Fredoka' });

    // countdown pill
    ctx.font = `500 40px Fredoka, ${EMOJI_FONT}`;
    const pill = `🔒 ${daysLeft(unlockAt)}`;
    const pw = ctx.measureText(pill).width + 80;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, (W - pw) / 2, 1280, pw, 76, 38);
    ctx.fill();
    text(ctx, pill, W / 2, 1319, { font: '500 40px Fredoka', color: '#c9b6de' });

    // where the Link sticker goes (middle-lower third, with an arrow pointing at it)
    text(ctx, 'TAP THE LINK 👇', W / 2, 1450, { font: '600 58px Fredoka', color: '#ff7a1a' });
    ctx.save();
    ctx.setLineDash([22, 16]);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,244,230,0.55)';
    roundRect(ctx, (W - 640) / 2, 1510, 640, 150, 75);
    ctx.stroke();
    ctx.restore();
    text(ctx, 'put your link sticker here', W / 2, 1585, { font: '500 34px Fredoka', color: 'rgba(255,244,230,0.4)' });

    text(ctx, "I can't read them until Halloween 👻", W / 2, 1730, { font: '500 42px Fredoka', color: '#c9b6de' });
    text(ctx, url.replace(/^https?:\/\//, ''), W / 2, 1790, { font: '500 32px Fredoka', color: 'rgba(201,182,222,0.7)' });

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return { dataUrl, file: new File([blob], 'fill-my-pumpkin-story.png', { type: 'image/png' }) };
  }

  let current = null;

  async function copyLink(url) {
    try { await navigator.clipboard.writeText(url); return true; } catch { return false; }
  }

  // Called from the "Share to my story" tap (a user gesture, so the clipboard write is allowed).
  async function open({ state, url }) {
    const sheet = document.querySelector('#story-sheet');
    const copied = copyLink(url);
    sheet.classList.add('open');
    sheet.classList.add('loading');
    document.querySelector('#story-copied').textContent = '';
    current = await makeCard({ count: state.count, kinds: state.kinds, unlockAt: state.unlockAt, url });
    document.querySelector('#story-preview').src = current.dataUrl;
    const save = document.querySelector('#story-save');
    save.href = current.dataUrl;
    save.download = current.file.name;
    const canShareFile = Boolean(navigator.canShare && navigator.canShare({ files: [current.file] }));
    document.querySelector('#story-go').classList.toggle('hidden', !canShareFile);
    document.querySelector('#story-longpress').classList.toggle('hidden', canShareFile);
    document.querySelector('#story-copied').textContent = (await copied) ? '✅ Link copied!' : '';
    sheet.classList.remove('loading');
  }

  async function shareImage(url) {
    if (!current) return;
    copyLink(url); // copy again in case something else took the clipboard
    try {
      // iOS Safari shares files as text if a title is set, so keep it empty.
      await navigator.share({ files: [current.file], title: '' });
    } catch { /* cancelled */ }
  }

  function close() {
    document.querySelector('#story-sheet').classList.remove('open');
  }

  return { open, shareImage, close, copyLink, makeCard };
})();
