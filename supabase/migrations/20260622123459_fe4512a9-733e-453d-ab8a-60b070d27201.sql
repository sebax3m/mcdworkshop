
-- Harden role-check helpers: keep only private.is_staff / private.has_role,
-- make them explicit about which roles count, and update storage policies
-- that referenced the public-schema copies.

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'technician'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Restrict EXECUTE on the private helpers to authenticated only
-- (private schema is not exposed via the Data API, so this is not callable over REST).
REVOKE ALL ON FUNCTION private.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

-- Recreate storage policies to use the private helpers explicitly.
DROP POLICY IF EXISTS "staff read workshop photos" ON storage.objects;
DROP POLICY IF EXISTS "staff upload workshop photos" ON storage.objects;
DROP POLICY IF EXISTS "staff update workshop photos" ON storage.objects;
DROP POLICY IF EXISTS "staff delete workshop photos" ON storage.objects;

CREATE POLICY "staff read workshop photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'workshop-photos' AND private.is_staff(auth.uid()));

CREATE POLICY "staff upload workshop photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workshop-photos' AND private.is_staff(auth.uid()));

CREATE POLICY "staff update workshop photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'workshop-photos' AND private.is_staff(auth.uid()));

CREATE POLICY "staff delete workshop photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'workshop-photos' AND private.is_staff(auth.uid()));

-- Drop the duplicate public-schema copies so they can no longer be invoked
-- via PostgREST/RPC by anon or authenticated users.
DROP FUNCTION IF EXISTS public.is_staff(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
