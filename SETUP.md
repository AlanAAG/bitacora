# Bitácora — backend setup (production-hardened)

App code is complete and hardened. To run end-to-end, do the following once.

## 1. Supabase project
1. Create a project in region `sa-east-1` (São Paulo).
2. Database → Extensions: `pg_cron`, `pg_net`, and `supabase_vault` are enabled by the migrations / are on by default.
3. Run migrations in order: `001` → `002` → `003` → `004` → `005` → `006` (`supabase db push`).
   - If your runner rejects the `ALTER TYPE ... ADD VALUE` lines at the top of `006` inside a transaction, run those three lines on their own first, then the rest of `006`.

## 2. Storage buckets
Dashboard → Storage → New bucket (RLS policies are already created by migration `006`):
| Bucket          | Access  | Max size |
|-----------------|---------|----------|
| `car-documents` | private | 50 MB    |
| `ocr-photos`    | private | 20 MB    |
| `guard-audio`   | private | 100 MB   |
| `guard-cards`   | public  | 5 MB     |

`guard-audio` is purged every 15 min by the `purge-audio` cron; the guard-agent also deletes each file right after analysis.

## 3. Vault secrets (used by the cron jobs in `004`)
Dashboard → Project Settings → Vault → New secret:
- `project_url` = `https://YOUR_PROJECT.supabase.co`
- `cron_secret` = a long random string (generate with `openssl rand -hex 32`)

The service-role key is **not** stored anywhere readable (no GUC) — the cron functions are gated by `cron_secret`, not by the service key.

## 4. Edge-function secrets
```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set CRON_SECRET=<same value as the vault cron_secret>
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

## 5. Deploy functions — auth model matters
**User-facing (JWT verified — do NOT pass `--no-verify-jwt`):**
```sh
supabase functions deploy guard-agent
supabase functions deploy ocr-agent
supabase functions deploy start-trial
supabase functions deploy delete-account
```
**Cron/internal (gated by the `x-cron-secret` header):**
```sh
supabase functions deploy maintenance-agent   --no-verify-jwt
supabase functions deploy verification-agent  --no-verify-jwt
supabase functions deploy scrape-verification --no-verify-jwt
supabase functions deploy daily-circulation   --no-verify-jwt
supabase functions deploy purge-audio         --no-verify-jwt
```

## 6. Mobile env
```sh
cp .env.example apps/mobile/.env   # fill in URL + anon key
cd apps/mobile && npx expo start
```

## Notes
- Models: Claude `claude-opus-4-8` (Guard analysis, OCR vision), `claude-haiku-4-5` (SEDEMA scrape), OpenAI `whisper-1` (transcription, `language: es`).
- **CDMX data to confirm before launch** (`app_config` table holds the tunable values): the 2026 verificación day ranges + UMA-pegged costs/fines, the refrendo amount/deadline (the 2026 subsidy deadline was extended mid-year), and the `contingencia.phase` flag (set to `1`/`2` manually during a contingencia ambiental).
- The aviso de privacidad text in `app/legal/privacy.tsx` is a working draft — have it reviewed by counsel before launch.
