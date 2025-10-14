-- Fix admin_sessions RLS policy to allow edge function to manage sessions
DROP POLICY IF EXISTS "System can manage admin sessions" ON admin_sessions;

-- Allow the edge function (using service role) to manage sessions
CREATE POLICY "Service role can manage admin sessions"
ON admin_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read their own sessions
CREATE POLICY "Users can read own sessions"
ON admin_sessions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());