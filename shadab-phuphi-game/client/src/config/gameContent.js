/**
 * ✏️  BIRTHDAY CONTENT  -  edit the questions and prompts HERE
 * ------------------------------------------------------------
 * The Host types the birthday person's details in the lobby:
 *
 *   name       "Shadab Phuphi"    -> ${name}
 *   short name "Phuphi"           -> ${short}   (used in the Round 3 situations)
 *   pronoun    she / he / they    -> ${subject} = she|he|they   ${possessive} = her|his|their
 *
 * Every question below is a template that fills those in, so the game works
 * for ANY birthday person. For example, with name "Iqbal Fufa", short name
 * "Fufa" and "he":
 *
 *   "What was ${possessive} nickname?"            ->  "What was his nickname?"
 *   "${short} when ${subject} can't find something."  ->  "Fufa when he can't find something."
 *
 * These are the DEFAULT questions. In the lobby the Host can edit any round or
 * add their own questions (the game then uses the Host's text instead, exactly
 * as typed). The number of questions is flexible: 1-10 in Round 1 and 1-6
 * situations in Round 3.
 * The MAXIMUM MARKS per round are set on the server (server/gameConfig.js).
 */

export const ROUND_NUMBERS = [1, 2, 3, 4, 5];

/** Things that never change: icons, button labels, socket events */
const ROUND_META = {
  1: { icon: '❓', column: 'Q&A', submitEvent: 'submit_answer', submitLabel: 'SUBMIT ANSWERS', saveLabel: 'SAVE ROUND 1 SCORES', doneMessage: '✅ Answers submitted!' },
  2: { icon: '🎨', column: 'Doodle', submitEvent: 'submit_doodle', submitLabel: 'SUBMIT DOODLE', saveLabel: 'SAVE DOODLE SCORE', doneMessage: '🎨 Doodle submitted!' },
  3: { icon: '😂', column: 'Reaction', submitEvent: 'submit_reaction', submitLabel: 'SUBMIT REACTIONS', saveLabel: 'SAVE ROUND 3 SCORE', doneMessage: '😂 Reactions submitted!' },
  4: { icon: '🗣️', column: 'Dialog', submitEvent: 'submit_dialog', submitLabel: 'SUBMIT DIALOG', saveLabel: 'SAVE ROUND 4 SCORE', doneMessage: '🗣️ Dialog submitted!' },
  5: { icon: '❤️', column: 'One Word', submitEvent: 'submit_one_word', submitLabel: 'SUBMIT', saveLabel: 'SAVE FINAL SCORE', doneMessage: '❤️ Your word has been submitted!' },
};

/** The choices in the Host lobby */
export const PRONOUNS = {
  she: { label: 'She / her', subject: 'she', possessive: 'her' },
  he: { label: 'He / his', subject: 'he', possessive: 'his' },
  they: { label: 'They / their', subject: 'they', possessive: 'their' },
};

/** Same limits as the server (server/gameConfig.js). The server enforces them. */
export const LIMITS = { maxQuestions: 10, maxSituations: 6, maxEmojis: 8, question: 150, prompt: 200 };
export const DEFAULT_EMOJIS = ['😡', '😤', '😭', '😂'];

/** Start page (shown before any birthday person is known) */
export const APP = {
  titleTop: 'BIRTHDAY',
  titleBottom: 'CHALLENGE',
  ribbon: 'THE PARTY GAME SHOW',
};

/** "a Shadab Phuphi dialog"  /  "an Iqbal Fufa dialog" */
const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** ✏️ THE QUESTIONS (templates) */
function buildRounds({ name, short, subject, possessive }) {
  const NAME = name.toUpperCase();
  const SHORT = short.toUpperCase();
  return {
    1: {
      name: 'Q&A',
      questions: [
        `How old is ${name} turning this birthday?`,
        `What was ${possessive} nickname?`,
        `What is ${name}'s biggest weakness?`,
      ],
    },
    2: {
      name: 'DOODLE CHALLENGE',
      prompt: `Draw something that instantly reminds you of ${name}.`,
    },
    3: {
      name: `${SHORT}'S REACTION CHALLENGE`,
      situations: [
        { text: `${short} when ${subject} can't find something.`, emojis: ['😡', '😤', '😭', '😂'] },
        { text: `Someone ate ${short}'s food without asking.`, emojis: ['😡', '😤', '😭', '😂'] },
        { text: `${short} after shopping.`, emojis: ['🛍️', '😍', '😎', '😂'] },
      ],
    },
    4: {
      name: `${NAME}'S DIALOG`,
      prompt: `Write ${article(name)} ${name} dialog which you know.`,
    },
    5: {
      name: `DEFINE ${NAME}`,
      prompt: `Define ${name} in ONE word.`,
    },
  };
}

/**
 * Everything the screens need for the birthday person the Host entered
 * (`celebrant` is { name, shortName, pronoun } or null before it is set).
 * `custom` is what the Host edited in the lobby ({ 1:{questions}, 3:{situations}, ... });
 * any round the Host did not touch keeps the default questions above:
 *   rounds[1..5]  -> icon, name, questions/prompt, labels ...
 *   event.title / event.celebrant
 */
export function getContent(celebrant, custom) {
  const name = celebrant?.name?.trim() || 'the birthday star';
  const short = celebrant?.shortName?.trim() || name;
  const pronoun = PRONOUNS[celebrant?.pronoun] || PRONOUNS.they;

  const text = buildRounds({ name, short, subject: pronoun.subject, possessive: pronoun.possessive });
  const rounds = Object.fromEntries(ROUND_NUMBERS.map((r) => [r, { ...ROUND_META[r], ...text[r], ...(custom?.[r] || {}) }]));

  return {
    rounds,
    event: {
      title: celebrant ? name.toUpperCase() : 'BIRTHDAY CHALLENGE',
      celebrant: celebrant ? name : '',
    },
  };
}
