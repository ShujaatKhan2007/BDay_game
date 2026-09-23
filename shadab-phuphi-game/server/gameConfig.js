'use strict';

/**
 * SERVER-SIDE GAME SETTINGS
 * -------------------------
 * The birthday QUESTIONS live in the client: client/src/config/gameContent.js
 * The MARKS and LIMITS live here, because the server must enforce them
 * (a participant must never be able to give themselves marks).
 *
 * If you change a maximum mark here, the Host screens update automatically
 * (the server sends the maximums to the Host).
 */
module.exports = {
  ROUND_COUNT: 5,

  // The Host types the birthday person's name in the lobby. These are the
  // choices for how the questions refer to them ("her nickname", "his nickname", ...).
  PRONOUNS: ['she', 'he', 'they'],

  // Maximum marks per round. Total = 3 + 5 + 1 + 2 + 1 = 12
  MAX_SCORES: { 1: 3, 2: 5, 3: 1, 4: 2, 5: 1 },

  // The DEFAULT number of items (the Host may add or remove questions in the lobby)
  QA_COUNT: 3, // Round 1: three questions
  REACTION_COUNT: 3, // Round 3: three situations

  // Limits for Host-written questions
  MAX_QUESTIONS: 10, // Round 1
  MAX_SITUATIONS: 6, // Round 3
  MAX_EMOJIS: 8, // emoji choices per Round 3 situation

  // Safety limits (a small family party never gets near these)
  MAX_PARTICIPANTS: Number(process.env.MAX_PARTICIPANTS) || 60,
  MAX_GAMES: 20,
  GAME_TTL_MS: 12 * 60 * 60 * 1000, // forget games idle for 12 hours

  LIMITS: {
    name: 24,
    celebrantName: 40,
    celebrantShort: 24,
    answer: 200,
    reactionText: 120,
    emoji: 16,
    dialog: 300,
    question: 150, // one question or situation written by the Host
    prompt: 200, // a round prompt written by the Host
    word: 30,
    doodleChars: 1_500_000, // ~1.1 MB image once base64 encoded
  },
};
