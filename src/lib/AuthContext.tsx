'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

// Generate a deterministic UUID-like ID from a name string
function nameToId(name: string): string {
    const clean = name.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
        const char = clean.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `00000000-0000-4000-8000-${hex.padStart(12, '0')}`;
}

interface SimpleUser {
    id: string;
    email: string;
}

interface AuthContextType {
    user: SimpleUser | null;
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
    const [user, setUser] = useState<SimpleUser | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if name is saved in localStorage
        const savedName = localStorage.getItem('finoria_display_name');
        if (savedName) {
            const id = nameToId(savedName);
            setUser({ id, email: `${savedName.toLowerCase()}@finoria.app` });
            setDisplayName(savedName);
        }
        setLoading(false);
    }, []);

    const loginWithName = async (name: string) => {
        const id = nameToId(name);
        setUser({ id, email: `${name.toLowerCase()}@finoria.app` });
        setDisplayName(name);
        localStorage.setItem('finoria_display_name', name);
    };

    const signOut = async () => {
        setUser(null);
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
