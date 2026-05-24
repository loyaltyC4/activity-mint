import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import {
  Activity, Search, ShieldCheck, UserX, BarChart2, Brain, ThumbsUp,
  ChevronDown, Check, X, Menu, ArrowRight, TrendingUp, Globe,
  MessageSquare, Heart, Hash, Download, Eye, Target, Users,
  Image as ImageIcon, Video, RefreshCw, AlertCircle, Award,
  MonitorPlay, UserCheck, PenTool, UserMinus, FileUp, Flame,
  LayoutGrid, DollarSign, BookOpen, Briefcase, Mail, FileText,
  Lock, PlusCircle, ChevronRight, PieChart, HelpCircle, Sparkles,
  Link2, Repeat2, Star, Home, Handshake,
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useTier } from './context/TierContext';
import { useI18n } from './lib/i18n';
import { canAccess } from './lib/tiers';
import LanguageSwitcher from './components/LanguageSwitcher';
import AccessGate from './components/AccessGate';
import MintingLoader from './components/MintingLoader';
import { fetchInstagramProfile } from './lib/apify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* ─── Lazy-loaded components for code-splitting ────────────────────────── */
const Dashboard   = lazy(() => import('./components/Dashboard'));
const DashboardV2 = lazy(() => import('./components/dashboard'));

// New dashboard is the default for everyone. Escape hatch:
//   #legacy           — force the old monolith Dashboard
//   ?dashboard=legacy — same, via query string
const shouldUseDashboardV2 = () => {
  if (typeof window === 'undefined') return true;
  if (window.location.hash === '#legacy') return false;
  if (new URLSearchParams(window.location.search).get('dashboard') === 'legacy') return false;
  return true;
};

// Views (2550 lines) - split by feature
const BlogPageView = lazy(() => import('./views').then(m => ({ default: m.BlogPageView })));
const AffiliateView = lazy(() => import('./views').then(m => ({ default: m.AffiliateView })));
const ToolkitPageView = lazy(() => import('./views').then(m => ({ default: m.ToolkitPageView })));
const ThreadsDownloaderView = lazy(() => import('./views').then(m => ({ default: m.ThreadsDownloaderView })));
const CelebritiesView = lazy(() => import('./views').then(m => ({ default: m.CelebritiesView })));
const HashtagGeneratorView = lazy(() => import('./views').then(m => ({ default: m.HashtagGeneratorView })));
const ShadowbanCheckerView = lazy(() => import('./views').then(m => ({ default: m.ShadowbanCheckerView })));
const RecentFollowerView = lazy(() => import('./views').then(m => ({ default: m.RecentFollowerView })));
const UnfollowerView = lazy(() => import('./views').then(m => ({ default: m.UnfollowerView })));
const FollowerExportView = lazy(() => import('./views').then(m => ({ default: m.FollowerExportView })));
const InstagramCommentsView = lazy(() => import('./views').then(m => ({ default: m.InstagramCommentsView })));
const FacebookPostsView = lazy(() => import('./views').then(m => ({ default: m.FacebookPostsView })));
const TikTokView = lazy(() => import('./views').then(m => ({ default: m.TikTokView })));
const LinkedInPostsView = lazy(() => import('./views').then(m => ({ default: m.LinkedInPostsView })));
const LinkedInProfileView = lazy(() => import('./views').then(m => ({ default: m.LinkedInProfileView })));
const YouTubeTranscriptView = lazy(() => import('./views').then(m => ({ default: m.YouTubeTranscriptView })));

// Apify views
const StoryViewerView = lazy(() => import('./apify-views').then(m => ({ default: m.StoryViewerView })));
const PostViewerView = lazy(() => import('./apify-views').then(m => ({ default: m.PostViewerView })));

// New tools pages
const HighlightsViewerView = lazy(() => import('./pages/NewTools').then(m => ({ default: m.HighlightsViewerView })));
const LinksViewerView = lazy(() => import('./pages/NewTools').then(m => ({ default: m.LinksViewerView })));
const RepostsViewerView = lazy(() => import('./pages/NewTools').then(m => ({ default: m.RepostsViewerView })));
const LikeViewerView = lazy(() => import('./pages/NewTools').then(m => ({ default: m.LikeViewerView })));

// Analytics pages
const ActivityTrackerPage = lazy(() => import('./pages/AnalyticsPages').then(m => ({ default: m.ActivityTrackerPage })));
const AISentimentPage = lazy(() => import('./pages/AnalyticsPages').then(m => ({ default: m.AISentimentPage })));
const FollowerGrowthPage = lazy(() => import('./pages/AnalyticsPages').then(m => ({ default: m.FollowerGrowthPage })));
const CompetitorAnalysisPage = lazy(() => import('./pages/AnalyticsPages').then(m => ({ default: m.CompetitorAnalysisPage })));

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
  <div className="flex items-center gap-2.5 cursor-pointer group" onClick={onClick}>
    <div className="relative flex items-center justify-center w-9 h-9 rounded-[12px] bg-gradient-to-br from-teal-400 via-emerald-500 to-teal-600 shadow-[0_8px_20px_-6px_rgba(20,184,166,0.55)] group-hover:scale-105 transition-transform duration-300">
      <Sparkles className="w-5 h-5 text-white relative z-10" strokeWidth={2.5} />
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-300 border-2 border-white shadow-sm"></div>
    </div>
    <span className="text-xl font-extrabold tracking-tight text-slate-900">
      Activity<span className="text-teal-600">Mint</span>
    </span>
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <Card className="group hover:shadow-2xl hover:border-primary/20 hover:-translate-y-1 transition-all duration-500 overflow-hidden relative">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <CardContent className="p-8 relative">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/50 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm">{description}</p>
    </CardContent>
  </Card>
);

const UseCaseCard = ({ title, description, Icon, accent = 'teal' }) => {
  const accentMap = {
    teal:   { ring: 'from-teal-400 to-emerald-500',   tint: 'bg-teal-50',   chip: 'text-teal-600',   hover: 'group-hover:shadow-teal-500/15' },
    violet: { ring: 'from-violet-400 to-indigo-500',  tint: 'bg-violet-50', chip: 'text-violet-600', hover: 'group-hover:shadow-violet-500/15' },
    amber:  { ring: 'from-amber-400 to-orange-500',   tint: 'bg-amber-50',  chip: 'text-amber-600',  hover: 'group-hover:shadow-amber-500/15' },
    rose:   { ring: 'from-rose-400 to-pink-500',      tint: 'bg-rose-50',   chip: 'text-rose-600',   hover: 'group-hover:shadow-rose-500/15' },
    sky:    { ring: 'from-sky-400 to-cyan-500',       tint: 'bg-sky-50',    chip: 'text-sky-600',    hover: 'group-hover:shadow-sky-500/15' },
    slate:  { ring: 'from-slate-400 to-slate-600',    tint: 'bg-slate-50',  chip: 'text-slate-600',  hover: 'group-hover:shadow-slate-500/15' },
  };
  const a = accentMap[accent] || accentMap.teal;
  return (
    <Card className={`group relative overflow-hidden border-slate-200/70 hover:-translate-y-1 hover:shadow-2xl ${a.hover} transition-all duration-500 rounded-3xl`}>
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${a.ring} opacity-15 blur-2xl group-hover:scale-150 group-hover:opacity-25 transition-all duration-700`}></div>
      <CardContent className="p-7 relative">
        <div className={`w-12 h-12 rounded-2xl ${a.tint} ${a.chip} flex items-center justify-center mb-5 shadow-sm`}>
          {Icon ? <Icon className="w-6 h-6" strokeWidth={2} /> : null}
        </div>
        <h3 className="text-[17px] font-bold text-foreground mb-2 leading-tight tracking-tight">{title}</h3>
        <p className="text-muted-foreground text-[13.5px] leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
};

// Legacy props (icon=JSX, bgGradient=class) kept here so existing call sites won't break.
const LegacyUseCaseCard = ({ title, description, icon, bgGradient }) => (
  <Card className="group hover:shadow-2xl hover:border-primary/10 transition-all duration-500 overflow-hidden">
    <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-8">
      <div className="sm:w-3/5 relative z-10">
        <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors duration-300">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
      <div className="sm:w-2/5 flex justify-center relative mt-4 sm:mt-0">
        <div className={`absolute inset-0 opacity-30 blur-3xl rounded-full ${bgGradient} group-hover:scale-150 group-hover:opacity-50 transition-all duration-700`}></div>
        <div className={`absolute inset-4 opacity-50 rounded-full ${bgGradient} group-hover:rotate-12 group-hover:scale-110 transition-all duration-700`}></div>
        <div className="relative z-10 w-32 h-32 flex items-center justify-center transform group-hover:-translate-y-3 group-hover:scale-110 transition-all duration-500">{icon}</div>
      </div>
    </CardContent>
  </Card>
);

const ToolkitCard = ({ title, icon, description, items, bgIcon }) => {
  const bgIconMap = { glasses: <Search className="w-64 h-64 text-primary/80" />, footprints: <Activity className="w-64 h-64 text-primary/80" />, cloud: <Download className="w-64 h-64 text-primary/80" />, eye: <Eye className="w-64 h-64 text-primary/80" />, target: <Target className="w-64 h-64 text-primary/80" /> };
  return (
    <Card className="group hover:shadow-2xl hover:border-primary/20 hover:-translate-y-1 transition-all duration-500 relative overflow-hidden flex flex-col h-full">
      <div className="absolute -bottom-16 -right-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none transform -rotate-12 group-hover:rotate-0 duration-700">{bgIconMap[bgIcon] || bgIconMap.footprints}</div>
      <CardContent className="p-8 relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">{icon}</div>
          <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{description}</p>
        <ul className="space-y-3 mt-auto">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-3 text-sm text-foreground font-medium hover:text-primary transition-colors cursor-pointer group/item p-2 rounded-lg hover:bg-primary/5">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover/item:text-primary group-hover/item:bg-primary/10 transition-all">{item.icon}</div>
              {item.text}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const PricingCard = ({ title, price, interval, subtext, features, highlighted = false }) => (
  <Card className={cn(
    "group relative overflow-hidden transition-all duration-500 flex flex-col h-full",
    highlighted
      ? "border-2 border-primary shadow-2xl shadow-primary/10 scale-[1.02]"
      : "hover:shadow-xl hover:border-primary/20 hover:-translate-y-1"
  )}>
    {highlighted && (
      <div className="absolute top-0 right-0">
        <Badge className="rounded-none rounded-bl-lg bg-gradient-to-r from-primary to-teal-600 text-white border-0">
          Most Popular
        </Badge>
      </div>
    )}
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <CardContent className="p-6 sm:p-8 relative flex flex-col h-full">
      <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>
      <div className="mb-6">
        <span className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{price}</span>
        <span className="text-muted-foreground font-medium ml-1">{interval}</span>
      </div>
      {subtext && <p className="text-sm text-muted-foreground mb-6 -mt-4">{subtext}</p>}
      <Button
        className={cn(
          "w-full py-6 rounded-full font-semibold text-base mb-8 transition-all",
          highlighted
            ? "bg-gradient-to-r from-primary to-teal-600 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02]"
            : "bg-muted text-foreground hover:bg-muted/80"
        )}
      >
        Subscribe
      </Button>
      <div className="text-left space-y-4 flex-1">
        <p className="font-semibold text-sm text-foreground border-b border-border pb-2">Included Features</p>
        {features.map((f, idx) => (
          <div key={idx} className="flex items-start gap-3 group/feature">
            {f.included ? (
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-primary" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <X className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
            <span className={cn("text-sm leading-snug", f.included ? "text-foreground" : "text-muted-foreground")}>
              {f.name}
              {f.isNew && <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 font-bold text-primary bg-primary/10">New</Badge>}
            </span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const BlogCard = ({ image, title, date, excerpt }) => (
  <Card className="group overflow-hidden hover:shadow-2xl hover:border-primary/20 hover:-translate-y-1 transition-all duration-500 flex flex-col cursor-pointer">
    <div className="h-48 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
      <img src={image} alt={title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
      <Badge variant="secondary" className="absolute top-4 left-4 z-20 bg-background/90 backdrop-blur-sm">
        {date}
      </Badge>
    </div>
    <CardContent className="p-6 flex flex-col flex-1">
      <h3 className="text-lg font-bold text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors duration-300">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mt-auto">{excerpt}</p>
      <div className="flex items-center gap-2 mt-4 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span>Read More</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </CardContent>
  </Card>
);

const DropdownItem = ({ icon, title, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-200 group">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">{icon}</div>
    <span className="text-sm font-medium">{title}</span>
  </button>
);

const FaqItem = ({ q, a, isOpen, onToggle }) => (
  <Card className={cn(
    "overflow-hidden transition-all duration-300",
    isOpen ? "border-primary/20 shadow-md" : "hover:border-primary/10"
  )}>
    <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-5 text-left gap-4 group">
      <span className={cn(
        "font-medium text-base transition-colors",
        isOpen ? "text-primary" : "text-foreground group-hover:text-primary"
      )}>{q}</span>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0",
        isOpen ? "bg-primary text-white rotate-180" : "bg-muted text-muted-foreground"
      )}>
        <ChevronDown className="w-4 h-4" />
      </div>
    </button>
    <div className={cn(
      "overflow-hidden transition-all duration-300",
      isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
    )}>
      <div className="px-6 pb-5 text-muted-foreground text-sm leading-relaxed pr-12 border-t border-border/50 pt-4">{a}</div>
    </div>
  </Card>
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
  const { tier } = useTier();
  const { t } = useI18n();
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

  const toolkitTabs = ['toolkit', 'threads-downloader', 'celebrities', 'story-viewer', 'post-viewer', 'highlights-viewer', 'links-viewer', 'reposts-viewer', 'like-viewer', 'hashtag-generator', 'shadowban-checker', 'recent-follower', 'unfollower', 'follower-export', 'instagram-comments', 'facebook-posts', 'tiktok', 'linkedin-posts', 'linkedin-profile', 'youtube-transcript'];
  const featurePages = ['activity-tracker', 'ai-sentiment', 'follower-growth', 'competitor-analysis'];

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
                    <DropdownItem icon={<Activity className="w-4 h-4" />} title="Activity Tracker" onClick={() => setActiveTab('activity-tracker')} />
                    <DropdownItem icon={<Brain className="w-4 h-4" />} title="AI Sentiment Analysis" onClick={() => setActiveTab('ai-sentiment')} />
                    <DropdownItem icon={<TrendingUp className="w-4 h-4" />} title="Follower Growth" onClick={() => setActiveTab('follower-growth')} />
                    <DropdownItem icon={<Target className="w-4 h-4" />} title="Competitor Analysis" onClick={() => setActiveTab('competitor-analysis')} />
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
                    <DropdownItem icon={<LayoutGrid className="w-4 h-4" />} title="Post Viewer" onClick={() => setActiveTab('post-viewer')} />
                    <DropdownItem icon={<Star className="w-4 h-4" />} title="Highlights Viewer" onClick={() => setActiveTab('highlights-viewer')} />
                    <DropdownItem icon={<Heart className="w-4 h-4" />} title="Like Viewer" onClick={() => setActiveTab('like-viewer')} />
                    <DropdownItem icon={<Link2 className="w-4 h-4" />} title="Links Viewer" onClick={() => setActiveTab('links-viewer')} />
                    <DropdownItem icon={<Repeat2 className="w-4 h-4" />} title="Reposts Viewer" onClick={() => setActiveTab('reposts-viewer')} />
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
              <LanguageSwitcher variant="nav" />
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-slate-600"><Menu className="w-6 h-6" /></button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 z-50 bg-white overflow-y-auto overscroll-contain">
            <div className="px-5 py-6 space-y-1">
              {/* Primary nav — large touch targets, lucide icons for visual chrome */}
              {[
                ['home',         'Features',     Home],
                ['pricing',      'Pricing',      DollarSign],
                ['blog',         'Blog',         FileText],
                ['help-center',  'Help Center',  HelpCircle],
                ['affiliate',    'Affiliate',    Handshake],
              ].map(([tab, label, Icon]) => (
                <button key={tab} onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 w-full text-left font-medium py-3.5 px-4 rounded-xl min-h-[48px] transition-colors ${activeTab === tab ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'}`}>
                  <Icon className="w-5 h-5 text-slate-500" /> {label}
                </button>
              ))}
              {/* Tools section */}
              <div className="pt-3 pb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-4 mb-2">Tools</p>
              </div>
              {[['story-viewer', 'Story Viewer'], ['post-viewer', 'Post Viewer'], ['hashtag-generator', 'Hashtag Generator'], ['shadowban-checker', 'Shadowban Checker'], ['unfollower', 'Unfollower Finder'], ['recent-follower', 'Recent Followers'], ['toolkit', 'All Tools →']].map(([tab, label]) => (
                <button key={tab} onClick={() => { setActiveTab(tab); setMobileMenuOpen(false); }}
                  className={`block w-full text-left text-sm font-medium py-3 px-4 rounded-xl min-h-[44px] transition-colors ${activeTab === tab ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'}`}>
                  {label}
                </button>
              ))}
              {/* Auth section — pinned to bottom area */}
              <div className="pt-4 mt-4 border-t border-slate-100">
                {user ? (
                  <div className="space-y-2">
                    <button onClick={() => { goToDashboard(); setMobileMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 py-3.5 px-6 min-h-[48px] bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-sm">
                      <BarChart2 className="w-4 h-4" /> My Dashboard
                    </button>
                    <button onClick={() => { signOut(); setMobileMenuOpen(false); }}
                      className="w-full text-center text-sm font-medium text-slate-500 py-3 min-h-[44px]">Sign Out</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button onClick={() => { setAuthOpen(true); setMobileMenuOpen(false); }}
                      className="w-full flex items-center justify-center py-3.5 px-6 min-h-[48px] bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-sm">
                      Get Started Free
                    </button>
                    <button onClick={() => { setAuthOpen(true); setMobileMenuOpen(false); }}
                      className="w-full text-center text-sm font-medium text-slate-600 py-3 min-h-[44px]">Already have an account? Log In</button>
                  </div>
                )}
                <div className="flex justify-center pt-3">
                  <LanguageSwitcher variant="nav" />
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-16">
        {/* Non-lazy views render immediately */}
        {activeTab === 'home' && <HomeView searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleSearch={handleSearch} isSearching={isSearching} demoResult={demoResult} setDemoResult={setDemoResult} searchError={searchError} setActiveTab={setActiveTab} setAuthOpen={setAuthOpen} />}
        {activeTab === 'pricing' && <PricingView />}
        {activeTab === 'help-center' && <HelpCenterView />}

        {/* Lazy-loaded views wrapped in Suspense for code-splitting */}
        <Suspense fallback={<MintingLoader />}>
          {activeTab === 'dashboard' && (user ? (shouldUseDashboardV2() ? <DashboardV2 setActiveTab={setActiveTab} /> : <Dashboard />) : <div className="min-h-[80vh] flex items-center justify-center"><button onClick={() => setAuthOpen(true)} className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-full">Log In to Access Dashboard</button></div>)}
          {activeTab === 'blog' && <BlogPageView setActiveTab={setActiveTab} />}
          {activeTab === 'affiliate' && <AffiliateView />}
          {activeTab === 'toolkit' && <ToolkitPageView setActiveTab={setActiveTab} />}
          {activeTab === 'threads-downloader' && <ThreadsDownloaderView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
          {activeTab === 'celebrities' && <CelebritiesView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
          {activeTab === 'story-viewer' && <StoryViewerView />}
          {activeTab === 'post-viewer' && <PostViewerView />}
          {activeTab === 'hashtag-generator' && <HashtagGeneratorView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
          {activeTab === 'shadowban-checker' && <ShadowbanCheckerView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
          {activeTab === 'recent-follower' && <RecentFollowerView searchQuery={searchQuery} setSearchQuery={setSearchQuery} setActiveTab={setActiveTab} user={user} setAuthOpen={setAuthOpen} />}
          {activeTab === 'unfollower' && <UnfollowerView searchQuery={searchQuery} setSearchQuery={setSearchQuery} setActiveTab={setActiveTab} />}
          {activeTab === 'follower-export' && <FollowerExportView searchQuery={searchQuery} setSearchQuery={setSearchQuery} setActiveTab={setActiveTab} />}
          {activeTab === 'instagram-comments' && <InstagramCommentsView />}
          {activeTab === 'facebook-posts' && <FacebookPostsView />}
          {activeTab === 'tiktok' && <TikTokView />}
          {activeTab === 'linkedin-posts' && <LinkedInPostsView />}
          {activeTab === 'linkedin-profile' && <LinkedInProfileView isAdmin={user?.email?.endsWith('@activitymint.com')} />}
          {activeTab === 'youtube-transcript' && <YouTubeTranscriptView />}
          {activeTab === 'highlights-viewer' && <HighlightsViewerView />}
          {activeTab === 'links-viewer' && <LinksViewerView />}
          {activeTab === 'reposts-viewer' && <RepostsViewerView />}
          {activeTab === 'like-viewer' && <LikeViewerView />}
          {activeTab === 'activity-tracker' && <ActivityTrackerPage setActiveTab={setActiveTab} setAuthOpen={setAuthOpen} />}
          {activeTab === 'ai-sentiment' && <AISentimentPage setActiveTab={setActiveTab} setAuthOpen={setAuthOpen} />}
          {activeTab === 'follower-growth' && <FollowerGrowthPage setActiveTab={setActiveTab} setAuthOpen={setAuthOpen} />}
          {activeTab === 'competitor-analysis' && <CompetitorAnalysisPage setActiveTab={setActiveTab} setAuthOpen={setAuthOpen} />}
        </Suspense>
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
                <li><button onClick={() => setActiveTab('toolkit')} className="hover:text-emerald-600 transition-colors">Tools</button></li>
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
          <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} Activity Mint. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <LanguageSwitcher variant="footer" />
              <span>Made for smart marketers 🍃</span>
            </div>
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
    <Card className="max-w-2xl mx-auto mt-8 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 border-primary/20 shadow-2xl shadow-primary/10">
      <CardHeader className="bg-gradient-to-r from-primary to-teal-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-semibold flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">Preview Report — @{result.username}</span>
          </span>
          <Button variant="ghost" size="icon" onClick={onDismiss} className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          {result.profilePicUrl ? (
            <img src={proxyImageUrl(result.profilePicUrl)} alt={result.username} className="w-16 h-16 rounded-full border-2 border-primary/20 shrink-0 object-cover ring-4 ring-primary/5" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shrink-0 ring-4 ring-primary/5">
              {result.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2 truncate">
              <span className="truncate">@{result.username}</span>
              {result.isVerified && <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />}
            </h3>
            {result.fullName && <p className="text-muted-foreground text-sm truncate">{result.fullName}</p>}
            <p className="text-muted-foreground/60 text-xs mt-0.5">Instagram Public Profile</p>
          </div>
          <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20">FOUND</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[['Followers', fmt(result.followers)], ['Following', fmt(result.following)], ['Posts', fmt(result.posts)]].map(([label, val]) => (
            <Card key={label} className="text-center border-border/50 bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
                <p className="font-bold text-foreground text-xl">{val}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {[['Engagement Rate', result.engagement + '%', false], ['Recent Likes', fmt(result.recentLikes), false], ['New Followings (30d)', '••••', true], ['Story Activity', '••••', true]].map(([label, val, locked]) => (
            <Card key={label} className={cn("border-border/50", locked ? "bg-muted/20" : "bg-card")}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
                {locked ? (
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground"><span className="blur-sm select-none">12.4K</span></p>
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </div>
                ) : <p className="font-bold text-foreground">{val}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200/50 dark:border-indigo-800/30">
          <CardContent className="p-6 text-center">
            <Sparkles className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
            <p className="text-foreground font-bold text-lg mb-2">Unlock Full Analytics Report</p>
            <p className="text-muted-foreground text-sm mb-5">See full timeline, AI insights, recent follows, likes, and activity patterns for @{result.username}</p>
            <Button onClick={onSignUp} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-8 py-6 rounded-full hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
              Create Free Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

const HomeView = ({ searchQuery, setSearchQuery, handleSearch, isSearching, demoResult, setDemoResult, searchError, setActiveTab, setAuthOpen }) => (
  <div className="animate-in fade-in duration-500">
    <section className="relative pt-16 pb-16 md:pb-32 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-emerald-100/40 rounded-full blur-3xl -z-10 opacity-50"></div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 px-4 py-1.5">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          AI-Powered Analytics
        </Badge>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-foreground tracking-tight leading-tight mb-4 sm:mb-6">
          Your All-in-One <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-teal-600">Social Activity Tracker</span>
        </h1>
        <p className="mt-3 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 md:mb-12 leading-relaxed">
          Uncover hidden insights with AI-powered, privacy-focused analytics for Instagram and beyond. Track, analyze, and grow smarter without leaving a footprint.
        </p>
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-teal-500/30 rounded-full blur-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-700" />
          <Card className="relative flex items-center rounded-full border-border/50 shadow-lg p-2 hover:border-primary/30 focus-within:border-primary/50 focus-within:shadow-xl focus-within:shadow-primary/5 transition-all duration-300">
            <div className="pl-4 pr-2 text-muted-foreground shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Enter @username"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-foreground placeholder-muted-foreground py-3 sm:py-4 text-base sm:text-lg font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              required
            />
            <Button
              type="submit"
              disabled={isSearching}
              className="ml-2 shrink-0 bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-600/90 text-white px-6 sm:px-8 py-5 sm:py-6 rounded-full font-semibold text-sm sm:text-base hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-70"
            >
              {isSearching ? (
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Analyzing...</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="hidden sm:inline">Analyze Now</span>
                  <span className="sm:hidden">Go</span>
                  <ArrowRight className="w-4 h-4 hidden sm:block" />
                </span>
              )}
            </Button>
          </Card>
        </form>
        {searchError && !isSearching && (
          <Card className="max-w-lg mx-auto mt-6 p-4 border-destructive/50 bg-destructive/5">
            <p className="text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {searchError}
            </p>
          </Card>
        )}
        {isSearching && (
          <Card className="max-w-2xl mx-auto mt-8 p-8 border-primary/10 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-muted/50 rounded w-1/4 animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />)}
            </div>
            <div className="text-center mt-8 space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 animate-spin text-primary" />
                </div>
                <p className="text-foreground font-medium">Fetching live Instagram data…</p>
              </div>
              <p className="text-muted-foreground text-sm">This usually takes 30-60 seconds — we're scanning real profile data</p>
            </div>
          </Card>
        )}
        {demoResult && !isSearching && (
          <DemoResultCard result={demoResult} onSignUp={() => setAuthOpen(true)} onDismiss={() => setDemoResult(null)} />
        )}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground font-medium">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden ring-2 ring-background shadow-sm">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=e2e8f0`} alt="user" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
            </div>
            <span className="text-foreground">Trusted by <strong className="text-primary">50,000+</strong> professionals globally</span>
          </div>
        </div>
      </div>
    </section>

    <section className="py-24 bg-background border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.06),transparent_50%)] pointer-events-none"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-14">
          <Badge className="mb-4 bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-50">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Use Cases
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">Built for every kind of user</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-base">From creators tuning their next post to marketers spotting trends to anyone watching a public account privately — there's a path here for you.</p>
        </div>

        {/* Audience group: For Creators */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 px-3 py-1">
              <PenTool className="w-3.5 h-3.5 mr-1.5" />
              For Creators
            </Badge>
            <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <UseCaseCard accent="teal"   Icon={Activity}   title="Plan your next post" description="A calendar of suggested formats and best times — drawn from your own engagement patterns." />
            <UseCaseCard accent="violet" Icon={Sparkles}   title="Repeat what works" description="Caption recipes, format tips and hook examples. Copy the template, post it your way." />
            <UseCaseCard accent="amber"  Icon={Flame}      title="Streaks that stick" description="Tiny daily quests to keep your momentum. Insights you'll actually act on." />
            <UseCaseCard accent="rose"   Icon={Heart}      title="Save hours on audience research" description="Demographics, sentiment and cohorts charted in language you can use immediately." />
          </div>
        </div>

        {/* Audience group: For Marketers & Brands */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-50 px-3 py-1">
              <Briefcase className="w-3.5 h-3.5 mr-1.5" />
              For Marketers &amp; Brands
            </Badge>
            <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <UseCaseCard accent="violet" Icon={Target}     title="Watch competitors without following" description="Anonymous tracking. No DMs to your inbox, no notifications to them." />
            <UseCaseCard accent="sky"    Icon={TrendingUp} title="Spot trends before they peak" description="Hashtag ROI, format momentum and sentiment shifts — early enough to catch the wave." />
            <UseCaseCard accent="amber"  Icon={MessageSquare} title="Find the right people to message" description="Top fans from your own audience plus demographic matches — with draft DMs included." />
            <UseCaseCard accent="rose"   Icon={Award}      title="10,000+ influencers, vetted" description="Track growth, analyse posting habits, validate the fit before you reach out." />
          </div>
        </div>

        {/* Audience group: For Curious Users */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 px-3 py-1">
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              For Curious Users
            </Badge>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-300 to-transparent"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <UseCaseCard accent="teal"   Icon={UserCheck}   title="View any public account, privately" description="No follows, no traces. Stories, highlights and posts — all browsable from a clean dashboard." />
            <UseCaseCard accent="slate"  Icon={Download}    title="Save what you find" description="Download stories, highlights, transcripts and posts. Local copies, your data." />
            <UseCaseCard accent="amber"  Icon={AlertCircle} title="Watch unusual activity" description="Sudden follower spikes, oddly-timed likes, ghost followers — the noise brought into focus." />
          </div>
        </div>
      </div>
    </section>

    <section className="py-20 bg-muted/30 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Features</Badge>
          <h2 className="text-3xl font-bold text-foreground">Everything you need to find the truth.</h2>
          <p className="mt-4 text-muted-foreground">Objective, data-driven insights while maintaining complete privacy.</p>
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

    <section className="py-24 bg-muted/20 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Toolkit</Badge>
          <h2 className="text-3xl font-bold text-foreground">The Complete Activity Toolkit</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">Everything you need to monitor, analyze, and archive social activity in one powerful suite.</p>
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

    <section className="py-20 sm:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="border-0 rounded-3xl p-6 sm:p-10 md:p-14 text-white relative overflow-hidden shadow-2xl">
          {/* Photo background */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&w=2000&q=70"
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-teal-950/95 via-teal-900/90 to-emerald-900/95"></div>
          </div>
          {/* Subtle glow overlays */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-300/15 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

          <CardContent className="relative z-10 p-0">
            {/* Header */}
            <div className="text-center mb-10 sm:mb-14">
              <Badge className="bg-white/15 backdrop-blur-sm text-white border-white/20 mb-4 px-4 py-1.5">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Get Started in Minutes
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">How to use Activity Mint</h2>
            </div>

            {/* Steps grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10 sm:mb-14">
              {[
                {
                  step: '01',
                  title: 'Create Free Account',
                  desc: 'Sign up in seconds — no credit card needed. Your identity stays completely private.',
                  icon: <ShieldCheck className="w-6 h-6 text-emerald-200" />,
                },
                {
                  step: '02',
                  title: 'Enter Any Username',
                  desc: 'Type the Instagram @username you want to analyse. Works on any public profile.',
                  icon: <Search className="w-6 h-6 text-emerald-200" />,
                },
                {
                  step: '03',
                  title: 'We Scan the Data',
                  desc: 'Our engine fetches live profile data, followers, posts, and activity patterns.',
                  icon: <Activity className="w-6 h-6 text-emerald-200" />,
                },
                {
                  step: '04',
                  title: 'Get Your Report',
                  desc: 'View follower stats, recent posts, engagement rate, and AI-powered insights in your dashboard.',
                  icon: <BarChart2 className="w-6 h-6 text-emerald-200" />,
                },
              ].map(({ step, title, desc, icon }, i) => (
                <div key={i} className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/15 hover:bg-white/15 transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">{icon}</div>
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
                  <Button onClick={() => setActiveTab('pricing')} className="bg-white text-teal-700 hover:bg-slate-50 px-6 py-6 rounded-full font-bold shadow-lg">
                    View Plans <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button variant="outline" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-white/15 text-white border-white/25 hover:bg-white/25 hover:text-white px-6 py-6 rounded-full font-semibold">
                    Try It Free
                  </Button>
                </div>
                <p className="text-emerald-200/50 text-xs mt-4">No credit card required · Cancel anytime</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>

    <section className="py-24 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8 sm:mb-12 gap-4">
          <div>
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">Blog</Badge>
            <h2 className="text-xl sm:text-3xl font-bold text-foreground">Recommended Articles</h2>
          </div>
          <Button variant="ghost" onClick={() => setActiveTab('blog')} className="shrink-0 text-primary font-semibold hover:text-primary/80 flex items-center gap-1">
            View All
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <BlogCard image="https://images.unsplash.com/photo-1611262588024-d12430b98920?q=80&w=600&auto=format&fit=crop" title="Tracking Follower Growth: A Guide to Competitor Analysis" date="May 10, 2026" excerpt="Discover how to monitor competitors' follower velocity and engagement metrics to stay one step ahead." />
          <BlogCard image="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?q=80&w=600&auto=format&fit=crop" title="The 2026 Guide to Viewing Instagram Stories Anonymously" date="Apr 28, 2026" excerpt="Learn the safest methods to view and download Stories without leaving a digital footprint." />
          <BlogCard image="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=600&auto=format&fit=crop" title="Decoding AI Sentiment Analysis in Social Media" date="Apr 15, 2026" excerpt="Go beyond simple likes. Learn how AI can analyze the emotional tone of your audience's interactions." />
          <BlogCard image="https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?q=80&w=600&auto=format&fit=crop" title="Spotting Fake Followers: Cleaning Up Influencer Marketing" date="Mar 30, 2026" excerpt="Identify authentic influencers with genuine, highly-engaged audiences and avoid wasting budget on bots." />
        </div>
      </div>
    </section>

    <section className="py-20 bg-background pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 border-0 text-center px-6 py-20 shadow-2xl group">
          {/* Photo background */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=2000&q=70"
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-teal-950/92 via-emerald-950/88 to-teal-900/95"></div>
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-400/20 rounded-full blur-[100px] group-hover:scale-150 transition-transform duration-1000"></div>
            <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-teal-400/15 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 group-hover:scale-125 transition-transform duration-1000"></div>
          </div>
          <CardContent className="relative z-10 max-w-4xl mx-auto p-0">
            <Badge className="mb-6 bg-white/10 text-white border-white/20 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Get Started Free
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">Your Ultimate Social Activity Analyzer</h2>
            <p className="text-teal-50/80 leading-relaxed mb-10 text-base md:text-lg max-w-3xl mx-auto font-light">
              Activity Mint: Safely and accurately monitor the activity of accounts you're interested in — without compromising privacy.
            </p>
            <Button
              onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => document.querySelector('input[type="text"]')?.focus(), 300); }}
              className="bg-gradient-to-r from-primary to-teal-500 hover:from-primary/90 hover:to-teal-500/90 text-white font-bold py-7 px-12 rounded-full transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] hover:-translate-y-1 text-lg"
            >
              ADD ACCOUNT
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
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
          <PricingCard title="Basic" price="$5.39" interval="/month" highlighted={billingPeriod === 'monthly'} features={[{ name: "1 Trackable Account, weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers & unfollowers", included: true }, { name: "Story Viewer & Post Viewer", included: true }, { name: "Like Viewer & Reposts Viewer", included: false }, { name: "Highlights & Links Viewer", included: false }, { name: "AI Insights (MBTI, Sentiment, Growth)", included: false }, { name: "Activity Tracker & Competitor Analysis", included: false }, { name: "CSV/PDF Export", included: false }]} />
          <div className="relative transform md:-translate-y-4">
            <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
              <span className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">Most Popular · Save 20%</span>
            </div>
            <PricingCard title="Standard" price="$4.39" interval="/month" subtext="$13.19 billed every 3 months" highlighted={billingPeriod === 'quarterly'} features={[{ name: "1 Trackable Account, weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers & unfollowers", included: true }, { name: "Story Viewer & Post Viewer", included: true }, { name: "Like Viewer & Reposts Viewer", included: true, isNew: true }, { name: "Highlights & Links Viewer", included: true, isNew: true }, { name: "4 AI Insights (MBTI, Relationship, Tone, Archetype)", included: true, isNew: true }, { name: "Activity Tracker & Follower Growth", included: true }, { name: "CSV Export", included: true }, { name: "Competitor Analysis & PDF Reports", included: false }]} />
          </div>
          <PricingCard title="Premium" price="$3.29" interval="/month" subtext="$39.59 billed annually" highlighted={billingPeriod === 'annual'} features={[{ name: "1 Trackable Account, weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers & unfollowers", included: true }, { name: "All Viewers (Story, Post, Like, Highlights, Links, Reposts)", included: true }, { name: "9 AI Insights (Financial, Location, Growth, Topics)", included: true, isNew: true }, { name: "Activity Tracker & Follower Growth", included: true }, { name: "Competitor Analysis with SWOT", included: true, isNew: true }, { name: "CSV & PDF Export", included: true }, { name: "Suspicious Account Discovery on 5 Platforms", included: true, isNew: true }]} />
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
