'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, POPULAR_CRYPTOS, POPULAR_FOREX, GOLD_TYPES, PRECIOUS_METALS } from '@/lib/types';
import { WealthSnapshot, saveAssetPriceSnapshot } from '@/lib/storage';
import { getAssets, getWealthHistory, saveWealthSnapshot, saveMultipleAssetPrices, migrateLocalDataToSupabase, updateAsset, deleteAsset } from '@/lib/db';
import { getAssetCostInTRY } from '@/lib/utils';
import GoalTracker from '@/components/GoalTracker';
import ProfileView from '@/components/ProfileView';
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
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #060912 0%, #0a0f1e 50%, #0d1117 100%)',
        flexDirection: 'column', gap: 0,
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />

        {/* Logo ring */}
        <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 32 }}>
          {/* Spinning outer ring */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: '#6366f1', borderRightColor: 'rgba(99,102,241,0.3)',
            animation: 'loaderSpin 1.2s linear infinite',
          }} />
          {/* Inner ring */}
          <div style={{
            position: 'absolute', inset: 8, borderRadius: '50%',
            border: '1.5px solid rgba(139,92,246,0.2)',
            borderBottomColor: '#8b5cf6',
            animation: 'loaderSpin 1.8s linear infinite reverse',
          }} />
          {/* Logo center */}
          <div style={{
            position: 'absolute', inset: 16, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(99,102,241,0.5)',
            animation: 'logoPulse 2s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 26 }}>💎</span>
          </div>
        </div>

        {/* Brand name */}
        <div style={{
          fontSize: 28, fontWeight: 900, letterSpacing: -0.8, color: '#fff',
          marginBottom: 8, fontFamily: "'Inter', sans-serif",
        }}>Finoria</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 36, letterSpacing: 0.3 }}>
          Portföy yükleniyor...
        </div>

        {/* Progress bar */}
        <div style={{
          width: 180, height: 3, background: 'rgba(255,255,255,0.07)',
          borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
            animation: 'loaderProgress 1.8s ease-in-out infinite',
          }} />
        </div>

        <style>{`
          @keyframes loaderSpin { to { transform: rotate(360deg); } }
          @keyframes logoPulse {
            0%, 100% { box-shadow: 0 0 24px rgba(99,102,241,0.5); }
            50% { box-shadow: 0 0 40px rgba(99,102,241,0.8), 0 0 60px rgba(139,92,246,0.3); }
          }
          @keyframes loaderProgress {
            0% { width: 0%; margin-left: 0; }
            50% { width: 70%; margin-left: 0; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
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
        <main style={isMobile ? { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 'calc(52px + env(safe-area-inset-top) + 16px) 16px calc(90px + env(safe-area-inset-bottom)) 16px', width: '100%' } : undefined}
          className={isMobile ? '' : 'flex-1 overflow-y-auto overflow-x-hidden p-8 max-w-full'}
        >

          {/* Mobile top bar - premium reference style */}
          {isMobile && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
              background: 'rgba(9,16,33,0.92)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              paddingTop: 'env(safe-area-inset-top)',
              paddingLeft: 20, paddingRight: 20, paddingBottom: 12,
              minHeight: 'calc(52px + env(safe-area-inset-top))',
              backdropFilter: 'blur(20px)',
            }}>
              {/* Logo + brand */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(139,92,246,0.5)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/finoria-ai.png" alt="Finoria" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4, color: '#fff' }}>Finoria</span>
              </div>

              {/* Right side: add + profile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none', borderRadius: 10, width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 18, color: '#fff', fontWeight: 300, flexShrink: 0,
                    boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  }}
                >+</button>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 14, color: '#fff', fontWeight: 700,
                  border: '2px solid rgba(139,92,246,0.4)',
                  boxShadow: '0 0 12px rgba(139,92,246,0.3)',
                }}>
                  {displayName ? displayName.charAt(0).toUpperCase() : '👤'}
                </div>
              </div>
            </div>
          )}

          {/* Mobile bottom nav - premium style */}
          {isMobile && (
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
              background: 'rgba(9,16,33,0.95)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              paddingBottom: 'env(safe-area-inset-bottom)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
            }}>
              {([
                {
                  id: 'dashboard' as const, label: 'Anasayfa',
                  icon: (active: boolean) => (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
                        fill={active ? '#8b5cf6' : 'none'} stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                  )
                },
                {
                  id: 'assets' as const, label: 'Portföy',
                  icon: (active: boolean) => (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" />
                      <path d="M12 12L12 7M12 12L16 14" stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="1.5" fill={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} />
                    </svg>
                  )
                },
                {
                  id: 'chat' as const, label: 'Asistan',
                  icon: (active: boolean) => (
                    <div style={{ position: 'relative', marginTop: -24 }}>
                      {/* Outer pulsing ring */}
                      <div style={{
                        position: 'absolute', inset: -5, borderRadius: '50%',
                        border: `2px solid ${active ? 'rgba(139,92,246,0.9)' : 'rgba(99,102,241,0.5)'}`,
                        animation: 'mascotRingGlow 2s ease-in-out infinite',
                        boxShadow: active ? '0 0 16px rgba(139,92,246,0.6)' : 'none',
                      }} />
                      {/* Mascot button */}
                      <div style={{
                        width: 58, height: 58, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4338ca, #7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: active
                          ? '0 0 0 3px #080d1a, 0 0 32px rgba(139,92,246,1), 0 0 64px rgba(99,102,241,0.4)'
                          : '0 0 0 3px #080d1a, 0 8px 28px rgba(99,102,241,0.7)',
                        overflow: 'hidden',
                        border: '2px solid rgba(255,255,255,0.18)',
                        transition: 'box-shadow 0.3s ease',
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/finoria-ai.png"
                          alt="Finoria AI"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          draggable={false}
                        />
                      </div>
                      <style>{`
                        @keyframes mascotRingGlow {
                          0%, 100% { transform: scale(1); opacity: 0.5; }
                          50% { transform: scale(1.15); opacity: 1; }
                        }
                      `}</style>
                    </div>
                  )
                },

                {
                  id: 'news' as const, label: 'Haberler',
                  icon: (active: boolean) => (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="5" width="18" height="14" rx="2" stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8"/>
                      <line x1="7" y1="9" x2="17" y2="9" stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="7" y1="12" x2="14" y2="12" stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="7" y1="15" x2="11" y2="15" stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )
                },
                {
                  id: 'goals' as const, label: 'Profil',
                  icon: (active: boolean) => (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="3.5" stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" />
                      <path d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20" stroke={active ? '#8b5cf6' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  )
                },
              ] as const).map(item => {
                const isActive = activeView === item.id;
                const isCenter = item.id === 'chat';
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: isCenter ? 'flex-start' : 'center',
                      gap: isCenter ? 2 : 4,
                      border: 'none', cursor: 'pointer', background: 'transparent',
                      padding: isCenter ? '0 0 4px' : '10px 0 10px',
                      position: 'relative',
                    }}
                  >
                    {/* Active indicator */}
                    {isActive && !isCenter && (
                      <span style={{
                        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                        width: 20, height: 3, borderRadius: 3,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        boxShadow: '0 0 8px rgba(139,92,246,0.8)',
                      }} />
                    )}
                    {item.icon(isActive)}
                    {!isCenter && (
                      <span style={{
                        fontSize: 10, fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                        transition: 'color 0.15s', letterSpacing: 0.2,
                      }}>{item.label}</span>
                    )}
                  </button>
                );
              })}
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
                  isMobile={isMobile}
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
                isMobile={isMobile}
            />
          )}

          {/* ── PROFILE / GOALS VIEW ── */}
          {activeView === 'goals' && (
            <div className="pb-10">
              <ProfileView
                totalWealth={totalWealth}
                fmt={(n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}
                username={undefined}
              />
            </div>
          )}

          {/* ── NEWS VIEW ── */}
          {activeView === 'news' && (
            <div className="pb-10">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 4px', letterSpacing: -0.5 }}>Haberler</h1>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Portföyünüze özel haberler ve önemli gelişmeler</p>
              </div>
              <NewsSection assets={assets} />
            </div>
          )}

          {/* ── CONVERTER VIEW ── */}
          {activeView === 'converter' && <ConverterView />}

          {/* ── CHAT VIEW (mobile inline) ── */}
          {activeView === 'chat' && (
            <div style={{ minHeight: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ marginBottom: 8, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -0.8, margin: '0 0 2px' }}>Asistanım</h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Finoria AI · Her zaman yanında</p>
              </div>
              <AiPortfolioChat
                assets={assets}
                totalWealth={totalWealth}
                totalPL={totalPL}
                totalPLPct={totalPLPct}
                dailyPL={dailyPL}
                dailyPLPct={dailyPLPct}
                fmt={fmt}
                inline={true}
              />
            </div>
          )}

        </main>
      </div>

      {/* ── Floating AI Chat (desktop only – mobile uses the Asistan tab) ── */}
      {!isMobile && (
        <AiPortfolioChat
          assets={assets}
          totalWealth={totalWealth}
          totalPL={totalPL}
          totalPLPct={totalPLPct}
          dailyPL={dailyPL}
          dailyPLPct={dailyPLPct}
          fmt={fmt}
        />
      )}

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