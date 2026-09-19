'use strict';

/**
 * GAME MANAGER  (the "brain" of the server)
 * -----------------------------------------
 * ALL game data lives in the `games` Map below - plain JavaScript objects in
 * the server's RAM. There is NO database. If the server restarts, the Map
 * starts empty again.
 *
 * In-memory structure
 * -------------------
 * games (Map)
 *  └── "PUPPY25"  ->  game
 *        ├── code, hostToken (secret), hostSockets (Set of connected host sockets)
 *        ├── stage: 'lobby' | 'round' | 'results' | 'reveal' | 'celebration'
 *        ├── currentRound: 0 (lobby) or 1..5
 *        ├── roundStatus: { 1:'pending'|'open'|'closed', 2:..., ... }
 *        ├── participants (Map)
 *        │     └── participantId -> { id, token (secret), name, sockets,
 *        │                            submissions: { 1:{...}, 2:{...} },
 *        │                            scores:      { 1:3, 2:4, ... } }
 *        ├── tieOrders: { "10": [idA, idB] }   // Host-chosen order for tied totals
 *        ├── revealed:  { 3:false, 2:false, 1:false }
 *        └── finalRanking: null | [ ...snapshot taken when the first reveal happens ]
 *
 * This file contains no Socket.IO code, which keeps it easy to read and test.
 * Every function returns { ok: true, ... } or { ok: false, error: '...' }.
 */
const crypto = require('crypto');
const CFG = require('./gameConfig');
const { validateName, SUBMISSION_VALIDATORS } = require('./validation');

const games = new Map();
const ROUNDS = [1, 2, 3, 4, 5];
const PLACE_LABEL = { 3: '3rd', 2: '2nd', 1: '1st' };

const fail = (error, extra = {}) => ({ ok: false, error, ...extra });
const randomToken = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
const touch = (game) => { game.lastActivity = Date.now(); };

/* ------------------------------------------------------------------ *
 *  Creating / finding games
 * ------------------------------------------------------------------ */

const CODE_WORDS = [
  'PUPPY', 'CAKE', 'PARTY', 'CANDY', 'GIFT', 'SMILE',
  'CANDLE', 'BALLOON', 'LADDU', 'PHUPHI', 'TREAT', 'DANCE',
];

/** Friendly game code such as PUPPY25 */
function generateCode() {
  for (let i = 0; i < 100; i++) {
    const word = CODE_WORDS[crypto.randomInt(CODE_WORDS.length)];
    const code = `${word}${crypto.randomInt(10, 100)}`;
    if (!games.has(code)) return code;
  }
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // very unlikely fallback
}

const freshRoundStatus = () => Object.fromEntries(ROUNDS.map((r) => [r, 'pending']));
const freshReveal = () => ({ 3: false, 2: false, 1: false });

function createGame() {
  purgeOldGames();
  if (games.size >= CFG.MAX_GAMES) {
    return fail('The server is busy with too many games. Please try again later.');
  }
  const game = {
    code: generateCode(),
    hostToken: randomToken(24), // secret "host session ID"
    hostSockets: new Set(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    stage: 'lobby',
    currentRound: 0,
    roundStatus: freshRoundStatus(),
    participants: new Map(),
    tieOrders: {},
    revealed: freshReveal(),
    finalRanking: null,
  };
  games.set(game.code, game);
  return { ok: true, game };
}

function getGame(code) {
  return games.get(String(code || '').trim().toUpperCase()) || null;
}

function purgeOldGames() {
  const cutoff = Date.now() - CFG.GAME_TTL_MS;
  for (const [code, game] of games) {
    if (game.lastActivity < cutoff) games.delete(code);
  }
}

const gameCount = () => games.size;

/* ------------------------------------------------------------------ *
 *  Participants
 * ------------------------------------------------------------------ */

function addParticipant(game, rawName) {
  if (game.stage === 'reveal' || game.stage === 'celebration') {
    return fail('This game has already finished.');
  }
  const v = validateName(rawName);
  if (!v.ok) return v;
  const name = v.value;

  const existing = [...game.participants.values()].find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    // Someone with this name is online right now -> refuse (duplicate name).
    if (existing.sockets.size > 0) {
      return fail('This name is already being used. Please choose another name.');
    }
    // The owner is offline (e.g. phone locked, browser closed) -> let them
    // take their seat back. This is how "reconnect by name" works.
    return { ok: true, participant: existing, reclaimed: true };
  }

  if (game.participants.size >= CFG.MAX_PARTICIPANTS) {
    return fail('This game is full.');
  }
  const participant = {
    id: randomToken(4),
    token: randomToken(16), // secret, only ever sent to this participant
    name,
    sockets: new Set(),
    submissions: {},
    scores: {},
  };
  game.participants.set(participant.id, participant);
  touch(game);
  return { ok: true, participant, reclaimed: false };
}

/** Re-attach a returning participant using their secret token */
function findParticipantByToken(game, participantId, token) {
  const p = game.participants.get(String(participantId));
  if (!p || typeof token !== 'string' || p.token !== token) return null;
  return p;
}

/* ------------------------------------------------------------------ *
 *  Host controls: rounds
 * ------------------------------------------------------------------ */

function startGame(game) {
  if (game.stage !== 'lobby') return fail('The game has already started.');
  if (game.participants.size === 0) return fail('Wait for at least one participant to join first.');
  game.stage = 'round';
  game.currentRound = 1;
  touch(game);
  return { ok: true };
}

/** direction: 'next' | 'prev' */
function changeRound(game, direction) {
  if (game.stage !== 'round' && game.stage !== 'results') {
    return fail('Rounds can no longer be changed once the winner reveal has started.');
  }
  if (direction === 'next') {
    if (game.stage === 'results') return fail('All rounds are already finished.');
    // Leaving a round closes it, so nothing stays "open" behind the Host's back.
    if (game.roundStatus[game.currentRound] === 'open') game.roundStatus[game.currentRound] = 'closed';
    if (game.currentRound < CFG.ROUND_COUNT) game.currentRound += 1;
    else game.stage = 'results';
  } else if (direction === 'prev') {
    if (game.stage === 'results') {
      game.stage = 'round';
      game.currentRound = CFG.ROUND_COUNT;
    } else if (game.currentRound > 1) {
      if (game.roundStatus[game.currentRound] === 'open') game.roundStatus[game.currentRound] = 'closed';
      game.currentRound -= 1;
    } else {
      return fail('You are already at Round 1.');
    }
  } else {
    return fail('Unknown round action.');
  }
  touch(game);
  return { ok: true };
}

/** status: 'open' (start / reopen) or 'closed' */
function setRoundStatus(game, status) {
  if (game.stage !== 'round') return fail('There is no active round.');
  if (status !== 'open' && status !== 'closed') return fail('Unknown round status.');
  game.roundStatus[game.currentRound] = status;
  touch(game);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 *  Participant submissions
 * ------------------------------------------------------------------ */

function submit(game, participant, round, payload) {
  if (game.stage !== 'round') return fail('The game is not in a round right now.');
  if (game.currentRound !== round) return fail('That round is not active.');
  const status = game.roundStatus[round];
  if (status === 'pending') return fail('The Host has not started this round yet.');
  if (status === 'closed') return fail('This round is closed.');
  if (participant.submissions[round]) return fail('You have already submitted this round.');

  const v = SUBMISSION_VALIDATORS[round](payload || {});
  if (!v.ok) return v;

  participant.submissions[round] = { ...v.value, submittedAt: Date.now() };
  touch(game);
  return { ok: true, submission: participant.submissions[round] };
}

/* ------------------------------------------------------------------ *
 *  Scoring, ranking, ties
 * ------------------------------------------------------------------ */

const scoresOf = (p) => Object.fromEntries(ROUNDS.map((r) => [r, Number.isInteger(p.scores[r]) ? p.scores[r] : null]));
const participantTotal = (p) => ROUNDS.reduce((sum, r) => sum + (Number.isInteger(p.scores[r]) ? p.scores[r] : 0), 0);

/** Once the first winner is revealed the results are frozen. */
const isLocked = (game) => game.finalRanking !== null;

/** scores = { participantId: number | null }  (Host only) */
function saveScores(game, round, scores) {
  if (isLocked(game)) return fail('The winner reveal has started, so scores are locked.');
  if (!ROUNDS.includes(round)) return fail('Unknown round.');
  if (!scores || typeof scores !== 'object') return fail('No scores were sent.');

  const max = CFG.MAX_SCORES[round];
  const entries = Object.entries(scores);
  // Validate everything first so a bad value never causes a half-saved round.
  for (const [pid, value] of entries) {
    const p = game.participants.get(pid);
    if (!p) return fail('One of the participants no longer exists.');
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > max)) {
      return fail(`Round ${round} scores must be whole numbers from 0 to ${max}.`);
    }
  }
  for (const [pid, value] of entries) {
    const p = game.participants.get(pid);
    if (value === null) delete p.scores[round];
    else p.scores[round] = value;
  }
  touch(game);
  return { ok: true, count: entries.length };
}

/**
 * Sort by total (high -> low). Players on the same total form a tie group.
 * The Host decides the order inside a tie group (game.tieOrders). Until they
 * do, the group is "unresolved".
 */
function buildRanking(game) {
  const rows = [...game.participants.values()].map((p) => ({
    id: p.id,
    name: p.name,
    total: participantTotal(p),
    scores: scoresOf(p),
  }));
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const ranking = [];
  const ties = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1].total === rows[i].total) j++;
    let group = rows.slice(i, j + 1);

    if (group.length > 1) {
      const saved = game.tieOrders[group[0].total];
      const ids = group.map((r) => r.id);
      const resolved =
        Array.isArray(saved) && saved.length === ids.length && ids.every((id) => saved.includes(id));
      if (resolved) group = saved.map((id) => group.find((r) => r.id === id));
      ties.push({
        total: group[0].total,
        ids: group.map((r) => r.id),
        startPosition: i + 1,
        endPosition: j + 1,
        resolved,
      });
    }
    group.forEach((r, k) => ranking.push({ ...r, position: i + k + 1, tied: group.length > 1 }));
    i = j + 1;
  }
  return { ranking, ties };
}

/** Host picks the final order for players who share the same total. */
function setTieOrder(game, total, order) {
  if (isLocked(game)) return fail('The winner reveal has started, so the order is locked.');
  if (!Number.isInteger(total) || !Array.isArray(order)) return fail('Invalid tie order.');
  const tie = buildRanking(game).ties.find((t) => t.total === total);
  if (!tie) return fail('That tie no longer exists (scores may have changed).');
  const valid =
    order.length === tie.ids.length &&
    new Set(order).size === order.length &&
    order.every((id) => tie.ids.includes(id));
  if (!valid) return fail('The tie order must contain each tied player exactly once.');
  game.tieOrders[total] = order.slice();
  touch(game);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 *  Winner reveal
 * ------------------------------------------------------------------ */

function revealPlace(game, place) {
  if (game.stage !== 'results' && game.stage !== 'reveal') {
    return fail('Finish all five rounds first (use "Finish rounds" after Round 5).');
  }
  let ranking = game.finalRanking;
  if (!ranking) {
    const built = buildRanking(game);
    if (built.ties.some((t) => !t.resolved && t.startPosition <= 3)) {
      return fail('TIE DETECTED - please choose the final order for the tied players first.');
    }
    ranking = built.ranking;
  }
  if (place > ranking.length) return fail(`There is no ${PLACE_LABEL[place]} place with only ${ranking.length} player(s).`);
  if (game.revealed[place]) return fail(`${PLACE_LABEL[place]} place is already revealed.`);
  for (let p = 3; p > place; p--) {
    if (p <= ranking.length && !game.revealed[p]) return fail(`Please reveal ${PLACE_LABEL[p]} place first.`);
  }

  // Everything is valid -> commit. The first reveal freezes the results.
  game.finalRanking = ranking;
  game.revealed[place] = true;
  game.stage = 'reveal';
  touch(game);
  return { ok: true, place };
}

function showCelebration(game) {
  if (game.stage !== 'reveal' || !game.revealed[1]) return fail('Reveal 1st place first.');
  game.stage = 'celebration';
  touch(game);
  return { ok: true };
}

/** "Play again": keep the same players and code, wipe answers and scores. */
function resetGame(game) {
  game.stage = 'lobby';
  game.currentRound = 0;
  game.roundStatus = freshRoundStatus();
  game.tieOrders = {};
  game.revealed = freshReveal();
  game.finalRanking = null;
  for (const p of game.participants.values()) {
    p.submissions = {};
    p.scores = {};
  }
  touch(game);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 *  Views: exactly what each side is allowed to see
 *  (participants never receive scores, other people's answers or the ranking)
 * ------------------------------------------------------------------ */

/** Everything the Host dashboard needs - except the (large) submission contents. */
function hostView(game) {
  const { ranking, ties } = game.finalRanking
    ? { ranking: game.finalRanking, ties: [] }
    : buildRanking(game);

  return {
    role: 'host',
    code: game.code,
    stage: game.stage,
    currentRound: game.currentRound,
    roundStatus: game.roundStatus,
    maxScores: CFG.MAX_SCORES,
    locked: isLocked(game),
    revealed: game.revealed,
    revealBlocked: ties.some((t) => !t.resolved && t.startPosition <= 3),
    participants: [...game.participants.values()].map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.sockets.size > 0,
      submitted: Object.fromEntries(ROUNDS.map((r) => [r, Boolean(p.submissions[r])])),
      scores: scoresOf(p),
      total: participantTotal(p),
    })),
    ranking,
    ties,
  };
}

/** Big data (doodles etc.) is sent separately, once, and then incrementally. */
function allSubmissions(game) {
  const out = {};
  for (const p of game.participants.values()) out[p.id] = p.submissions;
  return out;
}

/** The small, safe view sent to ONE participant. */
function playerView(game, participant) {
  const shown = [];
  if (game.finalRanking) {
    for (const place of [3, 2, 1]) {
      const row = game.revealed[place] ? game.finalRanking[place - 1] : null;
      if (row) shown.push({ place, name: row.name, total: row.total });
    }
  }
  return {
    role: 'player',
    code: game.code,
    name: participant.name,
    stage: game.stage,
    currentRound: game.currentRound,
    roundStatus: game.currentRound ? game.roundStatus[game.currentRound] : 'pending',
    marksPerRound: CFG.MAX_SCORES, // "Maximum marks: 3" is shown on each round (not a secret)
    submittedRounds: Object.fromEntries(ROUNDS.map((r) => [r, Boolean(participant.submissions[r])])),
    playerCount: game.participants.size,
    hostConnected: game.hostSockets.size > 0,
    reveal: { shown }, // only places the Host has already revealed
  };
}

module.exports = {
  createGame,
  getGame,
  gameCount,
  purgeOldGames,
  addParticipant,
  findParticipantByToken,
  startGame,
  changeRound,
  setRoundStatus,
  submit,
  saveScores,
  setTieOrder,
  revealPlace,
  showCelebration,
  resetGame,
  hostView,
  playerView,
  allSubmissions,
};
