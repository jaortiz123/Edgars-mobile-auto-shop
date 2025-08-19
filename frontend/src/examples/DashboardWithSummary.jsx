/**
 * Sprint 4A-T-002: Daily Achievement Summary Integration Example
 *
 * Example showing how to integrate the Daily Achievement Summary
 * into an existing dashboard component
 */

import React, { useEffect, useState } from 'react';
import { DailyAchievementSummary, DailyAchievementSummaryCard, useDailyAchievementSummary } from '../components/DailyAchievementSummary/DailyAchievementSummary';
import { scheduleAutomaticSummary, shouldShowDailySummary } from '../services/summaryService';

export function DashboardWithSummary() {
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const { summaryData, loadSummary, loading } = useDailyAchievementSummary(false);

  // Set up automatic 6 PM summary display
  useEffect(() => {
    let timeoutId = null;

    // Schedule automatic summary for 6 PM
    timeoutId = scheduleAutomaticSummary(() => {
      if (shouldShowDailySummary()) {
        setShowSummaryModal(true);
      }
    });

    // Check if we should show summary immediately (if already past 6 PM)
    if (shouldShowDailySummary()) {
      loadSummary().then(() => {
        setShowSummaryModal(true);
      });
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loadSummary]);

  const handleViewRecap = async () => {
    await loadSummary();
    setShowSummaryModal(true);
  };

  const handleCloseSummary = () => {
    setShowSummaryModal(false);
  };

  return (
    <div className="dashboard-container">
      {/* Your existing dashboard content */}
      <div className="dashboard-header">
        <h1>Edgar's Auto Shop Dashboard</h1>
      </div>

      {/* Dashboard Stats Grid */}
      <div className="dashboard-grid">
        {/* Your existing stats components */}

        {/* Daily Achievement Summary Card */}
        {summaryData && (
          <DailyAchievementSummaryCard
            jobsCompleted={summaryData.jobsCompleted}
            revenue={summaryData.revenue}
            topTech={summaryData.topTech}
            date={summaryData.date}
            onViewDetails={handleViewRecap}
          />
        )}
      </div>

      {/* Daily Achievement Summary Modal */}
      {summaryData && (
        <DailyAchievementSummary
          isOpen={showSummaryModal}
          onClose={handleCloseSummary}
          jobsCompleted={summaryData.jobsCompleted}
          revenue={summaryData.revenue}
          topTech={summaryData.topTech}
          date={summaryData.date}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="loading-summary">
          Loading today's summary...
        </div>
      )}
    </div>
  );
}

/**
 * Alternative: Minimal Integration
 * For simpler dashboards that just want the automatic trigger
 */
export function MinimalSummaryIntegration() {
  const [isOpen, setIsOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  useEffect(() => {
    // Simple 6 PM check
    const checkAndShowSummary = async () => {
      if (shouldShowDailySummary()) {
        const { getDailySummary } = await import('../services/summaryService');
        const data = await getDailySummary();
        setSummaryData(data);
        setIsOpen(true);
      }
    };

    // Check immediately
    checkAndShowSummary();

    // Set up interval to check every minute
    const interval = setInterval(checkAndShowSummary, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!summaryData) return null;

  return (
    <DailyAchievementSummary
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      jobsCompleted={summaryData.jobsCompleted}
      revenue={summaryData.revenue}
      topTech={summaryData.topTech}
      date={summaryData.date}
    />
  );
}

export default DashboardWithSummary;
