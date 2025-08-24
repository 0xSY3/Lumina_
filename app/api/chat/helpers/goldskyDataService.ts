// Goldsky Data Service for HyperEVM Mirror Pipeline Data
// This service connects to the PostgreSQL database created by Goldsky pipeline

import { Pool } from 'pg';

interface EnrichedTransactionV2 {
  id: string;
  hash: string;
  nonce: number;
  block_hash: string;
  block_number: number;
  transaction_index: number;
  from_address: string;
  to_address: string;
  value: string;
  gas: string;
  gas_price: string;
  input: string;
  max_fee_per_gas: string;
  max_priority_fee_per_gas: string;
  transaction_type: number;
  block_timestamp: number;
  receipt_cumulative_gas_used: string;
  receipt_gas_used: string;
  receipt_contract_address: string | null;
  receipt_status: number;
  receipt_effective_gas_price: string;
}

interface RawBlock {
  id: string;
  number: number;
  hash: string;
  parent_hash: string;
  timestamp: number;
  gas_used: number;
  gas_limit: number;
  transaction_count: number;
  miner: string;
  nonce: string;
  sha3_uncles: string;
  logs_bloom: string;
  transactions_root: string;
  state_root: string;
  receipts_root: string;
  difficulty: number;
  total_difficulty: number;
  size: number;
  extra_data: string;
  base_fee_per_gas: number;
  withdrawals_root: string;
}

interface Balance {
  id: string;
  owner_address: string;
  contract_address: string;
  token_id: string | null;
  token_type: string;
  block_number: number;
  block_timestamp: number;
  balance: string;
}

interface RawLog {
  id: string;
  block_number: number;
  block_hash: string;
  transaction_hash: string;
  transaction_index: number;
  log_index: number;
  address: string;
  data: string;
  topics: string;
  block_timestamp: number;
}

interface ERC20Transfer {
  id: string;
  block_number: number;
  block_timestamp: number;
  transaction_hash: string;
  from_address: string;
  to_address: string;
  value: string;
  address: string; // contract address
}

export class GoldskyDataService {
  private pool: Pool;
  
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });
  }
  
  async query(text: string, params: any[] = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getTransactionByHash(hash: string): Promise<EnrichedTransactionV2 | null> {
    try {
      const sql = `
        SELECT 
          id, hash, nonce, block_hash, block_number, transaction_index,
          from_address, to_address, value, gas, gas_price, input,
          max_fee_per_gas, max_priority_fee_per_gas, transaction_type,
          block_timestamp, receipt_cumulative_gas_used, receipt_gas_used,
          receipt_contract_address, receipt_status, receipt_effective_gas_price
        FROM source_1 
        WHERE hash = $1 
        LIMIT 1
      `;
      
      const rows = await this.query(sql, [hash]);
      
      if (rows.length > 0) {
        const tx = rows[0];
        return {
          id: tx.id,
          hash: tx.hash,
          nonce: tx.nonce || 0,
          block_hash: tx.block_hash || '',
          block_number: tx.block_number,
          transaction_index: tx.transaction_index || 0,
          from_address: tx.from_address,
          to_address: tx.to_address,
          value: tx.value?.toString() || '0',
          gas: tx.gas?.toString() || '0',
          gas_price: tx.gas_price?.toString() || '0',
          input: tx.input || '0x',
          max_fee_per_gas: tx.max_fee_per_gas?.toString() || '0',
          max_priority_fee_per_gas: tx.max_priority_fee_per_gas?.toString() || '0',
          transaction_type: tx.transaction_type || 2,
          block_timestamp: tx.block_timestamp,
          receipt_cumulative_gas_used: tx.receipt_cumulative_gas_used?.toString() || '0',
          receipt_gas_used: tx.receipt_gas_used?.toString() || '0',
          receipt_contract_address: tx.receipt_contract_address,
          receipt_status: tx.receipt_status,
          receipt_effective_gas_price: tx.receipt_effective_gas_price?.toString() || '0'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
  }

  async getLatestBlocks(limit: number = 10): Promise<RawBlock[]> {
    try {
      // Get real block data from rawblocks pipeline ONLY
      const sql = `
        SELECT 
          number,
          hash,
          parent_hash,
          timestamp,
          gas_used,
          gas_limit,
          transaction_count,
          miner,
          size,
          base_fee_per_gas,
          difficulty,
          total_difficulty
        FROM raw_1 
        WHERE number IS NOT NULL AND hash IS NOT NULL
        ORDER BY number DESC 
        LIMIT $1
      `;
      
      const rows = await this.query(sql, [limit]);
      console.log(`✅ Retrieved ${rows.length} real blocks from rawblocks pipeline`);
      
      return rows.map((block: any) => ({
        id: block.number?.toString() || '',
        number: block.number || 0,
        hash: block.hash || '',
        parent_hash: block.parent_hash || '',
        timestamp: block.timestamp || 0,
        gas_used: block.gas_used || 0,
        gas_limit: block.gas_limit || 30000000,
        transaction_count: block.transaction_count || 0,
        miner: block.miner || '',
        nonce: '',
        sha3_uncles: '',
        logs_bloom: '',
        transactions_root: '',
        state_root: '',
        receipts_root: '',
        difficulty: block.difficulty || 0,
        total_difficulty: block.total_difficulty || 0,
        size: block.size || 0,
        extra_data: '',
        base_fee_per_gas: block.base_fee_per_gas || 0,
        withdrawals_root: ''
      }));
    } catch (error) {
      console.error('Error fetching blocks from rawblocks pipeline:', error);
      throw error; // Don't fallback, throw error if rawblocks not available
    }
  }

  async getBlockByNumber(blockNumber: string | number): Promise<RawBlock | null> {
    try {
      // Handle "latest" case vs specific block number
      let sql: string;
      let params: any[];
      
      if (blockNumber === "latest") {
        sql = `
          SELECT 
            number,
            hash,
            parent_hash,
            timestamp,
            gas_used,
            gas_limit,
            transaction_count,
            miner,
            size,
            base_fee_per_gas,
            difficulty,
            total_difficulty,
            nonce,
            sha3_uncles,
            logs_bloom,
            transactions_root,
            state_root,
            receipts_root,
            extra_data,
            withdrawals_root
          FROM raw_1 
          ORDER BY number DESC
          LIMIT 1
        `;
        params = [];
      } else {
        sql = `
          SELECT 
            number,
            hash,
            parent_hash,
            timestamp,
            gas_used,
            gas_limit,
            transaction_count,
            miner,
            size,
            base_fee_per_gas,
            difficulty,
            total_difficulty,
            nonce,
            sha3_uncles,
            logs_bloom,
            transactions_root,
            state_root,
            receipts_root,
            extra_data,
            withdrawals_root
          FROM raw_1 
          WHERE number = $1
          LIMIT 1
        `;
        params = [blockNumber];
      }
      
      const rows = await this.query(sql, params);
      
      if (rows.length > 0) {
        const block = rows[0];
        console.log(`✅ Retrieved block ${blockNumber} from rawblocks pipeline`);
        return {
          id: block.number?.toString() || '',
          number: block.number || 0,
          hash: block.hash || '',
          parent_hash: block.parent_hash || '',
          timestamp: block.timestamp || 0,
          gas_used: block.gas_used || 0,
          gas_limit: block.gas_limit || 30000000,
          transaction_count: block.transaction_count || 0,
          miner: block.miner || '',
          nonce: block.nonce || '',
          sha3_uncles: block.sha3_uncles || '',
          logs_bloom: block.logs_bloom || '',
          transactions_root: block.transactions_root || '',
          state_root: block.state_root || '',
          receipts_root: block.receipts_root || '',
          difficulty: block.difficulty || 0,
          total_difficulty: block.total_difficulty || 0,
          size: block.size || 0,
          extra_data: block.extra_data || '',
          base_fee_per_gas: block.base_fee_per_gas || 100000000,
          withdrawals_root: block.withdrawals_root || ''
        };
      }
      
      return null; // No block found - no fallback
    } catch (error) {
      console.error('Error fetching block by number from rawblocks pipeline:', error);
      throw error; // Don't fallback, throw error if rawblocks not available
    }
  }

  async getRecentTransactions(limit: number = 20): Promise<EnrichedTransactionV2[]> {
    try {
      const sql = `
        SELECT 
          id, hash, nonce, block_hash, block_number, transaction_index,
          from_address, to_address, value, gas, gas_price, input,
          max_fee_per_gas, max_priority_fee_per_gas, transaction_type,
          block_timestamp, receipt_cumulative_gas_used, receipt_gas_used,
          receipt_contract_address, receipt_status, receipt_effective_gas_price
        FROM source_1 
        ORDER BY block_number DESC 
        LIMIT $1
      `;
      
      const rows = await this.query(sql, [limit]);
      
      return rows.map((tx: any) => ({
        id: tx.id,
        hash: tx.hash,
        nonce: tx.nonce || 0,
        block_hash: tx.block_hash || '',
        block_number: tx.block_number,
        transaction_index: tx.transaction_index || 0,
        from_address: tx.from_address,
        to_address: tx.to_address,
        value: tx.value?.toString() || '0',
        gas: tx.gas?.toString() || '0',
        gas_price: tx.gas_price?.toString() || '0',
        input: tx.input || '0x',
        max_fee_per_gas: tx.max_fee_per_gas?.toString() || '0',
        max_priority_fee_per_gas: tx.max_priority_fee_per_gas?.toString() || '0',
        transaction_type: tx.transaction_type || 2,
        block_timestamp: tx.block_timestamp,
        receipt_cumulative_gas_used: tx.receipt_cumulative_gas_used?.toString() || '0',
        receipt_gas_used: tx.receipt_gas_used?.toString() || '0',
        receipt_contract_address: tx.receipt_contract_address,
        receipt_status: tx.receipt_status,
        receipt_effective_gas_price: tx.receipt_effective_gas_price?.toString() || '0'
      }));
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      return [];
    }
  }

  // Advanced analytics using source_1 data
  async getTransactionAnalytics(limit: number = 100) {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN receipt_status = 1 THEN 1 END) as successful_transactions,
          COUNT(CASE WHEN receipt_status = 0 THEN 1 END) as failed_transactions,
          AVG(CAST(receipt_gas_used AS NUMERIC)) as avg_gas_used,
          SUM(CAST(value AS NUMERIC)) as total_value_transferred,
          COUNT(DISTINCT from_address) as unique_senders,
          COUNT(DISTINCT to_address) as unique_receivers,
          MAX(block_number) as latest_block,
          MIN(block_number) as earliest_block_in_range
        FROM source_1 
        ORDER BY block_number DESC 
        LIMIT $1
      `;
      
      const rows = await this.query(sql, [limit]);
      const analytics = rows[0];
      
      console.log(`📊 Transaction Analytics: ${analytics.total_transactions} total, ${analytics.successful_transactions} successful`);
      
      return {
        totalTransactions: parseInt(analytics.total_transactions || '0'),
        successfulTransactions: parseInt(analytics.successful_transactions || '0'),
        failedTransactions: parseInt(analytics.failed_transactions || '0'),
        successRate: analytics.total_transactions > 0 ? 
          (analytics.successful_transactions / analytics.total_transactions * 100).toFixed(2) + '%' : '0%',
        avgGasUsed: parseFloat(analytics.avg_gas_used || '0').toFixed(0),
        totalValueTransferred: analytics.total_value_transferred?.toString() || '0',
        uniqueSenders: parseInt(analytics.unique_senders || '0'),
        uniqueReceivers: parseInt(analytics.unique_receivers || '0'),
        latestBlock: parseInt(analytics.latest_block || '0'),
        blockRange: `${analytics.earliest_block_in_range} - ${analytics.latest_block}`
      };
    } catch (error) {
      console.error('Error fetching transaction analytics:', error);
      return null;
    }
  }

  // Get top addresses by transaction volume
  async getTopAddresses(limit: number = 10) {
    try {
      const sql = `
        WITH address_activity AS (
          SELECT 
            from_address as address,
            'sender' as role,
            COUNT(*) as tx_count,
            SUM(CAST(value AS NUMERIC)) as total_value,
            AVG(CAST(receipt_gas_used AS NUMERIC)) as avg_gas
          FROM source_1 
          WHERE from_address IS NOT NULL
          GROUP BY from_address
          
          UNION ALL
          
          SELECT 
            to_address as address,
            'receiver' as role,
            COUNT(*) as tx_count,
            SUM(CAST(value AS NUMERIC)) as total_value,
            AVG(CAST(receipt_gas_used AS NUMERIC)) as avg_gas
          FROM source_1 
          WHERE to_address IS NOT NULL
          GROUP BY to_address
        )
        SELECT 
          address,
          SUM(tx_count) as total_transactions,
          SUM(total_value) as total_value_involved,
          AVG(avg_gas) as avg_gas_per_tx
        FROM address_activity 
        GROUP BY address
        ORDER BY total_transactions DESC
        LIMIT $1
      `;
      
      const rows = await this.query(sql, [limit]);
      
      console.log(`🏆 Retrieved top ${rows.length} most active addresses`);
      
      return rows.map((addr: any) => ({
        address: addr.address,
        totalTransactions: parseInt(addr.total_transactions || '0'),
        totalValueInvolved: addr.total_value_involved?.toString() || '0',
        avgGasPerTransaction: parseFloat(addr.avg_gas_per_tx || '0').toFixed(0),
        shortAddress: addr.address ? `${addr.address.slice(0, 6)}...${addr.address.slice(-4)}` : ''
      }));
    } catch (error) {
      console.error('Error fetching top addresses:', error);
      return [];
    }
  }

  // Get comprehensive network overview
  async getNetworkOverview() {
    try {
      const [blocks, transactions, analytics, topAddresses] = await Promise.all([
        this.getLatestBlocks(5),
        this.getRecentTransactions(10),
        this.getTransactionAnalytics(1000),
        this.getTopAddresses(5)
      ]);

      const latestBlock = blocks[0];
      
      console.log(`🌐 Network Overview: Block ${latestBlock?.number || 0}, ${transactions.length} recent transactions`);

      return {
        latestBlock: latestBlock?.number || 0,
        recentBlocks: blocks,
        recentTransactions: transactions,
        analytics,
        topAddresses,
        networkHealth: {
          isActive: transactions.length > 0,
          recentActivity: transactions.length,
          blockProgress: blocks.length > 1 ? blocks[0].number - blocks[1].number : 0
        }
      };
    } catch (error) {
      console.error('Error fetching network overview:', error);
      return null;
    }
  }

  async getAddressTransactions(address: string, limit: number = 10): Promise<EnrichedTransactionV2[]> {
    try {
      const sql = `
        SELECT 
          id, hash, nonce, block_hash, block_number, transaction_index,
          from_address, to_address, value, gas, gas_price, input,
          max_fee_per_gas, max_priority_fee_per_gas, transaction_type,
          block_timestamp, receipt_cumulative_gas_used, receipt_gas_used,
          receipt_contract_address, receipt_status, receipt_effective_gas_price
        FROM source_1 
        WHERE LOWER(from_address) = LOWER($1) OR LOWER(to_address) = LOWER($1)
        ORDER BY block_number DESC 
        LIMIT $2
      `;
      
      const rows = await this.query(sql, [address, limit]);
      
      return rows.map((tx: any) => ({
        id: tx.id,
        hash: tx.hash,
        nonce: tx.nonce || 0,
        block_hash: tx.block_hash || '',
        block_number: tx.block_number,
        transaction_index: tx.transaction_index || 0,
        from_address: tx.from_address,
        to_address: tx.to_address,
        value: tx.value?.toString() || '0',
        gas: tx.gas?.toString() || '0',
        gas_price: tx.gas_price?.toString() || '0',
        input: tx.input || '0x',
        max_fee_per_gas: tx.max_fee_per_gas?.toString() || '0',
        max_priority_fee_per_gas: tx.max_priority_fee_per_gas?.toString() || '0',
        transaction_type: tx.transaction_type || 2,
        block_timestamp: tx.block_timestamp,
        receipt_cumulative_gas_used: tx.receipt_cumulative_gas_used?.toString() || '0',
        receipt_gas_used: tx.receipt_gas_used?.toString() || '0',
        receipt_contract_address: tx.receipt_contract_address,
        receipt_status: tx.receipt_status,
        receipt_effective_gas_price: tx.receipt_effective_gas_price?.toString() || '0'
      }));
    } catch (error) {
      console.error('Error fetching address transactions:', error);
      return [];
    }
  }

  // Helper method to close the connection pool
  async close() {
    await this.pool.end();
  }
  
  // Analyze transaction patterns for an address
  async getAddressAnalytics(address: string) {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN from_address = $1 THEN 1 END) as sent_transactions,
          COUNT(CASE WHEN to_address = $1 THEN 1 END) as received_transactions,
          SUM(CASE WHEN from_address = $1 THEN CAST(value AS NUMERIC) ELSE 0 END) as total_sent_value,
          SUM(CASE WHEN to_address = $1 THEN CAST(value AS NUMERIC) ELSE 0 END) as total_received_value,
          AVG(CAST(receipt_gas_used AS NUMERIC)) as avg_gas_used,
          COUNT(CASE WHEN receipt_status = 0 THEN 1 END) as failed_transactions,
          MAX(block_timestamp) as last_activity,
          COUNT(DISTINCT CASE WHEN from_address = $1 THEN to_address END) as unique_recipients,
          COUNT(DISTINCT CASE WHEN to_address = $1 THEN from_address END) as unique_senders
        FROM source_1 
        WHERE LOWER(from_address) = LOWER($1) OR LOWER(to_address) = LOWER($1)
      `;
      
      const rows = await this.query(sql, [address]);
      const analytics = rows[0];
      
      console.log(`📊 Address Analytics for ${address.slice(0, 8)}...: ${analytics.total_transactions} transactions`);
      
      return {
        address,
        totalTransactions: parseInt(analytics.total_transactions || '0'),
        sentTransactions: parseInt(analytics.sent_transactions || '0'),
        receivedTransactions: parseInt(analytics.received_transactions || '0'),
        totalSentValue: analytics.total_sent_value?.toString() || '0',
        totalReceivedValue: analytics.total_received_value?.toString() || '0',
        netValue: (parseFloat(analytics.total_received_value || '0') - parseFloat(analytics.total_sent_value || '0')).toString(),
        avgGasUsed: parseFloat(analytics.avg_gas_used || '0').toFixed(0),
        failedTransactions: parseInt(analytics.failed_transactions || '0'),
        successRate: analytics.total_transactions > 0 ? 
          ((parseInt(analytics.total_transactions) - parseInt(analytics.failed_transactions || '0')) / parseInt(analytics.total_transactions) * 100).toFixed(2) + '%' : '0%',
        lastActivity: analytics.last_activity,
        uniqueCounterparties: parseInt(analytics.unique_recipients || '0') + parseInt(analytics.unique_senders || '0'),
        activityType: parseInt(analytics.sent_transactions || '0') > parseInt(analytics.received_transactions || '0') ? 'sender' : 'receiver'
      };
    } catch (error) {
      console.error('Error fetching address analytics:', error);
      return null;
    }
  }

  // Get all available tables
  async getAvailableTables(): Promise<string[]> {
    try {
      const sql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      
      const rows = await this.query(sql);
      return rows.map(row => row.table_name);
    } catch (error) {
      console.error('Error fetching available tables:', error);
      return [];
    }
  }

  // Get table schema information for debugging
  async getTableSchema(tableName: string) {
    try {
      const sql = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `;
      return await this.query(sql, [tableName]);
    } catch (error) {
      console.error('Error fetching table schema:', error);
      return [];
    }
  }
}