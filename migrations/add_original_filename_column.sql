-- Add original_filename column to qudemo_shares table
-- This column will store the original filename uploaded by users for bulk uploads

ALTER TABLE qudemo_shares 
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Add a comment to document the column purpose
COMMENT ON COLUMN qudemo_shares.original_filename IS 'Original filename of the uploaded file for bulk uploads';
