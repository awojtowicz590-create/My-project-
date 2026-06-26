/* ============================================================================
 *  app.js  —  Builds the dashboard UI from the model output
 * ==========================================================================*/

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("matches");
  FIXTURES.forEach((fx) => {
    const model = buildModel(fx.home, fx.away);
    const market = deriveMarket(model);
    root.appendChild(buildMatchCard(fx, model, market));
  });
  animateCounters();
});

function buildMatchCard(fx, m, market) {
  const card = document.createElement("section");
  card.className = "match-card";
  const fav =
    m.probs.home > m.probs.away && m.probs.home > m.probs.draw ? m.home :
    m.probs.away > m.probs.draw ? m.away : null;

  card.innerHTML = `
    <div class="mc-head" style="--c1:${m.home.colors[0]};--c2:${m.away.colors[0]}">
      <div class="team-side">
        <div class="team-flag">${m.home.flag}</div>
        <div class="team-meta">
          <h2>${m.home.name}</h2>
          <span class="team-nick">${m.home.nickname}</span>
          <span class="team-tags">FIFA #${m.home.fifaRank} · Elo ${m.home.elo} · ${m.home.confederation}</span>
        </div>
      </div>
      <div class="vs-block">
        <span class="vs">VS</span>
        <span class="comp">${fx.competition}</span>
        <span class="venue">${fx.venue}</span>
      </div>
      <div class="team-side right">
        <div class="team-meta">
          <h2>${m.away.name}</h2>
          <span class="team-nick">${m.away.nickname}</span>
          <span class="team-tags">FIFA #${m.away.fifaRank} · Elo ${m.away.elo} · ${m.away.confederation}</span>
        </div>
        <div class="team-flag">${m.away.flag}</div>
      </div>
    </div>

    <p class="narrative">${fx.narrative}</p>

    <div class="verdict">
      <div class="verdict-main">
        <span class="verdict-label">Model verdict</span>
        <span class="verdict-pick">${fav ? `${fav.flag} ${fav.name} favoured` : "Too close to call"}</span>
        <span class="verdict-score">Most likely score · <b>${m.topScores[0].label}</b> (${(m.topScores[0].prob * 100).toFixed(1)}%)</span>
      </div>
      <div class="verdict-xg">
        <div><span class="big" data-count="${m.homeXg.toFixed(2)}">0.00</span><small>${m.home.code} xG</small></div>
        <div><span class="big" data-count="${m.awayXg.toFixed(2)}">0.00</span><small>${m.away.code} xG</small></div>
        <div><span class="big" data-count="${m.mc.runs}">0</span><small>simulations</small></div>
      </div>
    </div>

    <div class="grid">
      <div class="panel wide">
        <h3>Match Result Probability (1X2)</h3>
        <div class="prob-bar" id="bar-${fx.id}"></div>
        <div class="odds-row">
          <div class="odds-cell"><small>${m.home.code} win</small><b>${(m.probs.home*100).toFixed(1)}%</b><span>fair ${m.fairOdds.home.toFixed(2)}</span></div>
          <div class="odds-cell"><small>Draw</small><b>${(m.probs.draw*100).toFixed(1)}%</b><span>fair ${m.fairOdds.draw.toFixed(2)}</span></div>
          <div class="odds-cell"><small>${m.away.code} win</small><b>${(m.probs.away*100).toFixed(1)}%</b><span>fair ${m.fairOdds.away.toFixed(2)}</span></div>
        </div>
      </div>

      <div class="panel">
        <h3>Team Strength Radar</h3>
        <div id="radar-${fx.id}"></div>
      </div>

      <div class="panel">
        <h3>Scoreline Probability Map</h3>
        <div id="heat-${fx.id}"></div>
      </div>

      <div class="panel">
        <h3>Goal Distribution (Poisson)</h3>
        <div id="curve-${fx.id}"></div>
      </div>

      <div class="panel">
        <h3>Side Markets</h3>
        ${marketRow("Both teams to score", m.markets.btts)}
        ${marketRow("Over 2.5 goals", m.markets.over25)}
        ${marketRow("Under 2.5 goals", m.markets.under25)}
        ${marketRow("Clean sheet edge", m.elo.homeExp)}
        <div class="topscores">
          ${m.topScores.map(s => `<span class="chip"><b>${s.label}</b> ${(s.prob*100).toFixed(1)}%</span>`).join("")}
        </div>
      </div>

      <div class="panel">
        <h3>Value Detector <small class="muted">model vs simulated book</small></h3>
        ${valueRow(m.home.code + " win", market.home)}
        ${valueRow("Draw", market.draw)}
        ${valueRow(m.away.code + " win", market.away)}
        <p class="disclaimer-mini">Book prices are synthesised for demonstration.</p>
      </div>

      <div class="panel">
        <h3>Head-to-Head History</h3>
        ${h2hBlock(fx, m)}
      </div>

      <div class="panel">
        <h3>Recent Form &amp; Key Players</h3>
        ${formBlock(m.home)}
        ${formBlock(m.away)}
      </div>
    </div>
  `;

  // defer chart rendering until card is in DOM
  setTimeout(() => {
    renderProbBar(card.querySelector(`#bar-${fx.id}`), m.probs, m.home, m.away);
    renderRadar(card.querySelector(`#radar-${fx.id}`), m.home, m.away);
    renderHeatmap(card.querySelector(`#heat-${fx.id}`), m.matrix, m.home, m.away);
    renderGoalCurve(card.querySelector(`#curve-${fx.id}`), m);
  }, 0);

  return card;
}

function marketRow(label, prob) {
  return `<div class="mkt-row">
    <span>${label}</span>
    <div class="mkt-track"><div class="mkt-fill" style="width:${(prob*100).toFixed(0)}%"></div></div>
    <b>${(prob*100).toFixed(0)}%</b>
  </div>`;
}

function valueRow(label, v) {
  const cls = v.value ? "value-yes" : "value-no";
  const sign = v.edge >= 0 ? "+" : "";
  return `<div class="val-row ${cls}">
    <span class="val-lbl">${label}</span>
    <span class="val-cell">model ${(v.modelProb*100).toFixed(1)}%</span>
    <span class="val-cell">book ${v.bookOdds.toFixed(2)}</span>
    <span class="val-edge">${sign}${(v.edge*100).toFixed(1)}% ${v.value ? "✓ VALUE" : ""}</span>
  </div>`;
}

function h2hBlock(fx, m) {
  const h = fx.h2h;
  const pct = (n) => h.played ? (n / h.played * 100).toFixed(0) : 0;
  const rows = h.history.map(g =>
    `<tr><td>${g.date}</td><td>${g.comp}</td><td class="score">${g.score}</td><td class="muted">${g.note}</td></tr>`
  ).join("");
  return `
    <div class="h2h-summary">
      <div class="h2h-stat"><b>${h.homeWins}</b><small>${m.home.code} wins</small></div>
      <div class="h2h-stat"><b>${h.draws}</b><small>Draws</small></div>
      <div class="h2h-stat"><b>${h.awayWins}</b><small>${m.away.code} wins</small></div>
      <div class="h2h-stat"><b>${h.played}</b><small>Played</small></div>
    </div>
    <div class="h2h-bar">
      <div style="width:${pct(h.homeWins)}%;background:${m.home.colors[0]}"></div>
      <div style="width:${pct(h.draws)}%;background:#7a8699"></div>
      <div style="width:${pct(h.awayWins)}%;background:${m.away.colors[0]}"></div>
    </div>
    <table class="h2h-table"><tbody>${rows}</tbody></table>
  `;
}

function formBlock(team) {
  const pills = team.form.map(r =>
    `<span class="form-pill f-${r}">${r}</span>`).join("");
  const players = team.keyPlayers.map(p =>
    `<li><b>${p.name}</b> <span class="role">${p.role}</span><small>${p.note}</small></li>`).join("");
  return `
    <div class="form-block">
      <div class="form-head"><span>${team.flag} ${team.name}</span><div class="form-pills">${pills}</div></div>
      <ul class="players">${players}</ul>
      <div class="honours">🏆 ${team.honours}</div>
    </div>`;
}

/* Count-up animation for the big stat numbers */
function animateCounters() {
  document.querySelectorAll("[data-count]").forEach((node) => {
    const target = parseFloat(node.dataset.count);
    const decimals = node.dataset.count.includes(".") ? 2 : 0;
    const dur = 900, start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      node.textContent = decimals ? val.toFixed(2) : Math.round(val).toLocaleString();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}
