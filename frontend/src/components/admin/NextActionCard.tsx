import React from 'react';
import { Clock, Wrench } from 'lucide-react';

interface NextActionCardProps {
  taskTitle: string;
  dueTime: string;
  onClick: () => void;
}

export default function NextActionCard({ taskTitle, dueTime, onClick }: NextActionCardProps) {
  return (
    <div className="card-base card-content p-sp-4 cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-sp-3">
          {/* Icon */}
          <div className="p-sp-2 bg-orange-100 rounded-full">
            <Wrench className="h-4 w-4 text-orange-600" />
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center gap-sp-2 mb-sp-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Next Action
              </span>
            </div>
            <h3 className="text-fs-3 font-semibold text-gray-900 mb-sp-1">{taskTitle}</h3>
            <div className="flex items-center gap-sp-4 text-fs-1 text-gray-600">
              <div className="flex items-center gap-sp-1">
                <Clock className="h-3 w-3" />
                <span>{dueTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Indicator */}
        <div className="text-orange-500 text-fs-1 font-medium">
          Action Required →
        </div>
      </div>
    </div>
  );
}
