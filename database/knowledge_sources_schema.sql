-- Knowledge Sources Table Schema
-- This table stores metadata about processed knowledge sources (websites, documents)
-- The actual data is stored in Pinecone as vectors

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('website', 'document', 'video')),
    source_url TEXT, -- NULL for documents
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed', 'deleted')),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_company_name ON knowledge_sources(company_name);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_source_type ON knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status ON knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_created_at ON knowledge_sources(created_at);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_company_status ON knowledge_sources(company_name, status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_knowledge_sources_updated_at
    BEFORE UPDATE ON knowledge_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_sources_updated_at();

-- Comments for documentation
COMMENT ON TABLE knowledge_sources IS 'Stores metadata about processed knowledge sources (websites, documents, videos)';
COMMENT ON COLUMN knowledge_sources.id IS 'Unique identifier for the knowledge source';
COMMENT ON COLUMN knowledge_sources.company_name IS 'Company name (lowercase) for organization';
COMMENT ON COLUMN knowledge_sources.source_type IS 'Type of knowledge source: website, document, or video';
COMMENT ON COLUMN knowledge_sources.source_url IS 'URL of the source (NULL for documents)';
COMMENT ON COLUMN knowledge_sources.title IS 'Display title for the knowledge source';
COMMENT ON COLUMN knowledge_sources.description IS 'Description of the knowledge source';
COMMENT ON COLUMN knowledge_sources.status IS 'Processing status: processing, processed, failed, or deleted';
COMMENT ON COLUMN knowledge_sources.processed_at IS 'Timestamp when processing completed';
COMMENT ON COLUMN knowledge_sources.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN knowledge_sources.updated_at IS 'Timestamp when record was last updated';
