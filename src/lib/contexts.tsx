'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// =====================
// Theme Context
// =====================
type Theme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    toggleTheme: () => { },
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>('dark');

    useEffect(() => {
        const saved = localStorage.getItem('wt_theme') as Theme | null;
        if (saved) setTheme(saved);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('wt_theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// =====================
// Design Theme Context (Glass / Neo)
// =====================
export type DesignTheme = 'glass' | 'neo' | 'minimal' | 'finans';

interface DesignThemeContextType {
    design: DesignTheme;
    setDesign: (d: DesignTheme) => void;
}

const DesignThemeContext = createContext<DesignThemeContextType>({
    design: 'glass',
    setDesign: () => { },
});

export function useDesignTheme() {
    return useContext(DesignThemeContext);
}

export function DesignThemeProvider({ children }: { children: ReactNode }) {
    const [design, setDesignState] = useState<DesignTheme>('glass');

    useEffect(() => {
        const saved = localStorage.getItem('wt_design') as DesignTheme | null;
        if (saved && (saved === 'glass' || saved === 'neo' || saved === 'minimal' || saved === 'finans')) setDesignState(saved);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-design', design);
        localStorage.setItem('wt_design', design);
    }, [design]);

    const setDesign = (d: DesignTheme) => setDesignState(d);

    return (
        <DesignThemeContext.Provider value={{ design, setDesign }}>
            {children}
        </DesignThemeContext.Provider>
    );
}

// =====================
// Currency Context
// =====================
export type DisplayCurrency = 'TRY' | 'USD' | 'EUR';

interface CurrencyContextType {
    currency: DisplayCurrency;
    setCurrency: (c: DisplayCurrency) => void;
    exchangeRates: Record<string, number>; // rates relative to TRY
    convert: (amountTRY: number) => number;
    symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType>({
    currency: 'TRY',
    setCurrency: () => { },
    exchangeRates: {},
    convert: (v) => v,
    symbol: '₺',
});

export function useCurrency() {
    return useContext(CurrencyContext);
}

const SYMBOLS: Record<DisplayCurrency, string> = {
    TRY: '₺',
    USD: '$',
    EUR: '€',
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrencyState] = useState<DisplayCurrency>('TRY');
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

    useEffect(() => {
        const saved = localStorage.getItem('wt_currency') as DisplayCurrency | null;
        if (saved) setCurrencyState(saved);
    }, []);

    useEffect(() => {
        // Fetch TRY -> USD, EUR rates
        const fetchRates = async () => {
            try {
                const res = await fetch('https://api.exchangerate-api.com/v4/latest/TRY');
                const data = await res.json();
                if (data.rates) {
                    setExchangeRates(data.rates);
                }
            } catch {
                // Fallback rates
                setExchangeRates({ USD: 0.027, EUR: 0.025 });
            }
        };
        fetchRates();
    }, []);

    const setCurrency = (c: DisplayCurrency) => {
        setCurrencyState(c);
        localStorage.setItem('wt_currency', c);
    };

    const convert = (amountTRY: number): number => {
        if (currency === 'TRY') return amountTRY;
        const rate = exchangeRates[currency];
        if (!rate) return amountTRY;
        return amountTRY * rate;
    };

    const symbol = SYMBOLS[currency];

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency, exchangeRates, convert, symbol }}>
            {children}
        </CurrencyContext.Provider>
    );
}

// =====================
// Widget Layout Context
// =====================
export type WidgetSize = 'small' | 'medium' | 'large';

export interface WidgetConfig {
    id: string;
    label: string;
    size: WidgetSize;
    visible: boolean;
    order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'history', label: 'Servet Geçmişi', size: 'large', visible: true, order: 0 },
    { id: 'chart', label: 'Portföy Dağılımı', size: 'medium', visible: true, order: 1 },
    { id: 'categories', label: 'Kategori Dağılımı', size: 'medium', visible: true, order: 2 },
    { id: 'assets', label: 'Varlıklarım', size: 'large', visible: true, order: 3 },
    { id: 'news', label: 'Haberler', size: 'large', visible: true, order: 4 },
];

interface WidgetLayoutContextType {
    widgets: WidgetConfig[];
    updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
    moveWidget: (id: string, direction: 'up' | 'down') => void;
    resetLayout: () => void;
    isEditing: boolean;
    setIsEditing: (v: boolean) => void;
}

const WidgetLayoutContext = createContext<WidgetLayoutContextType>({
    widgets: DEFAULT_WIDGETS,
    updateWidget: () => { },
    moveWidget: () => { },
    resetLayout: () => { },
    isEditing: false,
    setIsEditing: () => { },
});

export function useWidgetLayout() {
    return useContext(WidgetLayoutContext);
}

export function WidgetLayoutProvider({ children }: { children: ReactNode }) {
    const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('wt_widgets');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults to handle new widgets
                const merged = DEFAULT_WIDGETS.map((dw) => {
                    const saved = parsed.find((p: WidgetConfig) => p.id === dw.id);
                    return saved ? { ...dw, ...saved } : dw;
                });
                setWidgets(merged);
            } catch {
                setWidgets(DEFAULT_WIDGETS);
            }
        }
    }, []);

    const save = (w: WidgetConfig[]) => {
        setWidgets(w);
        localStorage.setItem('wt_widgets', JSON.stringify(w));
    };

    const updateWidget = (id: string, updates: Partial<WidgetConfig>) => {
        save(widgets.map((w) => (w.id === id ? { ...w, ...updates } : w)));
    };

    const moveWidget = (id: string, direction: 'up' | 'down') => {
        const sorted = [...widgets].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((w) => w.id === id);
        if (idx === -1) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const tempOrder = sorted[idx].order;
        sorted[idx].order = sorted[swapIdx].order;
        sorted[swapIdx].order = tempOrder;
        save(sorted);
    };

    const resetLayout = () => save(DEFAULT_WIDGETS);

    return (
        <WidgetLayoutContext.Provider value={{ widgets, updateWidget, moveWidget, resetLayout, isEditing, setIsEditing }}>
            {children}
        </WidgetLayoutContext.Provider>
    );
}
