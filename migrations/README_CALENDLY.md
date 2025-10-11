# Calendly Link Feature - Database Migration

## Overview
This migration adds support for storing Calendly scheduling links with each QuDemo.

## What It Does
- Adds `calendly_link` column to `qudemos_new` table
- Column type: TEXT (can store any Calendly URL)
- Column is nullable (optional field)

## How to Run

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard (https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Copy the contents of `add_calendly_link.sql`
5. Paste and run the SQL

### Option 2: Using psql CLI
```bash
psql -U postgres -d your_database_name -f add_calendly_link.sql
```

### Option 3: Using Supabase CLI
```bash
supabase db push
```

## Verification
After running the migration, verify it worked:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'qudemos_new' 
AND column_name = 'calendly_link';
```

Expected result:
- column_name: calendly_link
- data_type: text
- is_nullable: YES

## Testing
1. Create a new QuDemo with a Calendly link
2. Check the database to confirm the link is stored
3. Open the QuDemo chat - the "Schedule Meeting" button should appear

## Rollback (if needed)
```sql
ALTER TABLE qudemos_new DROP COLUMN IF EXISTS calendly_link;
```

