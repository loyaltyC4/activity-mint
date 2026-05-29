/**
 * ToolsPane — utility tools grid inside the dashboard.
 * Links to the existing tools in the parent App via useNavigation().
 * Design: Insight Flow bento cards with brand teal active states.
 */

'use strict'

import React from 'react'
import {
  MonitorPlay, LayoutGrid, Star, Heart, Link2, Repeat2,
  UserCheck, UserMinus, Download, Hash, ShieldCheck,
  MessageSquare, Clock, FileText, Globe, Video,
} from 'lucide-react'
import { useNavigation } from '../NavigationContext'
import { cn } from '@/lib/utils'

const TOOLS = [
  // ── Instagram ──────────────────────────────────────────────────────────
  {
    id: 'story-viewer',
    icon: MonitorPlay,
    label: 'Story Viewer',
    desc: 'Browse any public account\'s active stories anonymously.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'post-viewer',
    icon: LayoutGrid,
    label: 'Post Viewer',
    desc: 'Scroll any public grid, save posts and inspect captions.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'highlights-viewer',
    icon: Star,
    label: 'Highlights Viewer',
    desc: 'View saved highlight reels without leaving a trace.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'like-viewer',
    icon: Heart,
    label: 'Like Viewer',
    desc: 'See which posts an account has liked recently.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'links-viewer',
    icon: Link2,
    label: 'Bio Links Viewer',
    desc: 'Inspect all links-in-bio and connected profiles.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'reposts-viewer',
    icon: Repeat2,
    label: 'Reposts Viewer',
    desc: 'Track what content an account is resharing.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'recent-follower',
    icon: UserCheck,
    label: 'Recent Followers',
    desc: 'See the newest accounts following any public handle.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'unfollower',
    icon: UserMinus,
    label: 'Unfollower Tracker',
    desc: 'Find who stopped following you since your last check.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'follower-export',
    icon: Download,
    label: 'Follower Export',
    desc: 'Download your follower list as a CSV for further analysis.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'instagram-comments',
    icon: MessageSquare,
    label: 'Comment Scraper',
    desc: 'Extract all comments from any public post for sentiment analysis.',
    tag: 'Instagram',
    tagColor: 'coral',
  },
  {
    id: 'hashtag-generator',
    icon: Hash,
    label: 'Hashtag Generator',
    desc: 'Generate ranked hashtag sets from a seed keyword or post caption.',
    tag: 'Utility',
    tagColor: 'violet',
  },
  {
    id: 'shadowban-checker',
    icon: ShieldCheck,
    label: 'Shadowban Checker',
    desc: 'Diagnose whether a hashtag or account is suppressed in discovery.',
    tag: 'Utility',
    tagColor: 'violet',
  },
  // ── Other platforms ────────────────────────────────────────────────────
  {
    id: 'tiktok',
    icon: Video,
    label: 'TikTok Scraper',
    desc: 'Pull public TikTok posts, captions and engagement data.',
    tag: 'TikTok',
    tagColor: 'amber',
  },
  {
    id: 'facebook-posts',
    icon: Globe,
    label: 'Facebook Posts',
    desc: 'Extract public Facebook page posts and engagement.',
    tag: 'Facebook',
    tagColor: 'sky',
  },
  {
    id: 'youtube-transcript',
    icon: FileText,
    label: 'YouTube Transcript',
    desc: 'Pull any YouTube video transcript for repurposing or research.',
    tag: 'YouTube',
    tagColor: 'coral',
  },
]

const TAG_COLORS = {
  coral:  { bg: 'oklch(0.96 0.04 25)',  text: 'oklch(0.52 0.18 25)' },
  violet: { bg: 'oklch(0.95 0.04 290)', text: 'oklch(0.42 0.17 290)' },
  amber:  { bg: 'oklch(0.96 0.04 75)',  text: 'oklch(0.52 0.14 75)' },
  sky:    { bg: 'oklch(0.96 0.03 230)', text: 'oklch(0.45 0.13 230)' },
  teal:   { bg: 'var(--brand-soft)',    text: 'var(--brand-ink)' },
}

function ToolCard({ tool }) {
  const { setActiveTab } = useNavigation()
  const { bg, text } = TAG_COLORS[tool.tagColor] || TAG_COLORS.teal
  const Icon = tool.icon

  return (
    <button
      onClick={() => setActiveTab(tool.id)}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', textAlign: 'left',
        background: '#fff',
        border: '1px solid oklch(0.91 0.005 240)',
        borderRadius: 12, padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        boxShadow: 'var(--shadow-pane)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--brand)'
        e.currentTarget.style.boxShadow = 'var(--shadow-glow)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'oklch(0.91 0.005 240)'
        e.currentTarget.style.boxShadow = 'var(--shadow-pane)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Icon tile */}
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: 'var(--brand-soft)',
        display: 'grid', placeItems: 'center',
        marginBottom: 10,
      }}>
        <Icon style={{ width: 16, height: 16, color: 'var(--brand)' }} />
      </div>

      {/* Label */}
      <div style={{
        fontFamily: '"Inter Tight", Inter, sans-serif',
        fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.1px',
        color: 'oklch(0.16 0.01 240)',
        marginBottom: 4,
      }}>{tool.label}</div>

      {/* Description */}
      <div style={{
        fontSize: 12, color: 'oklch(0.5 0.01 240)',
        lineHeight: 1.5, flex: 1, marginBottom: 10,
      }}>{tool.desc}</div>

      {/* Tag */}
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 9.5, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        background: bg, color: text,
        borderRadius: 4, padding: '2px 6px',
      }}>{tool.tag}</div>
    </button>
  )
}

// Group tools by tag
const GROUPS = [
  { label: 'Instagram Tools', filter: (t) => t.tag === 'Instagram' },
  { label: 'Utility Tools',   filter: (t) => t.tag === 'Utility' },
  { label: 'Other Platforms', filter: (t) => !['Instagram','Utility'].includes(t.tag) },
]

export default function ToolsPane() {
  return (
    <div className="animate-entrance">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'oklch(0.5 0.01 240)',
          marginBottom: 6,
        }}>Grow</div>
        <h1 style={{
          fontFamily: '"Inter Tight", Inter, sans-serif',
          fontSize: 26, fontWeight: 800, letterSpacing: '-0.6px',
          color: 'oklch(0.16 0.01 240)',
        }}>Tools</h1>
        <p style={{
          marginTop: 4, fontSize: 13.5, color: 'oklch(0.5 0.01 240)',
          lineHeight: 1.5,
        }}>
          Utility tools for scraping, analysis and research. Click any card to open.
        </p>
      </div>

      {/* Tool groups */}
      {GROUPS.map((group) => {
        const tools = TOOLS.filter(group.filter)
        if (tools.length === 0) return null
        return (
          <div key={group.label} style={{ marginBottom: 32 }}>
            {/* Group label */}
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'oklch(0.5 0.01 240)',
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: '1px solid oklch(0.91 0.005 240)',
            }}>{group.label}</div>

            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}>
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
