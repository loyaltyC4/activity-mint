import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, BarChart2, Brain, Users, Heart, Eye, Target,
  MonitorPlay, UserCheck, UserMinus, TrendingUp, Image as ImageIcon,
  Lock, ChevronDown, PlusCircle, X, Search, ArrowRight,
  Sparkles, MessageSquare, Link2, Repeat2, Star, Clock,
  Calendar, AlertCircle, ThumbsUp, Globe, FileText, Download,
  ChevronRight, RefreshCw, Flame, Hash, LayoutGrid, MapPin,
  Smile, Tag, Zap, Award, User, Coffee, Camera,
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

/* ─── Stat card ─────────────────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, sub, trend, color = 'indigo' }) => {
  const colors = {
    indigo: 'from-indigo-50 to-indigo-100/50 text-indigo-600',
    emerald: 'from-emerald-50 to-emerald-100/50 text-emerald-600',
    purple: 'from-purple-50 to-purple-100/50 text-purple-600',
    rose: 'from-rose-50 to-rose-100/50 text-rose-600',
    amber: 'from-amber-50 to-amber-100/50 text-amber-600',
    teal: 'from-teal-50 to-teal-100/50 text-teal-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide leading-tight">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-slate-900">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-[10px] sm:text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
};

/* ─── Section header ────────────────────────────────────────────────────── */
const SectionHeader = ({ icon, title, badge, children }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="font-bold text-slate-900 text-sm sm:text-base">{title}</h3>
      {badge && (
        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          {badge}
        </span>
      )}
    </div>
    {children}
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
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        Minting<span className="inline-flex ml-1">{[0,1,2].map(i => (
          <span key={i} className="mint-dot text-indigo-500 text-3xl leading-none" style={{ animationDelay: `${i * 0.3}s` }}>.</span>
        ))}</span>
      </h2>
      <p className="text-sm text-slate-500 h-5 transition-opacity duration-500">{MINT_STEPS[step]}</p>
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

const HealthScoreCard = ({ profile, posts, avgEngagement }) => {
  const h = calcHealthScore(profile, posts, avgEngagement);
  const r = 54, circ = 2 * Math.PI * r;
  const offset = circ - (h.score / 100) * circ;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 hover:shadow-lg transition-all">
      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle cx="60" cy="60" r={r} fill="none" stroke={h.color} strokeWidth="10"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black" style={{ color: h.color }}>{h.grade}</span>
            <span className="text-xs text-slate-400">{h.score}/100</span>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          {[
            ['Engagement', h.erScore, 40, '📊'],
            ['Ratio', h.ratioScore, 20, '⚖️'],
            ['Consistency', h.consistencyScore, 20, '📅'],
            ['Profile', h.profileScore, 20, '✨'],
          ].map(([label, val, max, emoji]) => (
            <div key={label} className="text-sm">
              <div className="flex justify-between text-slate-500 mb-1">
                <span>{emoji} {label}</span><span className="font-medium text-slate-700">{val}/{max}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(val/max)*100}%`, background: h.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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

const TrackingSection = ({ username, profile }) => {
  const snaps = getSnapshots(username);
  if (snaps.length < 2) return null;
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
          ['Followers', 'followers'],
          ['Following', 'following'],
          ['Posts', 'posts'],
          ['ER%', 'er'],
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

  // Save tracking snapshot when profile data loads
  useEffect(() => {
    if (profile && selectedAccount) {
      const er = profile.followers > 0 && posts.length > 0
        ? posts.reduce((s, p) => s + (p.likesCount || 0) + (p.commentsCount || 0), 0) / posts.length / profile.followers * 100
        : 0;
      saveSnapshot(selectedAccount.username, profile, er);
    }
  }, [profile, selectedAccount, posts]);

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
  ];

  /* ═══ Engagement metrics computed from posts ═══════════════════════════ */
  const totalLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);
  const avgEngagement = profile?.followers > 0 && posts.length > 0
    ? ((totalLikes + totalComments) / posts.length / profile.followers * 100)
    : 0;

  /* ═══ RENDER ═══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      {/* ── Top bar: account selector + add + refresh + day range ──────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* Account pills - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0 scrollbar-hide">
            {trackedAccounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all min-h-[36px] ${
                  selectedAccount?.id === acc.id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {acc.username.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[80px] sm:max-w-none truncate">@{acc.username}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveAccount(acc.id); }}
                  className="text-slate-300 hover:text-red-400 ml-0.5 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Add input */}
            <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-2 sm:px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400 mr-1.5" />
              <input
                type="text"
                value={addInput}
                onChange={e => { setAddInput(e.target.value); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                placeholder="Add @username"
                className="bg-transparent border-none outline-none text-sm text-slate-700 w-24 sm:w-32"
              />
            </div>
            <button
              onClick={handleAddAccount}
              disabled={addLoading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 min-h-[36px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{addLoading ? '...' : 'Add'}</span>
            </button>
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={profileLoading}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 min-h-[36px] text-sm"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${profileLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {/* Day range picker */}
            <select
              value={dayRange}
              onChange={e => setDayRange(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 sm:px-3 py-1.5 text-sm text-slate-600 min-h-[36px] outline-none"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </div>
        {addError && (
          <div className="max-w-7xl mx-auto px-4 pb-2">
            <p className="text-red-500 text-xs">{addError}</p>
          </div>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!selectedAccount && !accountsLoading && (
        <div className="max-w-lg mx-auto text-center py-20 sm:py-32 px-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">Start Tracking</h2>
          <p className="text-slate-500 mb-8 text-sm sm:text-base">Add an Instagram username above to start generating insights and analytics reports.</p>
        </div>
      )}

      {/* ── Minting Loading Animation ──────────────────────────────────── */}
      {profileLoading && <MintingLoader />}

      {/* ── Profile + Report ────────────────────────────────────────────── */}
      {selectedAccount && profile && !profileLoading && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">

          {/* Profile header — mobile responsive */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-start gap-3 sm:gap-6">
              {profile.profilePicUrl ? (
                <img
                  src={proxyImg(profile.profilePicUrl)}
                  alt={profile.username}
                  className="w-14 h-14 sm:w-20 sm:h-20 rounded-full border-2 border-indigo-100 object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-lg sm:text-2xl font-bold shrink-0">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">@{profile.username}</h1>
                  {profile.isVerified && (
                    <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">✓ Verified</span>
                  )}
                </div>
                {profile.fullName && <p className="text-xs sm:text-sm text-slate-500 mb-1">{profile.fullName}</p>}
                {profile.category && <p className="text-[10px] sm:text-xs text-indigo-500 font-medium mb-1">{profile.category}</p>}
                {profile.bio && <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 hidden sm:block">{profile.bio}</p>}
              </div>
            </div>
            {/* Stats row — always visible */}
            <div className="flex gap-4 sm:gap-8 mt-3 sm:mt-4 pt-3 border-t border-slate-100">
              {[
                { label: 'Posts', value: fmt(profile.posts) },
                { label: 'Followers', value: fmt(profile.followers) },
                { label: 'Following', value: fmt(profile.following) },
                { label: 'Eng. Rate', value: pct(avgEngagement) },
              ].map((s, i) => (
                <div key={i} className="text-center flex-1">
                  <p className="text-lg sm:text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Last refresh */}
            {lastRefresh && (
              <p className="text-[10px] text-slate-400 mt-2 text-right">
                Last updated: {new Date(lastRefresh).toLocaleString()}
              </p>
            )}
          </div>

          {/* ── Health Score ──────────────────────────────────────────── */}
          <HealthScoreCard profile={profile} posts={posts} avgEngagement={avgEngagement} />

          {/* ── Tracking History ──────────────────────────────────────── */}
          <TrackingSection username={selectedAccount} profile={profile} />

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
          </div>
        </div>
      )}
    </div>
  );
}

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

      {/* Fans section — real data */}
      {fansOnly.length > 0 && (
        <div>
          <SectionHeader icon={<Heart className="w-5 h-5 text-amber-500" />} title="Top Fans (Follow but Not Followed Back)">
            <span className="text-xs text-slate-400">{fansOnly.length} fans</span>
          </SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
            {fansOnly.slice(0, 20).map((f, i) => {
              const uname = f.username || f.handle || f.login || '';
              return (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-xs text-slate-400 w-5">#{i+1}</span>
                  <span className="font-medium text-slate-700 truncate">@{uname}</span>
                  {f.is_verified && <span className="text-blue-500 text-[10px]">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Follower Demographics (Inferred) ─────────────────────────────── */}
      {followers.length > 0 && (
        <AccessGate tier={tier} required="standard">
          <SectionHeader icon={<Target className="w-5 h-5 text-purple-500" />} title="Follower Demographics" badge="Inferred">
            <FollowerDemographics followers={followers} />
          </SectionHeader>
        </AccessGate>
      )}
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
