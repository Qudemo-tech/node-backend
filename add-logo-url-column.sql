-- Add logo_url column to companies table
ALTER TABLE companies ADD COLUMN logo_url TEXT;

-- Add a comment to describe the column
COMMENT ON COLUMN companies.logo_url IS 'URL of the company logo stored in Supabase Storage';
