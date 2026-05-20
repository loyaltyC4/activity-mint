import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getUserTier } from '../lib/tiers';
import { supabase } from '../lib/supabase';

const TierContext = createContext({ tier: 'guest', subscriptionPlan: null });

/**
 * TierProvider — determines the current user's tier from auth + subscription state.
 *
 * Checks Supabase `subscriptions` table for an active subscription.
 * Falls back gracefully: if table doesn't exist or query fails, tier = free (logged in) or guest.
 */
export const TierProvider = ({ children }) => {
  const { user } = useAuth();
  const [subscriptionPlan, setSubscriptionPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setSubscriptionPlan(null);
      return;
    }
    // Try to fetch subscription; fail gracefully
    let cancelled = false;
    const fetchSub = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && data) {
          setSubscriptionPlan(data.plan); // 'standard' | 'premium'
        }
      } catch {
        // Table may not exist yet — that's fine, user is on free tier
      }
      if (!cancelled) setLoading(false);
    };
    fetchSub();
    return () => { cancelled = true; };
  }, [user]);

  const tier = getUserTier(user, subscriptionPlan);

  return (
    <TierContext.Provider value={{ tier, subscriptionPlan, loading }}>
      {children}
    </TierContext.Provider>
  );
};

export const useTier = () => useContext(TierContext);
