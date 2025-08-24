-- Add indexes to the new clean source_1 table for much faster queries
-- Run this in your PostgreSQL console at Goldsky

-- 1. Primary index on block_number for ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_1_block_number_desc ON source_1 (block_number DESC);

-- 2. Index on hash for transaction lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_1_hash ON source_1 (hash);

-- 3. Compound index for WHERE clauses
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_1_clean_data ON source_1 (block_number DESC, hash) WHERE block_number IS NOT NULL AND hash IS NOT NULL;

-- 4. Index on timestamp for time-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_1_timestamp ON source_1 (block_timestamp DESC) WHERE block_timestamp IS NOT NULL;

-- 5. Indexes for address searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_1_from_address ON source_1 (from_address);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_1_to_address ON source_1 (to_address);

-- Check table statistics
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'source_1' 
ORDER BY tablename, attname;