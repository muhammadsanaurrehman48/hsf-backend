import { verifyToken, checkRole } from '../middleware/auth.js';

export const getUserData = (userId, users) => {
  return users.find(u => u.id === userId);
};

export const getPatientData = (patientId, patients) => {
  return patients.find(p => p.id === patientId);
};

export const formatResponse = (success, message, data = null) => {
  const response = { success, message };
  if (data) response.data = data;
  return response;
};
