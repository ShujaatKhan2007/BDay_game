'use strict';

/**
 * VALIDATION
 * ----------
 * Everything a client sends is untrusted. These helpers check the data
 * and return either { ok: true, value } or { ok: false, error }.
 */
const CFG = require('./gameConfig');

const fail = (error) => ({ ok: false, error });
const ok = (value) => ({ ok: true, value });

/** Trim and collapse repeated spaces. Non-strings become ''. */
const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

function validateName(raw) {
  const name = clean(raw);
  if (!name) return fail('Please enter your name.');
  if (name.length > CFG.LIMITS.name) {
    return fail(`Name is too long (max ${CFG.LIMITS.name} characters).`);
  }
  return ok(name);
}

/** Round 1 - three text answers */
function validateQA(payload) {
  const { answers } = payload;
  if (!Array.isArray(answers) || answers.length !== CFG.QA_COUNT) {
    return fail(`Please answer all ${CFG.QA_COUNT} questions.`);
  }
  const cleaned = answers.map(clean);
  if (cleaned.some((a) => !a)) return fail('Please answer all questions before submitting.');
  if (cleaned.some((a) => a.length > CFG.LIMITS.answer)) {
    return fail(`Each answer can be at most ${CFG.LIMITS.answer} characters.`);
  }
  return ok({ answers: cleaned });
}

/** Round 2 - doodle as a PNG/JPEG data URL */
const IMAGE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
function validateDoodle(payload) {
  const { image } = payload;
  if (typeof image !== 'string' || image.length < 100) return fail('Please draw something first.');
  if (image.length > CFG.LIMITS.doodleChars) return fail('That drawing is too large. Please try a simpler doodle.');
  if (!IMAGE_RE.test(image)) return fail('That does not look like a valid drawing.');
  return ok({ image });
}

/** Round 3 - emoji + optional text for each situation */
function validateReactions(payload) {
  const { reactions } = payload;
  if (!Array.isArray(reactions) || reactions.length !== CFG.REACTION_COUNT) {
    return fail(`Please react to all ${CFG.REACTION_COUNT} situations.`);
  }
  const out = [];
  for (const r of reactions) {
    const emoji = typeof r?.emoji === 'string' ? r.emoji.trim() : '';
    const text = clean(r?.text);
    if (emoji.length > CFG.LIMITS.emoji) return fail('That emoji is not valid.');
    if (text.length > CFG.LIMITS.reactionText) {
      return fail(`Each reaction can be at most ${CFG.LIMITS.reactionText} characters.`);
    }
    if (!emoji && !text) return fail('Please pick an emoji or write a reaction for every situation.');
    out.push({ emoji, text });
  }
  return ok({ reactions: out });
}

/** Round 4 - one dialog */
function validateDialog(payload) {
  const dialog = clean(payload.dialog);
  if (!dialog) return fail('Please write a dialog first.');
  if (dialog.length > CFG.LIMITS.dialog) return fail(`Dialog can be at most ${CFG.LIMITS.dialog} characters.`);
  return ok({ dialog });
}

/** Round 5 - exactly one word */
function validateWord(payload) {
  const raw = typeof payload.word === 'string' ? payload.word.trim() : '';
  if (!raw) return fail('Please enter one word.');
  if (/\s/.test(raw)) return fail('Please enter only ONE word (no spaces).');
  if (raw.length > CFG.LIMITS.word) return fail(`That word is too long (max ${CFG.LIMITS.word} characters).`);
  return ok({ word: raw });
}

const SUBMISSION_VALIDATORS = {
  1: validateQA,
  2: validateDoodle,
  3: validateReactions,
  4: validateDialog,
  5: validateWord,
};

module.exports = { clean, validateName, SUBMISSION_VALIDATORS };
