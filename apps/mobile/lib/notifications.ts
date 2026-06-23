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
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
  return token;
}
