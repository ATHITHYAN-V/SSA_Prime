/**
 * Centralized Station & Device API functions.
 * All backend calls for stations, bowsers, tanks, stationaries, and transactions.
 */
import api from '../services/api';

/* ── Helpers ── */
const extract = (res) => {
    const d = res.data?.data ?? res.data;
    return Array.isArray(d) ? d : (d && typeof d === 'object' && !Array.isArray(d)) ? d : [];
};

/* ── Stations ── */
export const fetchStations = () => api.get('/stations/list/').then(extract);

export const fetchStationById = (id) =>
    api.get(`/stations/${id}/`).then(res => res.data?.data || res.data);

export const updateStation = (id, data) => api.put(`/stations/${id}/update/`, data);
export const deleteStation = (id) => api.delete(`/stations/${id}/delete/`);

/* ── Bowsers ── */
export const fetchAllBowsers = () => api.get('/bowsers/list/').then(extract);
export const fetchBowsers = (stationId) =>
    api.get(`/stations/${stationId}/bowsers/`).then(extract);
export const addBowser = (stationId, data) =>
    api.post(`/stations/${stationId}/bowsers/add/`, data);
export const updateBowser = (id, data) => api.put(`/bowsers/${id}/`, data);
export const deleteBowser = (id) => api.delete(`/bowsers/${id}/`);

/* ── Tanks ── */
export const fetchAllTanks = () => api.get('/tanks/all/').then(extract);
export const fetchTanks = (stationId) =>
    api.get(`/stations/${stationId}/tanks/`).then(extract);
export const addTank = (stationId, data) =>
    api.post(`/stations/${stationId}/tanks/add/`, data);
export const updateTank = (id, data) => api.put(`/tanks/${id}/`, data);
export const deleteTank = (id) => api.delete(`/tanks/${id}/`);

/* ── Stationaries ── */
export const fetchAllStationaries = () =>
    api.get('/stationaries/all/').then(extract);
export const fetchStationaries = (stationId) =>
    api.get(`/stations/${stationId}/stationaries/`).then(extract);
export const addStationary = (stationId, data) =>
    api.post(`/stations/${stationId}/stationaries/add/`, data);
export const updateStationary = (id, data) => api.put(`/stationaries/${id}/`, data);
export const deleteStationary = (id) => api.delete(`/stationaries/${id}/`);

/* ── Transactions ── */
export const fetchTransactions = (stationId) =>
    api.get(`/stations/${stationId}/transactions/`).then(extract);
export const fetchAllTransactions = () =>
    api.get('/iot/transactions/').then(extract);

/* ── Assignments ── */
export const fetchAllAssignments = () =>
    api.get('/assignments/all/').then(extract);
export const assignStation = (userId, stationId) =>
    api.post('/assignments/assign/', { user_id: userId, station_id: stationId });

/* ── Asset Barcodes ── */
export const fetchAssetBarcodes = () => api.get('/asset/list/').then(extract);

/* ── People ── */
export const fetchAdmins = () =>
    api.post('/auth/manage/', { action: 'get_admins' }).then(extract);
export const fetchUsers = () =>
    api.post('/auth/manage/', { action: 'get_users' }).then(extract);
