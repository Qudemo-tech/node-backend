# Irrelevant Answers Setup

## Database Schema Update Required

To enable irrelevant answers tracking, run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE public_qa_interactions 
ADD COLUMN IF NOT EXISTS is_irrelevant BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS irrelevant_reason TEXT NULL;
```

## Steps:
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the SQL above
4. Click "Run"

## What this adds:
- `is_irrelevant`: Boolean flag to mark answers as irrelevant
- `irrelevant_reason`: Text field to store why the answer was marked as irrelevant

## Features Added:
- **Analytics Page**: Shows irrelevant answers with red highlighting
- **Summary Cards**: Displays count of irrelevant answers
- **Visual Indicators**: Red borders and warning icons for irrelevant answers
- **Reason Display**: Shows why an answer was marked as irrelevant
- **Per-QuDemo Counts**: Shows irrelevant answer counts for each QuDemo

## How to Mark Answers as Irrelevant:
When your Q&A system detects irrelevant answers, update the database:

```sql
UPDATE public_qa_interactions 
SET is_irrelevant = TRUE, 
    irrelevant_reason = 'Answer not related to question topic'
WHERE id = 'your-qa-id';
```

## Analytics Display:
- Irrelevant answers appear with red background
- Warning icon and "Irrelevant Answer Detected" message
- Reason for irrelevance is displayed
- Counted in summary statistics
