import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { TrendingUp, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { DashboardStats } from '../../lib/api';

interface DashboardSidebarProps {
  stats: DashboardStats;
  handleWorkOrders: () => void;
  handlePartsLookup: () => void;
  handleCreateQuote: () => void;
  handleEmergency: () => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  stats,
  handleWorkOrders,
  handlePartsLookup,
  handleCreateQuote,
  handleEmergency,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="lg:col-span-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-100 rounded-t-lg font-bold text-gray-700 hover:bg-gray-200 transition-colors"
      >
        <span className="text-base">📊 Stats & Tools</span>
        {isOpen ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
      </button>
      {isOpen && (
        <div className="space-y-4 p-5 bg-white rounded-b-lg shadow-md">
          {/* Today's Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-600" />
                📊 Today's Numbers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-800">{stats.completedToday}</div>
                  <div className="text-sm text-gray-600 font-medium">✅ Jobs Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-800">{stats.pendingAppointments}</div>
                  <div className="text-sm text-gray-600 font-medium">⏳ Jobs Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-800">${stats.todayRevenue}</div>
                  <div className="text-sm text-gray-600 font-medium">💰 Revenue</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-800">{stats.partsOrdered}</div>
                  <div className="text-sm text-gray-600 font-medium">🔧 Parts Awaiting Delivery</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Quick Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-6 w-6 text-orange-600" />
                🛠️ Shop Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleWorkOrders}
                  className="p-4 rounded-xl hover:bg-blue-100 transition-colors flex flex-col items-center space-y-2 touch-manipulation"
                  variant="info"
                >
                  <span className="text-2xl">📋</span>
                  <span className="font-medium text-xs">Work Orders</span>
                </button>
                <button 
                  onClick={handlePartsLookup}
                  className="p-4 rounded-xl hover:bg-green-100 transition-colors flex flex-col items-center space-y-2 touch-manipulation"
                  variant="success"
                >
                  <span className="text-2xl">🔧</span>
                  <span className="font-medium text-xs">Parts Lookup</span>
                </button>
                <button 
                  onClick={handleCreateQuote}
                  className="p-4 rounded-xl hover:bg-yellow-100 transition-colors flex flex-col items-center space-y-2 touch-manipulation"
                  variant="warning"
                >
                  <span className="text-2xl">💰</span>
                  <span className="font-medium text-xs">Create Quote</span>
                </button>
                <button 
                  onClick={handleEmergency}
                  className="p-4 rounded-xl hover:bg-red-100 transition-colors flex flex-col items-center space-y-2 touch-manipulation"
                  variant="danger"
                >
                  <span className="text-2xl">🚨</span>
                  <span className="font-medium text-xs">Emergency</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};