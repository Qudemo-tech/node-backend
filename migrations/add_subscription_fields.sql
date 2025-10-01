-- Migration: Add subscription fields to companies table
-- Date: 2025-10-01
-- Purpose: Enable Lemon Squeezy subscription management

-- Add subscription fields to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20),
ADD COLUMN IF NOT EXISTS payment_method_last4 VARCHAR(4),
ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id VARCHAR(100);

-- Add sharing fields to qudemos_new table
ALTER TABLE qudemos_new 
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_link VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS share_created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS share_views_count INTEGER DEFAULT 0;

-- Create index for faster subscription lookups
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_plan ON companies(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_companies_lemonsqueezy_customer_id ON companies(lemonsqueezy_customer_id);
CREATE INDEX IF NOT EXISTS idx_qudemos_share_link ON qudemos_new(share_link);

-- Add comments to columns for documentation
COMMENT ON COLUMN companies.subscription_plan IS 'Subscription plan: free, pro, enterprise';
COMMENT ON COLUMN companies.subscription_status IS 'Subscription status: active, cancelled, expired, trial, past_due';
COMMENT ON COLUMN companies.subscription_id IS 'Lemon Squeezy subscription ID';
COMMENT ON COLUMN companies.lemonsqueezy_customer_id IS 'Lemon Squeezy customer ID';
COMMENT ON COLUMN qudemos_new.share_link IS 'Public share link for the QuDemo';
COMMENT ON COLUMN qudemos_new.is_shared IS 'Whether the QuDemo has been shared publicly';

