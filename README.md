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

## Command line and MCP tool (no browser needed)

Both live in `tools/` and talk to the same Supabase project as the app, signed in as you, so the
row-level security rules still apply. They share one code path (`tools/core.mjs`).

Setup: add your app login to `.env` (never commit it):

```
ORDERDESK_EMAIL=you@example.com
ORDERDESK_PASSWORD=...
```

**Command line** (`npm run order -- help` lists everything):

```bash
npm run order -- new "Hi it's Maria 242-555-0100, need 12 church shirts by Friday, $240" --deposit 100
npm run order -- add --customer Maria --title "12 church shirts" --qty 12 --price 240 --due 2026-11-20
npm run order -- list --unpaid
npm run order -- status 1042 printing
npm run order -- pay 1042 100 --method cash     # no amount = pay the full balance
npm run order -- update 1042 --due 2026-11-25
```

`new` reads free text through the deployed `parse-order` function (no Anthropic key needed locally),
shows the draft and asks before saving.

**MCP tool** so Claude can update the desk straight from chat. `.mcp.json` registers it for Claude Code
in this folder; elsewhere run `claude mcp add orderdesk -- node /full/path/to/orderdesk/tools/mcp-server.mjs`.
Tools: `list_orders`, `get_order`, `create_order`, `update_order`, `set_status`, `add_payment`, `parse_order_text`.
Then just say: "Maria ordered 12 church shirts, $240, due Friday, paid $100 cash."
