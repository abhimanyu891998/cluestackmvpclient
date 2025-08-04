'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, AlertTriangle, TrendingUp, Users, Database, Zap, RefreshCw, Play, Square } from 'lucide-react'
import { useSSE, SSESingleton } from '@/hooks/useSSESingleton'
import { useDashboardState } from '@/hooks/useDashboardState'
import { formatUTCTime } from '@/utils/datetime'
import EventsRateChart from '@/components/EventsRateChart'
import WelcomeModal from '@/components/WelcomeModal'
import { buildApiUrl } from '@/config/api'

export default function TradingDashboard() {
  const dashboardState = useDashboardState()
  const sseHook = useSSE(dashboardState)
  const { isConnected } = sseHook
  const { state } = dashboardState
  const alertsScrollRef = useRef<HTMLDivElement>(null)
  const [lastSequenceId, setLastSequenceId] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)
  const [, setStalenessAlertCount] = useState(0)
  const [isDisconnectedDueToStaleness, setIsDisconnectedDueToStaleness] = useState(false)
  const [stalenessDisconnectInfo, setStalenessDisconnectInfo] = useState<{
    dataAge: number;
    timestamp: string;
  } | null>(null)
  const [chartResetKey, setChartResetKey] = useState(0)
  const [isResetting, setIsResetting] = useState(false)
  const [isDataProcessing, setIsDataProcessing] = useState(false)
  const [isPlayButtonLoading, setIsPlayButtonLoading] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(true)

  const handleCloseWelcomeModal = () => {
    setShowWelcomeModal(false)
  }

  useEffect(() => {
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

  // Immediately disconnect on staleness detection
  useEffect(() => {
    // Skip staleness detection if we're in the middle of a reset
    if (isResetting) {
      console.log('⏸️ Skipping staleness detection during reset')
      return
    }

    const isCurrentlyStale = state.orderbook_data.is_stale && (state.orderbook_data.data_age_ms ?? 0) > 300

    if (isCurrentlyStale && !isDisconnectedDueToStaleness) {
      console.log(`🚨 Staleness detected - Data age: ${state.orderbook_data.data_age_ms}ms - Immediately disconnecting`)

      // Immediately disconnect without warning
      setStalenessDisconnectInfo({
        dataAge: state.orderbook_data.data_age_ms ?? 0,
        timestamp: new Date().toISOString()
      })
      setIsDisconnectedDueToStaleness(true)
      setStalenessAlertCount(1)

      // Force disconnect the SSE
      const sseInstance = SSESingleton.getInstance()
      sseInstance.disconnect()
    }
  }, [state.orderbook_data.is_stale, state.orderbook_data.data_age_ms, isDisconnectedDueToStaleness, isResetting])

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
    if (isStale && dataAge > 1000) return 'text-red-500 bg-red-50'
    if (isStale) return 'text-yellow-500 bg-yellow-50'
    return 'text-blue-500 bg-blue-50'
  }

  const getDataFreshnessText = (dataAge: number = 0, isStale: boolean = false) => {
    if (isStale && dataAge > 1000) return 'STALE'
    if (isStale) return 'SLOW'
    return 'LIVE'
  }

  const handleProfileSwitch = async (profileName: string) => {
    try {
      // Set user override to prevent server from immediately overriding the toggle
      dashboardState.setUserScenarioOverride(profileName)
      
      await fetch(buildApiUrl(`/config/profile/${profileName}`), {
        method: 'POST'
      })
    } catch (err) {
      console.error('Failed to switch profile:', err)
    }
  }

  const handleResolveWithTrackdown = () => {
    if (!stalenessDisconnectInfo) return

    const incidentDate = new Date(stalenessDisconnectInfo.timestamp);
    const time = incidentDate.toISOString().split('T')[1].split('.')[0] + ' UTC';
    const date_input = incidentDate.toISOString().split('T')[0];
    const data_age = stalenessDisconnectInfo.dataAge.toFixed(2);

    const message = `Error: Data staleness detected: orderbook aged ${data_age}ms on date ${date_input} at time ${time}`;

    const params = new URLSearchParams({
      time: time,
      date_input: date_input,
      message: message,
      repository: process.env.NEXT_PUBLIC_REPOSITORY || 'abhimanyu891998/trackdownmvpserver26jun',
      application: process.env.NEXT_PUBLIC_APPLICATION || 'marketdata-publisher',
      data_age: `${data_age}ms`
    })

    const trackdownUrl = `${process.env.NEXT_PUBLIC_TRACKDOWN_UI_URL}?${params.toString()}`

    window.open(trackdownUrl, '_blank')
  }

  // Check processing status on component mount and periodically
  useEffect(() => {
    const checkProcessingStatus = async () => {
      try {
        const response = await fetch(buildApiUrl('/status/publisher'))
        if (response.ok) {
          const data = await response.json()
          setIsDataProcessing(data.publisher?.is_running ?? false)
        }
      } catch (err) {
        console.error('Failed to check processing status:', err)
      }
    }

    checkProcessingStatus()
    const interval = setInterval(checkProcessingStatus, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const handlePlayToggle = async () => {
    if (isPlayButtonLoading) return

    setIsPlayButtonLoading(true)

    try {
      if (isDataProcessing) {
        // Stop data processing
        console.log('🛑 Stopping data processing')
        const response = await fetch(buildApiUrl('/stop'), {
          method: 'POST'
        })
        if (response.ok) {
          dashboardState.addLog('INFO', 'Data processing stopped by user')
          setIsDataProcessing(false)

          // Disconnect SSE
          const sseInstance = SSESingleton.getInstance()
          sseInstance.disconnect()
        } else {
          dashboardState.addLog('ERROR', 'Failed to stop data processing')
        }
      } else {
        // Start data processing
        console.log('▶️ Starting data processing')

        // Set resetting flag to prevent staleness detection during start
        setIsResetting(true)

        const response = await fetch(buildApiUrl('/start'), {
          method: 'POST'
        })
        if (response.ok) {
          dashboardState.addLog('INFO', 'Data processing started')

          // Reset dashboard state to initial values
          dashboardState.resetToInitialState()

          // Reset UI states
          setIsDisconnectedDueToStaleness(false)
          setStalenessDisconnectInfo(null)
          setStalenessAlertCount(0)
          setLastSequenceId(0)
          setIsUpdating(false)

          // Reset chart
          setChartResetKey(prev => prev + 1)

          // Connect SSE
          const sseInstance = SSESingleton.getInstance()
          sseInstance.disconnect() // Ensure clean state

          // Switch to stable mode
          await handleProfileSwitch('stable-mode')

          // Connect after a short delay
          setTimeout(() => {
            sseInstance.connect()
            setIsDataProcessing(true)
            // Clear resetting flag after connection
            setTimeout(() => {
              setIsResetting(false)
              console.log('✅ Data processing started successfully')
            }, 1000)
          }, 1000)
        } else {
          dashboardState.addLog('ERROR', 'Failed to start data processing')
          setIsResetting(false)
        }
      }
    } catch (err) {
      console.error('Failed to toggle data processing:', err)
      dashboardState.addLog('ERROR', 'Failed to toggle data processing: Connection error')
      setIsResetting(false)
    } finally {
      setIsPlayButtonLoading(false)
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
    <div className="bg-white min-h-screen">
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
                  <h1 className="text-xl font-semibold text-black">Market Data Monitor</h1>
                  <p className="text-sm text-gray-600">BTC/USDT</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isConnected && isDataProcessing ? (
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 bg-emerald-500 rounded-full transition-all duration-300 ${isUpdating ? 'animate-subtle-pulse' : 'animate-pulse'
                      }`}></div>
                    <span className="text-sm text-emerald-600 font-medium">LIVE</span>
                  </div>
                ) : isDataProcessing ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-yellow-600 font-medium">CONNECTING</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 font-medium">READY</span>
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePlayToggle}
                  disabled={isPlayButtonLoading}
                  className={`flex items-center space-x-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${isDataProcessing
                      ? 'text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300'
                      : 'text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 hover:border-green-300'
                    } ${isPlayButtonLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isDataProcessing ? "Stop Data Processing" : "Start Data Processing"}
                >
                  {isPlayButtonLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isDataProcessing ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>{isDataProcessing ? 'Stop' : 'Play'}</span>
                </button>
              </div>

              {/* Market Mode Toggle */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-black">Mode:</span>
                <div className="flex items-center space-x-3">
                  {/* Toggle Switch */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (isDataProcessing) {
                          handleProfileSwitch(
                            (state.metrics.current_scenario || "stable-mode") === "stable-mode"
                              ? "burst-mode"
                              : "stable-mode"
                          )
                        }
                      }}
                      disabled={!isDataProcessing}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        !isDataProcessing 
                          ? 'bg-gray-300 cursor-not-allowed opacity-50' 
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                      style={{
                        backgroundColor: !isDataProcessing 
                          ? "#D1D5DB" 
                          : (state.metrics.current_scenario || "stable-mode") === "burst-mode"
                          ? "#F59E0B"
                          : "#10B981"
                      }}
                      title={!isDataProcessing ? "Toggle disabled when data processing is stopped" : "Switch between Stable and Burst modes"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${(state.metrics.current_scenario || "stable-mode") === "burst-mode"
                            ? "translate-x-6"
                            : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>

                  {/* Mode Labels */}
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium transition-colors duration-200 ${
                        !isDataProcessing
                        ? "text-gray-400"
                        : (state.metrics.current_scenario || "stable-mode") === "stable-mode"
                        ? "text-emerald-600"
                        : "text-gray-500"
                      }`}>
                      Stable Mode
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className={`text-sm font-medium transition-colors duration-200 ${
                        !isDataProcessing
                        ? "text-gray-400"
                        : (state.metrics.current_scenario || "stable-mode") === "burst-mode"
                        ? "text-yellow-600"
                        : "text-gray-500"
                      }`}>
                      Burst Mode
                    </span>
                  </div>

                  {/* Description Badge */}
                  <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                    !isDataProcessing 
                      ? 'text-gray-500 bg-gray-100' 
                      : getModeDisplayInfo(state.metrics.current_scenario || "stable-mode").color
                  }`}>
                    {!isDataProcessing ? 'Disabled' : getModeDisplayInfo(state.metrics.current_scenario || "stable-mode").description}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Trading Stopped Notification */}
      {isDisconnectedDueToStaleness && stalenessDisconnectInfo && (
        <div className="bg-red-50 border-l-4 border-red-400 mx-6 mt-4 mb-2 p-4 rounded-r-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
              <div>
                <p className="font-medium text-red-800">TRADING STOPPED - STALENESS DETECTED</p>
                <p className="text-sm text-red-600 mt-1">
                  Stale data detected: {stalenessDisconnectInfo.dataAge}ms age •
                  Disconnected: {formatUTCTime(new Date(stalenessDisconnectInfo.timestamp))}
                </p>
                <p className="text-xs text-red-500 mt-1">
                  Connection terminated immediately upon staleness detection
                </p>
              </div>
            </div>
            <button
              onClick={handleResolveWithTrackdown}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Resolve with Trackdown
            </button>
          </div>
        </div>
      )}


      {/* Main Content */}
      <div className="p-4 flex flex-col">
        {/* System Health Bar */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 flex-shrink-0">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-black">System Health</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-6 gap-6">
              <div className="flex items-center space-x-3">
                <Database className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-black">
                    {state.metrics.memory_usage_mb.toFixed(1)} MB
                  </div>
                  <div className="text-xs text-gray-500">Memory</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-black">
                    {dashboardState.messageCount > 0 ? Math.round(dashboardState.getMessageRate()) : 0}
                  </div>
                  <div className="text-xs text-gray-500">Rate (msg/sec)</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-black">
                    {state.metrics.processing_delay_ms}ms
                  </div>
                  <div className="text-xs text-gray-500">Processing Delay</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-sm font-medium text-black">
                    {state.metrics.active_clients}
                  </div>
                  <div className="text-xs text-gray-500">Clients</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Activity className={`w-5 h-5 text-gray-600 transition-all duration-200 ${isUpdating ? 'animate-subtle-pulse' : ''}`} />
                <div>
                  <div className={`text-sm font-medium transition-all duration-200 ${(state.orderbook_data.data_age_ms ?? 0) > 1000 ? 'text-red-500' :
                    (state.orderbook_data.data_age_ms ?? 0) > 500 ? 'text-yellow-500' : 'text-emerald-500'
                    }`}>
                    {state.orderbook_data.data_age_ms ? state.orderbook_data.data_age_ms.toFixed(0) + 'ms' : '0ms'}
                  </div>
                  <div className="text-xs text-gray-500">Data Age</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${state.metrics.server_status === 'healthy' ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                <div>
                  <div className="text-sm font-medium text-black">
                    {state.metrics.server_status === 'healthy' ? 'Healthy' : 'Degraded'}
                  </div>
                  <div className="text-xs text-gray-500">Server Status</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid - Orderbook Left, Events Chart Right */}
        <div
          className="flex gap-6 w-full"
          style={{
            height: `calc(100vh - ${280 +
              (isDisconnectedDueToStaleness ? 72 : 0)
              }px)`
          }}
        >
          {/* Orderbook Section - Left */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            {/* Orderbook Header */}
            <div className="border-b border-gray-200 p-4 bg-white flex-shrink-0">
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
                    <div className={`font-medium transition-all duration-300 ${state.orderbook_data.data_age_ms > 1000 ? 'text-red-500' :
                      state.orderbook_data.data_age_ms > 500 ? 'text-yellow-500' : 'text-emerald-500'
                      }`}>
                      Age: {state.orderbook_data.data_age_ms.toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* Orderbook Content */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="grid grid-cols-2 gap-6 h-full">
                {/* Bids (Buy Orders) - Left Side */}
                <div className="space-y-1 overflow-hidden flex flex-col">
                  <div className="flex justify-between text-xs text-gray-600 font-medium border-b border-gray-200 pb-2">
                    <span>Price (USD)</span>
                    <span>Size (BTC)</span>
                  </div>
                  <div className="space-y-0.5 flex-1">
                    {state.orderbook_data.bids.slice(0, 15).map((bid, index) => {
                      const btcSize = parseFloat(bid[1])
                      const maxSize = Math.max(...state.orderbook_data.bids.slice(0, 15).map(b => parseFloat(b[1])))
                      const widthPercent = maxSize > 0 ? (btcSize / maxSize) * 100 : 0

                      return (
                        <div
                          key={index}
                          className={`relative flex justify-between text-sm py-1.5 px-2 rounded transition-all duration-200 hover:bg-emerald-50 ${index === 0 && isUpdating ? 'border-l-2 border-emerald-400 animate-subtle-slide-in' : ''
                            }`}
                          style={{
                            background: index === 0 && isUpdating
                              ? `linear-gradient(to right, rgba(16, 185, 129, 0.15) ${widthPercent}%, transparent ${widthPercent}%)`
                              : `linear-gradient(to right, rgba(16, 185, 129, 0.08) ${widthPercent}%, transparent ${widthPercent}%)`
                          }}
                        >
                          <span className={`text-emerald-500 font-mono font-medium transition-all duration-200 relative z-10 ${index === 0 && isUpdating ? 'text-emerald-600' : ''
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
                <div className="space-y-1 overflow-hidden flex flex-col">
                  <div className="flex justify-between text-xs text-gray-600 font-medium border-b border-gray-200 pb-2">
                    <span>Price (USD)</span>
                    <span>Size (BTC)</span>
                  </div>
                  <div className="space-y-0.5 flex-1">
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
                          <span className={`text-red-500 font-mono font-medium transition-all duration-200 relative z-10 ${index === 0 && isUpdating ? 'text-red-600' : ''
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

          {/* Events Rate Chart - Right */}
          <div className="flex-1 h-full">
            <EventsRateChart
              key={chartResetKey}
              totalEventsReceived={state.metrics.total_events_received || 0}
              className="h-full"
              isConnected={isConnected}
            />
          </div>
        </div>
      </div>

      {/* Welcome Modal */}
      <WelcomeModal 
        isOpen={showWelcomeModal} 
        onClose={handleCloseWelcomeModal} 
      />
    </div>
  )
}