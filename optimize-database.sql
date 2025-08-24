-- Goldsky Database Optimization Script
-- Run this in your PostgreSQL database console

-- 1. Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_source_1_block_number ON source_1 (block_number DESC);
CREATE INDEX IF NOT EXISTS idx_source_1_hash ON source_1 (hash);
CREATE INDEX IF NOT EXISTS idx_source_1_from_address ON source_1 (from_address);
CREATE INDEX IF NOT EXISTS idx_source_1_to_address ON source_1 (to_address);
CREATE INDEX IF NOT EXISTS idx_source_1_receipt_status ON source_1 (receipt_status);

-- 2. Create a materialized view for faster dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS quick_stats AS
SELECT 
    MAX(block_number) as latest_block,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN receipt_status = 1 THEN 1 END) as successful_transactions,
    COUNT(DISTINCT from_address) as unique_senders,
    AVG(CAST(receipt_gas_used AS NUMERIC)) as avg_gas_used
FROM source_1
WHERE block_number > (SELECT MAX(block_number) - 1000 FROM source_1);

-- 3. Refresh the materialized view (run this periodically)
REFRESH MATERIALIZED VIEW quick_stats;