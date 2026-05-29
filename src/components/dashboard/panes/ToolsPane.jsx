/**
 * Tools — 1:1 port of insight-flow's tools.tsx with the activity-mint
 * Instagram + cross-platform tool catalog folded into a single, uniform grid.
 *
 * Design treatment:
 *   - Featured row (2 cards) for the hero tools (dark "ink" cards with brand glow)
 *   - Section card "All tools" with category sub-headers (Instagram / Utility /
 *     Other platforms), each rendering the bento mini-card the source uses
 *
 * Icon swaps to avoid Vite chunk collision with Sidebar:
 *   Wrench → Hammer, FileText → Files, Sparkles → Wand2,
 *   LayoutGrid → Grid3x3, MessageSquare → MessageCircle, Globe → Earth
 */
'use strict'

import React from 'react'
import {
  Hammer, Hash, Files, MonitorPlay, Grid3x3, Star, Heart, Link2, Repeat2,
  UserCheck, UserMinus, Download, ShieldCheck, MessageCircle, Earth, Video,
  ArrowRight, Wand2, Clock,
} from 'lucide-react'
import SectionCard from '../shared/SectionCard'
import { useNavigation } from '../NavigationContext'

const TOOLS = [
  // ── Featured (Instagram core) ─────────────────────────────────────────
  {
    id: 'hashtag-generator',
    icon: Hash,
    label: 'Hashtag Generator',
    desc: "Cluster-aware tags ranked by your handle's reach ceiling.",
    category: 'Utility',
    time: '10s',
    featured: true,
  },
  {
    id: 'story-viewer',
    icon: MonitorPlay,
    label: 'Story Viewer',
    desc: "Browse any public account's active stories anonymously.",
    category: 'Instagram',
    time: '8s',
    featured: true,
  },

  // ── Instagram tools ────────────────────────────────────────────────────
  {
    id: 'post-viewer',
    icon: Grid3x3,
    label: 'Post Viewer',
    desc: 'Scroll any public grid, save posts and inspect captions.',
    category: 'Instagram',
    time: '12s',
  },
  {
    id: 'highlights-viewer',
    icon: Star,
    label: 'Highlights Viewer',
    desc: 'View saved highlight reels without leaving a trace.',
    category: 'Instagram',
    time: '15s',
  },
  {
    id: 'like-viewer',
    icon: Heart,
    label: 'Like Viewer',
    desc: 'See which posts an account has liked recently.',
    category: 'Instagram',
    time: '10s',
  },
  {
    id: 'links-viewer',
    icon: Link2,
    label: 'Bio Links Viewer',
    desc: 'Inspect all links-in-bio and connected profiles.',
    category: 'Instagram',
    time: '6s',
  },
  {
    id: 'reposts-viewer',
    icon: Repeat2,
    label: 'Reposts Viewer',
    desc: 'Track what content an account is resharing.',
    category: 'Instagram',
    time: '12s',
  },
  {
    id: 'recent-follower',
    icon: UserCheck,
    label: 'Recent Followers',
    desc: 'See the newest accounts following any public handle.',
    category: 'Instagram',
    time: '10s',
  },
  {
    id: 'unfollower',
    icon: UserMinus,
    label: 'Unfollower Tracker',
    desc: 'Find who stopped following you since your last check.',
    category: 'Instagram',
    time: '14s',
  },
  {
    id: 'follower-export',
    icon: Download,
    label: 'Follower Export',
    desc: 'Download your follower list as a CSV for further analysis.',
    category: 'Instagram',
    time: '20s',
  },
  {
    id: 'instagram-comments',
    icon: MessageCircle,
    label: 'Comment Scraper',
    desc: 'Extract all comments from any public post for sentiment analysis.',
    category: 'Instagram',
    time: '18s',
  },

  // ── Utility tools ──────────────────────────────────────────────────────
  {
    id: 'shadowban-checker',
    icon: ShieldCheck,
    label: 'Shadowban Checker',
    desc: 'Diagnose whether a hashtag or account is suppressed in discovery.',
    category: 'Utility',
    time: '8s',
  },

  // ── Other platforms ────────────────────────────────────────────────────
  {
    id: 'tiktok',
    icon: Video,
    label: 'TikTok Scraper',
    desc: 'Pull public TikTok posts, captions and engagement data.',
    category: 'TikTok',
    time: '25s',
  },
  {
    id: 'facebook-posts',
    icon: Earth,
    label: 'Facebook Posts',
    desc: 'Extract public Facebook page posts and engagement.',
    category: 'Facebook',
    time: '20s',
  },
  {
    id: 'youtube-transcript',
    icon: Files,
    label: 'YouTube Transcript',
    desc: 'Pull any YouTube video transcript for repurposing or research.',
    category: 'YouTube',
    time: '15s',
  },
]

const CATEGORY_TONE = {
  Instagram: { ring: 'ring-rose-500/20',  bg: 'bg-rose-500/8',  text: 'text-rose-500'  },
  Utility:   { ring: 'ring-violet/20',    bg: 'bg-violet/10',   text: 'text-violet'    },
  TikTok:    { ring: 'ring-foreground/10',bg: 'bg-foreground/5',text: 'text-foreground'},
  Facebook:  { ring: 'ring-sky-500/20',   bg: 'bg-sky-500/10',  text: 'text-sky-500'   },
  YouTube:   { ring: 'ring-red-500/20',   bg: 'bg-red-500/10',  text: 'text-red-500'   },
}

const GROUPS = [
  { label: 'Instagram tools',  filter: (t) => t.category === 'Instagram' && !t.featured },
  { label: 'Utility tools',    filter: (t) => t.category === 'Utility'   && !t.featured },
  { label: 'Other platforms',  filter: (t) => !['Instagram','Utility'].includes(t.category) && !t.featured },
]

export default function ToolsPane() {
  const { setActiveTab } = useNavigation()
  const featured = TOOLS.filter((t) => t.featured)

  return (
    <>
      <div>
        <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
          Tools
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-prose">
          Single-purpose utilities that finish in seconds. No setup, no prompting — just inputs and a clean output.
        </p>
      </div>

      {/* Featured row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {featured.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="relative p-6 rounded-2xl bg-foreground text-white overflow-hidden group cursor-pointer hover:shadow-glow transition-all text-left"
            >
              <div className="absolute -top-16 -right-16 size-48 bg-brand/30 blur-3xl rounded-full group-hover:bg-brand/50 transition-colors" />
              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <div className="size-11 rounded-xl bg-brand/15 grid place-items-center">
                    <Icon className="size-5 text-brand" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand bg-brand/10 px-2 py-1 rounded flex items-center gap-1">
                    <Wand2 className="size-3" /> Featured
                  </span>
                </div>
                <h3 className="font-display font-bold text-2xl tracking-tight leading-tight mb-2">
                  {t.label}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed mb-6">{t.desc}</p>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/50 flex items-center gap-1.5">
                    <Clock className="size-3" /> Avg {t.time}
                  </div>
                  <span className="px-4 py-2 bg-brand text-foreground rounded-lg font-semibold text-xs hover:bg-white transition-all flex items-center gap-1.5 group/btn">
                    Launch <ArrowRight className="size-3.5 group-hover/btn:translate-x-0.5 transition-transform" strokeWidth={2.5} />
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* All tools — grouped */}
      <SectionCard
        title="All tools"
        subtitle="Mini-utilities for everyday loops"
        icon={<Hammer className="size-4" strokeWidth={2} />}
      >
        <div className="space-y-7">
          {GROUPS.map((group) => {
            const tools = TOOLS.filter(group.filter)
            if (tools.length === 0) return null
            return (
              <div key={group.label}>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3 pb-2 border-b border-hairline">
                  {group.label} · {tools.length}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tools.map((tool) => {
                    const Icon = tool.icon
                    const tone = CATEGORY_TONE[tool.category] || CATEGORY_TONE.Utility
                    return (
                      <button
                        key={tool.id}
                        onClick={() => setActiveTab(tool.id)}
                        className="group p-4 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/60 hover:bg-card hover:shadow-pop hover:ring-brand/40 transition-all text-left"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="size-9 rounded-lg bg-brand-soft text-brand-ink grid place-items-center group-hover:bg-brand group-hover:text-foreground transition-colors">
                            <Icon className="size-4" strokeWidth={2} />
                          </div>
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded ${tone.bg} ${tone.text}`}>
                            {tool.category}
                          </span>
                        </div>
                        <div className="text-sm font-display font-semibold tracking-tight">{tool.label}</div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tool.desc}</p>
                        <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <Clock className="size-2.5" /> {tool.time}
                          </span>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-brand-ink opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            Run <ArrowRight className="size-2.5" />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Build your own */}
      <SectionCard tone="ink">
        <div className="absolute -top-12 -left-12 size-56 bg-violet/30 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
          <div>
            <Wand2 className="size-5 text-brand mb-3" />
            <h3 className="font-display font-bold text-2xl tracking-tight leading-tight text-white">
              Build your own tool
            </h3>
            <p className="text-sm text-white/60 mt-2 max-w-xl">
              Chain prompts, scrapers, and your own templates into a one-tap utility. Saved to your sidebar.
            </p>
          </div>
          <button className="shrink-0 px-5 py-3 bg-brand text-foreground rounded-xl font-semibold text-sm hover:bg-brand/90 transition-all flex items-center gap-2">
            Open builder <ArrowRight className="size-4" strokeWidth={2.25} />
          </button>
        </div>
      </SectionCard>
    </>
  )
}
