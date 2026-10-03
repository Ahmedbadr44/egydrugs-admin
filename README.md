# EgyDrugs Admin

A standalone browser interface for searching, adding, editing, and deleting drug records in Supabase. It uses Supabase Auth and relies on database Row Level Security for write authorization.

## Publish with GitHub Pages

The `Publish admin panel` workflow publishes the repository root when changes are pushed to `main`.

For the first deployment, open **Settings > Pages** and set **Build and deployment > Source** to **GitHub Actions**. Then rerun the failed **Publish admin panel** workflow from the **Actions** tab. Later pushes to `main` deploy automatically.

The expected site address is `https://ahmedbadr44.github.io/egydrugs-admin/`.

## Connect Supabase

1. In the main EgyDrugs project, run `supabase/migrations/20261003_enable_browser_admin.sql` in the Supabase SQL Editor.
2. Create an administrator account in **Authentication > Users**.
3. Add that user's UUID to `public.drug_admins`:

   ```sql
   insert into public.drug_admins (user_id)
   values ('AUTH_USER_UUID');
   ```

4. Sign in to the published site with that account.

The project URL and publishable key in `app.js` are public client configuration. Never put a Supabase `service_role` or `sb_secret` key in this site; RLS must remain enabled and enforced by Supabase.
