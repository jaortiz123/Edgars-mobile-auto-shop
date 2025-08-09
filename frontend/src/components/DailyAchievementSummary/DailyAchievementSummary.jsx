/**
 * Sprint 4A-T-002: Daily Achievement Summary Component
 * 
 * Displays end-of-day recap with completed jobs count, total revenue, and top performer
 * Shows as modal or dashboard section with automatic 6 PM trigger
 */

import React, { useState, useEffect } from 'react';
import { getDailySummary, markSummaryAsSeen } from '../../services/summaryService';
import './DailyAchievementSummary.css';

/**
 * Daily Achievement Summary Modal Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Function to close modal
 * @param {number} props.jobsCompleted - Number of jobs completed
 * @param {number} props.revenue - Total revenue for the day
 * @param {Object} props.topTech - Top performer data
 * @param {string} props.date - Date for the summary
 */
export function DailyAchievementSummary({ 
  isOpen, 
  onClose, 
  jobsCompleted, 
  revenue, 
  topTech,
  date 
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    markSummaryAsSeen();
    setTimeout(() => {
      onClose();
    }, 300); // Wait for animation to complete
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div 
      className={`summary-modal-overlay ${isVisible ? 'visible' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-title"
    >
      <div className={`summary-modal ${isVisible ? 'visible' : ''}`}>
        <header className="summary-header">
          <h1 id="summary-title" className="summary-title">
            🎉 Today's Achievements
          </h1>
          <p className="summary-date">{formatDate(date)}</p>
          <button 
            className="summary-close-btn"
            onClick={handleClose}
            aria-label="Close summary"
          >
            ✕
          </button>
        </header>

        <main className="summary-content">
          <div className="summary-cards">
            {/* Jobs Completed Card */}
            <div className="summary-card jobs-card">
              <div className="card-icon">✅</div>
              <div className="card-content">
                <h2 className="card-title">Jobs Completed</h2>
                <div className="card-value">{jobsCompleted}</div>
                <div className="card-subtitle">
                  {jobsCompleted === 1 ? 'job finished' : 'jobs finished'}
                </div>
              </div>
            </div>

            {/* Revenue Card */}
            <div className="summary-card revenue-card">
              <div className="card-icon">💰</div>
              <div className="card-content">
                <h2 className="card-title">Total Revenue</h2>
                <div className="card-value">{formatCurrency(revenue)}</div>
                <div className="card-subtitle">earned today</div>
              </div>
            </div>

            {/* Top Performer Card */}
            <div className="summary-card performer-card">
              <div className="card-icon">🏆</div>
              <div className="card-content">
                <h2 className="card-title">Top Performer</h2>
                <div className="card-value">{topTech.name}</div>
                <div className="card-subtitle">
                  {topTech.jobsCompleted} {topTech.jobsCompleted === 1 ? 'job' : 'jobs'} completed
                </div>
              </div>
            </div>
          </div>

          {/* Summary Message */}
          <div className="summary-message">
            {jobsCompleted > 0 ? (
              <p>
                Great work today! {jobsCompleted > 5 ? 'Outstanding' : 'Excellent'} productivity 
                with {formatCurrency(revenue)} in revenue generated.
              </p>
            ) : (
              <p>
                Ready for tomorrow's opportunities! Every day is a fresh start.
              </p>
            )}
          </div>
        </main>

        <footer className="summary-footer">
          <button 
            className="summary-action-btn primary"
            onClick={handleClose}
          >
            Great! See you tomorrow
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Daily Achievement Summary Dashboard Section Component
 * Compact version for dashboard display
 */
export function DailyAchievementSummaryCard({ 
  jobsCompleted, 
  revenue, 
  topTech, 
  date,
  onViewDetails 
}) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="summary-dashboard-card">
      <header className="dashboard-card-header">
        <h3 className="dashboard-card-title">Today's Progress</h3>
        <button 
          className="view-recap-btn"
          onClick={onViewDetails}
          aria-label="View today's recap"
        >
          View Recap
        </button>
      </header>

      <div className="dashboard-card-content">
        <div className="dashboard-summary-stats">
          <div className="dashboard-stat">
            <span className="stat-icon">✅</span>
            <span className="stat-value">{jobsCompleted}</span>
            <span className="stat-label">jobs</span>
          </div>
          
          <div className="dashboard-stat">
            <span className="stat-icon">💰</span>
            <span className="stat-value">{formatCurrency(revenue)}</span>
            <span className="stat-label">revenue</span>
          </div>
          
          <div className="dashboard-stat">
            <span className="stat-icon">🏆</span>
            <span className="stat-value">{topTech.name}</span>
            <span className="stat-label">top performer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing daily achievement summary state
 */
export function useDailyAchievementSummary(autoShow = true) {
  const [isOpen, setIsOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load today's summary data
  const loadSummary = async (date = new Date()) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getDailySummary(date);
      setSummaryData(data);
      return data;
    } catch (err) {
      console.error('Failed to load daily summary:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Show summary modal
  const showSummary = async (date) => {
    const data = await loadSummary(date);
    if (data) {
      setIsOpen(true);
    }
  };

  // Close summary modal
  const closeSummary = () => {
    setIsOpen(false);
  };

  // Auto-load summary on mount
  useEffect(() => {
    if (autoShow) {
      loadSummary();
    }
  }, [autoShow]);

  return {
    isOpen,
    summaryData,
    loading,
    error,
    showSummary,
    closeSummary,
    loadSummary
  };
}

// Default export (named functions already exported above)
export default DailyAchievementSummary;
