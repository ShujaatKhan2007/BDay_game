'use strict';

/**
 * SOCKET HANDLERS
 * ---------------
 * This file connects Socket.IO events to the game logic in gameManager.js.
 *
 * How real-time updates work (simple and reliable):
 *   1. A client sends an event (e.g. "start_game").
 *   2. We check WHO sent it (host or participant) and validate the data.
 *   3. gameManager.js changes the in-memory game.
 *   4. broadcast(game) sends everybody a fresh "game_state":
 *        - the Host gets the full dashboard state,
 *        - each participant gets a small personal state (no scores!).
 *
 * Rooms:
 *   host:CODE            -> the Host's browser(s)
 *   player:CODE:PLAYERID -> one participant (may have more than one tab)
 */
const crypto = require('crypto');
const M = require('./gameManager');

const SUBMIT_EVENTS = {
  submit_answer: 1, // Round 1 - Q&A
  submit_doodle: 2, // Round 2 - Doodle
  submit_reaction: 3, // Round 3 - Reactions
  submit_dialog: 4, // Round 4 - Dialog
  submit_one_word: 5, // Round 5 - One word
};

const hostRoom = (code) => `host:${code}`;
const playerRoom = (code, id) => `player:${code}:${id}`;

/** Compare two secret strings without leaking timing information. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function registerSocketHandlers(io) {
  /** Send the right view to the Host and to every participant. */
  function broadcast(game) {
    io.to(hostRoom(game.code)).emit('game_state', M.hostView(game));
    for (const p of game.participants.values()) {
      io.to(playerRoom(game.code, p.id)).emit('game_state', M.playerView(game, p));
    }
  }

  /** Send one event to the Host and every participant of a game. */
  function emitToGame(game, event, payload) {
    io.to(hostRoom(game.code)).emit(event, payload);
    for (const p of game.participants.values()) io.to(playerRoom(game.code, p.id)).emit(event, payload);
  }

  io.on('connection', (socket) => {
    socket.data = {};

    /* ---------- small helpers that live inside the connection ---------- */

    /** Register an event handler that never crashes the server. */
    function on(event, handler) {
      socket.on(event, (payload, ack) => {
        if (typeof payload === 'function') { ack = payload; payload = {}; }
        const reply = (res) => { if (typeof ack === 'function') ack(res); };
        try {
          handler(payload && typeof payload === 'object' ? payload : {}, reply);
        } catch (err) {
          console.error(`[${event}] error:`, err);
          reply({ ok: false, error: 'Something went wrong on the server.' });
        }
      });
    }

    function attachHost(game) {
      detach(true);
      socket.data = { role: 'host', code: game.code };
      socket.join(hostRoom(game.code));
      game.hostSockets.add(socket.id);
    }

    function attachPlayer(game, p) {
      detach(true);
      socket.data = { role: 'player', code: game.code, participantId: p.id };
      socket.join(playerRoom(game.code, p.id));
      p.sockets.add(socket.id);
    }

    /**
     * Remove this socket from its game (on disconnect or when switching games).
     * silent = true skips the broadcast (the caller broadcasts right afterwards).
     */
    function detach(silent = false) {
      const { role, code, participantId } = socket.data || {};
      if (!code) return;
      socket.data = {};
      const game = M.getGame(code);
      if (!game) return;
      if (role === 'host') {
        game.hostSockets.delete(socket.id);
        socket.leave(hostRoom(code));
      } else if (role === 'player') {
        const p = game.participants.get(participantId);
        if (p) p.sockets.delete(socket.id);
        socket.leave(playerRoom(code, participantId));
      }
      if (!silent) broadcast(game); // everyone sees the 🟢/⚪ and "Host disconnected" changes
    }

    /** Returns the game if this socket is the authenticated Host, else replies with an error. */
    function requireHost(reply) {
      const { role, code } = socket.data;
      if (role !== 'host') {
        reply({ ok: false, error: 'Only the Host can do this.' });
        return null;
      }
      const game = M.getGame(code);
      if (!game) {
        reply({ ok: false, error: 'Game not found.' });
        return null;
      }
      return game;
    }

    function requirePlayer(reply) {
      const { role, code, participantId } = socket.data;
      const game = role === 'player' ? M.getGame(code) : null;
      const participant = game ? game.participants.get(participantId) : null;
      if (!game || !participant) {
        reply({ ok: false, error: 'You are not in a game. Please join again.' });
        return null;
      }
      return { game, participant };
    }

    /** Standard Host action: check Host -> run logic -> broadcast -> reply. */
    function hostAction(event, run, after) {
      on(event, (payload, reply) => {
        const game = requireHost(reply);
        if (!game) return;
        const res = run(game, payload);
        if (res.ok) {
          if (after) after(game, payload, res);
          broadcast(game);
        }
        reply(res);
      });
    }

    /* ---------------------------- HOST ---------------------------- */

    on('create_game', (_payload, reply) => {
      const res = M.createGame();
      if (!res.ok) return reply(res);
      const game = res.game;
      attachHost(game);
      reply({ ok: true, code: game.code, hostToken: game.hostToken });
      socket.emit('host_submissions', M.allSubmissions(game));
      broadcast(game);
    });

    // Host refreshed the page or lost connection: prove identity with the secret token.
    on('rejoin_host', ({ code, hostToken }, reply) => {
      const game = M.getGame(code);
      if (!game) return reply({ ok: false, fatal: true, error: 'Game not found. The server may have restarted.' });
      if (!safeEqual(hostToken, game.hostToken)) {
        return reply({ ok: false, fatal: true, error: 'Host session is not valid.' });
      }
      attachHost(game);
      reply({ ok: true, code: game.code });
      socket.emit('host_submissions', M.allSubmissions(game));
      broadcast(game);
    });

    hostAction('start_game', (game) => M.startGame(game));

    hostAction('change_round', (game, { direction }) => M.changeRound(game, direction));
    hostAction('start_round', (game) => M.setRoundStatus(game, 'open'));
    hostAction('close_round', (game) => M.setRoundStatus(game, 'closed'));

    // Only the Host can score. Participants' sockets are rejected in requireHost().
    hostAction(
      'save_scores',
      (game, { round, scores }) => M.saveScores(game, round, scores),
      (game, { round }, res) => io.to(hostRoom(game.code)).emit('score_updated', { round, count: res.count }),
    );

    hostAction('set_tie_order', (game, { total, order }) => M.setTieOrder(game, total, order));

    hostAction('reveal_3rd', (game) => M.revealPlace(game, 3));
    hostAction('reveal_2nd', (game) => M.revealPlace(game, 2));
    hostAction('reveal_1st', (game) => M.revealPlace(game, 1));
    hostAction('show_celebration', (game) => M.showCelebration(game));

    hostAction(
      'reset_game',
      (game) => M.resetGame(game),
      (game) => emitToGame(game, 'game_reset', {}),
    );

    /* ------------------------- PARTICIPANT ------------------------- */

    on('join_game', ({ code, name }, reply) => {
      const game = M.getGame(code);
      if (!game) return reply({ ok: false, error: 'Game not found. Please check the game code.' });
      const res = M.addParticipant(game, name);
      if (!res.ok) return reply(res);

      const p = res.participant;
      attachPlayer(game, p);
      reply({ ok: true, code: game.code, participantId: p.id, token: p.token, name: p.name, reclaimed: res.reclaimed });
      io.to(hostRoom(game.code)).emit('participant_joined', { id: p.id, name: p.name, reclaimed: res.reclaimed });
      broadcast(game);
    });

    // Participant refreshed / reconnected: keep their record using the secret token.
    on('rejoin_participant', ({ code, participantId, token }, reply) => {
      const game = M.getGame(code);
      if (!game) return reply({ ok: false, fatal: true, error: 'Game not found. The server may have restarted.' });
      const p = M.findParticipantByToken(game, participantId, token);
      if (!p) return reply({ ok: false, fatal: true, error: 'Your player session was not found. Please join again.' });
      attachPlayer(game, p);
      reply({ ok: true, name: p.name });
      broadcast(game);
    });

    on('leave_game', (_payload, reply) => {
      detach();
      reply({ ok: true });
    });

    // One handler per submit event: submit_answer, submit_doodle, ...
    for (const [event, round] of Object.entries(SUBMIT_EVENTS)) {
      on(event, (payload, reply) => {
        const ctx = requirePlayer(reply);
        if (!ctx) return;
        const res = M.submit(ctx.game, ctx.participant, round, payload);
        if (!res.ok) return reply(res);
        // Host receives the actual content; participants only get a "submitted" flag.
        io.to(hostRoom(ctx.game.code)).emit('submission_received', {
          participantId: ctx.participant.id,
          round,
          submission: res.submission,
        });
        broadcast(ctx.game);
        reply({ ok: true });
      });
    }

    /* ------------------------- DISCONNECT ------------------------- */

    // The game is NOT destroyed. Everything stays in memory so the person can come back.
    socket.on('disconnect', () => detach());
  });
}

module.exports = registerSocketHandlers;
