import React from 'react'
import { Wrench, Clock, Star, ChevronRight } from 'lucide-react'
import type { Service } from '../services/api'

interface Props {
  service: Service
}

function ServiceCard({ service }: Props) {
  return (
    <div className="glass-card rounded-2xl p-6 hover:scale-105 transition-all duration-300 group cursor-pointer">
      <div className="relative">
        {/* Service Icon */}
        <div className="w-14 h-14 bg-gradient-to-br from-blue-600/20 to-orange-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
          <Wrench className="h-7 w-7 text-blue-600" />
        </div>
        
        {/* Service Name */}
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-300">
          {service.name}
        </h3>
        
        {/* Service Description */}
        {service.description && (
          <p className="text-gray-600 leading-relaxed mb-4">
            {service.description}
          </p>
        )}
        
        {/* Service Meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {service.duration && (
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                {service.duration}
              </div>
            )}
            <div className="flex items-center text-sm text-orange-500">
              <Star className="h-4 w-4 mr-1 fill-current" />
              5.0
            </div>
          </div>
          
          <ChevronRight className="h-5 w-5 text-blue-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
        </div>
        
        {/* Price Badge */}
        {service.base_price && (
          <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            ${service.base_price}
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(ServiceCard)
