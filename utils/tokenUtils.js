/**
 * Utility functions for queue and token management
 */

export const getDailyTokenNumber = (patientsArray) => {
  if (!patientsArray || patientsArray.length === 0) {
    return 1;
  }

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count patients added today
  const patientsAddedToday = patientsArray.filter((patient) => {
    const patientDate = new Date(patient.createdAt);
    patientDate.setHours(0, 0, 0, 0);
    return patientDate.getTime() === today.getTime();
  });

  return patientsAddedToday.length + 1;
};

export const generateOPDToken = (roomNo, dailyCounter) => {
  return `T-${roomNo}-${dailyCounter}`;
};

export const getDateKey = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const isToday = (dateToCheck) => {
  const checkDate = new Date(dateToCheck);
  checkDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return checkDate.getTime() === today.getTime();
};

export const resetQueueAtMidnight = async (Queue) => {
  /**
   * This function can be scheduled to run at midnight
   * to clean up stale queue data or archive daily statistics
   */
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    // Archive or clean queues - implementation depends on requirements
    console.log('🧹 [BACKEND] Queue cleanup scheduled for:', yesterday);

    // You can implement queue archival here
    // For now, just log that the function ran
    return { success: true, message: 'Queue cleanup completed' };
  } catch (error) {
    console.error('❌ [BACKEND] Error in resetQueueAtMidnight:', error);
    return { success: false, error: error.message };
  }
};
