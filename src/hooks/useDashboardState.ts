'use client'

import { useState, useEffect, useCallback } from 'react'
import { generateSampleMetrics } from '@/lib/sampleData'

interface OrderbookData {
    bids: [string, string][]
    asks: [string, string][]
    mid_price: number
    spread: number
    sequence_id: number
    timestamp: string | null
    data_age_ms?: number
    is_stale?: boolean
    processing_delay_ms?: number
}

interface Metrics {
    memory_usage_mb: number
    queue_size: number
    processing_delay_ms: number
    server_status: string
    active_clients: number
    current_scenario: string
    uptime_seconds: number
}

interface Incident {
    timestamp: string
    type: string
    details: string
    scenario: string
    uptime: number
}

interface LogEntry {
    timestamp: Date
    level: string
    message: string
}

interface PerformanceHistory {
    timestamps: Date[]
    memory: number[]
    queue: number[]
    processing_delay: number[]
}

interface DashboardState {
    orderbook_data: OrderbookData
    metrics: Metrics
    incidents: Incident[]
    logs: LogEntry[]
    performance_history: PerformanceHistory
}

const initialState: DashboardState = {
    orderbook_data: {
        bids: [],
        asks: [],
        mid_price: 0,
        spread: 0,
        sequence_id: 0,
        timestamp: null,
        data_age_ms: 0,
        is_stale: false,
        processing_delay_ms: 0
    },
    metrics: generateSampleMetrics(),
    incidents: [],
    logs: [],
    performance_history: {
        timestamps: [],
        memory: [],
        queue: [],
        processing_delay: []
    }
}

export function useDashboardState() {
    const [state, setState] = useState<DashboardState>(initialState)

    const updateState = (updates: Partial<DashboardState>) => {
        setState(prev => ({ ...prev, ...updates }))
    }

    const addLog = (level: string, message: string) => {
        const logEntry: LogEntry = {
            timestamp: new Date(),
            level,
            message
        }

        setState(prev => ({
            ...prev,
            logs: [...prev.logs.slice(-999), logEntry] // Keep last 1000 logs
        }))
    }

    const addIncident = (incident: Incident) => {
        setState(prev => ({
            ...prev,
            incidents: [...prev.incidents, incident]
        }))
    }

    const updateOrderbook = (orderbookData: Partial<OrderbookData>) => {
        console.log('🔄 updateOrderbook called with:', orderbookData)
        setState(prev => {
            const newState = {
                ...prev,
                orderbook_data: { ...prev.orderbook_data, ...orderbookData }
            }
            console.log('✅ New orderbook state:', newState.orderbook_data)
            return newState
        })
    }

    const updateMetrics = (metrics: Partial<Metrics>) => {
        console.log('updateMetrics called with:', metrics)
        setState(prev => {
            const newState = {
                ...prev,
                metrics: { ...prev.metrics, ...metrics }
            }
            console.log('New metrics state:', newState.metrics)
            return newState
        })
    }

    const updatePerformanceHistory = (memory: number, queue: number, delay: number) => {
        const now = new Date()
        setState(prev => ({
            ...prev,
            performance_history: {
                timestamps: [...prev.performance_history.timestamps.slice(-999), now],
                memory: [...prev.performance_history.memory.slice(-999), memory],
                queue: [...prev.performance_history.queue.slice(-999), queue],
                processing_delay: [...prev.performance_history.processing_delay.slice(-999), delay]
            }
        }))
    }

    return {
        state,
        updateState,
        addLog,
        addIncident,
        updateOrderbook,
        updateMetrics,
        updatePerformanceHistory
    }
} 