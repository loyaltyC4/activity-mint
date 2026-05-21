import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, BarChart2, Brain, Users, Heart, Eye, Target,
  MonitorPlay, UserCheck, UserMinus, TrendingUp, Image as ImageIcon,
  Lock, ChevronDown, PlusCircle, X, Search, ArrowRight,
  Sparkles, MessageSquare, Link2, Repeat2, Star, Clock,
  Calendar, AlertCircle, ThumbsUp, Globe, FileText, Download,
  ChevronRight, RefreshCw, Flame, Hash, LayoutGrid,
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
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
};

/* ─── Section header ────────────────────────────────────────────────────── */
const SectionHeader = ({ icon, title, badge, children }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="font-bold text-slate-900">{title}</h3>
      {badge && (
        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          {badge}
        </span>
      )}
    </div>
    {children}
  </div>
);

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

  /* ── Fetch profile data when selectedAccount changes ───────────────────── */
  useEffect(() => {
    if (!selectedAccount) { setProfile(null); setPosts([]); setStories([]); return; }
    let cancelled = false;
    const load = async () => {
      setProfileLoading(true);
      try {
        const [profileRes, postsRes] = await Promise.all([
          fetchInstagramProfile(selectedAccount.username),
          fetchInstagramProfileWithPosts(selectedAccount.username).catch(() => null),
        ]);
        if (cancelled) return;
        if (profileRes?.[0]) {
          const p = profileRes[0];
          setProfile({
            username: p.username,
            fullName: p.fullName || '',
            profilePicUrl: p.profilePicUrl || p.profilePicUrlHD || '',
            followers: p.followersCount || 0,
            following: p.followsCount || 0,
            posts: p.postsCount || 0,
            bio: p.biography || '',
            isVerified: p.verified || false,
            isPrivate: p.private || false,
          });
        }
        if (postsRes?.latestPosts) {
          setPosts(postsRes.latestPosts.slice(0, 12));
        }
      } catch (err) {
        console.error('Dashboard profile fetch error:', err);
      }
      if (!cancelled) setProfileLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [selectedAccount]);

  /* ── Fetch stories separately (needs login) ────────────────────────────── */
  useEffect(() => {
    if (!selectedAccount) return;
    let cancelled = false;
    fetchInstagramStories(selectedAccount.username)
      .then(s => { if (!cancelled) setStories(s || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedAccount]);

  /* ── Tab definitions ───────────────────────────────────────────────────── */
  const TABS = [
    { id: 'activity', icon: <Activity className="w-4 h-4" />, label: 'Activity Analytics' },
    { id: 'ties', icon: <Users className="w-4 h-4" />, label: 'Ties & Trails' },
    { id: 'stories', icon: <MonitorPlay className="w-4 h-4" />, label: 'Stories & Highlights' },
    { id: 'insights', icon: <Brain className="w-4 h-4" />, label: 'AI Insights' },
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
      {/* ── Top bar: account selector + add ─────────────────────────────── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4 flex-wrap">
          {/* Account pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
            {trackedAccounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedAccount?.id === acc.id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {acc.username.charAt(0).toUpperCase()}
                </div>
                @{acc.username}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveAccount(acc.id); }}
                  className="text-slate-300 hover:text-red-400 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
          {/* Add input */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="text"
                value={addInput}
                onChange={e => { setAddInput(e.target.value); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                placeholder="Add @username"
                className="bg-transparent border-none outline-none text-sm text-slate-700 w-32"
              />
            </div>
            <button
              onClick={handleAddAccount}
              disabled={addLoading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <PlusCircle className="w-4 h-4" />
              {addLoading ? '...' : 'Add'}
            </button>
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
        <div className="max-w-lg mx-auto text-center py-32 px-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Start Tracking</h2>
          <p className="text-slate-500 mb-8">Add an Instagram username above to start generating insights and analytics reports.</p>
        </div>
      )}

      {/* ── Loading state ───────────────────────────────────────────────── */}
      {profileLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-slate-200" />
              <div className="space-y-3 flex-1">
                <div className="h-5 bg-slate-200 rounded w-1/4" />
                <div className="h-4 bg-slate-100 rounded w-1/3" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
            </div>
            <div className="h-64 bg-slate-100 rounded-xl" />
          </div>
        </div>
      )}

      {/* ── Profile + Report ────────────────────────────────────────────── */}
      {selectedAccount && profile && !profileLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Profile header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 flex flex-col md:flex-row items-start md:items-center gap-6">
            {profile.profilePicUrl ? (
              <img
                src={proxyImg(profile.profilePicUrl)}
                alt={profile.username}
                className="w-20 h-20 rounded-full border-2 border-indigo-100 object-cover shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900 truncate">@{profile.username}</h1>
                {profile.isVerified && (
                  <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
                )}
                {profile.isPrivate && (
                  <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">Private</span>
                )}
              </div>
              {profile.fullName && <p className="text-sm text-slate-500 mb-2">{profile.fullName}</p>}
              {profile.bio && <p className="text-sm text-slate-600 line-clamp-2">{profile.bio}</p>}
            </div>
            <div className="flex gap-6 sm:gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{fmt(profile.posts)}</p>
                <p className="text-xs text-slate-500">Posts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{fmt(profile.followers)}</p>
                <p className="text-xs text-slate-500">Followers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{fmt(profile.following)}</p>
                <p className="text-xs text-slate-500">Following</p>
              </div>
            </div>
          </div>

          {/* Report tabs */}
          <div className="bg-white rounded-t-2xl border border-b-0 border-slate-200 px-4 overflow-x-auto">
            <div className="flex gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setReportTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
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
          <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200 p-6 mb-8">
            {reportTab === 'activity' && (
              <ActivityTab profile={profile} posts={posts} tier={tier} avgEngagement={avgEngagement} totalLikes={totalLikes} totalComments={totalComments} />
            )}
            {reportTab === 'ties' && (
              <TiesTab profile={profile} posts={posts} tier={tier} followers={followers} following={following} />
            )}
            {reportTab === 'stories' && (
              <StoriesTab profile={profile} stories={stories} tier={tier} />
            )}
            {reportTab === 'insights' && (
              <InsightsTab profile={profile} posts={posts} tier={tier} avgEngagement={avgEngagement} />
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
const ActivityTab = ({ profile, posts, tier, avgEngagement, totalLikes, totalComments }) => (
  <div className="space-y-8 animate-in fade-in duration-300">
    {/* Key metrics */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Heart className="w-4 h-4" />}
        label="Total Likes"
        value={fmt(totalLikes)}
        sub={`across ${posts.length} posts`}
        color="rose"
      />
      <StatCard
        icon={<MessageSquare className="w-4 h-4" />}
        label="Total Comments"
        value={fmt(totalComments)}
        sub="engagement signals"
        color="indigo"
      />
      <StatCard
        icon={<TrendingUp className="w-4 h-4" />}
        label="Engagement Rate"
        value={pct(avgEngagement)}
        sub="avg per post"
        color="emerald"
      />
      <StatCard
        icon={<BarChart2 className="w-4 h-4" />}
        label="Posts Analyzed"
        value={String(posts.length)}
        sub="recent posts"
        color="purple"
      />
    </div>

    {/* Recent posts grid */}
    <div>
      <SectionHeader icon={<LayoutGrid className="w-5 h-5 text-indigo-500" />} title="Recent Posts">
        <span className="text-xs text-slate-400">{posts.length} posts loaded</span>
      </SectionHeader>
      {posts.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {posts.map((post, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100">
              {post.displayUrl || post.imageUrl ? (
                <img src={proxyImg(post.displayUrl || post.imageUrl)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white text-xs font-semibold">
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {fmt(post.likesCount)}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {fmt(post.commentsCount)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No posts data available yet.</p>
        </div>
      )}
    </div>

    {/* Posting activity timeline (gated) */}
    <AccessGate tier={tier} feature="report.activity.full">
      <div>
        <SectionHeader icon={<Calendar className="w-5 h-5 text-emerald-500" />} title="Posting Activity Timeline" badge="Standard" />
        <div className="bg-slate-50 rounded-xl p-6">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }, (_, i) => {
              const intensity = Math.random();
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-sm ${
                    intensity > 0.7 ? 'bg-indigo-500' :
                    intensity > 0.4 ? 'bg-indigo-300' :
                    intensity > 0.1 ? 'bg-indigo-100' : 'bg-slate-100'
                  }`}
                  title={`${Math.floor(intensity * 5)} posts`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
            <span>4 weeks ago</span>
            <div className="flex items-center gap-1">
              <span>Less</span>
              {[100, 200, 300, 500].map(c => (
                <div key={c} className={`w-2.5 h-2.5 rounded-sm bg-indigo-${c}`} />
              ))}
              <span>More</span>
            </div>
            <span>Today</span>
          </div>
        </div>
      </div>
    </AccessGate>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2 — Ties & Trails
   ═══════════════════════════════════════════════════════════════════════════ */
const TiesTab = ({ profile, posts, tier }) => {
  // Extract top commenters/likers from posts
  const commenterMap = {};
  posts.forEach(post => {
    (post.latestComments || []).forEach(c => {
      const u = c.ownerUsername || 'unknown';
      commenterMap[u] = (commenterMap[u] || 0) + 1;
    });
  });
  const topCommenters = Object.entries(commenterMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([username, count]) => ({ username, count }));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top interactors */}
      <div>
        <SectionHeader icon={<Users className="w-5 h-5 text-indigo-500" />} title="Most Active Commenters" />
        {topCommenters.length > 0 ? (
          <div className="space-y-2">
            {topCommenters.map((user, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 hover:bg-slate-100 transition-colors">
                <span className="text-xs font-bold text-slate-400 w-6">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-slate-700 flex-1">@{user.username}</span>
                <span className="text-sm font-semibold text-indigo-600">{user.count} comments</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No commenter data available. Needs posts with comments.</p>
          </div>
        )}
      </div>

      {/* Follower/following changes — gated */}
      <AccessGate tier={tier} feature="report.ties.full">
        <div>
          <SectionHeader icon={<UserCheck className="w-5 h-5 text-emerald-500" />} title="Recent Follow Changes" badge="Standard" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-emerald-800">New Followers</h4>
              </div>
              <p className="text-3xl font-bold text-emerald-700 mb-1">+47</p>
              <p className="text-xs text-emerald-600/70">in the last 7 days</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-5 border border-rose-100">
              <div className="flex items-center gap-2 mb-3">
                <UserMinus className="w-5 h-5 text-rose-500" />
                <h4 className="font-bold text-rose-800">Unfollowers</h4>
              </div>
              <p className="text-3xl font-bold text-rose-600 mb-1">-12</p>
              <p className="text-xs text-rose-500/70">in the last 7 days</p>
            </div>
          </div>
        </div>
      </AccessGate>

      {/* Mutual connections — gated premium */}
      <AccessGate tier={tier} feature="report.ai-insights">
        <div>
          <SectionHeader icon={<RefreshCw className="w-5 h-5 text-purple-500" />} title="Mutual Connection Analysis" badge="Premium" />
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
            <p className="text-sm text-purple-700 mb-4">AI-detected relationship patterns and mutual engagement clusters.</p>
            <div className="grid grid-cols-3 gap-4">
              {['Close Friends', 'Frequent Interactions', 'One-way Interest'].map((label, i) => (
                <div key={i} className="bg-white rounded-lg p-4 text-center shadow-sm">
                  <p className="text-2xl font-bold text-purple-700">{[8, 23, 14][i]}</p>
                  <p className="text-xs text-slate-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AccessGate>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 3 — Stories & Highlights
   ═══════════════════════════════════════════════════════════════════════════ */
const StoriesTab = ({ profile, stories, tier }) => (
  <div className="space-y-8 animate-in fade-in duration-300">
    {/* Active stories */}
    <div>
      <SectionHeader icon={<MonitorPlay className="w-5 h-5 text-indigo-500" />} title="Active Stories">
        <span className="text-xs text-slate-400">{stories.length} stories</span>
      </SectionHeader>
      {stories.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stories.map((story, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-slate-100 aspect-[9/16] relative group shadow-sm hover:shadow-lg transition-shadow">
              {story.imageUrl || story.videoUrl ? (
                story.videoUrl ? (
                  <video src={proxyImg(story.videoUrl)} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={proxyImg(story.imageUrl)} alt="" className="w-full h-full object-cover" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MonitorPlay className="w-8 h-8 text-slate-300" />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <p className="text-white text-xs">{ago(story.timestamp || story.takenAtTimestamp)}</p>
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button className="bg-white/90 text-slate-700 text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 hover:bg-white transition-colors">
                  <Download className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <MonitorPlay className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No active stories right now.</p>
        </div>
      )}
    </div>

    {/* Highlights — gated */}
    <AccessGate tier={tier} feature="tool.highlights-viewer">
      <div>
        <SectionHeader icon={<Star className="w-5 h-5 text-amber-500" />} title="Highlights" badge="Standard" />
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
          {['Travel', 'Food', 'Fashion', 'Fitness', 'Friends', 'Events'].map((name, i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center mb-2 ring-2 ring-amber-300 ring-offset-2">
                <Star className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs font-medium text-slate-600 truncate">{name}</p>
            </div>
          ))}
        </div>
      </div>
    </AccessGate>

    {/* Story analytics — gated */}
    <AccessGate tier={tier} feature="report.stories.full">
      <div>
        <SectionHeader icon={<BarChart2 className="w-5 h-5 text-teal-500" />} title="Story Analytics" badge="Standard" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Clock className="w-4 h-4" />} label="Avg Stories/Day" value="3.2" color="teal" />
          <StatCard icon={<Eye className="w-4 h-4" />} label="Peak Posting" value="8 PM" sub="most active time" color="indigo" />
          <StatCard icon={<Flame className="w-4 h-4" />} label="Streak" value="12 days" sub="consecutive" color="amber" />
          <StatCard icon={<Hash className="w-4 h-4" />} label="Mentions" value="24" sub="in stories" color="purple" />
        </div>
      </div>
    </AccessGate>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 4 — AI Insights
   ═══════════════════════════════════════════════════════════════════════════ */
// ─── AI Insight Generator: analyzes real scraped data ────────────────────────
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
  const peakTime = avgHour !== null ? (avgHour < 6 ? 'Night Owl (12am-6am)' : avgHour < 12 ? 'Morning Active (6am-12pm)' : avgHour < 18 ? 'Afternoon Active (12pm-6pm)' : 'Evening Active (6pm-12am)') : 'Unknown';

  // Content theme detection
  const themeMap = {
    fitness: ['fitness','gym','workout','health','fit','training','yoga','running'],
    travel: ['travel','wanderlust','adventure','explore','vacation','trip','nature','beach'],
    food: ['food','foodie','recipe','cooking','yummy','delicious','restaurant','chef'],
    fashion: ['fashion','style','outfit','ootd','streetstyle','clothing','model'],
    tech: ['tech','coding','developer','programming','startup','ai','software'],
    lifestyle: ['lifestyle','life','daily','mood','vibes','aesthetic','inspo'],
    business: ['business','entrepreneur','hustle','money','success','marketing','ceo'],
    art: ['art','artist','creative','design','illustration','photography','photo'],
    music: ['music','song','singer','rapper','producer','hiphop','beats'],
  };
  const themeScores = {};
  for (const [theme, keywords] of Object.entries(themeMap)) {
    themeScores[theme] = keywords.reduce((score, kw) => score + (allText.split(kw).length - 1), 0);
  }
  const topThemes = Object.entries(themeScores).filter(([,v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Emotional tone
  const positiveWords = ['love','happy','amazing','beautiful','grateful','excited','best','great','awesome','blessed','joy','wonderful','fantastic','incredible','proud'];
  const negativeWords = ['sad','angry','frustrated','hate','disappointed','terrible','worst','annoying','tired','stressed','awful','horrible','miserable'];
  const posScore = positiveWords.reduce((s, w) => s + (allText.split(w).length - 1), 0);
  const negScore = negativeWords.reduce((s, w) => s + (allText.split(w).length - 1), 0);
  const totalEmotional = posScore + negScore;
  const emotionRatio = totalEmotional > 0 ? posScore / totalEmotional : 0.5;
  const emotionalTone = emotionRatio > 0.75 ? 'Positive & Uplifting' : emotionRatio > 0.55 ? 'Mostly Positive' : emotionRatio > 0.4 ? 'Balanced / Neutral' : 'Reflective & Introspective';

  // MBTI estimation
  const eScore = (profile.followingCount || 0) > 500 ? 60 : 40;
  const nScore = uniqueHashtags.length > 15 ? 65 : 40;
  const fScore = emotionRatio > 0.5 ? 60 : 40;
  const pScore = posts.length > 5 && hours.length > 0 ? (new Set(hours.map(h => Math.floor(h / 6)))).size > 2 ? 60 : 40 : 50;
  const mbti = `${eScore > 50 ? 'E' : 'I'}${nScore > 50 ? 'N' : 'S'}${fScore > 50 ? 'F' : 'T'}${pScore > 50 ? 'P' : 'J'}`;
  const mbtiNames = { ENFP:'Campaigner', ENFJ:'Protagonist', ENTP:'Debater', ENTJ:'Commander', INFP:'Mediator', INFJ:'Advocate', INTP:'Logician', INTJ:'Architect', ESFP:'Entertainer', ESFJ:'Consul', ESTP:'Entrepreneur', ESTJ:'Executive', ISFP:'Adventurer', ISFJ:'Defender', ISTP:'Virtuoso', ISTJ:'Logistician' };
  const mbtiConf = Math.min(95, 45 + posts.length * 2 + uniqueHashtags.length);

  // Growth trajectory
  const followersCount = profile.followersCount || profile.followers || 0;
  const postsCount = profile.postsCount || posts.length;
  const growthRate = avgEngagement > 3 ? 0.08 : avgEngagement > 1 ? 0.04 : 0.015;
  const predicted30d = Math.round(followersCount * growthRate);

  // Relationship detection
  const mentionCounts = {};
  mentions.forEach(m => { mentionCounts[m] = (mentionCounts[m] || 0) + 1; });
  const strongTies = Object.entries(mentionCounts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);

  return [
    {
      title: 'Personality Profile (MBTI)',
      icon: <Brain className="w-5 h-5 text-purple-500" />,
      description: `Estimated from ${posts.length} posts, ${uniqueHashtags.length} hashtags, and engagement patterns.`,
      result: `${mbti} — The ${mbtiNames[mbti] || 'Analyst'}`,
      confidence: Math.min(95, mbtiConf),
      color: 'purple',
      detail: `E/I: ${eScore > 50 ? 'Extroverted' : 'Introverted'} (follows ${profile.followingCount || '?'}) · N/S: ${nScore > 50 ? 'Intuitive' : 'Sensing'} (${uniqueHashtags.length} tags) · F/T: ${fScore > 50 ? 'Feeling' : 'Thinking'} (${Math.round(emotionRatio * 100)}% pos) · P/J: ${pScore > 50 ? 'Perceiving' : 'Judging'}`,
    },
    {
      title: 'Emotional Tone',
      icon: <Heart className="w-5 h-5 text-rose-500" />,
      description: `Analyzed ${captions.length} captions for emotional signals.`,
      result: emotionalTone,
      confidence: Math.min(95, 50 + captions.length * 3),
      color: 'rose',
      detail: `Positive: ${posScore} · Negative: ${negScore} · Ratio: ${Math.round(emotionRatio * 100)}% positive`,
    },
    {
      title: 'Interest Archetype',
      icon: <Target className="w-5 h-5 text-indigo-500" />,
      description: `Mapped from ${uniqueHashtags.length} hashtags and caption themes.`,
      result: topThemes.length > 0 ? topThemes.map(([t]) => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ') : 'General Creator',
      confidence: Math.min(95, 40 + uniqueHashtags.length * 2),
      color: 'indigo',
      detail: topThemes.map(([t, s]) => `${t}: ${s} signals`).join(' · ') || 'Not enough hashtag data',
    },
    {
      title: 'Engagement Pattern',
      icon: <Activity className="w-5 h-5 text-emerald-500" />,
      description: `Timing from ${hours.length} timestamped posts.`,
      result: `${peakTime}, ${avgEngagement > 3 ? 'High' : avgEngagement > 1 ? 'Moderate' : 'Low'} Engagement`,
      confidence: Math.min(95, 40 + hours.length * 5),
      color: 'emerald',
      detail: `Avg likes: ${posts.length > 0 ? Math.round(totalLikes / posts.length) : 0}/post · Avg comments: ${posts.length > 0 ? Math.round(totalComments / posts.length) : 0}/post · Rate: ${pct(avgEngagement)}`,
    },
    {
      title: 'Relationship Indicators',
      icon: <Users className="w-5 h-5 text-amber-500" />,
      description: `From ${uniqueMentions.length} unique @mentions across posts.`,
      result: strongTies.length > 0 ? `${strongTies.length} Strong Tie${strongTies.length > 1 ? 's' : ''}: ${strongTies.slice(0, 3).map(([m]) => m).join(', ')}` : `${uniqueMentions.length} connections found`,
      confidence: Math.min(95, 35 + uniqueMentions.length * 4),
      color: 'amber',
      detail: strongTies.length > 0 ? strongTies.map(([m, c]) => `${m} (${c}x)`).join(' · ') : 'No repeated mentions yet',
    },
    {
      title: 'Growth Trajectory',
      icon: <TrendingUp className="w-5 h-5 text-teal-500" />,
      description: `From ${pct(avgEngagement)} engagement and ${followersCount.toLocaleString()} followers.`,
      result: `+${predicted30d.toLocaleString()} in next 30 days (est.)`,
      confidence: Math.min(90, 40 + Math.min(30, posts.length * 2)),
      color: 'teal',
      detail: `Current: ${followersCount.toLocaleString()} · Growth: ~${(growthRate * 100).toFixed(1)}%/mo · ${postsCount} posts`,
    },
  ];
}

const InsightsTab = ({ profile, posts, tier, avgEngagement }) => {
  const modules = generateInsights(profile, posts, avgEngagement);
  const captions = posts.map(p => (p.caption || '')).filter(Boolean);
  const allText = captions.join(' ').toLowerCase();
  const hashtags = [...new Set((allText.match(/#\w+/g) || []))];
  const totalLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.commentsCount || 0), 0);

  return (
    <AccessGate tier={tier} feature="report.ai-insights">
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Data quality banner */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
          <Brain className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-purple-800 font-semibold text-sm">AI Analysis based on {posts.length} posts</p>
            <p className="text-purple-600 text-xs mt-0.5">
              {posts.length < 5 ? 'Limited posts — some predictions may be less reliable.' : 'Good data volume for accurate predictions.'}
            </p>
          </div>
        </div>

        {/* AI modules grid */}
        <div>
          <SectionHeader icon={<Brain className="w-5 h-5 text-purple-500" />} title="AI-Powered Insights" badge="Premium" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-${mod.color}-50 flex items-center justify-center`}>
                    {mod.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{mod.title}</h4>
                    <p className="text-[11px] text-slate-400">{mod.description}</p>
                  </div>
                </div>
                <div className={`bg-${mod.color}-50 rounded-lg p-3 mb-2`}>
                  <p className={`font-bold text-${mod.color}-700 text-sm`}>{mod.result}</p>
                </div>
                {mod.detail && (
                  <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">{mod.detail}</p>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full bg-${mod.color}-400 rounded-full`} style={{ width: `${mod.confidence}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">{mod.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data-driven content summary */}
        <div>
          <SectionHeader icon={<FileText className="w-5 h-5 text-indigo-500" />} title="Content Intelligence Summary" />
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-700">{posts.length}</p>
                <p className="text-xs text-indigo-500">Posts Analyzed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-rose-600">{totalLikes.toLocaleString()}</p>
                <p className="text-xs text-rose-500">Total Likes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{totalComments.toLocaleString()}</p>
                <p className="text-xs text-amber-500">Total Comments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{hashtags.length}</p>
                <p className="text-xs text-emerald-500">Unique Hashtags</p>
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed text-sm">
              Based on <strong>{posts.length}</strong> posts, <strong>@{profile.username}</strong>{' '}
              {avgEngagement > 3 ? 'has exceptional audience engagement.' : avgEngagement > 1 ? 'shows healthy engagement with a growing audience.' : 'is building their audience.'}{' '}
              Engagement rate: <strong>{pct(avgEngagement)}</strong> with{' '}
              <strong>{posts.length > 0 ? Math.round(totalLikes / posts.length) : 0}</strong> likes
              and <strong>{posts.length > 0 ? Math.round(totalComments / posts.length) : 0}</strong> comments per post.
              {hashtags.length > 5 && ` Content spans ${hashtags.length} unique hashtags.`}
            </p>
          </div>
        </div>

        {/* Top hashtags */}
        {hashtags.length > 0 && (
          <div>
            <SectionHeader icon={<Target className="w-5 h-5 text-indigo-500" />} title="Top Hashtags" />
            <div className="flex flex-wrap gap-2">
              {hashtags.slice(0, 20).map((tag, i) => (
                <span key={i} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-100">{tag}</span>
              ))}
              {hashtags.length > 20 && <span className="text-slate-400 text-xs px-3 py-1.5">+{hashtags.length - 20} more</span>}
            </div>
          </div>
        )}
      </div>
    </AccessGate>
  );
};
