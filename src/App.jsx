import React, { useState } from 'react';
import {
  Activity,
  Search,
  ShieldCheck,
  UserX,
  BarChart2,
  Brain,
  ThumbsUp,
  ChevronDown,
  Check,
  X,
  Menu,
  ArrowRight,
  TrendingUp,
  Globe,
  MessageSquare,
  Heart,
  Hash,
  Download,
  Eye,
  Target,
  Users,
  Image as ImageIcon,
  Video,
  RefreshCw,
  AlertCircle,
  Award,
  MonitorPlay,
  UserCheck,
  PenTool
} from 'lucide-react';

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

const ActivityMint = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      alert(`Search initiated for: ${searchQuery}. Sign up to view the full report.`);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-emerald-200">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo onClick={() => setActiveTab('home')} />
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => setActiveTab('home')} className={`text-sm font-medium hover:text-emerald-600 transition-colors ${activeTab === 'home' ? 'text-emerald-600' : 'text-slate-600'}`}>Features</button>
              <button onClick={() => setActiveTab('pricing')} className={`text-sm font-medium hover:text-emerald-600 transition-colors ${activeTab === 'pricing' ? 'text-emerald-600' : 'text-slate-600'}`}>Pricing</button>
              <button className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">Blog</button>
              <button className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">Help Center</button>
              <button className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                Toolkit <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <button className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">Log In</button>
              <button className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full hover:shadow-lg hover:shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5">
                Sign Up
              </button>
              <div className="flex items-center gap-1 text-sm text-slate-500 cursor-pointer">
                <Globe className="w-4 h-4" /> EN
              </div>
            </div>
            <div className="md:hidden flex items-center">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-600">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
            <button onClick={() => { setActiveTab('home'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium text-slate-600 hover:text-emerald-600 py-2">Features</button>
            <button onClick={() => { setActiveTab('pricing'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium text-slate-600 hover:text-emerald-600 py-2">Pricing</button>
            <button className="block w-full text-left text-sm font-medium text-slate-600 hover:text-emerald-600 py-2">Blog</button>
            <div className="pt-2 border-t border-slate-100 flex gap-3">
              <button className="text-sm font-medium text-slate-600">Log In</button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full">Sign Up</button>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-16">
        {activeTab === 'home' && (
          <HomeView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
            isSearching={isSearching}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'pricing' && <PricingView />}
      </main>

      <footer className="bg-white border-t border-slate-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <Logo onClick={() => setActiveTab('home')} />
              <p className="mt-4 text-sm text-slate-500 leading-relaxed">
                Enhance your social insights with AI-powered, privacy-focused analytics. Track, analyze, and grow smarter.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Features</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('pricing'); }} className="hover:text-emerald-600 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Affiliate Program</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors">API Documentation</a></li>
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
            <div className="mt-4 md:mt-0"><span>Made for smart marketers 🍃</span></div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const HomeView = ({ searchQuery, setSearchQuery, handleSearch, isSearching, setActiveTab }) => (
  <div className="animate-in fade-in duration-500">
    <section className="relative pt-20 pb-32 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-emerald-100/40 rounded-full blur-3xl -z-10 opacity-50"></div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Your All-in-One <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">Social Activity Tracker</span>
        </h1>
        <p className="mt-4 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Uncover hidden insights with AI-powered, privacy-focused analytics for Instagram and beyond. Track, analyze, and grow smarter without leaving a footprint.
        </p>
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative flex items-center bg-white rounded-full border border-slate-200 shadow-sm p-2 hover:border-emerald-300 transition-colors">
            <div className="pl-4 pr-2 text-slate-400"><Search className="w-5 h-5" /></div>
            <input
              type="text"
              placeholder="Enter profile link or username"
              className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 py-3 text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={isSearching}
              className="ml-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3 rounded-full font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-70 flex items-center gap-2"
            >
              {isSearching ? 'Analyzing...' : 'Analyze Now'}
            </button>
          </div>
        </form>
        <div className="mt-12 flex items-center justify-center gap-4 text-sm text-slate-500 font-medium">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=e2e8f0`} alt="user" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>Trusted by <strong>50,000+</strong> professionals globally</span>
          </div>
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
              <UseCaseCard title="Stay on Top of Your Competition" description="Want to track your competitors' every move on Instagram? Monitor their follows, likes, and engagement. Stay one step ahead of your competition. Make smarter decisions and gain the competitive edge!" icon={<PenTool className="w-20 h-20 text-indigo-500 transform -rotate-12 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-indigo-200 to-purple-200" />
              <UseCaseCard title="Track Unusual Instagram Activity" description="Sudden spikes in followers or unusual following behavior can say a lot. Activity Mint brings public Instagram activity into focus—so you can better understand what's going on." icon={<AlertCircle className="w-20 h-20 text-rose-400 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-rose-200 to-pink-200" />
              <UseCaseCard title="Find the Perfect Influencer for Your Brand" description="Access real-time data on 10,000+ Instagram influencers. Track growth, analyze tags, and spot trends to connect with influencers who truly fit your brand." icon={<Award className="w-20 h-20 text-amber-400 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-amber-200 to-orange-200" />
            </div>
          </div>
          <div className="relative pt-12">
            <div className="absolute top-0 left-1/2 -translate-x-1/2">
              <span className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-full text-sm font-bold tracking-wide border border-emerald-100 shadow-sm">For Individuals</span>
            </div>
            <div className="space-y-6">
              <UseCaseCard title="Explore Instagram activity from public accounts" description="With Activity Mint, you can view public interactions, likes, followers, and recent follow activity — helping you stay informed while keeping your browsing private." icon={<UserCheck className="w-20 h-20 text-teal-500 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-teal-200 to-cyan-200" />
              <UseCaseCard title="Instagram Viewing Made Easy" description="Download Instagram Stories and Highlights discreetly with Activity Mint. Access public content smoothly, without connecting your own account." icon={<MonitorPlay className="w-20 h-20 text-slate-700 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-slate-200 to-gray-200" />
              <UseCaseCard title="Uncover Instagram Influencer Gossip" description="View public interactions between creators, celebs, or that one suspicious duo you've been watching. We won't tell if you won't." icon={<Eye className="w-20 h-20 text-yellow-500 drop-shadow-xl" strokeWidth={1.5} />} bgGradient="bg-gradient-to-br from-yellow-200 to-lime-200" />
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
          <FeatureCard icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />} title="Publicly Available Sources" description="We collect data exclusively from open, publicly available sources. Our methodology is 100% legal, ethical, and compliant." />
          <FeatureCard icon={<UserX className="w-6 h-6 text-emerald-600" />} title="100% Anonymous" description="No need to link your own account. Your identity is completely shielded, and tracked accounts will never know you're observing." />
          <FeatureCard icon={<BarChart2 className="w-6 h-6 text-emerald-600" />} title="Comprehensive Data" description="Access rich, continuous timelines of follows, likes, interest tags, and behavioral patterns mapped over time." />
          <FeatureCard icon={<Brain className="w-6 h-6 text-emerald-600" />} title="Deep AI Insights" description="Powered by advanced LLMs, we offer psychological archetyping, MBTI estimations, and relationship status analysis." />
          <FeatureCard icon={<Search className="w-6 h-6 text-emerald-600" />} title="Identify Suspects" description="Discover overlapping connections and suspected alt-accounts across major platforms automatically." />
          <FeatureCard icon={<ThumbsUp className="w-6 h-6 text-emerald-600" />} title="Extremely Easy to Use" description="Designed for simplicity. Just paste a username, click analyze, and receive a beautifully formatted PDF report." />
        </div>
      </div>
    </section>

    <section className="py-24 bg-slate-50/50 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900">The Complete Activity Toolkit</h2>
          <p className="mt-4 text-slate-500 max-w-2xl mx-auto">Everything you need to monitor, analyze, and archive social activity across platforms in one powerful suite.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <ToolkitCard title="View Privately" icon={<ShieldCheck className="w-6 h-6" />} description="View Stories, search profiles, and explore comments without leaving a trace." items={[{ icon: <Search className="w-5 h-5" />, text: "User search" }, { icon: <MessageSquare className="w-5 h-5" />, text: "View Comments Privately" }]} bgIcon="glasses" />
          <ToolkitCard title="Activity Analyzer" icon={<BarChart2 className="w-6 h-6" />} description="Analyze engagement patterns, network growth, and social interactions professionally." items={[{ icon: <Users className="w-5 h-5" />, text: "Follower Analyzer" }, { icon: <Activity className="w-5 h-5" />, text: "Activity Analyzer" }, { icon: <Heart className="w-5 h-5" />, text: "See Likes" }, { icon: <Hash className="w-5 h-5" />, text: "Hashtags Generator" }]} bgIcon="footprints" />
          <ToolkitCard title="Content Downloader" icon={<Download className="w-6 h-6" />} description="Archive Public Stories, Posts and Highlights Privately directly to your device." items={[{ icon: <ImageIcon className="w-5 h-5" />, text: "Stories Downloader" }, { icon: <ImageIcon className="w-5 h-5" />, text: "Highlights Downloader" }, { icon: <ImageIcon className="w-5 h-5" />, text: "Posts Downloader" }, { icon: <Video className="w-5 h-5" />, text: "Video Downloader" }]} bgIcon="cloud" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:w-2/3 mx-auto">
          <ToolkitCard title="Activity Viewer" icon={<Eye className="w-6 h-6" />} description="Quickly view any public account's stories, posts, and highlights anonymously." items={[{ icon: <ImageIcon className="w-5 h-5" />, text: "Post Viewer" }, { icon: <RefreshCw className="w-5 h-5" />, text: "Reposts Viewer" }, { icon: <ImageIcon className="w-5 h-5" />, text: "Stories Viewer" }, { icon: <ImageIcon className="w-5 h-5" />, text: "Highlights Viewer" }, { icon: <MessageSquare className="w-5 h-5" />, text: "Comment Viewer" }, { icon: <Heart className="w-5 h-5" />, text: "Likes Viewer" }]} bgIcon="eye" />
          <ToolkitCard title="Activity Monitor" icon={<Target className="w-6 h-6" />} description="Spot red flags like sudden follower spikes or unusual behavioral patterns." items={[{ icon: <Target className="w-5 h-5" />, text: "Relationship Insights" }, { icon: <Users className="w-5 h-5" />, text: "Recent Mutuals" }]} bgIcon="target" />
        </div>
      </div>
    </section>

    <section className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-900 opacity-20 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
          <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
            <div className="w-full md:w-1/2">
              <h2 className="text-3xl md:text-4xl font-bold mb-8">How to use Activity Mint</h2>
              <div className="hidden md:block space-y-8 relative">
                <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-white/20"></div>
                {[['Log in & Access', 'Create your private dashboard securely.'], ['Add Account', 'Enter the exact username you are curious about.'], ['Get Your Report', 'Wait for the detection engine to map the data and view insights.']].map(([title, desc], i) => (
                  <div key={i} className="relative flex items-start gap-6">
                    <div className="w-10 h-10 rounded-full bg-emerald-400 border-4 border-emerald-600 flex items-center justify-center shrink-0 z-10 shadow-lg">
                      <span className="font-bold text-sm">{i + 1}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">{title}</h3>
                      <p className="text-emerald-100/80 text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="md:hidden space-y-4">
                {[['Log in & Access', 'Create your private dashboard securely.'], ['Add Target Account', 'Enter the exact username you are curious about.'], ['Get Your Report', 'Wait for the detection engine to map the data.']].map(([title, desc], i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                    <h3 className="font-semibold mb-1">Step {i + 1}: {title}</h3>
                    <p className="text-emerald-100/80 text-sm">{desc}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setActiveTab('pricing')} className="mt-10 bg-white text-teal-700 px-6 py-3 rounded-full font-bold hover:bg-slate-50 transition-colors shadow-lg flex items-center gap-2">
                View Plans <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="w-full md:w-1/2 mt-8 md:mt-0 relative">
              <div className="bg-slate-50 rounded-2xl p-4 shadow-2xl border border-white/20">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-4">
                  <Logo />
                  <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                </div>
                <div className="space-y-4">
                  {[['purple', 'pink'], ['blue', 'cyan']].map(([c1, c2], i) => (
                    <div key={i} className="h-24 bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-r from-${c1}-400 to-${c2}-400`}></div>
                      <div>
                        <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
                        <div className="h-3 w-24 bg-slate-100 rounded"></div>
                      </div>
                      <div className="ml-auto"><TrendingUp className="text-emerald-500 w-5 h-5" /></div>
                    </div>
                  ))}
                </div>
                <div className="absolute -right-4 -bottom-4 bg-white p-3 rounded-xl shadow-xl border border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">New Follow Detected</p>
                    <p className="text-[10px] text-slate-500">Just now</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="py-24 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <h2 className="text-3xl font-bold text-slate-900">Recommended Article</h2>
          <a href="#" className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors flex items-center gap-1">More &gt;</a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <BlogCard image="https://images.unsplash.com/photo-1611262588024-d12430b98920?q=80&w=600&auto=format&fit=crop" title="Tracking Follower Growth: A Guide to Competitor Analysis" date="May 10, 2026" excerpt="Discover how to monitor your competitors' follower velocity and engagement metrics to stay one step ahead in your niche." />
          <BlogCard image="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?q=80&w=600&auto=format&fit=crop" title="The 2026 Guide to Viewing Instagram Stories Anonymously" date="Apr 28, 2026" excerpt="Learn the safest and most reliable methods to view and download Instagram Stories without leaving a digital footprint." />
          <BlogCard image="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=600&auto=format&fit=crop" title="Decoding AI Sentiment Analysis in Social Media" date="Apr 15, 2026" excerpt="Go beyond simple likes and comments. Learn how AI can analyze the emotional tone of your audience's interactions." />
          <BlogCard image="https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?q=80&w=600&auto=format&fit=crop" title="Spotting Fake Followers: Cleaning Up Influencer Marketing" date="Mar 30, 2026" excerpt="Don't waste your budget on bot accounts. Here is how to identify authentic influencers with genuine, highly-engaged audiences." />
        </div>
      </div>
    </section>

    <section className="py-20 bg-white pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 text-center px-6 py-20 shadow-2xl group">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] group-hover:bg-emerald-500/30 transition-colors duration-700"></div>
            <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-teal-400/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 group-hover:bg-teal-400/20 transition-colors duration-700"></div>
          </div>
          <div className="relative z-10 max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">Your Ultimate Social Activity Analyzer</h2>
            <p className="text-teal-50/80 leading-relaxed mb-10 text-base md:text-lg max-w-3xl mx-auto font-light">
              Activity Mint: Your trusted tool for social tracking. Safely and accurately monitor the activity of accounts you're interested in—without compromising privacy.
            </p>
            <button
              onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => document.querySelector('input[type="text"]')?.focus(), 300); }}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-4 px-10 rounded-full transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_0_60px_-10px_rgba(16,185,129,0.7)] hover:-translate-y-1"
            >
              ADD ACCOUNT
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
);

const PricingView = () => (
  <div className="animate-in fade-in duration-500 py-20 bg-slate-50 min-h-screen">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">Our Subscription Plans</h1>
      <p className="text-slate-600 max-w-2xl mx-auto mb-16">
        Start tracking anyone you care about. Social media doesn't lie — Activity Mint reveals the truth.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-end">
        <PricingCard title="Monthly Subscription" price="$4.49" interval="/month" features={[{ name: "1 Trackable Account, with weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers", included: true }, { name: "AI-Powered Insights & Growth Analytics", included: false }, { name: "Historical Posts and Top Commenters", included: false }, { name: "Downloadable Activity Reports in CSV", included: false }]} />
        <div className="relative transform md:-translate-y-4">
          <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
            <span className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">Most Popular - Save 20%</span>
          </div>
          <PricingCard title="Quarterly Subscription" price="$3.66" interval="/month" subtext="$10.99 billed every 3 months" highlighted={true} features={[{ name: "1 Trackable Account, with weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers", included: true }, { name: "4 AI Insights Modules (MBTI, Relationship, etc.)", included: true, isNew: true }, { name: "Historical Posts and Top Commenters", included: true }, { name: "Downloadable Activity Reports in CSV", included: true }, { name: "Discover Suspicious Accounts on 5 Platforms", included: false }]} />
        </div>
        <PricingCard title="Annual Subscription" price="$2.75" interval="/month" subtext="$32.99 billed annually (Save 40%)" features={[{ name: "1 Trackable Account, with weekly reports", included: true }, { name: "Activity Report Email Alerts", included: true }, { name: "Recent follow/followers", included: true }, { name: "9 AI Insights Modules (Financial, Encounter Loc.)", included: true }, { name: "Historical Posts and Top Commenters", included: true }, { name: "Downloadable Activity Reports in CSV", included: true }, { name: "Discover Suspicious Accounts on 5 Platforms", included: true, isNew: true }, { name: "Visual Map of Visited Areas", included: true, isNew: true }]} />
      </div>
    </div>
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
      {features.map((feature, idx) => (
        <div key={idx} className="flex items-start gap-3">
          {feature.included ? <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> : <X className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
          <span className={`text-sm ${feature.included ? 'text-slate-700' : 'text-slate-400'}`}>
            {feature.name}
            {feature.isNew && <span className="ml-2 inline-block text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">New</span>}
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

export default ActivityMint;
