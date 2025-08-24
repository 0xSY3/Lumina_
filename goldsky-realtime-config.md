# Goldsky Realtime AI Explorer Configuration

## Pipeline Configuration

### 1. Start Block (MOST IMPORTANT)
- **Start Block**: Current block number (latest - 1000)
- **Why**: Realtime explorer needs recent data, not historical
- **Current Hyperliquid block**: ~21,067,000
- **Set start block**: 21,066,000 (last 1000 blocks)

### 2. Pipeline Priority
**Keep ONLY these pipelines active:**
- ✅ `hyperevm-enriched-transactions` (PRIORITY 1)
- ❌ Disable `rawlogs` (not needed for AI analysis)  
- ❌ Disable `rawblocks` (transactions contain block info)
- ❌ Disable `balances` (can be calculated from transactions)

### 3. Database Optimization
**Connection Settings:**
- Max connections: 10-20 (not 50+ which overloads)
- Connection timeout: 30 seconds
- Query timeout: 60 seconds
- Idle timeout: 5 minutes

### 4. Indexing Strategy
**Tables to index:**
```sql
-- Run these in PostgreSQL console
CREATE INDEX CONCURRENTLY idx_source_1_block_number_desc ON source_1 (block_number DESC);
CREATE INDEX CONCURRENTLY idx_source_1_timestamp_desc ON source_1 (block_timestamp DESC);  
CREATE INDEX CONCURRENTLY idx_source_1_hash ON source_1 (hash);
CREATE INDEX CONCURRENTLY idx_source_1_status ON source_1 (receipt_status);

-- For AI analysis queries
CREATE INDEX CONCURRENTLY idx_source_1_value ON source_1 (value DESC) WHERE value > 0;
CREATE INDEX CONCURRENTLY idx_source_1_from_to ON source_1 (from_address, to_address);
```

### 5. Pipeline Filters (if available)
**Filter criteria:**
- Minimum value: > 1000000 (> 1 USDC)
- Successful transactions: receipt_status = 1
- Recent blocks: block_number > (latest - 10000)

## Expected Performance After Optimization
- **Query time**: 2-10 seconds (vs current 5-7 minutes)
- **Data freshness**: 1-2 minutes behind chain
- **Analysis speed**: Real-time transaction insights
- **Database load**: 80% reduction

## Monitoring
- Watch for block lag < 100 blocks behind latest
- Query response time < 30 seconds
- Database CPU < 70%
- Connection pool utilization < 80%