'use client';

import React, { useState } from 'react';
import { useCurrency } from '@/lib/contexts';

export type ActiveView = 'dashboard' | 'assets' | 'goals' | 'news' | 'converter' | 'chat';

interface SidebarProps {
    totalWealth: number;
    totalCost: number;
    totalPL: number;
    totalPLPct: number;
    assetCount: number;
    displayName: string;
    lastUpdated: string;
    pricesLoading: boolean;
    activeView: ActiveView;
    onViewChange: (v: ActiveView) => void;
    onRefresh: () => void;
    onShare: () => void;
    onSignOut: () => void;
    onReset: () => void;
    onAddAsset: () => void;
    currency: 'TRY' | 'USD' | 'EUR';
    setCurrency: (c: 'TRY' | 'USD' | 'EUR') => void;
    theme: string;
    toggleTheme: () => void;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (v: boolean) => void;
}

export default function AppSidebar({
    totalWealth, totalCost, totalPL, totalPLPct, assetCount,
    displayName, lastUpdated, pricesLoading,
    activeView, onViewChange,
    onRefresh, onShare, onSignOut, onReset, onAddAsset,
    currency, setCurrency, theme, toggleTheme,
    sidebarCollapsed, setSidebarCollapsed,
}: SidebarProps) {
    const { convert, symbol } = useCurrency();
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const isUp = totalPL >= 0;

    const fmt = (n: number) => {
        const v = convert(n);
        if (Math.abs(v) >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(2)}M`;
        if (Math.abs(v) >= 1_000) return `${symbol}${(v / 1_000).toFixed(1)}K`;
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
    };

    const navItems: { id: ActiveView; icon: string; label: string }[] = [
        { id: 'dashboard', icon: '◈', label: 'Özet' },
        { id: 'assets', icon: '⬡', label: 'Varlıklarım' },
        { id: 'converter', icon: '⇌', label: 'Çevirici' },
    ];

    const w = sidebarCollapsed ? 68 : 240;

    return (
        <aside style={{
            width: w, minWidth: w, maxWidth: w,
            height: '100vh', position: 'sticky', top: 0,
            background: 'var(--bg-elevated)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', flexDirection: 'column',
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s, max-width 0.25s',
            overflow: 'hidden', flexShrink: 0, zIndex: 10,
        }}>

            {/* ── Logo + Collapse ── */}
            <div style={{
                padding: sidebarCollapsed ? '20px 0' : '20px 20px',
                display: 'flex', alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                minHeight: 64,
            }}>
                {!sidebarCollapsed && (
                    <div>
                        <div style={{
                            fontSize: 18, fontWeight: 900, letterSpacing: -0.5,
                            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                            Finoria
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5, marginTop: 1, fontWeight: 600, textTransform: 'uppercase' }}>
                            Servet Takibi
                        </div>
                    </div>
                )}
                {sidebarCollapsed && (
                    <div style={{
                        width: 32, height: 32, borderRadius: 10, fontSize: 16,
                        background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, color: '#fff',
                    }}>F</div>
                )}
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    style={{
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.8)', fontSize: 16, padding: '4px 10px', borderRadius: 8,
                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        ...(sidebarCollapsed ? { position: 'absolute', right: 4, top: 22 } : {}),
                    }}
                    onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                    onMouseOut={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    title={sidebarCollapsed ? 'Genişlet' : 'Daralt'}
                >
                    {sidebarCollapsed ? '›' : '‹'}
                </button>
            </div>

            {/* ── Net Worth Summary ── */}
            {assetCount > 0 && !sidebarCollapsed && (
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: 'rgba(0,0,0,0.15)',
                }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
                        Toplam Servet
                    </div>

                    <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: '#fff', lineHeight: 1, marginBottom: 8 }}>
                        {fmt(totalWealth)}
                    </div>

                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 700,
                        color: isUp ? '#10b981' : '#ef4444',
                        background: isUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        padding: '3px 8px', borderRadius: 6, marginBottom: 12,
                    }}>
                        <span style={{ fontSize: 8 }}>{isUp ? '▲' : '▼'}</span>
                        {isUp ? '+' : ''}{fmt(totalPL)}
                        <span style={{ opacity: 0.7 }}>({isUp ? '+' : ''}{totalPLPct.toFixed(2)}%)</span>
                    </div>

                    {/* Mini stats row */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 10px' }}>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>Maliyet</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{fmt(totalCost)}</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 10px' }}>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>Varlık</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{assetCount} kalem</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Navigation ── */}
            <nav style={{
                flex: 1, overflowY: 'auto',
                padding: sidebarCollapsed ? '12px 8px' : '12px 10px',
                display: 'flex', flexDirection: 'column', gap: 2,
            }}>
                {navItems.map(item => {
                    const isActive = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            title={sidebarCollapsed ? item.label : undefined}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: sidebarCollapsed ? '11px 0' : '10px 14px',
                                borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: isActive ? 'rgba(139,92,246,0.18)' : 'transparent',
                                color: isActive ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                                fontWeight: isActive ? 700 : 500,
                                fontSize: 13, width: '100%',
                                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                                transition: 'all 0.15s',
                                boxShadow: isActive ? 'inset 0 0 12px rgba(139,92,246,0.12)' : 'none',
                                borderLeft: isActive ? '3px solid #a78bfa' : '3px solid transparent',
                            }}
                            onMouseOver={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                                }
                            }}
                            onMouseOut={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                                }
                            }}
                        >
                            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                            {!sidebarCollapsed && <span>{item.label}</span>}
                        </button>
                    );
                })}
            </nav>

            {/* ── Bottom Controls ── */}
            <div style={{
                padding: sidebarCollapsed ? '12px 8px' : '12px 10px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', flexDirection: 'column', gap: 4,
            }}>
                {/* Currency Selector */}
                <div style={{
                    display: 'flex', borderRadius: 8, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.07)',
                    ...(sidebarCollapsed ? { justifyContent: 'center' } : {}),
                }}>
                    {(['TRY', 'USD', 'EUR'] as const).map(c => (
                        <button key={c} onClick={() => setCurrency(c)} style={{
                            flex: 1, background: currency === c ? 'var(--accent-purple)' : 'transparent',
                            color: currency === c ? '#fff' : 'rgba(255,255,255,0.3)',
                            border: 'none', padding: sidebarCollapsed ? '7px 2px' : '7px 0',
                            fontSize: sidebarCollapsed ? 7 : 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                        }}>
                            {c === 'TRY' ? '₺' : c === 'USD' ? '$' : '€'}
                        </button>
                    ))}
                </div>

                {/* Action buttons row */}
                <div style={{ display: 'flex', gap: 4, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
                    <button
                        onClick={toggleTheme}
                        title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
                        style={{
                            flex: sidebarCollapsed ? 0 : 1,
                            padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)',
                            background: 'transparent', cursor: 'pointer', fontSize: 13,
                            color: 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
                        }}
                    >{theme === 'dark' ? '☀️' : '🌙'}</button>
                    <button
                        onClick={onRefresh}
                        disabled={pricesLoading}
                        title="Fiyatları Güncelle"
                        style={{
                            flex: sidebarCollapsed ? 0 : 1,
                            padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)',
                            background: 'transparent', cursor: 'pointer', fontSize: 13,
                            color: 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
                            opacity: pricesLoading ? 0.5 : 1,
                        }}
                    >{pricesLoading ? '⏳' : '🔄'}</button>
                    {!sidebarCollapsed && (
                        <button
                            onClick={onShare}
                            title="Portföyü Paylaş"
                            style={{
                                flex: 1, padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)',
                                background: 'transparent', cursor: 'pointer', fontSize: 13,
                                color: 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
                            }}
                        >📤</button>
                    )}
                </div>

                {/* + Add Asset button */}
                <button
                    onClick={onAddAsset}
                    style={{
                        width: '100%', padding: sidebarCollapsed ? '9px 0' : '9px 12px',
                        borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                        color: '#fff', fontWeight: 700, fontSize: sidebarCollapsed ? 18 : 13,
                        cursor: 'pointer', transition: 'opacity 0.15s',
                        letterSpacing: sidebarCollapsed ? 0 : 0.5,
                    }}
                    onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseOut={e => e.currentTarget.style.opacity = '1'}
                >
                    {sidebarCollapsed ? '+' : '＋  Varlık Ekle'}
                </button>

                {/* Profile */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowProfileMenu(p => !p)}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center',
                            gap: 8, padding: sidebarCollapsed ? '8px 0' : '8px 10px',
                            borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: showProfileMenu ? 'rgba(255,255,255,0.06)' : 'transparent',
                            transition: 'background 0.15s',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseOut={e => e.currentTarget.style.background = showProfileMenu ? 'rgba(255,255,255,0.06)' : 'transparent'}
                    >
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: '#fff',
                        }}>
                            {(displayName || 'U').charAt(0).toUpperCase()}
                        </div>
                        {!sidebarCollapsed && (
                            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {displayName}
                                </div>
                                {lastUpdated && (
                                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                                        ● Güncellendi: {lastUpdated}
                                    </div>
                                )}
                            </div>
                        )}
                    </button>

                    {showProfileMenu && (
                        <div style={{
                            position: 'absolute', bottom: '110%', left: 0, right: 0,
                            background: 'var(--bg-card)', borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            overflow: 'hidden', zIndex: 100,
                        }}>
                            <button
                                onClick={() => { setShowProfileMenu(false); onSignOut(); }}
                                style={{
                                    width: '100%', padding: '12px 16px', border: 'none',
                                    background: 'transparent', cursor: 'pointer',
                                    color: 'var(--accent-red)', fontSize: 13, fontWeight: 600,
                                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                                }}
                            >🚪 Çıkış Yap</button>
                            <button
                                onClick={() => { setShowProfileMenu(false); onReset(); }}
                                style={{
                                    width: '100%', padding: '12px 16px', border: 'none',
                                    background: 'transparent', cursor: 'pointer',
                                    color: 'var(--text-muted)', fontSize: 12, fontWeight: 500,
                                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                                }}
                            >🗑 Her Şeyi Sıfırla</button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
