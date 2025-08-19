import React from 'react';

export const StatusIcons = {
  SCHEDULED: () => (
    <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
      <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    </div>
  ),

  IN_PROGRESS: () => (
    <div className="w-5 h-5 rounded-full bg-success-100 flex items-center justify-center">
      <svg className="w-3 h-3 text-success-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
      </svg>
    </div>
  ),

  READY: () => (
    <div className="w-5 h-5 rounded-full bg-warning-100 flex items-center justify-center">
      <svg className="w-3 h-3 text-warning-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </div>
  ),

  COMPLETED: () => (
    <div className="w-5 h-5 rounded-full bg-success-500 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>
  )
};

export const ServiceTypeIcons = {
  brake: () => (
    <div className="w-6 h-6 rounded-lg bg-danger-100 flex items-center justify-center">
      <span className="text-danger-600 text-sm font-bold">🛠</span>
    </div>
  ),

  oil: () => (
    <div className="w-6 h-6 rounded-lg bg-warning-100 flex items-center justify-center">
      <span className="text-warning-600 text-sm font-bold">🛢</span>
    </div>
  ),

  diagnostic: () => (
    <div className="w-6 h-6 rounded-lg bg-primary-100 flex items-center justify-center">
      <span className="text-primary-600 text-sm font-bold">🔍</span>
    </div>
  ),

  general: () => (
    <div className="w-6 h-6 rounded-lg bg-steel-100 flex items-center justify-center">
      <span className="text-steel-600 text-sm font-bold">⚙️</span>
    </div>
  )
};

export default StatusIcons;
