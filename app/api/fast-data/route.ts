import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable not configured');
}

// Optimized connection pool for faster queries
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1, // Single connection to avoid overwhelming
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Very short timeout
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('⚡ Fast data API called');
  
  try {
    const client = await pool.connect();
    
    try {
      // Ultra-fast query - just get the most recent data with LIMIT
      console.log('🏃 Running optimized query...');
      const result = await client.query(`
        SELECT 
          hash, block_number, from_address, to_address, value, receipt_status
        FROM source_1 
        WHERE block_number IS NOT NULL
        ORDER BY block_number DESC 
        LIMIT 3
      `);
      
      console.log(`⚡ Fast query completed in ${Date.now() - startTime}ms - found ${result.rows.length} transactions`);
      
      if (result.rows.length === 0) {
        throw new Error('No recent data available');
      }
      
      const transactions = result.rows.map((tx: any) => ({
        id: tx.hash,
        hash: tx.hash,
        blockNumber: tx.block_number,
        from: tx.from_address,
        to: tx.to_address,
        value: tx.value?.toString() || '0',
        status: tx.receipt_status === 1 ? 'Success' : 'Failed'
      }));

      // Quick stats from the small result set
      const latestBlock = result.rows[0]?.block_number || 0;
      const blocks = [{
        id: latestBlock?.toString(),
        number: latestBlock,
        hash: result.rows[0]?.hash || '',
        timestamp: Date.now() / 1000,
        transaction_count: result.rows.length
      }];

      return NextResponse.json({
        success: true,
        transactions,
        blocks,
        stats: {
          latestBlock,
          totalTransactions: result.rows.length,
          networkHealth: 'Active'
        },
        queryTime: Date.now() - startTime,
        optimized: true
      });
      
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('⚡ Fast data API error:', error.message);
    console.log(`⚡ Failed after ${Date.now() - startTime}ms`);
    
    // Return empty but don't wait
    return NextResponse.json({
      success: false,
      error: error.message,
      transactions: [],
      blocks: [],
      stats: {
        latestBlock: 0,
        totalTransactions: 0,
        networkHealth: 'Loading...'
      },
      queryTime: Date.now() - startTime
    });
  }
}