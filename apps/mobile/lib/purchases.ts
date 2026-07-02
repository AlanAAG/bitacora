import { Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

// react-native-purchases is a native module, absent in Expo Go. Lazy-require so the
// app still boots there — purchases are simply unavailable until a dev/store build.
// Types are erased at runtime, so the type-only import above is safe.
type PurchasesModule = typeof import('react-native-purchases').default;
let Purchases: PurchasesModule | null = null;
try {
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY,
});

export const ENTITLEMENT = 'pro_guard';

let configuredFor: string | null = null;

export function purchasesAvailable(): boolean {
  return !!Purchases && !!API_KEY;
}

// Identify RevenueCat with the Supabase user id so the webhook can map
// app_user_id → subscriptions.user_id. Safe to call on every auth change.
export async function identifyPurchases(userId: string) {
  if (!Purchases || !API_KEY || configuredFor === userId) return;
  try {
    if (configuredFor === null) {
      Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    } else {
      await Purchases.logIn(userId);
    }
    configuredFor = userId;
  } catch {
    // Non-fatal: paywall will show "unavailable"; retried on next auth change.
  }
}

// The single monthly package from the current offering (intro offer = 7-day trial,
// configured store-side).
export async function getMonthlyPackage(): Promise<PurchasesPackage | null> {
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.monthly ?? offerings.current?.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

// True = entitlement active. The DB row is written by the RevenueCat webhook a few
// seconds later; callers should refetch useSubscription rather than trust this alone.
export async function purchasePackage(pkg: PurchasesPackage): Promise<{ ok: boolean; cancelled?: boolean }> {
  if (!Purchases) return { ok: false };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: !!customerInfo.entitlements.active[ENTITLEMENT] };
  } catch (e) {
    const cancelled = !!(e as { userCancelled?: boolean })?.userCancelled;
    return { ok: false, cancelled };
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!Purchases) return false;
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active[ENTITLEMENT];
  } catch {
    return false;
  }
}
