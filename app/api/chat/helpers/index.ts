export function serializeBigInts(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
  
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
  
    if (Array.isArray(obj)) {
      return obj.map(item => serializeBigInts(item));
    }
  
    if (typeof obj === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = serializeBigInts(value);
      }
      return serialized;
    }
  
    return obj;
  }

export function formatFlowAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatFlowAmount(amount: string | number, decimals: number = 18): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (num === 0) return '0';
    if (num < 0.000001) return '< 0.000001';
    return num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6
    });
}

export function isValidFlowAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidFlowTxHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function getFlowNetworkName(chainId: number): string {
    switch (chainId) {
        case 42161:
            return 'HyperEVM Mainnet';
        case 998:
            return 'HyperEVM Testnet';
        default:
            return `Unknown Flow Network (${chainId})`;
    }
}

export function getFlowExplorerUrl(chainId: number, type: 'tx' | 'address' | 'block', value: string): string {
    const baseUrl = chainId === 42161 
        ? 'https://evm.flowscan.io' 
        : 'https://evm-testnet.flowscan.io';
    
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