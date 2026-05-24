/**
 * Markov-chain navigation tracker.
 *
 * Records pane→pane transitions in localStorage, exposes predictNext(current, k)
 * that returns the top-K most likely next panes by frequency. With enough
 * history, prefetching follows the user's actual click patterns rather than
 * a hard-coded default.
 *
 * Storage shape:
 *   { from_pane: { to_pane: count, ... }, ... }
 *
 * Mathematical underpinning: this is a first-order Markov chain over the
 * pane state space. P(next | current) is estimated by maximum likelihood
 * from the observed transition counts. For low-data regimes (<3 transitions
 * from current) we fall back to a hand-tuned prior.
 */

const STORAGE_KEY = 'am:markov:pane:v1';
const MIN_TRANSITIONS_FOR_DATA = 3;

// Hand-tuned prior used when we don't have enough observed data.
// Captures the natural user flow: Pulse → Audience/Sentiment, etc.
const PANE_DEFAULTS = {
  pulse:      ['audience', 'sentiment'],
  audience:   ['outreach', 'sentiment'],
  sentiment:  ['audience', 'contentlab'],
  contentlab: ['audience', 'outreach'],
  outreach:   ['audience', 'contentlab'],
};

function loadChain() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveChain(chain) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chain));
  } catch {}
}

/**
 * Record that the user navigated from `from` to `to`.
 * No-op for self-transitions or null arguments.
 */
export function recordTransition(from, to) {
  if (!from || !to || from === to) return;
  const chain = loadChain();
  chain[from] = chain[from] || {};
  chain[from][to] = (chain[from][to] || 0) + 1;
  saveChain(chain);
}

/**
 * Predict the top-K next panes given the current pane.
 * Returns observed top-K when enough data exists, else the prior.
 */
export function predictNext(current, k = 2) {
  if (!current) return [];
  const chain = loadChain();
  const transitions = chain[current] || {};
  const total = Object.values(transitions).reduce((a, b) => a + b, 0);

  if (total < MIN_TRANSITIONS_FOR_DATA) {
    return (PANE_DEFAULTS[current] || []).slice(0, k);
  }

  return Object.entries(transitions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, k)
    .map(([pane]) => pane);
}

/**
 * Read-only snapshot of the current chain. For debugging in console:
 *   window.amMarkov()
 */
export function snapshot() {
  return loadChain();
}

if (typeof window !== 'undefined') {
  window.amMarkov = snapshot;
}
