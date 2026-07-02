-- Paywall kill-switch: purchase CTA hidden until RevenueCat is configured (GOLIVE.md §2b).
-- Flip with: UPDATE app_config SET value = '{"enabled":true}' WHERE key = 'paywall';
INSERT INTO app_config (key, value) VALUES ('paywall', '{"enabled":false}')
ON CONFLICT (key) DO NOTHING;
