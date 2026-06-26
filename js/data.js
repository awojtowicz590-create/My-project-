/* ============================================================================
 *  data.js  —  Team, match & historical datasets
 *  ---------------------------------------------------------------------------
 *  All figures are research-based approximations assembled for modelling
 *  purposes (FIFA rankings, World-Football Elo, recent form & xG profiles as
 *  of mid-2026). They are intended for analytical/educational use only.
 * ==========================================================================*/

const TEAMS = {
  uruguay: {
    name: "Uruguay",
    code: "URU",
    flag: "🇺🇾",
    confederation: "CONMEBOL",
    nickname: "La Celeste",
    colors: ["#5ac8fa", "#0f3a63"],
    fifaRank: 15,
    elo: 1915,
    // Long-run scoring profile (goals per match, last ~30 competitive games)
    avgScored: 1.55,
    avgConceded: 0.95,
    // Attack / Defence strength relative to a 1.00 baseline (1.00 = average)
    attack: 1.18,
    defense: 1.32,        // higher = stronger defence (fewer conceded)
    // Recent form: most-recent-last,  W=3 D=1 L=0 used for momentum
    form: ["W", "W", "D", "W", "L", "W"],
    keyPlayers: [
      { name: "Darwin Núñez", role: "ST", note: "Pace & pressing spearhead" },
      { name: "Federico Valverde", role: "CM", note: "Engine, long-range threat" },
      { name: "Ronald Araújo", role: "CB", note: "Defensive anchor" },
      { name: "Manuel Ugarte", role: "DM", note: "Ball-winner" },
    ],
    honours: "2× World Cup (1930, 1950) · 15× Copa América",
    radar: { attack: 78, defense: 84, midfield: 80, pace: 82, setpiece: 79, experience: 83 },
  },

  spain: {
    name: "Spain",
    code: "ESP",
    flag: "🇪🇸",
    confederation: "UEFA",
    nickname: "La Roja",
    colors: ["#ffd24a", "#c60b1e"],
    fifaRank: 8,
    elo: 2045,
    avgScored: 2.35,
    avgConceded: 0.70,
    attack: 1.46,
    defense: 1.40,
    form: ["W", "W", "W", "D", "W", "W"],
    keyPlayers: [
      { name: "Lamine Yamal", role: "RW", note: "Generational dribbler" },
      { name: "Rodri", role: "DM", note: "Tempo & shield (Ballon d'Or)" },
      { name: "Nico Williams", role: "LW", note: "Direct verticality" },
      { name: "Pedri", role: "CM", note: "Press resistance" },
    ],
    honours: "1× World Cup (2010) · 4× Euros (2008, 2012, 2024) · UEFA Nations League 2023",
    radar: { attack: 90, defense: 85, midfield: 94, pace: 86, setpiece: 80, experience: 82 },
  },

  saudi: {
    name: "Saudi Arabia",
    code: "KSA",
    flag: "🇸🇦",
    confederation: "AFC",
    nickname: "The Green Falcons",
    colors: ["#1aa64b", "#0b5d2b"],
    fifaRank: 59,
    elo: 1632,
    avgScored: 1.20,
    avgConceded: 1.25,
    attack: 0.92,
    defense: 0.96,
    form: ["L", "W", "D", "W", "D", "L"],
    keyPlayers: [
      { name: "Salem Al-Dawsari", role: "LW", note: "Talisman, scored vs Argentina '22" },
      { name: "Firas Al-Buraikan", role: "ST", note: "Focal point" },
      { name: "Mohamed Kanno", role: "CM", note: "Box-to-box" },
      { name: "Nawaf Al-Aqidi", role: "GK", note: "Shot-stopper" },
    ],
    honours: "3× AFC Asian Cup · 7× World Cup appearances",
    radar: { attack: 62, defense: 60, midfield: 63, pace: 70, setpiece: 58, experience: 68 },
  },

  capeverde: {
    name: "Cape Verde",
    code: "CPV",
    flag: "🇨🇻",
    confederation: "CAF",
    nickname: "Tubarões Azuis (Blue Sharks)",
    colors: ["#1c4fb0", "#d6334c"],
    fifaRank: 70,
    elo: 1571,
    avgScored: 1.30,
    avgConceded: 1.05,
    attack: 0.98,
    defense: 1.02,
    form: ["W", "D", "W", "W", "D", "W"],
    keyPlayers: [
      { name: "Ryan Mendes", role: "RW", note: "Captain & creator" },
      { name: "Garry Rodrigues", role: "LW", note: "Set-piece danger" },
      { name: "Bebé", role: "FW", note: "Experience up top" },
      { name: "Kenny Rocha Santos", role: "CM", note: "Distribution" },
    ],
    honours: "Historic 1st-ever World Cup qualification (2026) · 4× AFCON appearances",
    radar: { attack: 64, defense: 66, midfield: 65, pace: 74, setpiece: 67, experience: 60 },
  },
};

/* ----------------------------------------------------------------------------
 *  Head-to-head & historical context for each fixture
 * --------------------------------------------------------------------------*/
const FIXTURES = [
  {
    id: "uru-esp",
    home: "uruguay",
    away: "spain",
    venue: "Neutral venue · World stage",
    competition: "International Friendly / Tournament Stage",
    h2h: {
      played: 9,
      homeWins: 3,    // Uruguay
      draws: 2,
      awayWins: 4,    // Spain
      homeGoals: 12,
      awayGoals: 14,
      history: [
        { date: "2022", comp: "Friendly",     score: "0 - 0", note: "Cagey neutral-venue draw" },
        { date: "2013", comp: "Confed. Cup",  score: "2 - 1", note: "Spain edge a tight one" },
        { date: "2010", comp: "Friendly",     score: "1 - 2", note: "Uruguay shock the champs" },
        { date: "2002", comp: "World Cup",    score: "3 - 1", note: "Spain comfortable in group" },
        { date: "1990", comp: "Friendly",     score: "0 - 2", note: "Spain away win" },
      ],
    },
    narrative:
      "A clash of footballing philosophies: Uruguay's garra charrúa grit and " +
      "low-block discipline against Spain's positional dominance and the " +
      "fearless flair of Yamal and Williams. Spain enter as Euro 2024 holders " +
      "and statistical favourites, but Uruguay's defensive record makes a " +
      "low-scoring contest plausible.",
  },
  {
    id: "ksa-cpv",
    home: "saudi",
    away: "capeverde",
    venue: "Neutral venue",
    competition: "International Friendly",
    h2h: {
      played: 1,
      homeWins: 0,
      draws: 1,
      awayWins: 0,
      homeGoals: 1,
      awayGoals: 1,
      history: [
        { date: "2023", comp: "Friendly", score: "1 - 1", note: "Even, low-event encounter" },
      ],
    },
    narrative:
      "A finely-balanced meeting of two ambitious sides. Saudi Arabia bring " +
      "World Cup pedigree and home-continent organisation; Cape Verde arrive " +
      "as the romantic story of 2026 — the smallest nation ever to qualify — " +
      "playing with fearless cohesion. Ratings separate them by a whisker, " +
      "pointing to a tight, narrow-margin game.",
  },
];

/* League-average goals per team per game — baseline for the Poisson engine */
const LEAGUE_AVG_GOALS = 1.35;
