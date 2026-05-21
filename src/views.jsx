import React, { useState } from 'react';
import {
  Download,
  Award,
  MonitorPlay,
  Eye,
  Hash,
  AlertCircle,
  UserCheck,
  UserMinus,
  FileUp,
  Search,
  Copy,
  Check,
  ArrowRight,
  TrendingUp,
  ChevronRight,
  Users,
  Star,
  Clock,
  RefreshCw,
  UserPlus,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  fetchFollowersList,
  fetchInstagramStoriesReal,
  fetchInstagramComments,
  fetchFacebookPosts,
  fetchTikTokVideos,
  fetchLinkedInPosts,
  fetchLinkedInProfile,
  fetchYouTubeTranscript,
} from './lib/apify';

/* ─── Blog Page View ─────────────────────────────────────────────────────── */

const BLOG_POSTS = [
  { img: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?q=80&w=600', title: 'Tracking Follower Growth: A Guide to Competitor Analysis', date: 'May 10, 2026', cat: 'Analytics', excerpt: 'Discover how to monitor your competitors\' follower velocity and engagement metrics.' },
  { img: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?q=80&w=600', title: 'The 2026 Guide to Viewing Instagram Stories Anonymously', date: 'Apr 28, 2026', cat: 'Privacy', excerpt: 'Learn the safest methods to view Instagram Stories without leaving a footprint.' },
  { img: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=600', title: 'Decoding AI Sentiment Analysis in Social Media', date: 'Apr 15, 2026', cat: 'AI Insights', excerpt: 'Go beyond simple likes. Learn how AI analyzes the emotional tone of interactions.' },
  { img: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?q=80&w=600', title: 'Spotting Fake Followers: Cleaning Up Influencer Marketing', date: 'Mar 30, 2026', cat: 'Instagram', excerpt: 'How to identify authentic influencers with genuine, highly-engaged audiences.' },
  { img: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?q=80&w=600', title: 'Instagram Algorithm Changes 2026: What You Need to Know', date: 'Mar 15, 2026', cat: 'Instagram', excerpt: 'Breaking down the latest algorithm updates and how they affect your reach and engagement.' },
  { img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600', title: 'Building a Social Listening Strategy with AI', date: 'Feb 28, 2026', cat: 'AI Insights', excerpt: 'How to use AI-powered tools to monitor brand mentions and audience sentiment at scale.' },
  { img: 'https://images.unsplash.com/photo-1553484771-371a605b060b?q=80&w=600', title: 'Complete Guide to Instagram Analytics Tools in 2026', date: 'Feb 14, 2026', cat: 'Tools', excerpt: 'An in-depth comparison of the best Instagram analytics platforms available today.' },
  { img: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600', title: 'GDPR and Social Media Tracking: Staying Compliant', date: 'Jan 30, 2026', cat: 'Privacy', excerpt: 'Understanding privacy regulations and how Activity Mint keeps your tracking 100% legal.' },
];

const BLOG_CATEGORIES = ['All', 'Instagram', 'Analytics', 'AI Insights', 'Privacy', 'Tools'];

export const BlogPageView = ({ setActiveTab }) => {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? BLOG_POSTS
    : BLOG_POSTS.filter(p => p.cat === activeCategory);

  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-teal-700 text-white pt-16 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Activity Mint Blog</h1>
          <p className="text-indigo-100/80 text-lg">Insights, guides and updates from the Activity Mint team</p>
        </div>
      </section>

      {/* Category filters */}
      <section className="bg-white border-b border-slate-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-2">
          {BLOG_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Blog grid */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map((post, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 flex flex-col group cursor-pointer"
              >
                <div className="h-44 overflow-hidden relative">
                  <img
                    src={post.img}
                    alt={post.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 bg-white/90 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-100">
                    {post.cat}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">{post.date}</p>
                  <h3 className="text-sm font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-snug">
                    {post.title}
                  </h3>
                  <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 mt-auto">{post.excerpt}</p>
                  <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold mt-3 group-hover:gap-2 transition-all">
                    Read more <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          <div className="text-center mt-12">
            <button className="px-8 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-full hover:border-emerald-300 hover:text-emerald-600 hover:shadow-md transition-all">
              Load More Articles
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ─── Affiliate View ─────────────────────────────────────────────────────── */

const AFFILIATE_TIERS = [
  { name: 'Starter', range: '0–10 referrals/mo', commission: '15%', payout: '$0 minimum payout', highlight: false },
  { name: 'Growth', range: '11–50 referrals/mo', commission: '20%', payout: '$25 minimum payout', highlight: false },
  { name: 'Pro Partner', range: '50+ referrals/mo', commission: '30%', payout: '$50 minimum payout', highlight: true },
];

const HOW_IT_WORKS_STEPS = [
  { step: '01', title: 'Join', desc: 'Sign up for our affiliate program in minutes. No approval wait time.' },
  { step: '02', title: 'Share', desc: 'Share your unique referral link on your website, social media, or email.' },
  { step: '03', title: 'Convert', desc: 'Earn a commission for every user who subscribes through your link.' },
  { step: '04', title: 'Earn', desc: 'Receive recurring commissions every month your referred users stay subscribed.' },
];

const AFFILIATE_STATS = [
  { value: '$50K+', label: 'Paid Out' },
  { value: '1,200+', label: 'Active Affiliates' },
  { value: '30%', label: 'Max Commission' },
  { value: '90-day', label: 'Cookie Window' },
];

export const AffiliateView = () => {
  const [formData, setFormData] = useState({ name: '', email: '', website: '', promotion: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 text-white pt-20 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
            Affiliate Program
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight leading-tight">
            Earn with <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Activity Mint</span>
          </h1>
          <p className="text-slate-300 text-lg md:text-xl mb-10 leading-relaxed max-w-2xl mx-auto">
            Join our affiliate program and earn up to 30% recurring commission on every referral you send our way.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-full hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all">
              Join Now
            </button>
            <button className="px-8 py-3.5 border border-white/30 text-white font-semibold rounded-full hover:bg-white/10 transition-all">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="bg-white border-b border-slate-100 py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {AFFILIATE_STATS.map((stat, i) => (
              <div key={i}>
                <p className="text-3xl font-extrabold text-emerald-600">{stat.value}</p>
                <p className="text-sm text-slate-500 font-medium mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tier cards */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">Commission Tiers</h2>
            <p className="text-slate-500 mt-3">The more you refer, the more you earn. Tiers upgrade automatically.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AFFILIATE_TIERS.map((tier, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl p-8 flex flex-col text-center transition-all duration-300 ${
                  tier.highlight
                    ? 'border-2 border-emerald-500 shadow-2xl shadow-emerald-500/10 relative'
                    : 'border border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    Best Tier
                  </span>
                )}
                <h3 className="text-xl font-bold text-slate-900 mb-2">{tier.name}</h3>
                <p className="text-sm text-slate-500 mb-6">{tier.range}</p>
                <p className="text-5xl font-extrabold text-emerald-600 mb-2">{tier.commission}</p>
                <p className="text-sm font-semibold text-slate-600 mb-6">Recurring Commission</p>
                <div className="mt-auto pt-6 border-t border-slate-100">
                  <p className="text-sm text-slate-500">{tier.payout}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
            <p className="text-slate-500 mt-3">Four simple steps to start earning recurring commissions.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS_STEPS.map((s, i) => (
              <div key={i} className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:shadow-md transition-all">
                  <span className="text-emerald-700 font-extrabold text-xl">{s.step}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Signup form */}
      <section className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900">Apply to Join</h2>
            <p className="text-slate-500 mt-3">Fill out the form below and our team will review your application.</p>
          </div>
          {submitted ? (
            <div className="bg-white rounded-2xl border border-emerald-200 p-12 text-center shadow-sm">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Application Received!</h3>
              <p className="text-slate-500 text-sm">Thank you for applying. Our team will get back to you within 48 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Jane Smith"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Website / Social Profile</label>
                <input
                  type="text"
                  placeholder="https://yourwebsite.com or @yourhandle"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">How will you promote us?</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your audience, promotion channels, and strategy..."
                  value={formData.promotion}
                  onChange={e => setFormData({ ...formData, promotion: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all"
              >
                Submit Application
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Toolkit Page View ──────────────────────────────────────────────────── */

// Organized by platform
const TOOLKIT_SECTIONS = [
  {
    platform: 'Instagram',
    color: 'from-pink-500 to-purple-600',
    tools: [
      { icon: <MonitorPlay className="w-6 h-6" />, name: 'Story Viewer', desc: 'View Instagram Stories anonymously', tab: 'story-viewer' },
      { icon: <Eye className="w-6 h-6" />, name: 'Post Viewer', desc: 'View public Instagram posts privately', tab: 'post-viewer' },
      { icon: <UserCheck className="w-6 h-6" />, name: 'Recent Follower Tracker', desc: 'Track who recently followed an account', tab: 'recent-follower' },
      { icon: <UserMinus className="w-6 h-6" />, name: 'Unfollower Tracker', desc: 'See who unfollowed you', tab: 'unfollower' },
      { icon: <FileUp className="w-6 h-6" />, name: 'Follower Export', desc: 'Export follower lists to CSV', tab: 'follower-export' },
      { icon: <Hash className="w-6 h-6" />, name: 'Hashtag Generator', desc: 'Generate trending hashtags for your niche', tab: 'hashtag-generator' },
      { icon: <AlertCircle className="w-6 h-6" />, name: 'Shadowban Checker', desc: 'Check if your account is shadowbanned', tab: 'shadowban-checker' },
      { icon: <Award className="w-6 h-6" />, name: 'Celebrity Influencers', desc: 'Browse top Instagram celebrities', tab: 'celebrities' },
      { icon: <Hash className="w-6 h-6" />, name: 'Comment Scraper', desc: 'Extract comments from any Instagram post', tab: 'instagram-comments' },
    ],
  },
  {
    platform: 'TikTok',
    color: 'from-slate-900 to-pink-500',
    tools: [
      { icon: <MonitorPlay className="w-6 h-6" />, name: 'TikTok Scraper', desc: 'Scrape videos from profiles or hashtags', tab: 'tiktok' },
    ],
  },
  {
    platform: 'Facebook',
    color: 'from-blue-600 to-blue-800',
    tools: [
      { icon: <FileUp className="w-6 h-6" />, name: 'Facebook Posts', desc: 'Scrape posts from any Facebook page', tab: 'facebook-posts' },
    ],
  },
  {
    platform: 'LinkedIn',
    color: 'from-blue-700 to-cyan-600',
    tools: [
      { icon: <FileUp className="w-6 h-6" />, name: 'LinkedIn Posts', desc: 'Scrape posts from profiles or company pages', tab: 'linkedin-posts' },
      { icon: <Users className="w-6 h-6" />, name: 'LinkedIn Profile', desc: 'Get detailed profile data (admin only)', tab: 'linkedin-profile' },
    ],
  },
  {
    platform: 'YouTube',
    color: 'from-red-600 to-red-800',
    tools: [
      { icon: <FileUp className="w-6 h-6" />, name: 'Transcript Extractor', desc: 'Extract transcripts from YouTube videos', tab: 'youtube-transcript' },
    ],
  },
  {
    platform: 'Threads',
    color: 'from-slate-800 to-slate-600',
    tools: [
      { icon: <Download className="w-6 h-6" />, name: 'Threads Downloader', desc: 'Download Threads videos and media', tab: 'threads-downloader' },
    ],
  },
];

// Flat list for backward compatibility
const TOOLKIT_TOOLS = TOOLKIT_SECTIONS.flatMap(s => s.tools);

export const ToolkitPageView = ({ setActiveTab }) => (
  <div className="animate-in fade-in duration-500">
    {/* Hero */}
    <section className="bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-800 text-white pt-16 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Free Social Media Tools</h1>
        <p className="text-emerald-100/80 text-lg">
          A complete suite of free tools to analyze, track, and grow your presence across Instagram, TikTok, LinkedIn, and more.
        </p>
      </div>
    </section>

    {/* Platform sections */}
    <section className="py-16 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {TOOLKIT_SECTIONS.map((section) => (
          <div key={section.platform}>
            {/* Platform header */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center text-white font-bold text-sm`}>
                {section.platform[0]}
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{section.platform}</h2>
              <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                {section.tools.length} tool{section.tools.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Tools grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {section.tools.map((tool, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 flex flex-col group"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                    {tool.icon}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1.5">{tool.name}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">{tool.desc}</p>
                  <button
                    onClick={() => setActiveTab(tool.tab)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-full hover:shadow-md hover:shadow-emerald-500/25 hover:-translate-y-0.5 transition-all w-fit"
                  >
                    Try it <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);

/* ─── Shared Tool Hero ───────────────────────────────────────────────────── */

const ToolHero = ({ title, subtitle, gradient = 'from-indigo-600 via-indigo-700 to-teal-700' }) => (
  <section className={`bg-gradient-to-br ${gradient} text-white pt-12 sm:pt-16 pb-14 sm:pb-20`}>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-3 sm:mb-4 tracking-tight">{title}</h1>
      <p className="text-white/75 text-sm sm:text-base md:text-lg">{subtitle}</p>
    </div>
  </section>
);

const ToolSearchBar = ({ value, onChange, placeholder, buttonLabel, onSubmit, onSearch, disabled }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch();
    if (onSubmit) onSubmit(e);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
        <div className="pl-3 flex items-center text-slate-400 shrink-0">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 py-2.5 text-base disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled}
          className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:shadow-md hover:shadow-emerald-500/25 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  );
};

const EmptyStateBox = ({ message }) => (
  <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 border-dashed p-8 sm:p-16 text-center mt-8 shadow-sm">
    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <Search className="w-7 h-7 text-slate-400" />
    </div>
    <p className="text-slate-500 font-medium">{message}</p>
  </div>
);

/* ─── Threads Downloader View ────────────────────────────────────────────── */

export const ThreadsDownloaderView = ({ searchQuery, setSearchQuery }) => {
  const [url, setUrl] = useState('');

  const HOW_STEPS = [
    { num: '1', title: 'Copy URL', desc: 'Open the Threads app and copy the link to the post you want to download.' },
    { num: '2', title: 'Paste Here', desc: 'Paste the Threads URL into the input field above and click Download.' },
    { num: '3', title: 'Download', desc: 'Your file will be prepared instantly. Save it directly to your device.' },
  ];

  const FEATURES = [
    { icon: <Check className="w-5 h-5 text-emerald-600" />, title: 'Completely Free', desc: 'No cost, no hidden fees ever.' },
    { icon: <UserMinus className="w-5 h-5 text-emerald-600" />, title: 'No Account Needed', desc: 'Works without signing in to Threads.' },
    { icon: <TrendingUp className="w-5 h-5 text-emerald-600" />, title: 'HD Quality', desc: 'Download in the highest available resolution.' },
    { icon: <Download className="w-5 h-5 text-emerald-600" />, title: 'Fast Download', desc: 'Processed and ready in seconds.' },
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Threads Video Downloader"
        subtitle="Download videos, images, and media from any public Threads post — free and instant."
        gradient="from-slate-900 via-slate-800 to-teal-900"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ToolSearchBar
            value={url}
            onChange={setUrl}
            placeholder="Paste a Threads post URL..."
            buttonLabel="Download"
          />
          {!url ? (
            <EmptyStateBox message="Paste a link above to get started" />
          ) : (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-emerald-200 p-8 text-center mt-8 shadow-sm">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-slate-700 font-semibold mb-2">Ready to process!</p>
              <p className="text-slate-500 text-sm mb-6">Sign up to download Threads content directly to your device.</p>
              <button className="px-7 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-full hover:shadow-md transition-all">
                Sign Up to Download
              </button>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_STEPS.map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-500/20">
                  <span className="text-white font-extrabold">{s.num}</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-16 bg-slate-50 border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Why Use Our Downloader?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center hover:border-emerald-100 hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  {f.icon}
                </div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

/* ─── Celebrities View ───────────────────────────────────────────────────── */

const CELEBRITIES = [
  { seed: 'cristiano', name: 'Cristiano Ronaldo', cat: 'Sports', followers: '635M', engagement: '3.2%' },
  { seed: 'arianagrande', name: 'Ariana Grande', cat: 'Music', followers: '380M', engagement: '4.1%' },
  { seed: 'kyliejenner', name: 'Kylie Jenner', cat: 'Fashion', followers: '399M', engagement: '2.8%' },
  { seed: 'therock', name: 'Dwayne Johnson', cat: 'Sports', followers: '395M', engagement: '3.7%' },
  { seed: 'selenagomez', name: 'Selena Gomez', cat: 'Music', followers: '427M', engagement: '4.5%' },
  { seed: 'kimkardashian', name: 'Kim Kardashian', cat: 'Fashion', followers: '364M', engagement: '2.5%' },
  { seed: 'leomessi', name: 'Lionel Messi', cat: 'Sports', followers: '502M', engagement: '5.1%' },
  { seed: 'beyonce', name: 'Beyoncé', cat: 'Music', followers: '318M', engagement: '4.8%' },
  { seed: 'justinbieber', name: 'Justin Bieber', cat: 'Music', followers: '292M', engagement: '3.3%' },
  { seed: 'rihanna', name: 'Rihanna', cat: 'Music', followers: '150M', engagement: '6.2%' },
  { seed: 'taylorswift', name: 'Taylor Swift', cat: 'Music', followers: '284M', engagement: '5.9%' },
  { seed: 'nickiminaj', name: 'Nicki Minaj', cat: 'Music', followers: '228M', engagement: '4.4%' },
];

const CELEB_CATEGORIES = ['All', 'Music', 'Sports', 'Fashion', 'Tech', 'Food', 'Travel'];

export const CelebritiesView = ({ searchQuery, setSearchQuery }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');

  const filtered = CELEBRITIES.filter(c => {
    const matchesCat = activeCategory === 'All' || c.cat === activeCategory;
    const matchesQuery = !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.cat.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Top Instagram Celebrities & Influencers"
        subtitle="Explore and track the most followed accounts on Instagram across every niche."
        gradient="from-indigo-600 via-purple-700 to-teal-700"
      />

      <section className="py-10 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search */}
          <div className="max-w-xl mx-auto mb-8">
            <ToolSearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search by name, category or niche..."
              buttonLabel="Search"
            />
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {CELEB_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filtered.map((celeb, i) => (
              <div
                key={celeb.seed}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 flex flex-col items-center text-center group relative"
              >
                {i < 3 && (
                  <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5" /> Top
                  </span>
                )}
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-100 group-hover:border-indigo-200 transition-all mb-3 shrink-0">
                  <img
                    src={`https://api.dicebear.com/7.x/notionists/svg?seed=${celeb.seed}&backgroundColor=e2e8f0`}
                    alt={celeb.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="font-bold text-slate-900 text-xs leading-tight mb-0.5">{celeb.name}</p>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full mb-2">{celeb.cat}</span>
                <p className="text-sm font-extrabold text-slate-800">{celeb.followers}</p>
                <p className="text-[10px] text-slate-400 mb-3">{celeb.engagement} eng.</p>
                <button className="w-full py-1.5 text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:shadow-sm transition-all">
                  Track
                </button>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <EmptyStateBox message="No celebrities found matching your search." />
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Hashtag Generator View ─────────────────────────────────────────────── */

const TRENDING_TOPICS = ['Photography', 'Travel', 'Food', 'Fitness', 'Fashion', 'Technology', 'Beauty', 'Business'];

const HASHTAG_DATA = {
  Photography: {
    high: ['#photography', '#photo', '#photographer', '#photooftheday', '#photos', '#photographylovers'],
    medium: ['#photographylife', '#mobilephotography', '#portraitphotography', '#landscapephotography', '#streetphotography'],
    niche: ['#photographysouls', '#photographyislife', '#goldenhourphotography', '#documentaryphotography'],
  },
  Travel: {
    high: ['#travel', '#travelgram', '#travelphotography', '#instatravel', '#traveling', '#wanderlust'],
    medium: ['#travelblogger', '#traveltheworld', '#travellife', '#travelblog', '#traveladdict'],
    niche: ['#slowtravel', '#solotravel', '#budgettravel', '#offthebeatenpath', '#digitalnomadlife'],
  },
  Food: {
    high: ['#food', '#foodie', '#foodporn', '#instafood', '#foodphotography', '#yummy'],
    medium: ['#foodblogger', '#homecooking', '#healthyfood', '#foodlover', '#delicious'],
    niche: ['#mealprep', '#plantbased', '#foodstyling', '#veganfoodshare', '#eatlocal'],
  },
  Fitness: {
    high: ['#fitness', '#gym', '#workout', '#fitnessmotivation', '#fit', '#health'],
    medium: ['#fitfam', '#fitnessjourney', '#bodybuilding', '#gymlife', '#personaltrainer'],
    niche: ['#strengthtraining', '#homeworkout', '#calisthenics', '#functionaltraining', '#yogaeveryday'],
  },
  Fashion: {
    high: ['#fashion', '#style', '#ootd', '#fashionista', '#outfitoftheday', '#clothing'],
    medium: ['#fashionblogger', '#streetstyle', '#styleinspo', '#fashionweek', '#lookbook'],
    niche: ['#sustainablefashion', '#slowfashion', '#vintagestyle', '#capsulewardrobe', '#ethicalfashion'],
  },
  Technology: {
    high: ['#technology', '#tech', '#innovation', '#startup', '#ai', '#digital'],
    medium: ['#techstartup', '#coding', '#software', '#developer', '#artificialintelligence'],
    niche: ['#machinelearning', '#devlife', '#buildinpublic', '#techfounder', '#saas'],
  },
  Beauty: {
    high: ['#beauty', '#makeup', '#skincare', '#beautiful', '#glam', '#makeupartist'],
    medium: ['#beautyblogger', '#skincareroutine', '#makeuptutorial', '#glowup', '#beautyproducts'],
    niche: ['#cleanbeauty', '#naturalskincare', '#k-beauty', '#skincareobsessed', '#slugging'],
  },
  Business: {
    high: ['#business', '#entrepreneur', '#marketing', '#success', '#businessowner', '#motivation'],
    medium: ['#entrepreneurship', '#smallbusiness', '#businesstips', '#growthhacking', '#contentmarketing'],
    niche: ['#solopreneur', '#bootstrapped', '#b2bmarketing', '#founderstory', '#sidehustle'],
  },
};

const CopyableTag = ({ tag }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(tag).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-all group"
    >
      {tag}
      {copied
        ? <Check className="w-3 h-3 text-emerald-500" />
        : <Copy className="w-3 h-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
      }
    </button>
  );
};

export const HashtagGeneratorView = ({ searchQuery, setSearchQuery }) => {
  const [topic, setTopic] = useState('');
  const [results, setResults] = useState(null);
  const [activeChip, setActiveChip] = useState(null);

  const handleChipClick = (chip) => {
    setTopic(chip);
    setActiveChip(chip);
    setResults(HASHTAG_DATA[chip] || null);
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    const key = Object.keys(HASHTAG_DATA).find(k => k.toLowerCase() === topic.toLowerCase());
    if (key) {
      setResults(HASHTAG_DATA[key]);
      setActiveChip(key);
    } else {
      setResults(HASHTAG_DATA['Photography']); // fallback mock
      setActiveChip(null);
    }
  };

  const allTags = results ? [...results.high, ...results.medium, ...results.niche] : [];

  const handleCopyAll = () => {
    navigator.clipboard.writeText(allTags.join(' ')).catch(() => {});
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Instagram Hashtag Generator"
        subtitle="Generate trending, high-performing hashtags for any niche or topic instantly."
        gradient="from-emerald-600 via-teal-600 to-indigo-700"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ToolSearchBar
            value={topic}
            onChange={setTopic}
            placeholder="Enter your niche or topic..."
            buttonLabel="Generate"
            onSubmit={handleGenerate}
          />

          {/* Trending chips */}
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {TRENDING_TOPICS.map(chip => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  activeChip === chip
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Results */}
          {!results ? (
            <EmptyStateBox message="Enter a topic above to generate relevant hashtags" />
          ) : (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">
                  Generated Hashtags {activeChip && <span className="text-emerald-600">for #{activeChip}</span>}
                </h3>
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 text-sm text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                >
                  <Copy className="w-4 h-4" /> Copy All
                </button>
              </div>

              <div className="p-6 space-y-6">
                {[
                  { label: 'High Volume', sublabel: '>1M posts', tags: results.high, color: 'text-rose-600 bg-rose-50 border-rose-200' },
                  { label: 'Medium Volume', sublabel: '100K–1M posts', tags: results.medium, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                  { label: 'Niche', sublabel: '<100K posts', tags: results.niche, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                ].map(group => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${group.color}`}>{group.label}</span>
                      <span className="text-xs text-slate-400">{group.sublabel}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map(tag => <CopyableTag key={tag} tag={tag} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Shadowban Checker View ─────────────────────────────────────────────── */

const SHADOWBAN_TYPES = [
  {
    icon: <Hash className="w-6 h-6 text-rose-600" />,
    bg: 'bg-rose-50 border-rose-100',
    iconBg: 'bg-rose-100',
    title: 'Hashtag Ban',
    desc: 'Your posts stop appearing in hashtag search results. Users browsing those hashtags will not see your content even if you use them regularly.',
  },
  {
    icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
    bg: 'bg-amber-50 border-amber-100',
    iconBg: 'bg-amber-100',
    title: 'Account Ban',
    desc: 'Your profile may be hidden from Explore and suggested accounts. New users cannot find you unless they search your exact username.',
  },
  {
    icon: <Eye className="w-6 h-6 text-indigo-600" />,
    bg: 'bg-indigo-50 border-indigo-100',
    iconBg: 'bg-indigo-100',
    title: 'Explore Ban',
    desc: 'Your content is suppressed on the Explore page, drastically reducing organic reach and discovery to new audiences.',
  },
];

export const ShadowbanCheckerView = ({ searchQuery, setSearchQuery }) => {
  const [input, setInput] = useState('');

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Instagram Shadowban Checker"
        subtitle="Find out if your account or hashtags are shadowbanned by Instagram's algorithm."
        gradient="from-rose-600 via-rose-700 to-indigo-800"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Enter Instagram username or hashtag..."
            buttonLabel="Check Now"
          />

          {/* What is a shadowban */}
          <div className="mt-10 bg-white rounded-2xl border border-slate-200 p-7 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" /> What is a Shadowban?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              A <strong>shadowban</strong> is when Instagram silently restricts your account visibility without notifying you. Your posts, stories, or hashtags become hidden or suppressed for users who don't follow you — making it appear as though your content simply isn't getting traction. Shadowbans can be triggered by violating community guidelines, using banned hashtags, posting too frequently, or exhibiting bot-like behavior.
            </p>
          </div>

          {/* Three types */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {SHADOWBAN_TYPES.map((type, i) => (
              <div key={i} className={`rounded-2xl border p-5 ${type.bg}`}>
                <div className={`w-10 h-10 ${type.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                  {type.icon}
                </div>
                <h4 className="font-bold text-slate-900 mb-2">{type.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{type.desc}</p>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {!input && (
            <EmptyStateBox message="Enter a username or hashtag above to check" />
          )}

          {input && (
            <div className="mt-8 bg-white rounded-2xl border border-indigo-200 p-8 text-center shadow-sm">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-indigo-600" />
              </div>
              <p className="text-slate-700 font-semibold mb-2">Ready to check <span className="text-indigo-600">{input.startsWith('#') ? input : `@${input}`}</span></p>
              <p className="text-slate-500 text-sm mb-6">Sign up to run a full shadowban analysis on this account or hashtag.</p>
              <button className="px-7 py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 text-white font-semibold rounded-full hover:shadow-md transition-all">
                Sign Up to Check
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Shared Tool Page Shell ─────────────────────────────────────────────── */

const SimpleToolPage = ({ title, subtitle, placeholder, gradient, children }) => {
  const [input, setInput] = useState('');

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero title={title} subtitle={subtitle} gradient={gradient} />
      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder={placeholder}
            buttonLabel="Search Now"
          />
          {children ? children(input) : (
            !input && <EmptyStateBox message="Enter a username above to get started" />
          )}
          {!children && input && (
            <div className="mt-8 bg-white rounded-2xl border border-emerald-200 p-8 text-center shadow-sm">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-slate-700 font-semibold mb-2">Searching for <span className="text-emerald-600">@{input}</span></p>
              <p className="text-slate-500 text-sm mb-6">Sign up to view full results for this account.</p>
              <button className="px-7 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-full hover:shadow-md transition-all">
                Sign Up to View Results
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Recent Follower View ───────────────────────────────────────────────── */

const STORAGE_KEY_PREFIX = 'activitymint_followers_';
const MAX_SNAPSHOTS = 5; // Keep last 5 snapshots for history

const getStoredSnapshots = (username) => {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${username.toLowerCase()}`);
    if (!data) return [];
    const parsed = JSON.parse(data);
    // Migrate old single-snapshot format to array
    if (parsed && parsed.timestamp && parsed.followers) return [parsed];
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
};

// Backward compat — returns most recent snapshot
const getStoredSnapshot = (username) => {
  const snaps = getStoredSnapshots(username);
  return snaps.length > 0 ? snaps[snaps.length - 1] : null;
};

const normalizeFollower = (f) => ({
  username: f.username || f.handle || f.login || f.user_name || f.userName || '',
  fullName: f.full_name || f.fullName || f.name || f.displayName || '',
  profilePicUrl: f.profile_pic_url || f.profilePicUrl || f.profilePicture || f.avatar || '',
  isVerified: f.is_verified || f.isVerified || false,
  isPrivate: f.is_private || f.isPrivate || false,
});

const storeSnapshot = (username, followers) => {
  const snapshot = {
    timestamp: new Date().toISOString(),
    followers: followers.map(normalizeFollower),
    count: followers.length,
  };
  // Append to history, keep last N
  const history = getStoredSnapshots(username);
  history.push(snapshot);
  const trimmed = history.slice(-MAX_SNAPSHOTS);
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${username.toLowerCase()}`, JSON.stringify(trimmed));
  return snapshot;
};

const proxyImageUrl = (url) => {
  if (!url) return null;
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('scontent')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const FollowerCard = ({ user, badge, badgeColor }) => (
  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-emerald-200 transition-all">
    <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
      {user.profilePicUrl ? (
        <img
          src={proxyImageUrl(user.profilePicUrl)}
          alt={user.username}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400">
          <Users className="w-5 h-5" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-800 text-sm truncate">@{user.username}</span>
        {user.isVerified && (
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        )}
      </div>
      {user.fullName && (
        <p className="text-xs text-slate-500 truncate">{user.fullName}</p>
      )}
    </div>
    {badge && (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badgeColor}`}>
        {badge}
      </span>
    )}
    <a
      href={`https://instagram.com/${user.username}`}
      target="_blank"
      rel="noopener noreferrer"
      className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
    >
      <ExternalLink className="w-4 h-4" />
    </a>
  </div>
);

export const RecentFollowerView = ({ searchQuery, setSearchQuery, setActiveTab, user, setAuthOpen }) => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState(null);
  const [currentFollowers, setCurrentFollowers] = useState([]);
  const [newFollowers, setNewFollowers] = useState([]);
  const [previousSnapshot, setPreviousSnapshot] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);

  // Gate: show only first 5 for guests, full list for signed-in users
  const FREE_PREVIEW_LIMIT = 5;
  const isSignedIn = !!user;

  const handleSearch = async () => {
    if (!input.trim()) return;
    const username = input.trim().replace('@', '');

    setStatus('loading');
    setError(null);
    setNewFollowers([]);

    try {
      // Get previous snapshot for comparison
      const prev = getStoredSnapshot(username);
      setPreviousSnapshot(prev);

      // Fetch current followers — higher limit, Instagram API returns most-recent first
      const items = await fetchFollowersList(username, 'followers', 1000);

      if (!items || items.length === 0) {
        throw new Error('No followers found or account is private.');
      }

      // Normalize — PRESERVE ORIGINAL ORDER (most recent followers first from Instagram)
      const followers = items.map(normalizeFollower).filter(f => f.username);

      // Deduplicate while preserving order
      const seen = new Set();
      const uniqueFollowers = followers.filter(f => {
        const key = f.username.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setCurrentFollowers(uniqueFollowers);
      setFetchTime(new Date().toISOString());

      // Compare with previous snapshot to find new followers
      if (prev && prev.followers) {
        const prevUsernames = new Set(prev.followers.map(f => f.username.toLowerCase()));
        const newOnes = uniqueFollowers.filter(f => !prevUsernames.has(f.username.toLowerCase()));
        setNewFollowers(newOnes);
      }

      // Store snapshot
      storeSnapshot(username, uniqueFollowers);
      setStatus('success');

    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to fetch followers. The account may be private.');
      setStatus('error');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Instagram Recent Follower Tracker"
        subtitle="Discover who recently started following any public Instagram account. Compare snapshots to detect new followers."
        gradient="from-teal-600 via-emerald-600 to-indigo-700"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Info Banner */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-teal-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              How It Works
            </h4>
            <p className="text-teal-700 text-xs mt-1">
              First search captures a snapshot. Search again later to compare and see new followers.
              Snapshots are stored locally in your browser.
            </p>
          </div>

          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Enter an Instagram username..."
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Check Followers'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {/* Loading State */}
          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-teal-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Fetching followers for @{input.trim()}</p>
              <p className="text-slate-500 text-sm">This may take 30-60 seconds for large accounts...</p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-rose-600" />
              </div>
              <p className="text-slate-700 font-semibold mb-2">Failed to fetch followers</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="mt-8 space-y-6">
              {/* Summary Card */}
              <div className="bg-white rounded-2xl border border-teal-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800">
                    @{input.trim()} Followers
                  </h3>
                  <span className="text-xs text-slate-500">
                    {new Date(fetchTime).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-teal-50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-xl sm:text-2xl font-bold text-teal-700">{currentFollowers.length}</p>
                    <p className="text-xs text-teal-600 font-medium">Total Fetched</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-xl sm:text-2xl font-bold text-emerald-700">{newFollowers.length}</p>
                    <p className="text-xs text-emerald-600 font-medium">New Followers</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-base sm:text-2xl font-bold text-slate-700">
                      {previousSnapshot ? new Date(previousSnapshot.timestamp).toLocaleDateString() : '—'}
                    </p>
                    <p className="text-xs text-slate-600 font-medium">Last Check</p>
                  </div>
                </div>
              </div>

              {/* New Followers Section */}
              {newFollowers.length > 0 && (
                <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                    New Followers ({newFollowers.length})
                  </h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {newFollowers.map((user, i) => (
                      <FollowerCard key={i} user={user} badge="NEW" badgeColor="bg-emerald-100 text-emerald-700" />
                    ))}
                  </div>
                </div>
              )}

              {/* No new followers message */}
              {previousSnapshot && newFollowers.length === 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center">
                  <p className="text-slate-600 text-sm">
                    No new followers since your last check on {new Date(previousSnapshot.timestamp).toLocaleString()}.
                  </p>
                </div>
              )}

              {/* First check message */}
              {!previousSnapshot && (
                <div className="bg-teal-50 rounded-2xl border border-teal-200 p-6 text-center">
                  <p className="text-teal-700 text-sm">
                    <strong>First snapshot captured!</strong> Check again later to see new followers.
                  </p>
                </div>
              )}

              {/* All Followers — Ordered Most Recent First */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-600" />
                  Followers — Most Recent First
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Instagram returns followers in order of when they followed. Position #1 = most recent.
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {currentFollowers.slice(0, isSignedIn ? 50 : FREE_PREVIEW_LIMIT).map((u, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-6 text-right shrink-0">#{i + 1}</span>
                      <div className="flex-1"><FollowerCard user={u} badge={i < 3 ? 'RECENT' : undefined} badgeColor="bg-teal-100 text-teal-700" /></div>
                    </div>
                  ))}
                </div>

                {/* Auth gate for full list */}
                {!isSignedIn && currentFollowers.length > FREE_PREVIEW_LIMIT && (
                  <div className="mt-4 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-transparent z-10 flex flex-col items-center justify-end pb-4">
                      <p className="text-slate-600 text-sm font-semibold mb-2">
                        Sign up free to see all {currentFollowers.length} followers
                      </p>
                      <button
                        onClick={() => setAuthOpen?.(true)}
                        className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-full hover:bg-emerald-700 transition-colors text-sm"
                      >
                        Sign Up Free
                      </button>
                    </div>
                    <div className="opacity-20 pointer-events-none space-y-2">
                      {currentFollowers.slice(FREE_PREVIEW_LIMIT, FREE_PREVIEW_LIMIT + 3).map((u, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 w-6 text-right shrink-0">#{i + FREE_PREVIEW_LIMIT + 1}</span>
                          <div className="flex-1"><FollowerCard user={u} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isSignedIn && currentFollowers.length > 50 && (
                  <p className="text-center text-slate-500 text-sm mt-4">
                    Showing top 50 of {currentFollowers.length} followers. Upgrade to Premium for full list.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Idle state */}
          {status === 'idle' && (
            <EmptyStateBox message="Enter a username above to check their followers" />
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Unfollower View ────────────────────────────────────────────────────── */

export const UnfollowerView = ({ searchQuery, setSearchQuery, setActiveTab }) => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState(null);
  const [currentFollowers, setCurrentFollowers] = useState([]);
  const [unfollowers, setUnfollowers] = useState([]);
  const [previousSnapshot, setPreviousSnapshot] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);
  const [snapshotHistory, setSnapshotHistory] = useState([]);
  const [fetchProgress, setFetchProgress] = useState('');

  const handleSearch = async () => {
    if (!input.trim()) return;
    const username = input.trim().replace('@', '');

    setStatus('loading');
    setError(null);
    setUnfollowers([]);
    setFetchProgress('Loading previous snapshots...');

    try {
      // Get ALL previous snapshots for history + most recent for comparison
      const allSnaps = getStoredSnapshots(username);
      setSnapshotHistory(allSnaps);
      const prev = allSnaps.length > 0 ? allSnaps[allSnaps.length - 1] : null;
      setPreviousSnapshot(prev);

      // Fetch current followers — use higher limit for accuracy
      setFetchProgress('Fetching followers (this may take 30-90 seconds)...');
      const items = await fetchFollowersList(username, 'followers', 1000);

      if (!items || items.length === 0) {
        throw new Error('No followers found or account is private.');
      }

      // Normalize — preserve original order from Instagram API (most recent first)
      const followers = items.map(normalizeFollower).filter(f => f.username);

      // Deduplicate by username (scraper can return dupes across pages)
      const seen = new Set();
      const uniqueFollowers = followers.filter(f => {
        const key = f.username.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setCurrentFollowers(uniqueFollowers);
      setFetchTime(new Date().toISOString());

      // Compare with previous snapshot to find unfollowers
      if (prev && prev.followers) {
        const currentUsernames = new Set(uniqueFollowers.map(f => f.username.toLowerCase()));
        const lostOnes = prev.followers.filter(f => !currentUsernames.has(f.username.toLowerCase()));
        // Also check: if previous snapshot had fewer followers than we fetched now,
        // some "unfollowers" might just be from pagination limits — flag uncertainty
        setUnfollowers(lostOnes);
      }

      // Store snapshot with deduped list
      storeSnapshot(username, uniqueFollowers);
      setStatus('success');
      setFetchProgress('');

    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to fetch followers. The account may be private.');
      setStatus('error');
      setFetchProgress('');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Instagram Unfollower Tracker"
        subtitle="Find out who stopped following an account. Compare snapshots to detect unfollowers."
        gradient="from-rose-600 via-rose-700 to-slate-800"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Info Banner */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-rose-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              How It Works
            </h4>
            <p className="text-rose-700 text-xs mt-1">
              First search captures a snapshot. Search again later to compare and see who unfollowed.
              Snapshots are stored locally in your browser.
            </p>
          </div>

          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Enter an Instagram username..."
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Check Unfollowers'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {/* Loading State */}
          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-rose-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Fetching followers for @{input.trim()}</p>
              <p className="text-slate-500 text-sm">{fetchProgress || 'This may take 30-90 seconds for large accounts...'}</p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-rose-600" />
              </div>
              <p className="text-slate-700 font-semibold mb-2">Failed to fetch followers</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="mt-8 space-y-6">
              {/* Summary Card */}
              <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800">
                    @{input.trim()} Unfollower Check
                  </h3>
                  <span className="text-xs text-slate-500">
                    {new Date(fetchTime).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-slate-50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-xl sm:text-2xl font-bold text-slate-700">{currentFollowers.length}</p>
                    <p className="text-xs text-slate-600 font-medium">Current Followers</p>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-xl sm:text-2xl font-bold text-rose-700">{unfollowers.length}</p>
                    <p className="text-xs text-rose-600 font-medium">Unfollowers</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-xl sm:text-2xl font-bold text-slate-700">
                      {previousSnapshot ? (currentFollowers.length - (previousSnapshot.count || previousSnapshot.followers.length)) : '—'}
                    </p>
                    <p className="text-xs text-emerald-600 font-medium">Net Change</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 sm:p-4 text-center">
                    <p className="text-base sm:text-lg font-bold text-slate-700">
                      {previousSnapshot ? new Date(previousSnapshot.timestamp).toLocaleDateString() : '—'}
                    </p>
                    <p className="text-xs text-slate-600 font-medium">Last Check</p>
                  </div>
                </div>

                {/* Accuracy notice */}
                {previousSnapshot && previousSnapshot.followers && previousSnapshot.followers.length >= 195 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <p className="text-amber-700 text-[11px]">
                      <strong>Note:</strong> Previous snapshot had {previousSnapshot.followers.length} followers (near limit). Some unfollowers may be missed due to pagination. Accuracy improves with repeated checks.
                    </p>
                  </div>
                )}
              </div>

              {/* Unfollowers Section */}
              {unfollowers.length > 0 && (
                <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <UserMinus className="w-5 h-5 text-rose-600" />
                    Unfollowers ({unfollowers.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {unfollowers.map((user, i) => (
                      <FollowerCard key={i} user={user} badge="LEFT" badgeColor="bg-rose-100 text-rose-700" />
                    ))}
                  </div>
                </div>
              )}

              {/* No unfollowers message */}
              {previousSnapshot && unfollowers.length === 0 && (
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-center">
                  <p className="text-emerald-700 text-sm">
                    <strong>Good news!</strong> No one unfollowed since your last check on {new Date(previousSnapshot.timestamp).toLocaleString()}.
                  </p>
                </div>
              )}

              {/* First check message */}
              {!previousSnapshot && (
                <div className="bg-rose-50 rounded-2xl border border-rose-200 p-6 text-center">
                  <p className="text-rose-700 text-sm">
                    <strong>First snapshot captured ({currentFollowers.length} followers).</strong> Check again later to detect unfollowers.
                  </p>
                </div>
              )}

              {/* Snapshot History */}
              {snapshotHistory.length > 1 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-500" />
                    Snapshot History ({snapshotHistory.length} checks)
                  </h3>
                  <div className="space-y-2">
                    {[...snapshotHistory].reverse().map((snap, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-700">{new Date(snap.timestamp).toLocaleString()}</span>
                        <span className="text-sm font-semibold text-slate-600">{snap.count || snap.followers.length} followers</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Idle state */}
          {status === 'idle' && (
            <EmptyStateBox message="Enter a username above to track unfollowers" />
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Follower Export View ───────────────────────────────────────────────── */

export const FollowerExportView = ({ searchQuery, setSearchQuery, setActiveTab }) => {
  const [listType, setListType] = useState('followers');
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  const TABLE_COLUMNS = ['Username', 'Full Name', 'Verified', 'Private'];

  const handleSearch = async () => {
    if (!input.trim()) return;
    const username = input.trim().replace('@', '');
    setStatus('loading');
    setError(null);
    setItems([]);
    try {
      const raw = await fetchFollowersList(username, listType, 200);
      if (!raw || raw.length === 0) {
        throw new Error('No results found. The account may be private or have no ' + listType + '.');
      }
      const normalized = raw.map(normalizeFollower).filter(f => f.username);
      setItems(normalized);
      setStatus('success');
    } catch (err) {
      console.error('Export fetch error:', err);
      setError(err.message || 'Failed to fetch. The account may be private.');
      setStatus('error');
    }
  };

  const handleExportCsv = () => {
    const headers = ['Username', 'Full Name', 'Verified', 'Private', 'Profile URL'];
    const rows = items.map(u => [
      u.username,
      u.fullName,
      u.isVerified ? 'Yes' : 'No',
      u.isPrivate ? 'Yes' : 'No',
      `https://instagram.com/${u.username}`,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${input.trim()}_${listType}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Instagram Follower Export Tool"
        subtitle="Export follower or following lists from any public Instagram account to CSV."
        gradient="from-indigo-600 via-indigo-700 to-teal-700"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* List type toggle */}
          <div className="flex gap-4 justify-center mb-6">
            {['followers', 'following'].map(type => (
              <button
                key={type}
                onClick={() => { setListType(type); setStatus('idle'); setItems([]); }}
                disabled={status === 'loading'}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  listType === type
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${listType === type ? 'border-white' : 'border-slate-400'}`}>
                  {listType === type && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Enter an Instagram username..."
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Search Now'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {/* Loading State */}
          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Fetching {listType} for @{input.trim()}</p>
              <p className="text-slate-500 text-sm">This may take 30–90 seconds for large accounts…</p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-rose-600" />
              </div>
              <p className="text-slate-700 font-semibold mb-2">Failed to fetch {listType}</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {/* Success — Results Table */}
          {status === 'success' && (
            <div className="mt-8 bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    @{input.trim()} — {listType}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{items.length} results</p>
                </div>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-teal-600 px-4 py-2 rounded-lg hover:shadow-md transition-all"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                      {TABLE_COLUMNS.map(col => (
                        <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                      ))}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((user, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                              {user.profilePicUrl ? (
                                <img
                                  src={proxyImageUrl(user.profilePicUrl)}
                                  alt={user.username}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-slate-800 text-xs">@{user.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[140px] truncate">{user.fullName || '—'}</td>
                        <td className="px-4 py-3">
                          {user.isVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">✓ Yes</span>
                          ) : (
                            <span className="text-xs text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {user.isPrivate ? (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Private</span>
                          ) : (
                            <span className="text-xs text-slate-400">Public</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={`https://instagram.com/${user.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors inline-flex"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Idle state — empty table preview */}
          {status === 'idle' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 text-sm">Results will appear here</h3>
                <button className="flex items-center gap-1.5 text-xs text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg cursor-not-allowed" disabled>
                  <FileUp className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                      {TABLE_COLUMNS.map(col => (
                        <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map(r => (
                      <tr key={r} className="border-b border-slate-50">
                        <td className="px-4 py-4"><div className="h-3 bg-slate-100 rounded w-4 animate-pulse" /></td>
                        {TABLE_COLUMNS.map(col => (
                          <td key={col} className="px-4 py-4">
                            <div className="h-3 bg-slate-100 rounded w-24 animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-8 text-center text-sm text-slate-400">
                Enter an Instagram username above to export their {listType} list.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Instagram Comments View ────────────────────────────────────────────── */

export const InstagramCommentsView = () => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);

  const handleSearch = async () => {
    if (!input.trim()) return;
    setStatus('loading');
    setError(null);
    setComments([]);

    try {
      const items = await fetchInstagramComments(input.trim(), 50);
      if (!items || items.length === 0) {
        throw new Error('No comments found or post is private.');
      }
      setComments(items);
      setStatus('success');
    } catch (err) {
      console.error('Comments fetch error:', err);
      setError(err.message || 'Failed to fetch comments.');
      setStatus('error');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Instagram Comment Scraper"
        subtitle="Extract all comments from any public Instagram post URL."
        gradient="from-pink-500 via-purple-600 to-indigo-700"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Paste an Instagram post URL (e.g. https://instagram.com/p/xyz)"
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Get Comments'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-pink-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Fetching comments...</p>
              <p className="text-slate-500 text-sm">This may take 30-60 seconds...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Failed to fetch comments</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mt-8 bg-white rounded-2xl border border-pink-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">{comments.length} Comments Found</h3>
              </div>
              <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {comments.map((c, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-slate-800 text-sm">@{c.ownerUsername || c.username || 'unknown'}</span>
                      <span className="text-xs text-slate-400">{c.timestamp ? new Date(c.timestamp).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="text-sm text-slate-600">{c.text || c.comment || ''}</p>
                    {c.likesCount > 0 && (
                      <p className="text-xs text-slate-400 mt-2">❤️ {c.likesCount} likes</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === 'idle' && (
            <EmptyStateBox message="Paste an Instagram post URL above to extract comments" />
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Facebook Posts View ────────────────────────────────────────────────── */

export const FacebookPostsView = () => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);

  const handleSearch = async () => {
    if (!input.trim()) return;
    setStatus('loading');
    setError(null);
    setPosts([]);

    try {
      const items = await fetchFacebookPosts(input.trim(), 50);
      if (!items || items.length === 0) {
        throw new Error('No posts found or page is private.');
      }
      setPosts(items);
      setStatus('success');
    } catch (err) {
      console.error('Facebook fetch error:', err);
      setError(err.message || 'Failed to fetch posts.');
      setStatus('error');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Facebook Posts Scraper"
        subtitle="Extract posts from any public Facebook page."
        gradient="from-blue-600 via-blue-700 to-blue-900"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Paste a Facebook page URL..."
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Get Posts'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Fetching Facebook posts...</p>
              <p className="text-slate-500 text-sm">This may take 30-90 seconds...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Failed to fetch posts</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mt-8 bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">{posts.length} Posts Found</h3>
              </div>
              <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                {posts.map((p, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-600 line-clamp-4">{p.text || p.message || p.postText || 'No text'}</p>
                    <div className="flex gap-4 mt-3 text-xs text-slate-400">
                      {p.likesCount !== undefined && <span>👍 {p.likesCount}</span>}
                      {p.commentsCount !== undefined && <span>💬 {p.commentsCount}</span>}
                      {p.sharesCount !== undefined && <span>↗️ {p.sharesCount}</span>}
                      {p.time && <span>{new Date(p.time).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === 'idle' && (
            <EmptyStateBox message="Paste a Facebook page URL above to extract posts" />
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── TikTok View ────────────────────────────────────────────────────────── */

export const TikTokView = () => {
  const [input, setInput] = useState('');
  const [searchType, setSearchType] = useState('profile'); // profile or hashtag
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [videos, setVideos] = useState([]);

  const handleSearch = async () => {
    if (!input.trim()) return;
    setStatus('loading');
    setError(null);
    setVideos([]);

    try {
      const opts = searchType === 'profile'
        ? { username: input.trim().replace('@', ''), limit: 50 }
        : { hashtag: input.trim().replace('#', ''), limit: 50 };

      const items = await fetchTikTokVideos(opts);
      if (!items || items.length === 0) {
        throw new Error('No videos found.');
      }
      setVideos(items);
      setStatus('success');
    } catch (err) {
      console.error('TikTok fetch error:', err);
      setError(err.message || 'Failed to fetch TikTok videos.');
      setStatus('error');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="TikTok Scraper"
        subtitle="Scrape videos from TikTok profiles or hashtags."
        gradient="from-slate-900 via-pink-600 to-cyan-500"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Toggle */}
          <div className="flex gap-4 justify-center mb-6">
            {['profile', 'hashtag'].map(type => (
              <button
                key={type}
                onClick={() => { setSearchType(type); setStatus('idle'); setVideos([]); }}
                disabled={status === 'loading'}
                className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all ${
                  searchType === type
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                {type === 'profile' ? '👤 Profile' : '# Hashtag'}
              </button>
            ))}
          </div>

          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder={searchType === 'profile' ? 'Enter TikTok username...' : 'Enter hashtag...'}
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Scrape Videos'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-pink-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Fetching TikTok videos...</p>
              <p className="text-slate-500 text-sm">This may take 30-90 seconds...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Failed to fetch videos</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mt-8 bg-white rounded-2xl border border-pink-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">{videos.length} Videos Found</h3>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
                {videos.map((v, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl overflow-hidden">
                    {v.videoMeta?.coverUrl && (
                      <img src={v.videoMeta.coverUrl} alt="" className="w-full h-32 object-cover" />
                    )}
                    <div className="p-3">
                      <p className="text-xs text-slate-600 line-clamp-2">{v.text || v.desc || 'No description'}</p>
                      <div className="flex gap-2 mt-2 text-xs text-slate-400">
                        <span>❤️ {v.diggCount || v.likes || 0}</span>
                        <span>💬 {v.commentCount || v.comments || 0}</span>
                        <span>↗️ {v.shareCount || v.shares || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === 'idle' && (
            <EmptyStateBox message="Enter a TikTok username or hashtag above" />
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── LinkedIn Posts View ────────────────────────────────────────────────── */

export const LinkedInPostsView = () => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);

  const handleSearch = async () => {
    if (!input.trim()) return;
    setStatus('loading');
    setError(null);
    setPosts([]);

    try {
      const items = await fetchLinkedInPosts(input.trim(), 10);
      if (!items || items.length === 0) {
        throw new Error('No posts found.');
      }
      setPosts(items);
      setStatus('success');
    } catch (err) {
      console.error('LinkedIn posts fetch error:', err);
      setError(err.message || 'Failed to fetch LinkedIn posts.');
      setStatus('error');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="LinkedIn Posts Scraper"
        subtitle="Extract recent posts from any LinkedIn profile or company page."
        gradient="from-blue-700 via-blue-800 to-cyan-700"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Paste a LinkedIn profile or company page URL..."
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Get Posts'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Fetching LinkedIn posts...</p>
              <p className="text-slate-500 text-sm">This may take 30-60 seconds...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Failed to fetch posts</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mt-8 bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">{posts.length} Posts Found</h3>
              </div>
              <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                {posts.map((p, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-600 line-clamp-4">{p.text || p.content || p.commentary || 'No text'}</p>
                    <div className="flex gap-4 mt-3 text-xs text-slate-400">
                      {p.likesCount !== undefined && <span>👍 {p.likesCount}</span>}
                      {p.commentsCount !== undefined && <span>💬 {p.commentsCount}</span>}
                      {p.repostsCount !== undefined && <span>🔄 {p.repostsCount}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === 'idle' && (
            <EmptyStateBox message="Paste a LinkedIn profile or company URL above" />
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── LinkedIn Profile View (Admin Only) ────────────────────────────────── */

export const LinkedInProfileView = ({ isAdmin = false }) => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  // For non-admin users, show preview only
  if (!isAdmin) {
    return (
      <div className="animate-in fade-in duration-500">
        <ToolHero
          title="LinkedIn Profile Scraper"
          subtitle="Get detailed profile data from any LinkedIn profile."
          gradient="from-blue-700 via-blue-800 to-cyan-700"
        />

        <section className="py-14 bg-slate-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Preview card for non-admin */}
            <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-sm">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Admin Feature</h3>
              <p className="text-slate-500 text-sm mb-6">
                LinkedIn profile scraping requires authentication and is only available to admin users.
                Sign up for a premium account to access this feature.
              </p>
              <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-full hover:shadow-lg transition-all">
                Upgrade to Access
              </button>
            </div>

            {/* Preview of what's available */}
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4">What you'll get with admin access:</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  Full profile data including headline, about, and experience
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  Education history and certifications
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  Skills and endorsements
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  Recommendations and connections count
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const handleSearch = async () => {
    if (!input.trim()) return;
    setStatus('loading');
    setError(null);
    setProfile(null);

    try {
      // Note: This requires cookies to be configured server-side
      const items = await fetchLinkedInProfile(input.trim(), []);
      if (!items || items.length === 0) {
        throw new Error('Profile not found or requires authentication.');
      }
      setProfile(items[0]);
      setStatus('success');
    } catch (err) {
      console.error('LinkedIn profile fetch error:', err);
      setError(err.message || 'Failed to fetch profile. LinkedIn auth may be required.');
      setStatus('error');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="LinkedIn Profile Scraper"
        subtitle="Get detailed profile data from any LinkedIn profile (admin only)."
        gradient="from-blue-700 via-blue-800 to-cyan-700"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Requires LinkedIn Authentication
            </h4>
            <p className="text-amber-700 text-xs mt-1">
              This feature requires LinkedIn cookies to be configured. Contact support to set up.
            </p>
          </div>

          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Paste a LinkedIn profile URL..."
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Get Profile'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Fetching profile data...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Failed to fetch profile</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {status === 'success' && profile && (
            <div className="mt-8 bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                {profile.profilePicture && (
                  <img src={profile.profilePicture} alt="" className="w-16 h-16 rounded-full" />
                )}
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{profile.firstName} {profile.lastName}</h3>
                  <p className="text-sm text-slate-600">{profile.headline || profile.occupation}</p>
                </div>
              </div>
              <div className="p-6 space-y-4 text-sm">
                {profile.about && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-1">About</h4>
                    <p className="text-slate-600">{profile.about}</p>
                  </div>
                )}
                {profile.location && (
                  <p className="text-slate-500">📍 {profile.location}</p>
                )}
                {profile.connectionsCount && (
                  <p className="text-slate-500">🔗 {profile.connectionsCount} connections</p>
                )}
              </div>
            </div>
          )}

          {status === 'idle' && (
            <EmptyStateBox message="Paste a LinkedIn profile URL above" />
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── YouTube Transcript View ────────────────────────────────────────────── */

export const YouTubeTranscriptView = () => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState(null);

  const handleSearch = async () => {
    if (!input.trim()) return;
    setStatus('loading');
    setError(null);
    setTranscript(null);

    try {
      const items = await fetchYouTubeTranscript(input.trim());
      if (!items || items.length === 0) {
        throw new Error('Transcript not available for this video.');
      }
      setTranscript(items[0]);
      setStatus('success');
    } catch (err) {
      console.error('YouTube transcript fetch error:', err);
      setError(err.message || 'Failed to fetch transcript.');
      setStatus('error');
    }
  };

  const handleCopyTranscript = () => {
    if (transcript?.transcript || transcript?.text) {
      navigator.clipboard.writeText(transcript.transcript || transcript.text).catch(() => {});
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="YouTube Transcript Extractor"
        subtitle="Extract the full transcript from any YouTube video."
        gradient="from-red-600 via-red-700 to-red-900"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ToolSearchBar
            value={input}
            onChange={setInput}
            placeholder="Paste a YouTube video URL..."
            buttonLabel={status === 'loading' ? 'Fetching...' : 'Get Transcript'}
            onSearch={handleSearch}
            disabled={status === 'loading'}
          />

          {status === 'loading' && (
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 text-red-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Extracting transcript...</p>
              <p className="text-slate-500 text-sm">This may take 15-30 seconds...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-8 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-4" />
              <p className="text-slate-700 font-semibold mb-2">Failed to extract transcript</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
          )}

          {status === 'success' && transcript && (
            <div className="mt-8 bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{transcript.title || 'Transcript'}</h3>
                  {transcript.channelName && (
                    <p className="text-xs text-slate-500">{transcript.channelName}</p>
                  )}
                </div>
                <button
                  onClick={handleCopyTranscript}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 rounded-lg hover:shadow-md transition-all"
                >
                  <Copy className="w-4 h-4" /> Copy All
                </button>
              </div>
              <div className="p-6 max-h-[500px] overflow-y-auto">
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {transcript.transcript || transcript.text || transcript.captions?.map(c => c.text).join(' ') || 'No transcript text available'}
                </p>
              </div>
            </div>
          )}

          {status === 'idle' && (
            <EmptyStateBox message="Paste a YouTube video URL above to extract its transcript" />
          )}
        </div>
      </section>
    </div>
  );
};
