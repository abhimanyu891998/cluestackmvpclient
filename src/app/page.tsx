'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, AlertTriangle, TrendingUp, Users, Database, Zap, Clock } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocketSingleton'
import { useDashboardState } from '@/hooks/useDashboardState'
import { formatUTCTime } from '@/utils/datetime'

export default function TradingDashboard() {
  const dashboardState = useDashboardState()
  const { isConnected } = useWebSocket(dashboardState)
  const { state } = dashboardState
  const [incidentCount, setIncidentCount] = useState(0)
  const alertsScrollRef = useRef<HTMLDivElement>(null)
  const [lastSequenceId, setLastSequenceId] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setIncidentCount(state.incidents.length)

    // Auto-scroll to the top when new incidents are added
    if (alertsScrollRef.current && state.incidents.length > 0) {
      alertsScrollRef.current.scrollTop = 0
    }
  }, [state.incidents])

  // Track orderbook updates for subtle animations
  useEffect(() => {
    if (state.orderbook_data.sequence_id !== lastSequenceId && state.orderbook_data.sequence_id > 0) {
      setIsUpdating(true)
      setLastSequenceId(state.orderbook_data.sequence_id)

      // Reset animation after a short delay
      const timer = setTimeout(() => {
        setIsUpdating(false)
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [state.orderbook_data.sequence_id, lastSequenceId])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price)
  }

  const formatQuantity = (quantity: string) => {
    return parseFloat(quantity).toFixed(4)
  }

  const getDataFreshnessColor = (dataAge: number = 0, isStale: boolean = false) => {
    if (isStale && dataAge > 1000) return 'text-red-600 bg-red-50'
    if (isStale) return 'text-yellow-600 bg-yellow-50'
    return 'text-blue-600 bg-blue-50'
  }

  const getDataFreshnessText = (dataAge: number = 0, isStale: boolean = false) => {
    if (isStale && dataAge > 1000) return 'STALE'
    if (isStale) return 'SLOW'
    return 'LIVE'
  }

  const handleProfileSwitch = async (profileName: string) => {
    try {
      await fetch(`http://127.0.0.1:8000/config/profile/${profileName}`, {
        method: 'POST'
      })
    } catch (err) {
      console.error('Failed to switch profile:', err)
    }
  }

  const getModeDisplayInfo = (mode: string) => {
    switch (mode) {
      case 'stable-mode':
        return {
          emoji: '🟢',
          name: 'Stable Mode',
          color: 'text-blue-600 bg-blue-50',
          description: 'Normal operation - Low latency'
        }
      case 'burst-mode':
        return {
          emoji: '🟡',
          name: 'Burst Mode',
          color: 'text-yellow-600 bg-yellow-50',
          description: 'High frequency spikes'
        }
      case 'gradual-spike':
        return {
          emoji: '🟠',
          name: 'Gradual Spike',
          color: 'text-orange-600 bg-orange-50',
          description: 'Progressive load increase'
        }
      case 'extreme-spike':
        return {
          emoji: '🔴',
          name: 'Extreme Spike',
          color: 'text-red-600 bg-red-50',
          description: 'Maximum stress - High latency'
        }
      default:
        return {
          emoji: '⚪',
          name: 'Unknown',
          color: 'text-blue-600 bg-blue-50',
          description: 'Unknown mode'
        }
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-black">BTC/USDT</h1>
                  <p className="text-sm text-gray-600">Market Data Monitor</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 bg-blue-500 rounded-full transition-all duration-300 ${isUpdating ? 'animate-subtle-pulse' : 'animate-pulse'
                      }`}></div>
                    <span className="text-sm text-blue-600 font-medium">LIVE</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-red-600 font-medium">OFFLINE</span>
                  </div>
                )}
              </div>

              {/* Market Mode Switcher */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-black">Mode:</span>
                <div className="flex items-center space-x-2">
                  <select
                    onChange={(e) => handleProfileSwitch(e.target.value)}
                    value={state.metrics.current_scenario || "stable-mode"}
                    className="text-sm font-medium text-black border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer min-w-[140px]"
                  >
                    <option value="stable-mode" className="py-2 text-black bg-white">🟢 Stable Mode</option>
                    <option value="burst-mode" className="py-2 text-black bg-white">🟡 Burst Mode</option>
                    <option value="gradual-spike" className="py-2 text-black bg-white">🟠 Gradual Spike</option>
                    <option value="extreme-spike" className="py-2 text-black bg-white">🔴 Extreme Spike</option>
                  </select>
                  <div className={`px-2 py-1 rounded-md text-xs font-medium ${getModeDisplayInfo(state.metrics.current_scenario || "stable-mode").color}`}>
                    {getModeDisplayInfo(state.metrics.current_scenario || "stable-mode").description}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)] overflow-hidden">
        {/* Orderbook Section */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm h-full overflow-hidden">
            {/* Orderbook Header */}
            <div className="border-b border-gray-200 p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-semibold text-black">Order Book</h2>
                  <div className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ${getDataFreshnessColor(state.orderbook_data.data_age_ms, state.orderbook_data.is_stale)} ${isUpdating ? 'animate-subtle-slide-in' : ''}`}>
                    {getDataFreshnessText(state.orderbook_data.data_age_ms, state.orderbook_data.is_stale)}
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <div className="transition-all duration-300">
                    Mid: {formatPrice(state.orderbook_data.mid_price)}
                  </div>
                  <div className="transition-all duration-300">
                    Spread: {formatPrice(state.orderbook_data.spread)}
                  </div>
                  <div className="transition-all duration-300">
                    Seq: {state.orderbook_data.sequence_id}
                  </div>
                  {state.orderbook_data.data_age_ms !== undefined && (
                    <div className={`font-medium transition-all duration-300 ${state.orderbook_data.data_age_ms > 1000 ? 'text-red-600' :
                        state.orderbook_data.data_age_ms > 500 ? 'text-yellow-600' : 'text-blue-600'
                      }`}>
                      Age: {state.orderbook_data.data_age_ms.toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Critical Staleness Alert */}
            {state.orderbook_data.is_stale && (state.orderbook_data.data_age_ms ?? 0) > 1000 && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4 rounded-r-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                  <div>
                    <p className="font-medium text-red-800">CRITICAL: Data Staleness Detected</p>
                    <p className="text-sm text-red-600">
                      Data received {(state.orderbook_data.data_age_ms ?? 0).toFixed(0)}ms ago - Processing lag detected
                    </p>
                    <p className="text-xs text-red-500 mt-1">
                      Data Age = Time from exchange receipt to client delivery
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Orderbook Content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="grid grid-cols-2 gap-6 h-full">
                {/* Bids (Buy Orders) - Left Side */}
                <div className="space-y-1 overflow-hidden">
                  <div className="flex justify-between text-xs text-gray-600 font-medium border-b border-gray-200 pb-2">
                    <span>Price (USD)</span>
                    <span>Size (BTC)</span>
                  </div>
                  <div className="space-y-0.5 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {state.orderbook_data.bids.slice(0, 15).map((bid, index) => {
                      const btcSize = parseFloat(bid[1])
                      const maxSize = Math.max(...state.orderbook_data.bids.slice(0, 15).map(b => parseFloat(b[1])))
                      const widthPercent = maxSize > 0 ? (btcSize / maxSize) * 100 : 0
                      
                      return (
                        <div
                          key={index}
                          className={`relative flex justify-between text-sm py-1.5 px-2 rounded transition-all duration-200 hover:bg-green-50 ${index === 0 && isUpdating ? 'border-l-2 border-green-400 animate-subtle-slide-in' : ''
                            }`}
                          style={{
                            background: index === 0 && isUpdating 
                              ? `linear-gradient(to right, rgba(34, 197, 94, 0.15) ${widthPercent}%, transparent ${widthPercent}%)`
                              : `linear-gradient(to right, rgba(34, 197, 94, 0.08) ${widthPercent}%, transparent ${widthPercent}%)`
                          }}
                        >
                          <span className={`text-green-600 font-mono font-medium transition-all duration-200 relative z-10 ${index === 0 && isUpdating ? 'text-green-700' : ''
                            }`}>
                            {formatPrice(parseFloat(bid[0]))}
                          </span>
                          <span className={`text-gray-700 font-mono transition-all duration-200 relative z-10 ${index === 0 && isUpdating ? 'text-gray-800' : ''
                            }`}>
                            {formatQuantity(bid[1])}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Asks (Sell Orders) - Right Side */}
                <div className="space-y-1 overflow-hidden">
                  <div className="flex justify-between text-xs text-gray-600 font-medium border-b border-gray-200 pb-2">
                    <span>Price (USD)</span>
                    <span>Size (BTC)</span>
                  </div>
                  <div className="space-y-0.5 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {state.orderbook_data.asks.slice(0, 15).reverse().map((ask, index) => {
                      const btcSize = parseFloat(ask[1])
                      const maxSize = Math.max(...state.orderbook_data.asks.slice(0, 15).map(a => parseFloat(a[1])))
                      const widthPercent = maxSize > 0 ? (btcSize / maxSize) * 100 : 0
                      
                      return (
                        <div
                          key={index}
                          className={`relative flex justify-between text-sm py-1.5 px-2 rounded transition-all duration-200 hover:bg-red-50 ${index === 0 && isUpdating ? 'border-l-2 border-red-400 animate-subtle-slide-in' : ''
                            }`}
                          style={{
                            background: index === 0 && isUpdating 
                              ? `linear-gradient(to right, rgba(239, 68, 68, 0.15) ${widthPercent}%, transparent ${widthPercent}%)`
                              : `linear-gradient(to right, rgba(239, 68, 68, 0.08) ${widthPercent}%, transparent ${widthPercent}%)`
                          }}
                        >
                          <span className={`text-red-600 font-mono font-medium transition-all duration-200 relative z-10 ${index === 0 && isUpdating ? 'text-red-700' : ''
                            }`}>
                            {formatPrice(parseFloat(ask[0]))}
                          </span>
                          <span className={`text-gray-700 font-mono transition-all duration-200 relative z-10 ${index === 0 && isUpdating ? 'text-gray-800' : ''
                            }`}>
                            {formatQuantity(ask[1])}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* No Data State */}
              {state.orderbook_data.bids.length === 0 && state.orderbook_data.asks.length === 0 && (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Waiting for market data...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Metrics Sidebar */}
        <div className="w-80 p-6 border-l border-gray-200 flex-shrink-0 overflow-y-auto">
          <div className="space-y-6">
            {/* System Health */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-medium text-black mb-3">System Health</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-black">Memory</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-black">
                      {state.metrics.memory_usage_mb.toFixed(1)} MB
                    </div>
                    <div className="text-xs text-gray-500">
                      {((state.metrics.memory_usage_mb / 512) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-black">Queue</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-black">
                      {state.metrics.queue_size}
                    </div>
                    <div className="text-xs text-gray-500">messages</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-black">Delay</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-black">
                      {state.metrics.processing_delay_ms}ms
                    </div>
                    <div className="text-xs text-gray-500">processing</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-black">Clients</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-black">
                      {state.metrics.active_clients}
                    </div>
                    <div className="text-xs text-gray-500">connected</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className={`w-4 h-4 text-gray-600 transition-all duration-200 ${isUpdating ? 'animate-subtle-pulse' : ''}`} />
                    <span className="text-sm text-black">Data Age</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium transition-all duration-200 ${(state.orderbook_data.data_age_ms ?? 0) > 1000 ? 'text-red-600' :
                        (state.orderbook_data.data_age_ms ?? 0) > 500 ? 'text-yellow-600' : 'text-blue-600'
                      }`}>
                      {state.orderbook_data.data_age_ms ? state.orderbook_data.data_age_ms.toFixed(0) + 'ms' : '0ms'}
                    </div>
                    <div className="text-xs text-gray-500">staleness</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Incidents */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm h-80">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-black">System Alerts</h3>
                {incidentCount > 0 && (
                  <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded">
                    {incidentCount}
                  </span>
                )}
              </div>

              <div ref={alertsScrollRef} className="h-64 overflow-y-auto overflow-x-hidden scroll-smooth">
                {state.incidents.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <div className="text-sm">No incidents detected</div>
                      <div className="text-xs text-gray-400">System running normally</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 pr-2">
                    {state.incidents.slice(-10).reverse().map((incident, index) => (
                      <div
                        key={`${incident.timestamp}-${index}`}
                        className={`border border-red-200 rounded-lg p-3 bg-red-50 flex-shrink-0 transition-all duration-300 ${index === 0 ? 'animate-subtle-slide-in' : ''
                          }`}
                      >
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-red-900 truncate">{incident.type}</div>
                            <div className="text-xs text-red-700 mt-1 break-words">{incident.details}</div>
                            <div className="text-xs text-red-600 mt-1">
                              {formatUTCTime(new Date(incident.timestamp))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Current Status */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-medium text-black mb-3">Current Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-black">Server</span>
                  <span className={`text-sm font-medium ${state.metrics.server_status === 'healthy' ? 'text-blue-600' : 'text-yellow-600'}`}>
                    {state.metrics.server_status === 'healthy' ? 'Healthy' : 'Degraded'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-black">Profile</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">
                      {getModeDisplayInfo(state.metrics.current_scenario || "stable-mode").emoji}
                    </span>
                    <span className="text-sm font-medium text-black">
                      {getModeDisplayInfo(state.metrics.current_scenario || "stable-mode").name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-black">Uptime</span>
                  <span className="text-sm font-medium text-black">
                    {Math.floor(state.metrics.uptime_seconds / 60)}m {Math.floor(state.metrics.uptime_seconds % 60)}s
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}