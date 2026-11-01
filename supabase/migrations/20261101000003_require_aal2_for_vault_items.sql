-- Require an MFA-verified (aal2) session for every direct read or write of
-- vault secrets.
--
-- The admin dashboard lists secure_vault_items straight from PostgREST
-- (SecureVaultDashboard, CommandBuilder), and the secure-vault edge function
-- forwards the caller's JWT so its queries run under RLS too. The existing
-- permissive policies only check ownership and the admin role, so a password
-- alone was enough. A RESTRICTIVE policy is ANDed with all of them.
--
-- service_role bypasses RLS and is unaffected.

DROP POLICY IF EXISTS "Vault items require aal2" ON public.secure_vault_items;

CREATE POLICY "Vault items require aal2"
  ON public.secure_vault_items
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'aal') = 'aal2')
  WITH CHECK ((auth.jwt() ->> 'aal') = 'aal2');
