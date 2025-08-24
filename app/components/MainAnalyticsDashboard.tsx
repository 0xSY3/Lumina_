'use client';
import React from 'react';
import { 
  Activity, 
  TrendingUp, 
  Zap, 
  BarChart3,
  Clock,
  Users
} from 'lucide-react';

const MainAnalyticsDashboard: React.FC = () => {
  return (
    <div className="w-full max-w-6xl mx-auto mb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-green-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Interactive Analytics Dashboard</h2>
            <p className="text-gray-600 text-sm">Real-time metrics and visualizations</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4">
          <button className="px-4 py-2 text-green-600 border-b-2 border-green-600 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Network Intelligence
          </button>
          <button className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Gas Analytics
          </button>
          <button className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" />
            MEV Analysis
          </button>
          <button className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Flow Features
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Health */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Network Health</h3>
              <p className="text-gray-600 text-sm">Real-time assessment</p>
            </div>
          </div>
          
          {/* Health Score Circle */}
          <div className="flex justify-center mb-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="3"
                  strokeDasharray="92, 100"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">92</div>
                  <div className="text-xs text-gray-500">/ 100</div>
                </div>
              </div>
            </div>
          </div>

          {/* Health Indicators */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              Fast 2s block times
            </div>
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              Low USDC gas fees
            </div>
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              High throughput capabilities
            </div>
          </div>
        </div>

        {/* Network Trends */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Network Trends</h3>
              <p className="text-gray-600 text-sm">Real-time activity</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Network Activity</span>
              <span className="text-green-600 font-semibold">High</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Gas Usage Trend</span>
              <span className="text-green-600 font-semibold">Stable</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Block Utilization</span>
              <span className="text-green-600 font-semibold">68.5%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Transaction Volume</span>
              <span className="text-green-600 font-semibold">Normal</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Dex Activity</span>
              <span className="text-green-600 font-semibold">Normal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainAnalyticsDashboard;