/**
 * AI Data Processor - Structures real data for optimal AI analysis
 * Converts raw database results into AI-friendly formatted strings
 */

export class AIDataProcessor {
  
  /**
   * Convert transaction data into structured AI input format
   */
  static formatTransactionForAI(analysisData: any): string {
    const sections = [];
    
    // Network Section
    sections.push(`=== NETWORK INFORMATION ===`);
    sections.push(`Network: ${analysisData.network.name}`);
    sections.push(`Chain ID: ${analysisData.network.chainId}`);
    sections.push(`Currency: ${analysisData.network.currency}`);
    sections.push(`Network Health: ${analysisData.network.health}`);
    sections.push('');
    
    // Core Transaction Data
    sections.push(`=== TRANSACTION DETAILS ===`);
    sections.push(`Hash: ${analysisData.transaction.hash}`);
    sections.push(`Block: #${analysisData.transaction.blockNumber} (${analysisData.transaction.blockTimestamp})`);
    sections.push(`Position: Index ${analysisData.transaction.transactionIndex} in block`);
    sections.push(`From: ${analysisData.transaction.from}`);
    sections.push(`To: ${analysisData.transaction.to}`);
    sections.push(`Value: ${analysisData.transaction.value} USDC`);
    sections.push(`Status: ${analysisData.transaction.status}`);
    sections.push(`Type: ${analysisData.analysis.transactionType}`);
    sections.push(`Value Category: ${analysisData.analysis.valueCategory}`);
    sections.push('');
    
    // Gas Analysis
    sections.push(`=== GAS ANALYSIS ===`);
    sections.push(`Gas Used: ${analysisData.transaction.gasUsed}`);
    sections.push(`Gas Limit: ${analysisData.transaction.gasLimit}`);
    sections.push(`Gas Price: ${analysisData.transaction.gasPrice} GWEI`);
    sections.push(`Effective Gas Price: ${analysisData.transaction.effectiveGasPrice} GWEI`);
    sections.push(`Total Cost: ${analysisData.transaction.totalCost} ETH equivalent`);
    sections.push(`Gas Efficiency: ${analysisData.analysis.gasEfficiency}`);
    sections.push('');
    
    // Block Context
    sections.push(`=== BLOCK CONTEXT ===`);
    sections.push(`Block Hash: ${analysisData.blockContext.hash}`);
    sections.push(`Block Gas Used: ${analysisData.blockContext.gasUsed} / ${analysisData.blockContext.gasLimit}`);
    sections.push(`Block Utilization: ${analysisData.blockContext.utilization.toFixed(2)}%`);
    sections.push(`Base Fee: ${analysisData.blockContext.baseFeePerGas} GWEI`);
    sections.push(`Miner: ${analysisData.blockContext.miner}`);
    sections.push(`Block Size: ${analysisData.blockContext.size} bytes`);
    sections.push(`Total Transactions: ${analysisData.blockContext.transactionCount}`);
    sections.push('');
    
    // Address Activity
    sections.push(`=== ADDRESS ACTIVITY ===`);
    sections.push(`From Address Activity:`);
    sections.push(`  - Address: ${analysisData.addressActivity.fromAddress.address}`);
    sections.push(`  - Total Transactions: ${analysisData.addressActivity.fromAddress.transactionCount}`);
    sections.push(`  - Activity Level: ${analysisData.addressActivity.fromAddress.activityLevel}`);
    sections.push(`To Address Activity:`);
    sections.push(`  - Address: ${analysisData.addressActivity.toAddress.address}`);
    sections.push(`  - Total Transactions: ${analysisData.addressActivity.toAddress.transactionCount}`);
    sections.push(`  - Activity Level: ${analysisData.addressActivity.toAddress.activityLevel}`);
    sections.push('');
    
    // Network Metrics
    sections.push(`=== NETWORK METRICS ===`);
    sections.push(`Average Gas Price: ${analysisData.networkMetrics.averageGasPrice} GWEI`);
    sections.push(`Network TPS: ${analysisData.networkMetrics.networkTPS}`);
    sections.push(`Network Health: ${analysisData.networkMetrics.networkHealth}`);
    sections.push(`Congestion Level: ${analysisData.networkMetrics.congestionLevel}`);
    sections.push('');
    
    // Contract Interaction Analysis
    sections.push(`=== CONTRACT INTERACTIONS ===`);
    if (analysisData.analysis.isContractInteraction) {
      sections.push(`Contract Call Detected: YES`);
      sections.push(`Function Selector: ${analysisData.analysis.contractFunction || 'Unknown'}`);
      sections.push(`Input Data Length: ${analysisData.transaction.input.length} characters`);
    } else {
      sections.push(`Contract Call Detected: NO`);
      sections.push(`Transaction Type: Simple transfer`);
    }
    sections.push('');
    
    // Hyperliquid-Specific Analysis
    sections.push(`=== HYPERLIQUID ANALYSIS ===`);
    sections.push(`DEX Activity:`);
    sections.push(`  - Is DEX Transaction: ${analysisData.hyperliquidAnalysis.dexActivity.isDexTransaction}`);
    sections.push(`  - Estimated Volume: ${analysisData.hyperliquidAnalysis.dexActivity.estimatedVolume}`);
    sections.push(`  - DEX Type: ${analysisData.hyperliquidAnalysis.dexActivity.dexType}`);
    sections.push(`Perpetuals Trading:`);
    sections.push(`  - Has Perp Activity: ${analysisData.hyperliquidAnalysis.perpTradingSignals.hasPerpActivity}`);
    sections.push(`  - Position Type: ${analysisData.hyperliquidAnalysis.perpTradingSignals.positionType}`);
    sections.push(`  - Leverage Indicators: ${analysisData.hyperliquidAnalysis.perpTradingSignals.leverageIndicators.join(', ') || 'None'}`);
    sections.push(`Liquidity Events:`);
    sections.push(`  - Has Liquidity Activity: ${analysisData.hyperliquidAnalysis.liquidityEvents.hasLiquidityActivity}`);
    sections.push(`  - Liquidity Type: ${analysisData.hyperliquidAnalysis.liquidityEvents.liquidityType}`);
    sections.push(`  - Estimated Amount: ${analysisData.hyperliquidAnalysis.liquidityEvents.estimatedAmount} USDC`);
    sections.push(`Trading Patterns:`);
    sections.push(`  - Trading Style: ${analysisData.hyperliquidAnalysis.tradingPatterns.tradingStyle}`);
    sections.push(`  - Frequency: ${analysisData.hyperliquidAnalysis.tradingPatterns.frequency}`);
    sections.push(`  - Sophistication: ${analysisData.hyperliquidAnalysis.tradingPatterns.sophistication}`);
    sections.push(`Risk Assessment:`);
    sections.push(`  - Risk Level: ${analysisData.hyperliquidAnalysis.riskAssessment.riskLevel}`);
    sections.push(`  - Risk Factors: ${analysisData.hyperliquidAnalysis.riskAssessment.riskFactors.join(', ') || 'None'}`);
    sections.push(`  - Risk Score: ${analysisData.hyperliquidAnalysis.riskAssessment.riskScore}/100`);
    sections.push('');
    
    // Summary for AI Context
    sections.push(`=== ANALYSIS SUMMARY ===`);
    sections.push(`This is a ${analysisData.analysis.valueCategory} ${analysisData.analysis.transactionType.toLowerCase()} on Hyperliquid ${analysisData.network.isMainnet ? 'Mainnet' : 'Testnet'}.`);
    sections.push(`The transaction ${analysisData.transaction.status === 'Success' ? 'executed successfully' : 'failed'} with ${analysisData.analysis.gasEfficiency.toLowerCase()} gas usage.`);
    sections.push(`Network conditions are ${analysisData.networkMetrics.networkHealth.toLowerCase()} with ${analysisData.networkMetrics.congestionLevel.toLowerCase()} congestion.`);
    if (analysisData.hyperliquidAnalysis.dexActivity.isDexTransaction || analysisData.hyperliquidAnalysis.perpTradingSignals.hasPerpActivity) {
      sections.push(`This appears to be active DeFi trading activity on Hyperliquid.`);
    }
    
    return sections.join('\n');
  }
  
  /**
   * Convert block data into structured AI input format
   */
  static formatBlockForAI(analysisData: any): string {
    const sections = [];
    
    // Network Section
    sections.push(`=== NETWORK INFORMATION ===`);
    sections.push(`Network: ${analysisData.network.name}`);
    sections.push(`Chain ID: ${analysisData.network.chainId}`);
    sections.push(`Currency: ${analysisData.network.currency}`);
    sections.push(`Network Health: ${analysisData.network.health}`);
    sections.push('');
    
    // Core Block Data
    sections.push(`=== BLOCK DETAILS ===`);
    sections.push(`Block Number: #${analysisData.block.number}`);
    sections.push(`Block Hash: ${analysisData.block.hash}`);
    sections.push(`Parent Hash: ${analysisData.block.parentHash}`);
    sections.push(`Timestamp: ${analysisData.block.timestamp}`);
    sections.push(`Miner/Validator: ${analysisData.block.miner}`);
    sections.push(`Block Size: ${analysisData.block.size} bytes`);
    sections.push(`Block Position: ${analysisData.block.position}`);
    sections.push(`Confirmations: ${analysisData.block.confirmations}`);
    sections.push('');
    
    // Gas and Performance
    sections.push(`=== BLOCK PERFORMANCE ===`);
    sections.push(`Gas Used: ${analysisData.block.gasUsed}`);
    sections.push(`Gas Limit: ${analysisData.block.gasLimit}`);
    sections.push(`Block Utilization: ${analysisData.block.utilization}`);
    sections.push(`Base Fee: ${analysisData.block.baseFeePerGas} GWEI`);
    sections.push(`Processing Time: ${analysisData.metrics.processingTime}`);
    sections.push(`Block Efficiency: ${analysisData.metrics.blockEfficiency}`);
    sections.push('');
    
    // Transaction Analysis
    sections.push(`=== TRANSACTION ANALYSIS ===`);
    sections.push(`Total Transactions: ${analysisData.transactions.total}`);
    sections.push(`Successful Transactions: ${analysisData.transactions.successful}`);
    sections.push(`Failed Transactions: ${analysisData.transactions.failed}`);
    sections.push(`Success Rate: ${((analysisData.transactions.successful / Math.max(analysisData.transactions.total, 1)) * 100).toFixed(2)}%`);
    sections.push(`Contract Interactions: ${analysisData.transactions.contractInteractions}`);
    sections.push(`Unique Addresses: ${analysisData.transactions.uniqueAddresses}`);
    sections.push('');
    
    // Network Metrics
    sections.push(`=== NETWORK METRICS ===`);
    sections.push(`Average Gas Price: ${analysisData.metrics.averageGasPrice} GWEI`);
    sections.push(`Total Value Transferred: ${analysisData.metrics.totalValue} USDC`);
    sections.push(`Network Health: ${analysisData.metrics.networkHealth}`);
    sections.push(`Average Value Per Transaction: ${(parseFloat(analysisData.metrics.totalValue.replace(/[^0-9.]/g, '')) / Math.max(analysisData.transactions.total, 1)).toFixed(6)} USDC`);
    sections.push('');
    
    // Transaction Patterns
    sections.push(`=== TRANSACTION PATTERNS ===`);
    sections.push(`Top Senders:`);
    analysisData.patterns.topSenders.slice(0, 5).forEach((sender: any, i: number) => {
      sections.push(`  ${i + 1}. ${sender.address} (${sender.transactionCount} txs, ${sender.totalValue} USDC, ${sender.significance})`);
    });
    sections.push(`Top Receivers:`);
    analysisData.patterns.topReceivers.slice(0, 5).forEach((receiver: any, i: number) => {
      sections.push(`  ${i + 1}. ${receiver.address} (${receiver.transactionCount} txs, ${receiver.totalValue} USDC, ${receiver.significance})`);
    });
    sections.push(`Gas Distribution:`);
    sections.push(`  - Low Gas Transactions: ${analysisData.patterns.gasDistribution.lowGas}`);
    sections.push(`  - Medium Gas Transactions: ${analysisData.patterns.gasDistribution.mediumGas}`);
    sections.push(`  - High Gas Transactions: ${analysisData.patterns.gasDistribution.highGas}`);
    sections.push(`  - Analysis: ${analysisData.patterns.gasDistribution.analysis}`);
    sections.push('');
    
    // Sample Transactions
    sections.push(`=== SAMPLE TRANSACTIONS ===`);
    analysisData.transactions.sampleTransactions.slice(0, 5).forEach((tx: any, i: number) => {
      sections.push(`Transaction ${i + 1}:`);
      sections.push(`  - Hash: ${tx.hash}`);
      sections.push(`  - From: ${tx.from} → To: ${tx.to}`);
      sections.push(`  - Value: ${tx.value} USDC`);
      sections.push(`  - Gas: ${tx.gasUsed} (${tx.gasPrice} GWEI)`);
      sections.push(`  - Status: ${tx.status}`);
      sections.push(`  - Contract Call: ${tx.isContractCall ? 'Yes' : 'No'}`);
      sections.push('');
    });
    
    // Hyperliquid-Specific Analysis
    sections.push(`=== HYPERLIQUID BLOCK ANALYSIS ===`);
    sections.push(`DEX Volume Estimate: ${analysisData.hyperliquidAnalysis.dexVolume}`);
    sections.push(`Perpetuals Activity:`);
    sections.push(`  - Estimated Perp Transactions: ${analysisData.hyperliquidAnalysis.perpActivity.estimatedPerpTransactions}`);
    sections.push(`  - Perp Activity Level: ${analysisData.hyperliquidAnalysis.perpActivity.perpActivityLevel}`);
    sections.push(`Liquidity Provision:`);
    sections.push(`  - Estimated Liquidity Operations: ${analysisData.hyperliquidAnalysis.liquidityProvision.estimatedLiquidityOps}`);
    sections.push(`  - Liquidity Health Score: ${analysisData.hyperliquidAnalysis.liquidityProvision.liquidityHealthScore}/100`);
    sections.push(`Network Stability: ${analysisData.hyperliquidAnalysis.networkStability}`);
    sections.push(`Market Conditions: ${analysisData.hyperliquidAnalysis.marketConditions}`);
    sections.push('');
    
    // Summary for AI Context
    sections.push(`=== BLOCK SUMMARY ===`);
    sections.push(`Block #${analysisData.block.number} on Hyperliquid ${analysisData.network.isMainnet ? 'Mainnet' : 'Testnet'} processed ${analysisData.transactions.total} transactions.`);
    sections.push(`Block utilization was ${analysisData.block.utilization} with ${analysisData.metrics.blockEfficiency} efficiency.`);
    sections.push(`Network conditions show ${analysisData.hyperliquidAnalysis.networkStability.toLowerCase()} stability and ${analysisData.hyperliquidAnalysis.marketConditions.toLowerCase()}.`);
    sections.push(`Transaction success rate: ${((analysisData.transactions.successful / Math.max(analysisData.transactions.total, 1)) * 100).toFixed(1)}%`);
    
    const totalValueNum = parseFloat(analysisData.metrics.totalValue.replace(/[^0-9.]/g, ''));
    if (totalValueNum > 100000) {
      sections.push(`High-value block with significant trading activity (${analysisData.metrics.totalValue} total value).`);
    } else if (totalValueNum > 10000) {
      sections.push(`Active trading block with moderate volume (${analysisData.metrics.totalValue} total value).`);
    } else {
      sections.push(`Standard block with normal trading activity (${analysisData.metrics.totalValue} total value).`);
    }
    
    return sections.join('\n');
  }
  
  /**
   * Create analysis directive for AI
   */
  static createAnalysisDirective(type: 'transaction' | 'block'): string {
    const baseDirective = `
CRITICAL ANALYSIS INSTRUCTIONS:
1. Use ONLY the real data provided above - no speculation or generic information
2. All numbers, addresses, hashes, and values must come from the provided data
3. Replace ALL placeholders in your response with actual values from the data
4. Provide comprehensive analysis covering all sections requested in the system prompt
5. Focus on Hyperliquid-specific features and patterns
6. Maintain professional, detailed analysis suitable for blockchain professionals

RESPONSE REQUIREMENTS:
- Include working Mermaid diagram with real data
- Provide complete analysis for every section in the system prompt
- Use actual transaction/block data throughout
- Highlight unique Hyperliquid features and insights
- Ensure all metrics and assessments are data-driven
`;

    if (type === 'transaction') {
      return baseDirective + `
TRANSACTION-SPECIFIC REQUIREMENTS:
- Use "graph LR" for transaction flow diagrams
- Include actual transaction hash, addresses, and amounts
- Analyze real gas usage and costs
- Focus on Hyperliquid DEX, perpetuals, and liquidity features
- Provide accurate risk assessment based on actual data
`;
    } else {
      return baseDirective + `
BLOCK-SPECIFIC REQUIREMENTS:
- Use "graph TD" for block structure diagrams
- Include actual block number, transaction count, and sample hashes
- Analyze real gas utilization and block efficiency
- Focus on network health and transaction patterns
- Provide comprehensive block-level insights
`;
    }
  }
}