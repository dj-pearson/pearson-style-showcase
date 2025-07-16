-- Create admin user with your actual email
INSERT INTO admin_users (
    email, 
    username, 
    password_hash, 
    two_factor_enabled, 
    failed_login_attempts, 
    created_at, 
    updated_at
) VALUES (
    'dan@danpearson.net',
    'danpearson',
    'admin123_hash', -- Simple placeholder since we're doing direct password comparison now
    false,
    0,
    now(),
    now()
) ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    updated_at = now();