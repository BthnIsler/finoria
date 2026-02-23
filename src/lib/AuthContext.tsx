'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    displayName: string;
    loading: boolean;
    loginWithName: (name: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    displayName: '',
    loading: true,
    loginWithName: async () => { },
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedName = localStorage.getItem('finoria_display_name');
        if (savedName) setDisplayName(savedName);

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (!session?.user) {
                setDisplayName('');
                localStorage.removeItem('finoria_display_name');
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const loginWithName = async (name: string) => {
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/gi, '').trim() || 'user';
        const email = `${cleanName}@finoria.test`;
        const password = `Finoria_${cleanName}_2024!`;

        // Try sign in first
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
            // Sign in failed — create the account
            const { error: signUpError } = await supabase.auth.signUp({ email, password });

            if (signUpError) {
                throw new Error(`Hesap oluşturulamadı: ${signUpError.message}`);
            }

            // Try signing in after signup
            const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            if (loginError) {
                throw new Error(`Giriş yapılamadı: ${loginError.message}. Lütfen Supabase'de "Confirm email" ayarını kapatın.`);
            }
        }

        setDisplayName(name);
        localStorage.setItem('finoria_display_name', name);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setDisplayName('');
        localStorage.removeItem('finoria_display_name');
    };

    return (
        <AuthContext.Provider value={{ user, displayName, loading, loginWithName, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
