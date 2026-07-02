import { useEffect, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerPushToken } from '../lib/notifications';
import { identifyPurchases } from '../lib/purchases';
import { Colors } from '../constants/colors';

const theme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: Colors.primary, secondary: Colors.accent },
};

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  // Keyed by user id so a stale value from a previous session can never leak through.
  const [privacy, setPrivacy] = useState<{ uid: string; accepted: boolean } | null>(null);
  const privacyAccepted = session && privacy?.uid === session.user.id ? privacy.accepted : null;
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) {
        registerPushToken();
        identifyPurchases(s.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Track whether the user has accepted the aviso de privacidad (LFPDPPP gate).
  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    supabase.from('profiles').select('privacy_accepted_at').eq('id', uid).maybeSingle()
      .then(({ data }) => setPrivacy({ uid, accepted: !!data?.privacy_accepted_at }));
  }, [session]);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    const inLegal = segments[0] === 'legal';
    if (!session && !inAuth) { router.replace('/(auth)/onboarding'); return; }
    if (session) {
      if (privacyAccepted === false && !inLegal) { router.replace('/legal/privacy'); return; }
      if (privacyAccepted && (inAuth || inLegal)) router.replace('/(tabs)');
    }
  }, [session, ready, segments, privacyAccepted]);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
