'use client'

import React from 'react'
import { X } from 'lucide-react'

interface WelcomeModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg max-w-md w-full mx-4 p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal content */}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-black mb-6">
            Welcome to the Trackdown Demo
          </h2>
          
          <div className="space-y-4 text-left">
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <p className="text-gray-700 text-sm">
                Press &quot;Play&quot; to start the market simulation
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <p className="text-gray-700 text-sm">
                Once started, toggle to burst mode on the top to simulate a market spike and wait for the performance to degrade.
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </span>
              <p className="text-gray-700 text-sm">
                Once the performance degradation alert is raised, click &quot;Resolve with Trackdown&quot; to see the real magic!
              </p>
            </div>
          </div>
          
          <div className="mt-8">
            <button
              onClick={onClose}
              className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}