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

  // Maximum marks per round. Total = 3 + 5 + 1 + 2 + 1 = 12
  MAX_SCORES: { 1: 3, 2: 5, 3: 1, 4: 2, 5: 1 },

  // How many answers each round expects
  QA_COUNT: 3, // Round 1: three questions
  REACTION_COUNT: 3, // Round 3: three situations

  // Safety limits (a small family party never gets near these)
  MAX_PARTICIPANTS: Number(process.env.MAX_PARTICIPANTS) || 60,
  MAX_GAMES: 20,
  GAME_TTL_MS: 12 * 60 * 60 * 1000, // forget games idle for 12 hours

  LIMITS: {
    name: 24,
    answer: 200,
    reactionText: 120,
    emoji: 16,
    dialog: 300,
    word: 30,
    doodleChars: 1_500_000, // ~1.1 MB image once base64 encoded
  },
};
