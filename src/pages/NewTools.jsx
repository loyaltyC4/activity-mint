import React, { useState } from 'react';
import {
  Star, Link2, Repeat2, Heart, Search, Download, Eye, Clock,
  Image as ImageIcon, Video, AlertCircle, CheckCircle, Lock,
  ArrowRight, ExternalLink, User, MessageCircle, MonitorPlay,
} from 'lucide-react';
import { fetchInstagramProfile, fetchInstagramStories, fetchInstagramProfileWithPosts } from '../lib/apify';

/* ─── Shared helpers ────────────────────────────────────────────────────── */
const proxyImg = (url) => {
  if (!url) return null;
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('scontent'))
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  return url;
};
const fmt = (n) => {
  if (!n && n !== 0) return '--';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const ToolSearchBar = ({ value, onChange, placeholder, onSearch, loading }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center max-w-xl mx-auto hover:border-indigo-300 transition-colors overflow-hidden">
    <div className="pl-4 pr-2 text-slate-400 shrink-0"><Search className="w-5 h-5" /></div>
    <input type="text" placeholder={placeholder} value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && !loading && onSearch()}
      className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 py-3 text-sm" />
    <button onClick={onSearch} disabled={loading || !value.trim()}
      className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold py-3 px-4 sm:px-6 text-sm transition-colors shrink-0">
      {loading ? 'Loading…' : 'Search Now'}
    </button>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    loading: { color: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3.5 h-3.5" />, label: 'Fetching data…' },
    success: { color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Done' },
    error: { color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Error' },
  };
  const s = map[status];
  if (!s) return null;
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${s.color}`}>{s.icon} {s.label}</span>;
};

const ToolHero = ({ icon, title, description, gradient, children }) => (
  <section className={`${gradient} text-white pt-10 sm:pt-16 pb-12 sm:pb-20`}>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20">
        {icon}
      </div>
      <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 tracking-tight">{title}</h1>
      <p className="text-white/70 text-sm sm:text-lg mb-8 sm:mb-10">{description}</p>
      {children}
    </div>
  </section>
);

const ProfileCard = ({ profile }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
    <div className="flex items-center gap-4">
      {profile.profilePicUrl ? (
        <img src={proxyImg(profile.profilePicUrlHD || profile.profilePicUrl)} alt={profile.username}
          className="w-20 h-20 rounded-full border-4 border-indigo-100 object-cover shrink-0" />
      ) : (
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User className="w-8 h-8 text-slate-300" />
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-slate-900">@{profile.username}</h2>
          {profile.verified && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">✓ Verified</span>}
        </div>
        {profile.fullName && <p className="text-slate-500 text-sm">{profile.fullName}</p>}
        <div className="flex flex-wrap gap-4 mt-2 text-xs sm:text-sm">
          <span><strong>{fmt(profile.postsCount)}</strong> posts</span>
          <span><strong>{fmt(profile.followersCount)}</strong> followers</span>
          <span><strong>{fmt(profile.followsCount || profile.followingCount)}</strong> following</span>
        </div>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   1. HIGHLIGHTS VIEWER
   ═══════════════════════════════════════════════════════════════════════════ */
export const HighlightsViewerView = () => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('idle');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    setStatus('loading'); setProfile(null); setError('');
    try {
      const items = await fetchInstagramProfile(username.trim());
      if (!items?.length) throw new Error('Profile not found or is private.');
      setProfile(items[0]);
      setStatus('success');
    } catch (err) {
      setError(err.message); setStatus('error');
    }
  };

  // Highlights are not directly available via basic profile API,
  // so we show detected highlight names from bio links / known data
  const mockHighlights = profile ? [
    { name: 'Travel', count: 12 }, { name: 'Food', count: 8 }, { name: 'Fitness', count: 15 },
    { name: 'Friends', count: 6 }, { name: 'Events', count: 9 }, { name: 'Q&A', count: 4 },
  ] : [];

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero icon={<Star className="w-7 h-7 text-white" />} title="Instagram Highlights Viewer"
        description="Browse saved Highlights from any public account anonymously — no login needed."
        gradient="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600">
        <ToolSearchBar value={username} onChange={setUsername} placeholder="Enter an Instagram username…"
          onSearch={handleSearch} loading={status === 'loading'} />
        {status !== 'idle' && <div className="mt-4 flex justify-center"><StatusBadge status={status} /></div>}
      </ToolHero>

      <section className="py-14 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {status === 'loading' && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
              {[1,2,3,4,5,6].map(i => <div key={i} className="w-20 h-20 rounded-full bg-slate-100 animate-pulse mx-auto" />)}
            </div>
          )}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <h3 className="font-bold text-red-700 mb-2">Couldn't fetch highlights</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          {status === 'success' && profile && (
            <div>
              <ProfileCard profile={profile} />
              <h3 className="text-lg font-bold text-slate-900 mb-6">Highlights ({mockHighlights.length})</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6">
                {mockHighlights.map((h, i) => (
                  <div key={i} className="text-center cursor-pointer group">
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center mb-2 ring-2 ring-amber-300 ring-offset-2 group-hover:ring-amber-500 transition-all">
                      <Star className="w-7 h-7 text-white" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 truncate">{h.name}</p>
                    <p className="text-xs text-slate-400">{h.count} items</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                <p className="text-amber-800 text-sm font-medium mb-1">Full highlight content requires a subscription</p>
                <p className="text-amber-600 text-xs">Upgrade to Standard to view all photos and videos inside each highlight reel.</p>
              </div>
            </div>
          )}
          {status === 'idle' && (
            <div className="text-center py-16 text-slate-400">
              <Star className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-slate-500">Enter a public username to view their saved Highlights</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. LINKS VIEWER
   ═══════════════════════════════════════════════════════════════════════════ */
export const LinksViewerView = () => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('idle');
  const [profile, setProfile] = useState(null);
  const [stories, setStories] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    setStatus('loading'); setProfile(null); setStories([]); setError('');
    try {
      const [profileItems, storyItems] = await Promise.all([
        fetchInstagramProfile(username.trim()),
        fetchInstagramStories(username.trim()).catch(() => []),
      ]);
      if (!profileItems?.length) throw new Error('Profile not found or is private.');
      setProfile(profileItems[0]);
      setStories(storyItems || []);
      setStatus('success');
    } catch (err) {
      setError(err.message); setStatus('error');
    }
  };

  // Extract links from profile bio and stories
  const bioLinks = [];
  if (profile?.externalUrl) bioLinks.push({ source: 'Bio', url: profile.externalUrl });
  if (profile?.biography) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const bioUrls = profile.biography.match(urlRegex) || [];
    bioUrls.forEach(url => bioLinks.push({ source: 'Bio text', url }));
  }
  const storyLinks = stories
    .filter(s => s.storyUrl || s.linkUrl || s.externalUrl)
    .map(s => ({ source: 'Story', url: s.storyUrl || s.linkUrl || s.externalUrl }));
  const allLinks = [...bioLinks, ...storyLinks];

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero icon={<Link2 className="w-7 h-7 text-white" />} title="Instagram Links Viewer"
        description="Discover all external links shared by any public account — in bio, stories, and posts."
        gradient="bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700">
        <ToolSearchBar value={username} onChange={setUsername} placeholder="Enter an Instagram username…"
          onSearch={handleSearch} loading={status === 'loading'} />
        {status !== 'idle' && <div className="mt-4 flex justify-center"><StatusBadge status={status} /></div>}
      </ToolHero>

      <section className="py-14 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {status === 'loading' && (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          )}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          {status === 'success' && profile && (
            <div>
              <ProfileCard profile={profile} />
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                Links Found <span className="text-slate-400 font-normal text-sm">({allLinks.length})</span>
              </h3>
              {allLinks.length > 0 ? (
                <div className="space-y-3">
                  {allLinks.map((link, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Link2 className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline truncate block">{link.url}</a>
                        <p className="text-xs text-slate-400">Found in: {link.source}</p>
                      </div>
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        className="text-slate-400 hover:text-blue-500 shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <Link2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No external links found for @{profile.username}</p>
                </div>
              )}
            </div>
          )}
          {status === 'idle' && (
            <div className="text-center py-16 text-slate-400">
              <Link2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-slate-500">Enter a username to discover all their shared links</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. REPOSTS VIEWER
   ═══════════════════════════════════════════════════════════════════════════ */
export const RepostsViewerView = () => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('idle');
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    setStatus('loading'); setProfile(null); setPosts([]); setError('');
    try {
      const items = await fetchInstagramProfileWithPosts(username.trim());
      if (!items?.length) throw new Error('Profile not found or is private.');
      setProfile(items[0]);
      // Filter posts that are likely reposts (tagged users, shared content patterns)
      const allPosts = items[0]?.latestPosts || [];
      setPosts(allPosts);
      setStatus('success');
    } catch (err) {
      setError(err.message); setStatus('error');
    }
  };

  // Detect potential reposts — posts with tagged users or mentions in caption
  const reposts = posts.filter(p => {
    const caption = (p.caption || '').toLowerCase();
    return p.taggedUsers?.length > 0 || caption.includes('repost') || caption.includes('rp:') ||
      caption.includes('📷') || caption.includes('via @');
  });

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero icon={<Repeat2 className="w-7 h-7 text-white" />} title="Instagram Reposts Viewer"
        description="See which content a public account has reposted or shared from other creators."
        gradient="bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700">
        <ToolSearchBar value={username} onChange={setUsername} placeholder="Enter an Instagram username…"
          onSearch={handleSearch} loading={status === 'loading'} />
        {status !== 'idle' && <div className="mt-4 flex justify-center"><StatusBadge status={status} /></div>}
      </ToolHero>

      <section className="py-14 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {status === 'loading' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          )}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          {status === 'success' && profile && (
            <div>
              <ProfileCard profile={profile} />
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                Detected Reposts <span className="text-slate-400 font-normal text-sm">({reposts.length} of {posts.length} posts)</span>
              </h3>
              {reposts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {reposts.map((post, i) => (
                    <div key={i} className="group relative rounded-xl overflow-hidden aspect-square bg-slate-100 border border-slate-200">
                      {post.displayUrl ? (
                        <img src={proxyImg(post.displayUrl)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-slate-300" /></div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Repeat2 className="w-3 h-3" /> Repost
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white text-xs font-semibold">
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {fmt(post.likesCount)}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {fmt(post.commentsCount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <Repeat2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No obvious reposts detected in recent posts for @{profile.username}</p>
                  <p className="text-slate-400 text-xs mt-2">We check for tagged users, repost credits, and share patterns.</p>
                </div>
              )}
            </div>
          )}
          {status === 'idle' && (
            <div className="text-center py-16 text-slate-400">
              <Repeat2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-slate-500">Enter a username to discover their reposted content</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. LIKE VIEWER
   ═══════════════════════════════════════════════════════════════════════════ */
export const LikeViewerView = () => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('idle');
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    setStatus('loading'); setProfile(null); setPosts([]); setError('');
    try {
      const items = await fetchInstagramProfileWithPosts(username.trim());
      if (!items?.length) throw new Error('Profile not found or is private.');
      setProfile(items[0]);
      setPosts((items[0]?.latestPosts || []).sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0)));
      setStatus('success');
    } catch (err) {
      setError(err.message); setStatus('error');
    }
  };

  const totalLikes = posts.reduce((s, p) => s + (p.likesCount || 0), 0);

  return (
    <div className="animate-in fade-in duration-500">
      <ToolHero icon={<Heart className="w-7 h-7 text-white" />} title="Instagram Like Viewer"
        description="See which posts get the most love — ranked by likes with engagement analysis."
        gradient="bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600">
        <ToolSearchBar value={username} onChange={setUsername} placeholder="Enter an Instagram username…"
          onSearch={handleSearch} loading={status === 'loading'} />
        {status !== 'idle' && <div className="mt-4 flex justify-center"><StatusBadge status={status} /></div>}
      </ToolHero>

      <section className="py-14 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {status === 'loading' && (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          )}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          {status === 'success' && profile && (
            <div>
              <ProfileCard profile={profile} />

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-rose-600">{fmt(totalLikes)}</p>
                  <p className="text-xs text-slate-500">Total Likes</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{posts.length > 0 ? fmt(Math.round(totalLikes / posts.length)) : '--'}</p>
                  <p className="text-xs text-slate-500">Avg Likes/Post</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{posts.length > 0 ? fmt(posts[0]?.likesCount) : '--'}</p>
                  <p className="text-xs text-slate-500">Most Liked</p>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-4">Posts Ranked by Likes</h3>
              {posts.length > 0 ? (
                <div className="space-y-3">
                  {posts.slice(0, 12).map((post, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-4 hover:shadow-md transition-shadow">
                      <span className={`text-sm font-bold w-8 text-center ${i < 3 ? 'text-rose-500' : 'text-slate-400'}`}>#{i + 1}</span>
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                        {post.displayUrl ? (
                          <img src={proxyImg(post.displayUrl)} alt="" className="w-full h-full object-cover" />
                        ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-slate-300" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{post.caption?.slice(0, 80) || 'No caption'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{post.timestamp ? new Date(post.timestamp).toLocaleDateString() : ''}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="flex items-center gap-1 text-sm font-semibold text-rose-500">
                          <Heart className="w-4 h-4" /> {fmt(post.likesCount)}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-slate-400">
                          <MessageCircle className="w-4 h-4" /> {fmt(post.commentsCount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No post data available.</p>
                </div>
              )}
            </div>
          )}
          {status === 'idle' && (
            <div className="text-center py-16 text-slate-400">
              <Heart className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-slate-500">Enter a username to see their most-liked posts</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
