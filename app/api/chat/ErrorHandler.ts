/**
 * Professional Error Handler for Real Data Pipeline
 * Provides structured error responses and user feedback
 */

export interface ErrorContext {
  operation: string;
  txHash?: string;
  blockNumber?: string | number;
  chainId?: number;
  timestamp: number;
  userId?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    type: ErrorType;
    message: string;
    userMessage: string;
    context: ErrorContext;
    suggestions: string[];
    retryable: boolean;
    errorCode: string;
  };
}

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CHAIN_ERROR = 'CHAIN_ERROR'
}

export class ErrorHandler {
  
  /**
   * Handle invalid transaction hash format
   */
  static invalidTransactionHash(txHash: string, context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.VALIDATION_ERROR,
        message: `Invalid transaction hash format: ${txHash}`,
        userMessage: 'The transaction hash provided is not in the correct format. Transaction hashes should be 64-character hexadecimal strings starting with "0x".',
        context: {
          operation: 'transaction_analysis',
          txHash,
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Ensure the transaction hash is exactly 66 characters long (including 0x prefix)',
          'Verify the hash contains only hexadecimal characters (0-9, a-f, A-F)',
          'Copy the hash directly from a blockchain explorer',
          'Check if you meant to analyze a block instead of a transaction'
        ],
        retryable: false,
        errorCode: 'E001'
      }
    };
  }
  
  /**
   * Handle transaction not found in database
   */
  static transactionNotFound(txHash: string, context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.NOT_FOUND,
        message: `Transaction ${txHash} not found in database`,
        userMessage: 'This transaction could not be found in the Hyperliquid database. It may be too recent, on a different chain, or the hash might be incorrect.',
        context: {
          operation: 'transaction_lookup',
          txHash,
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Verify the transaction hash is correct',
          'Check if the transaction is on Hyperliquid Mainnet (Chain ID 998)',
          'Wait a few minutes if the transaction is very recent',
          'Confirm the transaction was successful on a blockchain explorer',
          'Try analyzing the block containing this transaction instead'
        ],
        retryable: true,
        errorCode: 'E002'
      }
    };
  }
  
  /**
   * Handle block not found in database
   */
  static blockNotFound(blockNumber: string | number, context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.NOT_FOUND,
        message: `Block ${blockNumber} not found in database`,
        userMessage: 'This block could not be found in the Hyperliquid database. The block number might be too high, too low, or on a different network.',
        context: {
          operation: 'block_lookup',
          blockNumber,
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Verify the block number exists on Hyperliquid',
          'Check if you meant to use "latest" for the most recent block',
          'Ensure you\'re querying the correct chain (Mainnet: 998, Testnet: 99998)',
          'Try a different block number or use a blockchain explorer to find valid blocks',
          'Wait a moment if querying a very recent block number'
        ],
        retryable: true,
        errorCode: 'E003'
      }
    };
  }
  
  /**
   * Handle database connection errors
   */
  static databaseError(originalError: Error, context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.DATABASE_ERROR,
        message: `Database operation failed: ${originalError.message}`,
        userMessage: 'There was a temporary issue connecting to the Hyperliquid data service. This is usually resolved quickly.',
        context: {
          operation: 'database_query',
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Please try your request again in a few seconds',
          'If the issue persists, the Hyperliquid data service may be experiencing high load',
          'Try analyzing a different transaction or block',
          'Check if the Hyperliquid network is experiencing issues'
        ],
        retryable: true,
        errorCode: 'E004'
      }
    };
  }
  
  /**
   * Handle invalid chain ID
   */
  static invalidChainId(chainId: number, context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.CHAIN_ERROR,
        message: `Invalid Hyperliquid chain ID: ${chainId}`,
        userMessage: 'The specified chain ID is not supported. LUMINA only supports Hyperliquid Mainnet and Testnet.',
        context: {
          operation: 'chain_validation',
          chainId,
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Use Chain ID 998 for Hyperliquid Mainnet',
          'Use Chain ID 99998 for Hyperliquid Testnet',
          'Verify you\'re analyzing data from the Hyperliquid network',
          'Check the documentation for supported networks'
        ],
        retryable: false,
        errorCode: 'E005'
      }
    };
  }
  
  /**
   * Handle query timeout errors
   */
  static queryTimeout(operation: string, context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.TIMEOUT,
        message: `Query timeout during ${operation}`,
        userMessage: 'The data query took too long to complete. This might be due to high network load or a complex analysis request.',
        context: {
          operation,
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Try your request again - timeouts are often temporary',
          'If analyzing a very active block, try a different block number',
          'Consider analyzing individual transactions instead of entire blocks',
          'Check if there are network congestion issues'
        ],
        retryable: true,
        errorCode: 'E006'
      }
    };
  }
  
  /**
   * Handle rate limiting
   */
  static rateLimitExceeded(context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded for analysis requests',
        userMessage: 'You\'ve made too many analysis requests in a short time. Please wait a moment before making another request.',
        context: {
          operation: 'rate_limit_check',
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Wait 30-60 seconds before making another request',
          'Use the cache by re-analyzing recently analyzed transactions/blocks',
          'Consider analyzing fewer items at once',
          'Spread your requests out over time'
        ],
        retryable: true,
        errorCode: 'E007'
      }
    };
  }
  
  /**
   * Handle generic internal errors
   */
  static internalError(originalError: Error, context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: `Internal error: ${originalError.message}`,
        userMessage: 'An unexpected error occurred while processing your request. Our team has been notified and will investigate.',
        context: {
          operation: 'internal_processing',
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Please try your request again',
          'If the error persists, try analyzing a different transaction or block',
          'Check if your request parameters are correct',
          'Contact support if the issue continues'
        ],
        retryable: true,
        errorCode: 'E008'
      }
    };
  }
  
  /**
   * Handle data processing errors
   */
  static dataProcessingError(step: string, originalError: Error, context: Partial<ErrorContext>): ErrorResponse {
    return {
      success: false,
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: `Data processing failed at ${step}: ${originalError.message}`,
        userMessage: 'There was an issue processing the blockchain data. This might be due to unusual transaction patterns or data formatting.',
        context: {
          operation: `data_processing_${step}`,
          timestamp: Date.now(),
          ...context
        },
        suggestions: [
          'Try analyzing a different transaction or block',
          'If this is a complex transaction, the analysis might take longer',
          'Verify the transaction/block exists and is valid',
          'Contact support if this error occurs frequently'
        ],
        retryable: true,
        errorCode: 'E009'
      }
    };
  }
  
  /**
   * Create success response wrapper
   */
  static success<T>(data: T): { success: true; data: T } {
    return {
      success: true,
      data
    };
  }
  
  /**
   * Check if an error is retryable
   */
  static isRetryable(error: ErrorResponse): boolean {
    return error.error.retryable;
  }
  
  /**
   * Get user-friendly error summary
   */
  static getErrorSummary(error: ErrorResponse): string {
    return `${error.error.type}: ${error.error.userMessage}`;
  }
  
  /**
   * Log error with context for debugging
   */
  static logError(error: ErrorResponse): void {
    const logData = {
      errorCode: error.error.errorCode,
      type: error.error.type,
      operation: error.error.context.operation,
      timestamp: new Date(error.error.context.timestamp).toISOString(),
      message: error.error.message,
      retryable: error.error.retryable
    };
    
    console.error(`❌ ${error.error.errorCode} [${error.error.type}]:`, logData);
  }
  
  /**
   * Convert any error to structured error response
   */
  static fromError(error: Error, context: Partial<ErrorContext>): ErrorResponse {
    // Check if it's already a structured error
    if (error.message.includes('not found')) {
      if (context.txHash) {
        return this.transactionNotFound(context.txHash, context);
      } else if (context.blockNumber) {
        return this.blockNotFound(context.blockNumber, context);
      }
    }
    
    if (error.message.includes('timeout')) {
      return this.queryTimeout(context.operation || 'unknown', context);
    }
    
    if (error.message.includes('Invalid transaction hash')) {
      return this.invalidTransactionHash(context.txHash || 'unknown', context);
    }
    
    if (error.message.includes('Invalid Hyperliquid chain ID')) {
      return this.invalidChainId(context.chainId || 0, context);
    }
    
    // Default to internal error
    return this.internalError(error, context);
  }
}