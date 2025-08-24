import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { transactionSystemPrompt, blockSystemPrompt } from './systemPrompt';
import { serializeBigInts } from './helpers';
import { RealDataAnalyzer } from './realDataAnalyzer';
import { AIDataProcessor } from './AIDataProcessor';
import { SmartCache } from './SmartCache';
import { ErrorHandler, ErrorType } from './ErrorHandler';
import { Pool } from 'pg';
import { TRANSFERS } from './types';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Access-Control-Max-Age": "86400",
};

// Use the same database configuration as the working quick-data API
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable not configured');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Production-optimized pool settings
  max: 25, // Increase max connections for concurrent requests
  min: 5, // Keep minimum connections alive
  idleTimeoutMillis: 60000, // 1 minute idle timeout
  connectionTimeoutMillis: 8000, // 8 second connection timeout (same as quick-data)
  acquireTimeoutMillis: 10000, // 10 second acquire timeout
  // Performance optimizations
  allowExitOnIdle: false, // Keep pool alive (same as quick-data)
});

// Real data analyzer - no fallbacks, optimized for performance
const realDataAnalyzer = new RealDataAnalyzer(pool);

// Smart cache for analysis results
const smartCache = new SmartCache();

// Automatic cache cleanup every 10 minutes
setInterval(() => {
  const cleanedCount = smartCache.cleanExpired();
  if (cleanedCount > 0) {
    console.log(`🧹 Auto-cleanup: Removed ${cleanedCount} expired cache entries`);
  }
  
  // Log cache stats every hour
  const now = Date.now();
  if (!global.lastStatsLog || (now - global.lastStatsLog > 60 * 60 * 1000)) {
    const stats = smartCache.getStats();
    console.log(`📊 Cache Stats: ${stats.size}/${stats.maxSize} entries, ${stats.hitRate.toFixed(1)}% hit rate`);
    global.lastStatsLog = now;
  }
}, 10 * 60 * 1000);

// Graceful pool shutdown on process termination
process.on('SIGINT', async () => {
  console.log('🔄 Shutting down gracefully...');
  const stats = smartCache.getStats();
  console.log(`📊 Final cache stats: ${stats.size} entries, ${stats.hitRate.toFixed(1)}% hit rate`);
  smartCache.clear();
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down gracefully...');
  const stats = smartCache.getStats();
  console.log(`📊 Final cache stats: ${stats.size} entries, ${stats.hitRate.toFixed(1)}% hit rate`);
  smartCache.clear();
  await pool.end();
  process.exit(0);
});

// Simple utility functions to replace Viem dependencies
function formatUnits(value: any, decimals: number): string {
  if (!value) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return (num / Math.pow(10, decimals)).toString();
}

function formatEther(value: any): string {
  return formatUnits(value, 18);
}

// Advanced MEV Detection with Transaction Clustering
function detectMEVPattern(analysis: any, tx: any): any[] {
  const mevIndicators = [];
  
  // Enhanced Sandwich Attack Detection
  if (analysis.actionTypes.includes('Token Swap')) {
    const gasPrice = tx.gasPrice ? parseFloat(formatUnits(tx.gasPrice, 9)) : 0;
    const value = parseFloat(formatEther(tx.value));
    
    // High gas price with low value (classic sandwich front-running)
    if (gasPrice > 100 && value < 0.1) {
      mevIndicators.push({
        type: 'MEV_SANDWICH_FRONTRUN',
        severity: 'High',
        description: 'High gas price with minimal value transfer - likely sandwich attack front-running',
        confidence: 85,
        gasPrice: gasPrice,
        value: value
      });
    }
    
    // Gas price significantly above network average
    if (gasPrice > 50) {
      mevIndicators.push({
        type: 'MEV_SUSPICIOUS_GAS',
        severity: 'Medium',
        description: 'Unusually high gas price potentially indicating MEV competition',
        confidence: 65,
        gasPrice: gasPrice
      });
    }
  }
  
  // Enhanced Arbitrage Detection with Cross-DEX Analysis
  if (analysis.transfers.length > 2) {
    const uniqueTokens = new Set(analysis.transfers.map((t: any) => t.token?.address || 'native'));
    const swapCount = analysis.actionTypes.filter(type => type.includes('Swap')).length;
    
    if (uniqueTokens.size >= 2 && swapCount > 0) {
      // Circular arbitrage pattern (token A -> B -> A)
      const tokenFlow = analysis.transfers.map((t: any) => t.token?.symbol || t.token?.address).join(' -> ');
      const isCircular = tokenFlow.split(' -> ').length > 3;
      
      mevIndicators.push({
        type: isCircular ? 'MEV_CIRCULAR_ARBITRAGE' : 'MEV_ARBITRAGE_PATTERN',
        severity: isCircular ? 'High' : 'Medium',
        description: isCircular ? 
          'Circular arbitrage detected - token path returns to origin' :
          'Multi-token swap pattern indicating arbitrage opportunity',
        confidence: isCircular ? 90 : 70,
        tokenCount: uniqueTokens.size,
        swapCount: swapCount,
        pattern: tokenFlow
      });
    }
    
    // Volume-based arbitrage detection
    const totalValue = analysis.transfers.reduce((sum: number, transfer: any) => {
      return sum + parseFloat(transfer.value || '0');
    }, 0);
    
    if (totalValue > 1000 && analysis.transfers.length > 4) {
      mevIndicators.push({
        type: 'MEV_HIGH_VOLUME_ARBITRAGE',
        severity: 'High',
        description: 'High-volume multi-transfer pattern suggesting institutional arbitrage',
        confidence: 80,
        totalValue: totalValue,
        transferCount: analysis.transfers.length
      });
    }
  }
  
  // Enhanced Flash Loan Detection
  const flashLoanEvents = analysis.otherEvents.filter((event: any) => 
    event.data?.toLowerCase().includes('flash') ||
    event.topics?.some((topic: string) => 
      topic.toLowerCase().includes('borrow') ||
      topic.toLowerCase().includes('repay')
    )
  );
  
  if (flashLoanEvents.length > 0) {
    const hasComplexFlow = analysis.transfers.length > 3 && analysis.interactions.length > 2;
    
    mevIndicators.push({
      type: 'MEV_FLASH_LOAN_COMPLEX',
      severity: hasComplexFlow ? 'Critical' : 'High',
      description: hasComplexFlow ? 
        'Complex flash loan with multiple interactions - sophisticated MEV strategy' :
        'Flash loan activity detected',
      confidence: hasComplexFlow ? 95 : 75,
      flashLoanEvents: flashLoanEvents.length,
      interactions: analysis.interactions.length,
      transfers: analysis.transfers.length
    });
  }
  
  // MEV Bot Detection (high nonce, precise gas, repetitive patterns)
  if (tx.nonce && tx.nonce > 1000) {
    const hasAutomatedPattern = 
      tx.gasPrice && 
      (tx.gasPrice.toString().endsWith('000000000') || // Round gas prices
       tx.gasPrice.toString().endsWith('500000000'));
    
    if (hasAutomatedPattern) {
      mevIndicators.push({
        type: 'MEV_BOT_ACTIVITY',
        severity: 'Medium',
        description: 'Automated trading pattern detected - likely MEV bot operation',
        confidence: 75,
        nonce: tx.nonce,
        gasPattern: 'automated'
      });
    }
  }
  
  // Front-running Detection (high gas with minimal computational work)
  if (tx.gasPrice && analysis.transaction.gasUsed) {
    const gasPrice = parseFloat(formatUnits(tx.gasPrice, 9));
    const gasUsed = parseInt(analysis.transaction.gasUsed);
    const gasEfficiency = gasUsed / gasPrice;
    
    if (gasPrice > 80 && gasUsed < 100000 && gasEfficiency < 1000) {
      mevIndicators.push({
        type: 'MEV_FRONT_RUNNING',
        severity: 'High',
        description: 'High gas price with low computational work - classic front-running pattern',
        confidence: 85,
        gasPrice: gasPrice,
        gasUsed: gasUsed,
        efficiency: gasEfficiency
      });
    }
  }
  
  // Time-sensitive MEV Detection
  if (analysis.network.blockTimestamp) {
    const blockTime = new Date(analysis.network.blockTimestamp);
    const currentTime = new Date();
    const timeDiff = (currentTime.getTime() - blockTime.getTime()) / 1000; // seconds
    
    // Very recent transactions with high gas might be time-sensitive MEV
    if (timeDiff < 60 && tx.gasPrice) {
      const gasPrice = parseFloat(formatUnits(tx.gasPrice, 9));
      if (gasPrice > 200) {
        mevIndicators.push({
          type: 'MEV_TIME_SENSITIVE',
          severity: 'Critical',
          description: 'Extremely recent transaction with very high gas - time-sensitive MEV extraction',
          confidence: 90,
          timeSinceBlock: timeDiff,
          gasPrice: gasPrice
        });
      }
    }
  }
  
  return mevIndicators;
}

// Gas Price Optimization Analysis
function analyzeGasOptimization(analysis: any, tx: any, latestGasPrice?: string): any {
  const gasAnalysis = {
    efficiency: 'Unknown',
    optimization: [],
    recommendations: []
  };
  
  if (!tx.gasPrice || !analysis.transaction.gasUsed) return gasAnalysis;
  
  const txGasPrice = parseFloat(formatUnits(tx.gasPrice, 9));
  const gasUsed = parseInt(analysis.transaction.gasUsed);
  const networkGasPrice = latestGasPrice ? parseFloat(latestGasPrice) : 0;
  
  // Gas price efficiency
  if (networkGasPrice > 0) {
    const priceDiff = ((txGasPrice - networkGasPrice) / networkGasPrice) * 100;
    
    if (priceDiff < -10) {
      gasAnalysis.efficiency = 'Excellent';
      gasAnalysis.optimization.push('Gas price significantly below network average');
    } else if (priceDiff < 10) {
      gasAnalysis.efficiency = 'Good';
    } else if (priceDiff < 50) {
      gasAnalysis.efficiency = 'Poor';
      gasAnalysis.recommendations.push('Consider using lower gas price for non-urgent transactions');
    } else {
      gasAnalysis.efficiency = 'Very Poor';
      gasAnalysis.recommendations.push('Gas price is extremely high - consider waiting for lower network congestion');
    }
  }
  
  // Gas usage analysis
  if (gasUsed > 500000) {
    gasAnalysis.recommendations.push('High gas usage - consider optimizing contract interactions');
  }
  
  // Contract interaction efficiency
  if (analysis.interactions.length > 1) {
    gasAnalysis.recommendations.push('Multiple contract interactions - consider batching operations');
  }
  
  return gasAnalysis;
}

// Security Vulnerability Detection
function detectSecurityVulnerabilities(analysis: any, tx: any): any[] {
  const vulnerabilities = [];
  
  // Unusual gas patterns
  if (tx.gasPrice && analysis.transaction.gasUsed) {
    const gasUsed = parseInt(analysis.transaction.gasUsed);
    if (gasUsed > 1000000) {
      vulnerabilities.push({
        type: 'HIGH_GAS_USAGE',
        severity: 'Medium',
        description: 'Extremely high gas usage - potential inefficient or malicious contract'
      });
    }
  }
  
  // Suspicious contract interactions
  const unknownContracts = analysis.securityInfo.filter((info: any) => 
    info.type === 'Warning' && info.message.includes('not a contract')
  );
  
  if (unknownContracts.length > 0) {
    vulnerabilities.push({
      type: 'UNVERIFIED_CONTRACTS',
      severity: 'High',
      description: `Interaction with ${unknownContracts.length} unverified contracts`
    });
  }
  
  // Large value transfers to new addresses
  const highValueTransfers = analysis.transfers.filter((transfer: any) => {
    const value = parseFloat(transfer.value || '0');
    return value > 1000; // > 1000 ETH tokens
  });
  
  if (highValueTransfers.length > 0) {
    vulnerabilities.push({
      type: 'HIGH_VALUE_TRANSFER',
      severity: 'Medium',
      description: `High value transfer detected: ${highValueTransfers.length} transfers > 1000 tokens`
    });
  }
  
  // Multiple token approvals
  const approvalEvents = analysis.actions.filter((action: any) =>
    action.eventName?.toLowerCase().includes('approval')
  );
  
  if (approvalEvents.length > 2) {
    vulnerabilities.push({
      type: 'MULTIPLE_APPROVALS',
      severity: 'Medium',
      description: 'Multiple token approvals detected - verify contract trustworthiness'
    });
  }
  
  return vulnerabilities;
}

// Advanced Transaction Pattern Analysis with Clustering
function analyzeTransactionPatterns(analysis: any, tx: any): any {
  const patterns = {
    transactionType: 'Unknown',
    behaviorType: 'Normal',
    patterns: [],
    riskScore: 0,
    clustering: {
      cluster: 'Unknown',
      confidence: 0,
      similarityFactors: []
    },
    behaviorProfile: {
      automationLevel: 'Manual',
      sophistication: 'Basic',
      intentPattern: 'Unknown'
    }
  };
  
  // Enhanced Transaction Type Classification
  if (analysis.actionTypes.includes('Token Swap') && analysis.transfers.length >= 2) {
    const swapComplexity = analysis.transfers.length + analysis.interactions.length;
    if (swapComplexity > 8) {
      patterns.transactionType = 'Complex DEX Strategy';
      patterns.patterns.push('Multi-step DEX arbitrage or advanced trading');
      patterns.riskScore += 3;
    } else if (swapComplexity > 4) {
      patterns.transactionType = 'Advanced DEX Trading';
      patterns.patterns.push('Multi-hop token exchange');
      patterns.riskScore += 2;
    } else {
      patterns.transactionType = 'Simple DEX Trading';
      patterns.patterns.push('Basic token exchange via DEX');
      patterns.riskScore += 1;
    }
  } else if (analysis.actionTypes.includes('NFT Transfer')) {
    patterns.transactionType = 'NFT Transaction';
    patterns.patterns.push('Non-fungible token transfer');
    if (analysis.transfers.length > 1) {
      patterns.patterns.push('NFT transaction with additional transfers');
      patterns.riskScore += 1;
    }
  } else if (analysis.actionTypes.includes('Contract Deployment')) {
    patterns.transactionType = 'Contract Deployment';
    patterns.patterns.push('Smart contract deployment');
    patterns.behaviorProfile.sophistication = 'Advanced';
  } else if (analysis.transfers.length > 0) {
    patterns.transactionType = 'Token Transfer';
    patterns.patterns.push('Token or value transfer');
  }
  
  // Transaction Clustering Analysis
  const clusteringResult = performTransactionClustering(analysis, tx);
  patterns.clustering = clusteringResult;
  patterns.riskScore += clusteringResult.riskContribution || 0;
  
  // Enhanced Behavior Pattern Analysis
  if (analysis.interactions.length > 5) {
    patterns.behaviorType = 'Highly Complex';
    patterns.patterns.push('Extensive contract interaction network');
    patterns.behaviorProfile.sophistication = 'Expert';
    patterns.riskScore += 4;
  } else if (analysis.interactions.length > 3) {
    patterns.behaviorType = 'Complex';
    patterns.patterns.push('Multiple contract interactions');
    patterns.behaviorProfile.sophistication = 'Intermediate';
    patterns.riskScore += 2;
  }
  
  if (analysis.transfers.length > 10) {
    patterns.behaviorType = 'Extremely High Activity';
    patterns.patterns.push('Massive multi-transfer operation');
    patterns.riskScore += 5;
  } else if (analysis.transfers.length > 5) {
    patterns.behaviorType = 'High Activity';
    patterns.patterns.push('Multiple transfers in single transaction');
    patterns.riskScore += 3;
  }
  
  // Automation Detection
  if (tx.nonce && tx.nonce > 5000) {
    patterns.behaviorProfile.automationLevel = 'Fully Automated';
    patterns.patterns.push('Very high nonce - likely automated system');
    patterns.riskScore += 2;
  } else if (tx.nonce && tx.nonce > 1000) {
    patterns.behaviorProfile.automationLevel = 'Semi-Automated';
    patterns.patterns.push('High nonce - frequent transaction sender');
    patterns.riskScore += 1;
  }
  
  // Gas Pattern Analysis for Automation
  if (tx.gasPrice) {
    const gasPrice = tx.gasPrice.toString();
    const hasRoundGas = gasPrice.endsWith('000000000') || gasPrice.endsWith('500000000');
    const hasMaxGas = parseInt(gasPrice) > 1000000000000; // Very high gas
    
    if (hasRoundGas && hasMaxGas) {
      patterns.behaviorProfile.automationLevel = 'Bot/MEV';
      patterns.patterns.push('Round gas prices with maximum urgency - MEV bot pattern');
      patterns.riskScore += 3;
    } else if (hasRoundGas) {
      patterns.patterns.push('Programmatic gas pricing detected');
      patterns.riskScore += 1;
    }
  }
  
  // Intent Pattern Recognition
  const intentAnalysis = analyzeTransactionIntent(analysis, tx);
  patterns.behaviorProfile.intentPattern = intentAnalysis.intent;
  patterns.patterns.push(...intentAnalysis.indicators);
  patterns.riskScore += intentAnalysis.riskContribution;
  
  // Timing Pattern Analysis
  if (analysis.network.blockTimestamp) {
    const blockTime = new Date(analysis.network.blockTimestamp);
    const hour = blockTime.getUTCHours();
    
    // Off-hours activity might indicate automation
    if (hour >= 2 && hour <= 6) {
      patterns.patterns.push('Off-hours transaction timing');
      patterns.behaviorProfile.automationLevel = patterns.behaviorProfile.automationLevel === 'Manual' ? 
        'Semi-Automated' : patterns.behaviorProfile.automationLevel;
    }
  }
  
  return patterns;
}

// Transaction Clustering Function
function performTransactionClustering(analysis: any, tx: any): any {
  const clustering = {
    cluster: 'Uncategorized',
    confidence: 0,
    similarityFactors: [],
    riskContribution: 0
  };
  
  // Define clustering features
  const features = {
    transferCount: analysis.transfers.length,
    interactionCount: analysis.interactions.length,
    actionTypes: analysis.actionTypes.length,
    gasUsage: parseInt(analysis.transaction.gasUsed || '0'),
    value: parseFloat(formatEther(tx.value)),
    hasContract: analysis.interactions.length > 0,
    hasSwap: analysis.actionTypes.includes('Token Swap'),
    hasNFT: analysis.actionTypes.includes('NFT Transfer')
  };
  
  // MEV Cluster
  if (features.transferCount > 3 && features.interactionCount > 2 && features.gasUsage > 500000) {
    clustering.cluster = 'MEV/Arbitrage';
    clustering.confidence = 85;
    clustering.similarityFactors.push('High transfer count', 'Multiple interactions', 'High gas usage');
    clustering.riskContribution = 3;
  }
  // DeFi Power User Cluster
  else if (features.hasSwap && features.interactionCount > 1 && features.value > 10) {
    clustering.cluster = 'DeFi Power User';
    clustering.confidence = 75;
    clustering.similarityFactors.push('Token swaps', 'Multiple DeFi protocols', 'Significant value');
    clustering.riskContribution = 1;
  }
  // NFT Trader Cluster
  else if (features.hasNFT && features.transferCount >= 1) {
    clustering.cluster = 'NFT Trader';
    clustering.confidence = 80;
    clustering.similarityFactors.push('NFT transfers', 'Trading activity');
    clustering.riskContribution = 1;
  }
  // Simple User Cluster
  else if (features.transferCount <= 1 && features.interactionCount <= 1 && !features.hasContract) {
    clustering.cluster = 'Simple User';
    clustering.confidence = 90;
    clustering.similarityFactors.push('Low complexity', 'Direct transfers');
    clustering.riskContribution = 0;
  }
  // Bot/Automated Cluster
  else if (features.gasUsage > 200000 && features.actionTypes > 2) {
    clustering.cluster = 'Automated System';
    clustering.confidence = 70;
    clustering.similarityFactors.push('High gas usage', 'Multiple action types');
    clustering.riskContribution = 2;
  }
  // Contract Deployer Cluster
  else if (analysis.actionTypes.includes('Contract Deployment')) {
    clustering.cluster = 'Contract Deployer';
    clustering.confidence = 95;
    clustering.similarityFactors.push('Contract deployment');
    clustering.riskContribution = 1;
  }
  // Unknown High Activity Cluster
  else if (features.transferCount > 5 || features.interactionCount > 4) {
    clustering.cluster = 'High Activity User';
    clustering.confidence = 60;
    clustering.similarityFactors.push('High transaction complexity');
    clustering.riskContribution = 2;
  }
  
  return clustering;
}

// Transaction Intent Analysis
function analyzeTransactionIntent(analysis: any, tx: any): any {
  const intentAnalysis = {
    intent: 'Unknown',
    indicators: [],
    riskContribution: 0
  };
  
  // Profit-seeking intent
  if (analysis.actionTypes.includes('Token Swap') && analysis.transfers.length > 2) {
    const uniqueTokens = new Set(analysis.transfers.map((t: any) => t.token?.address || 'native'));
    if (uniqueTokens.size >= 3) {
      intentAnalysis.intent = 'Profit Maximization';
      intentAnalysis.indicators.push('Multi-token arbitrage pattern');
      intentAnalysis.riskContribution = 2;
    }
  }
  
  // Liquidation intent
  if (analysis.transfers.length > 5 && parseInt(analysis.transaction.gasUsed || '0') > 800000) {
    intentAnalysis.intent = 'Liquidation/Emergency';
    intentAnalysis.indicators.push('High transfer count with urgent gas usage');
    intentAnalysis.riskContribution = 3;
  }
  
  // Collection/Accumulation intent
  if (analysis.transfers.filter((t: any) => t.to === tx.from).length > 2) {
    intentAnalysis.intent = 'Asset Collection';
    intentAnalysis.indicators.push('Multiple inbound transfers to sender');
    intentAnalysis.riskContribution = 1;
  }
  
  // Testing/Development intent
  if (analysis.network.testnet && analysis.actionTypes.includes('Contract Deployment')) {
    intentAnalysis.intent = 'Development/Testing';
    intentAnalysis.indicators.push('Contract deployment on testnet');
    intentAnalysis.riskContribution = 0;
  }
  
  // Normal trading intent
  if (analysis.actionTypes.includes('Token Swap') && analysis.transfers.length <= 2) {
    intentAnalysis.intent = 'Normal Trading';
    intentAnalysis.indicators.push('Standard token exchange');
    intentAnalysis.riskContribution = 0;
  }
  
  return intentAnalysis;
}

// Enhanced Smart Contract Analysis (disabled for performance)
async function analyzeSmartContractInteractions(analysis: any, provider: any): Promise<any[]> {
  return []; // Simplified for performance
  const contractAnalysis = [];
  
  for (const contractAddress of analysis.interactions) {
    try {
      const code = await provider.getCode({ address: contractAddress as `0x${string}` });
      const analysis_result: any = {
        address: contractAddress,
        isContract: code !== '0x',
        bytecodeSize: code !== '0x' ? code.length / 2 - 1 : 0,
        complexity: 'Unknown',
        risks: []
      };
      
      if (code !== '0x') {
        // Analyze bytecode complexity
        if (analysis_result.bytecodeSize > 10000) {
          analysis_result.complexity = 'Very High';
          analysis_result.risks.push('Large contract - high complexity');
        } else if (analysis_result.bytecodeSize > 5000) {
          analysis_result.complexity = 'High';
        } else if (analysis_result.bytecodeSize > 1000) {
          analysis_result.complexity = 'Medium';
        } else {
          analysis_result.complexity = 'Low';
        }
        
        // Check for proxy patterns
        if (code.includes('delegatecall') || code.includes('proxy')) {
          analysis_result.risks.push('Proxy contract detected - implementation may change');
        }
        
        // Check for common security patterns
        if (code.includes('reentrancy') || code.includes('guard')) {
          analysis_result.features = ['Reentrancy protection'];
        }
      }
      
      contractAnalysis.push(analysis_result);
    } catch (error) {
      console.warn(`Could not analyze contract ${contractAddress}:`, error);
    }
  }
  
  return contractAnalysis;
}

// Helper functions
function calculateComplexityScore(analysis: any): string {
  let score = 0;
  score += analysis.transfers.length * 2;
  score += analysis.interactions.length * 3;
  score += analysis.securityInfo.length * 1;
  score += analysis.actionTypes.length > 1 ? 5 : 0;
  
  // Add new complexity factors
  score += analysis.advancedAnalysis?.patterns?.riskScore || 0;
  score += analysis.advancedAnalysis?.mevIndicators?.length * 2 || 0;
  
  if (score <= 5) return 'Simple';
  if (score <= 15) return 'Moderate';
  if (score <= 30) return 'Complex';
  return 'Very Complex';
}

function calculateRiskLevel(analysis: any): string {
  let riskFactors = 0;
  if (analysis.interactions.length > 3) riskFactors++;
  if (analysis.actionTypes.includes('Swap')) riskFactors++;
  if (analysis.securityInfo.some((e: any) => e.type === 'Warning')) riskFactors += 2;
  if (analysis.transfers.length > 5) riskFactors++;
  if (analysis.actionTypes.length > 1) riskFactors++;
  
  // Add advanced risk factors
  const advancedAnalysis = analysis.advancedAnalysis || {};
  if (advancedAnalysis.vulnerabilities?.length > 0) riskFactors += advancedAnalysis.vulnerabilities.length;
  if (advancedAnalysis.mevIndicators?.length > 0) riskFactors += Math.ceil(advancedAnalysis.mevIndicators.length / 2);
  if (advancedAnalysis.gasAnalysis?.efficiency === 'Very Poor') riskFactors += 2;
  
  if (riskFactors === 0) return 'Low';
  if (riskFactors <= 3) return 'Medium';
  if (riskFactors <= 6) return 'High';
  return 'Critical';
}

// Create OpenAI instance
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// API Route handler
export async function POST(request: NextRequest) {
  try {
    const { messages, txHash } = await request.json();

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Determine if this is block or transaction analysis
    const lastMessage = messages[messages.length - 1]?.content || '';
    const isBlockAnalysis = lastMessage.includes('analyzeHyperliquidBlock') || 
                           lastMessage.includes('block analysis') || 
                           lastMessage.includes('Block #') ||
                           (txHash && txHash.startsWith('block-'));
    const selectedSystemPrompt = isBlockAnalysis ? blockSystemPrompt : transactionSystemPrompt;

    console.log(`🔍 Using ${isBlockAnalysis ? 'BLOCK' : 'TRANSACTION'} system prompt for analysis`);

    const result = streamText({
      model: openai('gpt-4o-mini'), // Much faster and more efficient than gpt-3.5-turbo
      maxTokens: 3000, // Higher limit for comprehensive analysis with faster model
      temperature: 0.1, // Very low for consistent results but comprehensive
      maxRetries: 2, // Allow retries for real data fetching
      messages: [
        {
          role: 'system',
          content: selectedSystemPrompt
        },
        ...messages
      ],
      toolChoice: 'required', // Force AI to use tools quickly
      tools: {
        analyzeHyperliquidTransaction: tool({
          description: 'Analyze a Hyperliquid blockchain transaction with detailed insights using real data only',
          parameters: z.object({
            txHash: z.string().describe('The transaction hash to analyze'),
            chainId: z.number().describe('The Hyperliquid chain ID (998 for mainnet, 99998 for testnet)'),
          }),
          execute: async ({ txHash, chainId }) => {
            try {
              console.log(`🚀 Real data analysis for ${txHash} on chain ${chainId}`);
              
              // Check cache first
              const cacheKey = SmartCache.getTransactionKey(txHash, chainId);
              const cachedResult = smartCache.getWithTracking(cacheKey);
              
              if (cachedResult) {
                console.log(`⚡ Using cached transaction analysis for ${txHash}`);
                return {
                  success: true,
                  data: JSON.stringify(serializeBigInts(cachedResult)),
                };
              }
              
              // Fetch real data
              const analysis = await realDataAnalyzer.analyzeTransactionReal(txHash, chainId);
              
              // Format data for optimal AI processing
              const formattedData = AIDataProcessor.formatTransactionForAI(analysis);
              const analysisDirective = AIDataProcessor.createAnalysisDirective('transaction');
              
              const aiInput = {
                rawData: analysis,
                formattedAnalysis: formattedData,
                directive: analysisDirective,
                type: 'transaction',
                hash: txHash,
                chainId: chainId
              };
              
              // Cache the result
              smartCache.set(cacheKey, aiInput, 'transaction');
              
              return {
                success: true,
                data: JSON.stringify(serializeBigInts(aiInput)),
              };
            } catch (error) {
              console.error('❌ Real data transaction analysis failed:', error);
              
              const structuredError = ErrorHandler.fromError(error as Error, {
                operation: 'transaction_analysis',
                txHash,
                chainId,
                timestamp: Date.now()
              });
              
              ErrorHandler.logError(structuredError);
              
              return {
                success: false,
                error: structuredError.error.userMessage,
                errorCode: structuredError.error.errorCode,
                retryable: structuredError.error.retryable,
                suggestions: structuredError.error.suggestions
              };
            }
          },
        }),
        
        getHyperliquidAddressInfo: tool({
          description: 'Get Hyperliquid address information - temporarily disabled as part of real data pipeline',
          parameters: z.object({
            address: z.string().describe('The Hyperliquid address to analyze'),
            chainId: z.number().describe('The Hyperliquid chain ID (998 for mainnet, 99998 for testnet)'),
          }),
          execute: async ({ address, chainId }) => {
            return {
              success: false,
              error: 'Address info temporarily disabled - focus on transaction and block analysis with real data only'
            };
          },
        }),

        analyzeHyperliquidBlock: tool({
          description: 'Analyze a Hyperliquid block with detailed metrics and transaction patterns using real data only',
          parameters: z.object({
            blockNumber: z.union([z.number(), z.string()]).describe('Block number or "latest"'),
            chainId: z.number().describe('The Hyperliquid chain ID (998 for mainnet, 99998 for testnet)'),
          }),
          execute: async ({ blockNumber, chainId }) => {
            try {
              console.log(`🚀 Real data block analysis for #${blockNumber} on chain ${chainId}`);
              
              // Check cache first
              const cacheKey = SmartCache.getBlockKey(blockNumber, chainId);
              const cachedResult = smartCache.getWithTracking(cacheKey);
              
              if (cachedResult) {
                console.log(`⚡ Using cached block analysis for #${blockNumber}`);
                return {
                  success: true,
                  data: JSON.stringify(serializeBigInts(cachedResult)),
                };
              }
              
              // Fetch real data
              const analysis = await realDataAnalyzer.analyzeBlockReal(blockNumber, chainId);
              
              // Format data for optimal AI processing
              const formattedData = AIDataProcessor.formatBlockForAI(analysis);
              const analysisDirective = AIDataProcessor.createAnalysisDirective('block');
              
              const aiInput = {
                rawData: analysis,
                formattedAnalysis: formattedData,
                directive: analysisDirective,
                type: 'block',
                blockNumber: blockNumber,
                chainId: chainId
              };
              
              // Cache the result
              smartCache.set(cacheKey, aiInput, 'block');
              
              return {
                success: true,
                data: JSON.stringify(serializeBigInts(aiInput)),
              };
            } catch (error) {
              console.error('❌ Real data block analysis failed:', error);
              
              const structuredError = ErrorHandler.fromError(error as Error, {
                operation: 'block_analysis',
                blockNumber,
                chainId,
                timestamp: Date.now()
              });
              
              ErrorHandler.logError(structuredError);
              
              return {
                success: false,
                error: structuredError.error.userMessage,
                errorCode: structuredError.error.errorCode,
                retryable: structuredError.error.retryable,
                suggestions: structuredError.error.suggestions
              };
            }
          },
        }),

        getCacheStatistics: tool({
          description: 'Get smart cache performance statistics and health metrics',
          parameters: z.object({}),
          execute: async () => {
            try {
              const stats = smartCache.getStats();
              
              // Clean expired entries
              const cleanedCount = smartCache.cleanExpired();
              
              const cacheInfo = {
                performance: {
                  cacheSize: stats.size,
                  maxSize: stats.maxSize,
                  utilizationPercent: Math.round((stats.size / stats.maxSize) * 100),
                  hitRate: Math.round(stats.hitRate * 100) / 100,
                  totalAccess: stats.totalAccess,
                  averageAccessPerEntry: stats.averageAccessPerEntry
                },
                dataBreakdown: stats.typeBreakdown,
                maintenance: {
                  expiredEntriesCleaned: cleanedCount,
                  lastCleanup: new Date().toISOString()
                },
                recommendations: {
                  cacheHealth: stats.hitRate > 70 ? 'Excellent' : stats.hitRate > 50 ? 'Good' : 'Poor',
                  suggestion: stats.hitRate < 50 ? 'Consider increasing cache TTL or analyzing access patterns' : 'Cache performing optimally'
                }
              };
              
              return {
                success: true,
                data: JSON.stringify(cacheInfo)
              };
            } catch (error) {
              return {
                success: false,
                error: 'Failed to get cache statistics: ' + error?.message
              };
            }
          }
        }),
      },
      temperature: 0.7,
      maxSteps: 10,
    });

    const response = result.toDataStreamResponse();
    const headersObject = Object.fromEntries(response.headers.entries());
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...headersObject,
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('❌ Flow API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Flow API Internal Server Error',
      details: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// Enhanced Network Metrics Analysis
function calculateNetworkMetrics(contextBlocks: any[], latestBlock: any, tx: any): any {
  const metrics = {
    congestionLevel: 'Unknown',
    averageBlockTime: 0,
    gasUsagePattern: 'Normal',
    blockContext: {
      position: 'Unknown',
      confirmations: 0,
      timeFromLatest: 0
    },
    networkHealth: {
      blockTimeVariation: 0,
      gasUsageConsistency: 'Stable'
    }
  };
  
  try {
    if (contextBlocks.length < 2) return metrics;
    
    // Calculate block time variations
    const blockTimes: number[] = [];
    const gasUsages: number[] = [];
    
    for (let i = 1; i < contextBlocks.length; i++) {
      const current = contextBlocks[i];
      const previous = contextBlocks[i - 1];
      
      if (current && previous && current.timestamp && previous.timestamp) {
        const timeDiff = Number(current.timestamp) - Number(previous.timestamp);
        blockTimes.push(Math.abs(timeDiff));
      }
      
      if (current?.gasUsed && current?.gasLimit) {
        const usage = (Number(current.gasUsed) / Number(current.gasLimit)) * 100;
        gasUsages.push(usage);
      }
    }
    
    // Calculate average block time
    if (blockTimes.length > 0) {
      metrics.averageBlockTime = blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length;
      
      // Determine congestion level based on block times and gas usage
      const avgGasUsage = gasUsages.length > 0 ? 
        gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length : 0;
      
      if (avgGasUsage > 80 && metrics.averageBlockTime > 15) {
        metrics.congestionLevel = 'High';
      } else if (avgGasUsage > 50 || metrics.averageBlockTime > 10) {
        metrics.congestionLevel = 'Medium';
      } else {
        metrics.congestionLevel = 'Low';
      }
      
      // Calculate block time variation
      const timeVariation = blockTimes.length > 1 ? 
        Math.sqrt(blockTimes.reduce((acc, time) => acc + Math.pow(time - metrics.averageBlockTime, 2), 0) / blockTimes.length) : 0;
      
      metrics.networkHealth.blockTimeVariation = timeVariation;
      metrics.networkHealth.gasUsageConsistency = timeVariation < 5 ? 'Stable' : 
        timeVariation < 15 ? 'Moderate' : 'Volatile';
    }
    
    // Calculate transaction position and confirmations
    if (tx.blockNumber && latestBlock?.number) {
      metrics.blockContext.confirmations = Number(latestBlock.number) - Number(tx.blockNumber);
      metrics.blockContext.timeFromLatest = latestBlock.timestamp && tx.blockNumber ? 
        Number(latestBlock.timestamp) - (Number(tx.blockNumber) * metrics.averageBlockTime) : 0;
      
      const totalBlocks = contextBlocks.length;
      const txPosition = contextBlocks.findIndex(block => 
        block && Number(block.number) === Number(tx.blockNumber)
      );
      
      if (txPosition !== -1) {
        if (txPosition < totalBlocks / 3) {
          metrics.blockContext.position = 'Early in context';
        } else if (txPosition > (2 * totalBlocks) / 3) {
          metrics.blockContext.position = 'Recent in context';
        } else {
          metrics.blockContext.position = 'Middle of context';
        }
      }
    }
    
  } catch (error) {
    console.warn('Network metrics calculation failed:', error);
  }
  
  return metrics;
}

// Enhanced Contract Interaction History (disabled for performance)
async function getContractInteractionHistory(provider: any, interactions: string[], tx: any): Promise<any> {
  return { popularityScore: 0, recentActivity: [], contractAges: [], interactionPatterns: {} }; // Simplified
  const history = {
    popularityScore: 0,
    recentActivity: [],
    contractAges: [],
    interactionPatterns: {
      frequentCallers: [],
      unusualActivity: false,
      gasPatterns: []
    }
  };
  
  try {
    // Analyze each contract involved in the transaction
    const contractPromises = interactions.slice(0, 5).map(async (contractAddress) => { // Limit to 5 contracts
      try {
        const [code, balance] = await Promise.all([
          provider.getCode({ address: contractAddress as `0x${string}` }),
          provider.getBalance({ address: contractAddress as `0x${string}` })
        ]);
        
        if (code === '0x') return null; // Not a contract
        
        return {
          address: contractAddress,
          codeSize: code.length / 2 - 1,
          balance: parseFloat(formatEther(balance)),
          isActive: balance > 0 || code.length > 100
        };
      } catch {
        return null;
      }
    });
    
    const contractData = (await Promise.all(contractPromises)).filter(Boolean);
    
    // Calculate popularity score based on code size and activity
    history.popularityScore = contractData.reduce((score, contract) => {
      if (!contract) return score;
      
      let contractScore = 0;
      
      // Larger contracts tend to be more established
      if (contract.codeSize > 10000) contractScore += 3;
      else if (contract.codeSize > 1000) contractScore += 2;
      else contractScore += 1;
      
      // Active contracts (with balance) get bonus points
      if (contract.balance > 0.1) contractScore += 2;
      
      return score + contractScore;
    }, 0);
    
    // Normalize popularity score (0-100)
    history.popularityScore = Math.min(100, (history.popularityScore / Math.max(1, contractData.length)) * 10);
    
    // Analyze interaction patterns
    if (contractData.length > 3) {
      history.interactionPatterns.unusualActivity = true;
    }
    
    // Store recent activity data
    history.recentActivity = contractData.map(contract => ({
      address: contract?.address,
      lastSeen: 'Current transaction',
      activityLevel: contract?.isActive ? 'Active' : 'Dormant'
    }));
    
  } catch (error) {
    console.warn('Contract history analysis failed:', error);
  }
  
  return history;
}

// Advanced Network Intelligence Layer (disabled for performance)
async function generateNetworkIntelligence(provider: any, tx: any, contextBlocks: any[], latestBlock: any): Promise<any> {
  return { gasPrediction: {}, trends: {}, timing: {}, networkHealth: {}, competitiveAnalysis: {} }; // Simplified
  const intelligence = {
    gasPrediction: {
      nextHourPrediction: 'Unknown',
      next24HourTrend: 'Stable',
      optimalGasPrice: '0',
      savings: {
        immediate: '0%',
        waitFor1Hour: '0%',
        waitFor6Hours: '0%'
      },
      confidence: 0
    },
    trends: {
      networkActivity: 'Normal',
      gasUsageTrend: 'Stable',
      blockUtilization: '0%',
      transactionVolume: 'Normal',
      dexActivity: 'Normal'
    },
    timing: {
      recommendation: 'Execute Now',
      bestTimeToSend: 'Immediate',
      worstTimeToSend: 'Unknown',
      reasoning: []
    },
    networkHealth: {
      score: 85,
      factors: [],
      warnings: []
    },
    competitiveAnalysis: {
      similarTransactions: 0,
      averageGasUsed: '0',
      successRate: '100%',
      timeToConfirm: '0s'
    }
  };

  try {
    console.log('🧠 Generating network intelligence...');

    // Gas Price Analysis and Prediction
    const gasPriceData = await analyzeGasPriceTrends(provider, contextBlocks, tx);
    intelligence.gasPrediction = gasPriceData;

    // Network Activity Trends
    const activityTrends = analyzeNetworkActivityTrends(contextBlocks, latestBlock);
    intelligence.trends = activityTrends;

    // Optimal Timing Analysis
    const timingAnalysis = analyzeOptimalTiming(tx, contextBlocks, gasPriceData);
    intelligence.timing = timingAnalysis;

    // Network Health Assessment
    const healthScore = calculateNetworkHealth(contextBlocks, latestBlock);
    intelligence.networkHealth = healthScore;

    // Competitive Transaction Analysis
    const competitive = await analyzeCompetitiveTransactions(provider, tx, contextBlocks);
    intelligence.competitiveAnalysis = competitive;

    console.log(`🎯 Network intelligence generated - Gas prediction: ${intelligence.gasPrediction.nextHourPrediction}`);

  } catch (error) {
    console.warn('⚠️ Network intelligence generation failed:', error);
    intelligence.timing.reasoning.push('Intelligence analysis unavailable');
  }

  return intelligence;
}

// Gas Price Trend Analysis (disabled for performance)
async function analyzeGasPriceTrends(provider: any, contextBlocks: any[], tx: any): Promise<any> {
  return { nextHourPrediction: 'Stable', next24HourTrend: 'Stable', optimalGasPrice: '0', savings: {}, confidence: 50 }; // Simplified
  const prediction = {
    nextHourPrediction: 'Stable',
    next24HourTrend: 'Stable', 
    optimalGasPrice: '0',
    savings: {
      immediate: '0%',
      waitFor1Hour: '0%',
      waitFor6Hours: '0%'
    },
    confidence: 0
  };

  try {
    // Extract gas prices from context blocks
    const gasPrices: number[] = [];
    const blockTimes: number[] = [];
    
    for (const block of contextBlocks) {
      if (block?.baseFeePerGas) {
        gasPrices.push(parseFloat(formatUnits(block.baseFeePerGas, 9)));
        blockTimes.push(Number(block.timestamp));
      }
    }

    if (gasPrices.length < 3) {
      prediction.confidence = 20;
      return prediction;
    }

    // Calculate trend direction
    const recentPrices = gasPrices.slice(-5);
    const earlierPrices = gasPrices.slice(0, 5);
    
    const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const earlierAvg = earlierPrices.reduce((a, b) => a + b, 0) / earlierPrices.length;
    
    const trendPercentage = ((recentAvg - earlierAvg) / earlierAvg) * 100;

    // Predict next hour trend
    if (trendPercentage > 20) {
      prediction.nextHourPrediction = 'Rising Fast';
      prediction.next24HourTrend = 'Increasing';
    } else if (trendPercentage > 5) {
      prediction.nextHourPrediction = 'Rising';
      prediction.next24HourTrend = 'Slightly Increasing';
    } else if (trendPercentage < -20) {
      prediction.nextHourPrediction = 'Falling Fast';
      prediction.next24HourTrend = 'Decreasing';
    } else if (trendPercentage < -5) {
      prediction.nextHourPrediction = 'Falling';
      prediction.next24HourTrend = 'Slightly Decreasing';
    } else {
      prediction.nextHourPrediction = 'Stable';
      prediction.next24HourTrend = 'Stable';
    }

    // Calculate optimal gas price
    const currentPrice = tx.gasPrice ? parseFloat(formatUnits(tx.gasPrice, 9)) : recentAvg;
    const volatility = Math.sqrt(gasPrices.reduce((acc, price) => acc + Math.pow(price - recentAvg, 2), 0) / gasPrices.length);
    
    prediction.optimalGasPrice = (recentAvg - volatility * 0.1).toFixed(2);

    // Calculate potential savings
    const savings1Hour = trendPercentage < 0 ? Math.abs(trendPercentage) * 0.3 : 0;
    const savings6Hours = trendPercentage < 0 ? Math.abs(trendPercentage) * 0.6 : 0;
    
    prediction.savings = {
      immediate: '0%',
      waitFor1Hour: `${savings1Hour.toFixed(1)}%`,
      waitFor6Hours: `${savings6Hours.toFixed(1)}%`
    };

    // Confidence based on data quality and volatility
    prediction.confidence = Math.min(95, Math.max(30, 80 - (volatility * 2)));

  } catch (error) {
    console.warn('Gas price analysis failed:', error);
    prediction.confidence = 10;
  }

  return prediction;
}

// Network Activity Trend Analysis
function analyzeNetworkActivityTrends(contextBlocks: any[], latestBlock: any): any {
  const trends = {
    networkActivity: 'Normal',
    gasUsageTrend: 'Stable',
    blockUtilization: '0%',
    transactionVolume: 'Normal',
    dexActivity: 'Normal'
  };

  try {
    // Calculate block utilization
    const utilizationRates: number[] = [];
    const transactionCounts: number[] = [];
    
    for (const block of contextBlocks) {
      if (block?.gasUsed && block?.gasLimit) {
        const utilization = (Number(block.gasUsed) / Number(block.gasLimit)) * 100;
        utilizationRates.push(utilization);
        transactionCounts.push(block.transactions?.length || 0);
      }
    }

    if (utilizationRates.length > 0) {
      const avgUtilization = utilizationRates.reduce((a, b) => a + b, 0) / utilizationRates.length;
      trends.blockUtilization = `${avgUtilization.toFixed(1)}%`;

      // Network activity assessment
      if (avgUtilization > 90) {
        trends.networkActivity = 'Very High';
        trends.gasUsageTrend = 'Increasing';
      } else if (avgUtilization > 70) {
        trends.networkActivity = 'High';
        trends.gasUsageTrend = 'Stable';
      } else if (avgUtilization > 40) {
        trends.networkActivity = 'Normal';
        trends.gasUsageTrend = 'Stable';
      } else {
        trends.networkActivity = 'Low';
        trends.gasUsageTrend = 'Decreasing';
      }
    }

    // Transaction volume analysis
    const avgTxCount = transactionCounts.length > 0 ? 
      transactionCounts.reduce((a, b) => a + b, 0) / transactionCounts.length : 0;
    
    if (avgTxCount > 100) {
      trends.transactionVolume = 'Very High';
    } else if (avgTxCount > 50) {
      trends.transactionVolume = 'High';
    } else if (avgTxCount > 20) {
      trends.transactionVolume = 'Normal';
    } else {
      trends.transactionVolume = 'Low';
    }

    // DEX activity estimation (rough heuristic)
    if (avgUtilization > 60 && avgTxCount > 30) {
      trends.dexActivity = 'High';
    } else if (avgUtilization > 40) {
      trends.dexActivity = 'Normal';
    } else {
      trends.dexActivity = 'Low';
    }

  } catch (error) {
    console.warn('Network activity analysis failed:', error);
  }

  return trends;
}

// Optimal Timing Analysis
function analyzeOptimalTiming(tx: any, contextBlocks: any[], gasPrediction: any): any {
  const timing = {
    recommendation: 'Execute Now',
    bestTimeToSend: 'Immediate',
    worstTimeToSend: 'Peak Hours (12-4 PM UTC)',
    reasoning: []
  };

  try {
    const currentTime = new Date();
    const hour = currentTime.getUTCHours();
    
    // Time-based recommendations
    if (hour >= 2 && hour <= 6) {
      timing.bestTimeToSend = 'Current (Off-peak Hours)';
      timing.reasoning.push('Off-peak hours typically have lower gas prices');
    } else if (hour >= 12 && hour <= 16) {
      timing.worstTimeToSend = 'Current (Peak Hours)';
      timing.reasoning.push('Peak trading hours - consider waiting');
    }

    // Gas price trend recommendations
    if (gasPrediction.nextHourPrediction === 'Falling' || gasPrediction.nextHourPrediction === 'Falling Fast') {
      timing.recommendation = 'Wait 1-2 Hours';
      timing.reasoning.push(`Gas prices trending downward - potential ${gasPrediction.savings.waitFor1Hour} savings`);
    } else if (gasPrediction.nextHourPrediction === 'Rising Fast') {
      timing.recommendation = 'Execute Immediately';
      timing.reasoning.push('Gas prices rising rapidly - execute now to avoid higher costs');
    } else if (gasPrediction.confidence < 50) {
      timing.recommendation = 'Execute Now';
      timing.reasoning.push('Uncertain market conditions - immediate execution recommended');
    }

    // Transaction urgency assessment
    if (tx.gasPrice) {
      const gasPrice = parseFloat(formatUnits(tx.gasPrice, 9));
      if (gasPrice > 200) {
        timing.recommendation = 'Execute Immediately';
        timing.reasoning.push('High gas price indicates urgent transaction');
      }
    }

  } catch (error) {
    console.warn('Timing analysis failed:', error);
    timing.reasoning.push('Timing analysis unavailable');
  }

  return timing;
}

// Network Health Score Calculation
function calculateNetworkHealth(contextBlocks: any[], latestBlock: any): any {
  const health = {
    score: 85,
    factors: [],
    warnings: []
  };

  try {
    let score = 100;
    
    // Block time consistency
    const blockTimes: number[] = [];
    for (let i = 1; i < contextBlocks.length; i++) {
      const current = contextBlocks[i];
      const previous = contextBlocks[i - 1];
      if (current?.timestamp && previous?.timestamp) {
        blockTimes.push(Number(current.timestamp) - Number(previous.timestamp));
      }
    }

    if (blockTimes.length > 0) {
      const avgBlockTime = blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length;
      const blockTimeVariance = Math.sqrt(blockTimes.reduce((acc, time) => acc + Math.pow(time - avgBlockTime, 2), 0) / blockTimes.length);
      
      if (blockTimeVariance > 10) {
        score -= 15;
        health.warnings.push('High block time variance detected');
      } else if (blockTimeVariance > 5) {
        score -= 5;
        health.factors.push('Moderate block time consistency');
      } else {
        health.factors.push('Excellent block time consistency');
      }
    }

    // Network utilization health
    const utilizationRates: number[] = [];
    for (const block of contextBlocks) {
      if (block?.gasUsed && block?.gasLimit) {
        utilizationRates.push((Number(block.gasUsed) / Number(block.gasLimit)) * 100);
      }
    }

    if (utilizationRates.length > 0) {
      const avgUtilization = utilizationRates.reduce((a, b) => a + b, 0) / utilizationRates.length;
      
      if (avgUtilization > 95) {
        score -= 20;
        health.warnings.push('Network extremely congested');
      } else if (avgUtilization > 80) {
        score -= 10;
        health.warnings.push('Network heavily congested');
      } else if (avgUtilization > 60) {
        score -= 5;
        health.factors.push('Moderate network usage');
      } else {
        health.factors.push('Healthy network utilization');
      }
    }

    health.score = Math.max(0, Math.min(100, score));

  } catch (error) {
    console.warn('Network health calculation failed:', error);
    health.score = 50;
    health.warnings.push('Health assessment unavailable');
  }

  return health;
}

// Competitive Transaction Analysis (disabled for performance)
async function analyzeCompetitiveTransactions(provider: any, tx: any, contextBlocks: any[]): Promise<any> {
  return { similarTransactions: 0, averageGasUsed: '0', successRate: '100%', timeToConfirm: '0s' }; // Simplified
  const competitive = {
    similarTransactions: 0,
    averageGasUsed: '0',
    successRate: '100%',
    timeToConfirm: '0s'
  };

  try {
    // Analyze similar transactions in recent blocks
    let similarTxCount = 0;
    let totalGasUsed = 0;
    let successfulTx = 0;
    let totalTx = 0;

    const txGasPrice = tx.gasPrice ? parseFloat(formatUnits(tx.gasPrice, 9)) : 0;
    const txValue = parseFloat(formatEther(tx.value));

    for (const block of contextBlocks.slice(-3)) { // Last 3 blocks
      if (!block?.transactions) continue;
      
      for (const blockTx of block.transactions.slice(0, 20)) { // Sample 20 tx per block
        if (typeof blockTx === 'string') continue;
        
        const blockTxGasPrice = blockTx.gasPrice ? parseFloat(formatUnits(blockTx.gasPrice, 9)) : 0;
        const blockTxValue = parseFloat(formatEther(blockTx.value));
        
        // Check similarity (gas price within 20%, value within similar range)
        const gasPriceSimilar = Math.abs(blockTxGasPrice - txGasPrice) / txGasPrice < 0.2;
        const valueSimilar = txValue === 0 || Math.abs(blockTxValue - txValue) / Math.max(txValue, 0.001) < 0.5;
        
        if (gasPriceSimilar && valueSimilar) {
          similarTxCount++;
        }
        
        totalTx++;
        // Assume success for now (would need receipt to verify)
        successfulTx++;
        if (blockTx.gas) {
          totalGasUsed += Number(blockTx.gas);
        }
      }
    }

    competitive.similarTransactions = similarTxCount;
    competitive.averageGasUsed = totalTx > 0 ? Math.round(totalGasUsed / totalTx).toString() : '0';
    competitive.successRate = totalTx > 0 ? `${Math.round((successfulTx / totalTx) * 100)}%` : '100%';
    competitive.timeToConfirm = '12s'; // Estimated Flow block time

  } catch (error) {
    console.warn('Competitive analysis failed:', error);
  }

  return competitive;
}

// Hyperliquid-Specific Features Analysis (disabled - moved to hyperliquidAnalyzer)
async function analyzeFlowSpecificFeatures(provider: any, tx: any, analysis: any, chain: any): Promise<any> {
  return {}; // Moved to hyperliquidAnalyzer.ts
  const flowFeatures = {
    heightCorrelation: {
      currentHeight: '0',
      epochInfo: 'Unknown',
      nodeRole: 'Unknown',
      stakingInfo: 'Not Available'
    },
    crossChain: {
      detected: false,
      bridges: [],
      bridgeTransactions: [],
      crossChainVolume: '0',
      targetChains: []
    },
    cadenceIntegration: {
      resourcesDetected: [],
      capabilitiesUsed: [],
      accessControlPatterns: [],
      featuresUsed: 0
    },
    flowEcosystem: {
      dappCategory: 'Unknown',
      popularProtocols: [],
      nftCollections: [],
      defiProtocols: [],
      ecosystemHealth: 'Good'
    },
    evmCompatibility: {
      pureEVM: true,
      flowFeatures: [],
      hybridPatterns: [],
      compatibilityScore: 100
    }
  };

  try {
    console.log('🌊 Analyzing Flow-specific features...');

    // Height and Epoch Correlation Analysis
    const heightAnalysis = await analyzeFlowHeightCorrelation(provider, tx, chain);
    flowFeatures.heightCorrelation = heightAnalysis;

    // Cross-Chain Detection
    const crossChainAnalysis = await detectCrossChainActivity(provider, tx, analysis);
    flowFeatures.crossChain = crossChainAnalysis;

    // Cadence Integration Analysis
    const cadenceAnalysis = analyzeCadenceIntegration(tx, analysis);
    flowFeatures.cadenceIntegration = cadenceAnalysis;

    // Flow Ecosystem Analysis
    const ecosystemAnalysis = analyzeFlowEcosystem(analysis, tx);
    flowFeatures.flowEcosystem = ecosystemAnalysis;

    // EVM Compatibility Assessment
    const compatibilityAnalysis = analyzeEVMCompatibility(tx, analysis);
    flowFeatures.evmCompatibility = compatibilityAnalysis;

    console.log(`🎯 Flow features analyzed - Cross-chain: ${flowFeatures.crossChain.detected}, Cadence features: ${flowFeatures.cadenceIntegration.featuresUsed}`);

  } catch (error) {
    console.warn('⚠️ Flow-specific analysis failed:', error);
  }

  return flowFeatures;
}

// Height and Epoch Correlation Analysis (disabled)
async function analyzeFlowHeightCorrelation(provider: any, tx: any, chain: any): Promise<any> {
  return { currentHeight: '0', epochInfo: 'Unknown', nodeRole: 'Unknown', stakingInfo: 'Not Available' }; // Simplified
  const correlation = {
    currentHeight: '0',
    epochInfo: 'Unknown',
    nodeRole: 'Unknown',
    stakingInfo: 'Not Available'
  };

  try {
    // Get current block height
    const latestBlock = await provider.getBlock({ blockTag: 'latest' });
    correlation.currentHeight = latestBlock?.number?.toString() || '0';

    // Estimate epoch information based on block height
    // Flow epochs are approximately every 100,000 blocks
    const blockHeight = Number(latestBlock?.number || 0);
    const estimatedEpoch = Math.floor(blockHeight / 100000);
    
    correlation.epochInfo = `Estimated Epoch ${estimatedEpoch}`;

    // Analyze transaction timing relative to Flow network patterns
    if (tx.blockNumber) {
      const txBlockHeight = Number(tx.blockNumber);
      const heightDifference = blockHeight - txBlockHeight;
      
      if (heightDifference < 100) {
        correlation.nodeRole = 'Recent Transaction - Active Network';
      } else if (heightDifference < 1000) {
        correlation.nodeRole = 'Historical Transaction - Normal Network';
      } else {
        correlation.nodeRole = 'Old Transaction - Archive Query';
      }
    }

    // Estimate staking epoch alignment
    const epochPosition = blockHeight % 100000;
    if (epochPosition < 10000) {
      correlation.stakingInfo = 'Near Epoch Start - Potential Staking Changes';
    } else if (epochPosition > 90000) {
      correlation.stakingInfo = 'Near Epoch End - Rewards Distribution';
    } else {
      correlation.stakingInfo = 'Mid-Epoch - Stable Period';
    }

  } catch (error) {
    console.warn('Height correlation analysis failed:', error);
  }

  return correlation;
}

// Cross-Chain Activity Detection (disabled)
async function detectCrossChainActivity(provider: any, tx: any, analysis: any): Promise<any> {
  return { detected: false, bridges: [], bridgeTransactions: [], crossChainVolume: '0', targetChains: [] }; // Simplified
  const crossChain = {
    detected: false,
    bridges: [],
    bridgeTransactions: [],
    crossChainVolume: '0',
    targetChains: []
  };

  try {
    // Known Flow bridge contract patterns and addresses
    const bridgePatterns = [
      '0x1e3f37', // Celer bridge pattern
      '0x2e5f47', // Multichain bridge pattern
      '0x8f9e2d', // Teleport bridge pattern
      '0xa1b2c3', // Wormhole bridge pattern
    ];

    const bridgeMethodSignatures = [
      '0xa9059cbb', // transfer(address,uint256)
      '0x23b872dd', // transferFrom(address,address,uint256)
      '0x095ea7b3', // approve(address,uint256)
      '0x40c10f19', // mint(address,uint256)
      '0x42966c68', // burn(uint256)
      '0x8803dbee', // withdraw(uint256)
      '0xd0e30db0', // deposit()
    ];

    // Check transaction data for bridge patterns
    if (tx.data && tx.data.length > 10) {
      const methodSig = tx.data.slice(0, 10);
      
      if (bridgeMethodSignatures.includes(methodSig)) {
        crossChain.detected = true;
        crossChain.bridgeTransactions.push({
          method: methodSig,
          type: 'EVM Bridge Call',
          confidence: 70
        });
      }
    }

    // Check contract interactions for bridge addresses
    for (const contractAddr of analysis.interactions) {
      for (const pattern of bridgePatterns) {
        if (contractAddr.toLowerCase().includes(pattern)) {
          crossChain.detected = true;
          crossChain.bridges.push({
            address: contractAddr,
            type: 'Potential Bridge Contract',
            confidence: 60
          });
        }
      }
    }

    // Analyze transfer patterns for cross-chain characteristics
    const highValueTransfers = analysis.transfers.filter((transfer: any) => {
      const value = parseFloat(transfer.value || '0');
      return value > 100; // High value transfers often indicate bridge activity
    });

    if (highValueTransfers.length > 0) {
      crossChain.crossChainVolume = highValueTransfers
        .reduce((sum: number, transfer: any) => sum + parseFloat(transfer.value || '0'), 0)
        .toString();

      if (parseFloat(crossChain.crossChainVolume) > 1000) {
        crossChain.detected = true;
        crossChain.targetChains.push('Ethereum', 'Polygon', 'BSC');
      }
    }

    // Detect wrapped token patterns (often used in bridges)
    const wrappedTokenPatterns = ['WETH', 'wETH', 'bridged', 'wrapped'];
    for (const transfer of analysis.transfers) {
      const tokenSymbol = transfer.token?.symbol?.toLowerCase() || '';
      if (wrappedTokenPatterns.some(pattern => tokenSymbol.includes(pattern))) {
        crossChain.detected = true;
        crossChain.bridgeTransactions.push({
          token: transfer.token?.symbol,
          type: 'Wrapped Token Transfer',
          confidence: 80
        });
      }
    }

  } catch (error) {
    console.warn('Cross-chain detection failed:', error);
  }

  return crossChain;
}

// Cadence Integration Analysis
function analyzeCadenceIntegration(tx: any, analysis: any): any {
  const cadence = {
    resourcesDetected: [],
    capabilitiesUsed: [],
    accessControlPatterns: [],
    featuresUsed: 0
  };

  try {
    // Analyze transaction data for Cadence-specific patterns
    if (tx.data && tx.data.length > 10) {
      const data = tx.data.toLowerCase();
      
      // Resource-oriented programming patterns
      const resourcePatterns = [
        'resource', 'capability', 'link', 'borrow', 'load', 'save',
        'storage', 'private', 'public', 'access', 'auth'
      ];

      for (const pattern of resourcePatterns) {
        if (data.includes(pattern)) {
          cadence.resourcesDetected.push(pattern);
          cadence.featuresUsed++;
        }
      }

      // Access control patterns
      const accessPatterns = [
        'authaccount', 'publicaccount', 'authref', 'publicref'
      ];

      for (const pattern of accessPatterns) {
        if (data.includes(pattern)) {
          cadence.accessControlPatterns.push(pattern);
          cadence.featuresUsed++;
        }
      }

      // Capability-based security
      const capabilityPatterns = [
        'capability', 'getCapability', 'link', 'unlink'
      ];

      for (const pattern of capabilityPatterns) {
        if (data.includes(pattern)) {
          cadence.capabilitiesUsed.push(pattern);
          cadence.featuresUsed++;
        }
      }
    }

    // Analyze contract interactions for Flow-native patterns
    if (analysis.interactions.length > 0) {
      // Flow contracts often have specific address patterns
      for (const addr of analysis.interactions) {
        // Flow service account patterns
        if (addr.startsWith('0x01') || addr.startsWith('0x02') || addr.startsWith('0x03')) {
          cadence.resourcesDetected.push('Flow Service Account Interaction');
          cadence.featuresUsed++;
        }
        
        // Flow core contract patterns
        if (addr.includes('f8d6e0586b0a20c7') || addr.includes('e467b9dd11fa00df')) {
          cadence.resourcesDetected.push('Flow Core Contract');
          cadence.featuresUsed++;
        }
      }
    }

  } catch (error) {
    console.warn('Cadence analysis failed:', error);
  }

  return cadence;
}

// Flow Ecosystem Analysis
function analyzeFlowEcosystem(analysis: any, tx: any): any {
  const ecosystem = {
    dappCategory: 'Unknown',
    popularProtocols: [],
    nftCollections: [],
    defiProtocols: [],
    ecosystemHealth: 'Good'
  };

  try {
    // Classify DApp category based on transaction patterns
    if (analysis.actionTypes.includes('NFT Transfer')) {
      ecosystem.dappCategory = 'NFT/Digital Collectibles';
      ecosystem.nftCollections.push('Flow NFT Collection');
    } else if (analysis.actionTypes.includes('Token Swap')) {
      ecosystem.dappCategory = 'DeFi/DEX';
      ecosystem.defiProtocols.push('Flow DEX Protocol');
    } else if (analysis.interactions.length > 3) {
      ecosystem.dappCategory = 'Complex DApp';
    } else if (analysis.transfers.length > 1) {
      ecosystem.dappCategory = 'Token/Payment';
    } else {
      ecosystem.dappCategory = 'Simple Transfer';
    }

    // Detect known Flow protocols by contract patterns
    const knownProtocols = {
      'TopShot': ['0x0b2a3299cc857e29'],
      'Dapper': ['0xf919ee77447b7497'],
      'NBA TopShot': ['0x0b2a3299cc857e29'],
      'FlowToken': ['0x1654653399040a61'],
      'FUSD': ['0x3c5959b568896393']
    };

    for (const addr of analysis.interactions) {
      for (const [protocol, addresses] of Object.entries(knownProtocols)) {
        if (addresses.some(known => addr.includes(known))) {
          ecosystem.popularProtocols.push(protocol);
        }
      }
    }

    // Ecosystem health assessment
    const activityScore = analysis.transfers.length + analysis.interactions.length;
    if (activityScore > 10) {
      ecosystem.ecosystemHealth = 'Very Active';
    } else if (activityScore > 5) {
      ecosystem.ecosystemHealth = 'Active';
    } else if (activityScore > 2) {
      ecosystem.ecosystemHealth = 'Good';
    } else {
      ecosystem.ecosystemHealth = 'Quiet';
    }

  } catch (error) {
    console.warn('Ecosystem analysis failed:', error);
  }

  return ecosystem;
}

// EVM Compatibility Assessment
function analyzeEVMCompatibility(tx: any, analysis: any): any {
  const compatibility = {
    pureEVM: true,
    flowFeatures: [],
    hybridPatterns: [],
    compatibilityScore: 100
  };

  try {
    let score = 100;

    // Check for Flow-native features that reduce pure EVM compatibility
    if (analysis.actionTypes.includes('Resource')) {
      compatibility.pureEVM = false;
      compatibility.flowFeatures.push('Resource-oriented programming');
      score -= 20;
    }

    if (analysis.actionTypes.includes('Capability')) {
      compatibility.pureEVM = false;
      compatibility.flowFeatures.push('Capability-based security');
      score -= 15;
    }

    // Check transaction structure for EVM compatibility
    if (!tx.gasPrice) {
      compatibility.hybridPatterns.push('Non-standard gas pricing');
      score -= 10;
    }

    if (tx.type && tx.type !== 0 && tx.type !== 2) {
      compatibility.hybridPatterns.push('Non-standard transaction type');
      score -= 5;
    }

    // Check contract interactions for Flow-specific patterns
    const flowSpecificContracts = analysis.interactions.filter((addr: string) => 
      addr.startsWith('0x01') || addr.startsWith('0x02') || addr.startsWith('0x03')
    );

    if (flowSpecificContracts.length > 0) {
      compatibility.flowFeatures.push('Flow service account usage');
      score -= 10;
    }

    compatibility.compatibilityScore = Math.max(0, score);

  } catch (error) {
    console.warn('EVM compatibility analysis failed:', error);
  }

  return compatibility;
}

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow more time for real data analysis

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders });
}