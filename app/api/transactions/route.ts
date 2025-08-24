import { NextRequest, NextResponse } from 'next/server';
import { ChainManager } from '../chat/helpers/chainManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const chainManager = ChainManager.getInstance();
    const chainId = 998; // Hyperliquid Mainnet
    
    const result = await chainManager.getRecentTransactions(chainId, limit);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}