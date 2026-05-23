/**
 * Fixtures sourced from real IG responses captured during this build's
 * iteration. Each one corresponds to a state the worker has observed.
 * Run with: node detectLoginState.test.js
 */

'use strict';

const assert = require('node:assert/strict');
const { detectLoginState, STATES } = require('./detectLoginState');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── Fixture 1: post-submit "incorrect credentials" (workers 1 + 4) ────────
// Captured from /opt/activitymint/profiles/profile_1/last_login_failure.html
// on 2026-05-23T01:23. IG re-renders the form WITH a "login information you
// entered is incorrect" banner.
test('incorrect credentials banner after submit', () => {
  const snap = {
    url: 'https://www.instagram.com/',
    bodyText:
      'See everyday moments from your close friends. Log into Instagram ' +
      'The login information you entered is incorrect. Find your account and log in. ' +
      'Mobile number, username or email Password Log in Forgot password? Log in with Facebook',
    hasUserField: true,
    hasPassField: true,
    has2faField: false,
    hasHomeNav: false,
  };
  assert.equal(detectLoginState(snap), STATES.INCORRECT_CREDENTIALS);
});

// ── Fixture 2: CDN 429 on /accounts/login/ (worker 1 first attempt) ───────
// Captured at 2026-05-22T22:52. After redirect, page lands at
// chrome-error://chromewebdata/ with body containing the 429 text.
test('rate-limited login endpoint', () => {
  const snap = {
    url: 'chrome-error://chromewebdata/',
    bodyText:
      "This page isn't working. If the problem continues, contact the site owner. HTTP ERROR 429 Reload",
    hasUserField: false,
    hasPassField: false,
  };
  assert.equal(detectLoginState(snap), STATES.RATE_LIMITED);
});

test('rate-limited via body text only (no chrome-error URL)', () => {
  // Some proxies fail differently — the page loads but with the 429 body
  const snap = {
    url: 'https://www.instagram.com/accounts/login/',
    bodyText: 'Instagram please wait a few minutes before you try again',
  };
  assert.equal(detectLoginState(snap), STATES.RATE_LIMITED);
});

// ── Fixture 3: standard login form (workers 2, 3, 5 first boot) ───────────
test('login form rendered, awaiting credentials', () => {
  const snap = {
    url: 'https://www.instagram.com/accounts/login/',
    bodyText:
      'See everyday moments from your close friends. Log into Instagram ' +
      'Mobile number, username or email Password Log in Forgot password? Create new account',
    hasUserField: true,
    hasPassField: true,
    has2faField: false,
    hasHomeNav: false,
  };
  assert.equal(detectLoginState(snap), STATES.LOGIN_FORM);
});

// ── Fixture 4: logged in homepage (workers 2, 3, 5 after successful login) ─
test('logged in — home feed visible', () => {
  const snap = {
    url: 'https://www.instagram.com/',
    bodyText: 'For You Following Search Explore Reels Messages',
    hasUserField: false,
    hasPassField: false,
    hasHomeNav: true,
  };
  assert.equal(detectLoginState(snap), STATES.HOME);
});

// ── Fixture 5: suspicious-login challenge ─────────────────────────────────
test('suspicious-login challenge wall', () => {
  const snap = {
    url: 'https://www.instagram.com/challenge/',
    bodyText:
      'We Detected An Unusual Login Attempt To help keep your account safe we need to confirm it was you',
    hasUserField: false,
    hasPassField: false,
  };
  assert.equal(detectLoginState(snap), STATES.CHALLENGE);
});

// ── Fixture 6: 2FA prompt ─────────────────────────────────────────────────
test('two-factor code input visible', () => {
  const snap = {
    url: 'https://www.instagram.com/accounts/login/two_factor',
    bodyText: 'Enter security code Enter the 6-digit code from your authentication app',
    hasUserField: false,
    hasPassField: false,
    has2faField: true,
    hasHomeNav: false,
  };
  assert.equal(detectLoginState(snap), STATES.TWO_FACTOR);
});

// ── Fixture 7: state classifier prioritisation ────────────────────────────
// If both rate-limit AND incorrect-credentials text are present, rate-limit wins.
test('rate-limit beats incorrect-credentials when both present', () => {
  const snap = {
    url: 'https://www.instagram.com/',
    bodyText: 'HTTP ERROR 429 Reload The login information you entered is incorrect',
    hasUserField: true,
    hasPassField: true,
  };
  assert.equal(detectLoginState(snap), STATES.RATE_LIMITED);
});

// Challenge beats incorrect-credentials (a suspicious-login wall takes priority over creds banner)
test('challenge beats incorrect-credentials when both present', () => {
  const snap = {
    url: 'https://www.instagram.com/challenge/',
    bodyText:
      'We detected an unusual login attempt The login information you entered is incorrect',
    hasUserField: false,
    hasPassField: false,
  };
  assert.equal(detectLoginState(snap), STATES.CHALLENGE);
});

// ── Fixture 8: unknown state (catches when IG ships a new variant) ────────
test('unknown when no signals match', () => {
  const snap = {
    url: 'https://www.instagram.com/some-new-page',
    bodyText: 'Welcome to a new Instagram experience',
    hasUserField: false,
    hasPassField: false,
    hasHomeNav: false,
    has2faField: false,
  };
  assert.equal(detectLoginState(snap), STATES.UNKNOWN);
});

// ── Run ───────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
for (const t of tests) {
  try {
    t.fn();
    process.stdout.write(`  ✓ ${t.name}\n`);
    pass++;
  } catch (err) {
    process.stdout.write(`  ✗ ${t.name}\n    ${err.message}\n`);
    fail++;
  }
}
process.stdout.write(`\n${pass} passed, ${fail} failed (${tests.length} total)\n`);
process.exit(fail === 0 ? 0 : 1);
