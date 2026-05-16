import axios from 'axios';

export const API_URL = 'http://184.168.125.239:4002/api/';

export const register = data => axios.post(`${API_URL}/register`, data);
export const updateStatus = data => axios.post(`${API_URL}/update-status`, data);
export const confirmOrder = data => axios.post(`${API_URL}/confirm-order`, data);
export const updateSimInfo = data => axios.post(`${API_URL}/user/update-sim`, data);

// ✅ NEW: Get user data from backend
export const getUserData = (deviceId) => axios.get(`${API_URL}/users/${deviceId}`);
