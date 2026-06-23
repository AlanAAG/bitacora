# Bitácora — backend setup (wire env later)

The app code is complete. To run it end-to-end, do the following once.

## 1. Supabase project
1. Create a project in region `sa-east-1` (São Paulo).
2. Dashboard → Database → Extensions: enable `pg_cron` and `pg_net`.
3. Run the migrations in order (SQL editor, or `supabase db push`):
   `001` → `002` → `003` → `004` → `005`.

## 2. Storage buckets
Dashboard → Storage → New bucket:
| Bucket          | Access  | Max size |
|-----------------|---------|----------|
| `car-documents` | private | 50 MB    |
| `ocr-photos`    | private | 20 MB    |
| `guard-audio`   | private | 100 MB   |
| `guard-cards`   | public  | 5 MB     |

`guard-audio` holds raw recordings only transiently — the guard-agent deletes each file right after analysis.

## 3. pg_cron settings (for migration 004)
```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
ALTER DATABASE postgres SET app.service_key  = 'YOUR_SERVICE_ROLE_KEY';
```

## 4. Edge function secrets + deploy
```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy ocr-agent --no-verify-jwt
supabase functions deploy maintenance-agent --no-verify-jwt
supabase functions deploy verification-agent --no-verify-jwt
supabase functions deploy scrape-verification --no-verify-jwt
supabase functions deploy guard-agent --no-verify-jwt
```

## 5. Mobile env
```sh
cp .env.example apps/mobile/.env   # fill in URL + anon key
cd apps/mobile && npx expo start
```

Models used by the edge functions: Claude `claude-opus-4-8` (Guard analysis, OCR vision),
`claude-haiku-4-5` (routing), OpenAI `whisper-1` (transcription, `language: es`).
