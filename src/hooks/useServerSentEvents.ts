'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDashboardState } from './useDashboardState'
import { buildSSEUrl } from '../config/api'

interface SSEMessage {
  type: string
  data: Record<string, unknown>
  timestamp: string
}

export function useServerSentEvents(dashboardState: ReturnType<typeof useDashboardState>) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectingRef = useRef(false)

  const connect = useCallback(() => {
    if (isConnectingRef.current || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return
    }

    isConnectingRef.current = true
    console.log('🔌 Attempting SSE connection...')

    try {
      // Add some debug info about the connection
      const sseUrl = buildSSEUrl()
      console.log('🔍 Connecting from origin:', window.location.origin)
      console.log('🔍 Connecting to:', sseUrl)
      
      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('✅ SSE connected successfully')
        setIsConnected(true)
        setError(null)
        isConnectingRef.current = false
        dashboardState.addLog('INFO', 'SSE connected successfully')
      }

      eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data)
          console.log('📨 Received:', message.type, message.data)

          switch (message.type) {
            case 'connection':
              console.log('🤝 Server connection established')
              dashboardState.addLog('INFO', `Connected to server: ${message.data.message}`)
              break

            case 'heartbeat':
              console.log('💓 Heartbeat received:', message.data)
              dashboardState.updateMetrics({
                memory_usage_mb: (message.data.memory_usage_mb as number) || 0,
                queue_size: (message.data.queue_size as number) || 0,
                processing_delay_ms: (message.data.processing_delay_ms as number) || 0,
                server_status: (message.data.server_status as string) || 'unknown',
                active_clients: (message.data.active_clients as number) || 0,
                current_scenario: (message.data.current_scenario as string) || 'unknown',
                uptime_seconds: (message.data.uptime_seconds as number) || 0
              })

              dashboardState.updatePerformanceHistory(
                (message.data.memory_usage_mb as number) || 0,
                (message.data.queue_size as number) || 0,
                (message.data.processing_delay_ms as number) || 0
              )
              break

            case 'orderbook_update':
              console.log('📊 Orderbook update received:', message.data)
              
              // Check for stale data
              const dataAge = (message.data.data_age_ms as number) || 0
              const isStale = (message.data.is_stale as boolean) || false
              
              // Log staleness warnings
              if (isStale && dataAge > 300) {
                console.warn('CRITICAL: Data staleness detected', {
                  dataAge: dataAge,
                  sequenceId: message.data.sequence_id as number,
                  processingDelay: message.data.processing_delay_ms as number
                })
                dashboardState.addLog('CRITICAL', `Stale data detected: ${dataAge}ms old (seq: ${message.data.sequence_id as number})`)
              } else if (isStale) {
                console.warn('WARNING: Data freshness degraded', {
                  dataAge: dataAge,
                  sequenceId: message.data.sequence_id as number
                })
                dashboardState.addLog('WARNING', `Data freshness degraded: ${dataAge}ms lag`)
              }
              
              dashboardState.updateOrderbook({
                bids: (message.data.bids as [string, string][]) || [],
                asks: (message.data.asks as [string, string][]) || [],
                mid_price: (message.data.mid_price as number) || 0,
                spread: (message.data.spread as number) || 0,
                sequence_id: (message.data.sequence_id as number) || 0,
                timestamp: (message.data.timestamp as string) || new Date().toISOString(),
                data_age_ms: dataAge,
                is_stale: isStale,
                processing_delay_ms: (message.data.processing_delay_ms as number) || 0
              })
              break

            case 'incident_alert':
              console.log('🚨 Incident alert received:', message.data)
              
              let incidentDetails = ''
              let logMessage = ''
              
              // Special handling for stale data alerts
              if (message.data.type === 'stale_data') {
                console.error('CRITICAL: Stale data incident detected', message.data)
                incidentDetails = `Data age: ${message.data.data_age_ms as number}ms, Processing delay: ${message.data.processing_delay_ms as number}ms, Queue: ${message.data.queue_size as number}`
                logMessage = `STALE DATA ALERT: ${message.data.data_age_ms as number}ms lag on sequence ${message.data.sequence_id as number}`
                dashboardState.addLog('CRITICAL', logMessage)
              } else {
                // Handle other incident types (memory threshold, etc.)
                incidentDetails = typeof message.data.details === 'object' 
                  ? JSON.stringify(message.data.details) 
                  : (message.data.details as string) || 'No details provided'
                logMessage = `Incident: ${message.data.type as string} - ${incidentDetails}`
                dashboardState.addLog('INCIDENT', logMessage)
              }
              
              dashboardState.addIncident({
                timestamp: (message.data.timestamp as string) || new Date().toISOString(),
                type: (message.data.type as string) || 'Unknown',
                details: incidentDetails,
                scenario: (message.data.scenario as string) || 'unknown',
                uptime: (message.data.uptime as number) || (message.data.uptime_seconds as number) || 0
              })
              break

            case 'keepalive':
              // Handle keepalive messages silently
              console.log('🔄 Keepalive received')
              break

            default:
              console.log('❓ Unknown message type:', message.type)
          }
        } catch (err) {
          console.error('❌ Error parsing SSE message:', err)
          dashboardState.addLog('ERROR', `Failed to parse SSE message: ${err}`)
        }
      }

      eventSource.onerror = (event) => {
        console.error('❌ SSE error:', event)
        setError('Connection error')
        setIsConnected(false)
        isConnectingRef.current = false
        dashboardState.addLog('ERROR', 'SSE connection error')

        // Close and reconnect on error
        eventSource.close()
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        
        // Add exponential backoff to prevent rapid reconnections
        const backoffDelay = Math.min(5000, 30000) // 5s delay, max 30s
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Attempting to reconnect after ${backoffDelay}ms delay...`)
          dashboardState.addLog('INFO', 'Attempting to reconnect...')
          connect()
        }, backoffDelay)
      }

    } catch (err) {
      console.error('❌ Error creating SSE connection:', err)
      setError('Failed to connect')
      setIsConnected(false)
      isConnectingRef.current = false
      dashboardState.addLog('ERROR', `Failed to create SSE connection: ${err}`)
    }
  }, [dashboardState])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setIsConnected(false)
    isConnectingRef.current = false
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { isConnected, error, connect, disconnect }
}