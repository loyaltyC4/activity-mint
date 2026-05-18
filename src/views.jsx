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
} from 'lucide-react';

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

const TOOLKIT_TOOLS = [
  { icon: <Download className="w-6 h-6" />, name: 'Threads Downloader', desc: 'Download Threads videos and media', tab: 'threads-downloader' },
  { icon: <Award className="w-6 h-6" />, name: 'Celebrity Influencers', desc: 'Browse top Instagram celebrities', tab: 'celebrities' },
  { icon: <MonitorPlay className="w-6 h-6" />, name: 'Story Viewer', desc: 'View Instagram Stories anonymously', tab: 'story-viewer' },
  { icon: <Eye className="w-6 h-6" />, name: 'Post Viewer', desc: 'View public Instagram posts privately', tab: 'post-viewer' },
  { icon: <Hash className="w-6 h-6" />, name: 'Hashtag Generator', desc: 'Generate trending hashtags for your niche', tab: 'hashtag-generator' },
  { icon: <AlertCircle className="w-6 h-6" />, name: 'Shadowban Checker', desc: 'Check if your account is shadowbanned', tab: 'shadowban-checker' },
  { icon: <UserCheck className="w-6 h-6" />, name: 'Recent Follower Tracker', desc: 'Track who recently followed an account', tab: 'recent-follower' },
  { icon: <UserMinus className="w-6 h-6" />, name: 'Unfollower Tracker', desc: 'See who unfollowed you', tab: 'unfollower' },
  { icon: <FileUp className="w-6 h-6" />, name: 'Follower Export', desc: 'Export follower lists to CSV', tab: 'follower-export' },
];

export const ToolkitPageView = ({ setActiveTab }) => (
  <div className="animate-in fade-in duration-500">
    {/* Hero */}
    <section className="bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-800 text-white pt-16 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Free Instagram Tools</h1>
        <p className="text-emerald-100/80 text-lg">
          A complete suite of free tools to analyze, track, and grow your Instagram presence.
        </p>
      </div>
    </section>

    {/* Tools grid */}
    <section className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLKIT_TOOLS.map((tool, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 flex flex-col group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-5 group-hover:scale-110 transition-transform">
                {tool.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{tool.name}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">{tool.desc}</p>
              <button
                onClick={() => setActiveTab(tool.tab)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-full hover:shadow-md hover:shadow-emerald-500/25 hover:-translate-y-0.5 transition-all w-fit"
              >
                Try it <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  </div>
);

/* ─── Shared Tool Hero ───────────────────────────────────────────────────── */

const ToolHero = ({ title, subtitle, gradient = 'from-indigo-600 via-indigo-700 to-teal-700' }) => (
  <section className={`bg-gradient-to-br ${gradient} text-white pt-16 pb-20`}>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">{title}</h1>
      <p className="text-white/75 text-lg">{subtitle}</p>
    </div>
  </section>
);

const ToolSearchBar = ({ value, onChange, placeholder, buttonLabel, onSubmit }) => (
  <div className="max-w-2xl mx-auto">
    <form onSubmit={onSubmit || (e => e.preventDefault())} className="flex gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
      <div className="pl-3 flex items-center text-slate-400 shrink-0">
        <Search className="w-5 h-5" />
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 py-2.5 text-base"
      />
      <button
        type="submit"
        className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:shadow-md hover:shadow-emerald-500/25 transition-all shrink-0"
      >
        {buttonLabel}
      </button>
    </form>
  </div>
);

const EmptyStateBox = ({ message }) => (
  <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 border-dashed p-16 text-center mt-8 shadow-sm">
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

export const RecentFollowerView = ({ searchQuery, setSearchQuery, setActiveTab }) => (
  <SimpleToolPage
    title="Instagram Recent Follower Tracker"
    subtitle="Discover who recently started following any public Instagram account in real time."
    placeholder="Enter an Instagram username..."
    gradient="from-teal-600 via-emerald-600 to-indigo-700"
  />
);

/* ─── Unfollower View ────────────────────────────────────────────────────── */

export const UnfollowerView = ({ searchQuery, setSearchQuery, setActiveTab }) => (
  <SimpleToolPage
    title="Instagram Unfollower Tracker"
    subtitle="Find out who stopped following an account and when the unfollow happened."
    placeholder="Enter an Instagram username..."
    gradient="from-rose-600 via-rose-700 to-slate-800"
  />
);

/* ─── Follower Export View ───────────────────────────────────────────────── */

export const FollowerExportView = ({ searchQuery, setSearchQuery, setActiveTab }) => {
  const [listType, setListType] = useState('followers');
  const [input, setInput] = useState('');

  const TABLE_COLUMNS = ['Username', 'Full Name', 'Followers', 'Following', 'Posts'];

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero
        title="Instagram Follower Export Tool"
        subtitle="Export follower or following lists from any public Instagram account to CSV."
        gradient="from-indigo-600 via-indigo-700 to-teal-700"
      />

      <section className="py-14 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Radio toggle */}
          <div className="flex gap-4 justify-center mb-6">
            {['followers', 'following'].map(type => (
              <button
                key={type}
                onClick={() => setListType(type)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold border transition-all ${
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
            buttonLabel="Search Now"
          />

          {/* Empty state table */}
          {!input ? (
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
                      {TABLE_COLUMNS.map(col => (
                        <th key={col} className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map(r => (
                      <tr key={r} className="border-b border-slate-50">
                        {TABLE_COLUMNS.map(col => (
                          <td key={col} className="px-6 py-4">
                            <div className="h-3 bg-slate-100 rounded w-20 animate-pulse" />
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
          ) : (
            <div className="mt-8 bg-white rounded-2xl border border-indigo-200 p-8 text-center shadow-sm">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileUp className="w-7 h-7 text-indigo-600" />
              </div>
              <p className="text-slate-700 font-semibold mb-2">Export {listType} for <span className="text-indigo-600">@{input}</span></p>
              <p className="text-slate-500 text-sm mb-6">Sign up to export the full {listType} list as a CSV file.</p>
              <button className="px-7 py-2.5 bg-gradient-to-r from-indigo-500 to-teal-600 text-white font-semibold rounded-full hover:shadow-md transition-all">
                Sign Up to Export
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
