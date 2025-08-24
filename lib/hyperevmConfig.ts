import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { hyperEvmTestnet, hyperEvmMainnet } from 'viem/chains';

// HyperEVM Configuration
export const HYPEREVM_TESTNET_CHAIN = {
  id: 998,
  name: 'HyperEVM Testnet',
  network: 'hyperevm-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://api.hyperliquid-testnet.xyz/evm'] },
    default: { http: ['https://api.hyperliquid-testnet.xyz/evm'] },
  },
  blockExplorers: {
    default: { name: 'HyperEVM Testnet Explorer', url: 'https://explorer.hyperliquid-testnet.xyz' },
  },
};

export const HYPEREVM_MAINNET_CHAIN = {
  id: 42161,
  name: 'HyperEVM',
  network: 'hyperevm',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://api.hyperliquid.xyz/evm'] },
    default: { http: ['https://api.hyperliquid.xyz/evm'] },
  },
  blockExplorers: {
    default: { name: 'HyperEVM Explorer', url: 'https://explorer.hyperliquid.xyz' },
  },
};

// Use testnet by default, switch to mainnet for production
export const CURRENT_CHAIN = process.env.NODE_ENV === 'production' ? HYPEREVM_MAINNET_CHAIN : HYPEREVM_TESTNET_CHAIN;

// Create clients for HyperEVM
export const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(),
});

export const getWalletClient = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return createWalletClient({
      chain: CURRENT_CHAIN,
      transport: custom(window.ethereum),
    });
  }
  return null;
};

// Contract addresses - update after deployment
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x742d35Cc6634C0532925a3b8D1A4E7c65dfc4b4e"; // placeholder HyperEVM address

// Initialize user's Analyst profile if it doesn't exist
export const initializeAnalyst = async () => {
  try {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('Wallet not connected');

    const [account] = await walletClient.requestAddresses();
    
    // Check if user is already initialized by calling a read function
    const isInitialized = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI,
      functionName: 'isAnalystInitialized',
      args: [account],
    });

    if (!isInitialized) {
      // Initialize the analyst profile
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: contractABI,
        functionName: 'initializeAnalyst',
        account,
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt;
    }
    
    return { status: 'already_initialized' };
  } catch (error) {
    console.error('Error initializing analyst:', error);
    throw error;
  }
};

// Smart contract interaction functions
export const saveAnalysisToContract = async (
  txHash: string,
  aiSummary: string,
  riskScore: number,
  insights: string[],
  isPublic: boolean
) => {
  try {
    // First ensure user has Analyst profile
    await initializeAnalyst();
    
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('Wallet not connected');

    const [account] = await walletClient.requestAddresses();
    
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI,
      functionName: 'storeAnalysis',
      args: [txHash, aiSummary, riskScore, insights, isPublic],
      account,
    });

    console.log('Transaction hash:', hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt;
  } catch (error) {
    console.error('Error saving analysis:', error);
    throw error;
  }
};

export const getUserProfile = async (address: string) => {
  try {
    const profile = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI,
      functionName: 'getUserProfile',
      args: [address as `0x${string}`],
    });

    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

export const likeAnalysis = async (txHash: string, analystAddress: string) => {
  try {
    // First ensure user has Analyst profile
    await initializeAnalyst();
    
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('Wallet not connected');

    const [account] = await walletClient.requestAddresses();
    
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI,
      functionName: 'likeAnalysis',
      args: [txHash, analystAddress as `0x${string}`],
      account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt;
  } catch (error) {
    console.error('Error liking analysis:', error);
    throw error;
  }
};

// Get a public analysis by transaction hash and analyst address
export const getPublicAnalysis = async (txHash: string, analystAddress: string) => {
  try {
    const analysis = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI,
      functionName: 'getPublicAnalysis',
      args: [txHash, analystAddress as `0x${string}`],
    });

    return analysis;
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return null;
  }
};

// Get all public analyses (for discovery feed)
export const getPublicAnalyses = async () => {
  try {
    const analyses = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI,
      functionName: 'getPublicAnalyses',
    });

    return analyses;
  } catch (error) {
    console.error('Error fetching public analyses:', error);
    return [];
  }
};

// Get contract statistics
export const getContractStats = async () => {
  try {
    const stats = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI,
      functionName: 'getStats',
    });

    return stats;
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    return null;
  }
};

// Update user profile
export const updateUserProfile = async (username: string) => {
  try {
    const walletClient = getWalletClient();
    if (!walletClient) throw new Error('Wallet not connected');

    const [account] = await walletClient.requestAddresses();
    
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: contractABI,
      functionName: 'updateProfile',
      args: [username],
      account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

// Contract ABI - Replace with your actual contract ABI
export const contractABI = [
  // Add your HyperEVM smart contract ABI here
  {
    "inputs": [],
    "name": "initializeAnalyst",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "isAnalystInitialized",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "txHash", "type": "string" },
      { "internalType": "string", "name": "aiSummary", "type": "string" },
      { "internalType": "uint8", "name": "riskScore", "type": "uint8" },
      { "internalType": "string[]", "name": "insights", "type": "string[]" },
      { "internalType": "bool", "name": "isPublic", "type": "bool" }
    ],
    "name": "storeAnalysis",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Add more ABI functions as needed
] as const;

// Authentication helpers
export const authenticate = async () => {
  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('Wallet not available');
  
  const accounts = await walletClient.requestAddresses();
  return accounts[0];
};

export const getCurrentUser = async () => {
  const walletClient = getWalletClient();
  if (!walletClient) return null;
  
  try {
    const accounts = await walletClient.getAddresses();
    return accounts[0] || null;
  } catch {
    return null;
  }
};

// Check if wallet is connected
export const isWalletConnected = () => {
  return typeof window !== 'undefined' && window.ethereum;
};