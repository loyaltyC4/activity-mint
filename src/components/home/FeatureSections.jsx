import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck, TrendingUp, Layers, Lock } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
   Section A — "Your Intelligence Layer"
   2-column bento grid, 4 premium feature cards
───────────────────────────────────────────────────────────────────────── */

function ColorDots() {
  return (
    <div className="flex flex-wrap gap-2 mt-5">
      {[
        'bg-primary',
        'bg-teal-400',
        'bg-emerald-300',
        'bg-teal-600',
        'bg-primary/50',
        'bg-emerald-500',
      ].map((cls, i) => (
        <div
          key={i}
          className={`${cls} rounded-full`}
          style={{ width: 24 + (i % 3) * 8, height: 24 + (i % 3) * 8, opacity: 0.85 - i * 0.04 }}
        />
      ))}
    </div>
  );
}

function MiniBarChart() {
  const bars = [0.35, 0.6, 0.45, 0.75, 0.5, 0.88, 0.68, 0.55, 0.82, 1.0];
  return (
    <div className="flex items-end gap-1 mt-5 h-10">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t-sm ${
            i === bars.length - 1
              ? 'bg-primary'
              : i === bars.length - 2
              ? 'bg-primary/60'
              : 'bg-primary/20'
          }`}
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
}

function PlatformCircles() {
  const platforms = [
    { abbr: 'IG', bg: 'bg-gradient-to-br from-pink-500 to-orange-400' },
    { abbr: 'TK', bg: 'bg-slate-900' },
    { abbr: 'YT', bg: 'bg-red-500' },
    { abbr: 'X',  bg: 'bg-slate-800' },
    { abbr: 'LI', bg: 'bg-blue-600' },
    { abbr: 'TH', bg: 'bg-slate-700' },
  ];
  return (
    <div className="flex flex-wrap gap-2 mt-5">
      {platforms.map((p) => (
        <div
          key={p.abbr}
          className={`${p.bg} w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold tracking-wide`}
        >
          {p.abbr}
        </div>
      ))}
    </div>
  );
}

function PrivacyBadge() {
  return (
    <div className="mt-5 flex">
      <div
        className="border-2 border-transparent rounded-2xl p-4 text-center"
        style={{
          backgroundImage:
            'linear-gradient(white, white), linear-gradient(135deg, #059669, #14b8a6, #6366f1)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }}
      >
        <div className="text-2xl font-extrabold text-foreground tracking-tight">100%</div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">
          Anonymous
        </div>
      </div>
    </div>
  );
}

const BENTO_CARDS = [
  {
    icon: <Layers className="w-4 h-4 text-primary" />,
    label: 'Learns Behaviour Patterns',
    description: "Builds a continuous model of any public account's posting rhythm, engagement windows, and interaction style.",
    visual: <ColorDots />,
  },
  {
    icon: <TrendingUp className="w-4 h-4 text-primary" />,
    label: 'Detects What Works',
    description: 'Surfaces the hooks, formats, and timing windows that consistently drive the most engagement.',
    visual: <MiniBarChart />,
  },
  {
    icon: <Layers className="w-4 h-4 text-primary" />,
    label: 'Tracks Every Channel',
    description: 'Unified intelligence across Instagram, TikTok, YouTube, X, LinkedIn, and Threads — in one place.',
    visual: <PlatformCircles />,
  },
  {
    icon: <Lock className="w-4 h-4 text-primary" />,
    label: 'Your Data Stays Private',
    description: 'Zero-retention architecture. Every scan is anonymous. No account required, no trace left behind.',
    visual: <PrivacyBadge />,
  },
];

export function IntelligenceSection({ onGetStarted }) {
  return (
    <section className="py-24 bg-background border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(20,184,166,0.05),transparent_55%)] pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">

        {/* Header */}
        <div className="text-center mb-14">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 px-4 py-1.5">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            Intelligence Layer
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4 leading-[1.08]">
            Your Intelligence Layer
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base leading-relaxed">
            Activity Mint runs a continuous private model across every public account you track — so every decision is backed by signal, not assumption.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {BENTO_CARDS.map((card) => (
            <Card
              key={card.label}
              className="border border-border/60 bg-card rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col"
            >
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    {card.icon}
                  </div>
                </div>
                <h3 className="font-bold text-foreground text-[15px] tracking-tight leading-snug mb-1.5">
                  {card.label}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {card.description}
                </p>
                {card.visual}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Button
            onClick={onGetStarted}
            className="bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-600/90 text-white px-8 py-6 rounded-full font-semibold text-sm hover:shadow-lg hover:shadow-primary/25 transition-all"
          >
            Start Tracking Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Section B — Platforms Grid
   Full-width pill grid, frosted overlay center text, edge fades
───────────────────────────────────────────────────────────────────────── */

const PLATFORM_TILES = [
  { name: 'Instagram', bg: 'bg-gradient-to-br from-pink-500 to-orange-400' },
  { name: 'TikTok',    bg: 'bg-slate-900' },
  { name: 'YouTube',   bg: 'bg-red-500' },
  { name: 'X / Twitter', bg: 'bg-slate-800' },
  { name: 'LinkedIn',  bg: 'bg-blue-600' },
  { name: 'Threads',   bg: 'bg-slate-700' },
  { name: 'Pinterest', bg: 'bg-red-600' },
  { name: 'Facebook',  bg: 'bg-blue-700' },
  { name: 'Reddit',    bg: 'bg-orange-500' },
  { name: 'Snapchat',  bg: 'bg-yellow-400' },
  { name: 'Twitch',    bg: 'bg-purple-600' },
  { name: 'Discord',   bg: 'bg-indigo-500' },
  { name: 'BeReal',    bg: 'bg-slate-900' },
  { name: 'Substack',  bg: 'bg-orange-500' },
  { name: 'Bluesky',   bg: 'bg-blue-500' },
];

// Two rows of 8 staggered
const ROW_A = PLATFORM_TILES.slice(0, 8);
const ROW_B = PLATFORM_TILES.slice(7, 15);

export function PlatformsSection() {
  return (
    <section className="py-20 bg-muted/20 border-t border-border relative overflow-hidden">
      <div className="text-center mb-10 px-4">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground font-medium">
          Connected intelligence
        </p>
      </div>

      {/* Scrolling tile rows */}
      <div className="relative">
        {/* Left edge fade */}
        <div
          className="absolute left-0 top-0 bottom-0 w-24 sm:w-40 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, hsl(var(--muted)/0.2), transparent)' }}
        />
        {/* Right edge fade */}
        <div
          className="absolute right-0 top-0 bottom-0 w-24 sm:w-40 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, hsl(var(--muted)/0.2), transparent)' }}
        />

        <div className="space-y-3 px-4">
          {[ROW_A, ROW_B].map((row, ri) => (
            <div key={ri} className="flex gap-3 justify-center flex-wrap">
              {row.map((tile, i) => (
                <div
                  key={`${ri}-${i}`}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-border/60 bg-card shadow-sm shrink-0"
                >
                  <div className={`w-4 h-4 rounded-full shrink-0 ${tile.bg}`} />
                  <span className="text-sm font-medium text-foreground tracking-tight whitespace-nowrap">
                    {tile.name}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Center overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div
            className="text-center px-6 py-4 rounded-2xl border border-border/60 shadow-lg"
            style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(16px)' }}
          >
            <div className="font-bold text-foreground text-2xl sm:text-3xl tracking-tight font-display">
              15+ platforms
            </div>
            <div className="text-sm text-muted-foreground mt-0.5 font-medium">
              50+ data signals tracked
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Section C — Brand Manifesto
   Large editorial copy, 3 paragraphs, left-aligned, activity-mint voice
───────────────────────────────────────────────────────────────────────── */

export function ManifestoSection({ onGetStarted }) {
  return (
    <section className="py-24 bg-background border-t border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-10">

          {/* Eyebrow */}
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground font-medium">
            Why Activity Mint
          </p>

          {/* P1 */}
          <p
            className="font-bold leading-[1.12] tracking-tight text-foreground"
            style={{ fontSize: 'clamp(26px, 3.8vw, 46px)' }}
          >
            The people winning on social aren't guessing.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-teal-500">
              They know exactly
            </span>{' '}
            what works — before they ever hit publish.
          </p>

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* P2 */}
          <p
            className="font-bold leading-[1.12] tracking-tight text-foreground"
            style={{ fontSize: 'clamp(26px, 3.8vw, 46px)' }}
          >
            Activity Mint watches every post, every rival, every signal —{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-primary">
              around the clock
            </span>{' '}
            — so you wake up with a clear picture, not a blank page.{' '}
            <span
              className="inline-block bg-primary/10 text-primary rounded-lg font-bold"
              style={{
                fontSize: '0.68em',
                padding: '3px 10px',
                verticalAlign: 'middle',
                letterSpacing: '0.04em',
              }}
            >
              AI-native
            </span>
          </p>

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* P3 */}
          <p
            className="font-bold leading-[1.12] tracking-tight text-foreground"
            style={{ fontSize: 'clamp(26px, 3.8vw, 46px)' }}
          >
            Stop reacting to the feed.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-teal-500 to-emerald-400">
              Start leading it.
            </span>
          </p>

          {/* CTA row */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              onClick={onGetStarted}
              className="bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-600/90 text-white px-7 py-6 rounded-full font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
            >
              Get started free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="border-border px-7 py-6 rounded-full font-semibold hover:bg-muted/40 transition-all"
            >
              See how it works
            </Button>
          </div>

        </div>
      </div>
    </section>
  );
}
