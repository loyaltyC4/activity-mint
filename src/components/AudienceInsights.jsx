import React, { useState, useMemo } from 'react';
import {
  Users, TrendingUp, Sparkles, Crown, Zap, Target,
  Heart, MessageSquare, Clock, Hash, Camera, PenTool,
  Lightbulb, ArrowRight, Star, Eye, RefreshCw, Brain,
  BarChart2, Flame, Award, ChevronRight, Copy, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const fmt = (n) => {
  if (n === null || n === undefined) return '--';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const proxyImg = (url) => {
  if (!url) return null;
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('scontent'))
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  return url;
};

/* ─── Interest Categories ─────────────────────────────────────────────── */
const INTEREST_CATEGORIES = {
  fitness: { label: 'Fitness & Health', icon: '💪', keywords: ['gym', 'workout', 'fitness', 'health', 'yoga', 'run', 'training'] },
  fashion: { label: 'Fashion & Style', icon: '👗', keywords: ['fashion', 'style', 'outfit', 'wear', 'clothing', 'dress'] },
  food: { label: 'Food & Dining', icon: '🍕', keywords: ['food', 'cook', 'recipe', 'restaurant', 'eat', 'chef', 'foodie'] },
  travel: { label: 'Travel & Adventure', icon: '✈️', keywords: ['travel', 'vacation', 'trip', 'explore', 'adventure', 'wanderlust'] },
  tech: { label: 'Technology', icon: '💻', keywords: ['tech', 'code', 'software', 'developer', 'startup', 'ai', 'crypto'] },
  beauty: { label: 'Beauty & Skincare', icon: '💄', keywords: ['beauty', 'makeup', 'skincare', 'cosmetic', 'glow'] },
  music: { label: 'Music & Entertainment', icon: '🎵', keywords: ['music', 'artist', 'song', 'concert', 'dj', 'producer'] },
  business: { label: 'Business & Finance', icon: '💼', keywords: ['business', 'entrepreneur', 'invest', 'money', 'ceo', 'founder'] },
  art: { label: 'Art & Creative', icon: '🎨', keywords: ['art', 'artist', 'creative', 'design', 'photography', 'photo'] },
  lifestyle: { label: 'Lifestyle', icon: '🌿', keywords: ['lifestyle', 'life', 'daily', 'routine', 'wellness', 'mindful'] },
};

/* ─── Analyze followers to extract insights ───────────────────────────── */
const analyzeFollowers = (followers = [], posts = []) => {
  if (!followers.length) return null;

  // Sort by follower count (influencers)
  const topInfluencers = [...followers]
    .filter(f => f.followers > 1000)
    .sort((a, b) => (b.followers || 0) - (a.followers || 0))
    .slice(0, 10);

  // Most active (by posts count or engagement indicators)
  const mostActive = [...followers]
    .filter(f => f.posts > 50)
    .sort((a, b) => (b.posts || 0) - (a.posts || 0))
    .slice(0, 10);

  // Analyze interests from bios and usernames
  const interestCounts = {};
  Object.keys(INTEREST_CATEGORIES).forEach(k => interestCounts[k] = 0);

  followers.forEach(f => {
    const text = `${f.bio || ''} ${f.username || ''} ${f.fullName || ''}`.toLowerCase();
    Object.entries(INTEREST_CATEGORIES).forEach(([key, { keywords }]) => {
      if (keywords.some(kw => text.includes(kw))) {
        interestCounts[key]++;
      }
    });
  });

  const topInterests = Object.entries(interestCounts)
    .map(([key, count]) => ({ key, count, pct: (count / followers.length) * 100, ...INTEREST_CATEGORIES[key] }))
    .filter(i => i.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Engagement patterns from posts
  const postAnalysis = analyzePosts(posts);

  return {
    totalFollowers: followers.length,
    topInfluencers,
    mostActive,
    topInterests,
    postAnalysis,
    avgFollowerCount: followers.reduce((sum, f) => sum + (f.followers || 0), 0) / followers.length,
    verifiedCount: followers.filter(f => f.isVerified).length,
  };
};

/* ─── Analyze posts for patterns ──────────────────────────────────────── */
const analyzePosts = (posts = []) => {
  if (!posts.length) return null;

  // Best posting times
  const hourCounts = Array(24).fill(0);
  const dayCounts = Array(7).fill(0);
  const hashtagCounts = {};
  let totalLikes = 0;
  let totalComments = 0;

  posts.forEach(p => {
    const date = new Date(p.timestamp || p.takenAt);
    hourCounts[date.getHours()]++;
    dayCounts[date.getDay()]++;
    totalLikes += p.likesCount || 0;
    totalComments += p.commentsCount || 0;

    // Extract hashtags from caption
    const hashtags = (p.caption || '').match(/#\w+/g) || [];
    hashtags.forEach(tag => {
      hashtagCounts[tag.toLowerCase()] = (hashtagCounts[tag.toLowerCase()] || 0) + 1;
    });
  });

  const bestHour = hourCounts.indexOf(Math.max(...hourCounts));
  const bestDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayCounts.indexOf(Math.max(...dayCounts))];

  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // Content types
  const videoCount = posts.filter(p => p.type === 'Video' || p.isVideo).length;
  const carouselCount = posts.filter(p => p.type === 'Sidecar' || p.childrenCount > 1).length;
  const imageCount = posts.length - videoCount - carouselCount;

  return {
    totalPosts: posts.length,
    avgLikes: Math.round(totalLikes / posts.length),
    avgComments: Math.round(totalComments / posts.length),
    bestHour,
    bestDay,
    topHashtags,
    contentMix: { images: imageCount, videos: videoCount, carousels: carouselCount },
  };
};

/* ─── Generate content suggestions ────────────────────────────────────── */
const generateContentSuggestions = (insights, profile) => {
  if (!insights) return [];

  const suggestions = [];
  const { topInterests, postAnalysis, topInfluencers } = insights;

  // Interest-based suggestions
  if (topInterests?.length > 0) {
    const topInterest = topInterests[0];
    suggestions.push({
      type: 'interest',
      icon: '🎯',
      title: `${topInterest.icon} ${topInterest.label} Content`,
      description: `${topInterest.pct.toFixed(0)}% of your audience is interested in ${topInterest.label.toLowerCase()}. Create content that resonates with this niche.`,
      ideas: getContentIdeas(topInterest.key),
      priority: 'high',
    });
  }

  // Timing suggestions
  if (postAnalysis?.bestHour !== undefined) {
    const hourStr = postAnalysis.bestHour > 12 ? `${postAnalysis.bestHour - 12}PM` : `${postAnalysis.bestHour}AM`;
    suggestions.push({
      type: 'timing',
      icon: '⏰',
      title: 'Optimal Posting Time',
      description: `Your best engagement happens around ${hourStr} on ${postAnalysis.bestDay}s. Schedule your key posts during this window.`,
      ideas: [`Post your most important content at ${hourStr}`, `Use Stories during off-peak hours to maintain visibility`, `Test posting 30 mins earlier for even better reach`],
      priority: 'medium',
    });
  }

  // Influencer collaboration
  if (topInfluencers?.length > 0) {
    const avgInfluencerFollowers = topInfluencers.reduce((sum, i) => sum + i.followers, 0) / topInfluencers.length;
    suggestions.push({
      type: 'collab',
      icon: '🤝',
      title: 'Collaboration Opportunities',
      description: `${topInfluencers.length} influencers (avg ${fmt(avgInfluencerFollowers)} followers) follow you. Consider collaboration or shoutout exchanges.`,
      ideas: [`Reach out to @${topInfluencers[0]?.username} for a collab`, `Create duet/reaction content with influencer posts`, `Host a joint Live session`],
      priority: 'high',
    });
  }

  // Content format suggestions
  if (postAnalysis?.contentMix) {
    const { images, videos, carousels } = postAnalysis.contentMix;
    const total = images + videos + carousels;
    if (videos / total < 0.2) {
      suggestions.push({
        type: 'format',
        icon: '🎬',
        title: 'Increase Video Content',
        description: `Only ${Math.round((videos / total) * 100)}% of your content is video. Reels get 2x more reach than static posts.`,
        ideas: ['Turn your top-performing image posts into Reels', 'Create behind-the-scenes video content', 'Try trending audio with your niche twist'],
        priority: 'high',
      });
    }
    if (carousels / total < 0.15) {
      suggestions.push({
        type: 'format',
        icon: '📚',
        title: 'Try More Carousels',
        description: `Carousels have higher save rates and longer view times. Great for educational or story-driven content.`,
        ideas: ['Create "5 tips" educational carousels', 'Share before/after transformations', 'Tell a story across multiple slides'],
        priority: 'medium',
      });
    }
  }

  // Hashtag suggestions
  if (postAnalysis?.topHashtags?.length > 0) {
    suggestions.push({
      type: 'hashtags',
      icon: '#️⃣',
      title: 'Hashtag Strategy',
      description: `Your top performing hashtags: ${postAnalysis.topHashtags.slice(0, 3).map(h => h.tag).join(', ')}. Mix with trending and niche tags.`,
      ideas: ['Use 20-30 hashtags mixing popular and niche', 'Create a branded hashtag for your community', 'Research competitor hashtags weekly'],
      priority: 'low',
    });
  }

  return suggestions;
};

const getContentIdeas = (interestKey) => {
  const ideas = {
    fitness: ['Share your workout routine with tips', 'Post transformation stories', 'Create quick exercise tutorials'],
    fashion: ['Style guide carousels', 'Outfit of the day reels', 'Fashion haul reviews'],
    food: ['Recipe tutorials with step-by-step', 'Restaurant reviews and recommendations', 'Cooking tips and hacks'],
    travel: ['Destination guides with hidden gems', 'Travel packing tips', 'Day-in-my-life travel vlogs'],
    tech: ['Product reviews and comparisons', 'Tech tips and tutorials', 'Industry news commentary'],
    beauty: ['Makeup tutorials and routines', 'Product reviews and swatches', 'Skincare journey updates'],
    music: ['Behind the scenes content', 'Cover songs or originals', 'Music production tips'],
    business: ['Business tips and lessons learned', 'Day in the life as entrepreneur', 'Industry insights and trends'],
    art: ['Process videos and time-lapses', 'Tutorial content', 'Showcase finished pieces'],
    lifestyle: ['Daily routine content', 'Life updates and vlogs', 'Wellness and self-care tips'],
  };
  return ideas[interestKey] || ['Create authentic, relatable content', 'Share your unique perspective', 'Engage with your community'];
};

/* ─── Content Suggestion Card ─────────────────────────────────────────── */
const SuggestionCard = ({ suggestion, onCopy }) => {
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const priorityColors = {
    high: 'bg-rose-500/10 text-rose-600 border-rose-200',
    medium: 'bg-amber-500/10 text-amber-600 border-amber-200',
    low: 'bg-blue-500/10 text-blue-600 border-blue-200',
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{suggestion.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-bold text-foreground">{suggestion.title}</h4>
              <Badge className={cn("text-[10px]", priorityColors[suggestion.priority])}>
                {suggestion.priority}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{suggestion.description}</p>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content Ideas:</p>
              {suggestion.ideas.map((idea, idx) => (
                <div key={idx} className="flex items-center gap-2 group/idea">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-sm text-foreground flex-1">{idea}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover/idea:opacity-100 transition-opacity"
                    onClick={() => handleCopy(idea, idx)}
                  >
                    {copied === idx ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Top User Card ───────────────────────────────────────────────────── */
const UserCard = ({ user, rank, type }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
    <div className="relative">
      <Avatar className="w-10 h-10 border border-border">
        <AvatarImage src={proxyImg(user.profilePicUrl)} />
        <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-xs">
          {(user.username || '?').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {rank <= 3 && (
        <div className={cn(
          "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
          rank === 1 ? "bg-amber-400 text-amber-900" : rank === 2 ? "bg-slate-300 text-slate-700" : "bg-amber-600 text-white"
        )}>
          {rank}
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-sm text-foreground truncate">@{user.username}</p>
      <p className="text-xs text-muted-foreground">
        {type === 'influencer' ? `${fmt(user.followers)} followers` : `${fmt(user.posts)} posts`}
      </p>
    </div>
    {user.isVerified && (
      <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-600">✓</Badge>
    )}
  </div>
);

/* ─── Interest Bar ────────────────────────────────────────────────────── */
const InterestBar = ({ interest, maxPct }) => (
  <div className="flex items-center gap-3">
    <div className="w-8 text-center text-lg">{interest.icon}</div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-foreground">{interest.label}</span>
        <span className="text-xs text-muted-foreground">{interest.pct.toFixed(1)}%</span>
      </div>
      <Progress value={(interest.pct / maxPct) * 100} className="h-2" />
    </div>
  </div>
);

/* ─── Main Component ──────────────────────────────────────────────────── */
const AudienceInsights = ({ followers = [], posts = [], profile, onRefresh, isLoading }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const insights = useMemo(() => analyzeFollowers(followers, posts), [followers, posts]);
  const suggestions = useMemo(() => generateContentSuggestions(insights, profile), [insights, profile]);

  if (!followers.length) {
    return (
      <Card className="mb-6">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-bold text-foreground text-lg mb-2">Unlock Audience Insights</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Fetch followers data to discover your most active fans, top influencers, audience interests, and get AI-powered content suggestions.
          </p>
          <Button onClick={onRefresh} disabled={isLoading}>
            {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
            {isLoading ? 'Loading...' : 'Fetch Followers'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-lg">Audience Insights</h2>
            <p className="text-sm text-muted-foreground">Analyzing {fmt(insights?.totalFollowers)} followers</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="suggestions">AI Suggestions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <span className="text-sm font-medium text-muted-foreground">Top Influencers</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{insights?.topInfluencers?.length || 0}</p>
                <p className="text-xs text-muted-foreground">with 1K+ followers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-muted-foreground">Most Active</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{insights?.mostActive?.length || 0}</p>
                <p className="text-xs text-muted-foreground">power users (50+ posts)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Award className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-muted-foreground">Verified</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{insights?.verifiedCount || 0}</p>
                <p className="text-xs text-muted-foreground">verified accounts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart2 className="w-5 h-5 text-violet-500" />
                  <span className="text-sm font-medium text-muted-foreground">Avg Followers</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{fmt(insights?.avgFollowerCount || 0)}</p>
                <p className="text-xs text-muted-foreground">per follower</p>
              </CardContent>
            </Card>
          </div>

          {/* Interests Chart */}
          {insights?.topInterests?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Audience Interests
                </CardTitle>
                <CardDescription>What your followers are interested in based on their bios</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.topInterests.map((interest, idx) => (
                    <InterestBar key={interest.key} interest={interest} maxPct={insights.topInterests[0].pct} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Audience Tab */}
        <TabsContent value="audience" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Influencers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  Top Influencers Following You
                </CardTitle>
                <CardDescription>Your followers with the largest audiences</CardDescription>
              </CardHeader>
              <CardContent>
                {insights?.topInfluencers?.length > 0 ? (
                  <div className="space-y-2">
                    {insights.topInfluencers.slice(0, 5).map((user, idx) => (
                      <UserCard key={user.username} user={user} rank={idx + 1} type="influencer" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No influencers found (1K+ followers)</p>
                )}
              </CardContent>
            </Card>

            {/* Most Active */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-500" />
                  Most Active Followers
                </CardTitle>
                <CardDescription>Your most engaged community members</CardDescription>
              </CardHeader>
              <CardContent>
                {insights?.mostActive?.length > 0 ? (
                  <div className="space-y-2">
                    {insights.mostActive.slice(0, 5).map((user, idx) => (
                      <UserCard key={user.username} user={user} rank={idx + 1} type="active" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No power users found (50+ posts)</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Suggestions Tab */}
        <TabsContent value="suggestions" className="mt-6">
          <div className="space-y-4">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, idx) => (
                <SuggestionCard key={idx} suggestion={suggestion} />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Not enough data to generate suggestions. Fetch more followers and post data.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AudienceInsights;
