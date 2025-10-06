-- Add operation_type column to qudemo_shares table
-- This column will differentiate between "few_links" and "bulk_upload" operations

ALTER TABLE qudemo_shares 
ADD COLUMN operation_type VARCHAR(20) DEFAULT 'unknown';

-- Update existing records to have a default operation type
-- Since we can't determine the original operation type, we'll mark them as 'unknown'
UPDATE qudemo_shares 
SET operation_type = 'unknown' 
WHERE operation_type IS NULL;

-- Add a comment to explain the column
COMMENT ON COLUMN qudemo_shares.operation_type IS 'Type of bulk share operation: few_links (≤5 customers), bulk_upload (>5 customers), or unknown (legacy records)';

-- Create an index for better query performance
CREATE INDEX idx_qudemo_shares_operation_type ON qudemo_shares(operation_type);
