# OrderDesk

Order tracker for a custom-shirt print shop. Vite + React + Supabase, installable PWA.

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the migration**: open SQL Editor, paste `supabase/migrations/001_init.sql`, run. (Or `supabase db push` with the CLI.)
3. **Auth** (email + password, no sign-up in the app): Authentication > Providers > Email on. Authentication > Users > Add user > Create new user, enter your email and a password, tick "Auto Confirm User". Then turn off "Allow new users to sign up" so nobody else can register.
4. **Edge function** (needs the Supabase CLI, `npx supabase login`, `npx supabase link --project-ref <ref>`):
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   npx supabase functions deploy parse-order
   ```
5. **Env vars**: copy `.env.example` to `.env`, fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings > API).
6. **Run locally**:
   ```bash
   npm install
   npm run dev
   ```
7. **Deploy to Vercel**: import the repo, framework Vite, add the two `VITE_` env vars, deploy. Add a rewrite of all paths to `/index.html` if deep links 404 (`vercel.json` below).
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
8. **Install on iPhone**: open the site in Safari > Share > Add to Home Screen.

The Anthropic key lives only in Supabase function secrets. Never put it in `.env`.
Replace `public/icons/icon-192.png` and `icon-512.png` (solid placeholders) with real artwork.
