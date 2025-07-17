'use client'

import { Database, Clock, Users, Activity, AlertTriangle } from 'lucide-react'

interface Metrics {
    memory_usage_mb: number
    queue_size: number
    processing_delay_ms: number
    server_status: string
    active_clients: number
    current_scenario: string
    uptime_seconds: number
}

interface MetricsPanelProps {
    metrics: Metrics
}

export default function MetricsPanel({ metrics }: MetricsPanelProps) {
    const formatUptime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = Math.floor(seconds % 60)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy':
                return 'text-green-400'
            case 'degraded':
                return 'text-yellow-400'
            default:
                return 'text-gray-400'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy':
                return <Activity className="w-4 h-4 text-green-400" />
            case 'degraded':
                return <AlertTriangle className="w-4 h-4 text-yellow-400" />
            default:
                return <Activity className="w-4 h-4 text-gray-400" />
        }
    }

    const getQueueStatus = (queueSize: number) => {
        if (queueSize < 100) return { color: 'text-green-400', status: 'Normal' }
        if (queueSize < 500) return { color: 'text-yellow-400', status: 'Building' }
        return { color: 'text-red-400', status: 'High' }
    }

    const getDelayStatus = (delay: number) => {
        if (delay < 20) return { color: 'text-green-400', status: 'Fast' }
        if (delay < 50) return { color: 'text-yellow-400', status: 'Slow' }
        return { color: 'text-red-400', status: 'Very Slow' }
    }

    const queueStatus = getQueueStatus(metrics.queue_size)
    const delayStatus = getDelayStatus(metrics.processing_delay_ms)

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <Database className="w-5 h-5" />
                    <span>System Metrics</span>
                </h3>
            </div>

            <div className="p-4 space-y-4">
                {/* Server Status */}
                <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        {getStatusIcon(metrics.server_status)}
                        <div>
                            <p className="text-sm text-gray-400">Server Status</p>
                            <p className={`font-semibold ${getStatusColor(metrics.server_status)}`}>
                                {metrics.server_status === 'healthy' ? 'Healthy' :
                                    metrics.server_status === 'degraded' ? 'Degraded' : 'Unknown'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Memory Usage */}
                <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <Database className="w-4 h-4 text-blue-400" />
                        <div>
                            <p className="text-sm text-gray-400">Memory Usage</p>
                            <p className="font-semibold text-blue-400">
                                {metrics.memory_usage_mb.toFixed(1)} MB
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="w-16 h-2 bg-gray-600 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-400 transition-all duration-300"
                                style={{ width: `${Math.min((metrics.memory_usage_mb / 100) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Queue Size */}
                <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <Activity className="w-4 h-4 text-yellow-400" />
                        <div>
                            <p className="text-sm text-gray-400">Queue Size</p>
                            <p className={`font-semibold ${queueStatus.color}`}>
                                {metrics.queue_size.toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`text-xs ${queueStatus.color}`}>
                            {queueStatus.status}
                        </span>
                    </div>
                </div>

                {/* Processing Delay */}
                <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <div>
                            <p className="text-sm text-gray-400">Processing Delay</p>
                            <p className={`font-semibold ${delayStatus.color}`}>
                                {metrics.processing_delay_ms}ms
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`text-xs ${delayStatus.color}`}>
                            {delayStatus.status}
                        </span>
                    </div>
                </div>

                {/* Active Clients */}
                <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <Users className="w-4 h-4 text-green-400" />
                        <div>
                            <p className="text-sm text-gray-400">Active Clients</p>
                            <p className="font-semibold text-green-400">
                                {metrics.active_clients}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Uptime */}
                <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-400">Uptime</p>
                            <p className="font-semibold text-gray-300 font-mono">
                                {formatUptime(metrics.uptime_seconds)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Current Scenario */}
                <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                        <Activity className="w-4 h-4 text-orange-400" />
                        <div>
                            <p className="text-sm text-gray-400">Current Scenario</p>
                            <p className="font-semibold text-orange-400">
                                {metrics.current_scenario.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 