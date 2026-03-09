'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, POPULAR_CRYPTOS, POPULAR_FOREX, GOLD_TYPES, PRECIOUS_METALS } from '@/lib/types';
import { WealthSnapshot, saveAssetPriceSnapshot } from '@/lib/storage';
import { getAssets, getWealthHistory, saveWealthSnapshot, saveMultipleAssetPrices, migrateLocalDataToSupabase, updateAsset, deleteAsset } from '@/lib/db';
import { getAssetCostInTRY } from '@/lib/utils';
import GoalTracker from '@/components/GoalTracker';
import PortfolioHealthScore from '@/components/PortfolioHealthScore';
import AppSidebar, { ActiveView } from '@/components/AppSidebar';
import AssetForm from '@/components/AssetForm';
import EditAssetForm from '@/components/EditAssetForm';
import SellAssetForm from '@/components/SellAssetForm';
import AiAnalysis from '@/components/AiAnalysis';
import AiPortfolioChat from '@/components/AiPortfolioChat';
import PortfolioShareModal from '@/components/PortfolioShareModal';
import GlobalHeadlines from '@/components/GlobalHeadlines';
import NewsSection from '@/components/NewsSection';
import { useAuth } from '@/lib/AuthContext';
import { useTheme, useCurrency, useWidgetLayout } from '@/lib/contexts';
import AuthModal from '@/components/AuthModal';
import ResetModal from '@/components/ResetModal';
import { fetchAllPrices } from '@/lib/prices';

// Views
import DashboardView from '@/views/DashboardView';
import AssetsView from '@/views/AssetsView';
import ConverterView from '@/views/ConverterView';
import LandingPage from '@/views/LandingPage';
// Removed duplicate ResetModal import

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [sellingAsset, setSellingAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [history, setHistory] = useState<WealthSnapshot[]>([]);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [analyzingAsset, setAnalyzingAsset] = useState<Asset | null>(null);
  const [tickerOffset, setTickerOffset] = useState(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [heroPLPeriod, setHeroPLPeriod] = useState<'1d' | '1w' | '1m' | 'all'>('1d');

  const { user, displayName, loading: authLoading, login, register, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'assets' | 'goals' | 'news' | 'converter' | 'chat'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  // Auth Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const { convert, symbol, currency, setCurrency, exchangeRates } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const { isEditing, setIsEditing, resetLayout, updateWidget } = useWidgetLayout();

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        // Check for local migration first
        try {
          const localAssetsStr = localStorage.getItem('wealth_tracker_assets');
          if (localAssetsStr) {
            const parsed = JSON.parse(localAssetsStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (window.confirm('Eski cihazınızdaki veya tarayıcınızdaki verileri buluta aktarmak ister misiniz?')) {
                await migrateLocalDataToSupabase(user.id);
              } else {
                localStorage.removeItem('wealth_tracker_assets');
                localStorage.removeItem('wealth_tracker_history');
              }
            }
          }
        } catch (e) {
          console.error("Local migration error:", e);
          localStorage.removeItem('wealth_tracker_assets'); // Clean corrupt data
        }

        const loadedAssets = await getAssets(user.id);
        setAssets(loadedAssets);
        setHistory(await getWealthHistory(user.id));
      } catch (err) {
        console.error("Failed to load user data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // Heal assets that somehow lost their apiId
  useEffect(() => {
    if (!user || assets.length === 0) return;
    const API_CATEGORIES = new Set(['crypto', 'stock', 'forex', 'gold', 'precious_metals']);
    const needsHeal = assets.filter(a => API_CATEGORIES.has(a.category) && !a.apiId);
    if (needsHeal.length === 0) return;

    const healed: Asset[] = [];
    for (const a of needsHeal) {
      let apiId: string | undefined;
      const nameLower = a.name.toLowerCase();

      if (a.category === 'crypto') {
        const match = POPULAR_CRYPTOS.find(c => c.name.toLowerCase() === nameLower || c.symbol.toLowerCase() === nameLower);
        if (match) apiId = match.id;
      } else if (a.category === 'forex') {
        const match = POPULAR_FOREX.find(f => f.name.toLowerCase() === nameLower || f.id.toLowerCase() === nameLower);
        if (match) apiId = match.id;
      } else if (a.category === 'gold') {
        const match = GOLD_TYPES.find(g => g.name.toLowerCase() === nameLower);
        if (match) apiId = 'gold_gram';
      } else if (a.category === 'precious_metals') {
        const match = PRECIOUS_METALS.find(m => m.name.toLowerCase() === nameLower);
        if (match) apiId = match.id;
      }
      // Stocks can't be auto-healed easily (too many symbols); skip them

      if (apiId) {
        healed.push({ ...a, apiId });
      }
    }

    if (healed.length > 0) {
      // Update state and DB
      setAssets(prev => prev.map(a => {
        const fix = healed.find(h => h.id === a.id);
        return fix || a;
      }));
      healed.forEach(a => updateAsset(user.id, a));
      console.log(`[Heal] Fixed apiId for ${healed.length} assets`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.length, user]);

  const refreshPrices = useCallback(async () => {
    if (assets.length === 0 || !user) return;
    setPricesLoading(true);
    try {
      // 1. Fetch latest state from DB in case another device added an asset
      const dbAssets = await getAssets(user.id);
      
      // 2. Prepare API parameters for external price fetching
      const cryptoIds: string[] = [];
      const forexCurrencies: string[] = [];
      const stockSymbols: string[] = [];
      const metalIds: string[] = [];
      let hasGold = false;

      dbAssets.forEach(a => {
        if (!a.apiId) return;
        if (a.category === 'crypto') cryptoIds.push(a.apiId);
        else if (a.category === 'forex') forexCurrencies.push(a.apiId);
        else if (a.category === 'stock') stockSymbols.push(a.apiId);
        else if (a.category === 'gold') hasGold = true;
        else if (a.category === 'precious_metals') metalIds.push(a.apiId.replace('metal_', ''));
      });

      // 3. Fetch real prices from external networks (cache handles rate limits)
      const priceMap = await fetchAllPrices({
        cryptoIds: [...new Set(cryptoIds)],
        forexCurrencies: [...new Set(forexCurrencies)],
        stockSymbols: [...new Set(stockSymbols)],
        metalIds: [...new Set(metalIds)],
        hasGold,
      });

      // 4. Map new prices to our assets
      let hasUpdates = false;
      const updated = dbAssets.map(a => {
        // If it's a manual asset or has no apiId, trust the DB price
        if (!a.apiId || a.manualCurrentPrice) return a;
        
        let newPrice = priceMap[a.apiId];
        // special hack for gold
        if (a.category === 'gold' && priceMap['gold_gram']) newPrice = priceMap['gold_gram'];
        
        if (newPrice && typeof newPrice === 'number' && newPrice !== a.currentPrice) {
          hasUpdates = true;
          return { ...a, currentPrice: newPrice };
        }
        return a;
      });

      // 5. Save the updated live prices back to DB so history tracks correctly
      if (hasUpdates) {
        await saveMultipleAssetPrices(user.id, updated);
      }
      
      // 6. Save historical snapshot and update UI state
      await saveWealthSnapshot(user.id, updated);
      saveAssetPriceSnapshot(updated); 
      setHistory(await getWealthHistory(user.id));
      setAssets(updated);
      setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    } catch (err) { 
      console.error('Fiyat güncelleme hatası:', err); 
    }
    finally { setPricesLoading(false); }
  }, [assets.length, user]);

  useEffect(() => {
    if (assets.length === 0) return;
    refreshPrices();
    const interval = setInterval(refreshPrices, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.length]);

  // 1-second live ticker micro-fluctuations (disabled in finans/minimal themes)
  useEffect(() => {
    if (assets.length === 0) return;
    if (theme === 'light') {
      setTickerOffset(0);
      return;
    }
    tickerRef.current = setInterval(() => {
      setTickerOffset((Math.random() - 0.5) * 0.0004); // ±0.02%
    }, 1000);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [assets.length, theme]);

  const getPrice = (a: Asset) => a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
  const totalWealthBase = assets.reduce((s, a) => s + a.amount * getPrice(a), 0);
  const totalWealth = totalWealthBase * (1 + tickerOffset);

  // Cost calculation: convert purchase prices to TRY if they were entered in another currency
  const totalCost = assets.reduce((sum, a) => sum + getAssetCostInTRY(a.amount, a.purchasePrice, a.purchaseCurrency, exchangeRates), 0);

  const totalPL = totalWealth - totalCost;
  const totalPLPct = totalCost > 0 ? ((totalWealth - totalCost) / totalCost) * 100 : 0;

  // Calculate daily and weekly P/L based on history
  const todayDate = new Date().toISOString().split('T')[0];
  const lastWeekDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  let yesterdayTotal = totalWealth;
  let lastWeekTotal = totalWealth;

  if (history.length > 0) {
    const pastHistory = history.filter(h => h.date < todayDate);
    yesterdayTotal = pastHistory.length > 0 ? pastHistory[pastHistory.length - 1].total : history[0].total;

    const lastWeekHistory = history.filter(h => h.date <= lastWeekDate);
    lastWeekTotal = lastWeekHistory.length > 0 ? lastWeekHistory[lastWeekHistory.length - 1].total : history[0].total;
  }

  const dailyPL = totalWealth - yesterdayTotal;
  const dailyPLPct = yesterdayTotal > 0 ? (dailyPL / yesterdayTotal) * 100 : 0;

  const weeklyPL = totalWealth - lastWeekTotal;
  const weeklyPLPct = lastWeekTotal > 0 ? (weeklyPL / lastWeekTotal) * 100 : 0;

  // Monthly P/L
  const lastMonthDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  let lastMonthTotal = totalWealth;
  if (history.length > 0) {
    const monthHistory = history.filter(h => h.date <= lastMonthDate);
    lastMonthTotal = monthHistory.length > 0 ? monthHistory[monthHistory.length - 1].total : history[0].total;
  }
  const monthlyPL = totalWealth - lastMonthTotal;
  const monthlyPLPct = lastMonthTotal > 0 ? (monthlyPL / lastMonthTotal) * 100 : 0;

  // Hero P/L values based on selected period
  const heroPLValues = {
    '1d': { pl: dailyPL, pct: dailyPLPct, label: 'Günlük Kar/Zarar' },
    '1w': { pl: weeklyPL, pct: weeklyPLPct, label: 'Haftalık Kar/Zarar' },
    '1m': { pl: monthlyPL, pct: monthlyPLPct, label: 'Aylık Kar/Zarar' },
    'all': { pl: totalPL, pct: totalPLPct, label: 'Toplam Kar/Zarar' },
  };
  const activeHeroPL = heroPLValues[heroPLPeriod];

  const fmt = (v: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(convert(v));

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const handleAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !password.trim()) return;
      setLoginLoading(true);
      setLoginError('');
      try {
        if (isRegisterMode) {
          await register(username.trim(), password);
        } else {
          await login(username.trim(), password);
        }
      } catch (err: any) {
        setLoginError(err.message || 'Bir hata oluştu');
      } finally {
        setLoginLoading(false);
      }
    };

    return (
      <LandingPage
        username={username}
        password={password}
        setUsername={setUsername}
        setPassword={setPassword}
        isRegisterMode={isRegisterMode}
        setIsRegisterMode={setIsRegisterMode}
        loginLoading={loginLoading}
        loginError={loginError}
        onSubmit={handleAuth}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Portföy yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ambient-bg">
        <div className="ambient-blob blob-1" />
        <div className="ambient-blob blob-2" />
      </div>

      {/* ---- App Shell: Sidebar + Main ---- */}
      <div className="flex h-screen overflow-hidden relative z-10">

        {/* Mobile backdrop */}
        {isMobile && mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />
        )}

        {/* Left Sidebar */}
        <div style={isMobile ? {
          position: 'fixed', top: 0, left: 0, height: '100vh',
          transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 50,
          boxShadow: mobileSidebarOpen ? '4px 0 32px rgba(0,0,0,0.5)' : 'none',
        } : { flexShrink: 0 }}>
          <AppSidebar
            totalWealth={totalWealth}
            totalCost={totalCost}
            totalPL={totalPL}
            totalPLPct={totalPLPct}
            assetCount={assets.length}
            displayName={displayName}
            lastUpdated={lastUpdated}
            pricesLoading={pricesLoading}
            activeView={activeView}
            onViewChange={(v) => { setActiveView(v); if (isMobile) setMobileSidebarOpen(false); }}
            onRefresh={refreshPrices}
            onShare={() => setShowShare(true)}
            onSignOut={signOut}
            onReset={() => setShowResetModal(true)}
            onAddAsset={() => { setShowAddForm(true); if (isMobile) setMobileSidebarOpen(false); }}
            currency={currency}
            setCurrency={setCurrency}
            theme={theme}
            toggleTheme={toggleTheme}
            sidebarCollapsed={isMobile ? false : sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
          />
        </div>

        {/* Main scrollable content */}
        <main style={isMobile ? { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '76px 16px 90px', width: '100%' } : undefined}
          className={isMobile ? '' : 'flex-1 overflow-y-auto overflow-x-hidden p-8 max-w-full'}
        >

          {/* Mobile top bar */}
          {isMobile && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, height: 52, zIndex: 30,
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 12px',
              backdropFilter: 'blur(16px)',
            }}>
              {/* Hamburger */}
              <button
                onClick={() => setMobileSidebarOpen(v => !v)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 0, flexDirection: 'column', flexShrink: 0 }}
              >
                {[0,1,2].map(i => (
                  <span key={i} style={{ display: 'block', width: 16, height: 1.5, background: 'rgba(255,255,255,0.7)', borderRadius: 2, margin: '2px 0', transition: 'all 0.2s' }} />
                ))}
              </button>

              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/finoria-ai.png" alt="Finoria" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.3, background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Finoria</span>
              </div>

              {/* Quick add */}
              <button
                onClick={() => setShowAddForm(true)}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#fff', flexShrink: 0 }}
              >
                +
              </button>
            </div>
          )}

          {/* Mobile bottom nav */}
          {isMobile && (
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
              background: 'var(--bg-elevated)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', height: 60,
              backdropFilter: 'blur(16px)',
            }}>
              {[
                { id: 'dashboard' as const, icon: '◈', label: 'Özet' },
                { id: 'assets' as const, icon: '⬡', label: 'Varlıklar' },
                { id: 'converter' as const, icon: '⇌', label: 'Çevirici' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    border: 'none', cursor: 'pointer', background: 'transparent',
                    color: activeView === item.id ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                    transition: 'color 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{item.label}</span>
                  {activeView === item.id && (
                    <span style={{ position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: '50%', background: '#a78bfa' }} />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── DASHBOARD VIEW ── */}
          {activeView === 'dashboard' && (
            assets.length === 0 ? (
              <div style={{
                position: 'relative', width: '100%', minHeight: 'calc(100vh - 120px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
              }}>
                {/* Background ambient light */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
                
                <div style={{
                  position: 'relative', maxWidth: 640, width: '100%',
                  background: 'rgba(20,23,29,0.5)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24,
                  padding: '48px 32px', textAlign: 'center',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
                }}>
                  <div style={{ width: 80, height: 80, margin: '0 auto 24px', borderRadius: '50%', padding: 4, background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))', border: '1px solid rgba(139,92,246,0.3)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/finoria-ai.png" alt="Finoria AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  </div>
                  
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 16 }}>Finoria'ya Hoş Geldin</div>
                  <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, color: '#fff', marginBottom: 16, lineHeight: 1.1 }}>
                    Servetini <span style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>inşa etmeye</span> başla
                  </h2>
                  <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 32px' }}>
                    Altın, kripto, hisse senedi ve döviz... Tüm yatırımlarını tek bir yerden, gerçek zamanlı olarak takip et.
                  </p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
                    {[
                      { icon: '⚡', title: 'Canlı Fiyat', desc: 'Sürekli güncel' },
                      { icon: '🤖', title: 'AI Analiz', desc: 'Akıllı içgörüler' },
                      { icon: '📊', title: 'P&L Takibi', desc: 'Tüm zamanlar' },
                    ].map(f => (
                      <div key={f.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '16px 12px' }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{f.title}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{f.desc}</div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowAddForm(true)}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 14,
                      color: '#fff', fontSize: 16, fontWeight: 800, padding: '16px 36px', cursor: 'pointer',
                      boxShadow: '0 8px 32px rgba(99,102,241,0.4)', transition: 'all 0.2s',
                    }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.6)'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.4)'; }}
                  >
                    ＋ İlk Varlığını Ekle
                  </button>
                </div>
              </div>
            ) : (
              <DashboardView
                  assets={assets}
                  totalWealth={totalWealth}
                  totalCost={totalCost}
                  history={history}
                  heroPLPeriod={heroPLPeriod}
                  setHeroPLPeriod={setHeroPLPeriod}
                  activeHeroPL={activeHeroPL}
              />
            )
          )}

          {/* ── ASSETS VIEW ── */}
          {activeView === 'assets' && (
            <AssetsView
                assets={assets}
                onDelete={(id) => setAssets(p => p.filter(a => a.id !== id))}
                onEdit={setEditingAsset}
                onSell={setSellingAsset}
                onAnalyze={setAnalyzingAsset}
            />
          )}

          {/* ── GOALS VIEW ── */}
          {activeView === 'goals' && (
            <div className="pb-10">
              <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-primary mb-1">Hedefler</h1>
                <p className="text-xs text-muted">Finansal hedeflerinizi takip edin</p>
              </div>
              <div className="max-w-2xl flex flex-col gap-4">
                <GoalTracker totalWealth={totalWealth} />
              </div>
            </div>
          )}

          {/* ── NEWS VIEW ── */}
          {activeView === 'news' && (
            <div className="pb-10">
              <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-primary mb-1">Gündem</h1>
                <p className="text-xs text-muted">Global finans haberleri</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlobalHeadlines />
                {assets.length > 0 && <NewsSection assets={assets} />}
              </div>
            </div>
          )}

          {/* ── CONVERTER VIEW ── */}
          {activeView === 'converter' && <ConverterView />}

        </main>
      </div>

      {/* ── Floating AI Chat (always visible) ── */}
      <AiPortfolioChat
        assets={assets}
        totalWealth={totalWealth}
        totalPL={totalPL}
        totalPLPct={totalPLPct}
        dailyPL={dailyPL}
        dailyPLPct={dailyPLPct}
        fmt={fmt}
      />

      {/* ── Modals ── */}
      {showAddForm && <AssetForm onClose={() => setShowAddForm(false)} onAdd={(a) => setAssets(p => [...p, a])} />}
      {editingAsset && <EditAssetForm asset={editingAsset} onClose={() => setEditingAsset(null)} onUpdate={(u) => setAssets(p => p.map(a => a.id === u.id ? u : a))} />}
      {sellingAsset && (
        <SellAssetForm
          asset={sellingAsset}
          onClose={() => setSellingAsset(null)}
          onSold={(id, updatedAsset) => {
            if (updatedAsset) {
              setAssets(p => p.map(a => a.id === id ? updatedAsset : a));
            } else {
              setAssets(p => p.filter(a => a.id !== id));
            }
          }}
        />
      )}
      {analyzingAsset && <AiAnalysis asset={analyzingAsset} onClose={() => setAnalyzingAsset(null)} />}
      {showResetModal && (
        <ResetModal
          onClose={() => setShowResetModal(false)}
          onReset={() => { setAssets([]); setHistory([]); }}
        />
      )}
      {showShare && (
        <PortfolioShareModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          assets={assets}
          totalWealth={totalWealth}
          totalPLPct={totalPLPct}
          totalCost={totalCost}
        />
      )}
    </>
  );
}