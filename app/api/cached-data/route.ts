import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for the last successful result
let lastSuccessfulData: any = null;
let lastUpdateTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Sample data structure based on your actual database
const getSampleData = () => ({
  success: true,
  transactions: [
    {
      id: '0x8f7a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      hash: '0x8f7a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      blockNumber: 21067234,
      from: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
      to: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
      value: '1250000',
      status: 'Success'
    },
    {
      id: '0x5a9e8f7d6c5b4a3928374650192837465048392847561029384756102938475610',
      hash: '0x5a9e8f7d6c5b4a3928374650192837465048392847561029384756102938475610',
      blockNumber: 21067233,
      from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8',
      to: '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed',
      value: '2750000',
      status: 'Success'
    }
  ],
  blocks: [
    {
      id: '21067234',
      number: 21067234,
      hash: '0x8f7a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      timestamp: Date.now() / 1000,
      transaction_count: 2
    }
  ],
  stats: {
    latestBlock: 21067234,
    totalTransactions: 2,
    networkHealth: 'Active'
  },
  queryTime: 150,
  cached: true,
  lastRealUpdate: new Date(lastUpdateTime).toISOString()
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Return cached data immediately - this is just to demonstrate the interface
  // In a real implementation, this would be updated by a background process
  // that fetches from your Goldsky database every few minutes
  
  console.log('📦 Serving cached demo data for UI demonstration');
  
  const demoData = getSampleData();
  demoData.queryTime = Date.now() - startTime;
  
  return NextResponse.json(demoData);
}