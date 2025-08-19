/**
 * Sprint 4A-T-003: Running Revenue Component
 *
 * Displays live running total of today's revenue in the dashboard header.
 * Updates in real-time as appointments are completed and payments are received.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { subscribeToRevenueUpdates, formatCurrency } from '../../services/revenueService';
import './RunningRevenue.css';

/**
 * RunningRevenue Component
 * Displays real-time revenue total in dashboard header
 */
export default function RunningRevenue({ className = '', showBreakdown = false }) {
  const [revenue, setRevenue] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle revenue updates from service
  const handleRevenueUpdate = useCallback((revenueData) => {
    setIsLoading(false);
    setError(null);

    // Trigger animation if revenue changed
    if (revenue && revenueData.totalRevenue !== revenue.totalRevenue) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }

    setRevenue(revenueData);
    setLastUpdated(new Date());
  }, [revenue]);

  // Handle subscription errors
  const handleError = useCallback((err) => {
    setError(err.message || 'Failed to load revenue data');
    setIsLoading(false);
  }, []);

  // Subscribe to revenue updates on mount
  useEffect(() => {
    let unsubscribe;

    try {
      unsubscribe = subscribeToRevenueUpdates(handleRevenueUpdate);
    } catch (err) {
      handleError(err);
    }

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [handleRevenueUpdate, handleError]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`running-revenue loading ${className}`}>
        <div className="revenue-skeleton">
          <div className="skeleton-line short"></div>
          <div className="skeleton-line"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`running-revenue error ${className}`}>
        <div className="revenue-label">Revenue Today:</div>
        <div className="revenue-amount error">
          Error loading
        </div>
      </div>
    );
  }

  // No data state
  if (!revenue) {
    return (
      <div className={`running-revenue ${className}`}>
        <div className="revenue-label">Revenue Today:</div>
        <div className="revenue-amount">
          $0
        </div>
      </div>
    );
  }

  return (
    <div className={`running-revenue ${className} ${isAnimating ? 'updating' : ''}`}>
      <div className="revenue-content">
        <div className="revenue-label">
          💰 Revenue Today:
        </div>
        <div className="revenue-amount">
          {formatCurrency(revenue.totalRevenue)}
        </div>

        {showBreakdown && (
          <div className="revenue-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-label">Paid:</span>
              <span className="breakdown-value paid">
                {formatCurrency(revenue.paidAmount)}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">Pending:</span>
              <span className="breakdown-value pending">
                {formatCurrency(revenue.unpaidAmount)}
              </span>
            </div>
          </div>
        )}

        {lastUpdated && (
          <div className="revenue-updated">
            <span className="update-indicator">●</span>
            <span className="update-time">
              {lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version for smaller spaces
 */
export function RunningRevenueCompact({ className = '' }) {
  const [revenue, setRevenue] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToRevenueUpdates((revenueData) => {
      setRevenue(revenueData);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <div className={`running-revenue-compact loading ${className}`}>
        <div className="skeleton-compact"></div>
      </div>
    );
  }

  return (
    <div className={`running-revenue-compact ${className}`}>
      <span className="revenue-icon">💰</span>
      <span className="revenue-text">
        {formatCurrency(revenue?.totalRevenue || 0)}
      </span>
    </div>
  );
}

/**
 * Card version for dashboard widgets
 */
export function RunningRevenueCard({ className = '' }) {
  const [revenue, setRevenue] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trend, setTrend] = useState('neutral');

  useEffect(() => {
    let previousTotal = null;

    const unsubscribe = subscribeToRevenueUpdates((revenueData) => {
      setRevenue(revenueData);
      setIsLoading(false);

      // Calculate trend
      if (previousTotal !== null) {
        if (revenueData.totalRevenue > previousTotal) {
          setTrend('up');
        } else if (revenueData.totalRevenue < previousTotal) {
          setTrend('down');
        } else {
          setTrend('neutral');
        }
      }

      previousTotal = revenueData.totalRevenue;
    });

    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <div className={`running-revenue-card loading ${className}`}>
        <div className="card-skeleton">
          <div className="skeleton-line"></div>
          <div className="skeleton-line large"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`running-revenue-card ${className} trend-${trend}`}>
      <div className="card-header">
        <h3 className="card-title">Today's Revenue</h3>
        <div className="trend-indicator">
          {trend === 'up' && '📈'}
          {trend === 'down' && '📉'}
          {trend === 'neutral' && '📊'}
        </div>
      </div>

      <div className="card-amount">
        {formatCurrency(revenue?.totalRevenue || 0)}
      </div>

      <div className="card-breakdown">
        <div className="breakdown-row">
          <span className="breakdown-label">Collected:</span>
          <span className="breakdown-value">
            {formatCurrency(revenue?.paidAmount || 0)}
          </span>
        </div>
        <div className="breakdown-row">
          <span className="breakdown-label">Outstanding:</span>
          <span className="breakdown-value">
            {formatCurrency(revenue?.unpaidAmount || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
