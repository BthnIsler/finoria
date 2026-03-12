'use client';

import React from 'react';
import { Asset } from '@/lib/types';
import HeroWealthCard from '@/components/HeroWealthCard';
import WealthChart from '@/components/WealthChart';
import WealthHistoryChart from '@/components/WealthHistoryChart';
import UpcomingEvents from '@/components/UpcomingEvents';
import NewsSection from '@/components/NewsSection';

import { WealthSnapshot } from '@/lib/storage';

interface DashboardViewProps {
    assets: Asset[];
    totalWealth: number;
    totalCost: number;
    history: WealthSnapshot[];
    heroPLPeriod: '1d' | '1w' | '1m' | 'all';
    setHeroPLPeriod: (p: '1d' | '1w' | '1m' | 'all') => void;
    activeHeroPL: { pl: number; pct: number; label: string };
    /** When true: renders simplified mobile layout (no news/movers, compact charts) */
    isMobile?: boolean;
}

export default function DashboardView({
    assets, totalWealth, totalCost, history,
    heroPLPeriod, setHeroPLPeriod, activeHeroPL,
    isMobile = false,
}: DashboardViewProps) {
    const gap = isMobile ? 16 : 24;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap, paddingBottom: 48 }}>

            {/* 1. Hero Wealth Card - full width */}
            <div>
                <HeroWealthCard
                    assets={assets}
                    totalWealth={totalWealth}
                    totalCost={totalCost}
                    history={history}
                    heroPLPeriod={heroPLPeriod}
                    setHeroPLPeriod={setHeroPLPeriod}
                    activeHeroPL={activeHeroPL}
                    onShare={() => {
                        const shareData = {
                            title: 'Finoria Servet Özeti',
                            text: `Cari servetim ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalWealth)} seviyesinde!`,
                            url: window.location.origin
                        };
                        if (navigator.share) {
                            navigator.share(shareData).catch(console.error);
                        } else {
                            alert('Tarayıcınız paylaşım özelliğini desteklemiyor.');
                        }
                    }}
                />
            </div>

            {/* 2. Charts Row — History left, Pie right */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap,
            }}>
                <div style={{
                    background: 'var(--bg-elevated)', borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden', height: isMobile ? 320 : 420,
                }}>
                    <WealthHistoryChart
                        history={history}
                        currentTotal={totalWealth}
                        assets={assets}
                        totalCost={totalCost}
                    />
                </div>
                <div style={{
                    background: 'var(--bg-elevated)', borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden', height: isMobile ? 'auto' : 420,
                }}>
                    <WealthChart assets={assets} isMobile={isMobile} />
                </div>
            </div>

            {/* 3. Upcoming Events */}
            <div>
                <UpcomingEvents />
            </div>

            {/* 4. News — web only (mobile has Haberler tab) */}
            {!isMobile && assets.length > 0 && (
                <div style={{
                    background: 'var(--bg-elevated)', borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.07)',
                    padding: '24px 28px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(34,211,238,0.1))',
                            border: '1px solid rgba(167,139,250,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                        }}>📰</div>
                        <div>
                            <h2 style={{
                                fontSize: 16, fontWeight: 800, color: 'var(--text-primary)',
                                letterSpacing: -0.3, margin: '0 0 2px',
                            }}>Portföy Haberleri</h2>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                                varlıklarınızla ilgili son haberler
                            </p>
                        </div>
                    </div>
                    <NewsSection assets={assets} />
                </div>
            )}

        </div>
    );
}
