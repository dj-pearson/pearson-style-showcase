-- Create a default admin user for testing
-- Password: admin123 (hashed with bcrypt)
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
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewNhEBhTcGbLgdC2', -- bcrypt hash of "admin123"
    false,
    0,
    now(),
    now()
) ON CONFLICT (email) DO NOTHING;