/* ============================================================================
 *  model.js  —  The prediction engine
 *  ---------------------------------------------------------------------------
 *  Combines three independent signals into one probability estimate:
 *    1. A bivariate Poisson goals model (attack/defence strengths)
 *    2. An Elo-derived win expectancy
 *    3. A recent-form momentum adjustment
 *  Then runs a Monte-Carlo simulation to stress-test the analytic result and
 *  derives fair odds, market value and a basket of side-markets.
 * ==========================================================================*/

const MAX_GOALS = 8; // model scorelines 0..8 for each side

/* Poisson probability mass: P(X = k) for mean lambda */
function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/* Convert a W/D/L form array into a momentum multiplier centred on 1.00 */
function formFactor(form) {
  const pts = form.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
  const max = form.length * 3;
  // ranges roughly 0.93 .. 1.07
  return 0.93 + (pts / max) * 0.14;
}

/* Elo win expectancy for A vs B (returns P(A wins or share)) */
function eloExpectancy(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/* ----------------------------------------------------------------------------
 *  Expected goals (lambda) for each side.
 *  home_xg = base * homeAttack * awayWeakness * form * homeAdvantage
 *  Defence rating >1 means "strong" so we invert it into a weakness factor.
 * --------------------------------------------------------------------------*/
function expectedGoals(home, away, neutral = true) {
  const homeAdv = neutral ? 1.0 : 1.12;
  const awayAdv = neutral ? 1.0 : 0.92;

  const homeWeakness = 1 / home.defense; // how easy it is to score on `home`
  const awayWeakness = 1 / away.defense;

  let homeXg =
    LEAGUE_AVG_GOALS * home.attack * awayWeakness * formFactor(home.form) * homeAdv;
  let awayXg =
    LEAGUE_AVG_GOALS * away.attack * homeWeakness * formFactor(away.form) * awayAdv;

  // Blend Poisson means slightly toward the Elo expectation so a big rating
  // gap is reflected even when raw goal profiles are close.
  const eloHome = eloExpectancy(home.elo, away.elo);
  const tilt = (eloHome - 0.5) * 0.6; // -0.3 .. +0.3
  homeXg *= 1 + tilt * 0.5;
  awayXg *= 1 - tilt * 0.5;

  return { homeXg: clamp(homeXg, 0.2, 4.5), awayXg: clamp(awayXg, 0.2, 4.5) };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/* ----------------------------------------------------------------------------
 *  Build the full scoreline probability matrix and aggregate markets.
 * --------------------------------------------------------------------------*/
function buildModel(homeKey, awayKey) {
  const home = TEAMS[homeKey];
  const away = TEAMS[awayKey];
  const { homeXg, awayXg } = expectedGoals(home, away);

  // Independent-Poisson scoreline matrix
  const matrix = [];
  let pHome = 0, pDraw = 0, pAway = 0;
  let pBtts = 0, pOver25 = 0, pUnder25 = 0;
  const scoreList = [];

  for (let h = 0; h <= MAX_GOALS; h++) {
    matrix[h] = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poisson(h, homeXg) * poisson(a, awayXg);
      matrix[h][a] = p;
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
      if (h > 0 && a > 0) pBtts += p;
      if (h + a > 2.5) pOver25 += p; else pUnder25 += p;
      scoreList.push({ h, a, p });
    }
  }

  // Normalise (matrix is truncated at MAX_GOALS)
  const total = pHome + pDraw + pAway;
  pHome /= total; pDraw /= total; pAway /= total;
  pBtts /= total; pOver25 /= total; pUnder25 /= total;

  scoreList.sort((x, y) => y.p - x.p);
  const topScores = scoreList.slice(0, 6).map((s) => ({
    label: `${s.h} - ${s.a}`,
    prob: s.p / total,
  }));

  // Monte-Carlo verification
  const mc = monteCarlo(homeXg, awayXg, 20000);

  // Blend analytic + simulated (they should be very close — average them)
  const probs = {
    home: (pHome + mc.home) / 2,
    draw: (pDraw + mc.draw) / 2,
    away: (pAway + mc.away) / 2,
  };
  const norm = probs.home + probs.draw + probs.away;
  probs.home /= norm; probs.draw /= norm; probs.away /= norm;

  return {
    home, away, homeKey, awayKey,
    homeXg, awayXg,
    matrix,
    probs,
    markets: {
      btts: pBtts,
      noBtts: 1 - pBtts,
      over25: pOver25,
      under25: pUnder25,
      mostLikelyScore: topScores[0],
    },
    topScores,
    fairOdds: {
      home: 1 / probs.home,
      draw: 1 / probs.draw,
      away: 1 / probs.away,
    },
    elo: {
      home: home.elo,
      away: away.elo,
      homeExp: eloExpectancy(home.elo, away.elo),
    },
    mc,
  };
}

/* Monte-Carlo: draw N independent Poisson scorelines */
function monteCarlo(homeXg, awayXg, n) {
  let h = 0, d = 0, a = 0, gf = 0, ga = 0;
  for (let i = 0; i < n; i++) {
    const hs = samplePoisson(homeXg);
    const as = samplePoisson(awayXg);
    gf += hs; ga += as;
    if (hs > as) h++; else if (hs === as) d++; else a++;
  }
  return {
    home: h / n, draw: d / n, away: a / n,
    runs: n,
    avgHome: gf / n, avgAway: ga / n,
  };
}

/* Knuth's algorithm for sampling a Poisson variate */
function samplePoisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

/* ----------------------------------------------------------------------------
 *  Value detection: compare model fair odds to a typical bookmaker price
 *  (we synthesise a market price by adding a ~6% overround to fair odds and
 *  nudging it, so the dashboard can flag where the model sees an edge).
 * --------------------------------------------------------------------------*/
function deriveMarket(model) {
  const overround = 1.06;
  const out = {};
  ["home", "draw", "away"].forEach((k, i) => {
    const fair = model.fairOdds[k];
    // simulate a slightly mispriced book line
    const wobble = [0.96, 1.05, 1.0][i];
    const bookOdds = (fair / overround) * wobble;
    const modelProb = model.probs[k];
    const bookImplied = 1 / bookOdds;
    const edge = modelProb - bookImplied; // >0 means value
    out[k] = {
      fairOdds: fair,
      bookOdds,
      modelProb,
      bookImplied,
      edge,
      value: edge > 0.02,
    };
  });
  return out;
}
