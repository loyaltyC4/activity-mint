import React, { useState } from 'react';
import {
  MonitorPlay, Eye, Search, Download, User, Heart, MessageCircle,
  Image as ImageIcon, Video, AlertCircle, RefreshCw, ExternalLink,
  CheckCircle, Clock, ChevronDown,
} from 'lucide-react';
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

/* ─── Shared inner components ───────────────────────────────────────────── */

const ApifySearchBar = ({ value, onChange, placeholder, onSearch, loading }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center max-w-xl mx-auto hover:border-indigo-300 transition-colors overflow-hidden">
    <div className="pl-4 pr-2 text-slate-400 shrink-0">
      <Search className="w-5 h-5" />
    </div>
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && !loading && onSearch()}
      className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 py-3 text-sm"
    />
    <button
      onClick={onSearch}
      disabled={loading || !value.trim()}
      className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 text-sm transition-colors shrink-0"
    >
      {loading ? 'Loading…' : 'Search Now'}
    </button>
  </div>
);

const LoadingSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="aspect-square bg-slate-100 rounded-xl animate-pulse" />
    ))}
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    idle: null,
    loading: { color: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3.5 h-3.5" />, label: 'Fetching data…' },
    success: { color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Done' },
    error: { color: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Error' },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
};

/* ─── Story Viewer ───────────────────────────────────────────────────────── */

export const StoryViewerView = () => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    setStatus('loading');
    setProfile(null);
    setError('');
    setSearched(username.trim());
    try {
      // Note: Instagram's story API requires authentication.
      // We fetch profile + recent posts as an alternative.
      const items = await fetchInstagramProfile(username.trim());
      if (!items || items.length === 0) {
        throw new Error('Profile not found or is private.');
      }
      setProfile(items[0]);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Something went wrong. The account may be private or Instagram may be blocking the request.');
      setStatus('error');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-600 via-indigo-600 to-teal-600 text-white pt-16 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20">
            <MonitorPlay className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Instagram Story Viewer</h1>
          <p className="text-indigo-100/80 text-lg mb-10">
            View and download Instagram Stories from any public account — completely anonymously.
          </p>
          <ApifySearchBar
            value={username}
            onChange={setUsername}
            placeholder="Enter an Instagram username…"
            onSearch={handleSearch}
            loading={status === 'loading'}
          />
          {status !== 'idle' && (
            <div className="mt-4 flex justify-center">
              <StatusBadge status={status} />
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="py-14 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {status === 'loading' && (
            <div>
              <p className="text-slate-500 text-sm text-center mb-6">
                Fetching profile for <span className="font-semibold text-indigo-600">@{searched}</span> — this usually takes 20–60 seconds…
              </p>
              <LoadingSkeleton count={6} />
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <h3 className="font-bold text-red-700 mb-2">Couldn't fetch profile</h3>
              <p className="text-red-600 text-sm mb-6">{error}</p>
              <p className="text-slate-500 text-xs">Only public accounts can be viewed. Private profiles will return empty results.</p>
            </div>
          )}

          {status === 'success' && profile && (
            <div>
              {/* Story limitation notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-800 text-sm">Story Access Limited</h4>
                    <p className="text-amber-700 text-xs mt-1">Instagram requires authentication to view stories. We're showing the profile and recent posts instead. Full story access coming soon with our enhanced viewer.</p>
                  </div>
                </div>
              </div>

              {/* Profile card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
                <div className="flex items-center gap-4">
                  {profile.profilePicUrl ? (
                    <img
                      src={proxyImageUrl(profile.profilePicUrlHD || profile.profilePicUrl)}
                      alt={profile.username}
                      className="w-20 h-20 rounded-full border-4 border-purple-100 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-slate-900">@{profile.username}</h2>
                      {profile.verified && (
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
                      )}
                    </div>
                    {profile.fullName && <p className="text-slate-500 text-sm">{profile.fullName}</p>}
                    <div className="flex gap-4 mt-2 text-sm">
                      <span><strong>{profile.postsCount?.toLocaleString() || 0}</strong> posts</span>
                      <span><strong>{profile.followersCount?.toLocaleString() || 0}</strong> followers</span>
                      <span><strong>{profile.followsCount?.toLocaleString() || 0}</strong> following</span>
                    </div>
                  </div>
                </div>
                {profile.biography && (
                  <p className="text-slate-600 text-sm mt-4 leading-relaxed">{profile.biography}</p>
                )}
              </div>

              {/* Recent posts */}
              {profile.latestPosts && profile.latestPosts.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Recent Posts <span className="text-slate-400 font-normal text-sm">({profile.latestPosts.length})</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {profile.latestPosts.map((post, i) => {
                      const isVideo = post.type === 'Video' || post.videoUrl;
                      const thumb = post.displayUrl || post.thumbnailUrl;
                      return (
                        <div key={i} className="group relative bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all aspect-square">
                          {thumb ? (
                            <img
                              src={proxyImageUrl(thumb)}
                              alt={`Post ${i + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                              {isVideo ? <Video className="w-8 h-8 text-purple-300" /> : <ImageIcon className="w-8 h-8 text-purple-300" />}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-xs font-semibold">
                            <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {post.likesCount?.toLocaleString() || 0}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> {post.commentsCount || 0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'idle' && (
            <div className="text-center py-16 text-slate-400">
              <MonitorPlay className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-slate-500">Enter a public Instagram username to view their profile and posts</p>
              <p className="text-sm mt-2">Profile photo, bio, stats, and recent posts — all fetched live via Apify</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ─── Post / Profile Viewer ─────────────────────────────────────────────── */

export const PostViewerView = () => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('idle');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    setStatus('loading');
    setProfile(null);
    setError('');
    setSearched(username.trim());
    try {
      const items = await fetchInstagramProfile(username.trim());
      if (!items || items.length === 0) throw new Error('No profile data returned. The account may not exist or may be private.');
      setProfile(items[0]);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Something went wrong. The account may be private.');
      setStatus('error');
    }
  };

  const fmt = (n) => {
    if (!n && n !== 0) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero */}
      <section className="bg-gradient-to-br from-teal-600 via-emerald-600 to-indigo-700 text-white pt-16 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20">
            <Eye className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Instagram Post Viewer</h1>
          <p className="text-teal-100/80 text-lg mb-10">
            View any public Instagram profile, their photo, bio, and recent posts — privately.
          </p>
          <ApifySearchBar
            value={username}
            onChange={setUsername}
            placeholder="Enter an Instagram username…"
            onSearch={handleSearch}
            loading={status === 'loading'}
          />
          {status !== 'idle' && (
            <div className="mt-4 flex justify-center">
              <StatusBadge status={status} />
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="py-14 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {status === 'loading' && (
            <div>
              <p className="text-slate-500 text-sm text-center mb-8">
                Fetching profile for <span className="font-semibold text-teal-600">@{searched}</span> — this usually takes 20–60 seconds…
              </p>
              {/* Profile skeleton */}
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm mb-6 flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-slate-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-slate-100 rounded w-32 animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded w-48 animate-pulse" />
                  <div className="flex gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-4 bg-slate-100 rounded w-16 animate-pulse" />)}
                  </div>
                </div>
              </div>
              <LoadingSkeleton count={9} />
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <h3 className="font-bold text-red-700 mb-2">Couldn't fetch profile</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {status === 'success' && profile && (
            <div>
              {/* Profile card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 mb-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {profile.profilePicUrl ? (
                    <div className="relative group shrink-0">
                      <img
                        src={proxyImageUrl(profile.profilePicUrlHD || profile.profilePicUrl)}
                        alt={profile.username}
                        className="w-24 h-24 rounded-full border-4 border-emerald-100 object-cover"
                        onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${profile.username}`; }}
                      />
                      <a
                        href={proxyImageUrl(profile.profilePicUrlHD || profile.profilePicUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-6 h-6 text-white" />
                      </a>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="w-10 h-10 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
                      <h2 className="text-xl font-bold text-slate-900">@{profile.username}</h2>
                      {profile.verified && (
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
                      )}
                    </div>
                    {profile.fullName && <p className="text-slate-500 text-sm mb-2">{profile.fullName}</p>}
                    {profile.biography && <p className="text-slate-600 text-sm leading-relaxed mb-4 max-w-lg">{profile.biography}</p>}
                    <div className="flex gap-6 justify-center sm:justify-start text-sm">
                      <div className="text-center sm:text-left">
                        <p className="font-bold text-slate-900">{fmt(profile.postsCount)}</p>
                        <p className="text-slate-500 text-xs">Posts</p>
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="font-bold text-slate-900">{fmt(profile.followersCount)}</p>
                        <p className="text-slate-500 text-xs">Followers</p>
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="font-bold text-slate-900">{fmt(profile.followsCount)}</p>
                        <p className="text-slate-500 text-xs">Following</p>
                      </div>
                    </div>
                    {profile.externalUrl && (
                      <a
                        href={profile.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:underline mt-3"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> {profile.externalUrl}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent posts */}
              {profile.latestPosts && profile.latestPosts.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Recent Posts <span className="text-slate-400 font-normal text-sm">({profile.latestPosts.length})</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {profile.latestPosts.map((post, i) => (
                      <div key={i} className="group relative bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all aspect-square">
                        {post.displayUrl ? (
                          <img
                            src={proxyImageUrl(post.displayUrl)}
                            alt={`Post ${i + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-teal-100 to-indigo-100 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-teal-300" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                          <div className="flex items-center gap-3 text-white text-xs font-semibold">
                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {fmt(post.likesCount)}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {fmt(post.commentsCount)}</span>
                          </div>
                          {post.displayUrl && (
                            <a
                              href={post.displayUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" /> Download
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'idle' && (
            <div className="text-center py-16 text-slate-400">
              <Eye className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-slate-500">Enter a public Instagram username to view their profile and posts</p>
              <p className="text-sm mt-2">Profile photo, bio, stats, and recent posts — all fetched live via Apify</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
