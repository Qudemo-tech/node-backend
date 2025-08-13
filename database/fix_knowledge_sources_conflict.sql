-- Fix naming conflict between qudemos.knowledge_sources column and knowledge_sources table
-- The qudemos table has a knowledge_sources ARRAY column that conflicts with our new table

-- Option 1: Remove the conflicting column (recommended)
-- This column appears to be unused and conflicts with our new knowledge_sources table
ALTER TABLE qudemos DROP COLUMN IF EXISTS knowledge_sources;

-- Option 2: Rename the conflicting column (alternative if needed)
-- ALTER TABLE qudemos RENAME COLUMN knowledge_sources TO legacy_knowledge_sources;

-- Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'qudemos' 
AND column_name = 'knowledge_sources';

-- Should return no rows if successfully removed
