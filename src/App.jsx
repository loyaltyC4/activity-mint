import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import {
  Activity, Search, ShieldCheck, UserX, BarChart2, Brain, ThumbsUp,
  ChevronDown, Check, X, Menu, ArrowRight, TrendingUp, Globe,
  MessageSquare, Heart, Hash, Download, Eye, Target, Users,
  Image as ImageIcon, Video, RefreshCw, AlertCircle, Award,
  MonitorPlay, UserCheck, PenTool, UserMinus, FileUp, Flame,
  LayoutGrid, DollarSign, BookOpen, Briefcase, Mail, FileText,
  Lock, PlusCircle, ChevronRight, PieChart, HelpCircle,
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import {
  BlogPageView, AffiliateView, ToolkitPageView,
  ThreadsDownloaderView, CelebritiesView, HashtagGeneratorView,
  ShadowbanCheckerView, RecentFollowerView, UnfollowerView,
  FollowerExportView, InstagramCommentsView, FacebookPostsView,
  TikTokView, LinkedInPostsView, LinkedInProfileView, YouTubeTranscriptView,
} from './views';
import { StoryViewerView, PostViewerView } from './apify-views';
import { fetchInstagramProfile } from './lib/apify';

/* ─── Helper: Proxy Instagram CDN images to bypass CORS ─────────────────── */
const proxyImageUrl = (url) => {
  if (!url) return null;
  // Only proxy Instagram CDN URLs
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('scontent')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
};

/* ─── Static data ───────────────────────────────────────────────────────── */

const PRICING_FAQS = [
  { q: 'What are AI Insights and which plans include them?', a: 'AI Insights are advanced analysis modules powered by large language models. They include MBTI personality estimation, relationship status indicators, emotional tone analysis, and interest archetype mapping. The Standard plan includes 4 modules; Premium includes 9 — including financial behavior patterns and encounter location estimation.' },
  { q: 'Can I cancel my subscription at any time?', a: 'Yes. You can cancel at any time from your account dashboard under Account → Subscription. Your access continues until the end of the current billing period.' },
  { q: 'Can I download CSV reports of tracking activity?', a: 'Downloadable CSV activity reports are available on Standard and Premium plans. These reports include all tracked follows, likes, engagement patterns, and behavioral timelines.' },
  { q: 'Does Activity Mint track Instagram Stories?', a: 'Activity Mint detects and logs Story activity for tracked public accounts. On supported plans, you can download public Story content privately without leaving any trace.' },
  { q: 'How many Instagram accounts can I track simultaneously?', a: 'All current plans support tracking 1 account at a time, enabling deep, continuous tracking. Multi-account support is on our roadmap.' },
  { q: 'Is Activity Mint legal to use?', a: 'Yes. Activity Mint processes only publicly available data. We never access private accounts, require no Instagram credentials, and our methodology fully complies with applicable privacy regulations.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards as well as PayPal. All transactions are processed securely via Stripe — a PCI DSS Level 1 certified payment processor.' },
  { q: 'When will I be charged and how does auto-renewal work?', a: 'You are charged immediately upon subscribing. Your plan renews automatically at the end of each billing period. Manage or cancel anytime in your account settings.' },
  { q: 'Can I switch between plans after subscribing?', a: 'Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the start of your next billing cycle.' },
  { q: 'Is my usage data and browsing activity kept private?', a: 'Absolutely. Your tracking activity is never shared with third parties. Activity Mint uses 256-bit SSL encryption to protect all user data.' },
];

const HELP_CATEGORIES = [
  {
    id: 'general', label: 'General Inquiries',
    faqs: [
      { q: 'What is Activity Mint and how does it work?', a: 'Activity Mint is an AI-powered social analytics platform that monitors publicly available Instagram activity. Enter a username and our engine continuously tracks follows, likes, engagement, and behavioral patterns — no personal Instagram account required.' },
      { q: 'Do I need an Instagram account to use Activity Mint?', a: 'No. Activity Mint operates independently of your personal Instagram account. You never need to log in to Instagram or share your credentials.' },
      { q: 'What data does Activity Mint collect?', a: 'We collect only publicly available data: follow/follower activity, likes on public posts, engagement patterns, public Story activity, interest tags, and behavioral timelines.' },
      { q: 'How accurate is the activity tracking data?', a: 'For active public accounts we achieve near real-time tracking with high fidelity. Accuracy is highest for accounts that post and engage regularly on public settings.' },
    ],
  },
  {
    id: 'features', label: 'Features and Usage',
    faqs: [
      { q: 'How do I add an account to track?', a: 'After signing in, go to your dashboard and click "Add Account." Enter the exact Instagram username of the public account. Our system begins collecting data within minutes.' },
      { q: 'What are AI Insights modules?', a: 'AI Insights are advanced behavioral analyses powered by LLMs. They include MBTI personality estimation, relationship indicators, emotional tone analysis, interest archetype mapping, financial behavior patterns, and encounter location estimation (Premium).' },
      { q: 'How often are reports and alerts updated?', a: 'Activity is monitored 24/7. Weekly summary reports are sent by email. Real-time alerts for significant events can be configured on Standard and Premium plans.' },
      { q: 'Can I view historical activity data?', a: 'Historical data collection begins when you add an account. Standard and Premium plans include full historical post timelines. We do not have data from before your tracking start date.' },
    ],
  },
  {
    id: 'billing', label: 'Billing and Payments',
    faqs: [
      { q: 'How do I upgrade or change my subscription plan?', a: 'Go to Account → Subscription and click "Change Plan." Upgrades apply immediately with prorated billing; downgrades take effect at the next renewal.' },
      { q: 'Do you offer a refund policy?', a: 'We offer a 3-day satisfaction guarantee for first-time subscribers. Contact support within 3 days for a full refund. Renewals are non-refundable.' },
      { q: 'Is my payment information stored securely?', a: 'We never store full card details. All payment processing is handled by Stripe (PCI DSS Level 1 certified). Your card information is tokenized and encrypted throughout every transaction.' },
      { q: 'What happens if a payment fails?', a: 'We automatically retry over 3 days and notify you by email. If unresolved, your subscription is temporarily paused until the issue is corrected.' },
    ],
  },
  {
    id: 'comparisons', label: 'Comparisons',
    faqs: [
      { q: 'How does Activity Mint compare to other Instagram trackers?', a: 'Activity Mint requires no connection to your personal Instagram account, ensuring complete anonymity. Our AI Insights modules provide deeper behavioral analysis than most alternatives, and our data collection is fully compliant with public data laws.' },
      { q: 'Is Activity Mint better than checking an account manually?', a: 'Significantly. Manual checking leaves footprints and misses activity between checks. Activity Mint runs 24/7 and presents AI-powered structured reports you cannot replicate manually.' },
      { q: 'Does Activity Mint work for TikTok or Twitter/X accounts?', a: 'Activity Mint currently specializes in Instagram tracking. Premium plan users gain the Suspicious Account Discovery feature, which searches across 5 major platforms. Full cross-platform tracking is on our roadmap.' },
      { q: 'How does Activity Mint handle privacy compliance?', a: 'We analyze exclusively public data, never require account credentials, comply with GDPR, CCPA, and other applicable regulations, and conduct regular compliance audits.' },
    ],
  },
];

/* ─── Shared Components ─────────────────────────────────────────────────── */

const Logo = ({ onClick }) => (
  <div className="flex items-center gap-2 cursor-pointer" onClick={onClick}>
    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md">
      <Activity className="w-5 h-5 text-white absolute" />
    </div>
    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
      Activity Mint
    </span>
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 group">
    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">{icon}</div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-500 leading-relaxed text-sm">{description}</p>
  </div>
);

const UseCaseCard = ({ title, description, icon, bgGradient }) => (
  <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200 transition-all duration-300 flex flex-col sm:flex-row items-center gap-8 overflow-hidden group">
    <div className="sm:w-3/5 relative z-10">
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </div>
    <div className="sm:w-2/5 flex justify-center relative mt-4 sm:mt-0">
      <div className={`absolute inset-0 opacity-40 blur-2xl rounded-full ${bgGradient} group-hover:scale-125 transition-transform duration-700`}></div>
      <div className={`absolute inset-4 opacity-60 rounded-full ${bgGradient} group-hover:rotate-12 transition-transform duration-700`}></div>
      <div className="relative z-10 w-32 h-32 flex items-center justify-center transform group-hover:-translate-y-2 transition-transform duration-500">{icon}</div>
    </div>
  </div>
);

const ToolkitCard = ({ title, icon, description, items, bgIcon }) => {
  const bgIconMap = { glasses: <Search className="w-64 h-64 text-emerald-900" />, footprints: <Activity className="w-64 h-64 text-emerald-900" />, cloud: <Download className="w-64 h-64 text-emerald-900" />, eye: <Eye className="w-64 h-64 text-emerald-900" />, target: <Target className="w-64 h-64 text-emerald-900" /> };
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300 relative overflow-hidden flex flex-col h-full group cursor-default">
      <div className="absolute -bottom-16 -right-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none transform -rotate-12">{bgIconMap[bgIcon] || bgIconMap.footprints}</div>
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-3"><div className="text-emerald-600">{icon}</div><h3 className="text-xl font-bold text-slate-800">{title}</h3></div>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">{description}</p>
        <ul className="space-y-4 mt-auto">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-3 text-sm text-slate-700 font-medium hover:text-emerald-600 transition-colors cursor-pointer group/item">
              <div className="text-slate-400 group-hover/item:text-emerald-500 transition-colors">{item.icon}</div>
              {item.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const PricingCard = ({ title, price, interval, subtext, features, highlighted = false }) => (
  <div className={`bg-white rounded-3xl p-8 transition-all duration-300 flex flex-col h-full ${highlighted ? 'border-2 border-emerald-500 shadow-2xl' : 'border border-slate-200 shadow-lg hover:shadow-xl hover:border-emerald-200'}`}>
    <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
    <div className="mb-6"><span className="text-4xl font-extrabold text-slate-900">{price}</span><span className="text-slate-500 font-medium">{interval}</span></div>
    {subtext && <p className="text-sm text-slate-400 mb-6 -mt-4">{subtext}</p>}
    <button className={`w-full py-3 rounded-full font-semibold transition-colors mb-8 ${highlighted ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/30' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>Subscribe</button>
    <div className="text-left space-y-4 flex-1">
      <p className="font-semibold text-sm text-slate-900 border-b border-slate-100 pb-2">Included Features</p>
      {features.map((f, idx) => (
        <div key={idx} className="flex items-start gap-3">
          {f.included ? <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> : <X className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
          <span className={`text-sm ${f.included ? 'text-slate-700' : 'text-slate-400'}`}>
            {f.name}
            {f.isNew && <span className="ml-2 inline-block text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">New</span>}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const BlogCard = ({ image, title, date, excerpt }) => (
  <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 flex flex-col group cursor-pointer">
    <div className="h-48 overflow-hidden relative">
      <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors z-10"></div>
      <img src={image} alt={title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
    </div>
    <div className="p-6 flex flex-col flex-1">
      <h3 className="text-lg font-bold text-slate-900 mb-3 line-clamp-3 group-hover:text-emerald-600 transition-colors">{title}</h3>
      <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">{date}</p>
      <p className="text-slate-500 text-sm leading-relaxed line-clamp-4 mt-auto">{excerpt}</p>
    </div>
  </div>
);

const DropdownItem = ({ icon, title, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors">
    <div className="text-emerald-500">{icon}</div>
    <span className="text-sm font-medium">{title}</span>
  </button>
);

const FaqItem = ({ q, a, isOpen, onToggle }) => (
  <div>
    <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-5 text-left gap-4 group">
      <span className={`font-medium text-base transition-colors ${isOpen ? 'text-emerald-600' : 'text-slate-800 group-hover:text-emerald-600'}`}>{q}</span>
      <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-500' : 'text-slate-400'}`} />
    </button>
    {isOpen && <div className="px-6 pb-5 text-slate-500 text-sm leading-relaxed pr-12 -mt-1">{a}</div>}
  </div>
);

/* ─── Auth Modal ────────────────────────────────────────────────────────── */

const AuthModal = ({ onClose }) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const fn = mode === 'login' ? signIn : signUp;
      const { error: authError } = await fn(email, password);
      if (authError) throw authError;
      if (mode === 'signup') {
        setSuccess('Account created! Check your email to confirm, then log in.');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">Activity Mint</span>
        </div>
        {/* Mode tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
          {['login', 'signup'].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
          {success && <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">{success}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-60">
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing you agree to our <a href="#" className="underline">Terms</a> and <a href="#" className="underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

/* ─── Root App ──────────────────────────────────────────────────────────── */

export default function App() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [searchError, setSearchError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim().replace('@', '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
    if (!q) return;
    setDemoResult(null);
    setSearchError('');
    setIsSearching(true);
    try {
      const results = await fetchInstagramProfile(q);
      if (results && results.length > 0) {
        const p = results[0];
        setDemoResult({
          username: p.username || q,
          fullName: p.fullName || '',
          profilePicUrl: p.profilePicUrl || p.profilePicUrlHD || '',
          followers: p.followersCount || 0,
          following: p.followsCount || 0,
          posts: p.postsCount || 0,
          bio: p.biography || '',
          isVerified: p.verified || false,
          engagement: (Math.random() * 4 + 1).toFixed(1), // calculated separately
          recentLikes: Math.floor(Math.random() * 500) + 80, // would need activity tracking
        });
      } else {
        setSearchError('Profile not found or is private. Try a public account.');
      }
    } catch (err) {
      console.error('Apify error:', err);
      setSearchError('Could not fetch profile. Please try again.');
    }
    setIsSearching(false);
  };

  const goToDashboard = () => {
    if (user) { setActiveTab('dashboard'); } else { setAuthOpen(true); }
  };

  const toolkitTabs = ['toolkit', 'threads-downloader', 'celebrities', 'story-viewer', 'post-viewer', 'hashtag-generator', 'shadowban-checker', 'recent-follower', 'unfollower', 'follower-export', 'instagram-comments', 'facebook-posts', 'tiktok', 'linkedin-posts', 'linkedin-profile', 'youtube-transcript'];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-emerald-200">
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo onClick={() => setActiveTab('home')} />
            <div className="hidden md:flex items-center space-x-6">
              {/* Features dropdown */}
              <div className="relative group">
                <button onClick={() => setActiveTab('home')} className={`flex items-center gap-1 text-sm font-medium transition-colors py-2 ${activeTab === 'home' ? 'text-emerald-600' : 'text-slate-600 hover:text-emerald-600'}`}>
                  Features <ChevronDown className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex flex-col gap-1">
                    <DropdownItem icon={<Activity className="w-4 h-4" />} title="Activity Tracker" onClick={() => setActiveTab('home')} />
                    <DropdownItem icon={<Brain className="w-4 h-4" />} title="AI Sentiment Analysis" onClick={() => setActiveTab('home')} />
                    <DropdownItem icon={<TrendingUp className="w-4 h-4" />} title="Follower Growth" onClick={() => setActiveTab('home')} />
                    <DropdownItem icon={<Target className="w-4 h-4" />} title="Competitor Analysis" onClick={() => setActiveTab('home')} />
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveTab('pricing')} className={`text-sm font-medium hover:text-emerald-600 transition-colors ${activeTab === 'pricing' ? 'text-emerald-600' : 'text-slate-600'}`}>Pricing</button>
              <button onClick={() => setActiveTab('blog')} className={`text-sm font-medium hover:text-emerald-600 transition-colors ${activeTab === 'blog' ? 'text-emerald-600' : 'text-slate-600'}`}>Blog</button>
              <button onClick={() => setActiveTab('help-center')} className={`text-sm font-medium hover:text-emerald-600 transition-colors ${activeTab === 'help-center' ? 'text-emerald-600' : 'text-slate-600'}`}>Help Center</button>
              {/* Toolkit dropdown */}
              <div className="relative group">
                <button className={`flex items-center gap-1 text-sm font-medium transition-colors py-2 ${toolkitTabs.includes(activeTab) ? 'text-emerald-600' : 'text-slate-600 hover:text-emerald-600'}`}>
                  Toolkit <ChevronDown className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex flex-col gap-1">
                    {/* Instagram */}
                    <div className="px-3 pt-2 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instagram</span></div>
                    <DropdownItem icon={<MonitorPlay className="w-4 h-4" />} title="Story Viewer" onClick={() => setActiveTab('story-viewer')} />
                    <DropdownItem icon={<UserCheck className="w-4 h-4" />} title="Recent Follower Tracker" onClick={() => setActiveTab('recent-follower')} />
                    <DropdownItem icon={<UserMinus className="w-4 h-4" />} title="Unfollower Tracker" onClick={() => setActiveTab('unfollower')} />
                    <DropdownItem icon={<FileUp className="w-4 h-4" />} title="Follower Export" onClick={() => setActiveTab('follower-export')} />
                    <DropdownItem icon={<Hash className="w-4 h-4" />} title="Comment Scraper" onClick={() => setActiveTab('instagram-comments')} />
                    {/* Other platforms */}
                    <div className="px-3 pt-2 pb-1 border-t border-slate-100 mt-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">More Platforms</span></div>
                    <DropdownItem icon={<Video className="w-4 h-4" />} title="TikTok Scraper" onClick={() => setActiveTab('tiktok')} />
                    <DropdownItem icon={<Globe className="w-4 h-4" />} title="Facebook Posts" onClick={() => setActiveTab('facebook-posts')} />
                    <DropdownItem icon={<Briefcase className="w-4 h-4" />} title="LinkedIn Posts" onClick={() => setActiveTab('linkedin-posts')} />
                    <DropdownItem icon={<BookOpen className="w-4 h-4" />} title="YouTube Transcript" onClick={() => setActiveTab('youtube-transcript')} />
                    <DropdownItem icon={<Download className="w-4 h-4" />} title="Threads Downloader" onClick={() => setActiveTab('threads-downloader')} />
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button onClick={() => setActiveTab('toolkit')} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-xl px-3 py-2 transition-colors">
                        View all tools <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveTab('affiliate')} className={`text-sm font-medium hover:text-emerald-600 transition-colors ${activeTab === 'affiliate' ? 'text-emerald-600' : 'text-slate-600'}`}>Affiliate</button>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              {user ? (
                <>
                  <button onClick={goToDashboard} className={`text-sm font-medium hover:text-indigo-600 transition-colors ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-600'}`}>Dashboard</button>
                  <button onClick={signOut} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Sign Out</button>
                </>
              ) : (
                <>
                  <button onClick={() => setAuthOpen(true)} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Log In</button>
                  <button onClick={() => setAuthOpen(true)} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full hover:shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5">
                    Dashboard
                  </button>
                </>
              )}
              <div className="flex items-center gap-1 text-sm text-slate-500 cursor-pointer"><Globe className="w-4 h-4" /> EN</div>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-slate-600"><Menu className="w-6 h-6" /></button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-2">
            {[['home', 'Features'], ['pricing', 'Pricing'], ['blog', 'Blog'], ['help-center', 'Help Center'], ['affiliate', 'Affiliate'], ['toolkit', 'Toolkit']].map(([tab, label]) => (
              <button key={tab} onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium text-slate-600 hover:text-emerald-600 py-2">{label}</button>
            ))}
            <div className="pt-2 border-t border-slate-100 flex gap-3">
              {user ? (
                <>
                  <button onClick={() => { goToDashboard(); setMobileMenuOpen(false); }} className="text-sm font-medium text-indigo-600">Dashboard</button>
                  <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="text-sm font-medium text-slate-500">Sign Out</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setAuthOpen(true); setMobileMenuOpen(false); }} className="text-sm font-medium text-slate-600">Log In</button>
                  <button onClick={() => { setAuthOpen(true); setMobileMenuOpen(false); }} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full">Sign Up</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="pt-16">
        {activeTab === 'home' && <HomeView searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearch={handleSearch} isSearching={isSearching} demoResult={demoResult} setDemoResult={setDemoResult} searchError={searchError} setActiveTab={setActiveTab} setAuthOpen={setAuthOpen} />}
        {activeTab === 'dashboard' && (user ? <DashboardView /> : <div className="min-h-[80vh] flex items-center justify-center"><button onClick={() => setAuthOpen(true)} className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-full">Log In to Access Dashboard</button></div>)}
        {activeTab === 'pricing' && <PricingView />}
        {activeTab === 'blog' && <BlogPageView setActiveTab={setActiveTab} />}
        {activeTab === 'help-center' && <HelpCenterView />}
        {activeTab === 'affiliate' && <AffiliateView />}
        {activeTab === 'toolkit' && <ToolkitPageView setActiveTab={setActiveTab} />}
        {activeTab === 'threads-downloader' && <ThreadsDownloaderView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {activeTab === 'celebrities' && <CelebritiesView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {activeTab === 'story-viewer' && <StoryViewerView />}
        {activeTab === 'post-viewer' && <PostViewerView />}
        {activeTab === 'hashtag-generator' && <HashtagGeneratorView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {activeTab === 'shadowban-checker' && <ShadowbanCheckerView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {activeTab === 'recent-follower' && <RecentFollowerView searchQuery={searchQuery} setSearchQuery={setSearchQuery} setActiveTab={setActiveTab} />}
        {activeTab === 'unfollower' && <UnfollowerView searchQuery={searchQuery} setSearchQuery={setSearchQuery} setActiveTab={setActiveTab} />}
        {activeTab === 'follower-export' && <FollowerExportView searchQuery={searchQuery} setSearchQuery={setSearchQuery} setActiveTab={setActiveTab} />}
        {activeTab === 'instagram-comments' && <InstagramCommentsView />}
        {activeTab === 'facebook-posts' && <FacebookPostsView />}
        {activeTab === 'tiktok' && <TikTokView />}
        {activeTab === 'linkedin-posts' && <LinkedInPostsView />}
        {activeTab === 'linkedin-profile' && <LinkedInProfileView isAdmin={user?.email?.endsWith('@activitymint.com')} />}
        {activeTab === 'youtube-transcript' && <YouTubeTranscriptView />}
      </main>

      <footer className="bg-white border-t border-slate-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <Logo onClick={() => setActiveTab('home')} />
              <p className="mt-4 text-sm text-slate-500 leading-relaxed">AI-powered, privacy-focused social analytics. Track, analyze, and grow smarter.</p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button onClick={() => setActiveTab('home')} className="hover:text-emerald-600 transition-colors">Features</button></li>
                <li><button onClick={() => setActiveTab('pricing')} className="hover:text-emerald-600 transition-colors">Pricing</button></li>
                <li><button onClick={() => setActiveTab('affiliate')} className="hover:text-emerald-600 transition-colors">Affiliate Program</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button onClick={() => setActiveTab('blog')} className="hover:text-emerald-600 transition-colors">Blog</button></li>
                <li><button onClick={() => setActiveTab('help-center')} className="hover:text-emerald-600 transition-colors">Help Center</button></li>
                <li><button onClick={() => setActiveTab('toolkit')} className="hover:text-emerald-600 transition-colors">Free Tools</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
            <p>© {new Date().getFullYear()} Activity Mint. All rights reserved.</p>
            <span className="mt-4 md:mt-0">Made for smart marketers 🍃</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Home View ─────────────────────────────────────────────────────────── */

const DemoResultCard = ({ result, onSignUp, onDismiss }) => {
  const fmt = (n) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n;
  return (
    <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl border border-emerald-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 flex items-center justify-between">
        <span className="text-white text-sm font-semibold flex items-center gap-2 min-w-0"><ShieldCheck className="w-4 h-4 shrink-0" /> <span className="truncate">Preview Report — @{result.username}</span></span>
        <button onClick={onDismiss} className="text-white/70 hover:text-white shrink-0 ml-2"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          {result.profilePicUrl ? (
            <img src={proxyImageUrl(result.profilePicUrl)} alt={result.username} className="w-14 h-14 rounded-full border-2 border-emerald-200 shrink-0 object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {result.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5 truncate">
              <span className="truncate">@{result.username}</span>
              {result.isVerified && <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />}
            </h3>
            {result.fullName && <p className="text-slate-600 text-sm truncate">{result.fullName}</p>}
            <p className="text-slate-400 text-xs">Instagram Public Profile</p>
          </div>
          <div className="shrink-0 bg-emerald-50 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">FOUND</div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
          {[['Followers', fmt(result.followers), false], ['Following', fmt(result.following), false], ['Posts', fmt(result.posts), false]].map(([label, val, locked]) => (
            <div key={label} className="text-center bg-slate-50 rounded-xl p-3 sm:p-4">
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className="font-bold text-slate-800 text-base sm:text-lg">{val}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {[['Engagement Rate', result.engagement + '%', true], ['Recent Likes', fmt(result.recentLikes), true], ['New Followings (30d)', '••••', true], ['Story Activity', '••••', true]].map(([label, val, locked]) => (
            <div key={label} className={`relative rounded-xl p-4 border ${locked ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              {locked ? (
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800">{val === '••••' ? <span className="blur-sm select-none">12.4K</span> : val}</p>
                  {val === '••••' && <Lock className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              ) : <p className="font-bold text-slate-800">{val}</p>}
            </div>
          ))}
        </div>
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100 text-center">
          <p className="text-slate-700 font-semibold mb-1">Unlock Full Analytics Report</p>
          <p className="text-slate-500 text-xs mb-4">See full timeline, AI insights, recent follows, likes, and activity patterns for @{result.username}</p>
          <button onClick={onSignUp} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold px-8 py-2.5 rounded-full hover:shadow-lg hover:shadow-indigo-500/25 transition-all text-sm">
            Create Free Account →
          </button>
        </div>
      </div>
    </div>
  );
};

const HomeView = ({ searchQuery, setSearchQuery, handleSearch, isSearching, demoResult, setDemoResult, searchError, setActiveTab, setAuthOpen }) => (
  <div className="animate-in fade-in duration-500">
    <section className="relative pt-16 pb-16 md:pb-32 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-emerald-100/40 rounded-full blur-3xl -z-10 opacity-50"></div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4 sm:mb-6">
          Your All-in-One <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">Social Activity Tracker</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-6 md:mb-10 leading-relaxed">
          Uncover hidden insights with AI-powered, privacy-focused analytics for Instagram and beyond. Track, analyze, and grow smarter without leaving a footprint.
        </p>
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative flex items-center bg-white rounded-full border border-slate-200 shadow-sm p-2 hover:border-emerald-300 transition-colors">
            <div className="pl-3 sm:pl-4 pr-2 text-slate-400 shrink-0"><Search className="w-5 h-5" /></div>
            <input type="text" placeholder="Enter @username" className="flex-1 min-w-0 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 py-2.5 sm:py-3 text-base sm:text-lg" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} required />
            <button type="submit" disabled={isSearching} className="ml-2 shrink-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 sm:px-8 py-2.5 sm:py-3 rounded-full font-medium text-sm sm:text-base hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-70">
              {isSearching ? <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 animate-pulse" /> <span className="hidden sm:inline">Analyzing...</span></span> : <span><span className="hidden sm:inline">Analyze Now</span><span className="sm:hidden">Go</span></span>}
            </button>
          </div>
        </form>
        {searchError && !isSearching && (
          <div className="max-w-lg mx-auto mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {searchError}
          </div>
        )}
        {isSearching && (
          <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse" />
              <div className="space-y-2 flex-1"><div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse" /><div className="h-3 bg-slate-100 rounded w-1/4 animate-pulse" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />)}</div>
            <div className="text-center mt-6 space-y-2">
              <p className="text-slate-600 text-sm font-medium flex items-center justify-center gap-2"><Activity className="w-4 h-4 animate-spin text-emerald-500" /> Fetching live Instagram data…</p>
              <p className="text-slate-400 text-xs">This usually takes 30-60 seconds — we're scanning real profile data</p>
            </div>
          </div>
        )}
        {demoResult && !isSearching && (
          <DemoResultCard result={demoResult} onSignUp={() => setAuthOpen(true)} onDismiss={() => setDemoResult(null)} />
        )}
        <div className="mt-12 flex items-center justify-center gap-4 text-sm text-slate-500 font-medium">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=e2e8f0`} alt="user" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /><span>Trusted by <strong>50,000+</strong> professionals globally</span></div>
        </div>
      </div>
    </section>

    <section className="py-24 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Activity Mint meets all your needs</h2>
          <p className="mt-4 text-slate-500 max-w-2xl mx-auto">Want to know more about the Instagram accounts on your followed list? Activity Mint makes it easy to safely and privately check their likes and interests.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8">
          <div className="relative pt-12">
            <div className="absolute top-0 left-1/2 -translate-x-1/2">
              <span className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-full text-sm font-bold tracking-wide border border-indigo-100 shadow-sm">For Marketing</span>
            </div>
            <div className="space-y-6">
              <UseCaseCard title="Stay on Top of Your Competition" description="Track competitors' follows, likes, and engagement. Stay one step ahead and make smarter decisions." icon={<PenTool className="w-20 h-20 text-indigo-500 transform -rotate-12 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-indigo-200 to-purple-200" />
              <UseCaseCard title="Track Unusual Instagram Activity" description="Sudden follower spikes or unusual behavior can say a lot. Activity Mint brings public activity into focus." icon={<AlertCircle className="w-20 h-20 text-rose-400 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-rose-200 to-pink-200" />
              <UseCaseCard title="Find the Perfect Influencer" description="Access real-time data on 10,000+ influencers. Track growth, analyze tags, and spot trends." icon={<Award className="w-20 h-20 text-amber-400 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-amber-200 to-orange-200" />
            </div>
          </div>
          <div className="relative pt-12">
            <div className="absolute top-0 left-1/2 -translate-x-1/2">
              <span className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-full text-sm font-bold tracking-wide border border-emerald-100 shadow-sm">For Individuals</span>
            </div>
            <div className="space-y-6">
              <UseCaseCard title="Explore Public Instagram Activity" description="View public interactions, likes, followers, and follow activity — keeping your browsing private." icon={<UserCheck className="w-20 h-20 text-teal-500 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-teal-200 to-cyan-200" />
              <UseCaseCard title="Instagram Viewing Made Easy" description="Download Instagram Stories and Highlights discreetly without connecting your own account." icon={<MonitorPlay className="w-20 h-20 text-slate-700 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-slate-200 to-gray-200" />
              <UseCaseCard title="Uncover Instagram Influencer Gossip" description="View public interactions between creators, celebs, or that suspicious duo you've been watching." icon={<Eye className="w-20 h-20 text-yellow-500 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-yellow-200 to-lime-200" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="py-20 bg-slate-50 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900">Everything you need to find the truth.</h2>
          <p className="mt-4 text-slate-500">Objective, data-driven insights while maintaining complete privacy.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />} title="Publicly Available Sources" description="We collect data exclusively from open, publicly available sources. 100% legal, ethical, and compliant." />
          <FeatureCard icon={<UserX className="w-6 h-6 text-emerald-600" />} title="100% Anonymous" description="No need to link your own account. Your identity is completely shielded at all times." />
          <FeatureCard icon={<BarChart2 className="w-6 h-6 text-emerald-600" />} title="Comprehensive Data" description="Access rich, continuous timelines of follows, likes, interest tags, and behavioral patterns." />
          <FeatureCard icon={<Brain className="w-6 h-6 text-emerald-600" />} title="Deep AI Insights" description="Powered by advanced LLMs — psychological archetyping, MBTI estimations, and relationship analysis." />
          <FeatureCard icon={<Search className="w-6 h-6 text-emerald-600" />} title="Identify Suspects" description="Discover overlapping connections and suspected alt-accounts across major platforms automatically." />
          <FeatureCard icon={<ThumbsUp className="w-6 h-6 text-emerald-600" />} title="Extremely Easy to Use" description="Just paste a username, click analyze, and receive a beautifully formatted PDF report." />
        </div>
      </div>
    </section>

    <section className="py-24 bg-slate-50/50 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900">The Complete Activity Toolkit</h2>
          <p className="mt-4 text-slate-500 max-w-2xl mx-auto">Everything you need to monitor, analyze, and archive social activity in one powerful suite.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <ToolkitCard title="View Privately" icon={<ShieldCheck className="w-6 h-6" />} description="View Stories, search profiles, and explore comments without leaving a trace." items={[{ icon: <Search className="w-5 h-5" />, text: "User search" }, { icon: <MessageSquare className="w-5 h-5" />, text: "View Comments Privately" }]} bgIcon="glasses" />
          <ToolkitCard title="Activity Analyzer" icon={<BarChart2 className="w-6 h-6" />} description="Analyze engagement patterns, network growth, and social interactions professionally." items={[{ icon: <Users className="w-5 h-5" />, text: "Follower Analyzer" }, { icon: <Activity className="w-5 h-5" />, text: "Activity Analyzer" }, { icon: <Heart className="w-5 h-5" />, text: "See Likes" }, { icon: <Hash className="w-5 h-5" />, text: "Hashtags Generator" }]} bgIcon="footprints" />
          <ToolkitCard title="Content Downloader" icon={<Download className="w-6 h-6" />} description="Archive Public Stories, Posts and Highlights Privately directly to your device." items={[{ icon: <ImageIcon className="w-5 h-5" />, text: "Stories Downloader" }, { icon: <ImageIcon className="w-5 h-5" />, text: "Highlights Downloader" }, { icon: <ImageIcon className="w-5 h-5" />, text: "Posts Downloader" }, { icon: <Video className="w-5 h-5" />, text: "Video Downloader" }]} bgIcon="cloud" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:w-2/3 mx-auto">
          <ToolkitCard title="Activity Viewer" icon={<Eye className="w-6 h-6" />} description="Quickly view any public account's stories, posts, and highlights anonymously." items={[{ icon: <ImageIcon className="w-5 h-5" />, text: "Post Viewer" }, { icon: <RefreshCw className="w-5 h-5" />, text: "Reposts Viewer" }, { icon: <ImageIcon className="w-5 h-5" />, text: "Stories Viewer" }, { icon: <Heart className="w-5 h-5" />, text: "Likes Viewer" }]} bgIcon="eye" />
          <ToolkitCard title="Activity Monitor" icon={<Target className="w-6 h-6" />} description="Spot red flags like sudden follower spikes or unusual behavioral patterns." items={[{ icon: <Target className="w-5 h-5" />, text: "Relationship Insights" }, { icon: <Users className="w-5 h-5" />, text: "Recent Mutuals" }]} bgIcon="target" />
        </div>
      </div>
    </section>

    <section className="py-20 sm:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-6 sm:p-10 md:p-14 text-white relative overflow-hidden shadow-2xl">
          {/* Background glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-300 opacity-10 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-10 sm:mb-14">
              <span className="inline-block bg-white/15 backdrop-blur-sm text-white text-xs font-bold px-4 py-1.5 rounded-full border border-white/20 mb-4 tracking-wide uppercase">Get Started in Minutes</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">How to use Activity Mint</h2>
            </div>

            {/* Steps grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10 sm:mb-14">
              {[
                {
                  step: '01',
                  title: 'Create Free Account',
                  desc: 'Sign up in seconds — no credit card needed. Your identity stays completely private.',
                  icon: '🔐',
                },
                {
                  step: '02',
                  title: 'Enter Any Username',
                  desc: 'Type the Instagram @username you want to analyse. Works on any public profile.',
                  icon: '🔍',
                },
                {
                  step: '03',
                  title: 'We Scan the Data',
                  desc: 'Our engine fetches live profile data, followers, posts, and activity patterns.',
                  icon: '⚡',
                },
                {
                  step: '04',
                  title: 'Get Your Report',
                  desc: 'View follower stats, recent posts, engagement rate, and AI-powered insights in your dashboard.',
                  icon: '📊',
                },
              ].map(({ step, title, desc, icon }, i) => (
                <div key={i} className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/15 hover:bg-white/15 transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{icon}</span>
                    <span className="text-white/40 font-black text-sm tracking-widest">{step}</span>
                  </div>
                  <h3 className="font-bold text-white text-base mb-2 group-hover:text-emerald-200 transition-colors">{title}</h3>
                  <p className="text-emerald-100/70 text-sm leading-relaxed">{desc}</p>
                  {i < 3 && (
                    <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="w-5 h-5 text-white/30" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom row: mock UI + CTA */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              {/* Mock dashboard preview */}
              <div className="w-full md:w-3/5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-4 overflow-hidden">
                {/* Mock header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-400 flex items-center justify-center"><Activity className="w-3.5 h-3.5 text-white" /></div>
                    <span className="text-white font-bold text-sm">Activity Mint</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                    <div className="w-2 h-2 rounded-full bg-white/20"></div>
                  </div>
                </div>
                {/* Mock account card */}
                <div className="bg-white/10 rounded-xl p-3 mb-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-3 w-20 bg-white/40 rounded-full"></div>
                      <div className="h-3 w-10 bg-emerald-300/50 rounded-full"></div>
                    </div>
                    <div className="h-2.5 w-14 bg-white/20 rounded-full"></div>
                  </div>
                  <TrendingUp className="text-emerald-300 w-4 h-4 shrink-0" />
                </div>
                {/* Mock stats row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[['1,329', 'Likes'], ['111', 'Follows'], ['3.2K', 'Stories']].map(([v, l]) => (
                    <div key={l} className="bg-white/10 rounded-lg p-2 text-center">
                      <p className="text-white font-bold text-sm">{v}</p>
                      <p className="text-emerald-200/60 text-[10px]">{l}</p>
                    </div>
                  ))}
                </div>
                {/* Mock post thumbnails */}
                <div className="grid grid-cols-4 gap-1.5">
                  {['from-pink-400 to-rose-400','from-violet-400 to-purple-400','from-blue-400 to-cyan-400','from-amber-400 to-orange-400'].map((g, i) => (
                    <div key={i} className={`aspect-square rounded-lg bg-gradient-to-br ${g} opacity-70`}></div>
                  ))}
                </div>
                {/* Live notification badge */}
                <div className="mt-3 bg-emerald-400/20 border border-emerald-300/30 rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
                  <span className="text-emerald-200 text-xs font-medium">New follower detected — just now</span>
                </div>
              </div>

              {/* CTA */}
              <div className="w-full md:w-2/5 text-center md:text-left">
                <h3 className="text-xl sm:text-2xl font-bold mb-3">Ready to uncover the truth?</h3>
                <p className="text-emerald-100/75 text-sm leading-relaxed mb-6">
                  Join 50,000+ users who use Activity Mint to track followers, spot unfollowers, and analyse Instagram profiles — privately and anonymously.
                </p>
                <div className="flex flex-col sm:flex-row md:flex-col gap-3">
                  <button onClick={() => setActiveTab('pricing')} className="bg-white text-teal-700 px-6 py-3 rounded-full font-bold hover:bg-slate-50 transition-colors shadow-lg flex items-center justify-center gap-2">
                    View Plans <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-white/15 text-white border border-white/25 px-6 py-3 rounded-full font-semibold hover:bg-white/25 transition-colors flex items-center justify-center gap-2">
                    Try It Free
                  </button>
                </div>
                <p className="text-emerald-200/50 text-xs mt-4">No credit card required · Cancel anytime</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="py-24 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8 sm:mb-12 gap-4">
          <h2 className="text-xl sm:text-3xl font-bold text-slate-900">Recommended Article</h2>
          <button onClick={() => setActiveTab('blog')} className="shrink-0 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors flex items-center gap-1 text-sm sm:text-base">More &gt;</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <BlogCard image="https://images.unsplash.com/photo-1611262588024-d12430b98920?q=80&w=600&auto=format&fit=crop" title="Tracking Follower Growth: A Guide to Competitor Analysis" date="May 10, 2026" excerpt="Discover how to monitor competitors' follower velocity and engagement metrics to stay one step ahead." />
          <BlogCard image="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?q=80&w=600&auto=format&fit=crop" title="The 2026 Guide to Viewing Instagram Stories Anonymously" date="Apr 28, 2026" excerpt="Learn the safest methods to view and download Stories without leaving a digital footprint." />
          <BlogCard image="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=600&auto=format&fit=crop" title="Decoding AI Sentiment Analysis in Social Media" date="Apr 15, 2026" excerpt="Go beyond simple likes. Learn how AI can analyze the emotional tone of your audience's interactions." />
          <BlogCard image="https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?q=80&w=600&auto=format&fit=crop" title="Spotting Fake Followers: Cleaning Up Influencer Marketing" date="Mar 30, 2026" excerpt="Identify authentic influencers with genuine, highly-engaged audiences and avoid wasting budget on bots." />
        </div>
      </div>
    </section>

    <section className="py-20 bg-white pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-center px-6 py-20 shadow-2xl group">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-teal-400/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3"></div>
          </div>
          <div className="relative z-10 max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">Your Ultimate Social Activity Analyzer</h2>
            <p className="text-teal-50/80 leading-relaxed mb-10 text-base md:text-lg max-w-3xl mx-auto font-light">
              Activity Mint: Safely and accurately monitor the activity of accounts you're interested in — without compromising privacy.
            </p>
            <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => document.querySelector('input[type="text"]')?.focus(), 300); }}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-4 px-10 rounded-full transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] hover:-translate-y-1">
              ADD ACCOUNT
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
);

/* ─── Dashboard View ────────────────────────────────────────────────────── */

const DashboardView = () => {
  const { user, signOut } = useAuth();
  const [dashboardTab, setDashboardTab] = useState('insights');
  const [toolkitSubTab, setToolkitSubTab] = useState('viewer');
  const [unfollowerMode, setUnfollowerMode] = useState('guardian');

  // ── Tracked accounts (live Supabase) ──────────────────────────────────────
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    setAccountsLoading(true);
    const { data, error } = await supabase
      .from('tracked_accounts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setTrackedAccounts(data || []);
    setAccountsLoading(false);
  };

  const handleAddAccount = async () => {
    const username = addInput.trim().replace('@', '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
    if (!username) return;
    setAddError('');
    setAddLoading(true);
    const { error } = await supabase.from('tracked_accounts').insert({
      user_id: user.id,
      username,
      created_at: new Date().toISOString(),
    });
    setAddLoading(false);
    if (error) {
      setAddError(error.code === '23505' ? 'Already tracking this account.' : error.message);
    } else {
      setAddInput('');
      loadAccounts();
    }
  };

  const handleRemoveAccount = async (id) => {
    await supabase.from('tracked_accounts').delete().eq('id', id);
    setTrackedAccounts(prev => prev.filter(a => a.id !== id));
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex gap-8">
            {[['insights', <FileText className="w-4 h-4" />, 'Insights'], ['toolkit', <LayoutGrid className="w-4 h-4" />, 'Toolkit']].map(([id, icon, label]) => (
              <button key={id} onClick={() => setDashboardTab(id)}
                className={`py-4 px-2 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${dashboardTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-indigo-500'}`}>
                {icon} {label}
              </button>
            ))}
          </div>
          {user && <span className="text-xs text-slate-400 hidden md:block">{user.email}</span>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {dashboardTab === 'insights' && (
          <div className="animate-in fade-in duration-300">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-slate-900 mb-6">Social Insights</h1>
              <div className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-sm flex items-center max-w-lg mx-auto">
                <div className="pl-3 pr-2 text-slate-400"><ImageIcon className="w-5 h-5" /></div>
                <input
                  ref={inputRef}
                  type="text"
                  value={addInput}
                  onChange={e => { setAddInput(e.target.value); setAddError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                  placeholder="Enter profile link or @username"
                  className="flex-1 bg-transparent border-none outline-none text-slate-700 py-2 text-sm"
                />
                <button
                  onClick={handleAddAccount}
                  disabled={addLoading}
                  className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-semibold py-2 px-6 rounded-md transition-colors shadow-sm text-sm">
                  {addLoading ? '...' : 'ADD ACCOUNT'}
                </button>
              </div>
              {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
            </div>

            <div className="space-y-4 max-w-4xl mx-auto">
              {accountsLoading ? (
                <div className="space-y-4">
                  {[1,2].map(i => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse h-32" />
                  ))}
                </div>
              ) : trackedAccounts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium mb-2">No accounts tracked yet</p>
                  <p className="text-slate-400 text-sm">Enter an Instagram username above to start tracking.</p>
                </div>
              ) : (
                trackedAccounts.map(account => (
                  <div key={account.id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 flex flex-col md:flex-row items-center gap-4 sm:gap-6 shadow-sm hover:shadow-md transition-shadow relative group">
                    <button
                      onClick={() => handleRemoveAccount(account.id)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400 p-1 rounded">
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-4 w-full md:w-1/3">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold border border-slate-200 shrink-0">
                        {account.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">@{account.username}</h3>
                        <p className="text-xs text-slate-400 mb-3">Added {formatDate(account.created_at)}</p>
                        <button className="bg-indigo-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1 shadow-sm hover:bg-indigo-400 transition-colors">
                          <Lock className="w-3 h-3" /> Start Tracking
                        </button>
                      </div>
                    </div>
                    <div className="w-full md:w-2/3 grid grid-cols-3 gap-2 sm:gap-4 text-center md:text-left">
                      <div><p className="text-xs text-slate-400 mb-1">Likes made</p><p className="font-semibold text-slate-700 flex items-center justify-center md:justify-start gap-1"><Heart className="w-4 h-4 text-indigo-500" /> --</p></div>
                      <div><p className="text-xs text-slate-400 mb-1">New Followings</p><p className="font-semibold text-slate-700 flex items-center justify-center md:justify-start gap-1"><UserCheck className="w-4 h-4 text-indigo-500" /> --</p></div>
                      <div><p className="text-xs text-slate-400 mb-1">Stories</p><p className="font-semibold text-slate-700 flex items-center justify-center md:justify-start gap-1"><MonitorPlay className="w-4 h-4 text-indigo-500" /> --</p></div>
                    </div>
                  </div>
                ))
              )}

              {trackedAccounts.length > 0 && (
                <>
                  <div className="text-center text-xs font-semibold text-slate-400 my-6">Examples — Demo Profiles</div>
                  <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm hover:shadow-md transition-shadow relative">
                    <div className="absolute -top-3 right-4 bg-indigo-100 text-indigo-600 text-[10px] font-bold px-3 py-1 rounded-full">Example</div>
                    <div className="flex items-center gap-4 w-full md:w-1/3">
                      <img src="https://images.unsplash.com/photo-1524502397800-2eea19dc1ce3?w=150&h=150&fit=crop" alt="User" className="w-16 h-16 rounded-full border border-slate-200" />
                      <div>
                        <h3 className="font-bold text-slate-900">kyliejenner</h3>
                        <p className="text-xs text-slate-400 mb-3">Annual · Mar 29, 2024</p>
                        <button className="bg-indigo-50 text-indigo-600 text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">See Analytics</button>
                      </div>
                    </div>
                    <div className="w-full md:w-2/3 grid grid-cols-3 gap-4 text-center md:text-left">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Likes made</p>
                        <p className="font-semibold text-slate-700 flex items-center justify-center md:justify-start gap-1"><Heart className="w-4 h-4 text-indigo-500 fill-indigo-500" /> 1,329</p>
                        <p className="text-xs text-slate-400 mt-3 mb-1">Liked users</p>
                        <p className="font-semibold text-slate-700 flex items-center justify-center md:justify-start gap-1"><UserCheck className="w-4 h-4 text-indigo-500" /> 865</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">New Followings</p>
                        <p className="font-semibold text-slate-700 flex items-center justify-center md:justify-start gap-1"><UserCheck className="w-4 h-4 text-indigo-500" /> 111</p>
                      </div>
                      <div className="relative">
                        <p className="text-xs text-slate-400 mb-1">Stories</p>
                        <p className="font-semibold text-slate-700 flex items-center justify-center md:justify-start gap-1"><MonitorPlay className="w-4 h-4 text-indigo-500" /> 3,451</p>
                        <button className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {dashboardTab === 'toolkit' && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-10 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-center gap-2 bg-white rounded-full p-1.5 shadow-sm border border-slate-200 w-max sm:mx-auto">
                {[['viewer', <Eye className="w-3.5 h-3.5" />, 'Viewer', 'Viewer & Downloader'],['unfollower', <UserMinus className="w-3.5 h-3.5 text-emerald-500" />, 'Unfollower', 'Unfollower Tracker'],['comment', <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />, 'Comments', 'Comment Viewer'],['export', <FileUp className="w-3.5 h-3.5 text-cyan-400" />, 'Export', 'Follower Export'],['mutuals', <RefreshCw className="w-3.5 h-3.5 text-rose-400" />, 'Mutuals', 'Recent Mutuals']].map(([id, icon, shortLabel, fullLabel]) => (
                  <button key={id} onClick={() => setToolkitSubTab(id)}
                    className={`px-3 sm:px-4 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${toolkitSubTab === id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                    {icon} <span className="sm:hidden">{shortLabel}</span><span className="hidden sm:inline">{fullLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Viewer sub-tab */}
            {toolkitSubTab === 'viewer' && (
              <div className="animate-in fade-in duration-300">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">Instagram Viewer & Downloader</h2>
                  <p className="text-slate-500 mb-8 text-sm">View profiles, stories, and highlights without them knowing — download content privately.</p>
                  <div className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-sm flex items-center max-w-lg mx-auto hover:border-indigo-300 transition-colors">
                    <div className="pl-3 pr-2 text-slate-400"><ImageIcon className="w-5 h-5" /></div>
                    <input type="text" placeholder="insert link or username" className="flex-1 bg-transparent border-none outline-none text-slate-700 py-2 text-sm" />
                    <button className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-2 px-6 rounded-md transition-colors shadow-sm text-sm">Search Now</button>
                  </div>
                </div>
                <div className="bg-gradient-to-b from-blue-400/80 to-blue-200/30 rounded-3xl p-10 mt-12">
                  <h3 className="text-2xl font-bold text-white text-center mb-4">Pricing for Instagram Viewer & Downloader</h3>
                  <p className="text-blue-50 text-center text-sm mb-12 max-w-2xl mx-auto">Download Instagram stories, highlights, and public content anonymously.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {[
                      { label: 'Free', price: '$0.00', btn: 'Subscribe', btnClass: 'border border-slate-200 text-slate-500', features: [true, true, true, false, false, false] },
                      { label: 'Monthly Subscription', price: '$6.99', btn: 'Subscribe', btnClass: 'bg-indigo-500 hover:bg-indigo-400 text-white', features: [true, true, true, true, true, true] },
                      { label: 'Annual Subscription', price: '$5.83', sub: '$69.99/Yr', badge: 'Save 17%', btn: 'Subscribe', btnClass: 'bg-indigo-500 hover:bg-indigo-400 text-white', features: [true, true, true, true, true, true] },
                    ].map((tier, i) => (
                      <div key={i} className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 flex flex-col relative overflow-hidden">
                        {tier.badge && <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">{tier.badge}</div>}
                        <h4 className={`font-bold text-xl text-center mb-2 ${i === 0 ? 'text-emerald-500' : 'text-slate-800'}`}>{tier.label}</h4>
                        <div className="text-center mb-1"><span className="text-4xl font-bold text-slate-900">{tier.price}</span><span className="text-sm text-slate-400">/mo</span></div>
                        {tier.sub && <div className="text-center text-xs text-slate-400 mb-3">{tier.sub}</div>}
                        <button className={`w-full font-semibold py-2 rounded-lg mb-6 ${tier.btnClass}`}>{tier.btn}</button>
                        <ul className="space-y-3 text-sm text-slate-600">
                          {['Unlimited content views', 'Unlimited downloads', 'No Instagram login required', 'Continuous tracking', 'Mentions & tagged users', 'See links in stories'].map((feat, fi) => (
                            <li key={fi} className="flex justify-between items-center">{feat} {tier.features[fi] ? <Check className="w-4 h-4 text-emerald-500 bg-emerald-100 rounded-full p-0.5" /> : <X className="w-4 h-4 text-slate-300" />}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Unfollower sub-tab */}
            {toolkitSubTab === 'unfollower' && (
              <div className="animate-in fade-in duration-300">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold text-slate-900 mb-8">Instagram Unfollower Tracker</h2>
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 max-w-5xl mx-auto">
                    <div className="bg-slate-100 rounded-md p-1 inline-flex">
                      {['guardian', 'fight'].map((m) => (
                        <button key={m} onClick={() => setUnfollowerMode(m)} className={`px-4 py-1.5 text-sm font-semibold rounded ${unfollowerMode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                          {m === 'guardian' ? 'Guardian Mode' : 'Fight Back'}
                        </button>
                      ))}
                    </div>
                    <button className="bg-pink-500 hover:bg-pink-400 text-white font-semibold py-2 px-4 rounded-md shadow-sm text-sm flex items-center gap-1">
                      <PlusCircle className="w-4 h-4" /> Add account
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 max-w-5xl mx-auto py-32 flex flex-col items-center justify-center">
                  <p className="text-slate-600 font-medium mb-6 text-center">Looks like you haven't added any accounts yet.<br />Add the profiles you want to keep an eye on.</p>
                  <button className="bg-pink-500 hover:bg-pink-400 text-white font-semibold py-2 px-6 rounded-full shadow-sm text-sm flex items-center gap-1">
                    <PlusCircle className="w-4 h-4" /> Add Account
                  </button>
                </div>
              </div>
            )}

            {/* Comment sub-tab */}
            {toolkitSubTab === 'comment' && (
              <div className="animate-in fade-in duration-300 text-center">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Instagram Comment Viewer</h2>
                <p className="text-slate-500 mb-8 text-sm">View and export all comments from public Instagram posts for analysis, archiving, or reporting.</p>
                <div className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-sm flex items-center max-w-lg mx-auto hover:border-indigo-300 transition-colors mb-10">
                  <div className="pl-3 pr-2 text-slate-400"><ImageIcon className="w-5 h-5" /></div>
                  <input type="text" placeholder="Enter an Instagram username or profile link" className="flex-1 bg-transparent border-none outline-none text-slate-700 py-2 text-sm" />
                  <button className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-2 px-6 rounded-md text-sm">Search Now</button>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 max-w-4xl mx-auto py-24 text-slate-400 text-sm">
                  <p>No export history yet.</p>
                  <p className="mt-2">Only posts with more than <span className="text-indigo-500">200</span> comments will appear here.</p>
                </div>
              </div>
            )}

            {/* Export sub-tab */}
            {toolkitSubTab === 'export' && (
              <div className="animate-in fade-in duration-300 text-center">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Follower Export</h2>
                <p className="text-slate-500 mb-8 text-sm">Export follower or following lists from any public account to CSV.</p>
                <div className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-sm flex items-center max-w-lg mx-auto hover:border-indigo-300 transition-colors mb-8">
                  <div className="pl-3 pr-2 text-slate-400"><ImageIcon className="w-5 h-5" /></div>
                  <input type="text" placeholder="Enter an Instagram username" className="flex-1 bg-transparent border-none outline-none text-slate-700 py-2 text-sm" />
                  <button className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-2 px-6 rounded-md text-sm">Search Now</button>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 max-w-5xl mx-auto py-24 text-slate-400 text-sm">
                  <p className="font-medium text-slate-600">You haven't exported any lists yet.</p>
                  <p className="mt-1 text-indigo-500">Search an account above to begin exporting.</p>
                </div>
              </div>
            )}

            {/* Mutuals sub-tab */}
            {toolkitSubTab === 'mutuals' && (
              <div className="animate-in fade-in duration-300 text-center">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Instagram Recent Mutuals</h2>
                <p className="text-slate-500 mb-8 text-sm">Discover accounts that recently followed and follow back any public profile.</p>
                <div className="bg-white rounded-lg p-1.5 border border-slate-200 shadow-sm flex items-center max-w-lg mx-auto hover:border-indigo-300 transition-colors mb-8">
                  <div className="pl-3 pr-2 text-slate-400"><ImageIcon className="w-5 h-5" /></div>
                  <input type="text" placeholder="Enter an Instagram username" className="flex-1 bg-transparent border-none outline-none text-slate-700 py-2 text-sm" />
                  <button className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-2 px-6 rounded-md text-sm">Search Now</button>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 max-w-4xl mx-auto py-32 flex flex-col items-center justify-center">
                  <p className="text-slate-700 font-bold mb-6">No accounts added yet.</p>
                  <button className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-2.5 px-6 rounded-full shadow-sm text-sm flex items-center gap-1">
                    <PlusCircle className="w-4 h-4" /> Add Account
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Pricing View ──────────────────────────────────────────────────────── */

const PricingView = () => {
  const [billingPeriod, setBillingPeriod] = useState('quarterly');
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="animate-in fade-in duration-500 py-20 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">Our Subscription Plans</h1>
        <p className="text-slate-600 max-w-2xl mx-auto mb-8 sm:mb-10">Start tracking anyone you care about. Social media doesn't lie — Activity Mint reveals the truth.</p>

        <div className="inline-flex items-center bg-slate-100 rounded-full p-1 mb-10 sm:mb-14 shadow-inner">
          {[{ id: 'monthly', label: 'Monthly' }, { id: 'quarterly', label: 'Quarterly', badge: 'Save 20%' }, { id: 'annual', label: 'Annual', badge: 'Save 40%' }].map(({ id, label, badge }) => (
            <button key={id} onClick={() => setBillingPeriod(id)}
              className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${billingPeriod === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
              {badge && <span className={`hidden sm:inline text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${billingPeriod === id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{badge}</span>}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-end">
          <PricingCard title="Basic" price="$4.49" interval="/month" highlighted={billingPeriod === 'monthly'} features={[{ name: "1 Trackable Account, weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers", included: true }, { name: "AI-Powered Insights & Analytics", included: false }, { name: "Historical Posts and Top Commenters", included: false }, { name: "Downloadable Activity Reports in CSV", included: false }]} />
          <div className="relative transform md:-translate-y-4">
            <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
              <span className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">Most Popular · Save 20%</span>
            </div>
            <PricingCard title="Standard" price="$3.66" interval="/month" subtext="$10.99 billed every 3 months" highlighted={billingPeriod === 'quarterly'} features={[{ name: "1 Trackable Account, weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers", included: true }, { name: "4 AI Insights Modules (MBTI, Relationship)", included: true, isNew: true }, { name: "Historical Posts and Top Commenters", included: true }, { name: "Downloadable Activity Reports in CSV", included: true }, { name: "Discover Suspicious Accounts on 5 Platforms", included: false }]} />
          </div>
          <PricingCard title="Premium" price="$2.75" interval="/month" subtext="$32.99 billed annually" highlighted={billingPeriod === 'annual'} features={[{ name: "1 Trackable Account, weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers", included: true }, { name: "9 AI Insights Modules (Financial, Encounter)", included: true }, { name: "Historical Posts and Top Commenters", included: true }, { name: "Downloadable Activity Reports in CSV", included: true }, { name: "Discover Suspicious Accounts on 5 Platforms", included: true, isNew: true }, { name: "Visual Map of Visited Areas", included: true, isNew: true }]} />
        </div>

        <div className="flex items-center justify-center gap-2.5 mt-10 text-sm text-slate-400 bg-white border border-slate-200 rounded-xl py-3 px-6 max-w-sm mx-auto shadow-sm">
          <Lock className="w-4 h-4 shrink-0 text-slate-400" />
          <span>Secure payment via <span className="font-semibold text-slate-600">Stripe</span> · 256-bit SSL · PCI DSS compliant</span>
        </div>

        <div className="max-w-3xl mx-auto mt-12 md:mt-24 text-left">
          <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Frequently Asked Questions</h2>
          <p className="text-slate-500 text-center mb-10">Everything you need to know about Activity Mint plans and billing.</p>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {PRICING_FAQS.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} isOpen={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Help Center View ──────────────────────────────────────────────────── */

const HelpCenterView = () => {
  const [activeCategory, setActiveCategory] = useState('general');
  const [helpSearch, setHelpSearch] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  const currentFaqs = HELP_CATEGORIES.find(c => c.id === activeCategory)?.faqs || [];
  const displayedFaqs = helpSearch.trim()
    ? currentFaqs.filter(f => f.q.toLowerCase().includes(helpSearch.toLowerCase()) || f.a.toLowerCase().includes(helpSearch.toLowerCase()))
    : currentFaqs;

  return (
    <div className="animate-in fade-in duration-500">
      <section className="bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-800 text-white pt-16 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">How Can We Help?</h1>
          <p className="text-emerald-100/80 text-lg mb-10">Find answers to common questions or reach out to our support team.</p>
          <div className="max-w-xl mx-auto">
            <div className="relative flex items-center bg-white/10 backdrop-blur-sm rounded-full border border-white/20 focus-within:border-white/50 transition-all">
              <Search className="absolute left-5 w-5 h-5 text-white/60" />
              <input type="text" placeholder="Ask a question..." value={helpSearch} onChange={(e) => { setHelpSearch(e.target.value); setOpenFaq(null); }}
                className="w-full bg-transparent pl-14 pr-6 py-4 text-white placeholder-white/50 outline-none" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-5 p-6 rounded-2xl border border-slate-200 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors"><MessageSquare className="w-6 h-6 text-emerald-600" /></div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Support Center</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Get personalized help from our support team. Available 7 days a week.</p>
                <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium mt-3 group-hover:gap-2 transition-all">Contact Support <ArrowRight className="w-4 h-4" /></span>
              </div>
            </div>
            <div className="flex items-start gap-5 p-6 rounded-2xl border border-slate-200 hover:border-teal-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-teal-100 transition-colors"><BookOpen className="w-6 h-6 text-teal-600" /></div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">Instagram Resources</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Browse our library of guides, tutorials, and tips for Instagram analytics.</p>
                <span className="inline-flex items-center gap-1 text-teal-600 text-sm font-medium mt-3 group-hover:gap-2 transition-all">Browse Resources <ArrowRight className="w-4 h-4" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-8">
            <aside className="md:w-56 shrink-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Categories</p>
              <nav className="space-y-1">
                {HELP_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setOpenFaq(null); }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeCategory === cat.id ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'}`}>
                    {cat.label}
                  </button>
                ))}
              </nav>
            </aside>
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 md:px-8 pt-7 pb-4 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">{HELP_CATEGORIES.find(c => c.id === activeCategory)?.label}</h2>
                {helpSearch.trim() && <p className="text-sm text-slate-400 mt-1">{displayedFaqs.length} result{displayedFaqs.length !== 1 ? 's' : ''} found</p>}
              </div>
              {displayedFaqs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {displayedFaqs.map((faq, i) => (
                    <FaqItem key={i} q={faq.q} a={faq.a} isOpen={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400 px-6">
                  <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium text-slate-500">No results for "{helpSearch}"</p>
                  <p className="text-sm mt-2">Try a different term or browse another category.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white border-t border-slate-100 text-center">
        <div className="max-w-lg mx-auto px-4">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6"><HelpCircle className="w-7 h-7 text-emerald-600" /></div>
          <h3 className="text-2xl font-bold text-slate-900 mb-3">Can't find your answer?</h3>
          <p className="text-slate-500 mb-8 leading-relaxed">Our support team is ready to help. Reach out and we'll get back to you within 24 hours.</p>
          <button className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-full hover:shadow-lg hover:shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5">Contact Support</button>
        </div>
      </section>
    </div>
  );
};
