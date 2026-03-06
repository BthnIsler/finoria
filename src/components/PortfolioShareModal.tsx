'use client';

import React, { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { Asset, CATEGORIES, getCategoryMeta } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';

interface PortfolioShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    totalWealth: number;
    totalPLPct: number;
    totalCost: number;
}

export default function PortfolioShareModal({ isOpen, onClose, assets, totalWealth, totalPLPct, totalCost }: PortfolioShareModalProps) {
    const { convert, currency, symbol } = useCurrency();
    const [hideAmounts, setHideAmounts] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [copied, setCopied] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const fmt = useCallback((v: number) =>
        hideAmounts ? '•••••' :
            new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
        , [hideAmounts, currency]);

    if (!isOpen) return null;

    const totalVal = convert(totalWealth);
    const totalCostVal = convert(totalCost);
    const plVal = totalVal - totalCostVal;
    const isUp = plVal >= 0;

    // Category distribution
    const catData = CATEGORIES.map(cat => {
        const catAssets = assets.filter(a => a.category === cat.key);
        const total = catAssets.reduce((sum, a) => {
            const p = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
            return sum + a.amount * p;
        }, 0);
        return { name: cat.labelTR, value: convert(total), color: cat.color, icon: cat.icon };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    const catTotal = catData.reduce((s, d) => s + d.value, 0);

    // Top 5 assets by value
    const topAssets = [...assets]
        .map(a => ({
            name: a.name,
            value: convert(a.amount * (a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice)),
            category: getCategoryMeta(a.category),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setDownloading(true);
        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: '#0d1117',
                scale: 2,
                useCORS: true,
                logging: false,
            });
            const link = document.createElement('a');
            link.download = `finoria-portfolio-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Share export error:', err);
        } finally {
            setDownloading(false);
        }
    };

    const handleCopy = async () => {
        if (!cardRef.current) return;
        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: '#0d1117',
                scale: 2,
                useCORS: true,
                logging: false,
            });
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                } catch {
                    // Fallback: download instead
                    handleDownload();
                }
            });
        } catch { /* ignore */ }
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20,
            }}
        >
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '100%' }}>
                {/* Controls */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 16,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                            fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600,
                        }}>
                            <input
                                type="checkbox"
                                checked={hideAmounts}
                                onChange={e => setHideAmounts(e.target.checked)}
                                style={{ accentColor: '#f59e0b' }}
                            />
                            Tutarları Gizle
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleCopy}
                            style={{
                                padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)', color: '#fff',
                                fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            {copied ? '✓ Kopyalandı!' : '📋 Kopyala'}
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            style={{
                                padding: '8px 16px', borderRadius: 8, border: 'none',
                                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                                color: '#fff', fontSize: 12, fontWeight: 700,
                                cursor: downloading ? 'wait' : 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            {downloading ? '⏳ İndiriliyor...' : '📥 PNG İndir'}
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                                background: 'transparent', color: 'rgba(255,255,255,0.5)',
                                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            }}
                        >✕</button>
                    </div>
                </div>

                {/* ── Shareable Card ── */}
                <div
                    ref={cardRef}
                    style={{
                        background: 'linear-gradient(160deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
                        borderRadius: 20, padding: '28px 24px 20px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    }}
                >
                    {/* Top: Branding + Date */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
                            <span style={{ color: '#fff' }}>Fin</span>
                            <span style={{ color: '#f59e0b' }}>oria</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 0.5 }}>
                            {dateStr}
                        </div>
                    </div>

                    {/* Total Wealth */}
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>
                            TOPLAM PORTFÖY DEĞERİ
                        </div>
                        <div style={{
                            fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: -1,
                        }}>
                            {fmt(totalVal)}
                        </div>
                        <div style={{
                            marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            border: `1px solid ${isUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            borderRadius: 8, padding: '4px 12px',
                        }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: isUp ? '#10b981' : '#ef4444' }}>
                                {isUp ? '▲' : '▼'} {hideAmounts ? '•••' : `${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`}
                            </span>
                            <span style={{ fontSize: 11, color: isUp ? '#34d399' : '#f87171', fontWeight: 600 }}>
                                {fmt(plVal)}
                            </span>
                        </div>
                    </div>

                    {/* Category Distribution Bar */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>
                            DAĞILIM
                        </div>
                        <div style={{
                            height: 18, width: '100%', display: 'flex', borderRadius: 6,
                            overflow: 'hidden', gap: 2,
                        }}>
                            {catData.map(d => (
                                <div key={d.name} style={{
                                    width: `${(d.value / catTotal) * 100}%`,
                                    height: '100%', background: d.color,
                                    transition: 'width 0.5s',
                                }} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 8 }}>
                            {catData.map(d => (
                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: 2, background: d.color }} />
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                                        {d.icon} {d.name} {hideAmounts ? '' : `%${((d.value / catTotal) * 100).toFixed(0)}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top 5 Holdings */}
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>
                            EN BÜYÜK 5 VARLIK
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {topAssets.map((a, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 10px', borderRadius: 8,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.25)', width: 14 }}>
                                            {i + 1}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                                            {a.category.icon} {a.name}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                                        {fmt(a.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Watermark */}
                    <div style={{
                        textAlign: 'center', paddingTop: 12,
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: 600, letterSpacing: 0.8 }}>
                            FİNORİA • finoria.tr
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
