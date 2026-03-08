'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, POPULAR_CRYPTOS, POPULAR_FOREX, GOLD_TYPES, PRECIOUS_METALS } from '@/lib/types';
import { WealthSnapshot, saveAssetPriceSnapshot } from '@/lib/storage';
import { getAssets, getWealthHistory, saveWealthSnapshot, saveMultipleAssetPrices, migrateLocalDataToSupabase, updateAsset, deleteAsset } from '@/lib/db';
import { fetchAllPrices } from '@/lib/prices';
import { getAssetCostInTRY } from '@/lib/utils';
import { useTheme, useCurrency, useWidgetLayout, useDesignTheme } from '@/lib/contexts';
import AssetForm from '@/components/AssetForm';
import EditAssetForm from '@/components/EditAssetForm';
import AssetCard from '@/components/AssetCard';
import AssetsTabsWidget from '@/components/AssetsTabsWidget';
import GlobalHeadlines from '@/components/GlobalHeadlines';
import WealthChart from '@/components/WealthChart';
import WealthHistoryChart from '@/components/WealthHistoryChart';
import MarketMovers from '@/components/MarketMovers';
import SellAssetForm from '@/components/SellAssetForm';
import AiAnalysis from '@/components/AiAnalysis';
import NewsSection from '@/components/NewsSection';
import WidgetWrapper from '@/components/WidgetWrapper';
import AnimatedNumber from '@/components/AnimatedNumber';
import AiPortfolioChat from '@/components/AiPortfolioChat';
import PortfolioShareModal from '@/components/PortfolioShareModal';
import HeroWealthCard from '@/components/HeroWealthCard';
import GoalTracker from '@/components/GoalTracker';
import PortfolioHealthScore from '@/components/PortfolioHealthScore';
import AppSidebar from '@/components/AppSidebar';
import UpcomingEvents from '@/components/UpcomingEvents';
import { useAuth } from '@/lib/AuthContext';
import AuthModal from '@/components/AuthModal';
import ResetModal from '@/components/ResetModal';

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
  const [heroPLPeriod, setHeroPLPeriod] = useState<'1d' | '1w' | '1m' | 'all'>('all');

  const { user, displayName, loading: authLoading, login, register, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'assets' | 'goals' | 'news' | 'converter' | 'chat'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  // Auth Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const { theme, toggleTheme } = useTheme();
  const { currency, setCurrency, convert, symbol, exchangeRates } = useCurrency();
  const { design, setDesign } = useDesignTheme();
  const { widgets, isEditing, setIsEditing, resetLayout, updateWidget } = useWidgetLayout();

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
    if (assets.length === 0) return;
    setPricesLoading(true);
    try {
      const cryptoIds = [...new Set(assets.filter((a) => a.category === 'crypto' && a.apiId).map((a) => a.apiId!))];
      const forexCurrencies = [...new Set(assets.filter((a) => a.category === 'forex' && a.apiId).map((a) => a.apiId!))];
      const stockSymbols = [...new Set(assets.filter((a) => a.category === 'stock' && a.apiId).map((a) => a.apiId!))];
      const metalIds = [...new Set(assets.filter((a) => a.category === 'precious_metals' && a.apiId).map((a) => a.apiId!.replace('metal_', '')))];
      const hasGold = assets.some((a) => a.category === 'gold' && a.apiId === 'gold_gram');
      const priceMap = await fetchAllPrices({ cryptoIds, forexCurrencies, stockSymbols, metalIds, hasGold });
      const updated = assets.map((a) =>
        a.apiId && priceMap[a.apiId] !== undefined
          ? { ...a, currentPrice: priceMap[a.apiId], updatedAt: new Date().toISOString() }
          : a
      );
      setAssets(updated);
      if (user) {
        await saveMultipleAssetPrices(user.id, updated);
        await saveWealthSnapshot(user.id, updated);
        saveAssetPriceSnapshot(updated); // Save per-asset price history for P/L periods
        setHistory(await getWealthHistory(user.id));
      }
      setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    } catch (err) { console.error('Fiyat güncelleme hatası:', err); }
    finally { setPricesLoading(false); }
  }, [assets]);

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
    if (design === 'finans' || design === 'minimal') {
      setTickerOffset(0);
      return;
    }
    tickerRef.current = setInterval(() => {
      setTickerOffset((Math.random() - 0.5) * 0.0004); // ±0.02%
    }, 1000);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [assets.length, design]);

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

  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);
  const hiddenWidgets = widgets.filter((w) => !w.visible);

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>💎</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
            <span className="gradient-text">Finoria</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Kişisel yatırım asistanınız. Kayıt olun veya giriş yapın.
          </p>

          <div style={{ maxWidth: 320, margin: '0 auto' }}>
            {/* Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
              <button
                onClick={() => setIsRegisterMode(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                  background: !isRegisterMode ? 'var(--bg-card)' : 'transparent',
                  color: !isRegisterMode ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: !isRegisterMode ? 700 : 500, fontSize: 14, cursor: 'pointer',
                  boxShadow: !isRegisterMode ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                Giriş Yap
              </button>
              <button
                onClick={() => setIsRegisterMode(true)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                  background: isRegisterMode ? 'var(--bg-card)' : 'transparent',
                  color: isRegisterMode ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: isRegisterMode ? 700 : 500, fontSize: 14, cursor: 'pointer',
                  boxShadow: isRegisterMode ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                Kayıt Ol
              </button>
            </div>

            <form onSubmit={handleAuth}>
              <input
                type="text"
                placeholder="Kullanıcı Adı"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '14px 18px', borderRadius: 14,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 15, textAlign: 'left',
                  outline: 'none', marginBottom: 12,
                }}
              />
              <input
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '14px 18px', borderRadius: 14,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 15, textAlign: 'left',
                  outline: 'none', marginBottom: 16,
                }}
              />

              {loginError && (
                <div style={{ background: 'rgba(255,77,106,0.1)', padding: 12, borderRadius: 10, marginBottom: 16, border: '1px solid rgba(255,77,106,0.2)' }}>
                  <p style={{ color: 'var(--accent-red)', fontSize: 13 }}>{loginError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!username.trim() || !password.trim() || loginLoading}
                className="btn-primary"
                style={{
                  width: '100%', fontSize: 15, padding: '16px',
                  borderRadius: 14, opacity: (username.trim() && password.trim()) && !loginLoading ? 1 : 0.5,
                }}
              >
                {loginLoading ? '⏳ İşleniyor...' : (isRegisterMode ? '✨ Kayıt Ol' : '🚀 Giriş Yap')}
              </button>
            </form>
          </div>
        </div>
      </div>
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
        <div className="ambient-blob blob-3" />
      </div>

      {/* ── App Shell: Sidebar + Main ── */}
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Left Sidebar */}
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
          onViewChange={setActiveView}
          onRefresh={refreshPrices}
          onShare={() => setShowShare(true)}
          onSignOut={signOut}
          onReset={() => setShowResetModal(true)}
          onAddAsset={() => setShowAddForm(true)}
          currency={currency}
          setCurrency={setCurrency}
          theme={theme}
          toggleTheme={toggleTheme}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
        />

        {/* Main scrollable content */}
        <main style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '32px 36px', maxWidth: '100%',
        }}>

          {/* ── DASHBOARD VIEW ── */}
          {activeView === 'dashboard' && (
            <>
              {assets.length > 0 && (
                <div style={{ marginBottom: 24, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <HeroWealthCard
                    assets={assets}
                    totalWealth={totalWealth}
                    totalCost={totalCost}
                    history={history}
                    heroPLPeriod={heroPLPeriod}
                    setHeroPLPeriod={setHeroPLPeriod}
                    activeHeroPL={activeHeroPL}
                    onShare={() => setShowShare(true)}
                  />
                </div>
              )}

              {assets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                  <div style={{ fontSize: 72, marginBottom: 20 }}>💎</div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Portföyünüzü oluşturun</h3>
                  <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 28px', fontSize: 14, lineHeight: 1.6 }}>
                    Altın, kripto, döviz, hisse senedi ve tüm yatırımlarınızı tek yerden takip edin.
                  </p>
                  <button onClick={() => setShowAddForm(true)} className="btn-primary" style={{ fontSize: 15, padding: '14px 32px' }}>
                    ＋ İlk Varlığınızı Ekleyin
                  </button>
                </div>
              ) : (
                <>

                  {/* Health + Goals side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <PortfolioHealthScore assets={assets} totalWealth={totalWealth} totalCost={totalCost} />
                    <GoalTracker totalWealth={totalWealth} />
                  </div>

                  {/* Charts Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <WealthHistoryChart history={history} currentTotal={totalWealth} assets={assets} totalPLPct={totalPLPct} totalCost={totalCost} />
                    </div>
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <WealthChart assets={assets} />
                    </div>
                  </div>

                  {/* Market Movers + Headlines + UpcomingEvents */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 40 }}>
                    <MarketMovers assets={assets} />
                    <GlobalHeadlines />
                    <UpcomingEvents />
                  </div>
                </>
              )}
            </>
          )}

          {/* ── ASSETS VIEW ── */}
          {activeView === 'assets' && (
            <div style={{ paddingBottom: 40 }}>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Varlıklarım</h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{assets.length} varlık kalemi</p>
              </div>
              <AssetsTabsWidget
                widgetId="assets"
                assets={assets}
                onDelete={(id) => setAssets(p => p.filter(a => a.id !== id))}
                onEdit={setEditingAsset}
                onSell={setSellingAsset}
                onAnalyze={setAnalyzingAsset}
              />
            </div>
          )}

          {/* ── GOALS VIEW ── */}
          {activeView === 'goals' && (
            <div style={{ paddingBottom: 40 }}>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Hedefler</h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Finansal hedeflerinizi takip edin</p>
              </div>
              <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <PortfolioHealthScore assets={assets} totalWealth={totalWealth} totalCost={totalCost} />
                <GoalTracker totalWealth={totalWealth} />
              </div>
            </div>
          )}

          {/* ── NEWS VIEW ── */}
          {activeView === 'news' && (
            <div style={{ paddingBottom: 40 }}>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Gündem</h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Global finans haberleri</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <GlobalHeadlines />
                {assets.length > 0 && <NewsSection assets={assets} />}
              </div>
            </div>
          )}

          {/* ── CONVERTER VIEW ── */}
          {activeView === 'converter' && (
            <div style={{ paddingBottom: 40 }}>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>💱 Hızlı Çevirici</h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Döviz, altın ve kripto çevirici</p>
              </div>
              <iframe src="/converter" style={{ width: '100%', height: 'calc(100vh - 160px)', border: 'none', borderRadius: 16 }} />
            </div>
          )}

        </main>
      </div>

      {/* ── Floating AI Chat (always visible) ── */}
      <AiPortfolioChat
        assets={assets}
        totalWealth={totalWealth}
        totalPL={totalPL}
        totalPLPct={totalPLPct}
        dailyPL={totalPL}
        dailyPLPct={totalPLPct}
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