/**
 * Sprint 4A-T-003: Running Revenue Service
 *
 * Service for fetching and subscribing to real-time revenue updates.
 * Provides WebSocket-like functionality using polling for live revenue tracking.
 */

// Type definitions
export interface RevenueData {
  totalRevenue: number;
  paidAmount: number;
  unpaidAmount: number;
  lastUpdated: string;
}

export interface AppointmentData {
  id: string;
  totalCost: number;
  paymentStatus: 'paid' | 'unpaid' | 'pending';
  status: string;
  date: string;
}

export interface DashboardStats {
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  appointments?: AppointmentData[];
}

type RevenueSubscriber = (revenue: RevenueData) => void;

const POLLING_INTERVAL = 30000; // 30 seconds
const subscribers = new Set<RevenueSubscriber>();
let currentRevenue: RevenueData | null = null;
let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isPolling = false;

/**
 * Fetch current day's revenue from API
 * @returns {Promise<RevenueData>} Current revenue data
 */
export async function fetchTodaysRevenue(): Promise<RevenueData> {
  try {
    const today = new Date().toISOString().split('T')[0];

  // Get dashboard stats for basic revenue info
  const { data: stats } = await (await import('@/lib/api')).http.get('/admin/dashboard/stats');

  // Get completed appointments for accurate revenue calculation
  const { data: appointmentsData } = await (await import('@/lib/api')).http.get(`/admin/appointments`, { params: { from: `${today}T00:00:00Z`, to: `${today}T23:59:59Z`, status: 'COMPLETED' } });

    let completedRevenue = 0;
    if (appointmentsData) {
      const completedAppointments = (appointmentsData.appointments || appointmentsData.data?.appointments) || [];

      // Calculate total revenue from completed appointments
      completedRevenue = completedAppointments.reduce((total: number, appointment: AppointmentData) => {
        return total + (appointment.totalCost || 0);
      }, 0);
    }

    // Get unpaid amount from stats
    const unpaidAmount = stats.unpaidTotal || 0;

    // Calculate total revenue (completed + unpaid)
    const totalRevenue = completedRevenue + unpaidAmount;

    const revenueData = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      paidAmount: Math.round(completedRevenue * 100) / 100,
      unpaidAmount: Math.round(unpaidAmount * 100) / 100,
      lastUpdated: new Date().toISOString()
    };

    // Update current revenue cache
    currentRevenue = revenueData;

    return revenueData;

  } catch (error) {
    console.error('Failed to fetch today\'s revenue:', error);

    // Return fallback data
    return {
      totalRevenue: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Subscribe to revenue updates with callback
 * @param {Function} callback - Function to call when revenue updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToRevenueUpdates(callback: RevenueSubscriber): () => void {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }

  // Add subscriber
  subscribers.add(callback);

  // Start polling if this is the first subscriber
  if (subscribers.size === 1 && !isPolling) {
    startPolling();
  }

  // Send current revenue if available
  if (currentRevenue) {
    try {
      callback(currentRevenue);
    } catch (error) {
      console.error('Error calling revenue subscriber:', error);
    }
  } else {
    // Fetch initial revenue
    fetchTodaysRevenue().then(revenue => {
      try {
        callback(revenue);
      } catch (error) {
        console.error('Error calling revenue subscriber with initial data:', error);
      }
    });
  }

  // Return unsubscribe function
  return () => {
    subscribers.delete(callback);

    // Stop polling if no more subscribers
    if (subscribers.size === 0) {
      stopPolling();
    }
  };
}

/**
 * Start polling for revenue updates
 */
function startPolling() {
  if (isPolling) return;

  isPolling = true;

  const poll = async () => {
    try {
      const newRevenue = await fetchTodaysRevenue();

      // Notify all subscribers if revenue changed
      if (!currentRevenue || newRevenue.totalRevenue !== currentRevenue.totalRevenue) {
        notifySubscribers(newRevenue);
      }

      // Schedule next poll
      if (isPolling) {
        pollingTimer = setTimeout(poll, POLLING_INTERVAL);
      }
    } catch (error) {
      console.error('Revenue polling error:', error);

      // Continue polling even if there's an error
      if (isPolling) {
        pollingTimer = setTimeout(poll, POLLING_INTERVAL);
      }
    }
  };

  // Start immediate poll
  poll();
}

/**
 * Stop polling for revenue updates
 */
function stopPolling() {
  isPolling = false;

  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }
}

/**
 * Notify all subscribers of revenue update
 * @param {RevenueData} revenueData - Updated revenue data
 */
function notifySubscribers(revenueData: RevenueData): void {
  subscribers.forEach(callback => {
    try {
      callback(revenueData);
    } catch (error) {
      console.error('Error notifying revenue subscriber:', error);
    }
  });
}

/**
 * Get current cached revenue data
 * @returns {RevenueData|null} Current revenue or null if not available
 */
export function getCurrentRevenue() {
  return currentRevenue;
}

/**
 * Force refresh revenue data
 * @returns {Promise<RevenueData>} Updated revenue data
 */
export async function refreshRevenue() {
  const revenue = await fetchTodaysRevenue();
  notifySubscribers(revenue);
  return revenue;
}

/**
 * Manually trigger revenue update (for testing or immediate updates)
 */
export function triggerRevenueUpdate() {
  if (isPolling) {
    fetchTodaysRevenue().then(revenue => {
      notifySubscribers(revenue);
    });
  }
}

/**
 * Check if revenue polling is active
 * @returns {boolean} True if actively polling
 */
export function isPollingActive() {
  return isPolling;
}

/**
 * Get number of active subscribers
 * @returns {number} Number of active subscribers
 */
export function getSubscriberCount() {
  return subscribers.size;
}

/**
 * Format currency amount with thousands separators
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

/**
 * Format currency with detailed breakdown
 * @param {number} amount - Amount to format
 * @param {boolean} includeDecimals - Include decimal places
 * @returns {string} Formatted currency string
 */
export function formatDetailedCurrency(amount: number, includeDecimals = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0
  }).format(amount || 0);
}
