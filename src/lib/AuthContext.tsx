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
        // Check if name is saved in localStorage
        const savedName = localStorage.getItem('finoria_display_name');

        // Check active sessions
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (savedName) setDisplayName(savedName);
            setLoading(false);
        });

        // Listen for changes on auth state
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
        // Generate a consistent email and password from the name
        const cleanName = name.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim() || 'user';
        const email = `${cleanName}@finoria.test`;
        const password = `finoria_${cleanName}_2024!`;

        // Try to sign in first
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            // If sign-in fails, create account
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (signUpError) {
                // If signup also fails, try signing in again (race condition)
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw new Error('Giriş yapılamadı. Lütfen tekrar deneyin.');
            } else {
                // Auto sign-in after sign-up
                await supabase.auth.signInWithPassword({ email, password });
            }
        }

        // Save display name
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
