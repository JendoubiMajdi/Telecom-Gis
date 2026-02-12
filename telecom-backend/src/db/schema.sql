-- Add columns for 2FA, email verification, and password reset
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_otp_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP;

-- Create OTP table for storing OTP codes
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT FALSE
);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT FALSE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, expires_at, used);
CREATE INDEX IF NOT EXISTS idx_otp_code ON otp_codes(otp_code, email, expires_at);
CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token, expires_at, used);
CREATE INDEX IF NOT EXISTS idx_reset_email ON password_reset_tokens(email, expires_at, used);

-- Optional: Create a function to clean expired tokens (can be called periodically)
CREATE OR REPLACE FUNCTION clean_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;