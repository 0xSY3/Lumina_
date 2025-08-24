import { Pool, PoolClient } from 'pg';

export interface TransactionData {
  hash: string;
  blockNumber: number;
  blockTimestamp: number;
  transactionIndex: number;
  from: string;
  to: string | null;
  value: string;
  gasLimit: string;
  gasPrice: string;
  gasUsed: string;
  effectiveGasPrice: string;
  status: boolean;
  input: string;
  nonce: number;
  type: number;
  blockHash: string;
  
  // Calculated metrics
  gasEfficiency: number;
  transactionCost: string;
  isContractInteraction: boolean;
  
  // Context data
  blockContext: {
    blockGasUsed: string;
    blockGasLimit: string;
    baseFeePerGas: string;
    miner: string;
    blockSize: number;
    blockTransactionCount: number;
    blockUtilization: number;
  };
  
  addressActivity: {
    fromTransactionCount: number;
    toTransactionCount: number;
    fromActivity: 'High' | 'Medium' | 'Low' | 'Unknown';
    toActivity: 'High' | 'Medium' | 'Low' | 'Unknown';
  };
  
  networkMetrics: {
    averageGasPrice: string;
    recentTransactionCount: number;
    gasPriceCompare: string;
    networkCongestion: string;
  };
}

export class TransactionDataService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Fetch transaction data with optimized parallel queries
   */
  async getCompleteTransactionData(txHash: string): Promise<TransactionData | null> {
    const startTime = Date.now();
    let client: PoolClient | null = null;
    
    try {
      console.log(`🔍 Fetching complete transaction data for ${txHash}`);
      
      // Get client from pool
      client = await this.pool.connect();
      
      // STEP 1: Fetch main transaction data (FAST - single row lookup)
      const txSql = `
        SELECT 
          hash,
          block_number,
          block_timestamp,
          transaction_index,
          from_address,
          to_address,
          value,
          gas,
          gas_price,
          receipt_gas_used,
          receipt_effective_gas_price,
          receipt_status,
          input,
          nonce,
          transaction_type,
          block_hash
        FROM source_1
        WHERE hash = $1
        LIMIT 1
      `;
      
      const txResult = await client.query({
        text: txSql,
        values: [txHash],
        query_timeout: 3000 // 3 second timeout
      });
      
      if (!txResult.rows || txResult.rows.length === 0) {
        console.log(`❌ Transaction ${txHash} not found in database`);
        return null;
      }
      
      const tx = txResult.rows[0];
      console.log(`✅ Transaction found in ${Date.now() - startTime}ms`);
      
      // STEP 2: Fetch block data in parallel (OPTIONAL - can fail gracefully)
      let blockData: any = null;
      try {
        const blockSql = `
          SELECT 
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
        
        const blockPromise = client.query({
          text: blockSql,
          values: [tx.block_number],
          query_timeout: 2000 // 2 second timeout
        });
        
        const blockResult = await blockPromise;
        if (blockResult.rows && blockResult.rows.length > 0) {
          blockData = blockResult.rows[0];
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch block data (non-critical):', error);
      }
      
      console.log(`✅ Data processing completed in ${Date.now() - startTime}ms`);
      
      // Calculate metrics
      const gasUsed = BigInt(tx.receipt_gas_used || '0');
      const gasLimit = BigInt(tx.gas || '21000');
      const gasEfficiency = gasLimit > 0 ? (Number(gasUsed) / Number(gasLimit)) * 100 : 0;
      
      const gasPrice = BigInt(tx.receipt_effective_gas_price || tx.gas_price || '0');
      const transactionCost = (gasUsed * gasPrice).toString();
      
      const blockGasUsed = BigInt(blockData?.gas_used || '0');
      const blockGasLimit = BigInt(blockData?.gas_limit || '30000000');
      const blockUtilization = blockGasLimit > 0 ? (Number(blockGasUsed) / Number(blockGasLimit)) * 100 : 0;
      
      // Build response
      const transactionData: TransactionData = {
        hash: tx.hash,
        blockNumber: parseInt(tx.block_number),
        blockTimestamp: parseInt(tx.block_timestamp),
        transactionIndex: parseInt(tx.transaction_index),
        from: tx.from_address,
        to: tx.to_address || null,
        value: tx.value || '0',
        gasLimit: tx.gas || '0',
        gasPrice: tx.gas_price || '0',
        gasUsed: tx.receipt_gas_used || '0',
        effectiveGasPrice: tx.receipt_effective_gas_price || tx.gas_price || '0',
        status: tx.receipt_status === 1,
        input: tx.input || '0x',
        nonce: parseInt(tx.nonce || '0'),
        type: parseInt(tx.transaction_type || '0'),
        blockHash: tx.block_hash,
        
        // Calculated metrics
        gasEfficiency,
        transactionCost,
        isContractInteraction: tx.input && tx.input.length > 2,
        
        // Block context (with defaults if not available)
        blockContext: {
          blockGasUsed: blockData?.gas_used || '0',
          blockGasLimit: blockData?.gas_limit || '30000000',
          baseFeePerGas: blockData?.base_fee_per_gas || '0',
          miner: blockData?.miner || '',
          blockSize: parseInt(blockData?.size || '0'),
          blockTransactionCount: parseInt(blockData?.transaction_count || '0'),
          blockUtilization
        },
        
        // Simplified address activity (no extra queries for speed)
        addressActivity: {
          fromTransactionCount: 0,
          toTransactionCount: 0,
          fromActivity: 'Unknown',
          toActivity: 'Unknown'
        },
        
        // Simplified network metrics (no extra queries for speed)
        networkMetrics: {
          averageGasPrice: tx.gas_price || '0',
          recentTransactionCount: 0,
          gasPriceCompare: 'Normal',
          networkCongestion: 'Normal'
        }
      };
      
      return transactionData;
      
    } catch (error) {
      const queryTime = Date.now() - startTime;
      console.error(`❌ Failed to fetch transaction data for ${txHash} after ${queryTime}ms:`, error);
      throw new Error(`Transaction data fetch failed: ${error.message}`);
    } finally {
      // Always release client back to pool
      if (client) {
        client.release();
      }
    }
  }
  
  /**
   * Get recent transactions for an address (simplified)
   */
  async getAddressTransactions(address: string, limit: number = 10): Promise<any[]> {
    let client: PoolClient | null = null;
    
    try {
      client = await this.pool.connect();
      
      const sql = `
        SELECT 
          hash,
          block_number,
          from_address,
          to_address,
          value,
          receipt_status,
          block_timestamp
        FROM source_1
        WHERE from_address = $1 OR to_address = $1
        ORDER BY block_timestamp DESC
        LIMIT $2
      `;
      
      const result = await client.query({
        text: sql,
        values: [address, limit],
        query_timeout: 3000
      });
      
      return result.rows || [];
      
    } catch (error) {
      console.error(`Failed to fetch address transactions:`, error);
      return [];
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}