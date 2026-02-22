'use client';

import { ThemeProvider, CurrencyProvider, WidgetLayoutProvider, DesignThemeProvider } from '@/lib/contexts';
import { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <DesignThemeProvider>
                <CurrencyProvider>
                    <WidgetLayoutProvider>
                        {children}
                    </WidgetLayoutProvider>
                </CurrencyProvider>
            </DesignThemeProvider>
        </ThemeProvider>
    );
}
