export interface Chain {
    name: string;
    chainId: number;
    shortName?: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    goldsky: {
      endpoint: string;
      apiKey?: string;
    };
    blockExplorer?: string;
    testnet?: boolean;
}

import { GoldskyDataService } from './goldskyDataService';

// Goldsky GraphQL client interface
export interface GoldskyClient {
  query: (query: string, variables?: any) => Promise<any>;
  endpoint: string;
  dataService?: GoldskyDataService;
}
  
// Chain data management for Hyperliquid Network using Goldsky
export class ChainManager {
    private static instance: ChainManager;
    private chains: Chain[] = [];
    private clientCache: Map<number, GoldskyClient> = new Map();
    private dataServiceCache: GoldskyDataService | null = null;
    
    // Hyperliquid networks configuration with Goldsky indexing
    private readonly HYPERLIQUID_CHAINS: Chain[] = [
      {
        name: 'Hyperliquid Mainnet',
        chainId: 998, // Hyperliquid chain ID
        shortName: 'hyperliquid-mainnet',
        nativeCurrency: {
          name: 'USDC',
          symbol: 'USDC',
          decimals: 6,
        },
        goldsky: {
          endpoint: 'https://api.goldsky.com/api/public/project_cmep70awt7ly01wbgxmc0d3j/subgraphs/hyperevm-enriched-transactions/latest/gn',
          apiKey: 'cmeo9f2bv8zjz01sobhnmatlm'
        },
        blockExplorer: 'https://app.hyperliquid.xyz/explorer',
        testnet: false
      },
      {
        name: 'Hyperliquid Testnet',
        chainId: 99998, // Hyperliquid testnet chain ID  
        shortName: 'hyperliquid-testnet',
        nativeCurrency: {
          name: 'USDC',
          symbol: 'USDC',
          decimals: 6,
        },
        goldsky: {
          endpoint: 'https://api.goldsky.com/api/public/project_cmep70awt7ly01wbgxmc0d3j/subgraphs/hyperevm-enriched-transactions/latest/gn',
          apiKey: 'cmeo9f2bv8zjz01sobhnmatlm'
        },
        blockExplorer: 'https://app.hyperliquid.xyz/explorer',
        testnet: true
      }
    ];
  
    private constructor() {
      this.chains = [...this.HYPERLIQUID_CHAINS];
    }
  
    static getInstance(): ChainManager {
      if (!ChainManager.instance) {
        ChainManager.instance = new ChainManager();
      }
      return ChainManager.instance;
    }
  
    async getChain(chainId: number): Promise<Chain | undefined> {
      return this.chains.find(chain => chain.chainId === chainId);
    }
  
    async getGoldskyClient(chainId: number): Promise<GoldskyClient> {
      // Check cache first for performance
      if (this.clientCache.has(chainId)) {
        return this.clientCache.get(chainId)!;
      }

      const chain = await this.getChain(chainId);
      if (!chain) {
        throw new Error(`Unsupported Hyperliquid chain ${chainId}. Supported chains: 998 (mainnet), 99998 (testnet)`);
      }
      
      if (!chain.goldsky?.endpoint) {
        throw new Error(`No Goldsky endpoint found for Hyperliquid chain ${chainId}`);
      }

      console.log(`🚀 Creating cached Goldsky client for chain ${chainId}`);
      
      // Create shared data service instance (connection pooling)
      if (!this.dataServiceCache) {
        if (!process.env.DATABASE_URL) {
          throw new Error('DATABASE_URL environment variable not configured');
        }
        this.dataServiceCache = new GoldskyDataService(process.env.DATABASE_URL);
      }
      
      const client: GoldskyClient = {
        endpoint: chain.goldsky.endpoint,
        dataService: this.dataServiceCache,
        query: async (query: string, variables?: any) => {
          try {
            const response = await fetch(chain.goldsky.endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(chain.goldsky.apiKey && {
                  'Authorization': `Bearer ${chain.goldsky.apiKey}`
                })
              },
              body: JSON.stringify({ query, variables })
            });
            
            if (!response.ok) {
              throw new Error(`Goldsky query failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.errors && data.errors.length > 0) {
              throw new Error(`GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}`);
            }
            
            return data.data;
          } catch (error) {
            console.error(`❌ Goldsky query failed:`, error);
            throw error;
          }
        }
      };

      // Cache the client for reuse
      this.clientCache.set(chainId, client);
      
      // Only test connection once when creating the cache
      if (this.clientCache.size === 1) {
        try {
          console.log('🔍 Testing cached PostgreSQL connection...');
          await this.dataServiceCache.query('SELECT 1 as test');
          console.log(`✅ Cached PostgreSQL connection ready`);
        } catch (error) {
          console.warn(`⚠️ PostgreSQL connection test failed:`, error);
        }
      }
      
      return client;
    }
    
    getAllChains(): Chain[] {
      return [...this.chains];
    }
    
    getMainnetChain(): Chain {
      return this.HYPERLIQUID_CHAINS[0]; // Hyperliquid Mainnet
    }
    
    getTestnetChain(): Chain {
      return this.HYPERLIQUID_CHAINS[1]; // Hyperliquid Testnet
    }
    
    isTestnet(chainId: number): boolean {
      const chain = this.chains.find(c => c.chainId === chainId);
      return chain?.testnet || false;
    }
    
    // Additional utility methods for Hyperliquid
    getExplorerUrl(chainId: number, type: 'tx' | 'address' | 'block', value: string): string {
      const chain = this.chains.find(c => c.chainId === chainId);
      const baseUrl = chain?.blockExplorer || (chainId === 998 
        ? 'https://app.hyperliquid.xyz/explorer' 
        : 'https://app.hyperliquid.xyz/explorer');
      
      switch (type) {
        case 'tx':
          return `${baseUrl}/tx/${value}`;
        case 'address':
          return `${baseUrl}/address/${value}`;
        case 'block':
          return `${baseUrl}/block/${value}`;
        default:
          return baseUrl;
      }
    }
    
    formatHyperliquidAddress(address: string): string {
      if (!address) return '';
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    // Clear cache method for cleanup
    clearCache(): void {
      this.clientCache.clear();
      this.dataServiceCache = null;
    }

    // Goldsky-specific queries for HyperEVM data using the cached data service
    async getTransactionData(chainId: number, txHash: string) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const tx = await client.dataService.getTransactionByHash(txHash);
          
          if (tx) {
            return {
              transaction: {
                id: tx.id,
                hash: tx.hash,
                blockNumber: tx.block_number.toString(),
                blockTimestamp: tx.block_timestamp.toString(),
                from: tx.from_address,
                to: tx.to_address,
                value: tx.value?.toString() || '0',
                gasLimit: tx.gas?.toString() || '0',
                gasPrice: tx.gas_price?.toString() || '0',
                gasUsed: tx.receipt_gas_used?.toString() || '0',
                status: tx.receipt_status === 1,
                input: tx.input || '0x',
                nonce: tx.nonce,
                transactionType: tx.transaction_type
              }
            };
          }
        } catch (error) {
          console.error('Error with Goldsky data service:', error);
        }
      }
      
      return null;
    }

    async getLatestBlocks(chainId: number, limit: number = 10) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const blocks = await client.dataService.getLatestBlocks(limit);
          
          return {
            blocks: blocks.map((block) => ({
              id: block.id,
              number: block.number,
              hash: block.hash,
              timestamp: block.timestamp,
              gasUsed: block.gas_used?.toString() || '0',
              gasLimit: block.gas_limit?.toString() || '0',
              transactionCount: block.transaction_count || 0,
              miner: block.miner
            }))
          };
        } catch (error) {
          console.error('Error fetching blocks with Goldsky data service:', error);
        }
      }
      
      return { blocks: [] };
    }

    async getBlockByNumber(chainId: number, blockNumber: string | number) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const block = await client.dataService.getBlockByNumber(blockNumber);
          
          if (block) {
            return {
              block: {
                number: block.number,
                hash: block.hash,
                parent_hash: block.parent_hash,
                timestamp: block.timestamp,
                gas_used: block.gas_used,
                gas_limit: block.gas_limit,
                transaction_count: block.transaction_count,
                miner: block.miner,
                size: block.size,
                base_fee_per_gas: block.base_fee_per_gas,
                difficulty: block.difficulty,
                total_difficulty: block.total_difficulty
              }
            };
          }
        } catch (error) {
          console.error('Error fetching block by number:', error);
        }
      }
      
      return null;
    }

    async getRecentTransactions(chainId: number, limit: number = 20) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const transactions = await client.dataService.getRecentTransactions(limit);
          
          return {
            transactions: transactions.map((tx) => ({
              id: tx.id,
              hash: tx.hash,
              blockNumber: tx.block_number,
              blockTimestamp: tx.block_timestamp,
              from: tx.from_address,
              to: tx.to_address,
              value: tx.value?.toString() || '0',
              gasPrice: tx.gas_price?.toString() || '0',
              gasUsed: tx.receipt_gas_used?.toString() || '0',
              status: tx.receipt_status === 1 ? 'Success' : 'Failed'
            }))
          };
        } catch (error) {
          console.error('Error fetching transactions with Goldsky data service:', error);
        }
      }
      
      return { transactions: [] };
    }

    async getAddressInfo(chainId: number, address: string) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const [transactions, analytics] = await Promise.all([
            client.dataService.getAddressTransactions(address, 10),
            client.dataService.getAddressAnalytics(address).catch(() => null)
          ]);
          
          // Calculate totals from transaction history
          let totalValueSent = '0';
          let totalValueReceived = '0';
          
          transactions.forEach((tx) => {
            const value = parseFloat(tx.value || '0');
            if (tx.from_address?.toLowerCase() === address.toLowerCase()) {
              totalValueSent = (parseFloat(totalValueSent) + value).toString();
            }
            if (tx.to_address?.toLowerCase() === address.toLowerCase()) {
              totalValueReceived = (parseFloat(totalValueReceived) + value).toString();
            }
          });
          
          return {
            address: {
              id: address,
              transactionCount: transactions.length,
              totalValueSent,
              totalValueReceived,
              balances: analytics?.balances || [],
              analytics: analytics || null
            },
            transactions: transactions.map((tx) => ({
              id: tx.id,
              hash: tx.hash,
              blockNumber: tx.block_number,
              blockTimestamp: tx.block_timestamp,
              from: tx.from_address,
              to: tx.to_address,
              value: tx.value?.toString() || '0',
              gasPrice: tx.gas_price?.toString() || '0',
              gasUsed: tx.receipt_gas_used?.toString() || '0',
              status: tx.receipt_status === 1 ? 'Success' : 'Failed'
            }))
          };
        } catch (error) {
          console.error('Error fetching address info with Goldsky data service:', error);
        }
      }
      
      return null;
    }

    // Get transaction logs
    async getTransactionLogs(chainId: number, txHash: string) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const logs = await client.dataService.getTransactionLogs(txHash);
          return {
            logs: logs.map(log => ({
              address: log.address,
              topics: log.topics,
              data: log.data,
              logIndex: log.log_index,
              blockNumber: log.block_number,
              transactionHash: log.transaction_hash
            }))
          };
        } catch (error) {
          console.error('Error fetching transaction logs:', error);
        }
      }
      
      return { logs: [] };
    }

    // Get contract activity
    async getContractActivity(chainId: number, contractAddress: string, limit: number = 10) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const logs = await client.dataService.getContractLogs(contractAddress, limit);
          return {
            logs: logs.map(log => ({
              transactionHash: log.transaction_hash,
              blockNumber: log.block_number,
              logIndex: log.log_index,
              topics: log.topics,
              data: log.data,
              blockTimestamp: log.block_timestamp
            }))
          };
        } catch (error) {
          console.error('Error fetching contract activity:', error);
        }
      }
      
      return { logs: [] };
    }

    // Get comprehensive transaction analysis using all data sources
    async getComprehensiveTransactionData(chainId: number, txHash: string) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const enrichedData = await client.dataService.getEnrichedTransactionData(txHash);
          return enrichedData;
        } catch (error) {
          console.error('Error fetching comprehensive transaction data:', error);
        }
      }
      
      return null;
    }

    // Get real-time network overview
    async getNetworkOverview(chainId: number) {
      const client = await this.getGoldskyClient(chainId);
      
      if (client.dataService) {
        try {
          const overview = await client.dataService.getNetworkOverview();
          return overview;
        } catch (error) {
          console.error('Error fetching network overview:', error);
        }
      }
      
      return null;
    }
}