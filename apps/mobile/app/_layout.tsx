import { useEffect, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerPushToken } from '../lib/notifications';
import { Colors } from '../constants/colors';

const theme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: Colors.primary, secondary: Colors.accent },
};

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) registerPushToken();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/onboarding');
    if (session && inAuth) router.replace('/(tabs)');
  }, [session, ready, segments]);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
