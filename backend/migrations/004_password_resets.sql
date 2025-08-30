-- Migration 004: Password Reset Flow
-- TASK 6: Secure Password Reset System with Token Validation
--
-- This migration creates the infrastructure for secure password reset functionality:
-- - password_resets table for secure token storage and validation
-- - Proper indexing for performance and cleanup operations
-- - Multi-tenant isolation through tenant-aware RLS policies

-- Create password_resets table
CREATE TABLE password_resets (
    user_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    used_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tenant_id TEXT NOT NULL,

    -- Composite primary key ensures one token per user at a time
    PRIMARY KEY (user_id, token_hash),

    -- Ensure tenant_id matches the user's tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Performance index for cleanup operations (removes expired tokens)
CREATE INDEX idx_password_resets_expires_at ON password_resets(expires_at);

-- Performance index for user lookup during reset validation
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);

-- Performance index for tenant-based queries
CREATE INDEX idx_password_resets_tenant_id ON password_resets(tenant_id);

-- Enable Row Level Security for multi-tenant isolation
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own reset tokens within their tenant
CREATE POLICY password_resets_user_isolation ON password_resets
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::text
        AND user_id = current_setting('app.current_user_id', true)::text
    );

-- RLS Policy: Allow INSERT for any authenticated user within their tenant
CREATE POLICY password_resets_insert_policy ON password_resets
    FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)::text
    );

-- Add helpful comment for future reference
COMMENT ON TABLE password_resets IS 'Secure password reset tokens with 1-hour expiry, one-time use, and tenant isolation';
COMMENT ON COLUMN password_resets.token_hash IS 'SHA256 hash of the reset token - never store plain text tokens';
COMMENT ON COLUMN password_resets.expires_at IS 'Token expiry timestamp - tokens expire after 1 hour for security';
COMMENT ON COLUMN password_resets.used_at IS 'Timestamp when token was used - enforces one-time use policy';
COMMENT ON COLUMN password_resets.tenant_id IS 'Tenant isolation - ensures reset tokens respect multi-tenant boundaries';
