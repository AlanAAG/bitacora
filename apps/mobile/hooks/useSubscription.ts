import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Subscription, Profile } from '../types';

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [{ data: sub }, { data: prof }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      ]);
      setSubscription(sub);
      setProfile(prof);
      setLoading(false);
    })();
  }, []);

  // Mirror consume_guard_credit: a plan only counts while valid_until hasn't passed.
  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const current = !subscription?.valid_until || subscription.valid_until >= today;
  const isPro = current && (subscription?.plan === 'pro' || subscription?.plan === 'pro_guard');
  const hasGuard = current && subscription?.plan === 'pro_guard';
  const freeGuardLeft = profile?.free_guard_sessions_remaining ?? 0;
  const canUseGuard = hasGuard || freeGuardLeft > 0;

  return { subscription, profile, loading, isPro, hasGuard, canUseGuard, freeGuardLeft };
}
