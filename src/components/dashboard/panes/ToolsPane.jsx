/**
 * Tools — the homepage utilities surfaced as a discoverable grid inside
 * the dashboard. Each tile navigates to the existing live tool page via
 * the parent App's tab router (NavigationContext.setActiveTab).
 *
 * No more Sheet drawer placeholder — clicking a tile now actually opens
 * the working tool page (StoryViewerView / PostViewerView / etc.).
 */

'use strict'

import React from 'react'
import {
  MonitorPlay, LayoutGrid, Star, Heart, Link2, Repeat2, UserCheck, UserMinus, FileUp,
  Hash, Video, Globe, Briefcase, BookOpen, Download, Wrench,
} from 'lucide-react'
import ToolCard from '../shared/ToolCard'
import { useNavigation } from '../NavigationContext'

// 15 tools across 3 audience-importance groups. tabId matches the
// activeTab value the parent App.jsx uses to render the live tool page.
const TOOLS = [
  // Watch & analyse (Instagram observation)
  { tabId: 'story-viewer',       Icon: MonitorPlay, name: 'Story Viewer',        description: 'View any public IG story',          group: 'watch', color: 'violet' },
  { tabId: 'post-viewer',        Icon: LayoutGrid,  name: 'Post Viewer',         description: 'Browse a profile’s recent posts',  group: 'watch', color: 'teal'   },
  { tabId: 'highlights-viewer',  Icon: Star,        name: 'Highlights Viewer',   description: 'Browse a profile’s highlights',     group: 'watch', color: 'amber'  },
  { tabId: 'like-viewer',        Icon: Heart,       name: 'Like Viewer',         description: 'See who liked a post',              group: 'watch', color: 'coral'  },
  { tabId: 'links-viewer',       Icon: Link2,       name: 'Links Viewer',        description: 'Pull links from a profile bio',     group: 'watch', color: 'sky'    },
  { tabId: 'reposts-viewer',     Icon: Repeat2,     name: 'Reposts Viewer',      description: 'Find who reposted a video',         group: 'watch', color: 'indigo' },
  // Audit your own audience
  { tabId: 'recent-follower',    Icon: UserCheck,   name: 'Recent Followers',    description: 'Track who joined this week',        group: 'audit', color: 'teal'   },
  { tabId: 'unfollower',         Icon: UserMinus,   name: 'Unfollower Tracker',  description: 'Spot who unfollowed you',           group: 'audit', color: 'coral'  },
  { tabId: 'follower-export',    Icon: FileUp,      name: 'Follower Export',     description: 'Download your follower list',       group: 'audit', color: 'sky'    },
  { tabId: 'instagram-comments', Icon: Hash,        name: 'Comment Scraper',     description: 'Pull every comment from a post',    group: 'audit', color: 'violet' },
  // Multi-platform
  { tabId: 'tiktok',             Icon: Video,       name: 'TikTok Scraper',      description: 'Profile + hashtag video pull',      group: 'cross', color: 'slate'  },
  { tabId: 'facebook-posts',     Icon: Globe,       name: 'Facebook Posts',      description: 'Recent posts from any FB page',     group: 'cross', color: 'sky'    },
  { tabId: 'linkedin-posts',     Icon: Briefcase,   name: 'LinkedIn Posts',      description: 'Posts from a LinkedIn profile',     group: 'cross', color: 'indigo' },
  { tabId: 'youtube-transcript', Icon: BookOpen,    name: 'YouTube Transcript',  description: 'Pull a clean transcript from any video', group: 'cross', color: 'coral' },
  { tabId: 'threads-downloader', Icon: Download,    name: 'Threads Downloader',  description: 'Save a Threads post locally',       group: 'cross', color: 'slate' },
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

export default function ToolsPane() {
  const { setActiveTab } = useNavigation()

  function openTool(tabId) {
    if (setActiveTab) setActiveTab(tabId)
  }

  const groups = ['watch', 'audit', 'cross']

  return (
    <>
      <PaneHeader title="Tools" subtitle="Quick utilities — no setup, no follow needed" />

      <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold">{TOOLS.length} instant utilities</div>
            <div className="text-xs text-[#64756f]">
              Click any tool to open it — results in 10–20 seconds through your tracked-handle’s scrape quota.
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
                      key={t.tabId}
                      Icon={t.Icon}
                      name={t.name}
                      description={t.description}
                      color={t.color}
                      onClick={() => openTool(t.tabId)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
