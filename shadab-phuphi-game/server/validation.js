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

/**
 * The birthday person, entered by the Host in the lobby.
 *   name       "Shadab Phuphi"   used in the questions
 *   shortName  "Phuphi"          optional, used in the Round 3 situations
 *   pronoun    she | he | they   so questions say "her / his / their nickname"
 */
function validateCelebrant(payload) {
  const name = clean(payload.name);
  const shortName = clean(payload.shortName);
  if (!name) return fail("Please enter the birthday person's name.");
  if (name.length > CFG.LIMITS.celebrantName) return fail(`That name is too long (max ${CFG.LIMITS.celebrantName} characters).`);
  if (shortName.length > CFG.LIMITS.celebrantShort) return fail(`The short name is too long (max ${CFG.LIMITS.celebrantShort} characters).`);
  if (!CFG.PRONOUNS.includes(payload.pronoun)) return fail('Please choose a pronoun: she / her, he / his or they / their.');
  return ok({ name, shortName, pronoun: payload.pronoun });
}

/**
 * Host-written questions for ONE round (lobby only).
 *   Round 1  { questions: ['...', ...] }
 *   Round 2, 4, 5  { prompt: '...' }
 *   Round 3  { situations: [{ text: '...', emojis: ['😡', ...] }, ...] }
 */
function validateRoundContent(round, content) {
  if (!content || typeof content !== 'object') return fail('No questions were sent.');
  const L = CFG.LIMITS;

  if (round === 1) {
    const list = content.questions;
    if (!Array.isArray(list) || list.length < 1 || list.length > CFG.MAX_QUESTIONS) {
      return fail(`Round 1 needs between 1 and ${CFG.MAX_QUESTIONS} questions.`);
    }
    const questions = list.map(clean);
    if (questions.some((q) => !q)) return fail('Please fill in every question (or delete the empty ones).');
    if (questions.some((q) => q.length > L.question)) return fail(`Each question can be at most ${L.question} characters.`);
    return ok({ questions });
  }

  if (round === 3) {
    const list = content.situations;
    if (!Array.isArray(list) || list.length < 1 || list.length > CFG.MAX_SITUATIONS) {
      return fail(`Round 3 needs between 1 and ${CFG.MAX_SITUATIONS} situations.`);
    }
    const situations = [];
    for (const item of list) {
      const text = clean(item?.text);
      if (!text) return fail('Please fill in every situation (or delete the empty ones).');
      if (text.length > L.question) return fail(`Each situation can be at most ${L.question} characters.`);
      const rawEmojis = Array.isArray(item?.emojis) ? item.emojis : [];
      const emojis = [...new Set(rawEmojis.map((e) => (typeof e === 'string' ? e.trim() : '')).filter(Boolean))];
      if (emojis.length > CFG.MAX_EMOJIS) return fail(`Use at most ${CFG.MAX_EMOJIS} emoji choices per situation.`);
      if (emojis.some((e) => e.length > L.emoji)) return fail('One of the emoji choices is not valid.');
      situations.push({ text, emojis });
    }
    return ok({ situations });
  }

  if (round === 2 || round === 4 || round === 5) {
    const prompt = clean(content.prompt);
    if (!prompt) return fail('Please write the prompt for this round.');
    if (prompt.length > L.prompt) return fail(`The prompt can be at most ${L.prompt} characters.`);
    return ok({ prompt });
  }

  return fail('Unknown round.');
}

/** Round 1 - one text answer per question (ctx.qaCount questions this game) */
function validateQA(payload, ctx = {}) {
  const expected = ctx.qaCount || CFG.QA_COUNT;
  const { answers } = payload;
  if (!Array.isArray(answers) || answers.length !== expected) {
    return fail(`Please answer all ${expected} question${expected === 1 ? '' : 's'}.`);
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
function validateReactions(payload, ctx = {}) {
  const expected = ctx.reactionCount || CFG.REACTION_COUNT;
  const { reactions } = payload;
  if (!Array.isArray(reactions) || reactions.length !== expected) {
    return fail(`Please react to all ${expected} situation${expected === 1 ? '' : 's'}.`);
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

module.exports = { clean, validateName, validateCelebrant, validateRoundContent, SUBMISSION_VALIDATORS };
