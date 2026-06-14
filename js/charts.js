// ===== CHART DRAWING MODULE =====
import { getCat } from './utils.js';

let _fmt = (n, c) => c + Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
let _fmtShort = (n, c) => c + Number(n||0).toLocaleString('en-IN', {maximumFractionDigits:0});

export function setChartUtils(fmtFn, fmtShortFn) {
  _fmt = fmtFn;
  _fmtShort = fmtShortFn;
}

function setupCanvas(canvasId, height) {
  const canvas = document.getElementById(canvasId);
  if(!canvas) return null;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth;
  const h = height || 200;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  return { canvas, ctx, w, h };
}

function getThemeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function getFont(size) {
  return size + 'px ' + getComputedStyle(document.body).fontFamily;
}

function drawNoData(ctx, w, h, msg) {
  ctx.fillStyle = getThemeColor('--text3');
  ctx.font = getFont(14);
  ctx.textAlign = 'center';
  ctx.fillText(msg || 'No data yet', w / 2, h / 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ease-out cubic
function ease(t) { return 1 - Math.pow(1 - t, 3); }

function animate(duration, drawFrame) {
  if(typeof requestAnimationFrame === 'undefined') { drawFrame(1); return; }
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    drawFrame(ease(t));
    if(t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function drawPieChart(canvasId, data, total, currency) {
  const s = setupCanvas(canvasId, 260);
  if(!s) return;
  const { ctx, w, h } = s;

  if(!data.length) { drawNoData(ctx, w, h); return; }

  const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 24;
  const duration = 1600;

  function drawSlice(progress) {
    ctx.clearRect(0, 0, w, h);
    let start = -Math.PI / 2;
    const endAngle = -Math.PI / 2 + progress * Math.PI * 2;

    data.forEach(d => {
      const angle = (d.amount / total) * Math.PI * 2;
      const sliceEnd = start + angle;
      const drawEnd = Math.min(sliceEnd, endAngle);

      if(drawEnd > start) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, drawEnd);
        ctx.closePath();
        ctx.fillStyle = getCat(d.category).color;
        ctx.fill();

        if(angle > 0.15 && progress > 0.5) {
          const labelAlpha = Math.min(1, (progress - 0.5) * 4);
          const mid = start + angle / 2;
          const tx = cx + Math.cos(mid) * (r * 0.65);
          const ty = cy + Math.sin(mid) * (r * 0.65);
          ctx.globalAlpha = labelAlpha;
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + getFont(11);
          ctx.textAlign = 'center';
          ctx.fillText(Math.round(d.amount / total * 100) + '%', tx, ty);
          ctx.globalAlpha = 1;
        }
      }
      start += angle;
    });

    // donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = getThemeColor('--bg2');
    ctx.fill();

    // center text (fade in during second half)
    if(progress > 0.3) {
      const textAlpha = Math.min(1, (progress - 0.3) * 2);
      ctx.globalAlpha = textAlpha;
      ctx.fillStyle = getThemeColor('--text');
      ctx.font = 'bold ' + getFont(14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(_fmt(total, currency || '৳'), cx, cy - 8);
      ctx.font = getFont(11);
      ctx.fillStyle = getThemeColor('--text3');
      ctx.fillText('Total', cx, cy + 10);
      ctx.globalAlpha = 1;
    }
  }

  animate(duration, drawSlice);
}

export function drawBarChart(canvasId, data, labels, color, currency) {
  const s = setupCanvas(canvasId, 200);
  if(!s) return;
  const { ctx, w, h } = s;

  if(!data.length) { drawNoData(ctx, w, h); return; }

  const maxVal = Math.max(...data, 1);
  const barW = Math.min(40, (w - 60) / data.length - 8);
  const chartH = h - 50;
  const startX = 40;
  const duration = 1400;

  function drawFrame(progress) {
    ctx.clearRect(0, 0, w, h);

    // grid lines
    ctx.strokeStyle = getThemeColor('--border');
    ctx.lineWidth = 0.5;
    for(let i = 0; i <= 4; i++) {
      const y = h - 30 - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(startX - 5, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }

    data.forEach((v, i) => {
      const x = startX + i * (barW + 8) + 4;
      const fullBarH = (v / maxVal) * chartH;
      const barH = fullBarH * progress;
      const y = h - 30 - barH;

      const grad = ctx.createLinearGradient(x, y, x, h - 30);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '44');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, barW, barH, 4);
      ctx.fill();

      ctx.fillStyle = getThemeColor('--text3');
      ctx.font = getFont(9);
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, h - 14);

      if(v > 0 && progress > 0.7) {
        const alpha = Math.min(1, (progress - 0.7) * 3.3);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = getThemeColor('--text2');
        ctx.font = getFont(9);
        ctx.fillText(_fmtShort(v, currency || '₹'), x + barW / 2, y - 6);
        ctx.globalAlpha = 1;
      }
    });
  }

  animate(duration, drawFrame);
}

export function drawLineChart(canvasId, data, labels, color) {
  const s = setupCanvas(canvasId, 200);
  if(!s) return;
  const { ctx, w, h } = s;

  if(data.length < 2) { drawNoData(ctx, w, h, 'Need more data'); return; }

  const maxVal = Math.max(...data, 1);
  const chartH = h - 50;
  const startX = 40;
  const stepX = (w - 60) / (data.length - 1);
  const pts = data.map((v, i) => ({ x: startX + i * stepX, y: h - 30 - (v / maxVal) * chartH }));
  const duration = 1600;

  function drawFrame(progress) {
    ctx.clearRect(0, 0, w, h);

    // grid lines
    ctx.strokeStyle = getThemeColor('--border');
    ctx.lineWidth = 0.5;
    for(let i = 0; i <= 4; i++) {
      const y = h - 30 - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(startX - 5, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }

    // determine how many points to draw
    const drawCount = Math.max(2, Math.ceil(pts.length * progress));
    const lastFrac = (pts.length * progress) - Math.floor(pts.length * progress) || 1;
    const drawPts = pts.slice(0, drawCount);

    // draw line
    ctx.beginPath();
    ctx.moveTo(drawPts[0].x, drawPts[0].y);
    for(let i = 1; i < drawPts.length; i++) {
      if(i === drawPts.length - 1 && drawCount < pts.length) {
        const prev = drawPts[i - 1];
        const target = pts[i];
        const ix = prev.x + (target.x - prev.x) * lastFrac;
        const iy = prev.y + (target.y - prev.y) * lastFrac;
        ctx.lineTo(ix, iy);
      } else {
        ctx.lineTo(drawPts[i].x, drawPts[i].y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // area fill
    const lastDrawn = drawPts[drawPts.length - 1];
    ctx.lineTo(lastDrawn.x, h - 30);
    ctx.lineTo(drawPts[0].x, h - 30);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // dots and labels
    drawPts.forEach((p, i) => {
      if(i === drawPts.length - 1 && drawCount < pts.length) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      if(i % Math.max(1, Math.floor(data.length / 7)) === 0 && progress > 0.8) {
        ctx.globalAlpha = Math.min(1, (progress - 0.8) * 5);
        ctx.fillStyle = getThemeColor('--text3');
        ctx.font = getFont(9);
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], p.x, h - 14);
        ctx.globalAlpha = 1;
      }
    });
  }

  animate(duration, drawFrame);
}

export function drawHealthRing(canvasId, score) {
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 100;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2, r = 40, lw = 7;
  const startAngle = -Math.PI / 2;
  const pct = score / 100;
  const col = score >= 70 ? getThemeColor('--green') : score >= 50 ? getThemeColor('--yellow') : getThemeColor('--red');
  const duration = 1800;

  function drawFrame(progress) {
    ctx.clearRect(0, 0, size, size);

    // bg ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = getThemeColor('--bg4');
    ctx.lineWidth = lw;
    ctx.stroke();

    // animated arc
    if(score > 0) {
      const currentPct = pct * progress;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + currentPct * Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();

      // glow
      ctx.shadowColor = col;
      ctx.shadowBlur = 8 * progress;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + currentPct * Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  animate(duration, drawFrame);
}
