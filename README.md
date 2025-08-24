# 🌟 LUMINA - AI-Powered Hyperliquid Blockchain Intelligence

<div align="center">

[![Hyperliquid](https://img.shields.io/badge/Built%20for-Hyperliquid-00D4FF?style=for-the-badge)](https://hyperliquid.xyz)
[![Goldsky](https://img.shields.io/badge/Powered%20by-Goldsky-gold?style=for-the-badge)](https://goldsky.com)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://typescript.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)

**🏆 Hyperliquid Community Hackathon - Track #18: Best Use of Goldsky ($2,000)**

</div>

---

## 💡 **Overview**

**LUMINA transforms Hyperliquid blockchain data into intelligent, actionable insights using AI-powered analysis and Goldsky's real-time indexing infrastructure.**

Unlike traditional explorers that display raw data, LUMINA provides:

- **🚀 Real-Time Intelligence**: Live transaction and block analysis with instant AI insights
- **🔍 MEV Detection**: Identify sandwich attacks, front-running, and arbitrage opportunities
- **🛡️ Security Assessment**: Automated risk scoring and vulnerability detection
- **📊 Trading Analytics**: DEX activity patterns, liquidity analysis, and yield tracking
- **🌉 Cross-Chain Tracking**: Monitor deposits from multiple chains through HyperCore to HyperEVM

---

## 🎯 Hackathon Requirements Fulfillment

### **✅ Goldsky API Integration**
- **Mirror Pipelines**: Direct PostgreSQL streaming from Hyperliquid mainnet with 46.1M+ indexed records
- **Raw Block Data**: Complete block headers, gas usage, and miner information via `raw_1` table
- **Enriched Transactions**: Full transaction data with receipts and traces via `source_1` table
- **Real-Time Indexing**: Live data streaming with optimized connection pooling and query timeouts
- **Free Indexing**: Utilizing Goldsky's free HyperEVM indexing with code `hyperliquid`

### **✅ User-Friendly Explorer**
- **AI-Powered Interface**: Natural language understanding for complex queries
- **Real-Time Dashboard**: Live updates with WebSocket connections
- **Mobile Responsive**: Full functionality across all devices
- **Visual Analytics**: Interactive charts and transaction flow diagrams

### **✅ Advanced Features**
- **MEV Detection Engine**: Identifies sandwich attacks, front-running, and arbitrage using transaction pattern analysis
- **Trading Intelligence**: DEX activity detection, liquidity analysis, and perp trading signals from enriched transaction data
- **Risk Assessment**: Automated security scoring based on gas patterns, contract interactions, and value transfers
- **Performance Optimization**: Smart caching system with LRU eviction and 70%+ hit rates for sub-second responses

---

## 🛠 Technical Architecture & Data Pipeline

### **🏗️ Core Infrastructure**

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 14+ with TypeScript and Tailwind CSS | Modern, type-safe web application |
| **Database** | PostgreSQL with Goldsky Mirror Pipelines | Real-time Hyperliquid data indexing |
| **AI Engine** | OpenAI GPT-4o-mini with custom blockchain prompts | Intelligent transaction & block analysis |
| **Caching** | Smart LRU Cache with TTL and access tracking | Performance optimization for analysis results |
| **Real-time Data** | Goldsky Mirror Pipelines + Connection Pooling | Live blockchain data streaming |

### **📊 Goldsky Data Pipeline Architecture**

```
Hyperliquid Mainnet
        ↓
┌─────────────────────────────────────────┐
│       Goldsky Mirror Pipelines          │
├─────────────────────────────────────────┤
│ • Raw Block Data (raw_1 table)         │
│ • Enriched Transactions (source_1)     │
│ • Real-time streaming indexing         │
│ • 46.1M+ indexed records              │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│        LUMINA Data Services             │
├─────────────────────────────────────────┤
│ • BlockDataService.ts                  │
│ • TransactionDataService.ts            │
│ • Optimized SQL queries with timeouts  │
│ • Connection pooling (25 max, 5 min)   │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│       RealDataAnalyzer.ts              │
├─────────────────────────────────────────┤
│ • Transform raw data to AI-ready format│
│ • Hyperliquid-specific analysis        │
│ • MEV detection & trading patterns     │
│ • Risk assessment calculations         │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│         AI Analysis Engine             │
├─────────────────────────────────────────┤
│ • OpenAI GPT-4o-mini integration       │
│ • Custom blockchain analysis prompts   │
│ • Structured response formatting       │
│ • Smart caching for performance        │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│      User Interface & Results          │
├─────────────────────────────────────────┤
│ • Real-time analysis display           │
│ • Interactive charts & visualizations  │
│ • MEV detection alerts                 │
│ • Trading pattern insights             │
└─────────────────────────────────────────┘
```

### **🔧 Data Processing Flow**

1. **Raw Data Ingestion**: Goldsky Mirror Pipelines continuously index Hyperliquid blocks and transactions
2. **Database Storage**: 
   - `raw_1` table: Complete block data (headers, gas, miner info)
   - `source_1` table: Enriched transaction data (receipts, traces, decoded calls)
3. **Query Optimization**: 
   - Parallel queries with 2-3 second timeouts
   - Connection pooling to handle concurrent requests
   - Sample-based analysis for large blocks (20 transactions max)
4. **Data Transformation**: Convert blockchain data to AI-compatible structured format
5. **AI Processing**: GPT-4o-mini analyzes patterns and generates insights
6. **Result Caching**: Smart cache stores analysis results for 15 minutes (transactions) / 5 minutes (blocks)

---

## 🎯 Features

### 🔍 **Core Capabilities**
- **🧠 AI Transaction Analysis**: Deep insights into any Hyperliquid transaction using GPT-4o-mini with real blockchain data
- **📊 Block Analysis**: Comprehensive block metrics, patterns, and network health assessment
- **🔍 Real-Time Data**: Direct database queries to Goldsky-indexed Hyperliquid data (46.1M+ records)
- **⚡ High Performance**: Sub-3-second analysis with smart caching and optimized SQL queries
- **🛡️ Security Focus**: MEV detection, risk scoring, and vulnerability assessment

### 📊 **Goldsky-Powered Analytics**
- **🔗 Direct Database Integration**: Raw SQL queries to Goldsky's PostgreSQL mirror for maximum performance
- **📊 Real-Time Metrics**: Live block utilization, gas patterns, and network congestion from `raw_1` table
- **💱 Trading Pattern Recognition**: DEX activity, perp signals, and liquidity events from enriched `source_1` data
- **🎯 MEV Intelligence**: Sandwich attack detection, arbitrage identification, and front-running analysis
- **⚡ Performance Optimization**: Connection pooling (25 max connections) with smart query timeouts

---

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ and npm
- OpenAI API key (GPT-4o-mini for fast analysis)
- PostgreSQL access (Goldsky provides DATABASE_URL)
- Hyperliquid network access (mainnet chain ID: 42161)

### **Installation**

```bash
# 1. Clone the repository
git clone https://github.com/0xSY3/LUMINA.git
cd lumina

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys:
# OPENAI_API_KEY=your_openai_api_key_here
# DATABASE_URL=your_goldsky_postgres_connection_string

# 4. Run development server
npm run dev

# 5. Open http://localhost:3000
```

---

## 📝 Environment Variables

Create a `.env.local` file:

```env
# Required - Core API Keys
OPENAI_API_KEY=your_openai_api_key_here

# Required - Goldsky Database Connection
DATABASE_URL=postgresql://username:password@goldsky-postgres-host:5432/goldsky

# Optional - Performance Tuning
NEXT_PUBLIC_DEBUG_MODE=false
CACHE_TTL_TRANSACTIONS=900    # 15 minutes
CACHE_TTL_BLOCKS=300         # 5 minutes
POOL_MAX_CONNECTIONS=25      # Database connection pool size
QUERY_TIMEOUT_MS=3000        # SQL query timeout
```

See `.env.example` for all available configuration options.

---

## 📖 Usage Guide

### **🔍 Analyze Transactions**
1. Enter any Hyperliquid transaction hash (0x...)
2. LUMINA queries Goldsky's enriched transaction data
3. AI processes real blockchain data for comprehensive analysis
4. Get instant MEV detection, risk scoring, and trading insights

### **📊 Analyze Blocks**
1. Enter block number or use "latest" for most recent
2. System queries `raw_1` table for complete block data
3. Parallel processing of sample transactions for patterns
4. Comprehensive block metrics and network health assessment

### **⚡ Performance Features**
- Sub-3-second response times with optimized SQL queries
- Smart caching system with 70%+ hit rates
- Real-time connection pooling (25 max connections)
- Sample-based analysis for large blocks (20 tx max)

---

## 🔮 Future Roadmap

### **✅ Phase 1: Core Features** (Completed)
- [x] AI-powered transaction analysis
- [x] HyperEVM integration
- [x] Smart contract deployment
- [x] Social features for sharing transaction insights

### **🚧 Phase 2: Advanced Analytics** (In Progress)
- [ ] Advanced analytics dashboard with historical trends
- [ ] Agent-based monitoring and alerts for suspicious transactions
- [ ] Machine learning models for pattern recognition
- [ ] Integration with Hyperliquid DeFi protocols for yield analysis

### **🔜 Phase 3: Platform Expansion** (Planned)
- [ ] Multi-chain expansion beyond HyperEVM
- [ ] Mobile app for on-the-go blockchain analysis
- [ ] AI-powered portfolio optimization and yield farming strategies
- [ ] Enterprise features and API access

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

```bash
# Fork the repository
git clone https://github.com/0xSY3/LUMINA.git

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes and commit
git commit -m "Add amazing feature"

# Push to your fork and create a pull request
git push origin feature/amazing-feature
```

### **Development Guidelines**
- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow the existing code style


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**🌊 Built with ❤️ for the Hyperliquid ecosystem**

*Built for Hyperliquid's community hackathon - illuminating blockchain data through AI-powered intelligence.*

</div>
