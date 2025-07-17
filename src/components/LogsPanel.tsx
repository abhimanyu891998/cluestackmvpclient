'use client'

import { FileText, AlertTriangle, Info, XCircle } from 'lucide-react'

interface LogEntry {
    timestamp: Date
    level: string
    message: string
}

interface LogsPanelProps {
    logs: LogEntry[]
}

export default function LogsPanel({ logs }: LogsPanelProps) {
    const getLogIcon = (level: string) => {
        switch (level) {
            case 'INCIDENT':
            case 'ERROR':
                return <XCircle className="w-3 h-3 text-red-400" />
            case 'WARNING':
                return <AlertTriangle className="w-3 h-3 text-yellow-400" />
            default:
                return <Info className="w-3 h-3 text-blue-400" />
        }
    }

    const getLogColor = (level: string) => {
        switch (level) {
            case 'INCIDENT':
            case 'ERROR':
                return 'text-red-400'
            case 'WARNING':
                return 'text-yellow-400'
            default:
                return 'text-gray-300'
        }
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Live Logs</span>
                    <span className="text-sm text-gray-400 font-normal">
                        ({logs.length} entries)
                    </span>
                </h3>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No logs available</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {logs.slice(-20).reverse().map((log, index) => (
                            <div
                                key={index}
                                className="flex items-start space-x-2 p-2 rounded hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex-shrink-0 mt-0.5">
                                    {getLogIcon(log.level)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 font-mono">
                                            [{formatTime(log.timestamp)}]
                                        </span>
                                        <span className={`text-xs font-medium ${getLogColor(log.level)}`}>
                                            {log.level}
                                        </span>
                                    </div>
                                    <p className={`text-sm ${getLogColor(log.level)} mt-1`}>
                                        {log.message}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3 bg-gray-900 border-t border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <XCircle className="w-3 h-3 text-red-400" />
                            <span>Error</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            <span>Warning</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Info className="w-3 h-3 text-blue-400" />
                            <span>Info</span>
                        </div>
                    </div>
                    <span>Last 20 entries • Auto-refresh</span>
                </div>
            </div>
        </div>
    )
} 