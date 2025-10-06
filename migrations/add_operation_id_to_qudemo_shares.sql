-- Add operation_id column to qudemo_shares table
-- This column will uniquely identify each bulk share operation to prevent grouping

ALTER TABLE qudemo_shares 
ADD COLUMN operation_id VARCHAR(50);

-- Add a comment to explain the column
COMMENT ON COLUMN qudemo_shares.operation_id IS 'Unique identifier for each bulk share operation to separate individual operations';

-- Create an index for better query performance
CREATE INDEX idx_qudemo_shares_operation_id ON qudemo_shares(operation_id);
