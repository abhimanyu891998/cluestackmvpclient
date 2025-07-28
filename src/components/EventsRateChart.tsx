'use client'

import { useState, useEffect, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatUTCChartTime } from '@/utils/datetime'
import { Activity } from 'lucide-react'

interface EventsRateData {
  timestamp: Date
  rate: number
  cumulative: number
}

interface EventsRateChartProps {
  totalEventsReceived: number
  className?: string
  isConnected?: boolean
}

interface TooltipPayload {
  color: string
  name: string
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

export default function EventsRateChart({ totalEventsReceived, className = '', isConnected = true }: EventsRateChartProps) {
  const [rateHistory, setRateHistory] = useState<EventsRateData[]>([])
  const lastEventsCount = useRef(0)
  const lastUpdateTime = useRef(Date.now())
  const currentEventsRef = useRef(totalEventsReceived)
  
  // Keep current events count in ref for interval access
  useEffect(() => {
    currentEventsRef.current = totalEventsReceived
  }, [totalEventsReceived])
  
  // Initialize tracking on first data
  useEffect(() => {
    if (totalEventsReceived > 0 && lastEventsCount.current === 0) {
      lastEventsCount.current = totalEventsReceived
      lastUpdateTime.current = Date.now()
      console.log('🎯 Initialized tracking with:', { totalEventsReceived, time: new Date().toLocaleTimeString() })
    }
  }, [totalEventsReceived])
  
  // Update rate calculation every second
  useEffect(() => {
    const interval = setInterval(() => {
      // Skip if not initialized yet or disconnected
      if (lastEventsCount.current === 0) {
        console.log('⏳ Waiting for initialization...')
        return
      }
      
      if (!isConnected) {
        console.log('🔌 Disconnected - stopping rate calculation')
        return
      }
      
      const currentTime = Date.now()
      const timeDelta = (currentTime - lastUpdateTime.current) / 1000 // seconds
      const currentTotal = currentEventsRef.current
      const eventsDelta = currentTotal - lastEventsCount.current
      
      // Calculate events per second
      const rate = timeDelta > 0 ? eventsDelta / timeDelta : 0
      
      // Debug logging
      console.log('🔢 Rate calculation:', {
        currentTime: new Date(currentTime).toLocaleTimeString(),
        timeDelta: timeDelta.toFixed(2),
        currentTotal,
        lastCount: lastEventsCount.current,
        eventsDelta,
        calculatedRate: rate.toFixed(2)
      })
      
      const newDataPoint: EventsRateData = {
        timestamp: new Date(),
        rate: Math.round(rate), // Round to nearest whole number for cleaner display
        cumulative: currentTotal
      }
      
      setRateHistory(prev => {
        // Keep last 60 data points (1 minute of data)
        const newHistory = [...prev, newDataPoint].slice(-60)
        console.log('📊 Added data point:', newDataPoint, 'History length:', newHistory.length)
        return newHistory
      })
      
      // Update tracking variables
      lastEventsCount.current = currentTotal
      lastUpdateTime.current = currentTime
    }, 1000) // Update every second
    
    return () => clearInterval(interval)
  }, [isConnected]) // Include isConnected in dependency array
  
  // Transform data for Recharts
  const chartData = rateHistory.map((item, index) => ({
    time: formatUTCChartTime(item.timestamp),
    rate: item.rate,
    cumulative: item.cumulative,
    index
  }))
  
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
          <p className="text-gray-800 font-medium mb-2">{label}</p>
          {payload.map((entry: TooltipPayload, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}
              {entry.name === 'Events/sec' ? ' events/sec' : ' total'}
            </p>
          ))}
        </div>
      )
    }
    return null
  }
  
  // Get current rate for display
  const currentRate = rateHistory.length > 0 ? rateHistory[rateHistory.length - 1].rate : 0
  
  // Show debug info in console
  console.log('📈 Chart state:', {
    totalEventsReceived,
    rateHistoryLength: rateHistory.length,
    currentRate,
    chartDataLength: chartData.length
  })
  
  // Static Y-axis domain
  const yAxisDomain = [0, 18]
  
  // Determine color based on rate and connection status
  const getRateColor = (rate: number) => {
    // If disconnected, always show red
    if (!isConnected) return '#EF4444' // red
    
    // Connected state colors
    if (rate < 10) return '#10B981' // green
    return '#F59E0B' // yellow (for rate >= 10)
  }
  
  const currentRateColor = getRateColor(currentRate)
  
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-black">Order Book Update Rate</h3>
            <div className={`px-2 py-1 rounded text-xs font-medium ${currentRate > 0 ? 'text-blue-600 bg-blue-50' : 'text-gray-600 bg-gray-50'}`}>
              LIVE
            </div>
          </div>
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <div className={`font-medium transition-all duration-300 ${!isConnected ? 'text-red-600' : currentRate >= 10 ? 'text-yellow-600' : 'text-blue-600'}`}>
              {currentRate}/sec
            </div>
          </div>
        </div>
      </div>

      <div className="p-1 flex-1 flex flex-col justify-center">
        {chartData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Collecting rate data...</p>
              <p className="text-xs mt-1">Chart will update every second</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full" style={{ height: 'calc(100% - 60px)' }}>
              <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 15, left: 15, bottom: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#E5E7EB"
                horizontalCoordinatesGenerator={(lineProps) => {
                  // Add more horizontal grid lines for better readability
                  const max = yAxisDomain[1]
                  const step = max <= 20 ? 5 : max <= 100 ? 20 : max <= 600 ? 100 : 200
                  const lines = []
                  for (let i = 0; i <= max; i += step) {
                    lines.push(lineProps.y1 - (i / max) * (lineProps.y1 - lineProps.y2))
                  }
                  return lines
                }}
              />
              <XAxis
                dataKey="time"
                stroke="#6B7280"
                fontSize={11}
                tick={{ fill: '#6B7280' }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#6B7280"
                fontSize={11}
                tick={{ fill: '#6B7280' }}
                domain={yAxisDomain}
                label={{ value: 'Events/sec', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="linear"
                dataKey="rate" 
                name="Events/sec"
                stroke={currentRateColor}
                fill={currentRateColor}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="px-2 py-1 bg-gray-50 border-t border-gray-200 rounded-b-xl flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentRateColor }}
              ></div>
              <span>Current Rate</span>
            </div>
            <div>
              <span className="font-medium text-gray-800">
                Total: {totalEventsReceived.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span>Updates every 1s</span>
            <span>Last {chartData.length} data points</span>
            <span className="text-gray-500">•</span>
            <span>Scale: 0-{yAxisDomain[1].toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}