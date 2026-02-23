# AdSense & Supabase Setup

## Supabase: AdSense columns (SQL)

**You only need to run SQL if your `unihub_settings` table was created without AdSense columns.**

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Run the contents of `supabase_adsense.sql` once.
3. The app reads both camelCase (`adSenseClientId`) and snake_case (`adsense_client_id`) from the API; the script uses **Option A** (camelCase). If your table already uses snake_case, use **Option B** in the script instead.

No other SQL is required for the app to work; the rest of the schema (nodes, drivers, etc.) is assumed to already exist.

## Connecting AdSense to your site

The site is already wired to your publisher ID in two ways:

1. **In `index.html`**  
   The script is loaded in the `<head>` with your client:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7812709042449387"
       crossorigin="anonymous"></script>
   ```

2. **In Admin → Config**  
   Under **AdSense Configuration** you can set:
   - **Client ID** (e.g. `ca-pub-7812709042449387`)
   - **Slot ID**
   - **Layout Key**
   - **Status** (Active / Inactive)

   These values are stored in Supabase and used for all in-app ad units. The script in `index.html` ensures ads work as soon as the page loads; Admin config allows changing client/slots without editing code.

## Where ads appear (monetization)

- **AI-related**
  - Admin: **Market Pulse (AI)** – below the analysis result.
  - **AI Help / Guide** – banner above the chat input.
  - **Help modal (NexRyde Guide)** – above the “Got it” button.

- **High-traffic / engagement**
  - **Login (Gateway)** – below the login/signup form.
  - **Passenger** – below Community Rides; inline every 3rd ride in the list.
  - **Driver** – at the bottom of the driver dashboard (market/active/broadcast/wallet).
  - **Menu modal** – above Sign Out.
  - **About modal (Portfolio)** – above “Close Portfolio”.
  - **QR modal** – optional; currently no ad there to keep the code scan focus clear.

You can add more `AdBanner` (or `InlineAd`) components anywhere you pass `settings`; keep placement consistent with [AdSense policies](https://support.google.com/adsense/answer/48182).
