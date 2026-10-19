# Stay at UniLeisure

Responsive accommodation and tourism website for CLANDSTEIN Houseboat on Lake Kariba and Coates Cottage in Nyanga.

## Run locally

1. Install Node.js 20 or newer and run `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and public anon/publishable key.
3. Run `npm run dev`.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL Editor. It creates the availability and blocked-date tables, adds the booking-request insert policy, and restricts booking reads and date-block management to the approved admin emails.

Create or update Supabase Auth users for `tawananyashabukuta8@gmail.com` and `stay@unileisure.co.zw` with the agreed admin password. Sign-in persists in the browser, so an admin remains signed in across reloads until they explicitly sign out or the Supabase session expires.

Set `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, and optionally `VITE_OWNER_WHATSAPP` in Vercel's project environment variables. The Vite config explicitly exposes `PUBLIC_` variables to the client bundle; only use the public anon/publishable key here, never a Supabase service-role key.

The booking form saves directly to `public.bookings` and the admin dashboard reads bookings from the same table. Availability enquiries and booking submissions check blocked dates, availability blocks, and overlapping non-cancelled bookings; if an availability check cannot be completed, WhatsApp enquiries still open. There is no online payment processing.

## Deploy to Vercel

Import the repository in Vercel with the Vite defaults: build command `npm run build`, output directory `dist`, and no serverless API routes required. Add the Supabase and WhatsApp environment variables in Project Settings → Environment Variables, then redeploy.

The admin page is available at `/admin` and at the private path configured by `ADMIN_PATH` in `src/App.jsx`. Both require an authorized Supabase Auth login.
