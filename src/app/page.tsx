'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset } from '@/lib/types';
import { WealthSnapshot, saveAssetPriceSnapshot } from '@/lib/storage';
import { getAssets, getWealthHistory, saveWealthSnapshot, saveMultipleAssetPrices, migrateLocalDataToSupabase, updateAsset, deleteAsset } from '@/lib/db';
import { fetchAllPrices } from '@/lib/prices';
import { getAssetCostInTRY } from '@/lib/utils';
import { useTheme, useCurrency, useWidgetLayout, useDesignTheme } from '@/lib/contexts';
import AssetForm from '@/components/AssetForm';
import EditAssetForm from '@/components/EditAssetForm';
import AssetCard from '@/components/AssetCard';
import AssetsTabsWidget from '@/components/AssetsTabsWidget';
import CategoryBreakdown from '@/components/CategoryBreakdown';
import WealthChart from '@/components/WealthChart';
import WealthHistoryChart from '@/components/WealthHistoryChart';
import SellAssetForm from '@/components/SellAssetForm';
import AiAnalysis from '@/components/AiAnalysis';
import NewsSection from '@/components/NewsSection';
import WidgetWrapper from '@/components/WidgetWrapper';
import AnimatedNumber from '@/components/AnimatedNumber';
import AiPortfolioChat from '@/components/AiPortfolioChat';
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
      // Check for local migration first
      const localAssetsStr = localStorage.getItem('wealth_tracker_assets');
      if (localAssetsStr && JSON.parse(localAssetsStr).length > 0) {
        if (confirm('Eski cihazınızdaki veya tarayıcınızdaki verileri buluta aktarmak ister misiniz?')) {
          await migrateLocalDataToSupabase(user.id);
        } else {
          localStorage.removeItem('wealth_tracker_assets');
          localStorage.removeItem('wealth_tracker_history');
        }
      }

      const loadedAssets = await getAssets(user.id);
      setAssets(loadedAssets);
      setHistory(await getWealthHistory(user.id));
      setLoading(false);
    };
    loadData();
  }, [user]);

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

      <div className={mobilePreview ? 'mobile-preview-wrapper' : ''}>
        {mobilePreview && (
          <div className="mobile-preview-frame">
            <div className="mobile-preview-notch" />
          </div>
        )}
        <main className={mobilePreview ? 'mobile-preview-content' : ''} style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '28px 20px', maxWidth: mobilePreview ? 390 : 1200, margin: '0 auto' }}>
          {/* Header */}
          <header className="app-header">
            <div className="header-left">
              <h1 style={{ fontSize: 24, fontWeight: 800 }}>
                <span className="gradient-text">Finoria</span>
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Tüm yatırımlarınız, tek bir bakışta</p>
            </div>
            <div className="header-right">
              {lastUpdated && (
                <span className="live-dot hide-mobile" style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>
                  {lastUpdated}
                </span>
              )}
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {(['TRY', 'USD', 'EUR'] as const).map((c) => (
                  <button key={c} onClick={() => setCurrency(c)}
                    style={{
                      background: currency === c ? 'var(--accent-purple)' : 'transparent',
                      color: currency === c ? 'white' : 'var(--text-muted)',
                      border: 'none', padding: '7px 12px', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {c === 'TRY' ? '₺' : c === 'USD' ? '$' : '€'}
                  </button>
                ))}
              </div>

              <button onClick={toggleTheme} className="btn-icon" title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}>
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>

              {assets.length > 0 && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="btn-icon hide-mobile"
                  title="Widget Düzenle"
                  style={isEditing ? { borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)' } : {}}
                >
                  ⚙️
                </button>
              )}

              <button onClick={refreshPrices} className="btn-icon" disabled={pricesLoading} title="Fiyatları Güncelle">
                {pricesLoading ? '⏳' : '🔄'}
              </button>

              <button
                onClick={() => setMobilePreview(!mobilePreview)}
                className="btn-icon hide-mobile"
                title="Mobil Önizleme"
                style={mobilePreview ? { borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' } : {}}
              >
                📱
              </button>

              {/* Profile dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  title="Profil"
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {displayName?.charAt(0).toUpperCase() || '?'}
                </button>
                {showProfile && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 8,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 16, padding: 0, minWidth: 240,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.3)', zIndex: 100,
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Hesap</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {displayName}
                      </p>
                    </div>
                    <div style={{ padding: 8 }}>
                      <button
                        onClick={() => { setShowProfile(false); signOut(); }}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: 10,
                          background: 'transparent', border: 'none',
                          color: 'var(--accent-red)', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        🚪 Çıkış Yap
                      </button>
                      <button
                        onClick={() => { setShowProfile(false); setShowResetModal(true); }}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: 10,
                          background: 'transparent', border: 'none',
                          color: 'var(--text-muted)', fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        🗑 Her Şeyi Sıfırla
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setShowAddForm(true)} className="btn-primary">＋ Ekle</button>
            </div>
          </header>



          {/* Widget editing bar */}
          {
            isEditing && (
              <div
                style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
                  borderRadius: 14, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  ⚙️ Widget düzenleme modu — boyut, sıra ve görünürlüğü ayarlayın
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {hiddenWidgets.length > 0 && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {hiddenWidgets.map((w) => (
                        <button key={w.id} className="chip" style={{ fontSize: 11 }}
                          onClick={() => updateWidget(w.id, { visible: true })}>
                          + {w.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={resetLayout}>
                    Sıfırla
                  </button>
                  <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setIsEditing(false)}>
                    ✓ Bitti
                  </button>
                </div>
              </div>
            )
          }

          {/* Hero Wealth Card */}
          <div className="wealth-hero wealth-hero-hover" style={{ padding: '36px 32px', marginBottom: 0, textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Toplam Servet
            </p>
            <h2 className="wealth-glow" style={{ fontSize: assets.length > 0 ? 44 : 32, fontWeight: 900, letterSpacing: -1.5, marginBottom: 4 }}>
              {assets.length > 0 ? (
                <AnimatedNumber
                  value={convert(totalWealth)}
                  duration={900}
                  formatter={(n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}
                />
              ) : `${symbol}0,00`}
            </h2>

            {assets.length > 0 && totalCost > 0 && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                {/* P/L Period Toggle */}
                <div style={{ display: 'inline-flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 2, marginBottom: 10 }}>
                  {([{ key: '1d' as const, label: 'Günlük' }, { key: '1w' as const, label: 'Haftalık' }, { key: '1m' as const, label: 'Aylık' }, { key: 'all' as const, label: 'Tümü' }]).map(p => (
                    <button
                      key={p.key}
                      onClick={() => setHeroPLPeriod(p.key)}
                      style={{
                        background: heroPLPeriod === p.key
                          ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))'
                          : 'transparent',
                        color: heroPLPeriod === p.key ? '#fff' : 'var(--text-muted)',
                        border: 'none', padding: '4px 12px', fontSize: 10, fontWeight: 700,
                        borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Cost + P/L values */}
                <div style={{ display: 'inline-flex', gap: 20, fontSize: 13, justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Maliyet</p>
                    <p style={{ fontWeight: 600 }}>
                      <AnimatedNumber
                        value={convert(totalCost)}
                        duration={800}
                        formatter={(n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}
                      />
                    </p>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)', margin: '0 2px' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{activeHeroPL.label}</p>
                    <p style={{ fontWeight: 600, color: activeHeroPL.pl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {activeHeroPL.pl >= 0 ? '+' : ''}
                      <AnimatedNumber
                        value={Math.abs(convert(activeHeroPL.pl))}
                        duration={800}
                        formatter={(n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}
                      />
                      <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.7 }}>({activeHeroPL.pct >= 0 ? '+' : ''}{activeHeroPL.pct.toFixed(1)}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {assets.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Portföyünüzü oluşturmaya başlayın 🚀</p>
            )}
          </div>

          {/* Widgets Grid */}
          {
            assets.length > 0 ? (
              <div className="widgets-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40 }}>
                {sortedWidgets.map((w) => {
                  if (!w.visible) return null;
                  switch (w.id) {
                    case 'history':
                      return (
                        <WidgetWrapper key={w.id} widgetId={w.id}>
                          <WealthHistoryChart history={history} currentTotal={totalWealth} assets={assets} totalPLPct={totalPLPct} totalCost={totalCost} />
                        </WidgetWrapper>
                      );
                    case 'chart':
                      return (
                        <WidgetWrapper key={w.id} widgetId={w.id}>
                          <WealthChart assets={assets} />
                        </WidgetWrapper>
                      );
                    case 'categories':
                      return (
                        <WidgetWrapper key={w.id} widgetId={w.id}>
                          <CategoryBreakdown assets={assets} onSell={setSellingAsset} />
                        </WidgetWrapper>
                      );
                    case 'assets':
                      return (
                        <AssetsTabsWidget
                          key={w.id}
                          widgetId={w.id}
                          assets={assets}
                          onDelete={(id) => setAssets((p) => p.filter((a) => a.id !== id))}
                          onEdit={setEditingAsset}
                          onSell={setSellingAsset}
                          onAnalyze={setAnalyzingAsset}
                        />
                      );
                    case 'news':
                      return <NewsSection key={w.id} assets={assets} />;
                    default:
                      return null;
                  }
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>💎</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Henüz varlık eklenmedi</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto 24px', fontSize: 13, lineHeight: 1.6 }}>
                  Altın, kripto, döviz, hisse senedi ve diğer tüm yatırımlarınızı ekleyin.
                </p>
                <button onClick={() => setShowAddForm(true)} className="btn-primary" style={{ fontSize: 14, padding: '14px 28px' }}>
                  ＋ İlk Varlığınızı Ekleyin
                </button>
              </div>
            )
          }
        </main >
      </div >

      {showAddForm && <AssetForm onClose={() => setShowAddForm(false)} onAdd={(a) => setAssets((p) => [...p, a])} />
      }
      {editingAsset && <EditAssetForm asset={editingAsset} onClose={() => setEditingAsset(null)} onUpdate={(u) => setAssets((p) => p.map((a) => (a.id === u.id ? u : a)))} />}
      {
        sellingAsset && (
          <SellAssetForm
            asset={sellingAsset}
            onClose={() => setSellingAsset(null)}
            onSold={(id, updatedAsset) => {
              if (updatedAsset) {
                setAssets((p) => p.map((a) => (a.id === id ? updatedAsset : a)));
              } else {
                setAssets((p) => p.filter((a) => a.id !== id));
              }
            }}
          />
        )
      }
      {
        analyzingAsset && (
          <AiAnalysis
            asset={analyzingAsset}
            onClose={() => setAnalyzingAsset(null)}
          />
        )
      }
      {
        showResetModal && (
          <ResetModal
            onClose={() => setShowResetModal(false)}
            onReset={() => { setAssets([]); setHistory([]); }}
          />
        )
      }
      {/* Floating AI Chat Mascot */}
      <AiPortfolioChat
        assets={assets}
        totalWealth={totalWealth}
        totalPL={totalPL}
        totalPLPct={totalPLPct}
        fmt={fmt}
      />
    </>
  );
}
