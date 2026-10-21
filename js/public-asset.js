/*
 * Public QR rendering has been retired by the admin-only QR security specification.
 * All QR labels retain the existing ?asset=<uuid> URL.
 * js/app.js handles that URL after a successful administrator login.
 * Do not re-enable anonymous asset queries or anonymous photo uploads here.
 *
 * Server-side enforcement is deployed separately:
 * - revoke public.get_public_asset execution from unauthenticated callers;
 * - retire the unauthenticated public-photo-update function;
 * - make asset-photos a private Storage bucket.
 */
(function(){ 'use strict'; })();
