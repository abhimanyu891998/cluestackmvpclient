export function generateSampleOrderbook() {
    const basePrice = 50500
    const bids: [string, string][] = []
    const asks: [string, string][] = []

    // Generate bids (prices below base price)
    for (let i = 0; i < 15; i++) {
        const price = basePrice - (i * 0.5) - (i * 0.01)
        const quantity = (5 + i * 0.3).toFixed(4)
        bids.push([price.toFixed(2), quantity])
    }

    // Generate asks (prices above base price)
    for (let i = 0; i < 15; i++) {
        const price = basePrice + (i * 0.5) + (i * 0.01)
        const quantity = (5 + i * 0.3).toFixed(4)
        asks.push([price.toFixed(2), quantity])
    }

    const midPrice = basePrice
    const spread = asks[0] ? parseFloat(asks[0][0]) - parseFloat(bids[0][0]) : 0

    return {
        bids,
        asks,
        mid_price: midPrice,
        spread: spread,
        sequence_id: 1,
        timestamp: null
    }
}

export function generateSampleMetrics() {
    return {
        memory_usage_mb: 25.5,
        queue_size: 150,
        processing_delay_ms: 15.2,
        server_status: 'healthy',
        active_clients: 1,
        current_scenario: 'stable-mode',
        uptime_seconds: 3600
    }
} 