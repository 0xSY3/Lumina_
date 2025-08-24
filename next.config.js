/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // !! WARN !!
        ignoreBuildErrors: true,
    },
    // Configure headers for HyperEVM CORS support
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                ],
            },
        ];
    },
    // Webpack configuration for HyperEVM SDK and PostgreSQL compatibility
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
        // Add fallbacks for Node.js modules (comprehensive for PostgreSQL)
        config.resolve.fallback = {
            ...config.resolve.fallback,
            crypto: false,
            stream: false,
            buffer: false,
            fs: false,
            net: false,
            tls: false,
            path: false,
            os: false,
            util: false,
            dns: false,
            child_process: false,
            module: false,
            url: false,
            querystring: false,
            events: false,
            assert: false,
            constants: false,
            vm: false,
        };

        // Exclude pg and related modules from client bundle
        if (!isServer) {
            config.externals = config.externals || [];
            config.externals.push('pg', 'pgpass', 'pg-native');
        }

        return config;
    },
    // Environment variables for HyperEVM networks
    env: {
        HYPEREVM_MAINNET_CHAIN_ID: '42161',
        HYPEREVM_TESTNET_CHAIN_ID: '998',
        HYPEREVM_MAINNET_RPC: 'https://api.hyperliquid.xyz/evm',
        HYPEREVM_TESTNET_RPC: 'https://api.hyperliquid-testnet.xyz/evm',
    },
    // External packages to be bundled server-side
    serverExternalPackages: ['@hyperliquid-dex/sdk', 'viem', 'wagmi', 'pg', 'pgpass', 'pg-native'],
};

module.exports = nextConfig;