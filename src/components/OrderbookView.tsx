'use client'

import { useMemo, useState, useEffect } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface OrderbookViewProps {
    bids: [string, string][]
    asks: [string, string][]
    midPrice: number
    spread: number
    lastUpdate?: Date
}

export default function OrderbookView({ bids, asks, midPrice, spread, lastUpdate }: OrderbookViewProps) {
    // Use provided lastUpdate or fallback to current time
    const displayTime = lastUpdate || new Date()

    // Debug logging
    console.log('📊 OrderbookView render:', {
        bidsCount: bids.length,
        asksCount: asks.length,
        midPrice,
        spread,
        lastUpdate: displayTime
    })

    const processedData = useMemo(() => {
        // Process bids (reverse for display - highest bid first)
        const processedBids = bids
            .slice(0, 15) // Top 15 levels
            .reverse()
            .map(([price, quantity], index) => ({
                price: parseFloat(price),
                quantity: parseFloat(quantity),
                total: parseFloat(quantity),
                depth: 0,
                index
            }))

        // Calculate cumulative totals for bids
        let cumulativeTotal = 0
        processedBids.forEach(bid => {
            cumulativeTotal += bid.total
            bid.total = cumulativeTotal
        })

        // Process asks
        const processedAsks = asks
            .slice(0, 15) // Top 15 levels
            .map(([price, quantity], index) => ({
                price: parseFloat(price),
                quantity: parseFloat(quantity),
                total: parseFloat(quantity),
                depth: 0,
                index
            }))

        // Calculate cumulative totals for asks
        cumulativeTotal = 0
        processedAsks.forEach(ask => {
            cumulativeTotal += ask.total
            ask.total = cumulativeTotal
        })

        // Calculate depth percentages
        const maxBidTotal = processedBids.length > 0 ? processedBids[processedBids.length - 1].total : 0
        const maxAskTotal = processedAsks.length > 0 ? processedAsks[processedAsks.length - 1].total : 0
        const maxTotal = Math.max(maxBidTotal, maxAskTotal)

        processedBids.forEach(bid => {
            bid.depth = maxTotal > 0 ? (bid.total / maxTotal) * 100 : 0
        })

        processedAsks.forEach(ask => {
            ask.depth = maxTotal > 0 ? (ask.total / maxTotal) * 100 : 0
        })

        return { bids: processedBids, asks: processedAsks }
    }, [bids, asks])

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price)
    }

    const formatQuantity = (quantity: number) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        }).format(quantity)
    }

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">Live Orderbook</h3>
                        <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-400">LIVE</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-2">
                            <span className="text-gray-400">Mid:</span>
                            <span className="font-mono text-yellow-400">
                                ${formatPrice(midPrice)}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-gray-400">Spread:</span>
                            <span className="font-mono text-red-400">
                                ${formatPrice(spread)}
                            </span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {typeof window !== 'undefined' ? displayTime.toLocaleTimeString() : '--:--:--'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Orderbook Table */}
            <div className="overflow-hidden">
                {/* Column Headers */}
                <div className="grid grid-cols-2 bg-gray-900 border-b border-gray-700">
                    <div className="p-3 border-r border-gray-700">
                        <div className="grid grid-cols-3 text-xs text-gray-400 font-medium">
                            <span>Price</span>
                            <span>Size</span>
                            <span>Total</span>
                        </div>
                    </div>
                    <div className="p-3">
                        <div className="grid grid-cols-3 text-xs text-gray-400 font-medium">
                            <span>Price</span>
                            <span>Size</span>
                            <span>Total</span>
                        </div>
                    </div>
                </div>

                {/* Orderbook Rows */}
                <div className="grid grid-cols-2">
                    {/* Bids (Left Side - Green) */}
                    <div className="border-r border-gray-700">
                        {processedData.bids.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>Waiting for live data...</p>
                            </div>
                        ) : (
                            processedData.bids.map((bid, index) => (
                                <div
                                    key={`bid-${index}`}
                                    className="relative grid grid-cols-3 p-2 hover:bg-gray-700/50 transition-colors"
                                >
                                    {/* Depth background */}
                                    <div
                                        className="absolute inset-0 bg-green-600/10"
                                        style={{ width: `${bid.depth}%` }}
                                    />

                                    {/* Content */}
                                    <div className="relative z-10 text-green-400 font-mono text-sm">
                                        {formatPrice(bid.price)}
                                    </div>
                                    <div className="relative z-10 text-gray-300 font-mono text-sm">
                                        {formatQuantity(bid.quantity)}
                                    </div>
                                    <div className="relative z-10 text-gray-400 font-mono text-sm">
                                        {formatQuantity(bid.total)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Asks (Right Side - Red) */}
                    <div>
                        {processedData.asks.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>Waiting for live data...</p>
                            </div>
                        ) : (
                            processedData.asks.map((ask, index) => (
                                <div
                                    key={`ask-${index}`}
                                    className="relative grid grid-cols-3 p-2 hover:bg-gray-700/50 transition-colors"
                                >
                                    {/* Depth background */}
                                    <div
                                        className="absolute inset-0 bg-red-600/10"
                                        style={{ width: `${ask.depth}%` }}
                                    />

                                    {/* Content */}
                                    <div className="relative z-10 text-red-400 font-mono text-sm">
                                        {formatPrice(ask.price)}
                                    </div>
                                    <div className="relative z-10 text-gray-300 font-mono text-sm">
                                        {formatQuantity(ask.quantity)}
                                    </div>
                                    <div className="relative z-10 text-gray-400 font-mono text-sm">
                                        {formatQuantity(ask.total)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-900 border-t border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>Bids</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span>Asks</span>
                        </div>
                    </div>
                    <div className="text-gray-500">
                        Top 15 levels • Real-time updates
                    </div>
                </div>
            </div>
        </div>
    )
} 