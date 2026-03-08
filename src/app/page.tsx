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
    if (assets.length === 0) return;
    setPricesLoading(true);
    try {
      // In minimal mode or simply without external price fetcher, we refresh from DB
      if (user) {
        const dbAssets = await getAssets(user.id);
        const updated = dbAssets;
        
        // Still save snapshot history
        await saveWealthSnapshot(user.id, updated);
        saveAssetPriceSnapshot(updated); 
        setHistory(await getWealthHistory(user.id));
        setAssets(updated);
      }
      setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
    } catch (err) { console.error('Fiyat güncelleme hatası:', err); }
    finally { setPricesLoading(false); }
  }, [assets, user]);

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

      {/* ── App Shell: Sidebar + Main ── */}
      <div className="flex h-screen overflow-hidden relative z-10">

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
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 max-w-full">

          {/* ── DASHBOARD VIEW ── */}
          {activeView === 'dashboard' && (
            assets.length === 0 ? (
              <div className="text-center py-20 px-5">
                <div className="text-7xl mb-5">💎</div>
                <h3 className="text-2xl font-bold mb-3 text-primary">Portföyünüzü oluşturun</h3>
                <p className="text-muted max-w-md mx-auto mb-7 text-sm leading-relaxed">
                  Altın, kripto, döviz, hisse senedi ve tüm yatırımlarınızı tek yerden takip edin.
                </p>
                <button onClick={() => setShowAddForm(true)} className="btn-primary text-base px-8 py-3.5">
                  ＋ İlk Varlığınızı Ekleyin
                </button>
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