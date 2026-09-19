/**
 * ✏️  BIRTHDAY CONTENT  -  edit the questions and prompts HERE
 * ------------------------------------------------------------
 * Every question, prompt, emoji and label the game shows lives in this file.
 *
 * Note: the MAXIMUM MARKS per round are set on the server
 * (server/gameConfig.js) because the server has to enforce them. The Host
 * screens pick them up automatically.
 *
 * Keep the NUMBER of items the same (3 questions in Round 1, 3 situations in
 * Round 3), because the server expects exactly that many answers.
 */

export const EVENT = {
  title: 'SHADAB PHUPHI',
  subtitle: 'BIRTHDAY CHALLENGE',
  celebrant: 'Shadab Phuphi',
};

export const ROUND_NUMBERS = [1, 2, 3, 4, 5];

export const ROUNDS = {
  1: {
    icon: '❓',
    name: 'Q&A',
    column: 'Q&A',
    submitEvent: 'submit_answer',
    submitLabel: 'SUBMIT ANSWERS',
    saveLabel: 'SAVE ROUND 1 SCORES',
    doneMessage: '✅ Answers submitted!',
    questions: [
      'How old is Shadab Phuphi turning this birthday?',
      'What was her nickname?',
      "What is Shadab Phuphi's biggest weakness?",
    ],
  },

  2: {
    icon: '🎨',
    name: 'DOODLE CHALLENGE',
    column: 'Doodle',
    submitEvent: 'submit_doodle',
    submitLabel: 'SUBMIT DOODLE',
    saveLabel: 'SAVE DOODLE SCORE',
    doneMessage: '🎨 Doodle submitted!',
    prompt: 'Draw something that instantly reminds you of Shadab Phuphi.',
  },

  3: {
    icon: '😂',
    name: "PHUPHI'S REACTION CHALLENGE",
    column: 'Reaction',
    submitEvent: 'submit_reaction',
    submitLabel: 'SUBMIT REACTIONS',
    saveLabel: 'SAVE ROUND 3 SCORE',
    doneMessage: '😂 Reactions submitted!',
    situations: [
      { text: "Phuphi when she can't find something.", emojis: ['😡', '😤', '😭', '😂'] },
      { text: "Someone ate Phuphi's food without asking.", emojis: ['😡', '😤', '😭', '😂'] },
      { text: 'Phuphi after shopping.', emojis: ['🛍️', '😍', '😎', '😂'] },
    ],
  },

  4: {
    icon: '🗣️',
    name: "SHADAB PHUPHI'S DIALOG",
    column: 'Dialog',
    submitEvent: 'submit_dialog',
    submitLabel: 'SUBMIT DIALOG',
    saveLabel: 'SAVE ROUND 4 SCORE',
    doneMessage: '🗣️ Dialog submitted!',
    prompt: 'Write a Shadab Phuphi dialog which you know.',
  },

  5: {
    icon: '❤️',
    name: 'DEFINE SHADAB PHUPHI',
    column: 'One Word',
    submitEvent: 'submit_one_word',
    submitLabel: 'SUBMIT',
    saveLabel: 'SAVE FINAL SCORE',
    doneMessage: '❤️ Your word has been submitted!',
    prompt: 'Define Shadab Phuphi in ONE word.',
  },
};
