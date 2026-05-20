import React from 'react';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { canAccess, upgradeTierFor, TIERS, PRICING } from '../lib/tiers';

/**
 * AccessGate — wraps premium content with a blur overlay and upgrade CTA.
 *
 * Usage:
 *   <AccessGate tier={userTier} feature="report.ai-insights" onUpgrade={...}>
 *     <ExpensiveInsightsPanel data={data} />
 *   </AccessGate>
 *
 * Props:
 *   tier       — current user tier string ('guest'|'free'|'standard'|'premium')
 *   feature    — feature key from FEATURES map
 *   onUpgrade  — called when user clicks "Upgrade" (receives target tier)
 *   onLogin    — called when guest clicks "Sign In" (optional, falls back to onUpgrade)
 *   children   — the gated content
 *   preview    — if true, renders children blurred instead of hiding them (default: true)
 *   compact    — if true, shows a smaller inline lock badge instead of full overlay
 *   className  — extra classes on wrapper
 */
export default function AccessGate({
  tier = 'guest',
  feature,
  onUpgrade,
  onLogin,
  children,
  preview = true,
  compact = false,
  className = '',
}) {
  const hasAccess = canAccess(tier, feature);

  // Full access — just render children
  if (hasAccess) return <>{children}</>;

  const targetTier = upgradeTierFor(tier, feature);
  const isGuest = tier === 'guest';
  const targetInfo = TIERS[targetTier] || TIERS.standard;
  const price = PRICING[targetTier];

  // Compact inline lock (for table cells, small metrics)
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-slate-400 cursor-pointer hover:text-indigo-500 transition-colors ${className}`}
        onClick={() => isGuest ? (onLogin || onUpgrade)?.(targetTier) : onUpgrade?.(targetTier)}
        title={isGuest ? 'Sign in to unlock' : `Upgrade to ${targetInfo.label}`}
      >
        <Lock className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">
          {isGuest ? 'Sign in' : 'Upgrade'}
        </span>
      </span>
    );
  }

  // Full overlay with blurred preview
  return (
    <div className={`relative ${className}`}>
      {/* Blurred content preview */}
      {preview && (
        <div className="pointer-events-none select-none" aria-hidden="true">
          <div className="blur-md opacity-60">
            {children}
          </div>
        </div>
      )}

      {/* Gate overlay */}
      <div className={`${preview ? 'absolute inset-0' : ''} flex items-center justify-center z-10`}>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 max-w-sm mx-4 text-center">
          {/* Icon */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
            {isGuest ? (
              <Lock className="w-6 h-6 text-indigo-600" />
            ) : (
              <Sparkles className="w-6 h-6 text-purple-600" />
            )}
          </div>

          {/* Headline */}
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {isGuest ? 'Sign in to unlock' : `Unlock with ${targetInfo.label}`}
          </h3>

          {/* Description */}
          <p className="text-sm text-slate-500 mb-5 leading-relaxed">
            {isGuest
              ? 'Create a free account to access this feature and start tracking Instagram activity.'
              : price
                ? `Get full access to this feature and more starting at $${price.monthly}/mo.`
                : `Upgrade to the ${targetInfo.label} plan for full access.`}
          </p>

          {/* CTA */}
          <button
            onClick={() => isGuest ? (onLogin || onUpgrade)?.(targetTier) : onUpgrade?.(targetTier)}
            className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:shadow-lg ${
              isGuest
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-indigo-500/25'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-emerald-500/25'
            }`}
          >
            {isGuest ? 'Create Free Account' : `Upgrade to ${targetInfo.label}`}
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Secondary link */}
          {!isGuest && (
            <p className="text-xs text-slate-400 mt-3">
              See all plans on the{' '}
              <button className="text-indigo-500 hover:underline font-medium">
                Pricing page
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * AccessBadge — small inline indicator showing which tier a feature requires.
 * Use next to feature names in pricing tables, tooltips, etc.
 */
export function AccessBadge({ feature, className = '' }) {
  const targetTier = upgradeTierFor('guest', feature);
  if (!targetTier || targetTier === 'guest') return null;
  const info = TIERS[targetTier];
  const colors = {
    free: 'bg-slate-100 text-slate-600',
    standard: 'bg-emerald-50 text-emerald-600',
    premium: 'bg-purple-50 text-purple-600',
  };
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${colors[targetTier] || colors.standard} ${className}`}>
      {info.label}
    </span>
  );
}
