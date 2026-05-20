import React, { useState } from 'react';
import {
  Activity, Brain, TrendingUp, Target, BarChart2, Users, Heart,
  MessageSquare, Eye, Clock, Calendar, AlertCircle, ArrowRight,
  Lock, CheckCircle, Sparkles, Globe, Shield, Zap, Star,
  ChevronRight, Award,
} from 'lucide-react';

/* ─── Shared components ─────────────────────────────────────────────────── */
const PageHero = ({ icon, title, subtitle, gradient, children }) => (
  <section className={`${gradient} text-white pt-12 sm:pt-20 pb-16 sm:pb-24 relative overflow-hidden`}>
    <div className="absolute inset-0 opacity-10">
      <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
    </div>
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20 backdrop-blur-sm">
        {icon}
      </div>
      <h1 className="text-3xl sm:text-5xl font-bold mb-4 tracking-tight">{title}</h1>
      <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">{subtitle}</p>
      {children}
    </div>
  </section>
);

const FeatureRow = ({ icon, title, description, tag }) => (
  <div className="flex items-start gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow">
    <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">{icon}</div>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-bold text-slate-900">{title}</h3>
        {tag && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{tag}</span>}
      </div>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  </div>
);

const CTASection = ({ title, subtitle }) => (
  <section className="py-20 bg-gradient-to-br from-indigo-600 to-purple-700 text-white text-center">
    <div className="max-w-2xl mx-auto px-4">
      <h2 className="text-3xl font-bold mb-4">{title}</h2>
      <p className="text-indigo-100/80 mb-8">{subtitle}</p>
      <button className="bg-white text-indigo-700 font-bold px-8 py-3 rounded-full hover:shadow-xl hover:shadow-white/20 transition-all transform hover:-translate-y-0.5">
        Get Started Free <ArrowRight className="w-4 h-4 inline ml-1" />
      </button>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════════════
   1. ACTIVITY TRACKER PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export const ActivityTrackerPage = ({ setActiveTab, setAuthOpen }) => (
  <div className="animate-in fade-in duration-500">
    <PageHero
      icon={<Activity className="w-8 h-8 text-white" />}
      title="Activity Tracker"
      subtitle="Monitor Instagram activity in real-time — follows, likes, posts, and engagement patterns — 24/7 without leaving a trace."
      gradient="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700"
    >
      <button onClick={() => setAuthOpen?.(true)}
        className="bg-white text-emerald-700 font-bold px-8 py-3 rounded-full hover:shadow-xl transition-all transform hover:-translate-y-0.5">
        Start Tracking Free <ArrowRight className="w-4 h-4 inline ml-1" />
      </button>
    </PageHero>

    {/* How it works */}
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">How Activity Tracking Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Add an Account', desc: 'Enter any public Instagram username. Our system starts collecting data within minutes.', icon: <Users className="w-6 h-6 text-emerald-600" /> },
            { step: '02', title: 'Continuous Monitoring', desc: 'We scan activity 24/7 — new follows, likes, post engagement, story uploads, and more.', icon: <Activity className="w-6 h-6 text-teal-600" /> },
            { step: '03', title: 'Get Smart Reports', desc: 'View weekly summaries with AI-powered insights, trend detection, and behavioral patterns.', icon: <BarChart2 className="w-6 h-6 text-cyan-600" /> },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                {item.icon}
              </div>
              <span className="text-xs font-black text-slate-300 tracking-widest">{item.step}</span>
              <h3 className="font-bold text-slate-900 mt-2 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Features */}
    <section className="py-20 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">What You Can Track</h2>
        <p className="text-slate-500 text-center mb-12 max-w-2xl mx-auto">Every public action is captured, analyzed, and turned into actionable intelligence.</p>
        <div className="space-y-4">
          <FeatureRow icon={<Heart className="w-5 h-5 text-rose-500" />} title="Like Activity" description="See which posts they like, who they engage with most, and detect patterns in their liking behavior." />
          <FeatureRow icon={<Users className="w-5 h-5 text-indigo-500" />} title="Follow/Unfollow Tracking" description="Real-time alerts when they follow or unfollow accounts. Detect mass follows, unfollows, and suspicious patterns." />
          <FeatureRow icon={<Eye className="w-5 h-5 text-purple-500" />} title="Story Activity" description="Track when stories are posted, how frequently, and what themes appear. Download stories before they expire." />
          <FeatureRow icon={<Calendar className="w-5 h-5 text-teal-500" />} title="Posting Schedule" description="Discover their posting rhythm — peak hours, frequency changes, and content type distribution." tag="Standard" />
          <FeatureRow icon={<AlertCircle className="w-5 h-5 text-amber-500" />} title="Anomaly Detection" description="AI flags unusual behavior — sudden follower spikes, mass unfollows, engagement drops, or content changes." tag="Premium" />
        </div>
      </div>
    </section>

    {/* Mock dashboard preview */}
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Your Dashboard Preview</h2>
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Likes This Week', value: '347', trend: '+12%', color: 'text-rose-600' },
              { label: 'New Follows', value: '23', trend: '+5%', color: 'text-indigo-600' },
              { label: 'Stories Posted', value: '18', trend: '-3%', color: 'text-purple-600' },
              { label: 'Engagement Rate', value: '4.2%', trend: '+0.8%', color: 'text-emerald-600' },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-emerald-600 mt-1">{stat.trend}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 relative overflow-hidden">
            <div className="h-40 bg-gradient-to-r from-emerald-100 via-teal-50 to-emerald-100 rounded-lg flex items-end justify-around px-4 pb-2">
              {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                <div key={i} className="w-8 bg-emerald-500 rounded-t-lg" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="flex justify-around text-xs text-slate-400 mt-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>

    <CTASection title="Start Tracking in 60 Seconds" subtitle="No Instagram login required. Add any public username and get real-time activity data." />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   2. AI SENTIMENT ANALYSIS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export const AISentimentPage = ({ setActiveTab, setAuthOpen }) => (
  <div className="animate-in fade-in duration-500">
    <PageHero
      icon={<Brain className="w-8 h-8 text-white" />}
      title="AI Sentiment Analysis"
      subtitle="Powered by advanced language models — decode personality, emotions, interests, and behavioral patterns from public Instagram data."
      gradient="bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700"
    >
      <button onClick={() => setAuthOpen?.(true)}
        className="bg-white text-purple-700 font-bold px-8 py-3 rounded-full hover:shadow-xl transition-all transform hover:-translate-y-0.5">
        Try AI Insights Free <ArrowRight className="w-4 h-4 inline ml-1" />
      </button>
    </PageHero>

    {/* AI Modules showcase */}
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">9 AI-Powered Insight Modules</h2>
        <p className="text-slate-500 text-center mb-12 max-w-2xl mx-auto">Each module uses different signals from public Instagram data to generate deep behavioral insights.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'MBTI Personality', desc: 'Estimates Myers-Briggs type from posting patterns, content themes, and engagement style.', icon: <Brain className="w-5 h-5 text-purple-500" />, tier: 'Standard' },
            { title: 'Emotional Tone', desc: 'Analyzes dominant emotional themes across captions, comments, and story content.', icon: <Heart className="w-5 h-5 text-rose-500" />, tier: 'Standard' },
            { title: 'Interest Archetype', desc: 'Maps primary content categories and interest clusters into behavioral archetypes.', icon: <Target className="w-5 h-5 text-indigo-500" />, tier: 'Standard' },
            { title: 'Relationship Indicators', desc: 'Detects close connections, interaction patterns, and relationship dynamics.', icon: <Users className="w-5 h-5 text-amber-500" />, tier: 'Standard' },
            { title: 'Engagement Patterns', desc: 'When and how this account interacts — timing, frequency, and response rates.', icon: <Activity className="w-5 h-5 text-emerald-500" />, tier: 'Premium' },
            { title: 'Growth Trajectory', desc: 'Predicted follower growth based on current engagement velocity and content quality.', icon: <TrendingUp className="w-5 h-5 text-teal-500" />, tier: 'Premium' },
            { title: 'Financial Behavior', desc: 'Spending indicators, lifestyle markers, and brand affinity patterns.', icon: <Sparkles className="w-5 h-5 text-yellow-500" />, tier: 'Premium' },
            { title: 'Location Patterns', desc: 'Estimated frequent locations based on geotagged content and venue mentions.', icon: <Globe className="w-5 h-5 text-cyan-500" />, tier: 'Premium' },
            { title: 'Discussion Topics', desc: 'Key themes and subjects this account engages with most in comments and captions.', icon: <MessageSquare className="w-5 h-5 text-slate-500" />, tier: 'Premium' },
          ].map((mod, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {mod.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{mod.title}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    mod.tier === 'Premium' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>{mod.tier}</span>
                </div>
              </div>
              <p className="text-sm text-slate-500">{mod.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* How AI Analysis Works */}
    <section className="py-20 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">How AI Analysis Works</h2>
        <div className="space-y-4">
          <FeatureRow icon={<Zap className="w-5 h-5 text-amber-500" />} title="Data Collection" description="We gather publicly available captions, comments, engagement signals, posting timestamps, and content tags." />
          <FeatureRow icon={<Brain className="w-5 h-5 text-purple-500" />} title="LLM Processing" description="Advanced language models analyze text sentiment, topic clusters, behavioral markers, and psychological signals." />
          <FeatureRow icon={<Shield className="w-5 h-5 text-emerald-500" />} title="Confidence Scoring" description="Every insight includes a confidence percentage so you know how reliable each prediction is." />
          <FeatureRow icon={<BarChart2 className="w-5 h-5 text-indigo-500" />} title="Report Generation" description="Results are compiled into a beautiful, downloadable report with visualizations and actionable takeaways." />
        </div>
      </div>
    </section>

    <CTASection title="Unlock AI-Powered Insights" subtitle="Go beyond surface-level analytics. Understand the psychology behind the activity." />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   3. FOLLOWER GROWTH PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export const FollowerGrowthPage = ({ setActiveTab, setAuthOpen }) => (
  <div className="animate-in fade-in duration-500">
    <PageHero
      icon={<TrendingUp className="w-8 h-8 text-white" />}
      title="Follower Growth Analytics"
      subtitle="Track follower trends over time — spot growth spikes, unfollower waves, and organic vs. inorganic patterns."
      gradient="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700"
    >
      <button onClick={() => setAuthOpen?.(true)}
        className="bg-white text-indigo-700 font-bold px-8 py-3 rounded-full hover:shadow-xl transition-all transform hover:-translate-y-0.5">
        Track Growth Free <ArrowRight className="w-4 h-4 inline ml-1" />
      </button>
    </PageHero>

    {/* Growth features */}
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Comprehensive Growth Intelligence</h2>
        <p className="text-slate-500 text-center mb-12 max-w-2xl mx-auto">Every follower gained or lost is tracked, timestamped, and analyzed.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { title: 'Daily Growth Chart', desc: 'Visualize follower count changes day by day. Spot trends before they become obvious.', icon: <BarChart2 className="w-6 h-6 text-blue-500" /> },
            { title: 'Unfollower Detection', desc: 'Know exactly who unfollowed and when. Track patterns in unfollower behavior.', icon: <Users className="w-6 h-6 text-rose-500" /> },
            { title: 'Growth Rate Analysis', desc: 'Compare weekly and monthly growth rates. Benchmark against industry averages.', icon: <TrendingUp className="w-6 h-6 text-emerald-500" /> },
            { title: 'Follower Quality Score', desc: 'AI evaluates new followers — real accounts vs. bots, active vs. inactive.', icon: <Award className="w-6 h-6 text-amber-500" /> },
            { title: 'Spike Detection', desc: 'Automatic alerts for unusual follower spikes or drops that need investigation.', icon: <AlertCircle className="w-6 h-6 text-purple-500" /> },
            { title: 'Growth Predictions', desc: 'ML-powered forecasts of where follower count is heading in 30/60/90 days.', icon: <Sparkles className="w-6 h-6 text-indigo-500" /> },
          ].map((feat, i) => (
            <div key={i} className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">{feat.icon}</div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">{feat.title}</h3>
                <p className="text-sm text-slate-500">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Mock growth chart */}
    <section className="py-20 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Growth Dashboard Preview</h2>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Follower Count — Last 30 Days</h3>
            <span className="text-sm text-emerald-600 font-semibold">+2.4% growth</span>
          </div>
          <div className="h-48 bg-gradient-to-t from-indigo-50 to-white rounded-lg relative overflow-hidden">
            <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
              <path d="M0,120 C30,115 60,110 90,100 C120,90 150,85 180,75 C210,65 240,70 270,55 C300,40 330,35 360,30 C380,25 400,20 400,20 L400,150 L0,150 Z"
                fill="url(#grad)" opacity="0.3" />
              <path d="M0,120 C30,115 60,110 90,100 C120,90 150,85 180,75 C210,65 240,70 270,55 C300,40 330,35 360,30 C380,25 400,20 400,20"
                fill="none" stroke="#6366f1" strokeWidth="2.5" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Current', value: '12.4K' },
              { label: '7d Change', value: '+284' },
              { label: 'Avg Daily', value: '+41' },
              { label: '30d Prediction', value: '13.6K' },
            ].map((s, i) => (
              <div key={i} className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-lg font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <CTASection title="Track Every Follower" subtitle="Start monitoring follower growth in real-time. No Instagram login needed." />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   4. COMPETITOR ANALYSIS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export const CompetitorAnalysisPage = ({ setActiveTab, setAuthOpen }) => (
  <div className="animate-in fade-in duration-500">
    <PageHero
      icon={<Target className="w-8 h-8 text-white" />}
      title="Competitor Analysis"
      subtitle="Compare performance across accounts — engagement benchmarks, content strategy insights, and audience overlap detection."
      gradient="bg-gradient-to-br from-orange-500 via-red-500 to-rose-600"
    >
      <button onClick={() => setAuthOpen?.(true)}
        className="bg-white text-rose-700 font-bold px-8 py-3 rounded-full hover:shadow-xl transition-all transform hover:-translate-y-0.5">
        Analyze Competitors <ArrowRight className="w-4 h-4 inline ml-1" />
      </button>
    </PageHero>

    {/* Comparison features */}
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Side-by-Side Intelligence</h2>
        <p className="text-slate-500 text-center mb-12 max-w-2xl mx-auto">Compare up to 5 accounts simultaneously. Understand what works for your competitors.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Engagement Benchmarks', desc: 'Compare engagement rates, likes per post, and comment ratios across competitors.', icon: <BarChart2 className="w-6 h-6 text-rose-500" /> },
            { title: 'Content Strategy', desc: 'Analyze posting frequency, content types, and caption styles that drive results.', icon: <Eye className="w-6 h-6 text-indigo-500" /> },
            { title: 'Audience Overlap', desc: 'Discover shared followers and identify opportunities to capture their audience.', icon: <Users className="w-6 h-6 text-purple-500" /> },
            { title: 'Growth Comparison', desc: 'Track follower growth rates side by side. See who is winning the race.', icon: <TrendingUp className="w-6 h-6 text-emerald-500" /> },
            { title: 'Hashtag Analysis', desc: 'Compare hashtag strategies and discover high-performing tags in your niche.', icon: <Star className="w-6 h-6 text-amber-500" /> },
            { title: 'AI Strengths & Weaknesses', desc: 'AI-generated SWOT analysis comparing your content against competitors.', icon: <Brain className="w-6 h-6 text-teal-500" /> },
          ].map((feat, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-rose-200 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-4 shadow-sm">{feat.icon}</div>
              <h3 className="font-bold text-slate-900 mb-2">{feat.title}</h3>
              <p className="text-sm text-slate-500">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Mock comparison table */}
    <section className="py-20 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Comparison Dashboard Preview</h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-4 gap-0 text-sm">
            <div className="bg-slate-50 p-4 font-bold text-slate-500">Metric</div>
            <div className="bg-slate-50 p-4 font-bold text-indigo-600 text-center">Your Account</div>
            <div className="bg-slate-50 p-4 font-bold text-rose-500 text-center">Competitor A</div>
            <div className="bg-slate-50 p-4 font-bold text-amber-600 text-center">Competitor B</div>
            {[
              ['Followers', '12.4K', '45.2K', '8.7K'],
              ['Engagement Rate', '4.2%', '2.8%', '5.1%'],
              ['Posts/Week', '5.3', '7.1', '3.2'],
              ['Avg Likes', '521', '1,265', '445'],
              ['Growth (30d)', '+2.4%', '+1.1%', '+3.8%'],
            ].map(([metric, ...vals], i) => (
              <React.Fragment key={i}>
                <div className="p-4 text-slate-600 font-medium border-t border-slate-100">{metric}</div>
                {vals.map((v, vi) => (
                  <div key={vi} className="p-4 text-center border-t border-slate-100 font-semibold text-slate-900">{v}</div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>

    <CTASection title="Know Your Competition" subtitle="Track competitors in real-time. Understand their strategy. Outperform them." />
  </div>
);
