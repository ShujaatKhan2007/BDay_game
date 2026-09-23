'use strict';

/**
 * INTEGRATION TEST
 * ----------------
 * Starts the real server on a random port, connects one Host and four
 * participants with real Socket.IO clients, and plays a complete game:
 * joining, all five rounds, scoring, a tie, the winner reveal, reconnects
 * and security checks.
 *
 * Run it with:   cd server && npm install && npm test
 */
const assert = require('assert');
const { io } = require('socket.io-client');
const { createServer } = require('../server');

// A tiny valid PNG (1x1 pixel) as a data URL - stands in for a doodle.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let step = 0;
const pass = (msg) => console.log(`  ✅ ${String(++step).padStart(2, '0')}  ${msg}`);

function connect(url) {
  return new Promise((resolve) => {
    const s = io(url, { transports: ['websocket'], forceNew: true });
    s.latest = null;
    s.submissions = {};
    s.on('game_state', (st) => { s.latest = st; });
    s.on('host_submissions', (all) => { s.submissions = all; });
    s.on('submission_received', ({ participantId, round, submission }) => {
      s.submissions[participantId] = { ...(s.submissions[participantId] || {}), [round]: submission };
    });
    s.on('connect', () => resolve(s));
  });
}

const emit = (socket, event, payload = {}) => new Promise((resolve) => socket.emit(event, payload, resolve));

async function until(fn, label, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (fn()) return; } catch { /* keep waiting */ }
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

async function expectError(promise, contains, label) {
  const res = await promise;
  assert.strictEqual(res.ok, false, `${label}: expected an error but it succeeded`);
  if (contains) assert.ok(res.error.includes(contains), `${label}: expected "${contains}" but got "${res.error}"`);
  return res;
}

async function main() {
  const { httpServer, io: serverIo } = createServer();
  await new Promise((r) => httpServer.listen(0, r));
  const url = `http://localhost:${httpServer.address().port}`;
  console.log(`\nTest server on ${url}\n`);

  /* ---------- Host creates the game ---------- */
  const host = await connect(url);
  const created = await emit(host, 'create_game');
  assert.ok(created.ok && /^[A-Z]+\d\d$/.test(created.code), 'game code looks like PUPPY25');
  assert.ok(created.hostToken.length >= 32, 'host token is long and random');
  const code = created.code;
  await until(() => host.latest && host.latest.stage === 'lobby', 'host lobby state');
  pass(`Host created game ${code}`);

  /* ---------- Participants join ---------- */
  const names = ['Asha', 'Bilal', 'Chandni', 'Dev'];
  const players = {};
  const info = {};
  for (const name of names) {
    const s = await connect(url);
    const res = await emit(s, 'join_game', { code: code.toLowerCase(), name });
    assert.ok(res.ok, `${name} joins (code is case-insensitive)`);
    players[name] = s;
    info[name] = res;
  }
  await until(() => host.latest.participants.length === 4, 'host sees 4 participants');
  await until(() => players.Asha.latest?.playerCount === 4, 'participants see count 4');
  pass('4 participants joined; Host list and player count updated live');

  const dup = await connect(url);
  await expectError(emit(dup, 'join_game', { code, name: 'BILAL' }), 'already being used', 'duplicate name');
  await expectError(emit(dup, 'join_game', { code: 'NOPE99', name: 'X' }), 'not found', 'bad code');
  dup.close();
  pass('Duplicate names and wrong codes are rejected with clear errors');

  /* ---------- Security: participants cannot use Host powers ---------- */
  for (const ev of ['start_game', 'change_round', 'start_round', 'close_round', 'reveal_3rd', 'reveal_2nd', 'reveal_1st', 'reset_game', 'show_celebration']) {
    await expectError(emit(players.Asha, ev, { direction: 'next' }), 'Only the Host', `participant ${ev}`);
  }
  await expectError(emit(players.Asha, 'save_scores', { round: 1, scores: { [info.Asha.participantId]: 3 } }), 'Only the Host', 'participant save_scores');
  await expectError(emit(players.Asha, 'set_tie_order', { total: 1, order: [] }), 'Only the Host', 'participant tie order');
  const impostor = await connect(url);
  await expectError(emit(impostor, 'rejoin_host', { code, hostToken: 'wrong' }), null, 'wrong host token');
  await expectError(emit(impostor, 'start_game'), 'Only the Host', 'unauthenticated start');
  impostor.close();
  pass('Participants and impostors cannot start, change rounds, score or reveal');

  /* ---------- Host types the birthday person's name ---------- */
  assert.strictEqual(host.latest.celebrant, null, 'no birthday person until the Host enters one');
  await expectError(emit(host, 'start_game'), 'birthday person', 'cannot start without a name');
  await expectError(emit(players.Asha, 'set_celebrant', { name: 'Hacker', pronoun: 'she' }), 'Only the Host', 'participant sets celebrant');
  await expectError(emit(host, 'set_celebrant', { name: '   ', pronoun: 'she' }), 'name', 'empty name');
  await expectError(emit(host, 'set_celebrant', { name: 'A'.repeat(41), pronoun: 'she' }), 'too long', 'name too long');
  await expectError(emit(host, 'set_celebrant', { name: 'Iqbal Fufa', shortName: 'B'.repeat(30), pronoun: 'he' }), 'too long', 'short name too long');
  await expectError(emit(host, 'set_celebrant', { name: 'Iqbal Fufa', pronoun: 'robot' }), 'pronoun', 'invalid pronoun');
  await emit(host, 'set_celebrant', { name: '  Iqbal   Fufa ', shortName: 'Fufa', pronoun: 'he' }).then((r) => assert.ok(r.ok, r.error));
  const expected = { name: 'Iqbal Fufa', shortName: 'Fufa', pronoun: 'he' };
  await until(() => Object.values(players).every((p) => p.latest.celebrant?.name === 'Iqbal Fufa') && host.latest.celebrant?.name === 'Iqbal Fufa', 'everyone sees the name');
  assert.deepStrictEqual(host.latest.celebrant, expected);
  assert.deepStrictEqual(players.Asha.latest.celebrant, expected);
  // the Host can change their mind before starting
  await emit(host, 'set_celebrant', { name: 'Shadab Phuphi', shortName: 'Phuphi', pronoun: 'she' }).then((r) => assert.ok(r.ok));
  await emit(host, 'set_celebrant', expected).then((r) => assert.ok(r.ok));
  pass('Host enters any birthday name + pronoun in the lobby; everyone sees it instantly; bad input and non-Hosts are rejected; cannot start without a name');

  /* ---------- Host writes custom questions ---------- */
  assert.deepStrictEqual(host.latest.customContent, {}, 'defaults until the Host customises');
  await expectError(emit(players.Asha, 'set_questions', { round: 1, content: { questions: ['x'] } }), 'Only the Host', 'participant edits questions');
  await expectError(emit(host, 'set_questions', { round: 9, content: { prompt: 'x' } }), 'Unknown round', 'bad round number');
  await expectError(emit(host, 'set_questions', { round: 1, content: { questions: [] } }), 'between 1 and 10', 'no questions');
  await expectError(emit(host, 'set_questions', { round: 1, content: { questions: Array(11).fill('q') } }), 'between 1 and 10', 'too many questions');
  await expectError(emit(host, 'set_questions', { round: 1, content: { questions: ['ok', '   '] } }), 'fill in every question', 'blank question');
  await expectError(emit(host, 'set_questions', { round: 1, content: { questions: ['x'.repeat(151)] } }), 'at most 150', 'question too long');
  await expectError(emit(host, 'set_questions', { round: 2, content: { prompt: '  ' } }), 'prompt', 'empty prompt');
  await expectError(emit(host, 'set_questions', { round: 4, content: { prompt: 'x'.repeat(201) } }), 'at most 200', 'prompt too long');
  await expectError(emit(host, 'set_questions', { round: 3, content: { situations: [{ text: '  ', emojis: [] }] } }), 'fill in every situation', 'blank situation');
  await expectError(emit(host, 'set_questions', { round: 3, content: { situations: [{ text: 'ok', emojis: Array.from({ length: 9 }, (_, i) => `e${i}`) }] } }), 'at most 8', 'too many emojis');
  await expectError(emit(host, 'set_questions', { round: 1, content: 'nope' }), 'No questions', 'no content');

  const customQ1 = ['How old is Iqbal Fufa turning this birthday?', 'What was his nickname?', "What is Iqbal Fufa's biggest weakness?", 'What is his favourite food?'];
  await emit(host, 'set_questions', { round: 1, content: { questions: customQ1 } }).then((r) => assert.ok(r.ok, r.error));
  await emit(host, 'set_questions', { round: 3, content: { situations: [{ text: 'Fufa at the dinner table', emojis: ['😋', '😋', '😴'] }, { text: 'Fufa at a wedding', emojis: ['🕺'] }] } }).then((r) => assert.ok(r.ok, r.error));
  await emit(host, 'set_questions', { round: 5, content: { prompt: 'Describe Fufa in ONE word.' } }).then((r) => assert.ok(r.ok, r.error));
  await until(() => players.Asha.latest.customContent[1]?.questions.length === 4 && host.latest.customContent[5], 'everyone sees the custom questions');
  assert.deepStrictEqual(players.Asha.latest.customContent[1].questions, customQ1);
  assert.deepStrictEqual(players.Asha.latest.customContent[3].situations[0].emojis, ['😋', '😴'], 'duplicate emojis are removed');
  await emit(host, 'set_questions', { round: 5, content: null }).then((r) => assert.ok(r.ok));
  await until(() => host.latest.customContent[5] === undefined, 'round 5 back to default');
  assert.deepStrictEqual(Object.keys(host.latest.customContent).sort(), ['1', '3']);
  pass('Host writes custom Round 1 and Round 3 questions; everyone sees them; validation and Host-only rules hold; a round can go back to default');

  /* ---------- Start game ---------- */
  await emit(host, 'start_game').then((r) => assert.ok(r.ok));
  await until(() => Object.values(players).every((p) => p.latest.stage === 'round' && p.latest.currentRound === 1), 'all players in round 1');
  await expectError(emit(host, 'set_celebrant', { name: 'Someone Else', pronoun: 'she' }), 'before the game starts', 'change name after start');
  await expectError(emit(host, 'set_questions', { round: 2, content: { prompt: 'Too late' } }), 'before the game starts', 'change questions after start');
  assert.strictEqual(players.Asha.latest.celebrant.name, 'Iqbal Fufa');
  assert.strictEqual(players.Asha.latest.roundStatus, 'pending');
  pass('START GAME moved every participant to Round 1 (waiting for START ROUND)');

  await expectError(
    emit(players.Asha, 'submit_answer', { answers: ['a', 'b', 'c'] }), 'not started', 'submit before start');
  await emit(host, 'start_round').then((r) => assert.ok(r.ok));
  await until(() => players.Asha.latest.roundStatus === 'open', 'round 1 open');

  /* ---------- Round 1 ---------- */
  await expectError(emit(players.Asha, 'submit_answer', { answers: ['only one'] }), 'all 4 questions', 'incomplete answers');
  await expectError(emit(players.Asha, 'submit_answer', { answers: ['a', 'b', 'c'] }), 'all 4 questions', 'the old 3-answer format is refused now that Round 1 has 4 questions');
  for (const name of names) {
    const r = await emit(players[name], 'submit_answer', { answers: ['60', 'Guddu', 'Chocolate', 'Biryani'] });
    assert.ok(r.ok, `${name} submits round 1`);
  }
  await expectError(emit(players.Asha, 'submit_answer', { answers: ['1', '2', '3'] }), 'already submitted', 'duplicate submit');
  await until(() => host.latest.participants.every((p) => p.submitted[1]), 'host sees all submitted');
  await until(() => Object.keys(host.submissions).length >= 4, 'host received answers');
  assert.deepStrictEqual(host.submissions[info.Asha.participantId][1].answers, ['60', 'Guddu', 'Chocolate', 'Biryani']);
  assert.ok(players.Asha.latest.submittedRounds[1]);
  pass('Round 1 answers submitted; duplicates blocked; Host sees content + status');

  // Participants must never receive scores, rankings or other people's data.
  const playerJson = JSON.stringify(players.Asha.latest);
  for (const forbidden of ['ranking', 'scores', 'total', 'Bilal', 'Chandni', 'Dev', 'answers']) {
    assert.ok(!playerJson.includes(forbidden), `participant state must not contain "${forbidden}"`);
  }
  pass('Participant state contains no scores, ranking or other players');

  /* ---------- Scoring rules ---------- */
  const id = (n) => info[n].participantId;
  await expectError(emit(host, 'save_scores', { round: 1, scores: { [id('Asha')]: 4 } }), '0 to 3', 'score above max');
  await expectError(emit(host, 'save_scores', { round: 1, scores: { [id('Asha')]: 1.5 } }), 'whole numbers', 'fractional score');
  await expectError(emit(host, 'save_scores', { round: 1, scores: { nobody: 1 } }), 'no longer exists', 'unknown participant');
  const scoreTable = {
    // Asha 12, Bilal 10, Chandni 10, Dev 8  -> Bilal & Chandni are TIED
    1: { Asha: 3, Bilal: 3, Chandni: 2, Dev: 2 },
    2: { Asha: 5, Bilal: 4, Chandni: 4, Dev: 3 },
    3: { Asha: 1, Bilal: 1, Chandni: 1, Dev: 0 },
    4: { Asha: 2, Bilal: 1, Chandni: 2, Dev: 2 },
    5: { Asha: 1, Bilal: 1, Chandni: 1, Dev: 1 },
  };
  const scoresFor = (round) => Object.fromEntries(names.map((n) => [id(n), scoreTable[round][n]]));
  await emit(host, 'save_scores', { round: 1, scores: scoresFor(1) }).then((r) => assert.ok(r.ok));
  pass('Host scores validated (max, whole numbers, real participants) and saved');

  /* ---------- Rounds 2-5 ---------- */
  const submitters = {
    2: ['submit_doodle', { image: TINY_PNG }],
    3: ['submit_reaction', { reactions: [{ emoji: '😋', text: '' }, { emoji: '', text: 'Chup!' }] }], // Round 3 has 2 custom situations
    4: ['submit_dialog', { dialog: 'Arre suno toh sahi!' }],
    5: ['submit_one_word', { word: 'Loving' }],
  };
  for (const round of [2, 3, 4, 5]) {
    await emit(host, 'change_round', { direction: 'next' }).then((r) => assert.ok(r.ok));
    await until(() => players.Dev.latest.currentRound === round && players.Dev.latest.roundStatus === 'pending', `round ${round} pending`);
    await emit(host, 'start_round').then((r) => assert.ok(r.ok));
    await until(() => players.Dev.latest.roundStatus === 'open', `round ${round} open`);
    const [event, payload] = submitters[round];

    if (round === 2) {
      await expectError(emit(players.Asha, event, { image: 'javascript:alert(1)' + 'x'.repeat(120) }), 'valid drawing', 'bad doodle');
    }
    if (round === 5) {
      await expectError(emit(players.Asha, event, { word: 'two words' }), 'ONE word', 'two-word answer');
      await expectError(emit(players.Asha, event, { word: '' }), null, 'empty word');
    }
    // Wrong-round submissions are rejected
    await expectError(emit(players.Asha, 'submit_answer', { answers: ['a', 'b', 'c'] }), 'not active', 'wrong round');

    for (const name of names) {
      const r = await emit(players[name], event, payload);
      assert.ok(r.ok, `${name} round ${round}: ${r.error}`);
    }
    await until(() => host.latest.participants.every((p) => p.submitted[round]), `all submitted round ${round}`);
    await emit(host, 'save_scores', { round, scores: scoresFor(round) }).then((r) => assert.ok(r.ok, r.error));
  }
  assert.ok(host.submissions[id('Asha')][2].image.startsWith('data:image/png'));
  pass('Rounds 2-5 (doodle, reactions, dialog, one word) submitted, validated and scored');

  // Closing a round blocks late submissions
  await emit(host, 'close_round').then((r) => assert.ok(r.ok));
  await until(() => players.Asha.latest.roundStatus === 'closed', 'round closed');
  pass('Host can close a round');

  /* ---------- Totals, leaderboard, ties ---------- */
  await until(() => host.latest.ranking.length === 4, 'host ranking');
  const totals = Object.fromEntries(host.latest.ranking.map((r) => [r.name, r.total]));
  assert.deepStrictEqual(totals, { Asha: 12, Bilal: 10, Chandni: 10, Dev: 8 });
  assert.strictEqual(host.latest.ties.length, 1);
  assert.strictEqual(host.latest.ties[0].total, 10);
  assert.strictEqual(host.latest.ties[0].resolved, false);
  assert.strictEqual(host.latest.revealBlocked, true);
  pass('Totals = sum of rounds (12 / 10 / 10 / 8) and the tie was detected');

  // Results stage: participants must NOT see the leaderboard
  await expectError(emit(host, 'reveal_3rd'), 'Finish all five rounds', 'reveal too early');
  await emit(host, 'change_round', { direction: 'next' }).then((r) => assert.ok(r.ok));
  await until(() => players.Asha.latest.stage === 'results', 'players in results stage');
  assert.deepStrictEqual(players.Asha.latest.reveal.shown, []);
  pass('After Round 5 participants wait on "All rounds are complete" (leaderboard hidden)');

  await expectError(emit(host, 'reveal_3rd'), 'TIE DETECTED', 'reveal blocked by tie');
  await expectError(emit(host, 'set_tie_order', { total: 10, order: [id('Bilal')] }), 'each tied player', 'partial tie order');
  await expectError(emit(host, 'set_tie_order', { total: 10, order: [id('Bilal'), id('Dev')] }), 'each tied player', 'wrong tie members');
  await emit(host, 'set_tie_order', { total: 10, order: [id('Chandni'), id('Bilal')] }).then((r) => assert.ok(r.ok));
  await until(() => host.latest.revealBlocked === false, 'tie resolved');
  assert.deepStrictEqual(host.latest.ranking.map((r) => r.name), ['Asha', 'Chandni', 'Bilal', 'Dev']);
  pass('Host resolved the tie manually: order is Asha, Chandni, Bilal, Dev');

  /* ---------- Winner reveal ---------- */
  await expectError(emit(host, 'reveal_2nd'), '3rd place first', 'reveal out of order');
  await expectError(emit(host, 'reveal_1st'), '3rd place first', 'reveal 1st too early');

  await emit(host, 'reveal_3rd').then((r) => assert.ok(r.ok, r.error));
  await until(() => players.Dev.latest.reveal.shown.length === 1, 'players see 3rd');
  assert.deepStrictEqual(players.Dev.latest.reveal.shown[0], { place: 3, name: 'Bilal', total: 10 });
  assert.strictEqual(players.Dev.latest.stage, 'reveal');
  pass('🥉 Everyone sees 3rd place: Bilal');

  await expectError(emit(host, 'save_scores', { round: 1, scores: { [id('Dev')]: 3 } }), 'locked', 'scores locked after reveal');
  await expectError(emit(host, 'reveal_3rd'), 'already revealed', 'double reveal');

  await emit(host, 'reveal_2nd').then((r) => assert.ok(r.ok, r.error));
  await until(() => players.Dev.latest.reveal.shown.length === 2, 'players see 2nd');
  assert.strictEqual(players.Dev.latest.reveal.shown[1].name, 'Chandni');
  pass('🥈 Everyone sees 2nd place: Chandni');

  await expectError(emit(host, 'show_celebration'), '1st place first', 'celebration too early');
  await emit(host, 'reveal_1st').then((r) => assert.ok(r.ok, r.error));
  await until(() => players.Dev.latest.reveal.shown.length === 3, 'players see 1st');
  assert.strictEqual(players.Dev.latest.reveal.shown[2].name, 'Asha');
  pass('🥇 Everyone sees 1st place: Asha');

  await emit(host, 'show_celebration').then((r) => assert.ok(r.ok));
  await until(() => players.Bilal.latest.stage === 'celebration', 'celebration stage');
  pass('🎉 Final celebration screen shown to everyone');

  /* ---------- Disconnect / reconnect ---------- */
  host.close();
  await until(() => players.Asha.latest.hostConnected === false, 'players notice host is gone');
  pass('Participants are told when the Host disconnects');

  const host2 = await connect(url);
  await expectError(emit(host2, 'rejoin_host', { code, hostToken: 'not-the-token' }), 'not valid', 'wrong token');
  const rj = await emit(host2, 'rejoin_host', { code, hostToken: created.hostToken });
  assert.ok(rj.ok);
  await until(() => host2.latest && host2.latest.stage === 'celebration' && host2.latest.ranking.length === 4, 'host state restored');
  await until(() => players.Asha.latest.hostConnected === true, 'players see host back');
  assert.ok(host2.submissions[id('Asha')][1], 'submissions restored for Host');
  pass('Host reconnected with the secret token: full game state and submissions restored');

  players.Dev.close();
  await until(() => host2.latest.participants.find((p) => p.name === 'Dev').connected === false, 'Dev offline');
  const back = await connect(url);
  const rejoin = await emit(back, 'rejoin_participant', { code, participantId: id('Dev'), token: info.Dev.token });
  assert.ok(rejoin.ok);
  await until(() => back.latest?.submittedRounds?.[5] === true, 'Dev submissions preserved');
  await expectError(emit(await connect(url), 'rejoin_participant', { code, participantId: id('Dev'), token: 'bad' }), null, 'bad player token');
  pass('Participant reconnected with token: their submissions were preserved');

  players.Chandni.close();
  await until(() => host2.latest.participants.find((p) => p.name === 'Chandni').connected === false, 'Chandni offline');
  const newcomer = await connect(url);
  // Game finished -> new players cannot join any more
  await expectError(emit(newcomer, 'join_game', { code, name: 'Latecomer' }), 'already finished', 'join after finish');
  pass('New players cannot join after the game has finished');

  /* ---------- Play again ---------- */
  const rst = await emit(host2, 'reset_game');
  assert.ok(rst.ok);
  await until(() => host2.latest.stage === 'lobby' && host2.latest.participants.every((p) => p.total === 0), 'reset');
  assert.strictEqual(host2.latest.celebrant.name, 'Iqbal Fufa', 'name is kept after play again');
  assert.strictEqual(host2.latest.customContent[1].questions.length, 4, 'custom questions are kept after play again');
  await emit(host2, 'set_questions', { round: 1, content: null }).then((r) => assert.ok(r.ok));
  await until(() => host2.latest.customContent[1] === undefined, 'questions can be edited again in the lobby');
  await emit(host2, 'set_celebrant', { name: 'Rahul', shortName: '', pronoun: 'they' }).then((r) => assert.ok(r.ok));
  await until(() => back.latest.celebrant?.name === 'Rahul' && back.latest.celebrant.pronoun === 'they', 'players see the new birthday person');
  await until(() => back.latest.stage === 'lobby' && back.latest.submittedRounds[1] === false, 'player reset');
  const rejoinByName = await emit(await connect(url), 'join_game', { code, name: 'chandni' });
  assert.ok(rejoinByName.ok && rejoinByName.reclaimed && rejoinByName.participantId === id('Chandni'));
  pass('Play again: same players, cleared answers and scores; offline players can reclaim their name');

  console.log(`\n🎉 All ${step} checks passed.\n`);
  serverIo.close();
  httpServer.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
