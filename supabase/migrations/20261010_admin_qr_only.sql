-- Admin-only business app; public QR remains the field-access path.
-- Applied to production on 2026-10-10.

alter policy asset_history_read_authenticated
  on public.asset_history
  using (private.is_admin());

alter policy assets_read_authenticated
  on public.assets
  using (private.is_admin() and coalesce(is_deleted,false)=false);

alter policy categories_read_authenticated
  on public.categories
  using (private.is_admin());

alter policy departments_read_authenticated
  on public.departments
  using (private.is_admin());

alter policy locations_read_authenticated
  on public.locations
  using (private.is_admin());

alter policy profiles_read_authenticated
  on public.profiles
  using (private.is_admin());

alter policy inventory_checks_read
  on public.inventory_checks
  using (private.is_admin());

alter policy inventory_checks_insert
  on public.inventory_checks
  with check (private.is_admin() and checked_by=auth.uid());

alter policy loans_read_own_or_admin
  on public.loans
  using (private.is_admin());

alter policy loans_request_own
  on public.loans
  with check (private.is_admin());

alter policy asset_photos_select_authenticated
  on storage.objects
  using ((bucket_id='asset-photos'::text) and private.is_admin());

-- Public QR is intentionally unchanged:
-- anon can execute public.get_public_asset(uuid), which returns a limited field set.
-- public-photo-update remains the unauthenticated photo-only update route.
