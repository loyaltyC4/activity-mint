import React, { useState } from 'react';
import {
  MonitorPlay, Eye, Search, Download, User, Heart, MessageCircle,
  Image as ImageIcon, Video, AlertCircle, RefreshCw, ExternalLink,
  CheckCircle, Clock, ChevronDown,
} from 'lucide-react';
import { fetchInstagramStories, fetchInstagramProfile } from './lib/apify';

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
  const [stories, setStories] = useState([]);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    setStatus('loading');
    setStories([]);
    setError('');
    setSearched(username.trim());
    try {
      const items = await fetchInstagramStories(username.trim());
      setStories(items || []);
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
                Fetching stories for <span className="font-semibold text-indigo-600">@{searched}</span> via Apify — this usually takes 20–60 seconds…
              </p>
              <LoadingSkeleton count={6} />
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <h3 className="font-bold text-red-700 mb-2">Couldn't fetch stories</h3>
              <p className="text-red-600 text-sm mb-6">{error}</p>
              <p className="text-slate-500 text-xs">Only public accounts can be scraped. Private profiles, or accounts with no active stories, will return empty results.</p>
            </div>
          )}

          {status === 'success' && stories.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <MonitorPlay className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-bold text-slate-700 mb-2">No stories found</h3>
              <p className="text-slate-500 text-sm">
                <span className="font-semibold text-indigo-600">@{searched}</span> may not have active stories, or the account is private.
              </p>
            </div>
          )}

          {status === 'success' && stories.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Stories from <span className="text-indigo-600">@{searched}</span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">{stories.length} stor{stories.length === 1 ? 'y' : 'ies'} found</p>
                </div>
                <button
                  onClick={handleSearch}
                  className="flex items-center gap-2 text-sm text-indigo-600 border border-indigo-200 px-4 py-2 rounded-full hover:bg-indigo-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {stories.map((story, i) => {
                  const isVideo = story.type === 'Video' || story.videoUrl;
                  const thumb = story.displayUrl || story.thumbnailUrl || story.imageUrl;
                  const downloadUrl = story.videoUrl || story.displayUrl;
                  return (
                    <div key={i} className="group relative bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all">
                      {thumb ? (
                        <img
                          src={proxyImageUrl(thumb)}
                          alt={`Story ${i + 1}`}
                          className="w-full aspect-[9/16] object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full aspect-[9/16] bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                          {isVideo ? <Video className="w-10 h-10 text-indigo-300" /> : <ImageIcon className="w-10 h-10 text-indigo-300" />}
                        </div>
                      )}
                      {/* Overlay with type badge + download */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white text-xs font-semibold bg-black/40 px-2 py-1 rounded-full flex items-center gap-1">
                            {isVideo ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                            {isVideo ? 'Video' : 'Photo'}
                          </span>
                          {downloadUrl && (
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 px-2 py-1 rounded-full flex items-center gap-1 transition-colors"
                            >
                              <Download className="w-3 h-3" /> Save
                            </a>
                          )}
                        </div>
                      </div>
                      {story.timestamp && (
                        <div className="px-3 py-2 text-xs text-slate-400">
                          {new Date(story.timestamp).toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {status === 'idle' && (
            <div className="text-center py-16 text-slate-400">
              <MonitorPlay className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-slate-500">Enter a public Instagram username above to view their active stories</p>
              <p className="text-sm mt-2">Results are fetched live — allow 20–60 seconds for the scraper to run</p>
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
