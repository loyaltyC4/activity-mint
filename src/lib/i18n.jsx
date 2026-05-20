// Lightweight i18n — no deps, just a React context + JSON translations
import { createContext, useContext, useState, useCallback } from 'react';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

// Core UI strings — expand as needed
const translations = {
  en: {
    nav: { features: 'Features', pricing: 'Pricing', blog: 'Blog', helpCenter: 'Help Center', toolkit: 'Toolkit', affiliate: 'Affiliate', dashboard: 'Dashboard', logIn: 'Log In', signUp: 'Sign Up', signOut: 'Sign Out' },
    home: { hero: 'Your All-in-One', heroHighlight: 'Social Activity Tracker', heroSub: 'Uncover hidden insights with AI-powered, privacy-focused analytics for Instagram and beyond.', searchPlaceholder: 'Enter @username', analyzeBtn: 'Analyze Now', analyzing: 'Analyzing...', trusted: 'Trusted by 50,000+ professionals globally' },
    dashboard: { title: 'Social Insights', addAccount: 'ADD ACCOUNT', noAccounts: 'No accounts tracked yet', noAccountsSub: 'Enter an Instagram username above to start tracking.', inputPlaceholder: 'Enter profile link or @username', startTracking: 'Start Tracking', activityAnalytics: 'Activity Analytics', tiesTrails: 'Ties & Trails', storiesHighlights: 'Stories & Highlights', aiInsights: 'AI Insights', insights: 'Insights', toolkit: 'Toolkit', likesMade: 'Likes made', likedUsers: 'Liked users', newFollowings: 'New Followings', stories: 'Stories', weeklyReport: 'Weekly Report' },
    tiers: { free: 'Free', basic: 'Basic', standard: 'Standard', premium: 'Premium', upgrade: 'Upgrade to unlock', unlockFull: 'Unlock Full Analytics Report', createFree: 'Create Free Account' },
    tools: { storyViewer: 'Story Viewer', postViewer: 'Post Viewer', highlightsViewer: 'Highlights Viewer', linksViewer: 'Links Viewer', repostsViewer: 'Reposts Viewer', likeViewer: 'Like Viewer', unfollower: 'Unfollower Tracker', recentFollower: 'Recent Follower', followerExport: 'Follower Export', hashtagGen: 'Hashtag Generator', shadowbanCheck: 'Shadowban Checker', commentScraper: 'Comment Scraper' },
    analytics: { activityTracker: 'Activity Tracker', sentimentAnalysis: 'AI Sentiment Analysis', followerGrowth: 'Follower Growth', competitorAnalysis: 'Competitor Analysis' },
    common: { loading: 'Loading...', error: 'Something went wrong', retry: 'Try again', download: 'Download', export: 'Export', search: 'Search', close: 'Close', save: 'Save', cancel: 'Cancel', viewAll: 'View all', learnMore: 'Learn more', comingSoon: 'Coming soon', month: '/month', billedAnnually: 'billed annually' },
  },
  es: {
    nav: { features: 'Funciones', pricing: 'Precios', blog: 'Blog', helpCenter: 'Centro de Ayuda', toolkit: 'Herramientas', affiliate: 'Afiliados', dashboard: 'Panel', logIn: 'Iniciar sesión', signUp: 'Registrarse', signOut: 'Cerrar sesión' },
    home: { hero: 'Tu Rastreador de', heroHighlight: 'Actividad Social', heroSub: 'Descubre información oculta con análisis impulsado por IA y enfocado en la privacidad.', searchPlaceholder: 'Ingresa @usuario', analyzeBtn: 'Analizar ahora', analyzing: 'Analizando...', trusted: 'Más de 50,000 profesionales confían en nosotros' },
    dashboard: { title: 'Análisis Social', addAccount: 'AGREGAR CUENTA', noAccounts: 'Aún no hay cuentas rastreadas', noAccountsSub: 'Ingresa un usuario de Instagram arriba.', inputPlaceholder: 'Enlace de perfil o @usuario', startTracking: 'Iniciar Rastreo', activityAnalytics: 'Análisis de Actividad', tiesTrails: 'Conexiones', storiesHighlights: 'Historias y Destacados', aiInsights: 'IA Insights', insights: 'Insights', toolkit: 'Herramientas', likesMade: 'Likes dados', likedUsers: 'Usuarios con likes', newFollowings: 'Nuevos seguidos', stories: 'Historias', weeklyReport: 'Reporte Semanal' },
    tiers: { free: 'Gratis', basic: 'Básico', standard: 'Estándar', premium: 'Premium', upgrade: 'Mejora para desbloquear', unlockFull: 'Desbloquear Análisis Completo', createFree: 'Crear Cuenta Gratis' },
    tools: { storyViewer: 'Ver Historias', postViewer: 'Ver Posts', highlightsViewer: 'Ver Destacados', linksViewer: 'Ver Enlaces', repostsViewer: 'Ver Reposts', likeViewer: 'Ver Likes', unfollower: 'Rastreador de Unfollows', recentFollower: 'Seguidores Recientes', followerExport: 'Exportar Seguidores', hashtagGen: 'Generador de Hashtags', shadowbanCheck: 'Verificar Shadowban', commentScraper: 'Scraper de Comentarios' },
    analytics: { activityTracker: 'Rastreador de Actividad', sentimentAnalysis: 'Análisis de Sentimiento IA', followerGrowth: 'Crecimiento de Seguidores', competitorAnalysis: 'Análisis de Competencia' },
    common: { loading: 'Cargando...', error: 'Algo salió mal', retry: 'Intentar de nuevo', download: 'Descargar', export: 'Exportar', search: 'Buscar', close: 'Cerrar', save: 'Guardar', cancel: 'Cancelar', viewAll: 'Ver todo', learnMore: 'Saber más', comingSoon: 'Próximamente', month: '/mes', billedAnnually: 'facturado anualmente' },
  },
  pt: {
    nav: { features: 'Recursos', pricing: 'Preços', blog: 'Blog', helpCenter: 'Central de Ajuda', toolkit: 'Ferramentas', affiliate: 'Afiliados', dashboard: 'Painel', logIn: 'Entrar', signUp: 'Cadastrar', signOut: 'Sair' },
    home: { hero: 'Seu Rastreador de', heroHighlight: 'Atividade Social', heroSub: 'Descubra insights ocultos com análises impulsionadas por IA focadas em privacidade.', searchPlaceholder: 'Digite @usuário', analyzeBtn: 'Analisar agora', analyzing: 'Analisando...', trusted: 'Mais de 50.000 profissionais confiam em nós' },
    dashboard: { title: 'Análise Social', addAccount: 'ADICIONAR CONTA', noAccounts: 'Nenhuma conta rastreada', noAccountsSub: 'Digite um usuário do Instagram acima.', inputPlaceholder: 'Link do perfil ou @usuário', startTracking: 'Iniciar Rastreio', activityAnalytics: 'Análise de Atividade', tiesTrails: 'Conexões', storiesHighlights: 'Stories e Destaques', aiInsights: 'IA Insights', insights: 'Insights', toolkit: 'Ferramentas', likesMade: 'Likes dados', likedUsers: 'Usuários curtidos', newFollowings: 'Novos seguindo', stories: 'Stories', weeklyReport: 'Relatório Semanal' },
    tiers: { free: 'Grátis', basic: 'Básico', standard: 'Padrão', premium: 'Premium', upgrade: 'Atualize para desbloquear', unlockFull: 'Desbloquear Análise Completa', createFree: 'Criar Conta Grátis' },
    tools: { storyViewer: 'Visualizar Stories', postViewer: 'Visualizar Posts', highlightsViewer: 'Visualizar Destaques', linksViewer: 'Visualizar Links', repostsViewer: 'Visualizar Reposts', likeViewer: 'Visualizar Likes', unfollower: 'Rastreador de Unfollows', recentFollower: 'Seguidores Recentes', followerExport: 'Exportar Seguidores', hashtagGen: 'Gerador de Hashtags', shadowbanCheck: 'Verificar Shadowban', commentScraper: 'Scraper de Comentários' },
    analytics: { activityTracker: 'Rastreador de Atividade', sentimentAnalysis: 'Análise de Sentimento IA', followerGrowth: 'Crescimento de Seguidores', competitorAnalysis: 'Análise de Concorrência' },
    common: { loading: 'Carregando...', error: 'Algo deu errado', retry: 'Tentar novamente', download: 'Baixar', export: 'Exportar', search: 'Buscar', close: 'Fechar', save: 'Salvar', cancel: 'Cancelar', viewAll: 'Ver tudo', learnMore: 'Saiba mais', comingSoon: 'Em breve', month: '/mês', billedAnnually: 'cobrado anualmente' },
  },
  it: {
    nav: { features: 'Funzionalità', pricing: 'Prezzi', blog: 'Blog', helpCenter: 'Centro Assistenza', toolkit: 'Strumenti', affiliate: 'Affiliati', dashboard: 'Pannello', logIn: 'Accedi', signUp: 'Registrati', signOut: 'Esci' },
    home: { hero: 'Il Tuo Tracker di', heroHighlight: 'Attività Social', heroSub: 'Scopri insight nascosti con analisi basate su IA e focalizzate sulla privacy.', searchPlaceholder: 'Inserisci @utente', analyzeBtn: 'Analizza ora', analyzing: 'Analisi in corso...', trusted: 'Oltre 50.000 professionisti si fidano di noi' },
    dashboard: { title: 'Analisi Social', addAccount: 'AGGIUNGI ACCOUNT', noAccounts: 'Nessun account tracciato', noAccountsSub: 'Inserisci un utente Instagram sopra.', inputPlaceholder: 'Link profilo o @utente', startTracking: 'Inizia Tracking', activityAnalytics: 'Analisi Attività', tiesTrails: 'Connessioni', storiesHighlights: 'Storie e Highlights', aiInsights: 'IA Insights', insights: 'Insights', toolkit: 'Strumenti', likesMade: 'Like dati', likedUsers: 'Utenti con like', newFollowings: 'Nuovi seguiti', stories: 'Storie', weeklyReport: 'Report Settimanale' },
    tiers: { free: 'Gratuito', basic: 'Base', standard: 'Standard', premium: 'Premium', upgrade: 'Aggiorna per sbloccare', unlockFull: 'Sblocca Analisi Completa', createFree: 'Crea Account Gratuito' },
    tools: { storyViewer: 'Visualizza Storie', postViewer: 'Visualizza Post', highlightsViewer: 'Visualizza Highlights', linksViewer: 'Visualizza Link', repostsViewer: 'Visualizza Repost', likeViewer: 'Visualizza Like', unfollower: 'Tracker Unfollow', recentFollower: 'Follower Recenti', followerExport: 'Esporta Follower', hashtagGen: 'Generatore Hashtag', shadowbanCheck: 'Verifica Shadowban', commentScraper: 'Scraper Commenti' },
    analytics: { activityTracker: 'Tracker Attività', sentimentAnalysis: 'Analisi Sentimento IA', followerGrowth: 'Crescita Follower', competitorAnalysis: 'Analisi Concorrenza' },
    common: { loading: 'Caricamento...', error: 'Qualcosa è andato storto', retry: 'Riprova', download: 'Scarica', export: 'Esporta', search: 'Cerca', close: 'Chiudi', save: 'Salva', cancel: 'Annulla', viewAll: 'Vedi tutto', learnMore: 'Scopri di più', comingSoon: 'Prossimamente', month: '/mese', billedAnnually: 'fatturato annualmente' },
  },
  nl: {
    nav: { features: 'Functies', pricing: 'Prijzen', blog: 'Blog', helpCenter: 'Helpcentrum', toolkit: 'Toolkit', affiliate: 'Affiliate', dashboard: 'Dashboard', logIn: 'Inloggen', signUp: 'Aanmelden', signOut: 'Uitloggen' },
    home: { hero: 'Jouw Alles-in-Één', heroHighlight: 'Social Activity Tracker', heroSub: 'Ontdek verborgen inzichten met AI-gestuurde, privacygerichte analyses.', searchPlaceholder: 'Voer @gebruikersnaam in', analyzeBtn: 'Nu analyseren', analyzing: 'Analyseren...', trusted: 'Vertrouwd door 50.000+ professionals wereldwijd' },
    dashboard: { title: 'Social Insights', addAccount: 'ACCOUNT TOEVOEGEN', noAccounts: 'Nog geen accounts gevolgd', noAccountsSub: 'Voer hierboven een Instagram-gebruikersnaam in.', inputPlaceholder: 'Profiellink of @gebruikersnaam', startTracking: 'Start Tracking', activityAnalytics: 'Activiteitsanalyse', tiesTrails: 'Verbindingen', storiesHighlights: 'Verhalen & Highlights', aiInsights: 'AI Insights', insights: 'Inzichten', toolkit: 'Toolkit', likesMade: 'Likes gegeven', likedUsers: 'Gelikete gebruikers', newFollowings: 'Nieuwe volgend', stories: 'Verhalen', weeklyReport: 'Weekrapport' },
    tiers: { free: 'Gratis', basic: 'Basis', standard: 'Standaard', premium: 'Premium', upgrade: 'Upgrade om te ontgrendelen', unlockFull: 'Volledige Analyse Ontgrendelen', createFree: 'Gratis Account Maken' },
    tools: { storyViewer: 'Verhalen Bekijken', postViewer: 'Posts Bekijken', highlightsViewer: 'Highlights Bekijken', linksViewer: 'Links Bekijken', repostsViewer: 'Reposts Bekijken', likeViewer: 'Likes Bekijken', unfollower: 'Unfollow Tracker', recentFollower: 'Recente Volgers', followerExport: 'Volgers Exporteren', hashtagGen: 'Hashtag Generator', shadowbanCheck: 'Shadowban Check', commentScraper: 'Commentaar Scraper' },
    analytics: { activityTracker: 'Activiteit Tracker', sentimentAnalysis: 'AI Sentiment Analyse', followerGrowth: 'Volger Groei', competitorAnalysis: 'Concurrent Analyse' },
    common: { loading: 'Laden...', error: 'Er ging iets mis', retry: 'Opnieuw proberen', download: 'Downloaden', export: 'Exporteren', search: 'Zoeken', close: 'Sluiten', save: 'Opslaan', cancel: 'Annuleren', viewAll: 'Alles bekijken', learnMore: 'Meer leren', comingSoon: 'Binnenkort', month: '/maand', billedAnnually: 'jaarlijks gefactureerd' },
  },
  zh: {
    nav: { features: '功能', pricing: '价格', blog: '博客', helpCenter: '帮助中心', toolkit: '工具箱', affiliate: '联盟', dashboard: '控制面板', logIn: '登录', signUp: '注册', signOut: '退出' },
    home: { hero: '您的一站式', heroHighlight: '社交活动追踪器', heroSub: '通过AI驱动、注重隐私的分析发现隐藏洞察。', searchPlaceholder: '输入@用户名', analyzeBtn: '立即分析', analyzing: '分析中...', trusted: '全球超过50,000名专业人士信赖' },
    dashboard: { title: '社交洞察', addAccount: '添加账号', noAccounts: '尚未追踪任何账号', noAccountsSub: '在上方输入Instagram用户名开始追踪。', inputPlaceholder: '个人资料链接或@用户名', startTracking: '开始追踪', activityAnalytics: '活动分析', tiesTrails: '关系网络', storiesHighlights: '动态与精选', aiInsights: 'AI洞察', insights: '洞察', toolkit: '工具', likesMade: '点赞数', likedUsers: '点赞用户', newFollowings: '新关注', stories: '动态', weeklyReport: '周报' },
    tiers: { free: '免费', basic: '基础', standard: '标准', premium: '高级', upgrade: '升级解锁', unlockFull: '解锁完整分析报告', createFree: '创建免费账号' },
    tools: { storyViewer: '查看动态', postViewer: '查看帖子', highlightsViewer: '查看精选', linksViewer: '查看链接', repostsViewer: '查看转发', likeViewer: '查看点赞', unfollower: '取关追踪', recentFollower: '最近关注者', followerExport: '导出关注者', hashtagGen: '标签生成器', shadowbanCheck: '限流检测', commentScraper: '评论抓取' },
    analytics: { activityTracker: '活动追踪器', sentimentAnalysis: 'AI情感分析', followerGrowth: '粉丝增长', competitorAnalysis: '竞品分析' },
    common: { loading: '加载中...', error: '出错了', retry: '重试', download: '下载', export: '导出', search: '搜索', close: '关闭', save: '保存', cancel: '取消', viewAll: '查看全部', learnMore: '了解更多', comingSoon: '即将推出', month: '/月', billedAnnually: '按年计费' },
  },
  ja: {
    nav: { features: '機能', pricing: '料金', blog: 'ブログ', helpCenter: 'ヘルプセンター', toolkit: 'ツールキット', affiliate: 'アフィリエイト', dashboard: 'ダッシュボード', logIn: 'ログイン', signUp: '新規登録', signOut: 'ログアウト' },
    home: { hero: 'オールインワン', heroHighlight: 'ソーシャル活動トラッカー', heroSub: 'AI搭載のプライバシー重視分析で隠れたインサイトを発見。', searchPlaceholder: '@ユーザー名を入力', analyzeBtn: '今すぐ分析', analyzing: '分析中...', trusted: '世界50,000人以上のプロフェッショナルが信頼' },
    dashboard: { title: 'ソーシャルインサイト', addAccount: 'アカウント追加', noAccounts: 'まだ追跡中のアカウントはありません', noAccountsSub: '上にInstagramユーザー名を入力してください。', inputPlaceholder: 'プロフィールリンクまたは@ユーザー名', startTracking: 'トラッキング開始', activityAnalytics: 'アクティビティ分析', tiesTrails: 'つながり', storiesHighlights: 'ストーリーとハイライト', aiInsights: 'AIインサイト', insights: 'インサイト', toolkit: 'ツール', likesMade: 'いいね数', likedUsers: 'いいねしたユーザー', newFollowings: '新フォロー', stories: 'ストーリー', weeklyReport: '週間レポート' },
    tiers: { free: '無料', basic: 'ベーシック', standard: 'スタンダード', premium: 'プレミアム', upgrade: 'アップグレードして解除', unlockFull: '完全分析レポートを解除', createFree: '無料アカウント作成' },
    tools: { storyViewer: 'ストーリー閲覧', postViewer: '投稿閲覧', highlightsViewer: 'ハイライト閲覧', linksViewer: 'リンク閲覧', repostsViewer: 'リポスト閲覧', likeViewer: 'いいね閲覧', unfollower: 'フォロー解除トラッカー', recentFollower: '最近のフォロワー', followerExport: 'フォロワーエクスポート', hashtagGen: 'ハッシュタグ生成', shadowbanCheck: 'シャドウバンチェック', commentScraper: 'コメントスクレイパー' },
    analytics: { activityTracker: 'アクティビティトラッカー', sentimentAnalysis: 'AI感情分析', followerGrowth: 'フォロワー成長', competitorAnalysis: '競合分析' },
    common: { loading: '読み込み中...', error: 'エラーが発生しました', retry: '再試行', download: 'ダウンロード', export: 'エクスポート', search: '検索', close: '閉じる', save: '保存', cancel: 'キャンセル', viewAll: 'すべて見る', learnMore: '詳しく見る', comingSoon: '近日公開', month: '/月', billedAnnually: '年額請求' },
  },
};

// Helper: get nested key like "nav.features"
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('am_lang') || 'en'; } catch { return 'en'; }
  });

  const changeLang = useCallback((code) => {
    setLang(code);
    try { localStorage.setItem('am_lang', code); } catch {}
  }, []);

  // t('nav.features') -> translated string
  const t = useCallback((key) => {
    return getNestedValue(translations[lang], key) || getNestedValue(translations.en, key) || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t, languages: LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { LANGUAGES };
