# Bitácora — Go-live guide (App Store + Play Store)

The path is: **backend prod → dev build on your phone → extensive local testing → TestFlight/Play internal beta → store review → public launch.** Do not skip the beta stage; it's also what your GTM Weeks 0–2 need.

---

## 0. One-time accounts (start today — approvals take days)

| What | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99 USD/yr | developer.apple.com. As individual is fine for MVP. Approval: 1–2 days. |
| Google Play Console | $25 USD once | play.google.com/console. **New personal accounts must run a closed test with 12 testers for 14 days before production access** — start this clock early with your beta waitlist. |
| Expo account (EAS) | Free tier OK | expo.dev. EAS free tier has limited build queue; enough for MVP. |

## 1. Backend to production

Follow `SETUP.md` top to bottom on your production Supabase project:
1. Migrations `001` → `007` (`007_paywall_flag.sql` seeds `paywall=disabled`; flip it on once RevenueCat is configured — §2b).
2. Create the 4 storage buckets (car-documents, ocr-photos, guard-audio private; guard-cards public).
3. Vault secrets (`project_url`, `cron_secret`) + edge-function secrets (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`).
4. Deploy the 9 functions with the exact JWT / `--no-verify-jwt` split in SETUP.md §5.
5. Confirm the tunable `app_config` values (2026 verificación calendar, refrendo deadline, HNC fines) against SEDEMA/Finanzas before launch.
6. Have counsel review `app/legal/privacy.tsx` (LFPDPPP) — the store listing needs a **public privacy-policy URL**; publish that same text on a simple web page (Notion public page or GitHub Pages is fine for beta).
7. Point `apps/mobile/.env` at the prod project (`EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`). Consider a separate staging project for testing so beta data doesn't pollute prod.

## 2. Wire the app to EAS (once)

```sh
cd apps/mobile
npm i -g eas-cli          # or keep using npx eas-cli
eas login
eas init                  # writes extra.eas.projectId into app.json — commit it
```
`projectId` is also what makes `registerPushToken` work outside Expo Go.

Bundle IDs are already set: `com.alanayala.bitacora` (both stores). `eas.json` has `development` / `preview` / `production` profiles.

## 2b. Billing (RevenueCat — already wired in code)

The app purchases through `react-native-purchases`; the `revenuecat-webhook` edge function writes the `subscriptions` row (single source of truth — clients can't). One-time dashboard setup:

1. **Stores:** App Store Connect → create auto-renewable subscription `bitacora_pro_guard_monthly` ($149 MXN/mo) with a **7-day free introductory offer** (this is what makes the "Probar 7 días gratis" button true). Play Console → same product id, base plan monthly + 7-day free trial offer. (Requires the app record to exist and, for Apple, the Paid Apps agreement signed.)
2. **RevenueCat:** create project → add both apps → entitlement `pro_guard` → attach both products → default Offering with a `monthly` package.
3. **Keys:** copy the public Apple/Google SDK keys into `apps/mobile/.env` (`EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `_GOOGLE_KEY`). Without them the paywall stays "Disponible pronto".
4. **Webhook:** `supabase secrets set REVENUECAT_WEBHOOK_SECRET=...`, deploy `revenuecat-webhook --no-verify-jwt`, then RevenueCat → Integrations → Webhooks → URL `https://PROJECT.supabase.co/functions/v1/revenuecat-webhook`, Authorization header `Bearer <secret>`.
5. **Enable:** `UPDATE app_config SET value = '{"enabled":true}' WHERE key = 'paywall';`
6. **Test in sandbox** (needs a dev/TestFlight build, never Expo Go): iOS sandbox tester account / Play license tester → buy → confirm the `subscriptions` row flips to `pro_guard` and Guard runs unlimited; cancel → row returns to `free` after expiry.

## 3. Build a development build and test locally (BEFORE any store step)

Expo Go cannot do remote push notifications or the mic/camera permission strings — you need a dev build:

```sh
eas build --profile development --platform ios     # needs Apple account linked
eas build --profile development --platform android # .apk you can install directly
npx expo start                                     # then open the dev build, not Expo Go
```
(Alternative without EAS queue: `npx expo run:ios` / `run:android` with Xcode / Android Studio installed.)

### Extensive local test checklist (physical phone, prod-like Supabase)
Auth & onboarding:
- [ ] Signup → 3-step onboarding → aviso de privacidad gate blocks until accepted → consent toggles persist.
- [ ] Referral deep link `bitacora://…?ref=CODE` at signup credits both accounts +5 sessions.
- [ ] Sign out / sign back in; kill app and relaunch (session persists).

Core logbook:
- [ ] Add car (<2 min), setup seeds "últimas veces", edit car, update mileage.
- [ ] Registrar servicio: odometer prefilled, log updates car mileage, "Otro" free-text works.
- [ ] Parts health bars move with mileage; docs upload → expiry badge; OCR a real paper receipt with the camera.

Guard Mode (the review-critical flow):
- [ ] Consent screen appears once; recording shows black screen + pulse; screen-tap to stop.
- [ ] 1–2 min real conversation (radio on, pocket audio) → transcription → flags → savings estimate.
- [ ] Share card renders and shares to WhatsApp; audio file is gone from storage after analysis.
- [ ] Quota: run sessions to 0 → paywall path appears; "Disponible pronto" when the flag is off, sandbox purchase + "Restaurar compras" when on (§2b.6).

Notifications & agents (staging cron simulation):
```sh
curl -X POST https://PROJECT.supabase.co/functions/v1/maintenance-agent -H "x-cron-secret: $CRON_SECRET"
curl -X POST https://PROJECT.supabase.co/functions/v1/daily-circulation -H "x-cron-secret: $CRON_SECRET"
```
- [ ] Push arrives on the physical phone (app closed) for: due maintenance, doc expiry, verificación window, Hoy No Circula morning.
- [ ] Home badge matches today's HNC restriction for your real plate/hologram.

Compliance:
- [ ] ARCO: export data works; delete account removes everything and signs out.
- [ ] Airplane mode: app degrades gracefully (no crashes, error copy in Spanish).

## 4. Beta distribution (this IS your GTM Weeks 0–2)

**iOS — TestFlight:**
```sh
eas build --profile production --platform ios
eas submit --platform ios
```
In App Store Connect → TestFlight: internal testers (instant) → external testers (light "beta review", ~1 day). Invite the waitlist by email/public link. 90-day builds, up to 10k testers.

**Android — Play internal → closed testing:**
```sh
eas build --profile production --platform android
eas submit --platform android
```
Play Console → Internal testing (up to 100 emails, instant) → Closed testing (this is where the 12-testers/14-days requirement burns down). Android push needs FCM: add the `google-services.json` from Firebase to the project and upload the FCM key to Expo (`eas credentials`); iOS APNs is handled automatically by EAS.

## 5. Store review & public launch

Fill per store:
- **Listing (es-MX):** name, subtitle ("Tu auto, protegido"), screenshots (home, Guard result, share card, reminders), description leading with the value math.
- **Privacy:** Apple "privacy nutrition" + Play Data Safety. Declare: audio recordings + transcripts (user-initiated, not tracking), service history, email, push token; deletion available in-app (`delete-account`). Both link the public privacy-policy URL.
- **Age rating:** 4+/Everyone.

**Review-risk items specific to Bitácora — address them in App Review notes:**
1. **Audio recording with a dark screen.** State plainly: recording is user-initiated (big button), consent screen shown first (`guard_consent_given`), a visible red pulse stays on screen, audio is deleted right after analysis, nothing records in background. Never market it as "secret recording" in the listing — use the app's own framing: *"Escucha en silencio. Tú decides después."*
2. **Demo account.** Provide credentials with a seeded car, service history, and 1 completed Guard session so the reviewer never hits an empty state; note that Guard analysis needs a real spoken conversation in Spanish.
3. **Paywall.** Billing is store IAP via RevenueCat (§2b) — compliant on both stores. If you submit with the `paywall` flag off, there's no purchasable content and that's also fine; just don't mention pricing in the listing while it's off. A "Restaurar compras" button is present (Apple checks for it).

Timeline expectations: Apple review 1–3 days (rejections common on first try — answer and resubmit, it's normal). Play production review up to ~7 days for a new account.

## 6. After launch — release train

- JS-only changes (copy, screens, logic): `eas update` ships over-the-air, no review.
- Native changes (new permission, new native module, SDK upgrade): new `eas build` + store review; bump `version`, EAS auto-increments build numbers (`autoIncrement`).
- Keep `hardening-cdmx-compliance` merged to `master` before the first production build so builds are reproducible from main.

## Costs recap
$99/yr (Apple) + $25 (Google) + $0 EAS free tier + Supabase free/Pro ($25/mo when beta grows) + Anthropic/OpenAI usage (~$0.05–0.15 per Guard session).
