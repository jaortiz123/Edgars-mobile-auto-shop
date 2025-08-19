/**
 * Sprint 4A-T-002: Daily Achievement Summary Service
 *
 * Service for fetching daily summary data including completed jobs count,
 * total revenue, and top performer metrics
 */

/**
 * Daily summary data structure
 * @typedef {Object} DailySummary
 * @property {number} jobsCompleted - Number of jobs completed today
 * @property {number} revenue - Total revenue for the day
 * @property {Object} topTech - Top performer details
 * @property {string} topTech.name - Top technician name
 * @property {number} topTech.jobsCompleted - Jobs completed by top tech
 * @property {string} date - Date in ISO format
 */

/**
 * Fetch daily summary for a specific date
 * @param {string|Date} date - Date to fetch summary for (defaults to today)
 * @returns {Promise<DailySummary>} Daily summary data
 */
export async function getDailySummary(date = new Date()) {
  try {
    // Convert date to ISO string for API
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;

    // Get dashboard stats which contain some of the data we need
    const statsResponse = await fetch('/api/admin/dashboard/stats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });

    if (!statsResponse.ok) {
      throw new Error(`Stats API failed: ${statsResponse.status}`);
    }

    const stats = await statsResponse.json();

    // Get appointments data for more detailed analysis
    const appointmentsResponse = await fetch(`/api/admin/appointments?from=${dateStr}T00:00:00Z&to=${dateStr}T23:59:59Z&status=COMPLETED`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });

    let completedAppointments = [];
    if (appointmentsResponse.ok) {
      const appointmentsData = await appointmentsResponse.json();
      completedAppointments = appointmentsData.appointments || [];
    }

    // Calculate jobs completed today
    const jobsCompleted = stats.totals?.today_completed || 0;

    // Calculate total revenue for completed jobs today
    const revenue = completedAppointments.reduce((total, appointment) => {
      return total + (appointment.total_amount || 0);
    }, 0);

    // Calculate top performer (mock data for now since we don't have tech assignment in current schema)
    const topTech = calculateTopPerformer(completedAppointments);

    return {
      jobsCompleted,
      revenue: Math.round(revenue * 100) / 100, // Round to 2 decimal places
      topTech,
      date: dateStr
    };

  } catch (error) {
    console.error('Failed to fetch daily summary:', error);

    // Return fallback data
    return {
      jobsCompleted: 0,
      revenue: 0,
      topTech: {
        name: 'No data',
        jobsCompleted: 0
      },
      date: date instanceof Date ? date.toISOString().split('T')[0] : date
    };
  }
}

/**
 * Calculate top performer from appointments data
 * @param {Array} appointments - Completed appointments
 * @returns {Object} Top performer object
 */
function calculateTopPerformer(appointments) {
  if (!appointments || appointments.length === 0) {
    return {
      name: 'No data',
      jobsCompleted: 0
    };
  }

  // Group by tech_id (when available)
  const techStats = {};

  appointments.forEach(appointment => {
    const techId = appointment.tech_id || 'unassigned';
    if (!techStats[techId]) {
      techStats[techId] = {
        name: `Tech ${techId}`,
        jobsCompleted: 0,
        totalRevenue: 0
      };
    }
    techStats[techId].jobsCompleted++;
    techStats[techId].totalRevenue += appointment.total_amount || 0;
  });

  // Find tech with most completed jobs
  let topTech = { name: 'No data', jobsCompleted: 0 };
  let maxJobs = 0;

  Object.values(techStats).forEach(tech => {
    if (tech.jobsCompleted > maxJobs) {
      maxJobs = tech.jobsCompleted;
      topTech = {
        name: tech.name,
        jobsCompleted: tech.jobsCompleted
      };
    }
  });

  return topTech;
}

/**
 * Check if daily summary should be shown based on time and user preferences
 * @returns {boolean} Whether to show the summary
 */
export function shouldShowDailySummary() {
  const now = new Date();
  const hour = now.getHours();

  // Show automatically at 6 PM (18:00) local time
  const isAutoShowTime = hour >= 18;

  // Check if user has already seen today's summary
  const today = now.toISOString().split('T')[0];
  const seenKey = `dailySummary_seen_${today}`;
  const alreadySeen = localStorage.getItem(seenKey) === 'true';

  return isAutoShowTime && !alreadySeen;
}

/**
 * Mark today's summary as seen
 */
export function markSummaryAsSeen() {
  const today = new Date().toISOString().split('T')[0];
  const seenKey = `dailySummary_seen_${today}`;
  localStorage.setItem(seenKey, 'true');
}

/**
 * Clear summary seen status (for testing purposes)
 */
export function clearSummarySeenStatus() {
  const today = new Date().toISOString().split('T')[0];
  const seenKey = `dailySummary_seen_${today}`;
  localStorage.removeItem(seenKey);
}

/**
 * Schedule automatic summary display at 6 PM
 * @param {Function} callback - Function to call when it's time to show summary
 * @returns {number} Timeout ID for clearing the timeout if needed
 */
export function scheduleAutomaticSummary(callback) {
  const now = new Date();
  const sixPM = new Date();
  sixPM.setHours(18, 0, 0, 0);

  // If it's already past 6 PM today, schedule for tomorrow
  if (now >= sixPM) {
    sixPM.setDate(sixPM.getDate() + 1);
  }

  const timeUntilSixPM = sixPM.getTime() - now.getTime();

  return setTimeout(() => {
    if (shouldShowDailySummary()) {
      callback();
    }
  }, timeUntilSixPM);
}

/**
 * Get historical summaries for analytics
 * @param {number} days - Number of days back to fetch
 * @returns {Promise<Array<DailySummary>>} Array of daily summaries
 */
export async function getHistoricalSummaries(days = 7) {
  const summaries = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    try {
      const summary = await getDailySummary(date);
      summaries.push(summary);
    } catch (error) {
      console.warn(`Failed to fetch summary for ${date.toISOString().split('T')[0]}:`, error);
    }
  }

  return summaries;
}
