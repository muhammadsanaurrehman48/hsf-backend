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
   * Clears all patients from every queue (new day = fresh start).
   * Called from server.js midnight scheduler.
   */
  try {
    const queues = await Queue.find({});
    let totalCleared = 0;

    for (const queue of queues) {
      if (queue.patients.length > 0) {
        totalCleared += queue.patients.length;
        queue.patients = [];
        queue.currentToken = null;
        queue.currentPatientIndex = 0;
        await queue.save();
      }
    }

    console.log(`🧹 resetQueueAtMidnight: cleared ${totalCleared} patients from ${queues.length} queues`);
    return { success: true, message: `Cleared ${totalCleared} patients` };
  } catch (error) {
    console.error('❌ [BACKEND] Error in resetQueueAtMidnight:', error);
    return { success: false, error: error.message };
  }
};
