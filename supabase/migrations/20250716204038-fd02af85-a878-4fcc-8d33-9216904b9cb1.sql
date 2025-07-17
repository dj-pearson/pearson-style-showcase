-- Create a test admin user with proper password hash
-- Password will be "admin123"
INSERT INTO admin_users (
    email, 
    username, 
    password_hash, 
    two_factor_enabled, 
    failed_login_attempts, 
    created_at, 
    updated_at
) VALUES (
    'admin@example.com',
    'testadmin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewNhEBhTcGbLgdC2', -- bcrypt hash of "admin123"
    false,
    0,
    now(),
    now()
) ON CONFLICT (email) DO UPDATE SET
    username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    updated_at = now();