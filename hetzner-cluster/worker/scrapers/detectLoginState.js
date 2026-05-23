/**
 * Pure state detector for Instagram's login flow.
 *
 * Given a snapshot of what's on the page (url, body text, presence of key
 * inputs/nav), classify which page state we're on. Pure: no browser I/O,
 * trivially unit-testable against captured HTML fixtures.
 *
 * Every distinct outcome the worker can see when logging in goes through this
 * function. Adding a new IG variant = update the patterns here + add a fixture.
 */

'use strict';

const STATES = Object.freeze({
  HOME:                  'home',                  // logged-in feed visible
  LOGIN_FORM:            'login_form',            // email/pass fields are present, not yet submitted
  TWO_FACTOR:            'two_factor',            // post-submit, 2FA code input visible
  CHALLENGE:             'challenge',             // IG suspicious-login / device-verify wall
  INCORRECT_CREDENTIALS: 'incorrect_credentials', // post-submit, IG says credentials wrong (real or anti-bot deflection)
  RATE_LIMITED:          'rate_limited',          // CDN 429, "page isn't working", etc.
  UNKNOWN:               'unknown',               // nothing matched — capture HTML and look
});

// ── Body-text regexes ────────────────────────────────────────────────────
const RATE_LIMIT_RE = /(?:http error 429|page isn[’'`]t working|please wait a few minutes|too many requests)/i;
const CHALLENGE_RE = /(?:we detected an unusual login|help us confirm|suspicious login|verify your identity|temporarily locked|challenge[_ ]required)/i;
const INCORRECT_RE = /(?:login information you entered is incorrect|sorry,? your password was incorrect|we didn[’'`]t recognize|incorrect username or password)/i;

/**
 * @param {object} snap
 * @param {string} snap.url           - page URL
 * @param {string} snap.bodyText      - innerText of <body> (or empty)
 * @param {boolean} snap.hasUserField - whether a username/email input was detected
 * @param {boolean} snap.hasPassField - whether a password input was detected
 * @param {boolean} snap.has2faField  - whether a verification-code input was detected
 * @param {boolean} snap.hasHomeNav   - whether the home/feed nav indicator was detected
 * @returns {string} one of STATES.*
 */
function detectLoginState(snap) {
  const url  = snap?.url || '';
  const body = snap?.bodyText || '';

  // 1. Hard CDN/edge-layer block — usually surfaces before page renders
  if (RATE_LIMIT_RE.test(body) || url.startsWith('chrome-error://')) {
    return STATES.RATE_LIMITED;
  }

  // 2. Suspicious-login challenge / device verify (wins over creds-incorrect)
  if (CHALLENGE_RE.test(body)) {
    return STATES.CHALLENGE;
  }

  // 3. 2FA prompt — input is the strongest signal
  if (snap?.has2faField) {
    return STATES.TWO_FACTOR;
  }

  // 4. Wrong credentials banner. Note IG can show the login form AND the
  // incorrect-creds banner together (form re-rendered with the error); the
  // banner is what we care about.
  if (INCORRECT_RE.test(body)) {
    return STATES.INCORRECT_CREDENTIALS;
  }

  // 5. Already logged in — feed nav is the strongest positive signal
  if (snap?.hasHomeNav && !snap?.hasUserField) {
    return STATES.HOME;
  }

  // 6. Login form sitting there waiting for credentials
  if (snap?.hasUserField && snap?.hasPassField) {
    return STATES.LOGIN_FORM;
  }

  // 7. Don't know yet — caller should dump HTML for inspection
  return STATES.UNKNOWN;
}

module.exports = { detectLoginState, STATES };
