-- Paywall kill-switch for store review / beta: trial CTA hidden until enabled.
-- Flip with: UPDATE app_config SET value = '{"enabled":true}' WHERE key = 'paywall';
INSERT INTO app_config (key, value) VALUES ('paywall', '{"enabled":false}')
ON CONFLICT (key) DO NOTHING;
