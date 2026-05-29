import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

/**
 * AuthProvider — restores the user's session on every page load so a refresh
 * never bounces an authenticated user back to the sign-in screen.
 *
 * Render strategy:
 *   - Always render children. Pages observe `loading` via useAuth() and can
 *     show a skeleton if they want, but we never block the tree from
 *     mounting just because we're waiting on getSession().
 *   - Optimistically restore the previously-known user from localStorage so
 *     UI doesn't flicker between "signed-out" and "signed-in" on refresh.
 */
const LAST_USER_KEY = 'am.auth.last_user.v1';

function readCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      // Cache the minimum we need so the dashboard renders immediately on refresh.
      const lite = {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata || {},
      };
      window.localStorage.setItem(LAST_USER_KEY, JSON.stringify(lite));
    } else {
      window.localStorage.removeItem(LAST_USER_KEY);
    }
  } catch {}
}

export const AuthProvider = ({ children }) => {
  // Seed user from the optimistic cache so the first paint shows the dashboard
  // instead of the sign-in screen for users with a valid session.
  const [user, setUser] = useState(readCachedUser);
  const [loading, setLoading] = useState(true);
  const subRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // Hydrate the canonical session from Supabase. If the cached user is
    // stale (signed out elsewhere, token revoked), this corrects it.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        const next = session?.user ?? null;
        setUser(next);
        writeCachedUser(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Network or storage failure — keep the optimistic user, drop loading.
        setLoading(false);
      });

    // Subscribe to auth state changes (sign in / sign out / token refresh)
    // so the rest of the app sees live updates.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      setUser(next);
      writeCachedUser(next);
    });
    subRef.current = data?.subscription;

    return () => {
      cancelled = true;
      try {
        subRef.current?.unsubscribe();
      } catch {}
    };
  }, []);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password });

  const signOut = async () => {
    const res = await supabase.auth.signOut();
    setUser(null);
    writeCachedUser(null);
    return res;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
