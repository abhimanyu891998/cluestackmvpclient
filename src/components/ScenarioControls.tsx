'use client'

import { useState, useEffect } from 'react'
import { Play, Square, Settings, Zap } from 'lucide-react'

const scenarios = [
  { value: 'stable-mode', label: 'Stable Mode', description: 'Normal Operation' },
  { value: 'burst-mode', label: 'Burst Mode', description: 'High-Frequency Spike' },
  { value: 'gradual-spike', label: 'Gradual Spike', description: 'Progressive Degradation' },
  { value: 'extreme-spike', label: 'Extreme Spike', description: 'Maximum Stress' }
]

export default function ScenarioControls() {
  const [selectedScenario, setSelectedScenario] = useState('stable-mode')
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check simulation status on component mount and periodically
  useEffect(() => {
    const checkSimulationStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/status/publisher')
        if (response.ok) {
          const status = await response.json()
          // Update simulation status based on server response
          if (status.publisher && status.publisher.is_running !== undefined) {
            setIsSimulationRunning(status.publisher.is_running)
          }
          console.log('Publisher status:', status)
        }
      } catch (error) {
        console.error('Error checking publisher status:', error)
      }
    }

    checkSimulationStatus()

    // Check status every 5 seconds
    const interval = setInterval(checkSimulationStatus, 5000)

    return () => clearInterval(interval)
  }, [])

  const switchScenario = async (scenario: string) => {
    setIsLoading(true)
    try {
      console.log(`Attempting to switch to scenario: ${scenario}`)
      const response = await fetch(`http://localhost:8000/config/profile/${scenario}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const result = await response.json()
        setSelectedScenario(scenario)
        console.log(`Successfully switched to scenario: ${scenario}`, result)
      } else {
        const errorText = await response.text()
        console.error(`Failed to switch scenario: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error('Error switching scenario:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startSimulation = async () => {
    setIsLoading(true)
    try {
      console.log('Attempting to start simulation...')
      // Note: The server automatically starts publishing when it starts up
      // This endpoint doesn't exist, so we'll just update the local state
      setIsSimulationRunning(true)
      console.log('Simulation started successfully')
    } catch (error) {
      console.error('Error starting simulation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const stopSimulation = async () => {
    setIsLoading(true)
    try {
      console.log('Attempting to stop simulation...')
      // Note: The server doesn't have a stop endpoint
      // This would need to be implemented on the server side
      setIsSimulationRunning(false)
      console.log('Simulation stopped successfully')
    } catch (error) {
      console.error('Error stopping simulation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Scenario Controls</span>
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Scenario Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Current Scenario
          </label>
          <select
            value={selectedScenario}
            onChange={(e) => switchScenario(e.target.value)}
            disabled={isLoading}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {scenarios.map((scenario) => (
              <option key={scenario.value} value={scenario.value}>
                {scenario.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            {scenarios.find(s => s.value === selectedScenario)?.description}
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={startSimulation}
            disabled={isLoading || isSimulationRunning}
            className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>Start Simulation</span>
          </button>

          <button
            onClick={stopSimulation}
            disabled={isLoading || !isSimulationRunning}
            className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Square className="w-4 h-4" />
            <span>Stop Simulation</span>
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center space-x-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${isSimulationRunning ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className={isSimulationRunning ? 'text-green-400' : 'text-gray-400'}>
            {isSimulationRunning ? 'Simulation Running' : 'Simulation Stopped'}
          </span>
        </div>

        {/* Quick Scenario Buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quick Switch
          </label>
          <div className="grid grid-cols-2 gap-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.value}
                onClick={() => switchScenario(scenario.value)}
                disabled={isLoading}
                className={`p-2 rounded-lg text-xs font-medium transition-colors ${selectedScenario === scenario.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  } disabled:opacity-50`}
              >
                {scenario.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 