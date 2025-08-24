import { NextRequest, NextResponse } from 'next/server';
import { ChainManager } from '../chat/helpers/chainManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const chainManager = ChainManager.getInstance();
    const chainId = 998; // Hyperliquid Mainnet
    
    const blocks = await chainManager.getLatestBlocks(chainId, limit);
    
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blocks' },
      { status: 500 }
    );
  }
}