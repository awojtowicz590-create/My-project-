/* ============================================================================
 *  charts.js  —  Dependency-free SVG/Canvas visualisations
 *  All charts are hand-rendered so the dashboard works offline with zero
 *  external libraries — just open index.html.
 * ==========================================================================*/

const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, children = []) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  children.forEach((c) => n.appendChild(c));
  return n;
}

/* ---- 1X2 probability stacked bar -----------------------------------------*/
function renderProbBar(container, probs, home, away) {
  container.innerHTML = "";
  const segs = [
    { label: home.code, val: probs.home, color: home.colors[0] },
    { label: "Draw", val: probs.draw, color: "#7a8699" },
    { label: away.code, val: probs.away, color: away.colors[0] },
  ];
  segs.forEach((s) => {
    const seg = document.createElement("div");
    seg.className = "prob-seg";
    seg.style.width = (s.val * 100).toFixed(1) + "%";
    seg.style.background = s.color;
    seg.innerHTML = `<span class="seg-lbl">${s.label}</span><span class="seg-val">${(s.val * 100).toFixed(0)}%</span>`;
    seg.title = `${s.label}: ${(s.val * 100).toFixed(1)}%`;
    container.appendChild(seg);
  });
}

/* ---- Scoreline heatmap (SVG) ---------------------------------------------*/
function renderHeatmap(container, matrix, home, away, maxShow = 6) {
  container.innerHTML = "";
  const size = 46, pad = 34, w = pad + size * maxShow, h = pad + size * maxShow;
  const svg = el("svg", { viewBox: `0 0 ${w + 8} ${h + 8}`, class: "heatmap-svg" });

  // find max for colour scaling within shown window
  let max = 0;
  for (let i = 0; i < maxShow; i++)
    for (let j = 0; j < maxShow; j++) max = Math.max(max, matrix[i][j]);

  for (let hG = 0; hG < maxShow; hG++) {
    for (let aG = 0; aG < maxShow; aG++) {
      const p = matrix[hG][aG];
      const t = Math.pow(p / max, 0.55);
      const x = pad + aG * size, y = pad + hG * size;
      svg.appendChild(el("rect", {
        x: x + 2, y: y + 2, width: size - 4, height: size - 4, rx: 6,
        fill: heatColor(t),
        stroke: hG === aG ? "rgba(255,255,255,.25)" : "none",
        "stroke-width": hG === aG ? 1.5 : 0,
      }));
      const txt = el("text", {
        x: x + size / 2, y: y + size / 2 + 4, "text-anchor": "middle",
        class: "heat-txt", fill: t > 0.5 ? "#06121f" : "rgba(255,255,255,.82)",
      });
      txt.textContent = (p * 100).toFixed(0);
      svg.appendChild(txt);
    }
  }
  // axis labels
  for (let i = 0; i < maxShow; i++) {
    const colL = el("text", { x: pad + i * size + size / 2, y: 20, "text-anchor": "middle", class: "axis-lbl" });
    colL.textContent = i;
    svg.appendChild(colL);
    const rowL = el("text", { x: 16, y: pad + i * size + size / 2 + 4, "text-anchor": "middle", class: "axis-lbl" });
    rowL.textContent = i;
    svg.appendChild(rowL);
  }
  container.appendChild(svg);

  const cap = document.createElement("div");
  cap.className = "heat-caption";
  cap.innerHTML = `<span>${away.flag} ${away.code} goals →</span><span>↑ ${home.flag} ${home.code} goals</span><span class="muted">values = % chance</span>`;
  container.appendChild(cap);
}

function heatColor(t) {
  // dark navy -> teal -> gold
  const stops = [
    [12, 22, 38],
    [16, 78, 110],
    [22, 150, 160],
    [120, 200, 120],
    [245, 200, 70],
  ];
  const seg = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ---- Radar / spider chart comparing two teams ----------------------------*/
function renderRadar(container, teamA, teamB) {
  container.innerHTML = "";
  const axes = ["attack", "defense", "midfield", "pace", "setpiece", "experience"];
  const labels = ["Attack", "Defence", "Midfield", "Pace", "Set-piece", "Exp."];
  const size = 300, cx = size / 2, cy = size / 2, R = 110;
  const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, class: "radar-svg" });

  // grid rings
  [0.25, 0.5, 0.75, 1].forEach((r) => {
    svg.appendChild(polygon(axes.length, cx, cy, R * r, "none", "rgba(255,255,255,.08)"));
  });
  // spokes + labels
  axes.forEach((_, i) => {
    const ang = angle(i, axes.length);
    svg.appendChild(el("line", {
      x1: cx, y1: cy, x2: cx + Math.cos(ang) * R, y2: cy + Math.sin(ang) * R,
      stroke: "rgba(255,255,255,.08)",
    }));
    const lx = cx + Math.cos(ang) * (R + 22), ly = cy + Math.sin(ang) * (R + 22);
    const t = el("text", { x: lx, y: ly + 4, "text-anchor": "middle", class: "radar-lbl" });
    t.textContent = labels[i];
    svg.appendChild(t);
  });

  svg.appendChild(radarShape(teamA.radar, axes, cx, cy, R, teamA.colors[0]));
  svg.appendChild(radarShape(teamB.radar, axes, cx, cy, R, teamB.colors[0]));
  container.appendChild(svg);

  const legend = document.createElement("div");
  legend.className = "radar-legend";
  legend.innerHTML =
    `<span><i style="background:${teamA.colors[0]}"></i>${teamA.flag} ${teamA.name}</span>` +
    `<span><i style="background:${teamB.colors[0]}"></i>${teamB.flag} ${teamB.name}</span>`;
  container.appendChild(legend);
}

function radarShape(data, axes, cx, cy, R, color) {
  const pts = axes.map((a, i) => {
    const ang = angle(i, axes.length);
    const r = (data[a] / 100) * R;
    return `${cx + Math.cos(ang) * r},${cy + Math.sin(ang) * r}`;
  }).join(" ");
  const g = el("g");
  g.appendChild(el("polygon", { points: pts, fill: hexA(color, 0.18), stroke: color, "stroke-width": 2 }));
  axes.forEach((a, i) => {
    const ang = angle(i, axes.length);
    const r = (data[a] / 100) * R;
    g.appendChild(el("circle", { cx: cx + Math.cos(ang) * r, cy: cy + Math.sin(ang) * r, r: 3, fill: color }));
  });
  return g;
}

function polygon(n, cx, cy, r, fill, stroke) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = angle(i, n);
    pts.push(`${cx + Math.cos(ang) * r},${cy + Math.sin(ang) * r}`);
  }
  return el("polygon", { points: pts.join(" "), fill, stroke, "stroke-width": 1 });
}
function angle(i, n) { return (Math.PI * 2 * i) / n - Math.PI / 2; }
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---- Goal distribution curves (expected goals as Poisson lines) ----------*/
function renderGoalCurve(container, model) {
  container.innerHTML = "";
  const w = 360, h = 180, pad = 28;
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, class: "curve-svg" });
  const ks = [0, 1, 2, 3, 4, 5];
  const maxY = 0.42;

  const line = (lambda, color) => {
    const pts = ks.map((k) => {
      const x = pad + (k / (ks.length - 1)) * (w - pad * 2);
      const y = h - pad - (poisson(k, lambda) / maxY) * (h - pad * 2);
      return [x, y];
    });
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
    svg.appendChild(el("path", { d: path, fill: "none", stroke: color, "stroke-width": 2.5 }));
    pts.forEach((p) => svg.appendChild(el("circle", { cx: p[0], cy: p[1], r: 3, fill: color })));
  };

  // baseline
  svg.appendChild(el("line", { x1: pad, y1: h - pad, x2: w - pad, y2: h - pad, stroke: "rgba(255,255,255,.12)" }));
  ks.forEach((k) => {
    const x = pad + (k / (ks.length - 1)) * (w - pad * 2);
    const t = el("text", { x, y: h - 8, "text-anchor": "middle", class: "axis-lbl" });
    t.textContent = k;
    svg.appendChild(t);
  });

  line(model.homeXg, model.home.colors[0]);
  line(model.awayXg, model.away.colors[0]);
  container.appendChild(svg);

  const legend = document.createElement("div");
  legend.className = "radar-legend";
  legend.innerHTML =
    `<span><i style="background:${model.home.colors[0]}"></i>${model.home.code} xG ${model.homeXg.toFixed(2)}</span>` +
    `<span><i style="background:${model.away.colors[0]}"></i>${model.away.code} xG ${model.awayXg.toFixed(2)}</span>`;
  container.appendChild(legend);
}
