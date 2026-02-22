'use client';

import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider, CurrencyProvider, WidgetLayoutProvider, DesignThemeProvider } from '@/lib/contexts';
import { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            <ThemeProvider>
                <DesignThemeProvider>
                    <CurrencyProvider>
                        <WidgetLayoutProvider>
                            {children}
                        </WidgetLayoutProvider>
                    </CurrencyProvider>
                </DesignThemeProvider>
            </ThemeProvider>
        </AuthProvider>
    );
}
