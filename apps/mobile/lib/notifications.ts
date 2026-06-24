import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// SDK 56: handler returns banner/list flags (shouldShowAlert was split into the two).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    // Throws in Expo Go (SDK 53+) and without an EAS projectId — ignore in dev.
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
    return token;
  } catch {
    // No push in Expo Go / no EAS project configured yet — non-fatal.
    return;
  }
}
