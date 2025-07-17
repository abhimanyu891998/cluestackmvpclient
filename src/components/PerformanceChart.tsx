'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface PerformanceHistory {
    timestamps: Date[]
    memory: number[]
    queue: number[]
    processing_delay: number[]
}

interface PerformanceChartProps {
    data: PerformanceHistory
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
    // Transform data for Recharts
    const chartData = data.timestamps.map((timestamp, index) => ({
        time: timestamp.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }),
        memory: data.memory[index] || 0,
        queue: data.queue[index] || 0,
        processing_delay: data.processing_delay[index] || 0
    }))

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
                    <p className="text-gray-300 font-medium mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }} className="text-sm">
                            {entry.name}: {entry.value}
                            {entry.name === 'memory' ? ' MB' :
                                entry.name === 'queue' ? ' items' : ' ms'}
                        </p>
                    ))}
                </div>
            )
        }
        return null
    }

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold">Performance Trends</h3>
                <p className="text-sm text-gray-400 mt-1">
                    Real-time monitoring of system performance metrics
                </p>
            </div>

            <div className="p-4">
                {chartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <p>No performance data available</p>
                            <p className="text-xs mt-1">Data will appear as the system runs</p>
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                                dataKey="time"
                                stroke="#9CA3AF"
                                fontSize={12}
                                tick={{ fill: '#9CA3AF' }}
                            />
                            <YAxis
                                stroke="#9CA3AF"
                                fontSize={12}
                                tick={{ fill: '#9CA3AF' }}
                                yAxisId="left"
                            />
                            <YAxis
                                stroke="#9CA3AF"
                                fontSize={12}
                                tick={{ fill: '#9CA3AF' }}
                                yAxisId="right"
                                orientation="right"
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ color: '#D1D5DB' }}
                                iconType="line"
                            />
                            <Line
                                type="monotone"
                                dataKey="memory"
                                stroke="#3B82F6"
                                strokeWidth={2}
                                dot={false}
                                yAxisId="left"
                                name="Memory (MB)"
                            />
                            <Line
                                type="monotone"
                                dataKey="queue"
                                stroke="#F59E0B"
                                strokeWidth={2}
                                dot={false}
                                yAxisId="left"
                                name="Queue Size"
                            />
                            <Line
                                type="monotone"
                                dataKey="processing_delay"
                                stroke="#8B5CF6"
                                strokeWidth={2}
                                dot={false}
                                yAxisId="right"
                                name="Processing Delay (ms)"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="p-3 bg-gray-900 border-t border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span>Memory Usage</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span>Queue Size</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <span>Processing Delay</span>
                        </div>
                    </div>
                    <span>Real-time updates • Last {chartData.length} data points</span>
                </div>
            </div>
        </div>
    )
} 