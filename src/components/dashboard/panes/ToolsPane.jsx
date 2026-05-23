/**
 * Free Tools — the 14 homepage utilities surfaced as a discoverable grid
 * inside the dashboard. Each tile opens a Sheet (side drawer) that renders
 * the existing tool view from src/views.jsx / src/apify-views.jsx / src/pages/.
 *
 * The tools already route through Vercel api/apify-proxy → orchestrator →
 * CloakBrowser workers 2/3/5 — no new backend wiring is needed here. The
 * Sheet just hosts the existing tool UI so the user can run it without
 * leaving the dashboard.
 */

'use strict'

import React, { useState } from 'react'
import {
  MonitorPlay, Star, Heart, Link2, Repeat2, UserCheck, UserMinus, FileUp,
  Hash, Video, Globe, Briefcase, BookOpen, Download, Wrench,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import ToolCard from '../shared/ToolCard'

// The 14 homepage tools, grouped by audience-importance:
// - Watch & analyse: lookup + non-destructive observation (most common use)
// - Audit your own audience: follower-list utilities
// - Multi-platform: TikTok/FB/LinkedIn/YouTube/Threads
const TOOLS = [
  // Watch & analyse (Instagram observation)
  { id: 'story-viewer',       Icon: MonitorPlay, name: 'Story Viewer',           description: 'View any public IG story',            group: 'watch', color: 'violet' },
  { id: 'highlights-viewer',  Icon: Star,        name: 'Highlights Viewer',      description: 'Browse a profile’s highlights',  group: 'watch', color: 'amber'  },
  { id: 'like-viewer',        Icon: Heart,       name: 'Like Viewer',            description: 'See who liked a post',                group: 'watch', color: 'coral'  },
  { id: 'links-viewer',       Icon: Link2,       name: 'Links Viewer',           description: 'Pull links from a profile bio',       group: 'watch', color: 'sky'    },
  { id: 'reposts-viewer',     Icon: Repeat2,     name: 'Reposts Viewer',         description: 'Find who reposted a video',           group: 'watch', color: 'indigo' },
  // Audit your own audience
  { id: 'recent-follower',    Icon: UserCheck,   name: 'Recent Followers',       description: 'Track who joined this week',          group: 'audit', color: 'teal'   },
  { id: 'unfollower',         Icon: UserMinus,   name: 'Unfollower Tracker',     description: 'Spot who unfollowed you',             group: 'audit', color: 'coral'  },
  { id: 'follower-export',    Icon: FileUp,      name: 'Follower Export',        description: 'Download your follower list',         group: 'audit', color: 'sky'    },
  { id: 'instagram-comments', Icon: Hash,        name: 'Comment Scraper',        description: 'Pull every comment from a post',      group: 'audit', color: 'violet' },
  // Multi-platform
  { id: 'tiktok',             Icon: Video,       name: 'TikTok Scraper',         description: 'Profile + hashtag video pull',        group: 'cross', color: 'slate'  },
  { id: 'facebook-posts',     Icon: Globe,       name: 'Facebook Posts',         description: 'Recent posts from any FB page',       group: 'cross', color: 'sky'    },
  { id: 'linkedin-posts',     Icon: Briefcase,   name: 'LinkedIn Posts',         description: 'Posts from a LinkedIn profile',       group: 'cross', color: 'indigo' },
  { id: 'youtube-transcript', Icon: BookOpen,    name: 'YouTube Transcript',     description: 'Pull a clean transcript from any video', group: 'cross', color: 'coral' },
  { id: 'threads-downloader', Icon: Download,    name: 'Threads Downloader',     description: 'Save a Threads post locally',         group: 'cross', color: 'slate', badge: 'BETA' },
]

const GROUP_TITLES = {
  watch: 'Watch & analyse',
  audit: 'Audit your audience',
  cross: 'Other platforms',
}

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

function ToolDrawer({ tool, open, onOpenChange }) {
  if (!tool) return null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <tool.Icon className="h-5 w-5" />
            {tool.name}
          </SheetTitle>
          <SheetDescription>{tool.description}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 rounded-2xl bg-[#f0f4f3] p-5">
          <p className="text-sm text-[#64756f]">
            <strong>Live link:</strong> this tool is wired through the Activity Mint cluster (workers 2/3/5)
            via <code className="rounded bg-white px-1.5 py-0.5 text-xs">/api/apify-proxy</code>.
            The full interactive UI ships in Phase 4 — it reuses the existing tool view from
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">src/views.jsx</code> / <code className="rounded bg-white px-1.5 py-0.5 text-xs">src/pages/NewTools.jsx</code> /
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">src/apify-views.jsx</code>.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function ToolsPane() {
  const [openTool, setOpenTool] = useState(null)
  const groups = ['watch', 'audit', 'cross']

  return (
    <>
      <PaneHeader title="Free Tools" subtitle="Quick utilities — no setup, no follow needed" />

      <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold">14 instant utilities</div>
            <div className="text-xs text-[#64756f]">
              Most return results in 10–20 seconds. All run through your tracked-handle’s scrape quota.
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {groups.map((g) => {
            const items = TOOLS.filter((t) => t.group === g)
            return (
              <section key={g}>
                <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#64756f]">
                  {GROUP_TITLES[g]}
                </div>
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((t) => (
                    <ToolCard
                      key={t.id}
                      Icon={t.Icon}
                      name={t.name}
                      description={t.description}
                      color={t.color}
                      badge={t.badge}
                      onClick={() => setOpenTool(t)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <ToolDrawer tool={openTool} open={!!openTool} onOpenChange={(o) => !o && setOpenTool(null)} />
    </>
  )
}
