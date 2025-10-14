-- Grant admin role to the specified user so admin-auth `me` passes
-- Safe upsert: will not duplicate if role already exists
INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT u.id, 'admin'::app_role, NULL
FROM auth.users u
WHERE u.email = 'dan@danpearson.net'
ON CONFLICT (user_id, role) DO NOTHING;