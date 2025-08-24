import { Pool, PoolClient } from 'pg';

export interface BlockTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: boolean;
  isContractCall: boolean;
}

export interface BlockData {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas: string;
  miner: string;
  size: number;
  transactionCount: number;
  
  metrics: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    avgGasPrice: number;
    totalValue: string;
    uniqueAddresses: number;
    contractInteractions: number;
    latestBlockNumber: number;
    blockConfirmations: number;
    networkUtilization: number;
  };
  
  transactions: BlockTransaction[];
  
  patterns: {
    dexActivity: boolean;
    highValueTransfers: number;
    failureRate: number;
    gasSpikes: boolean;
    mevActivity: boolean;
  };
}

export class BlockDataService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get latest block number from the database
   */
  private async getLatestBlockNumber(): Promise<number | null> {
    let client: PoolClient | null = null;
    
    try {
      client = await this.pool.connect();
      
      const sql = `SELECT MAX(number) as latest FROM raw_1`;
      const result = await client.query({
        text: sql,
        query_timeout: 2000
      });
      
      if (result.rows && result.rows.length > 0 && result.rows[0].latest) {
        return parseInt(result.rows[0].latest);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get latest block number:', error);
      return null;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Fetch block data using optimized queries similar to quick-data API
   */
  async getCompleteBlockData(blockNumber: number | string): Promise<BlockData | null> {
    const startTime = Date.now();
    let client: PoolClient | null = null;
    
    try {
      console.log(`🔍 Fetching complete block data for ${blockNumber}`);
      
      // Handle "latest" case
      const actualBlockNumber = blockNumber === 'latest' 
        ? await this.getLatestBlockNumber()
        : parseInt(blockNumber.toString());
        
      if (!actualBlockNumber) {
        console.log(`❌ Invalid block number: ${blockNumber}`);
        return null;
      }

      // Get client from pool
      client = await this.pool.connect();
      
      // Use the SAME query pattern as quick-data API which works reliably
      const blockSql = `
        SELECT 
          number,
          hash,
          parent_hash,
          timestamp,
          gas_used,
          gas_limit,
          base_fee_per_gas,
          miner,
          size,
          transaction_count
        FROM raw_1
        WHERE number = $1
        LIMIT 1
      `;
      
      const blockResult = await client.query({
        text: blockSql,
        values: [actualBlockNumber],
        query_timeout: 3000 // 3 second timeout
      });
      
      if (!blockResult.rows || blockResult.rows.length === 0) {
        console.log(`❌ Block ${actualBlockNumber} not found in database`);
        return null;
      }
      
      const block = blockResult.rows[0];
      console.log(`✅ Block ${actualBlockNumber} found in ${Date.now() - startTime}ms`);
      
      // Get a SAMPLE of transactions (not all) for performance
      const txSql = `
        SELECT 
          hash,
          from_address,
          to_address,
          value,
          receipt_gas_used,
          gas_price,
          receipt_status
        FROM source_1
        WHERE block_number = $1
        LIMIT 20
      `;
      
      let transactions: any[] = [];
      try {
        const txResult = await client.query({
          text: txSql,
          values: [actualBlockNumber],
          query_timeout: 2000 // 2 second timeout
        });
        
        transactions = txResult.rows || [];
        console.log(`✅ Found ${transactions.length} sample transactions`);
      } catch (error) {
        console.warn('⚠️ Could not fetch transactions (non-critical):', error);
      }
      
      // Calculate simple metrics
      const successfulTxs = transactions.filter(tx => tx.receipt_status === 1).length;
      const failedTxs = transactions.filter(tx => tx.receipt_status === 0).length;
      const uniqueAddresses = new Set([
        ...transactions.map(tx => tx.from_address),
        ...transactions.map(tx => tx.to_address).filter(addr => addr)
      ]).size;
      
      const avgGasPrice = transactions.length > 0 
        ? transactions.reduce((sum, tx) => sum + parseFloat(tx.gas_price || '0'), 0) / transactions.length
        : 0;
      
      const totalValue = transactions.reduce((sum, tx) => sum + parseFloat(tx.value || '0'), 0).toString();
      
      // Build the block data
      const blockData: BlockData = {
        number: block.number,
        hash: block.hash || '',
        parentHash: block.parent_hash || '',
        timestamp: block.timestamp,
        gasUsed: block.gas_used || '0',
        gasLimit: block.gas_limit || '30000000',
        baseFeePerGas: block.base_fee_per_gas || '0',
        miner: block.miner || '',
        size: block.size || 0,
        transactionCount: block.transaction_count || transactions.length,
        
        metrics: {
          totalTransactions: block.transaction_count || transactions.length,
          successfulTransactions: successfulTxs,
          failedTransactions: failedTxs,
          avgGasPrice: avgGasPrice,
          totalValue: totalValue,
          uniqueAddresses: uniqueAddresses,
          contractInteractions: 0, // Simplified
          latestBlockNumber: 0, // Would need another query
          blockConfirmations: 0, // Would need another query
          networkUtilization: block.gas_used && block.gas_limit 
            ? (parseFloat(block.gas_used) / parseFloat(block.gas_limit)) * 100
            : 0
        },
        
        transactions: transactions.map(tx => ({
          hash: tx.hash,
          from: tx.from_address,
          to: tx.to_address || '',
          value: tx.value || '0',
          gasUsed: tx.receipt_gas_used || '0',
          gasPrice: tx.gas_price || '0',
          status: tx.receipt_status === 1,
          isContractCall: false // Simplified
        })),
        
        patterns: {
          dexActivity: false, // Simplified
          highValueTransfers: transactions.filter(tx => parseFloat(tx.value || '0') > 1000).length,
          failureRate: transactions.length > 0 ? (failedTxs / transactions.length) * 100 : 0,
          gasSpikes: false, // Simplified
          mevActivity: false // Simplified
        }
      };

      console.log(`✅ Block data processed in ${Date.now() - startTime}ms`);
      return blockData;
      
    } catch (error) {
      const queryTime = Date.now() - startTime;
      console.error(`❌ Failed to fetch block data for ${blockNumber} after ${queryTime}ms:`, error);
      throw new Error(`Block data fetch failed: ${error.message}`);
    } finally {
      // Always release client back to pool
      if (client) {
        client.release();
      }
    }
  }
  
  /**
   * Get recent blocks (simplified)
   */
  async getRecentBlocks(limit: number = 10): Promise<any[]> {
    let client: PoolClient | null = null;
    
    try {
      client = await this.pool.connect();
      
      const sql = `
        SELECT 
          number,
          hash,
          timestamp,
          gas_used,
          gas_limit,
          transaction_count
        FROM raw_1
        ORDER BY number DESC
        LIMIT $1
      `;
      
      const result = await client.query({
        text: sql,
        values: [limit],
        query_timeout: 2000
      });
      
      return result.rows || [];
      
    } catch (error) {
      console.error('Failed to fetch recent blocks:', error);
      return [];
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}