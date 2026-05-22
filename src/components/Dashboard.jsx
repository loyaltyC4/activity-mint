import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, BarChart2, Brain, Users, Heart, Eye, Target,
  MonitorPlay, UserCheck, UserMinus, TrendingUp, Image as ImageIcon,
  Lock, ChevronDown, PlusCircle, X, Search, ArrowRight,
  Sparkles, MessageSquare, Link2, Repeat2, Star, Clock,
  Calendar, AlertCircle, ThumbsUp, Globe, FileText, Download,
  ChevronRight, RefreshCw, Flame, Hash, LayoutGrid, MapPin,
  Smile, Tag, Zap, Award, User, Coffee, Camera,
  Crown, Trophy, Layers, PenTool, ShieldAlert,
  ShieldCheck, AlertTriangle, EyeOff, HeartHandshake, CircleDot,
  Mail, Bell, Shield, Copy, Printer, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTier } from '../context/TierContext';
import { useI18n } from '../lib/i18n.jsx';
import { supabase } from '../lib/supabase';
import { canAccess } from '../lib/tiers';
import AccessGate from './AccessGate';
import {
  fetchInstagramProfile,
  fetchInstagramProfileWithPosts,
  fetchInstagramStories,
  fetchFollowersList,
} from '../lib/apify';
import { saveSnapshotDB, getSnapshotsDB, migrateLocalSnapshots, saveSnapshotLocal } from '../lib/tracking';
import { getCompetitors, addCompetitor, removeCompetitor, saveCompetitorSnapshot } from '../lib/competitors';
import { getDigestPreferences, upsertDigestPreferences } from '../lib/digest';
import AudienceInsights from './AudienceInsights';

/* ─── shadcn/ui components ──────────────────────────────────────────────── */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/* ─── helpers ───────────────────────────────────────────────────────────── */
const fmt = (n) => {
  if (n === null || n === undefined) return '--';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};
const pct = (n) => (n === null || n === undefined) ? '--' : n.toFixed(1) + '%';
const proxyImg = (url) => {
  if (!url) return null;
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('scontent'))
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  return url;
};
const ago = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/* ─── Stat card (shadcn enhanced) ───────────────────────────────────────── */
const colorVariants = {
  indigo: 'bg-indigo-500/10 text-indigo-600 border-indigo-100',
  emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-100',
  purple: 'bg-purple-500/10 text-purple-600 border-purple-100',
  rose: 'bg-rose-500/10 text-rose-600 border-rose-100',
  amber: 'bg-amber-500/10 text-amber-600 border-amber-100',
  teal: 'bg-teal-500/10 text-teal-600 border-teal-100',
  blue: 'bg-blue-500/10 text-blue-600 border-blue-100',
  violet: 'bg-violet-500/10 text-violet-600 border-violet-100',
};

const StatCard = ({ icon, label, value, sub, trend, color = 'indigo', tooltip }) => {
  const content = (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-primary/20">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border transition-colors", colorVariants[color])}>
            {icon}
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <div className="flex items-center gap-2 mt-2 min-h-[20px]">
          {trend !== undefined && (
            <Badge variant="secondary" className={cn("gap-1 font-semibold text-xs", trend >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
              {Math.abs(trend)}%
            </Badge>
          )}
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return content;
};

/* ─── Section header (shadcn enhanced) ──────────────────────────────────── */
const SectionHeader = ({ icon, title, badge, description, children }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      {icon && (
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          {React.cloneElement(icon, { className: 'w-4 h-4 text-primary' })}
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-foreground text-base sm:text-lg tracking-tight">{title}</h3>
          {badge && (
            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
              {badge}
            </Badge>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    {children && <div className="flex items-center gap-2">{children}</div>}
  </div>
);

/* ─── Minting Loader ───────────────────────────────────────────────────── */
const MINT_STEPS = [
  'Fetching profile data...',
  'Loading recent posts...',
  'Analyzing engagement...',
  'Scanning followers...',
  'Building insights...',
];
const MintingLoader = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setStep(s => (s + 1) % MINT_STEPS.length), 2200);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[60vh]">
      <style>{`
        @keyframes mintFloat { 0%,100%{transform:translateY(0) scale(1);opacity:.7} 50%{transform:translateY(-28px) scale(1.15);opacity:1} }
        @keyframes mintDot { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
        .mint-bubble { animation: mintFloat 2.4s ease-in-out infinite; }
        .mint-dot { animation: mintDot 1.4s ease-in-out infinite; }
      `}</style>
      <div className="flex gap-3 mb-6">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="mint-bubble rounded-full"
            style={{
              width: [18,26,20,24,16][i], height: [18,26,20,24,16][i],
              background: `linear-gradient(135deg, ${['#818cf8','#6366f1','#a78bfa','#7c3aed','#c084fc'][i]}, ${['#6366f1','#4f46e5','#7c3aed','#5b21b6','#a855f7'][i]})`,
              animationDelay: `${i * 0.35}s`,
            }}
          />
        ))}
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Minting<span className="inline-flex ml-1">{[0,1,2].map(i => (
          <span key={i} className="mint-dot text-indigo-500 text-3xl leading-none" style={{ animationDelay: `${i * 0.3}s` }}>.</span>
        ))}</span>
      </h2>
      <p className="text-sm text-muted-foreground h-5 transition-opacity duration-500">{MINT_STEPS[step]}</p>
    </div>
  );
};

/* ─── Account Health Score ─────────────────────────────────────────────── */
function calcHealthScore(profile, posts, avgEngagement) {
  if (!profile) return { grade: '--', score: 0, color: 'slate' };
  const fc = profile.followersCount || 0;
  // ER benchmark by tier
  let benchmark = 6;
  if (fc >= 500000) benchmark = 1.2;
  else if (fc >= 100000) benchmark = 1.8;
  else if (fc >= 50000) benchmark = 2.4;
  else if (fc >= 10000) benchmark = 3.5;
  const erScore = Math.min((avgEngagement / benchmark) * 40, 40); // max 40 pts
  // Follower/following ratio (healthy > 1.5)
  const ratio = fc / Math.max(profile.followsCount || profile.followingCount || 1, 1);
  const ratioScore = Math.min(ratio / 1.5 * 20, 20); // max 20 pts
  // Posting consistency (any posts = some points)
  const postCount = posts?.length || 0;
  const consistencyScore = Math.min(postCount / 12 * 20, 20); // max 20 pts
  // Profile completeness
  const hasProfilePic = profile.profilePicUrl ? 5 : 0;
  const hasBio = (profile.biography || profile.bio || '').length > 10 ? 5 : 0;
  const profileScore = hasProfilePic + hasBio + (profile.verified ? 10 : 0); // max 20
  const total = Math.round(erScore + ratioScore + consistencyScore + profileScore);
  const clamped = Math.min(total, 100);
  let grade, color;
  if (clamped >= 90) { grade = 'A+'; color = '#10b981'; }
  else if (clamped >= 80) { grade = 'A'; color = '#10b981'; }
  else if (clamped >= 70) { grade = 'B+'; color = '#22c55e'; }
  else if (clamped >= 60) { grade = 'B'; color = '#84cc16'; }
  else if (clamped >= 50) { grade = 'C+'; color = '#eab308'; }
  else if (clamped >= 40) { grade = 'C'; color = '#f59e0b'; }
  else if (clamped >= 30) { grade = 'D'; color = '#f97316'; }
  else { grade = 'F'; color = '#ef4444'; }
  return { grade, score: clamped, color, erScore: Math.round(erScore), ratioScore: Math.round(ratioScore), consistencyScore: Math.round(consistencyScore), profileScore: Math.round(profileScore) };
}

const gradeColors = {
  'A+': 'text-emerald-500', 'A': 'text-emerald-500', 'B+': 'text-green-500', 'B': 'text-lime-500',
  'C+': 'text-yellow-500', 'C': 'text-amber-500', 'D': 'text-orange-500', 'F': 'text-red-500', '--': 'text-slate-400',
};

const HealthScoreCard = ({ profile, posts, avgEngagement }) => {
  const h = calcHealthScore(profile, posts, avgEngagement);
  const r = 54, circ = 2 * Math.PI * r;
  const offset = circ - (h.score / 100) * circ;

  const metrics = [
    { label: 'Engagement', val: h.erScore, max: 40, icon: BarChart2, tip: 'Based on engagement rate vs similar accounts' },
    { label: 'Ratio', val: h.ratioScore, max: 20, icon: Activity, tip: 'Healthy follower to following ratio' },
    { label: 'Consistency', val: h.consistencyScore, max: 20, icon: Calendar, tip: 'Regular posting frequency' },
    { label: 'Profile', val: h.profileScore, max: 20, icon: Sparkles, tip: 'Profile completeness and verification' },
  ];

  return (
    <Card className="mb-5 overflow-hidden hover:shadow-lg transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-5 h-5 text-primary" />
          Account Health Score
          <Badge variant="secondary" className="ml-auto font-bold">{h.grade}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Score Ring */}
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r={r} fill="none" className="stroke-muted" strokeWidth="10" />
              <circle cx="60" cy="60" r={r} fill="none" stroke={h.color} strokeWidth="10"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-4xl font-black", gradeColors[h.grade])}>{h.grade}</span>
              <span className="text-sm text-muted-foreground font-medium">{h.score}/100</span>
            </div>
          </div>
          {/* Metric Bars */}
          <div className="flex-1 w-full space-y-4">
            {metrics.map(({ label, val, max, icon: Icon, tip }) => (
              <TooltipProvider key={label}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="space-y-1.5 cursor-help">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon className="w-4 h-4" />
                          <span className="font-medium">{label}</span>
                        </div>
                        <span className="font-bold text-foreground">{val}/{max}</span>
                      </div>
                      <Progress value={(val / max) * 100} className="h-2" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{tip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Tracking (localStorage snapshots) ────────────────────────────────── */
function saveSnapshot(username, profile, avgEngagement) {
  if (!username || !profile) return;
  const key = `am_track_${username}`;
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  const now = Date.now();
  // Don't save more than once per hour
  if (history.length > 0 && now - history[history.length - 1].ts < 3600000) return;
  history.push({
    ts: now,
    followers: profile.followersCount || 0,
    following: profile.followsCount || profile.followingCount || 0,
    posts: profile.postsCount || 0,
    er: avgEngagement || 0,
  });
  // Keep max 30
  if (history.length > 30) history.splice(0, history.length - 30);
  localStorage.setItem(key, JSON.stringify(history));
}

function getSnapshots(username) {
  if (!username) return [];
  return JSON.parse(localStorage.getItem(`am_track_${username}`) || '[]');
}

const TrackingSection = ({ username, profile, userId }) => {
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        let data;
        if (userId) {
          data = await getSnapshotsDB(userId, username);
        } else {
          // Fallback for non-logged-in: localStorage
          const local = JSON.parse(localStorage.getItem(`am_track_${username}`) || '[]');
          data = local.map(s => ({
            created_at: new Date(s.ts).toISOString(),
            followers_count: s.followers,
            following_count: s.following,
            posts_count: s.posts,
            engagement_rate: s.er,
          }));
        }
        if (!cancelled) setSnaps(data || []);
      } catch { if (!cancelled) setSnaps([]); }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [userId, username]);

  if (loading || snaps.length < 2) return null;
  const latest = snaps[snaps.length - 1];
  const prev = snaps[snaps.length - 2];
  const delta = (curr, old) => {
    const d = curr - old;
    if (d === 0) return <span className="text-slate-400">—</span>;
    return <span className={d > 0 ? 'text-emerald-600' : 'text-red-500'}>{d > 0 ? '+' : ''}{fmt(d)}</span>;
  };
  // Mini sparkline SVG
  const sparkline = (field) => {
    const vals = snaps.map(s => s[field]);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 60},${30 - ((v - min) / range) * 28}`).join(' ');
    return (
      <svg viewBox="0 0 60 32" className="w-16 h-6 inline-block ml-2">
        <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-4 border border-indigo-100">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-600" />
        <span className="font-semibold text-sm text-indigo-900">Tracking History</span>
        <span className="text-xs text-slate-400 ml-auto">{snaps.length} snapshots</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          ['Followers', 'followers_count'],
          ['Following', 'following_count'],
          ['Posts', 'posts_count'],
          ['ER%', 'engagement_rate'],
        ].map(([label, field]) => (
          <div key={field} className="bg-white/70 rounded-lg p-2.5">
            <div className="text-slate-500 text-xs mb-1">{label}</div>
            <div className="flex items-center gap-1">
              {delta(latest[field], prev[field])}
              {sparkline(field)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Compare Accounts Tab ─────────────────────────────────────────────── */
const CompareTab = ({ tier }) => {
  const [usernameA, setUsernameA] = useState('');
  const [usernameB, setUsernameB] = useState('');
  const [profileA, setProfileA] = useState(null);
  const [profileB, setProfileB] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState(null);
  // Deep Compare state
  const [deepCompare, setDeepCompare] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [followersA, setFollowersA] = useState([]);
  const [followersB, setFollowersB] = useState([]);
  const [deepDone, setDeepDone] = useState(false);

  const handleCompare = async () => {
    if (!usernameA.trim() || !usernameB.trim()) return;
    setComparing(true); setError(null); setProfileA(null); setProfileB(null);
    try {
      const [a, b] = await Promise.all([
        fetchInstagramProfile(usernameA.trim().replace('@', '')),
        fetchInstagramProfile(usernameB.trim().replace('@', '')),
      ]);
      setProfileA(a?.[0] || null);
      setProfileB(b?.[0] || null);
      if (!a?.[0] || !b?.[0]) setError('Could not fetch one or both profiles.');
    } catch (e) { setError(e.message); }
    setComparing(false);
  };

  const metrics = profileA && profileB ? [
    { label: 'Followers', a: profileA.followersCount || 0, b: profileB.followersCount || 0, icon: '👥' },
    { label: 'Following', a: profileA.followsCount || profileA.followingCount || 0, b: profileB.followsCount || profileB.followingCount || 0, icon: '➡️', lower: true },
    { label: 'Posts', a: profileA.postsCount || 0, b: profileB.postsCount || 0, icon: '📸' },
    { label: 'Engagement', a: profileA.followersCount ? ((profileA.avgLikes || 0) / profileA.followersCount * 100) : 0, b: profileB.followersCount ? ((profileB.avgLikes || 0) / profileB.followersCount * 100) : 0, icon: '💬', pct: true },
  ] : [];

  return (
    <AccessGate tier={tier} required="standard">
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> Compare Accounts</h3>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input value={usernameA} onChange={e => setUsernameA(e.target.value)} placeholder="@username_1" className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-300 outline-none" />
            <span className="text-slate-400 self-center font-bold">VS</span>
            <input value={usernameB} onChange={e => setUsernameB(e.target.value)} placeholder="@username_2" className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-300 outline-none" />
            <button onClick={handleCompare} disabled={comparing || !usernameA.trim() || !usernameB.trim()}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors min-h-[44px]">
              {comparing ? 'Comparing...' : 'Compare'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        {profileA && profileB && (
          <div className="space-y-3">
            {/* Headers */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-xl border p-4">
                {profileA.profilePicUrl && <img src={proxyImg(profileA.profilePicUrl)} className="w-14 h-14 rounded-full mx-auto mb-2 object-cover" alt="" />}
                <p className="font-bold text-sm">@{profileA.username}</p>
              </div>
              <div className="flex items-center justify-center text-2xl font-black text-slate-300">VS</div>
              <div className="bg-white rounded-xl border p-4">
                {profileB.profilePicUrl && <img src={proxyImg(profileB.profilePicUrl)} className="w-14 h-14 rounded-full mx-auto mb-2 object-cover" alt="" />}
                <p className="font-bold text-sm">@{profileB.username}</p>
              </div>
            </div>
            {/* Metric comparisons */}
            {metrics.map(m => {
              const winner = m.lower ? (m.a < m.b ? 'a' : m.a > m.b ? 'b' : 'tie') : (m.a > m.b ? 'a' : m.a < m.b ? 'b' : 'tie');
              const maxVal = Math.max(m.a, m.b) || 1;
              return (
                <div key={m.label} className="bg-white rounded-xl border p-4">
                  <div className="text-center text-sm font-medium text-slate-500 mb-3">{m.icon} {m.label}</div>
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <div className="text-right">
                      <span className={`text-lg font-bold ${winner === 'a' ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {m.pct ? pct(m.a) : fmt(m.a)}
                      </span>
                      {winner === 'a' && <span className="ml-1 text-xs">👑</span>}
                      <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-700 ml-auto" style={{ width: `${(m.a / maxVal) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-center text-slate-300 text-xs font-bold">vs</div>
                    <div>
                      <span className={`text-lg font-bold ${winner === 'b' ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {m.pct ? pct(m.b) : fmt(m.b)}
                      </span>
                      {winner === 'b' && <span className="ml-1 text-xs">👑</span>}
                      <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all duration-700" style={{ width: `${(m.b / maxVal) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Deep Compare: Mutual Connection Map ────────────────────── */}
        {profileA && profileB && (
          <AccessGate tier={tier} required="premium">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <SectionHeader icon={<CircleDot className="w-5 h-5 text-violet-500" />} title="Mutual Connection Map" badge="Wave 2" />
              {!deepDone ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 mb-4">Fetch follower lists for both accounts to discover shared audience overlap.</p>
                  <button
                    onClick={async () => {
                      setDeepLoading(true);
                      try {
                        const [fA, fB] = await Promise.all([
                          fetchFollowersList(profileA.username, 'followers', 1000).catch(() => []),
                          fetchFollowersList(profileB.username, 'followers', 1000).catch(() => []),
                        ]);
                        setFollowersA(fA || []);
                        setFollowersB(fB || []);
                        setDeepDone(true);
                      } catch (e) { setError(e.message); }
                      setDeepLoading(false);
                    }}
                    disabled={deepLoading}
                    className="px-6 py-2.5 bg-violet-600 text-white rounded-xl font-medium text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors min-h-[44px] inline-flex items-center gap-2"
                  >
                    {deepLoading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Fetching Followers...</>
                    ) : (
                      <><Users className="w-4 h-4" /> Deep Compare</>
                    )}
                  </button>
                </div>
              ) : (() => {
                const setA = new Set(followersA.map(f => (f.username || f.handle || f.login || '').toLowerCase()).filter(Boolean));
                const setB = new Set(followersB.map(f => (f.username || f.handle || f.login || '').toLowerCase()).filter(Boolean));
                const shared = [...setA].filter(u => setB.has(u));
                const onlyA = setA.size - shared.length;
                const onlyB = setB.size - shared.length;
                const overlapPctA = setA.size > 0 ? (shared.length / setA.size * 100) : 0;
                const overlapPctB = setB.size > 0 ? (shared.length / setB.size * 100) : 0;
                const totalUnion = setA.size + setB.size - shared.length;
                const jaccardPct = totalUnion > 0 ? (shared.length / totalUnion * 100) : 0;
                return (
                  <div className="space-y-5">
                    {/* Venn Diagram (pure CSS) */}
                    <div className="flex justify-center py-4">
                      <div className="relative" style={{ width: 260, height: 160 }}>
                        {/* Circle A */}
                        <div className="absolute rounded-full border-3 border-indigo-400 bg-indigo-100/60"
                          style={{ width: 150, height: 150, left: 0, top: 5 }} />
                        {/* Circle B */}
                        <div className="absolute rounded-full border-3 border-purple-400 bg-purple-100/60"
                          style={{ width: 150, height: 150, right: 0, top: 5 }} />
                        {/* Overlap indicator */}
                        <div className="absolute flex flex-col items-center justify-center text-center"
                          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                          <span className="text-xl sm:text-2xl font-bold text-violet-700">{fmt(shared.length)}</span>
                          <span className="text-[9px] sm:text-[10px] text-violet-500 font-semibold">Shared</span>
                        </div>
                        {/* Label A */}
                        <div className="absolute flex flex-col items-center" style={{ left: 30, top: '50%', transform: 'translateY(-50%)' }}>
                          <span className="text-sm font-bold text-indigo-700">{fmt(onlyA)}</span>
                          <span className="text-[9px] text-indigo-500">only</span>
                        </div>
                        {/* Label B */}
                        <div className="absolute flex flex-col items-center" style={{ right: 30, top: '50%', transform: 'translateY(-50%)' }}>
                          <span className="text-sm font-bold text-purple-700">{fmt(onlyB)}</span>
                          <span className="text-[9px] text-purple-500">only</span>
                        </div>
                      </div>
                    </div>
                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      <div className="bg-indigo-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-indigo-700">{fmt(setA.size)}</p>
                        <p className="text-[10px] text-indigo-500">@{profileA.username} followers</p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-purple-700">{fmt(setB.size)}</p>
                        <p className="text-[10px] text-purple-500">@{profileB.username} followers</p>
                      </div>
                      <div className="bg-violet-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-violet-700">{fmt(shared.length)}</p>
                        <p className="text-[10px] text-violet-500">Shared Followers</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-slate-700">{jaccardPct.toFixed(1)}%</p>
                        <p className="text-[10px] text-slate-500">Overlap (Jaccard)</p>
                      </div>
                    </div>
                    {/* Overlap bars */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-40 sm:w-48 shrink-0">@{profileA.username} overlap</span>
                        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${overlapPctA}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-12 text-right">{overlapPctA.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-40 sm:w-48 shrink-0">@{profileB.username} overlap</span>
                        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${overlapPctB}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-12 text-right">{overlapPctB.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-3 flex items-start gap-2">
                      <CircleDot className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-violet-700">
                        {shared.length > 0
                          ? <><strong>{fmt(shared.length)} followers</strong> follow both accounts. {overlapPctA > 30 ? 'High audience overlap — these accounts share a similar niche.' : 'Moderate overlap — potential for cross-promotion.'}</>
                          : <strong>No shared followers detected</strong>}
                        {' '}Based on {fmt(setA.size)} + {fmt(setB.size)} followers fetched.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </AccessGate>
        )}
      </div>
    </AccessGate>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD — Main Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { user } = useAuth();
  const { tier } = useTier();
  const { t } = useI18n();

  /* ── Account management ────────────────────────────────────────────────── */
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  /* ── Selected account + its profile data ───────────────────────────────── */
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [dayRange, setDayRange] = useState(30);

  /* ── Report tabs ───────────────────────────────────────────────────────── */
  const [reportTab, setReportTab] = useState('activity');

  /* ── Load tracked accounts from Supabase ───────────────────────────────── */
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
    if (!error) {
      setTrackedAccounts(data || []);
      if (data?.length && !selectedAccount) setSelectedAccount(data[0]);
    }
    setAccountsLoading(false);
  };

  const handleAddAccount = async () => {
    const username = addInput.trim().replace('@', '')
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
    if (!username) return;
    setAddError('');
    setAddLoading(true);
    const { data, error } = await supabase.from('tracked_accounts').insert({
      user_id: user.id, username, created_at: new Date().toISOString(),
    }).select().single();
    setAddLoading(false);
    if (error) {
      setAddError(error.code === '23505' ? 'Already tracking this account.' : error.message);
    } else {
      setAddInput('');
      setTrackedAccounts(prev => [data, ...prev]);
      setSelectedAccount(data);
    }
  };

  const handleRemoveAccount = async (id) => {
    await supabase.from('tracked_accounts').delete().eq('id', id);
    setTrackedAccounts(prev => prev.filter(a => a.id !== id));
    if (selectedAccount?.id === id) {
      const remaining = trackedAccounts.filter(a => a.id !== id);
      setSelectedAccount(remaining[0] || null);
    }
  };

  /* ── Fetch ALL data when selectedAccount changes ─────────────────────── */
  const loadProfileData = useCallback(async (username) => {
    if (!username) return;
    setProfileLoading(true);
    try {
      // Fetch profile, posts, followers, following in parallel
      const [profileRes, postsRes, followerRes, followingRes] = await Promise.all([
        fetchInstagramProfile(username).catch(() => null),
        fetchInstagramProfileWithPosts(username).catch(() => null),
        fetchFollowersList(username, 'followers', 1000).catch(() => []),
        fetchFollowersList(username, 'following', 1000).catch(() => []),
      ]);

      if (profileRes?.[0]) {
        const p = profileRes[0];
        setProfile({
          username: p.username,
          fullName: p.fullName || '',
          profilePicUrl: p.profilePicUrl || p.profilePicUrlHD || '',
          followers: p.followersCount || 0,
          following: p.followsCount || p.followingCount || 0,
          posts: p.postsCount || 0,
          bio: p.biography || '',
          isVerified: p.verified || false,
          isPrivate: p.private || false,
          externalUrl: p.externalUrl || '',
          category: p.businessCategoryName || p.categoryName || '',
        });
      }

      // Posts from Apify profile-with-posts
      if (postsRes) {
        const postData = postsRes.latestPosts || postsRes[0]?.latestPosts || [];
        setPosts(postData.slice(0, 24));
      }

      // Followers & Following
      setFollowers((followerRes || []).filter(f => f.username || f.handle || f.login));
      setFollowing((followingRes || []).filter(f => f.username || f.handle || f.login));
      setLastRefresh(new Date().toISOString());

    } catch (err) {
      console.error('Dashboard load error:', err);
    }
    setProfileLoading(false);
  }, []);

  // Save tracking snapshot when profile data loads (Supabase or localStorage fallback)
  useEffect(() => {
    if (profile && selectedAccount) {
      const er = profile.followers > 0 && posts.length > 0
        ? posts.reduce((s, p) => s + (p.likesCount || 0) + (p.commentsCount || 0), 0) / posts.length / profile.followers * 100
        : 0;
      const snapData = {
        followers: profile.followers || profile.followersCount || 0,
        following: profile.following || profile.followsCount || 0,
        posts: profile.posts || profile.postsCount || 0,
        er,
      };
      if (user?.id) {
        saveSnapshotDB(user.id, selectedAccount.username, snapData);
      } else {
        saveSnapshotLocal(selectedAccount.username, snapData);
      }
    }
  }, [profile, selectedAccount, posts, user]);

  // One-time migration: move localStorage snapshots to Supabase
  useEffect(() => {
    if (!user?.id || !trackedAccounts.length) return;
    trackedAccounts.forEach(acc => {
      migrateLocalSnapshots(user.id, acc.username);
    });
  }, [user, trackedAccounts]);

  useEffect(() => {
    if (!selectedAccount) { setProfile(null); setPosts([]); setStories([]); setFollowers([]); setFollowing([]); return; }
    loadProfileData(selectedAccount.username);
  }, [selectedAccount, loadProfileData]);

  /* ── Fetch stories separately ────────────────────────────────────────── */
  useEffect(() => {
    if (!selectedAccount) return;
    let cancelled = false;
    fetchInstagramStories(selectedAccount.username)
      .then(s => { if (!cancelled) setStories(s || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedAccount]);

  /* ── Refresh handler ─────────────────────────────────────────────────── */
  const handleRefresh = () => {
    if (selectedAccount) loadProfileData(selectedAccount.username);
  };

  /* ── Tab definitions ───────────────────────────────────────────────────── */
  const TABS = [
    { id: 'activity', icon: <Activity className="w-4 h-4" />, label: 'Activity' },
    { id: 'ties', icon: <Users className="w-4 h-4" />, label: 'Ties & Trails' },
    { id: 'stories', icon: <MonitorPlay className="w-4 h-4" />, label: 'Stories' },
    { id: 'insights', icon: <Brain className="w-4 h-4" />, label: 'Deep Insights' },
    { id: 'compare', icon: <BarChart2 className="w-4 h-4" />, label: 'Compare' },
    { id: 'mediakit', icon: <FileText className="w-4 h-4" />, label: 'Media Kit' },
    { id: 'competitors', icon: <Target className="w-4 h-4" />, label: 'Competitors' },
  ];

  /* ═══ Engagement metrics computed from posts ═══════════════════════════ */
  const totalLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
  const avgEngagement = profile?.followers > 0 && posts.length > 0
    ? ((totalLikes + totalComments) / posts.length / profile.followers * 100)
    : 0;

  /* ═══ RENDER ═══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-[calc(100vh-64px)] bg-muted/30">
      {/* ── Top bar: account selector + add + refresh + day range ──────── */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* Account pills - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0 scrollbar-hide">
            {trackedAccounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all min-h-[36px]",
                  selectedAccount?.id === acc.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                )}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {acc.username.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[80px] sm:max-w-none truncate">@{acc.username}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveAccount(acc.id); }}
                  className="text-muted-foreground/50 hover:text-destructive ml-0.5 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Add input */}
            <div className="flex items-center bg-muted rounded-lg border border-border px-2 sm:px-3 py-1.5">
              <Search className="w-4 h-4 text-muted-foreground mr-1.5" />
              <input
                type="text"
                value={addInput}
                onChange={e => { setAddInput(e.target.value); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                placeholder="Add @username"
                className="bg-transparent border-none outline-none text-sm text-foreground w-24 sm:w-32 placeholder:text-muted-foreground"
              />
            </div>
            <Button
              onClick={handleAddAccount}
              disabled={addLoading}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{addLoading ? '...' : 'Add'}</span>
            </Button>
            {/* Refresh */}
            <Button
              onClick={handleRefresh}
              disabled={profileLoading}
              variant="outline"
              size="sm"
              title="Refresh data"
            >
              <RefreshCw className={cn("w-4 h-4", profileLoading && "animate-spin")} />
              <span className="hidden sm:inline ml-1.5">Refresh</span>
            </Button>
            {/* Day range picker */}
            <Select value={String(dayRange)} onValueChange={v => setDayRange(Number(v))}>
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {addError && (
          <div className="max-w-7xl mx-auto px-4 pb-2">
            <p className="text-destructive text-xs">{addError}</p>
          </div>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!selectedAccount && !accountsLoading && (
        <div className="max-w-lg mx-auto text-center py-20 sm:py-32 px-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">Start Tracking</h2>
          <p className="text-muted-foreground mb-8 text-sm sm:text-base">Add an Instagram username above to start generating insights and analytics reports.</p>
        </div>
      )}

      {/* ── Minting Loading Animation ──────────────────────────────────── */}
      {profileLoading && <MintingLoader />}

      {/* ── Profile + Report ────────────────────────────────────────────── */}
      {selectedAccount && profile && !profileLoading && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">

          {/* Profile header — mobile responsive */}
          <Card className="mb-4 sm:mb-6">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-6">
                {profile.profilePicUrl ? (
                  <Avatar className="w-14 h-14 sm:w-20 sm:h-20 border-2 border-primary/20">
                    <AvatarImage src={proxyImg(profile.profilePicUrl)} alt={profile.username} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-lg sm:text-2xl font-bold">
                      {profile.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-lg sm:text-2xl font-bold shrink-0">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-base sm:text-xl font-bold text-foreground truncate">@{profile.username}</h1>
                    {profile.isVerified && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-600 text-[10px] shrink-0">✓ Verified</Badge>
                    )}
                  </div>
                  {profile.fullName && <p className="text-xs sm:text-sm text-muted-foreground mb-1">{profile.fullName}</p>}
                  {profile.category && <Badge variant="outline" className="text-[10px] text-primary mb-1">{profile.category}</Badge>}
                  {profile.bio && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 hidden sm:block mt-1">{profile.bio}</p>}
                </div>
              </div>
              {/* Stats row — always visible */}
              <div className="flex gap-4 sm:gap-8 mt-3 sm:mt-4 pt-3 border-t border-border">
                {[
                  { label: 'Posts', value: fmt(profile.posts) },
                  { label: 'Followers', value: fmt(profile.followers) },
                  { label: 'Following', value: fmt(profile.following) },
                  { label: 'Eng. Rate', value: pct(avgEngagement) },
                ].map((s, i) => (
                  <div key={i} className="text-center flex-1">
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Last refresh */}
              {lastRefresh && (
                <p className="text-[10px] text-muted-foreground/60 mt-2 text-right">
                  Last updated: {new Date(lastRefresh).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Health Score ──────────────────────────────────────────── */}
          <HealthScoreCard profile={profile} posts={posts} avgEngagement={avgEngagement} />

          {/* ── Audience Insights with AI Suggestions ─────────────────── */}
          <AudienceInsights
            followers={followers}
            posts={posts}
            profile={profile}
            onRefresh={handleRefresh}
            isLoading={profileLoading}
          />

          {/* ── Tracking History ──────────────────────────────────────── */}
          <TrackingSection username={selectedAccount?.username || selectedAccount} profile={profile} userId={user?.id} />

          {/* Report tabs — horizontal scroll on mobile */}
          <div className="bg-white rounded-t-2xl border border-b-0 border-slate-200 px-2 sm:px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-0 sm:gap-1 min-w-max">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setReportTab(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap min-h-[44px] ${
                    reportTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200 p-3 sm:p-6 mb-8">
            {reportTab === 'activity' && (
              <ActivityTab profile={profile} posts={posts} tier={tier} avgEngagement={avgEngagement} totalLikes={totalLikes} totalComments={totalComments} dayRange={dayRange} />
            )}
            {reportTab === 'ties' && (
              <TiesTab profile={profile} posts={posts} tier={tier} followers={followers} following={following} />
            )}
            {reportTab === 'stories' && (
              <StoriesTab profile={profile} stories={stories} tier={tier} />
            )}
            {reportTab === 'insights' && (
              <InsightsTab profile={profile} posts={posts} tier={tier} avgEngagement={avgEngagement} followers={followers} following={following} />
            )}
            {reportTab === 'compare' && (
              <CompareTab tier={tier} />
            )}
            {reportTab === 'mediakit' && (
              <MediaKitTab profile={profile} posts={posts} tier={tier} followers={followers} following={following} avgEngagement={avgEngagement} />
            )}
            {reportTab === 'competitors' && (
              <CompetitorsTab profile={profile} posts={posts} tier={tier} avgEngagement={avgEngagement} user={user} />
            )}
          </div>

          {/* ── Digest Email Settings ──────────────────────────────────── */}
          <DigestSettings user={user} tier={tier} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Media Kit Tab (Wave 3)
   ═══════════════════════════════════════════════════════════════════════════ */
const MediaKitTab = ({ profile, posts, tier, followers, following, avgEngagement }) => {
  const [copied, setCopied] = useState(false);

  if (!profile) return <p className="text-slate-400 text-sm">Load a profile to generate your media kit.</p>;

  // Content breakdown
  const typeCount = { photo: 0, video: 0, carousel: 0 };
  posts.forEach(p => {
    const t = (p.type || p.productType || '').toLowerCase();
    if (t.includes('carousel') || t.includes('sidecar') || (p.images && p.images.length > 1)) typeCount.carousel++;
    else if (t.includes('video') || t.includes('reel') || t.includes('clip')) typeCount.video++;
    else typeCount.photo++;
  });
  const total = posts.length || 1;
  const photoPct = ((typeCount.photo / total) * 100).toFixed(0);
  const videoPct = ((typeCount.video / total) * 100).toFixed(0);
  const carouselPct = ((typeCount.carousel / total) * 100).toFixed(0);

  // Avg likes / comments
  const avgLikes = posts.length > 0 ? Math.round(posts.reduce((s, p) => s + (p.likesCount || 0), 0) / posts.length) : 0;
  const avgComments = posts.length > 0 ? Math.round(posts.reduce((s, p) => s + (p.commentsCount || 0), 0) / posts.length) : 0;

  // Top hashtags
  const hashMap = {};
  posts.forEach(p => {
    const caption = p.caption || p.text || '';
    const tags = caption.match(/#[\w]+/g) || [];
    tags.forEach(t => { hashMap[t.toLowerCase()] = (hashMap[t.toLowerCase()] || 0) + 1; });
  });
  const topHashtags = Object.entries(hashMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Best posting hours
  const hourMap = {};
  posts.forEach(p => {
    if (!p.timestamp) return;
    const h = new Date(p.timestamp).getHours();
    hourMap[h] = (hourMap[h] || 0) + 1;
  });
  const bestHours = Object.entries(hourMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => {
    const hr = parseInt(h);
    return hr === 0 ? '12 AM' : hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`;
  });

  // Ghost follower estimate (basic heuristic: low ER + high followers = more ghosts)
  const ghostPct = avgEngagement > 0
    ? Math.max(5, Math.min(80, Math.round(100 - avgEngagement * 15 - (posts.length > 10 ? 5 : 0))))
    : 0;
  const audienceQuality = ghostPct < 25 ? 'Excellent' : ghostPct < 40 ? 'Good' : ghostPct < 60 ? 'Fair' : 'Needs Work';
  const aqColor = ghostPct < 25 ? 'text-emerald-600' : ghostPct < 40 ? 'text-blue-600' : ghostPct < 60 ? 'text-amber-600' : 'text-red-500';

  const handleCopyStats = () => {
    const text = [
      `--- Media Kit: @${profile.username} ---`,
      profile.fullName ? `Name: ${profile.fullName}` : '',
      profile.bio ? `Bio: ${profile.bio}` : '',
      '',
      `Followers: ${fmt(profile.followers)}`,
      `Following: ${fmt(profile.following)}`,
      `Posts: ${fmt(profile.posts)}`,
      `Avg Engagement Rate: ${pct(avgEngagement)}`,
      `Avg Likes/Post: ${fmt(avgLikes)}`,
      `Avg Comments/Post: ${fmt(avgComments)}`,
      '',
      `Content Mix: ${photoPct}% Photo, ${videoPct}% Video, ${carouselPct}% Carousel`,
      topHashtags.length ? `Top Hashtags: ${topHashtags.map(([t]) => t).join(', ')}` : '',
      bestHours.length ? `Best Posting Times: ${bestHours.join(', ')}` : '',
      `Audience Quality: ${audienceQuality} (est. ${100 - ghostPct}% real)`,
      '',
      'Generated by Activity Mint',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => { window.print(); };

  return (
    <AccessGate tier={tier} feature="insights.basic">
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Print-optimized styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .media-kit-card, .media-kit-card * { visibility: visible; }
            .media-kit-card { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>

        <SectionHeader icon={<FileText className="w-5 h-5 text-indigo-500" />} title="Influencer Media Kit" badge="Wave 3">
          <div className="flex gap-2 no-print">
            <button onClick={handleCopyStats} className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy Stats'}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
        </SectionHeader>

        {/* Media Kit Card */}
        <div className="media-kit-card bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
            {profile.profilePicUrl ? (
              <img src={proxyImg(profile.profilePicUrl)} alt={profile.username}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-indigo-400/50 object-cover" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-2xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">@{profile.username}</h2>
              {profile.fullName && <p className="text-indigo-300 text-sm">{profile.fullName}</p>}
              {profile.category && <p className="text-indigo-400/70 text-xs mt-0.5">{profile.category}</p>}
              {profile.bio && <p className="text-slate-300 text-xs mt-1 line-clamp-2 max-w-md">{profile.bio}</p>}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Followers', value: fmt(profile.followers), icon: <Users className="w-4 h-4" /> },
              { label: 'Avg ER', value: pct(avgEngagement), icon: <Heart className="w-4 h-4" /> },
              { label: 'Avg Likes', value: fmt(avgLikes), icon: <ThumbsUp className="w-4 h-4" /> },
              { label: 'Avg Comments', value: fmt(avgComments), icon: <MessageSquare className="w-4 h-4" /> },
            ].map((m, i) => (
              <div key={i} className="bg-white/5 backdrop-blur rounded-xl p-3 sm:p-4 border border-white/10">
                <div className="flex items-center gap-1.5 text-indigo-300 mb-1">
                  {m.icon}
                  <span className="text-[10px] uppercase tracking-wider">{m.label}</span>
                </div>
                <p className="text-lg sm:text-xl font-bold">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Content Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <h4 className="text-xs uppercase tracking-wider text-indigo-300 mb-3">Content Mix</h4>
              <div className="space-y-2">
                {[
                  { label: 'Photos', pct: photoPct, color: 'bg-blue-400' },
                  { label: 'Videos', pct: videoPct, color: 'bg-purple-400' },
                  { label: 'Carousels', pct: carouselPct, color: 'bg-pink-400' },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="text-white font-semibold">{item.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Hashtags */}
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <h4 className="text-xs uppercase tracking-wider text-indigo-300 mb-3">Top Hashtags</h4>
              <div className="flex flex-wrap gap-1.5">
                {topHashtags.length > 0 ? topHashtags.map(([tag, count], i) => (
                  <span key={i} className="bg-indigo-500/20 text-indigo-200 text-[10px] px-2 py-1 rounded-full border border-indigo-400/20">
                    {tag} <span className="text-indigo-400">({count})</span>
                  </span>
                )) : <p className="text-slate-400 text-xs">No hashtags found in recent posts</p>}
              </div>
            </div>

            {/* Best Times + Audience Quality */}
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <h4 className="text-xs uppercase tracking-wider text-indigo-300 mb-3">Audience Quality</h4>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-indigo-300" />
                <span className={`font-bold text-lg ${aqColor.replace('text-', 'text-')}`} style={{ color: ghostPct < 25 ? '#34d399' : ghostPct < 40 ? '#60a5fa' : ghostPct < 60 ? '#fbbf24' : '#f87171' }}>
                  {audienceQuality}
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-3">Est. {100 - ghostPct}% real, engaged followers</p>
              {bestHours.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-indigo-300 mb-1.5">Best Times</h4>
                  <div className="flex gap-2">
                    {bestHours.map((h, i) => (
                      <span key={i} className="bg-emerald-500/20 text-emerald-200 text-[10px] px-2 py-1 rounded-full border border-emerald-400/20">
                        <Clock className="w-3 h-3 inline mr-0.5" />{h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-white/10">
            <p className="text-[10px] text-slate-400">Generated by Activity Mint &middot; {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>
    </AccessGate>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Competitors Tab (Wave 3)
   ═══════════════════════════════════════════════════════════════════════════ */
const CompetitorsTab = ({ profile, posts, tier, avgEngagement, user }) => {
  const [competitors, setCompetitors] = useState([]);
  const [competitorProfiles, setCompetitorProfiles] = useState({});
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [loading, setLoading] = useState(true);

  const maxCompetitors = tier === 'premium' ? 15 : 5;

  // Load competitors
  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let cancelled = false;
    getCompetitors(user.id).then(data => {
      if (!cancelled) { setCompetitors(data); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  // Fetch profiles for each competitor
  useEffect(() => {
    competitors.forEach(c => {
      if (competitorProfiles[c.username]) return;
      fetchInstagramProfile(c.username).then(res => {
        if (res?.[0]) {
          const p = res[0];
          const compProfile = {
            username: p.username,
            fullName: p.fullName || '',
            profilePicUrl: p.profilePicUrl || p.profilePicUrlHD || '',
            followers: p.followersCount || 0,
            following: p.followsCount || p.followingCount || 0,
            posts: p.postsCount || 0,
            bio: p.biography || '',
            isVerified: p.verified || false,
          };
          setCompetitorProfiles(prev => ({ ...prev, [c.username]: compProfile }));
          // Save snapshot
          saveCompetitorSnapshot(c.id, {
            followers: compProfile.followers,
            following: compProfile.following,
            posts: compProfile.posts,
            er: 0,
          });
        }
      }).catch(() => {});
    });
  }, [competitors]);

  const handleAdd = async () => {
    const username = addInput.trim().replace('@', '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
    if (!username) return;
    if (competitors.length >= maxCompetitors) {
      setAddError(`Max ${maxCompetitors} competitors on your plan.`);
      return;
    }
    setAddError('');
    setAddLoading(true);
    try {
      const data = await addCompetitor(user.id, username);
      setCompetitors(prev => [...prev, data]);
      setAddInput('');
    } catch (err) {
      setAddError(err.code === '23505' ? 'Already tracking this competitor.' : (err.message || 'Failed to add competitor.'));
    }
    setAddLoading(false);
  };

  const handleRemove = async (id) => {
    try {
      await removeCompetitor(id);
      setCompetitors(prev => prev.filter(c => c.id !== id));
      setCompetitorProfiles(prev => {
        const next = { ...prev };
        const comp = competitors.find(c => c.id === id);
        if (comp) delete next[comp.username];
        return next;
      });
    } catch {}
  };

  // Comparison bar helper
  const ComparisonBar = ({ label, yours, theirs, format = 'number' }) => {
    const max = Math.max(yours || 1, theirs || 1);
    const yourW = ((yours / max) * 100).toFixed(0);
    const theirW = ((theirs / max) * 100).toFixed(0);
    const formatVal = format === 'pct' ? pct : fmt;
    return (
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{label}</span>
          <span className="font-medium text-slate-700">{formatVal(yours)} vs {formatVal(theirs)}</span>
        </div>
        <div className="flex gap-1 h-2">
          <div className="bg-indigo-400 rounded-l-full transition-all" style={{ width: `${yourW}%` }} />
          <div className="bg-rose-400 rounded-r-full transition-all" style={{ width: `${theirW}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
          <span>You</span>
          <span>Them</span>
        </div>
      </div>
    );
  };

  return (
    <AccessGate tier={tier} feature="insights.basic">
      <div className="space-y-6 animate-in fade-in duration-300">
        <SectionHeader icon={<Target className="w-5 h-5 text-indigo-500" />} title="Competitor Tracking" badge="Wave 3" />

        {/* Add competitor */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              value={addInput}
              onChange={e => { setAddInput(e.target.value); setAddError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Add competitor @username"
              className="bg-transparent border-none outline-none text-sm text-slate-700 w-full"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={addLoading || !user?.id}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            {addLoading ? 'Adding...' : 'Track'}
          </button>
          <span className="text-xs text-slate-400">{competitors.length}/{maxCompetitors}</span>
        </div>
        {addError && <p className="text-red-500 text-xs">{addError}</p>}

        {/* Competitor Summary Table */}
        {competitors.length > 0 && profile && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Account</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Followers</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Posts</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Your account */}
                  <tr className="border-b border-slate-100 bg-indigo-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Star className="w-3 h-3 text-indigo-500" />
                        </div>
                        <span className="font-medium text-indigo-700">@{profile.username}</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">You</span>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 font-semibold text-slate-700">{fmt(profile.followers)}</td>
                    <td className="text-right px-4 py-3 text-slate-600">{fmt(profile.posts)}</td>
                    <td className="text-right px-4 py-3">
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Baseline</span>
                    </td>
                    <td></td>
                  </tr>
                  {/* Competitors */}
                  {competitors.map(c => {
                    const cp = competitorProfiles[c.username];
                    const growingFaster = cp && profile && cp.followers > profile.followers;
                    return (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {cp?.profilePicUrl ? (
                              <img src={proxyImg(cp.profilePicUrl)} className="w-6 h-6 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {c.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-slate-700">@{c.username}</span>
                            {cp?.isVerified && <span className="text-[10px] text-blue-500">✓</span>}
                          </div>
                        </td>
                        <td className="text-right px-4 py-3 font-semibold text-slate-700">
                          {cp ? fmt(cp.followers) : <span className="text-slate-300">Loading...</span>}
                        </td>
                        <td className="text-right px-4 py-3 text-slate-600">
                          {cp ? fmt(cp.posts) : '--'}
                        </td>
                        <td className="text-right px-4 py-3">
                          {cp && growingFaster && (
                            <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                              Larger Audience
                            </span>
                          )}
                          {cp && !growingFaster && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                              You Lead
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleRemove(c.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed comparison cards */}
        {competitors.map(c => {
          const cp = competitorProfiles[c.username];
          if (!cp || !profile) return null;
          return (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {cp.profilePicUrl ? (
                    <img src={proxyImg(cp.profilePicUrl)} className="w-10 h-10 rounded-full object-cover border border-slate-200" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                      {c.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-slate-800">@{cp.username}</h4>
                    {cp.fullName && <p className="text-xs text-slate-400">{cp.fullName}</p>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">You</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">Them</span>
                </div>
              </div>
              <ComparisonBar label="Followers" yours={profile.followers} theirs={cp.followers} />
              <ComparisonBar label="Posts" yours={profile.posts} theirs={cp.posts} />
              <ComparisonBar label="Following" yours={profile.following} theirs={cp.following} />
            </div>
          );
        })}

        {/* Empty state */}
        {!loading && competitors.length === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Target className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="text-sm font-semibold text-slate-600 mb-1">No competitors tracked yet</h3>
            <p className="text-xs text-slate-400">Add an Instagram username above to start comparing metrics.</p>
          </div>
        )}
      </div>
    </AccessGate>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Digest Settings (Wave 3)
   ═══════════════════════════════════════════════════════════════════════════ */
const DigestSettings = ({ user, tier }) => {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState({
    email_enabled: false,
    frequency: 'weekly',
    day_of_week: 1,
    include_competitors: true,
    include_alerts: true,
    include_recommendations: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load preferences
  useEffect(() => {
    if (!user?.id) return;
    getDigestPreferences(user.id).then(data => {
      if (data) setPrefs(data);
      setLoaded(true);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await upsertDigestPreferences(user.id, {
        email_enabled: prefs.email_enabled,
        frequency: prefs.frequency,
        day_of_week: prefs.day_of_week,
        include_competitors: prefs.include_competitors,
        include_alerts: prefs.include_alerts,
        include_recommendations: prefs.include_recommendations,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save digest preferences:', err);
    }
    setSaving(false);
  };

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <AccessGate tier={tier} feature="insights.basic">
      <div className="bg-white rounded-2xl border border-slate-200 mb-8 overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
              <Mail className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-slate-900 text-sm">Email Digest Settings</h3>
              <p className="text-[10px] text-slate-400">Configure automated reports delivered to your inbox</p>
            </div>
          </div>
          <ChevronUp className={`w-5 h-5 text-slate-400 transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>

        {/* Settings panel */}
        {open && (
          <div className="px-4 sm:px-6 pb-6 border-t border-slate-100 pt-4 space-y-5 animate-in fade-in duration-200">
            {/* Email display */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Delivery Email</label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">
                {user?.email || 'Not signed in'}
              </div>
            </div>

            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">Enable Email Digest</label>
                <p className="text-[10px] text-slate-400">Receive automated analytics reports</p>
              </div>
              <button
                onClick={() => setPrefs(p => ({ ...p, email_enabled: !p.email_enabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${prefs.email_enabled ? 'bg-indigo-500' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs.email_enabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            {prefs.email_enabled && (
              <>
                {/* Frequency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Frequency</label>
                    <select
                      value={prefs.frequency}
                      onChange={e => setPrefs(p => ({ ...p, frequency: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                  {prefs.frequency === 'weekly' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Day of Week</label>
                      <select
                        value={prefs.day_of_week}
                        onChange={e => setPrefs(p => ({ ...p, day_of_week: parseInt(e.target.value) }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none"
                      >
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Include in digest:</label>
                  {[
                    { key: 'include_competitors', label: 'Competitor alerts', icon: <Target className="w-3.5 h-3.5" /> },
                    { key: 'include_alerts', label: 'Tracking changes', icon: <Bell className="w-3.5 h-3.5" /> },
                    { key: 'include_recommendations', label: 'Recommendations', icon: <Sparkles className="w-3.5 h-3.5" /> },
                  ].map(({ key, label, icon }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          prefs[key] ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 group-hover:border-indigo-300'
                        }`}
                        onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                      >
                        {prefs[key] && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="flex items-center gap-1.5 text-sm text-slate-600">{icon} {label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Preferences'}
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                Preview Digest
              </button>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPreview(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Digest Preview</h3>
                <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-4 text-sm">
                <div className="text-center pb-3 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-2">
                    <Activity className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h4 className="font-bold text-slate-800">Activity Mint Weekly Digest</h4>
                  <p className="text-[10px] text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <h5 className="font-semibold text-slate-700 text-xs mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Account Highlights
                  </h5>
                  <p className="text-xs text-slate-500">Your followers grew by <span className="text-emerald-600 font-semibold">+127</span> this week.</p>
                  <p className="text-xs text-slate-500 mt-1">Engagement rate: <span className="font-semibold">3.2%</span> (up 0.4% from last week)</p>
                </div>
                {prefs.include_competitors && (
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <h5 className="font-semibold text-slate-700 text-xs mb-2 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-500" /> Competitor Alerts
                    </h5>
                    <p className="text-xs text-slate-500">@competitor1 gained <span className="text-amber-600 font-semibold">+340 followers</span> this week.</p>
                  </div>
                )}
                {prefs.include_recommendations && (
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <h5 className="font-semibold text-slate-700 text-xs mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Recommendations
                    </h5>
                    <p className="text-xs text-slate-500">Post more carousels -- they get 2.1x higher engagement for your account.</p>
                  </div>
                )}
                <p className="text-[10px] text-center text-slate-400 pt-2">This is a preview. Actual data will populate in real digests.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AccessGate>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 1 — Activity Analytics
   ═══════════════════════════════════════════════════════════════════════════ */
const ActivityTab = ({ profile, posts, tier, avgEngagement, totalLikes, totalComments, dayRange }) => {
  // Best performing content — sort by engagement
  const sortedPosts = [...posts].sort((a, b) => ((b.likesCount || 0) + (b.commentsCount || 0)) - ((a.likesCount || 0) + (a.commentsCount || 0)));
  const topPosts = sortedPosts.slice(0, 6);

  // Posting heatmap from real timestamps
  const postsByDay = {};
  posts.forEach(p => {
    if (!p.timestamp) return;
    const d = new Date(p.timestamp);
    const key = d.toISOString().split('T')[0];
    postsByDay[key] = (postsByDay[key] || 0) + 1;
  });

  // Generate heatmap for last N days
  const heatmapDays = [];
  for (let i = dayRange - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    heatmapDays.push({ date: key, count: postsByDay[key] || 0, day: d.getDay() });
  }
  const maxPosts = Math.max(1, ...heatmapDays.map(d => d.count));

  // Extract top hashtags with counts
  const hashtagCounts = {};
  posts.forEach(p => {
    const tags = ((p.caption || '').match(/#\w+/g) || []);
    tags.forEach(t => { hashtagCounts[t.toLowerCase()] = (hashtagCounts[t.toLowerCase()] || 0) + 1; });
  });
  const topHashtags = Object.entries(hashtagCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatCard icon={<Heart className="w-4 h-4" />} label="Total Likes" value={fmt(totalLikes)} sub={`across ${posts.length} posts`} color="rose" />
        <StatCard icon={<MessageSquare className="w-4 h-4" />} label="Total Comments" value={fmt(totalComments)} sub="engagement signals" color="indigo" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Engagement Rate" value={pct(avgEngagement)} sub="avg per post" color="emerald" />
        <StatCard icon={<BarChart2 className="w-4 h-4" />} label="Posts Analyzed" value={String(posts.length)} sub="recent posts" color="purple" />
      </div>

      {/* Best Performing Content */}
      {topPosts.length > 0 && (
        <div>
          <SectionHeader icon={<Award className="w-5 h-5 text-amber-500" />} title="Best Performing Content">
            <span className="text-xs text-slate-400">by engagement</span>
          </SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {topPosts.map((post, i) => {
              const eng = (post.likesCount || 0) + (post.commentsCount || 0);
              return (
                <div key={i} className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100">
                  {(post.displayUrl || post.imageUrl) ? (
                    <img src={proxyImg(post.displayUrl || post.imageUrl)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8" /></div>
                  )}
                  {i === 0 && <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Top Post</div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 sm:p-3">
                    <div className="text-white text-xs space-y-0.5 w-full">
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {fmt(post.likesCount)}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {fmt(post.commentsCount)}</span>
                      </div>
                      {post.caption && <p className="line-clamp-2 text-[10px] opacity-80">{post.caption.substring(0, 80)}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Content Type Breakdown ─────────────────────────────────────── */}
      {posts.length > 0 && (() => {
        const typeMap = {};
        const followerCount = profile?.followersCount || profile?.followers_count || 1;
        posts.forEach(p => {
          let t = (p.type || p.mediaType || p.productType || 'image').toLowerCase();
          if (t === 'sidecar' || t === 'carousel_album' || t === 'graphsidecar') t = 'carousel';
          else if (t === 'clips' || t === 'reel' || t === 'graphreel') t = 'reel';
          else if (t === 'graphvideo' || t === 'video') t = 'video';
          else if (t === 'graphimage' || t === 'photo') t = 'image';
          if (!typeMap[t]) typeMap[t] = { count: 0, totalEng: 0 };
          typeMap[t].count++;
          typeMap[t].totalEng += ((p.likesCount || 0) + (p.commentsCount || 0)) / followerCount * 100;
        });
        const types = Object.entries(typeMap).map(([name, d]) => ({
          name, count: d.count, avgEng: d.count > 0 ? d.totalEng / d.count : 0,
        })).sort((a, b) => b.avgEng - a.avgEng);
        const maxEng = Math.max(1, ...types.map(t => t.avgEng));
        const best = types[0];
        const worst = types.length > 1 ? types[types.length - 1] : null;
        const typeColors = { carousel: 'bg-purple-500', reel: 'bg-rose-500', video: 'bg-indigo-500', image: 'bg-emerald-500' };
        const typeIcons = { carousel: '📎', reel: '🎬', video: '🎥', image: '📷' };
        return (
          <div>
            <SectionHeader icon={<Layers className="w-5 h-5 text-purple-500" />} title="Content Type Breakdown" badge="Wave 1" />
            <div className="bg-slate-50 rounded-xl p-4 sm:p-6">
              <div className="space-y-3">
                {types.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg w-6 text-center">{typeIcons[t.name] || '📌'}</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 w-20 capitalize">{t.name}</span>
                    <div className="flex-1 h-6 bg-white rounded-full overflow-hidden relative">
                      <div className={`h-full ${typeColors[t.name] || 'bg-slate-400'} rounded-full transition-all duration-500`} style={{ width: `${(t.avgEng / maxEng) * 100}%` }} />
                      <span className="absolute inset-0 flex items-center px-3 text-[10px] sm:text-xs font-semibold text-slate-700">{t.avgEng.toFixed(2)}% avg eng</span>
                    </div>
                    <span className="text-xs text-slate-400 w-16 text-right">{t.count} post{t.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
              {best && worst && best.name !== worst.name && (
                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-purple-700">
                    Your <strong className="capitalize">{best.name}s</strong> get{' '}
                    <strong>{worst.avgEng > 0 ? ((best.avgEng / worst.avgEng - 1) * 100).toFixed(0) : '∞'}% more engagement</strong>{' '}
                    than <strong className="capitalize">{worst.name}s</strong>. Consider posting more {best.name} content.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Posting Activity Heatmap — from real data */}
      <div>
        <SectionHeader icon={<Calendar className="w-5 h-5 text-emerald-500" />} title="Posting Activity">
          <span className="text-xs text-slate-400">last {dayRange} days</span>
        </SectionHeader>
        <div className="bg-slate-50 rounded-xl p-3 sm:p-6">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(dayRange, 7)}, 1fr)` }}>
            {heatmapDays.map((d, i) => {
              const intensity = d.count / maxPosts;
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-sm ${
                    d.count === 0 ? 'bg-slate-100' :
                    intensity > 0.7 ? 'bg-indigo-500' :
                    intensity > 0.3 ? 'bg-indigo-300' : 'bg-indigo-100'
                  }`}
                  title={`${d.date}: ${d.count} post${d.count !== 1 ? 's' : ''}`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
            <span>{dayRange} days ago</span>
            <div className="flex items-center gap-1">
              <span>Less</span>
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-100" />
              <div className="w-2.5 h-2.5 rounded-sm bg-indigo-100" />
              <div className="w-2.5 h-2.5 rounded-sm bg-indigo-300" />
              <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
              <span>More</span>
            </div>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* ── Best Time to Post Heatmap ────────────────────────────────────── */}
      {posts.length >= 3 && (
        <AccessGate tier={tier} required="standard">
          <div>
            <SectionHeader icon={<Clock className="w-5 h-5 text-teal-500" />} title="Best Time to Post" badge="Wave 1">
              <span className="text-xs text-slate-400">by engagement</span>
            </SectionHeader>
            {(() => {
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const grid = {};
              dayNames.forEach((_, d) => { for (let h = 0; h < 24; h++) grid[`${d}-${h}`] = { total: 0, count: 0 }; });
              const followerCount = profile?.followersCount || profile?.followers_count || 1;
              posts.forEach(p => {
                if (!p.timestamp) return;
                const d = new Date(p.timestamp);
                const key = `${d.getDay()}-${d.getHours()}`;
                const eng = ((p.likesCount || 0) + (p.commentsCount || 0)) / followerCount * 100;
                if (grid[key]) { grid[key].total += eng; grid[key].count += 1; }
              });
              const cells = [];
              let maxEng = 0;
              dayNames.forEach((_, d) => {
                for (let h = 0; h < 24; h++) {
                  const k = `${d}-${h}`;
                  const avg = grid[k].count > 0 ? grid[k].total / grid[k].count : 0;
                  if (avg > maxEng) maxEng = avg;
                  cells.push({ day: d, hour: h, avg, count: grid[k].count });
                }
              });
              const topSlots = [...cells].filter(c => c.count > 0).sort((a, b) => b.avg - a.avg).slice(0, 3);
              const topSet = new Set(topSlots.map(s => `${s.day}-${s.hour}`));
              return (
                <div className="bg-slate-50 rounded-xl p-3 sm:p-6 overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="grid gap-px" style={{ gridTemplateColumns: '40px repeat(24, 1fr)', gridTemplateRows: 'auto repeat(7, 1fr)' }}>
                      <div />
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="text-[8px] sm:text-[10px] text-slate-400 text-center pb-1">{h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`}</div>
                      ))}
                      {dayNames.map((name, d) => (
                        <React.Fragment key={d}>
                          <div className="text-[10px] sm:text-xs text-slate-500 font-medium flex items-center pr-1">{name}</div>
                          {Array.from({ length: 24 }, (_, h) => {
                            const cell = cells[d * 24 + h];
                            const intensity = maxEng > 0 ? cell.avg / maxEng : 0;
                            const isTop = topSet.has(`${d}-${h}`);
                            return (
                              <div
                                key={h}
                                className={`aspect-square rounded-sm relative ${
                                  cell.count === 0 ? 'bg-slate-100' :
                                  intensity > 0.75 ? 'bg-teal-500' :
                                  intensity > 0.5 ? 'bg-teal-400' :
                                  intensity > 0.25 ? 'bg-teal-300' : 'bg-teal-100'
                                }`}
                                title={`${name} ${h}:00 — ${cell.count} posts, avg ${cell.avg.toFixed(2)}% eng`}
                              >
                                {isTop && <span className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[10px]">{'⭐'}</span>}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <span>Low</span>
                      <div className="w-2.5 h-2.5 rounded-sm bg-slate-100" />
                      <div className="w-2.5 h-2.5 rounded-sm bg-teal-100" />
                      <div className="w-2.5 h-2.5 rounded-sm bg-teal-300" />
                      <div className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
                      <span>High Engagement</span>
                    </div>
                    {topSlots.length > 0 && (
                      <span>{'⭐'} = Top {topSlots.length} slot{topSlots.length !== 1 ? 's' : ''}: {topSlots.map(s => `${dayNames[s.day]} ${s.hour}:00`).join(', ')}</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </AccessGate>
      )}

      {/* Top Hashtags from real data */}
      {topHashtags.length > 0 && (
        <div>
          <SectionHeader icon={<Hash className="w-5 h-5 text-indigo-500" />} title="Top Hashtags">
            <span className="text-xs text-slate-400">{topHashtags.length} found</span>
          </SectionHeader>
          <div className="flex flex-wrap gap-2">
            {topHashtags.map(([tag, count], i) => (
              <span key={i} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-100">
                {tag} <span className="text-indigo-400">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Hashtag ROI Tracker ───────────────────────────────────────── */}
      {posts.length >= 3 && (() => {
        const followerCount = profile?.followersCount || profile?.followers_count || 1;
        const overallAvg = avgEngagement || 0;
        // Build per-hashtag engagement map
        const tagEngMap = {};
        posts.forEach(p => {
          const tags = ((p.caption || '').match(/#\w+/g) || []).map(t => t.toLowerCase());
          const eng = ((p.likesCount || 0) + (p.commentsCount || 0)) / followerCount * 100;
          tags.forEach(tag => {
            if (!tagEngMap[tag]) tagEngMap[tag] = { totalEng: 0, count: 0 };
            tagEngMap[tag].totalEng += eng;
            tagEngMap[tag].count++;
          });
        });
        // Only hashtags used 2+ times
        const tagRows = Object.entries(tagEngMap)
          .filter(([, d]) => d.count >= 2)
          .map(([tag, d]) => {
            const avg = d.totalEng / d.count;
            const roi = overallAvg > 0 ? avg / overallAvg : 0;
            return { tag, avg, count: d.count, roi };
          })
          .sort((a, b) => b.roi - a.roi);
        const totalUnique = Object.keys(tagEngMap).length;
        const golden = tagRows.slice(0, 3).filter(r => r.roi > 1);
        const maxAvg = Math.max(1, ...tagRows.map(r => r.avg));
        return (
          <AccessGate tier={tier} required="standard">
            <div>
              <SectionHeader icon={<Hash className="w-5 h-5 text-emerald-500" />} title="Hashtag ROI Tracker" badge="Wave 2">
                <span className="text-xs text-slate-400">{totalUnique} unique tags</span>
              </SectionHeader>
              {tagRows.length > 0 ? (
                <div className="bg-emerald-50 rounded-xl p-4 sm:p-6 border border-emerald-200">
                  {/* Golden hashtags */}
                  {golden.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Golden Hashtags</p>
                      <div className="flex flex-wrap gap-2">
                        {golden.map((r, i) => (
                          <span key={i} className="bg-gradient-to-r from-amber-100 to-amber-50 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300 flex items-center gap-1.5">
                            <Trophy className="w-3 h-3 text-amber-500" />
                            {r.tag}
                            <span className="bg-amber-200 text-amber-900 text-[10px] px-1.5 py-0.5 rounded-full">{r.roi.toFixed(1)}x</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Hashtag table */}
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {tagRows.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 sm:gap-3 bg-white rounded-lg px-3 py-2">
                        <span className="text-xs sm:text-sm font-medium text-slate-700 w-28 sm:w-36 truncate">{r.tag}</span>
                        <div className="flex-1 h-4 bg-emerald-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${r.roi >= 1 ? 'bg-emerald-500' : 'bg-rose-400'}`}
                            style={{ width: `${(r.avg / maxAvg) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] sm:text-xs text-slate-500 w-16 text-right">{r.avg.toFixed(2)}%</span>
                        <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          r.roi >= 1.5 ? 'bg-emerald-100 text-emerald-700' :
                          r.roi >= 1 ? 'bg-emerald-50 text-emerald-600' :
                          'bg-rose-50 text-rose-600'
                        }`}>
                          {r.roi >= 1 ? '↑' : '↓'} {r.roi.toFixed(1)}x
                        </span>
                        <span className="text-[10px] text-slate-400 w-8 text-right">{r.count}x</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 bg-emerald-100 rounded-lg p-3 flex items-start gap-2">
                    <Zap className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-emerald-700">
                      {golden.length > 0
                        ? <><strong>Top performer:</strong> {golden[0].tag} drives <strong>{golden[0].roi.toFixed(1)}x</strong> your average engagement. Double down on it.</>
                        : <strong>No hashtags are outperforming your average yet.</strong>}
                      {' '}ROI is calculated as hashtag avg engagement / overall avg ({pct(overallAvg)}).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl">
                  <Hash className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hashtags used 2+ times. Need more post data for ROI tracking.</p>
                </div>
              )}
            </div>
          </AccessGate>
        );
      })()}

      {/* Recent posts grid */}
      <div>
        <SectionHeader icon={<LayoutGrid className="w-5 h-5 text-indigo-500" />} title="Recent Posts">
          <span className="text-xs text-slate-400">{posts.length} posts loaded</span>
        </SectionHeader>
        {posts.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            {posts.map((post, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100">
                {(post.displayUrl || post.imageUrl) ? (
                  <img src={proxyImg(post.displayUrl || post.imageUrl)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-6 sm:w-8 h-6 sm:h-8" /></div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 sm:gap-3 text-white text-[10px] sm:text-xs font-semibold">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {fmt(post.likesCount)}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {fmt(post.commentsCount)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 sm:py-16 text-slate-400">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No posts data available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2 — Ties & Trails
   ═══════════════════════════════════════════════════════════════════════════ */
const TiesTab = ({ profile, posts, tier, followers, following }) => {
  const [expandedCommenter, setExpandedCommenter] = useState(null);

  // Extract top commenters WITH their actual comments
  const commenterMap = {};
  posts.forEach(post => {
    (post.latestComments || []).forEach(c => {
      const u = c.ownerUsername || 'unknown';
      if (!commenterMap[u]) commenterMap[u] = { count: 0, comments: [], profilePic: c.ownerProfilePicUrl || '' };
      commenterMap[u].count += 1;
      commenterMap[u].comments.push({
        text: c.text || '',
        timestamp: c.timestamp || '',
        likes: c.likesCount || 0,
      });
    });
  });
  const topCommenters = Object.entries(commenterMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([username, data]) => ({ username, ...data }));

  // Follower/Following comparison — real data
  const followerUsernames = new Set(followers.map(f => (f.username || f.handle || f.login || '').toLowerCase()));
  const followingUsernames = new Set(following.map(f => (f.username || f.handle || f.login || '').toLowerCase()));
  const mutualCount = [...followingUsernames].filter(u => followerUsernames.has(u)).length;
  const notFollowingBack = following.filter(f => !followerUsernames.has((f.username || f.handle || f.login || '').toLowerCase()));
  const fansOnly = followers.filter(f => !followingUsernames.has((f.username || f.handle || f.login || '').toLowerCase()));

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Follower / Following Summary — REAL DATA */}
      <div>
        <SectionHeader icon={<Users className="w-5 h-5 text-indigo-500" />} title="Follow Relationship Analysis" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <StatCard icon={<Users className="w-4 h-4" />} label="Followers" value={fmt(followers.length)} sub="fetched" color="indigo" />
          <StatCard icon={<UserCheck className="w-4 h-4" />} label="Following" value={fmt(following.length)} sub="fetched" color="emerald" />
          <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Mutual" value={fmt(mutualCount)} sub="follow each other" color="purple" />
          <StatCard icon={<UserMinus className="w-4 h-4" />} label="Don't Follow Back" value={fmt(notFollowingBack.length)} sub="one-way" color="rose" />
        </div>
        {followers.length === 0 && following.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">Follower/following data is loading or the account may be private.</p>
        )}
      </div>

      {/* Top interactors with expandable comments */}
      <div>
        <SectionHeader icon={<MessageSquare className="w-5 h-5 text-indigo-500" />} title="Most Active Commenters">
          <span className="text-xs text-slate-400">{topCommenters.length} found</span>
        </SectionHeader>
        {topCommenters.length > 0 ? (
          <div className="space-y-1">
            {topCommenters.map((user, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedCommenter(expandedCommenter === i ? null : i)}
                  className="w-full flex items-center gap-2 sm:gap-3 bg-slate-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-slate-100 transition-colors text-left min-h-[44px]"
                >
                  <span className="text-xs font-bold text-slate-400 w-5 sm:w-6 shrink-0">{i + 1}</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shrink-0">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-700 flex-1 text-sm truncate">@{user.username}</span>
                  <span className="text-xs sm:text-sm font-semibold text-indigo-600 shrink-0">{user.count} comments</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expandedCommenter === i ? 'rotate-180' : ''}`} />
                </button>
                {/* Expanded comments dropdown */}
                {expandedCommenter === i && (
                  <div className="ml-8 sm:ml-12 mt-1 mb-2 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    {user.comments.slice(0, 5).map((c, j) => (
                      <div key={j} className="bg-white rounded-lg px-3 py-2 border border-slate-100 text-xs sm:text-sm">
                        <p className="text-slate-700">{c.text || '(no text)'}</p>
                        <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                          {c.timestamp && <span>{ago(c.timestamp)}</span>}
                          {c.likes > 0 && <span>{c.likes} likes</span>}
                        </div>
                      </div>
                    ))}
                    {user.comments.length > 5 && (
                      <p className="text-[10px] text-slate-400 pl-3">+{user.comments.length - 5} more comments</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No commenter data available. Needs posts with comments.</p>
          </div>
        )}
      </div>

      {/* Super Fan Leaderboard — cross-reference followers + commenters */}
      {fansOnly.length > 0 && (() => {
        const commenterUsernames = new Set(topCommenters.map(c => c.username.toLowerCase()));
        const fanScores = fansOnly.map(f => {
          const uname = (f.username || f.handle || f.login || '').toLowerCase();
          const commenterData = topCommenters.find(c => c.username.toLowerCase() === uname);
          const commentCount = commenterData ? commenterData.count : 0;
          const isSuper = commenterUsernames.has(uname);
          const fanScore = commentCount * 2 + (isSuper ? 5 : 0);
          return { ...f, uname, commentCount, isSuper, fanScore, commenterData };
        }).sort((a, b) => b.fanScore - a.fanScore);
        const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
        return (
          <div>
            <SectionHeader icon={<Trophy className="w-5 h-5 text-amber-500" />} title="Fan Leaderboard">
              <span className="text-xs text-slate-400">{fansOnly.length} fans {fanScores.filter(f => f.isSuper).length > 0 && <span className="text-amber-500 font-semibold ml-1">{fanScores.filter(f => f.isSuper).length} Super Fans</span>}</span>
            </SectionHeader>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {fanScores.slice(0, 25).map((f, i) => {
                const picUrl = f.profile_pic_url || f.profilePicUrl || '';
                return (
                  <div key={i} className={`flex items-center gap-2 sm:gap-3 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm transition-colors ${f.isSuper ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                    <span className="w-7 text-center shrink-0">
                      {i < 3 ? <span className="text-lg">{medals[i]}</span> : <span className="text-xs font-bold text-slate-400">#{i+1}</span>}
                    </span>
                    {picUrl && !picUrl.includes('default') ? (
                      <img src={proxyImg(picUrl)} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-white shadow-sm" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {f.uname.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-700 truncate">@{f.uname}</span>
                        {f.is_verified && <span className="text-blue-500 text-[10px]">&#10003;</span>}
                        {f.isSuper && <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">SUPER FAN</span>}
                      </div>
                      {f.commentCount > 0 && <span className="text-[10px] text-slate-400">{f.commentCount} comment{f.commentCount !== 1 ? 's' : ''}</span>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-amber-600">{f.fanScore}</div>
                      <div className="text-[9px] text-slate-400">score</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {fanScores.filter(f => f.isSuper).length > 0 && (
              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> Super Fans follow you AND actively comment on your posts</p>
            )}
          </div>
        );
      })()}

      {/* ── Follower Demographics (Inferred) ─────────────────────────────── */}
      {followers.length > 0 && (
        <AccessGate tier={tier} required="standard">
          <SectionHeader icon={<Target className="w-5 h-5 text-purple-500" />} title="Follower Demographics" badge="Inferred">
            <FollowerDemographics followers={followers} />
          </SectionHeader>
        </AccessGate>
      )}

      {/* ── Ghost Follower Detector ──────────────────────────────────────── */}
      {followers.length > 0 && (() => {
        const ghosts = followers.map(f => {
          let flags = 0;
          const mediaCount = f.mediaCount ?? f.edge_owner_to_timeline_media?.count ?? null;
          if (mediaCount === 0) flags++;
          const pic = f.profile_pic_url || f.profilePicUrl || '';
          if (!pic || pic.includes('default')) flags++;
          const followingCount = f.followingCount ?? f.edge_follow?.count ?? 0;
          if (followingCount >= 1500) flags++;
          return { ...f, ghostFlags: flags, mediaCount, followingCount };
        });
        const definite = ghosts.filter(g => g.ghostFlags === 3).length;
        const likely = ghosts.filter(g => g.ghostFlags === 2).length;
        const suspicious = ghosts.filter(g => g.ghostFlags === 1).length;
        const totalGhosts = definite + likely;
        const ghostPct = followers.length > 0 ? ((totalGhosts / followers.length) * 100).toFixed(1) : 0;
        const topGhosts = ghosts.filter(g => g.ghostFlags >= 2).sort((a, b) => b.ghostFlags - a.ghostFlags).slice(0, 20);
        const maxBar = Math.max(definite, likely, suspicious, 1);
        return (
          <AccessGate tier={tier} required="standard">
            <div>
              <SectionHeader icon={<ShieldAlert className="w-5 h-5 text-rose-500" />} title="Ghost Follower Detector" badge="Wave 1" />
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 sm:p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl sm:text-3xl font-bold text-rose-600">{ghostPct}%</p>
                    <p className="text-[10px] sm:text-xs text-rose-500">Ghost Rate</p>
                  </div>
                  <div className="flex-1 text-xs text-slate-600">
                    Out of <strong>{followers.length}</strong> followers analyzed, <strong>{totalGhosts}</strong> show ghost-like behavior (no posts, no profile pic, or mass-following patterns).
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {[
                    { label: 'Definite Ghosts (3/3 flags)', count: definite, color: 'bg-rose-500' },
                    { label: 'Likely Ghosts (2/3 flags)', count: likely, color: 'bg-orange-400' },
                    { label: 'Suspicious (1/3 flags)', count: suspicious, color: 'bg-amber-300' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] sm:text-xs text-slate-600 w-40 sm:w-48 shrink-0">{row.label}</span>
                      <div className="flex-1 h-4 bg-white rounded-full overflow-hidden">
                        <div className={`h-full ${row.color} rounded-full transition-all duration-500`} style={{ width: `${(row.count / maxBar) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-10 text-right">{row.count}</span>
                    </div>
                  ))}
                </div>
                {topGhosts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Top Ghost Accounts</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {topGhosts.map((g, i) => {
                        const uname = g.username || g.handle || g.login || 'unknown';
                        return (
                          <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 text-xs">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${g.ghostFlags === 3 ? 'bg-rose-500' : 'bg-orange-400'}`} />
                            <span className="font-medium text-slate-700 truncate flex-1">@{uname}</span>
                            <span className="text-slate-400">{g.mediaCount ?? '?'} posts</span>
                            <span className="text-slate-400">{fmt(g.followingCount)} following</span>
                            <span className="font-semibold text-rose-500">{g.ghostFlags}/3</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </AccessGate>
        );
      })()}

      {/* ── Secret Admirers ─────────────────────────────────────────────── */}
      {(() => {
        // Cross-reference commenters who are NOT followers
        const admirers = Object.entries(commenterMap)
          .filter(([username]) => !followerUsernames.has(username.toLowerCase()))
          .map(([username, data]) => {
            const comments = data.comments || [];
            const avgLen = comments.length > 0 ? comments.reduce((s, c) => s + (c.text || '').length, 0) / comments.length : 0;
            // Count unique posts they commented on
            const postsCommented = new Set();
            posts.forEach(post => {
              (post.latestComments || []).forEach(c => {
                if ((c.ownerUsername || '').toLowerCase() === username.toLowerCase()) {
                  postsCommented.add(post.url || post.shortCode || Math.random());
                }
              });
            });
            const consistency = postsCommented.size;
            // Quality score: longer comments and engagement across multiple posts
            const quality = Math.min(100, Math.round(avgLen * 0.5 + consistency * 15 + data.count * 10));
            return { username, count: data.count, comments, avgLen, consistency, quality, profilePic: data.profilePic || '' };
          })
          .filter(a => a.count >= 2)
          .sort((a, b) => b.quality - a.quality)
          .slice(0, 10);
        if (admirers.length === 0) return null;
        return (
          <AccessGate tier={tier} required="standard">
            <div>
              <SectionHeader icon={<HeartHandshake className="w-5 h-5 text-pink-500" />} title="Secret Admirers" badge="Wave 2">
                <span className="text-xs text-slate-400">{admirers.length} found</span>
              </SectionHeader>
              <div className="bg-pink-50 rounded-xl p-4 sm:p-6 border border-pink-200">
                <p className="text-xs text-pink-600 mb-4">
                  These users frequently comment on your posts but are <strong>not following you</strong>. They engage but haven't hit follow yet!
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {admirers.map((a, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 sm:p-4 border border-pink-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {a.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-700 text-sm truncate">@{a.username}</p>
                          <p className="text-[10px] text-slate-400">{a.count} comments across {a.consistency} post{a.consistency !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="bg-pink-100 text-pink-700 text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
                          Not Following
                        </span>
                      </div>
                      {/* Quality bar */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-slate-500 w-14 shrink-0">Quality</span>
                        <div className="flex-1 h-2 bg-pink-100 rounded-full overflow-hidden">
                          <div className="h-full bg-pink-400 rounded-full transition-all duration-500" style={{ width: `${a.quality}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-pink-600 w-8 text-right">{a.quality}</span>
                      </div>
                      {/* Sample comment */}
                      {a.comments[0] && (
                        <div className="bg-pink-50 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 italic border border-pink-100">
                          &ldquo;{(a.comments[0].text || '').substring(0, 100)}{(a.comments[0].text || '').length > 100 ? '...' : ''}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AccessGate>
        );
      })()}
    </div>
  );
};

/* ─── Follower Demographics Component ──────────────────────────────────── */
const FollowerDemographics = ({ followers }) => {
  // Analyze follower quality
  const total = followers.length;
  let withPic = 0, withPosts = 0, suspected = 0, business = 0;
  followers.forEach(f => {
    if (f.profile_pic_url || f.profilePicUrl) withPic++;
    const pc = f.edge_owner_to_timeline_media?.count || f.postsCount || f.mediaCount || 0;
    if (pc > 0) withPosts++;
    // Suspected bot heuristics: no pic + no posts + generic username patterns
    const uname = (f.username || '').toLowerCase();
    const isGeneric = /^\w+\d{4,}$/.test(uname) || /^[a-z]{2,4}\.\w+\.\d+/.test(uname);
    if (!f.profile_pic_url && !f.profilePicUrl && pc === 0 && isGeneric) suspected++;
    // Business indicator: has "official", "shop", "store", "brand" in username/fullName
    const fullName = (f.full_name || f.fullName || '').toLowerCase();
    if (/shop|store|brand|official|agency|studio|media|marketing/.test(uname + ' ' + fullName)) business++;
  });
  const quality = total > 0 ? Math.round(((withPic + withPosts) / (2 * total)) * 100) : 0;
  const botPct = total > 0 ? Math.round((suspected / total) * 100) : 0;
  const personalPct = total > 0 ? Math.round(((total - business) / total) * 100) : 0;
  const businessPct = 100 - personalPct;

  const DonutChart = ({ pct: val, color, label }) => {
    const r = 28, circ = 2 * Math.PI * r;
    return (
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 68 68" className="w-16 h-16 -rotate-90">
          <circle cx="34" cy="34" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={circ - (val / 100) * circ} strokeLinecap="round" />
        </svg>
        <span className="text-lg font-bold mt-1" style={{ color }}>{val}%</span>
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
      <DonutChart pct={quality} color="#10b981" label="Quality Score" />
      <DonutChart pct={botPct} color={botPct > 20 ? '#ef4444' : '#f59e0b'} label="Suspected Bots" />
      <DonutChart pct={personalPct} color="#6366f1" label="Personal" />
      <DonutChart pct={businessPct} color="#8b5cf6" label="Business" />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 3 — Stories & Highlights
   ═══════════════════════════════════════════════════════════════════════════ */
const StoriesTab = ({ profile, stories, tier }) => (
  <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
    <div>
      <SectionHeader icon={<MonitorPlay className="w-5 h-5 text-indigo-500" />} title="Active Stories">
        <span className="text-xs text-slate-400">{stories.length} stories</span>
      </SectionHeader>
      {stories.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
          {stories.map((story, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-slate-100 aspect-[9/16] relative group shadow-sm hover:shadow-lg transition-shadow">
              {story.imageUrl || story.videoUrl ? (
                story.videoUrl ? (
                  <video src={proxyImg(story.videoUrl)} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={proxyImg(story.imageUrl)} alt="" className="w-full h-full object-cover" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center"><MonitorPlay className="w-8 h-8 text-slate-300" /></div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 sm:p-3">
                <p className="text-white text-[10px] sm:text-xs">{ago(story.timestamp || story.takenAtTimestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 sm:py-16 text-slate-400">
          <MonitorPlay className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No active stories right now.</p>
        </div>
      )}
    </div>

    {/* Story stats from real data */}
    <div>
      <SectionHeader icon={<BarChart2 className="w-5 h-5 text-teal-500" />} title="Story Activity" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <StatCard icon={<Camera className="w-4 h-4" />} label="Active Stories" value={String(stories.length)} color="teal" />
        <StatCard icon={<Eye className="w-4 h-4" />} label="Story Type" value={stories.filter(s => s.videoUrl).length > 0 ? 'Mixed' : 'Photos'} sub={`${stories.filter(s => s.videoUrl).length} videos`} color="indigo" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Latest" value={stories.length > 0 ? ago(stories[0]?.timestamp || stories[0]?.takenAtTimestamp) : '--'} color="amber" />
        <StatCard icon={<Hash className="w-4 h-4" />} label="Has Mentions" value={stories.filter(s => (s.mentions || []).length > 0).length > 0 ? 'Yes' : 'No'} color="purple" />
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 4 — Deep Insights (AI-powered analysis from real data)
   ═══════════════════════════════════════════════════════════════════════════ */
function generateInsights(profile, posts, avgEngagement) {
  const totalLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
  const captions = posts.map(p => (p.caption || '').toLowerCase()).filter(Boolean);
  const allText = captions.join(' ');
  const hashtags = allText.match(/#\w+/g) || [];
  const mentions = allText.match(/@\w+/g) || [];
  const uniqueHashtags = [...new Set(hashtags)];
  const uniqueMentions = [...new Set(mentions)];

  // Posting time analysis
  const hours = posts.map(p => p.timestamp ? new Date(p.timestamp).getHours() : null).filter(h => h !== null);
  const avgHour = hours.length > 0 ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null;
  const peakTime = avgHour !== null ? (avgHour < 6 ? 'Night Owl (12am-6am)' : avgHour < 12 ? 'Morning (6am-12pm)' : avgHour < 18 ? 'Afternoon (12pm-6pm)' : 'Evening (6pm-12am)') : 'Unknown';

  // Content theme detection
  const themeMap = {
    fitness: ['fitness','gym','workout','health','fit','training','yoga','running','exercise','muscle'],
    travel: ['travel','wanderlust','adventure','explore','vacation','trip','nature','beach','hiking','flight'],
    food: ['food','foodie','recipe','cooking','yummy','delicious','restaurant','chef','brunch','dinner'],
    fashion: ['fashion','style','outfit','ootd','streetstyle','clothing','model','designer','luxury'],
    tech: ['tech','coding','developer','programming','startup','ai','software','crypto','web3','nft'],
    lifestyle: ['lifestyle','life','daily','mood','vibes','aesthetic','inspo','motivation','mindset'],
    business: ['business','entrepreneur','hustle','money','success','marketing','ceo','founder','growth'],
    art: ['art','artist','creative','design','illustration','photography','photo','film','cinema'],
    music: ['music','song','singer','rapper','producer','hiphop','beats','concert','festival'],
    pets: ['dog','cat','puppy','kitten','pet','animals','rescue','adopt'],
    parenting: ['mom','dad','family','kids','baby','parenting','children','motherhood'],
    beauty: ['beauty','skincare','makeup','glow','selfcare','routine','hair','nails'],
  };
  const themeScores = {};
  for (const [theme, keywords] of Object.entries(themeMap)) {
    themeScores[theme] = keywords.reduce((score, kw) => score + (allText.split(kw).length - 1), 0);
  }
  const topThemes = Object.entries(themeScores).filter(([,v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Emotional tone
  const positiveWords = ['love','happy','amazing','beautiful','grateful','excited','best','great','awesome','blessed','joy','wonderful','fantastic','incredible','proud','thankful','cheers','celebrate'];
  const negativeWords = ['sad','angry','frustrated','hate','disappointed','terrible','worst','annoying','tired','stressed','awful','horrible','miserable','fail','struggle'];
  const posScore = positiveWords.reduce((s, w) => s + (allText.split(w).length - 1), 0);
  const negScore = negativeWords.reduce((s, w) => s + (allText.split(w).length - 1), 0);
  const totalEmotional = posScore + negScore;
  const emotionRatio = totalEmotional > 0 ? posScore / totalEmotional : 0.5;
  const emotionalTone = emotionRatio > 0.75 ? 'Positive & Uplifting' : emotionRatio > 0.55 ? 'Mostly Positive' : emotionRatio > 0.4 ? 'Balanced / Neutral' : 'Reflective & Introspective';

  // MBTI estimation
  const eScore = (profile.following || 0) > 500 ? 60 : 40;
  const nScore = uniqueHashtags.length > 15 ? 65 : 40;
  const fScore = emotionRatio > 0.5 ? 60 : 40;
  const pScore = posts.length > 5 && hours.length > 0 ? (new Set(hours.map(h => Math.floor(h / 6)))).size > 2 ? 60 : 40 : 50;
  const mbti = `${eScore > 50 ? 'E' : 'I'}${nScore > 50 ? 'N' : 'S'}${fScore > 50 ? 'F' : 'T'}${pScore > 50 ? 'P' : 'J'}`;
  const mbtiNames = { ENFP:'Campaigner', ENFJ:'Protagonist', ENTP:'Debater', ENTJ:'Commander', INFP:'Mediator', INFJ:'Advocate', INTP:'Logician', INTJ:'Architect', ESFP:'Entertainer', ESFJ:'Consul', ESTP:'Entrepreneur', ESTJ:'Executive', ISFP:'Adventurer', ISFJ:'Defender', ISTP:'Virtuoso', ISTJ:'Logistician' };
  const mbtiConf = Math.min(90, 45 + posts.length * 2 + uniqueHashtags.length);

  // Growth trajectory
  const followersCount = profile.followers || 0;
  const growthRate = avgEngagement > 3 ? 0.08 : avgEngagement > 1 ? 0.04 : 0.015;
  const predicted30d = Math.round(followersCount * growthRate);

  // Relationship detection
  const mentionCounts = {};
  mentions.forEach(m => { mentionCounts[m] = (mentionCounts[m] || 0) + 1; });
  const strongTies = Object.entries(mentionCounts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);

  // Location extraction from captions
  const locationIndicators = ['in','at','visiting','exploring','arrived','landed','checking out'];
  const locationPatterns = allText.match(/(?:📍|📌|🌍|🗺️|in |at |visiting )\s*[\w\s,]+/g) || [];
  const geoTags = posts.map(p => p.locationName || p.location?.name).filter(Boolean);

  // Emoji analysis
  const emojis = allText.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || [];
  const emojiCounts = {};
  emojis.forEach(e => { emojiCounts[e] = (emojiCounts[e] || 0) + 1; });
  const topEmojis = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Caption language / style
  const avgCaptionLength = captions.length > 0 ? Math.round(captions.reduce((s, c) => s + c.length, 0) / captions.length) : 0;
  const questionsCount = captions.filter(c => c.includes('?')).length;
  const ctaCount = captions.filter(c => c.includes('link in bio') || c.includes('check out') || c.includes('click') || c.includes('swipe up')).length;

  // Posting consistency
  const postDates = posts.map(p => p.timestamp ? new Date(p.timestamp) : null).filter(Boolean).sort((a, b) => a - b);
  const dayGaps = [];
  for (let i = 1; i < postDates.length; i++) {
    dayGaps.push(Math.round((postDates[i] - postDates[i-1]) / 86400000));
  }
  const avgGap = dayGaps.length > 0 ? (dayGaps.reduce((a, b) => a + b, 0) / dayGaps.length).toFixed(1) : null;

  return {
    mbti, mbtiName: mbtiNames[mbti] || 'Analyst', mbtiConf,
    emotionalTone, emotionRatio, posScore, negScore,
    topThemes, topEmojis,
    peakTime, avgHour, hours,
    avgEngagement, totalLikes, totalComments,
    uniqueHashtags, uniqueMentions,
    strongTies, mentionCounts,
    followersCount, predicted30d, growthRate,
    geoTags, locationPatterns,
    avgCaptionLength, questionsCount, ctaCount,
    avgGap, postDates,
    captions, allText,
  };
}

/* ─── Look Deeper Button ───────────────────────────────────────────────── */
const LookDeeperButton = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
        <Search className="w-3.5 h-3.5" />
        {open ? 'Show Less' : 'Look Deeper'} 🔍
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-xs text-slate-700 leading-relaxed border border-indigo-100 animate-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

const InsightsTab = ({ profile, posts, tier, avgEngagement, followers, following }) => {
  const insights = generateInsights(profile, posts, avgEngagement);

  return (
    <AccessGate tier={tier} feature="report.ai-insights">
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* Data quality banner */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 sm:p-4 flex items-start gap-3">
          <Brain className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-purple-800 font-semibold text-xs sm:text-sm">Deep Analysis from {posts.length} posts, {followers.length} followers, {following.length} following</p>
            <p className="text-purple-600 text-[10px] sm:text-xs mt-0.5">
              {posts.length < 5 ? 'Limited data — accuracy improves with more posts.' : 'Good data volume for reliable predictions.'}
            </p>
          </div>
        </div>

        {/* Personal Snapshot */}
        <div>
          <SectionHeader icon={<User className="w-5 h-5 text-indigo-500" />} title="Personal Snapshot" />
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 sm:p-6 border border-indigo-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-indigo-700">{insights.mbti}</p>
                <p className="text-[10px] sm:text-xs text-indigo-500">Personality</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-rose-600">{insights.emotionalTone.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs text-rose-500">Tone</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-emerald-600">{insights.topThemes[0]?.[0] || '--'}</p>
                <p className="text-[10px] sm:text-xs text-emerald-500">Primary Interest</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-amber-600">{insights.peakTime.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs text-amber-500">Active Period</p>
              </div>
            </div>
            <p className="text-slate-700 text-xs sm:text-sm leading-relaxed">
              <strong>@{profile.username}</strong> is estimated as <strong>{insights.mbti} ({insights.mbtiName})</strong> with a{' '}
              <strong>{insights.emotionalTone.toLowerCase()}</strong> communication style.{' '}
              {insights.topThemes.length > 0 && <>Primary interests include <strong>{insights.topThemes.slice(0, 3).map(([t]) => t).join(', ')}</strong>. </>}
              {insights.avgGap && <>Posts roughly every <strong>{insights.avgGap} days</strong>. </>}
              Engagement rate: <strong>{pct(insights.avgEngagement)}</strong> with an average of{' '}
              <strong>{posts.length > 0 ? Math.round(insights.totalLikes / posts.length) : 0}</strong> likes per post.
            </p>
          </div>
        </div>

        {/* User Interests & Keywords */}
        <div>
          <SectionHeader icon={<Tag className="w-5 h-5 text-emerald-500" />} title="User Interests & Keywords" />
          {insights.topThemes.length > 0 ? (
            <div className="space-y-2">
              {insights.topThemes.map(([theme, score], i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 sm:px-4 py-3">
                  <span className="text-lg">{['🎯','💡','✨','🔥','⭐'][i] || '📌'}</span>
                  <span className="font-semibold text-slate-700 capitalize flex-1 text-sm">{theme}</span>
                  <div className="flex-1 max-w-32 sm:max-w-48">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, (score / Math.max(1, insights.topThemes[0][1])) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 w-12 text-right">{score} hits</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4">Not enough caption data to detect interests.</p>
          )}
        </div>

        {/* ── Caption Formula Analyzer ──────────────────────────────────── */}
        {posts.length >= 3 && (
          <AccessGate tier={tier} required="standard">
            <div>
              <SectionHeader icon={<PenTool className="w-5 h-5 text-violet-500" />} title="Caption Formula Analyzer" badge="Wave 1" />
              {(() => {
                const followerCount = profile?.followersCount || profile?.followers_count || 1;
                const buckets = { short: { label: 'Short (<50 chars)', total: 0, count: 0 }, medium: { label: 'Medium (50-200)', total: 0, count: 0 }, long: { label: 'Long (200+)', total: 0, count: 0 } };
                const patterns = {
                  question: { label: 'Asks a question (?)', total: 0, count: 0 },
                  cta: { label: 'Has CTA', total: 0, count: 0 },
                  emoji: { label: 'Heavy emoji use', total: 0, count: 0 },
                  hashtags: { label: 'Uses hashtags', total: 0, count: 0 },
                  noHashtags: { label: 'No hashtags', total: 0, count: 0 },
                };
                posts.forEach(p => {
                  const cap = p.caption || '';
                  const eng = ((p.likesCount || 0) + (p.commentsCount || 0)) / followerCount * 100;
                  if (cap.length < 50) { buckets.short.total += eng; buckets.short.count++; }
                  else if (cap.length <= 200) { buckets.medium.total += eng; buckets.medium.count++; }
                  else { buckets.long.total += eng; buckets.long.count++; }
                  if (cap.includes('?')) { patterns.question.total += eng; patterns.question.count++; }
                  if (/link in bio|tap |swipe|comment below|check out|click|dm me/i.test(cap)) { patterns.cta.total += eng; patterns.cta.count++; }
                  const emojiMatches = cap.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || [];
                  if (emojiMatches.length / Math.max(1, cap.length) > 0.02) { patterns.emoji.total += eng; patterns.emoji.count++; }
                  if (cap.includes('#')) { patterns.hashtags.total += eng; patterns.hashtags.count++; }
                  else { patterns.noHashtags.total += eng; patterns.noHashtags.count++; }
                });
                const allItems = [
                  ...Object.values(buckets).filter(b => b.count > 0).map(b => ({ ...b, avg: b.total / b.count })),
                  ...Object.values(patterns).filter(b => b.count > 0).map(b => ({ ...b, avg: b.total / b.count })),
                ].sort((a, b) => b.avg - a.avg);
                const maxAvg = Math.max(1, ...allItems.map(i => i.avg));
                const winner = allItems[0];
                return (
                  <div className="bg-violet-50 rounded-xl p-4 sm:p-6 border border-violet-200">
                    <div className="space-y-2.5">
                      {allItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs sm:text-sm text-slate-700 w-36 sm:w-44 shrink-0">{item.label}</span>
                          <div className="flex-1 h-5 bg-white rounded-full overflow-hidden relative">
                            <div className={`h-full rounded-full transition-all duration-500 ${i === 0 ? 'bg-violet-500' : 'bg-violet-300'}`} style={{ width: `${(item.avg / maxAvg) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 w-20 text-right">{item.avg.toFixed(2)}% eng</span>
                          <span className="text-[10px] text-slate-400 w-12 text-right">({item.count})</span>
                        </div>
                      ))}
                    </div>
                    {winner && (
                      <div className="mt-4 bg-violet-100 rounded-lg p-3 flex items-start gap-2">
                        <Crown className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-violet-700">
                          <strong>Winning formula:</strong> Posts with &ldquo;{winner.label}&rdquo; average <strong>{winner.avg.toFixed(2)}%</strong> engagement
                          {allItems.length > 1 && <> &mdash; {((winner.avg / allItems[allItems.length - 1].avg - 1) * 100).toFixed(0)}% better than your lowest-performing pattern</>}.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </AccessGate>
        )}

        {/* Visited Locations */}
        <div>
          <SectionHeader icon={<MapPin className="w-5 h-5 text-rose-500" />} title="Visited Locations & Geotags" />
          {insights.geoTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...new Set(insights.geoTags)].map((loc, i) => (
                <span key={i} className="bg-rose-50 text-rose-700 text-xs font-medium px-3 py-1.5 rounded-full border border-rose-100 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {loc}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4">No geotag data found in recent posts.</p>
          )}
        </div>

        {/* Notable Patterns */}
        <div>
          <SectionHeader icon={<Zap className="w-5 h-5 text-amber-500" />} title="Notable Patterns" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-slate-50 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Posting Frequency</p>
              <p className="text-sm font-bold text-slate-800">{insights.avgGap ? `Every ${insights.avgGap} days` : 'Insufficient data'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Peak Activity</p>
              <p className="text-sm font-bold text-slate-800">{insights.peakTime}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Caption Style</p>
              <p className="text-sm font-bold text-slate-800">
                {insights.avgCaptionLength > 200 ? 'Long-form storyteller' : insights.avgCaptionLength > 50 ? 'Moderate length' : 'Short & punchy'}
                {insights.questionsCount > 2 && ' · Asks questions'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Content Strategy</p>
              <p className="text-sm font-bold text-slate-800">
                {insights.ctaCount > 0 ? `${insights.ctaCount} CTAs detected` : 'No CTAs detected'}
                {insights.uniqueHashtags.length > 10 ? ' · Heavy hashtag use' : ''}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Avg Caption Length</p>
              <p className="text-sm font-bold text-slate-800">{insights.avgCaptionLength} characters</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Network Size</p>
              <p className="text-sm font-bold text-slate-800">{insights.uniqueMentions.length} unique mentions · {insights.strongTies.length} strong ties</p>
            </div>
          </div>
        </div>

        {/* Emoji Usage */}
        {insights.topEmojis.length > 0 && (
          <div>
            <SectionHeader icon={<Smile className="w-5 h-5 text-amber-500" />} title="Emoji Personality" />
            <div className="flex flex-wrap gap-3">
              {insights.topEmojis.map(([emoji, count], i) => (
                <div key={i} className="bg-amber-50 rounded-xl px-4 py-3 text-center border border-amber-100 min-w-[64px]">
                  <p className="text-2xl mb-1">{emoji}</p>
                  <p className="text-[10px] text-amber-600 font-semibold">{count}x</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Relationship Indicators */}
        <div>
          <SectionHeader icon={<Users className="w-5 h-5 text-purple-500" />} title="Relationship Indicators" />
          {insights.strongTies.length > 0 ? (
            <div className="space-y-1.5">
              {insights.strongTies.slice(0, 8).map(([mention, count], i) => (
                <div key={i} className="flex items-center gap-3 bg-purple-50 rounded-lg px-3 py-2">
                  <span className="font-semibold text-purple-700 text-sm">{mention}</span>
                  <div className="flex-1 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 rounded-full" style={{ width: `${Math.min(100, (count / insights.strongTies[0][1]) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-purple-600 font-semibold">{count}x mentioned</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4">{insights.uniqueMentions.length > 0 ? 'No repeated mentions detected (no strong ties).' : 'No @mentions found in recent posts.'}</p>
          )}
        </div>

        {/* ── Engagement Authenticity Score ─────────────────────────── */}
        {posts.length >= 3 && (() => {
          // Gather all commenters
          const allCommenters = {};
          let totalCommentCount = 0;
          posts.forEach(post => {
            (post.latestComments || []).forEach(c => {
              const u = (c.ownerUsername || '').toLowerCase();
              if (!u) return;
              if (!allCommenters[u]) allCommenters[u] = { count: 0, texts: [] };
              allCommenters[u].count++;
              allCommenters[u].texts.push(c.text || '');
              totalCommentCount++;
            });
          });
          const uniqueCommenterCount = Object.keys(allCommenters).length;

          // Build follower set
          const followerSet = new Set((followers || []).map(f => (f.username || f.handle || f.login || '').toLowerCase()).filter(Boolean));

          // Factor 1: % commenters who are followers (40 pts)
          const commentersWhoFollow = Object.keys(allCommenters).filter(u => followerSet.has(u)).length;
          const followerCommenterRatio = uniqueCommenterCount > 0 ? commentersWhoFollow / uniqueCommenterCount : 0;
          const factor1Score = Math.round(followerCommenterRatio * 40);

          // Factor 2: Comment diversity — unique vs total (20 pts)
          const diversityRatio = totalCommentCount > 0 ? uniqueCommenterCount / totalCommentCount : 0;
          const factor2Score = Math.round(Math.min(1, diversityRatio / 0.5) * 20);

          // Factor 3: Comment quality (20 pts)
          const genericWords = new Set(['nice', 'great', 'wow', 'cool', 'amazing', 'beautiful', 'love', '🔥', '👏', '❤️']);
          let genericCount = 0;
          let totalLen = 0;
          let totalTexts = 0;
          Object.values(allCommenters).forEach(d => {
            d.texts.forEach(t => {
              totalTexts++;
              totalLen += t.length;
              const trimmed = t.trim().toLowerCase().replace(/[!.]+$/, '');
              if (genericWords.has(trimmed) || t.trim().length <= 3) genericCount++;
            });
          });
          const avgCommentLen = totalTexts > 0 ? totalLen / totalTexts : 0;
          const genericPct = totalTexts > 0 ? genericCount / totalTexts : 0;
          const qualityScore = Math.min(1, (avgCommentLen > 30 ? 0.5 : avgCommentLen / 60) + (1 - genericPct) * 0.5);
          const factor3Score = Math.round(qualityScore * 20);

          // Factor 4: Like/comment ratio (20 pts) — healthy = 20-100x
          const totalLikesAll = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
          const totalCommentsAll = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
          const lcRatio = totalCommentsAll > 0 ? totalLikesAll / totalCommentsAll : 0;
          let factor4Score;
          if (lcRatio >= 20 && lcRatio <= 100) factor4Score = 20;
          else if (lcRatio >= 10 && lcRatio <= 150) factor4Score = 14;
          else if (lcRatio >= 5) factor4Score = 8;
          else factor4Score = 4;

          const totalScore = factor1Score + factor2Score + factor3Score + factor4Score;
          const grade = totalScore >= 85 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 55 ? 'C' : totalScore >= 40 ? 'D' : 'F';
          const gradeColor = totalScore >= 85 ? '#10b981' : totalScore >= 70 ? '#3b82f6' : totalScore >= 55 ? '#f59e0b' : totalScore >= 40 ? '#f97316' : '#ef4444';

          // Suspicious patterns
          const suspiciousPatterns = [];
          if (followerCommenterRatio < 0.3 && followerSet.size > 0) suspiciousPatterns.push('Most commenters are not followers — possible bought comments');
          if (genericPct > 0.5) suspiciousPatterns.push(`${(genericPct * 100).toFixed(0)}% of comments are generic one-word responses`);
          if (lcRatio > 200) suspiciousPatterns.push(`Like/comment ratio is ${Math.round(lcRatio)}x — unusually high, may indicate bought likes`);
          if (lcRatio < 5 && lcRatio > 0) suspiciousPatterns.push(`Like/comment ratio is only ${lcRatio.toFixed(1)}x — unusually low, may indicate comment pods`);
          if (diversityRatio < 0.15) suspiciousPatterns.push('Very few unique commenters — same accounts commenting repeatedly');

          const r = 52;
          const circ = 2 * Math.PI * r;
          const offset = circ - (totalScore / 100) * circ;

          const factors = [
            { label: 'Follower-Commenter Match', score: factor1Score, max: 40, detail: `${commentersWhoFollow}/${uniqueCommenterCount} commenters follow you` },
            { label: 'Comment Diversity', score: factor2Score, max: 20, detail: `${uniqueCommenterCount} unique out of ${totalCommentCount} comments` },
            { label: 'Comment Quality', score: factor3Score, max: 20, detail: `Avg ${Math.round(avgCommentLen)} chars, ${(genericPct * 100).toFixed(0)}% generic` },
            { label: 'Like/Comment Ratio', score: factor4Score, max: 20, detail: `${lcRatio.toFixed(1)}x (healthy: 20-100x)` },
          ];

          return (
            <AccessGate tier={tier} required="premium">
              <div>
                <SectionHeader icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />} title="Engagement Authenticity Score" badge="Wave 2" />
                <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
                  <div className="flex flex-col sm:flex-row items-center gap-6 mb-5">
                    {/* Score ring */}
                    <div className="relative shrink-0">
                      <svg viewBox="0 0 120 120" className="w-28 h-28 sm:w-32 sm:h-32 -rotate-90">
                        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                        <circle cx="60" cy="60" r={r} fill="none" stroke={gradeColor} strokeWidth="10"
                          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s ease' }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl sm:text-4xl font-black" style={{ color: gradeColor }}>{totalScore}</span>
                        <span className="text-lg font-bold" style={{ color: gradeColor }}>{grade}</span>
                      </div>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-lg font-bold text-slate-800 mb-1">
                        {totalScore >= 70 ? 'Healthy Engagement' : totalScore >= 40 ? 'Mixed Signals' : 'Needs Attention'}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Based on {totalCommentCount} comments from {uniqueCommenterCount} unique users across {posts.length} posts.
                        {followerSet.size > 0 ? ` Cross-referenced with ${followerSet.size} followers.` : ''}
                      </p>
                    </div>
                  </div>
                  {/* Factor breakdown */}
                  <div className="space-y-3 mb-4">
                    {factors.map((f, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs sm:text-sm font-medium text-slate-700">{f.label}</span>
                          <span className="text-xs font-semibold text-slate-500">{f.score}/{f.max}</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{
                            width: `${(f.score / f.max) * 100}%`,
                            backgroundColor: (f.score / f.max) >= 0.7 ? '#10b981' : (f.score / f.max) >= 0.4 ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{f.detail}</p>
                      </div>
                    ))}
                  </div>
                  {/* Suspicious patterns */}
                  {suspiciousPatterns.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Suspicious Patterns Detected
                      </p>
                      <ul className="space-y-1">
                        {suspiciousPatterns.map((p, i) => (
                          <li key={i} className="text-[10px] sm:text-xs text-amber-600 flex items-start gap-1.5">
                            <span className="text-amber-400 mt-0.5 shrink-0">&#9679;</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {suspiciousPatterns.length === 0 && (
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <p className="text-xs text-emerald-700">No suspicious engagement patterns detected. Your engagement appears authentic.</p>
                    </div>
                  )}
                </div>
              </div>
            </AccessGate>
          );
        })()}

        {/* ── Shadow Ban Detector ──────────────────────────────────────── */}
        {posts.length >= 4 && (() => {
          const followerCount = profile?.followers || profile?.followersCount || 0;

          // Signal 1: Recent engagement drop
          const sortedByDate = [...posts].filter(p => p.timestamp).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          const recent4 = sortedByDate.slice(0, 4);
          const older = sortedByDate.slice(4);
          const recentAvgEng = recent4.length > 0 && followerCount > 0
            ? recent4.reduce((s, p) => s + ((p.likesCount || 0) + (p.commentsCount || 0)), 0) / recent4.length / followerCount * 100
            : 0;
          const olderAvgEng = older.length > 0 && followerCount > 0
            ? older.reduce((s, p) => s + ((p.likesCount || 0) + (p.commentsCount || 0)), 0) / older.length / followerCount * 100
            : 0;
          const engDropPct = olderAvgEng > 0 ? ((olderAvgEng - recentAvgEng) / olderAvgEng * 100) : 0;
          const signal1Pass = engDropPct < 30;

          // Signal 2: ER vs follower benchmark
          let benchmark = 6;
          if (followerCount >= 500000) benchmark = 1.2;
          else if (followerCount >= 100000) benchmark = 1.8;
          else if (followerCount >= 50000) benchmark = 2.4;
          else if (followerCount >= 10000) benchmark = 3.5;
          const currentER = avgEngagement || 0;
          const erBenchmarkRatio = benchmark > 0 ? currentER / benchmark : 1;
          const signal2Pass = erBenchmarkRatio >= 0.5;

          // Signal 3: Hashtag diversity decline
          const recentTags = new Set();
          const olderTags = new Set();
          recent4.forEach(p => ((p.caption || '').match(/#\w+/g) || []).forEach(t => recentTags.add(t.toLowerCase())));
          older.forEach(p => ((p.caption || '').match(/#\w+/g) || []).forEach(t => olderTags.add(t.toLowerCase())));
          const signal3Pass = recentTags.size >= Math.max(1, olderTags.size * 0.5) || olderTags.size === 0;

          // Signal 4: Comment-to-like ratio anomaly
          const totalLikesCheck = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
          const totalCommentsCheck = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
          const clRatio = totalLikesCheck > 0 ? totalCommentsCheck / totalLikesCheck : 0;
          const signal4Pass = clRatio >= 0.005;

          // Signal 5: Follower stagnation (low variance in recent engagement)
          const recentEngs = recent4.map(p => (p.likesCount || 0) + (p.commentsCount || 0));
          const engMean = recentEngs.length > 0 ? recentEngs.reduce((a, b) => a + b, 0) / recentEngs.length : 0;
          const engVariance = recentEngs.length > 1 ? recentEngs.reduce((s, v) => s + Math.pow(v - engMean, 2), 0) / recentEngs.length : 0;
          const engCV = engMean > 0 ? Math.sqrt(engVariance) / engMean : 0;
          const signal5Pass = engCV >= 0.1 || recentEngs.length < 3;

          const failedSignals = [signal1Pass, signal2Pass, signal3Pass, signal4Pass, signal5Pass].filter(s => !s).length;
          let status, statusColor, statusBg;
          if (failedSignals >= 3) { status = 'Likely Shadow Banned'; statusColor = 'text-rose-700'; statusBg = 'bg-rose-100 border-rose-300'; }
          else if (failedSignals >= 1) { status = 'Some Signals Detected'; statusColor = 'text-amber-700'; statusBg = 'bg-amber-100 border-amber-300'; }
          else { status = 'Clear'; statusColor = 'text-emerald-700'; statusBg = 'bg-emerald-100 border-emerald-300'; }

          const signals = [
            { label: 'Recent Engagement Drop', pass: signal1Pass, detail: signal1Pass ? `Only ${Math.max(0, engDropPct).toFixed(0)}% drop (under 30% threshold)` : `${engDropPct.toFixed(0)}% drop in last 4 posts vs older posts` },
            { label: 'ER vs Benchmark', pass: signal2Pass, detail: `${pct(currentER)} vs ${benchmark}% benchmark (${(erBenchmarkRatio * 100).toFixed(0)}% of expected)` },
            { label: 'Hashtag Diversity', pass: signal3Pass, detail: signal3Pass ? `Healthy: ${recentTags.size} recent tags` : `Declined from ${olderTags.size} to ${recentTags.size} unique tags` },
            { label: 'Comment-to-Like Ratio', pass: signal4Pass, detail: `${(clRatio * 100).toFixed(2)}% (minimum 0.5% expected)` },
            { label: 'Engagement Consistency', pass: signal5Pass, detail: signal5Pass ? 'Normal variation in engagement' : 'Suspiciously flat engagement — possible reach suppression' },
          ];

          const recommendations = [];
          if (!signal1Pass) recommendations.push('Diversify your content formats — try Reels or Carousels to boost reach.');
          if (!signal2Pass) recommendations.push('Your engagement rate is below expected for your follower tier. Focus on high-quality content over frequency.');
          if (!signal3Pass) recommendations.push('Use a wider variety of hashtags. Repeated identical sets can trigger algorithm suppression.');
          if (!signal4Pass) recommendations.push('Encourage comments with questions and CTAs in your captions.');
          if (!signal5Pass) recommendations.push('Abnormally consistent engagement numbers may indicate throttled distribution.');

          return (
            <AccessGate tier={tier} required="standard">
              <div>
                <SectionHeader icon={<EyeOff className="w-5 h-5 text-slate-600" />} title="Shadow Ban Detector" badge="Wave 2" />
                <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
                  {/* Status badge */}
                  <div className="flex items-center justify-center mb-5">
                    <span className={`${statusBg} ${statusColor} border text-sm sm:text-base font-bold px-5 py-2 rounded-full flex items-center gap-2`}>
                      {failedSignals >= 3 ? <AlertTriangle className="w-4 h-4" /> : failedSignals >= 1 ? <AlertCircle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      {status}
                    </span>
                  </div>
                  {/* Signal checklist */}
                  <div className="space-y-2 mb-4">
                    {signals.map((s, i) => (
                      <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${s.pass ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        <span className={`text-base mt-0.5 shrink-0 ${s.pass ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {s.pass ? '✓' : '✗'}
                        </span>
                        <div className="flex-1">
                          <p className={`text-xs sm:text-sm font-medium ${s.pass ? 'text-emerald-700' : 'text-rose-700'}`}>{s.label}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Recommendations
                      </p>
                      <ul className="space-y-1.5">
                        {recommendations.map((r, i) => (
                          <li key={i} className="text-[10px] sm:text-xs text-amber-600 flex items-start gap-1.5">
                            <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" /> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recommendations.length === 0 && (
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <p className="text-xs text-emerald-700">No shadow ban signals detected. Your account reach appears healthy.</p>
                    </div>
                  )}
                </div>
              </div>
            </AccessGate>
          );
        })()}

        {/* Growth Trajectory */}
        <div>
          <SectionHeader icon={<TrendingUp className="w-5 h-5 text-teal-500" />} title="Growth Trajectory" />
          <div className="bg-teal-50 rounded-xl p-4 sm:p-6 border border-teal-100">
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-3">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-teal-700">{insights.followersCount.toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-teal-500">Current</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-teal-700">+{insights.predicted30d.toLocaleString()}</p>
                <p className="text-[10px] sm:text-xs text-teal-500">Est. 30d growth</p>
              </div>
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-bold text-teal-700">{(insights.growthRate * 100).toFixed(1)}%</p>
                <p className="text-[10px] sm:text-xs text-teal-500">Growth rate/mo</p>
              </div>
            </div>
            <p className="text-xs text-teal-600">
              Based on {pct(insights.avgEngagement)} engagement rate and current audience size. {insights.avgEngagement > 3 ? 'Strong engagement suggests accelerating growth.' : insights.avgEngagement > 1 ? 'Healthy engagement supporting steady growth.' : 'Lower engagement may slow organic reach.'}
            </p>
          </div>
        </div>
      </div>
    </AccessGate>
  );
};
