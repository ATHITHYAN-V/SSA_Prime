import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { showToast, showSuccess, showConfirm } from '../utils/helpers';
import { useStations } from '../hooks/useStations';
import { assignStation, updateStation } from '../api/stationApi';
import api from '../services/api';

const StationsList = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { stations, assignments, users, isLoading, isError, refetch } = useStations();
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Assignment modal state
    const [showAllocModal, setShowAllocModal] = useState(false);
    const [allocStationId, setAllocStationId] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [assigning, setAssigning] = useState(false);

    // Edit station modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ station_id: '', station_name: '', location: '', description: '', category: '', status: '' });
    const [editSaving, setEditSaving] = useState(false);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return stations.filter(s =>
            (s.station_name || '').toLowerCase().includes(q) ||
            (s.station_id || '').toLowerCase().includes(q) ||
            (s.location || '').toLowerCase().includes(q)
        );
    }, [search, stations]);

    // Build maps: station_id → assigned user name, and station_id → assignment id
    const { assignmentMap, assignmentIdMap } = useMemo(() => {
        const userNameMap = {};
        users.forEach(u => { userNameMap[u.id] = u.name || u.email || `User #${u.id}`; });

        const nameMap = {};
        const idMap = {};
        assignments.forEach(a => {
            const sid = a.station_id || a.station?.station_id;
            if (sid) {
                nameMap[sid] = a.user_name || userNameMap[a.user_id] || a.admin_name || 'Assigned';
                idMap[sid] = a.id || a.assignment_id;
            }
        });
        return { assignmentMap: nameMap, assignmentIdMap: idMap };
    }, [assignments, users]);

    const openAllocModal = (stationId) => {
        setAllocStationId(stationId);
        setSelectedUserId('');
        setShowAllocModal(true);
        // users already cached from useStations hook — no extra API call
    };

    const handleAssign = async () => {
        if (!selectedUserId) { showToast('Please select a user', 'warning'); return; }
        setAssigning(true);
        try {
            if (selectedUserId === '__unassign__') {
                const assignId = assignmentIdMap[allocStationId];
                if (!assignId) { showToast('No assignment found for this station', 'warning'); setAssigning(false); return; }
                await api.delete(`/assignments/${assignId}/unassign/`);
                showSuccess('Station Unassigned', 'User has been removed from this station.');
            } else {
                await assignStation(parseInt(selectedUserId), allocStationId);
                showSuccess('Station Assigned', 'User has been assigned to this station.');
            }
            setShowAllocModal(false);
            refetch();
        } catch (err) {
            showToast(err.response?.data?.status || 'Failed to update assignment', 'error');
        } finally { setAssigning(false); }
    };

    // Edit station handlers
    const openEditStation = (station) => {
        setEditForm({
            station_id: station.station_id,
            station_name: station.station_name || '',
            location: station.location || '',
            description: station.description || '',
            category: station.category || '',
            status: (station.status || 'active').toLowerCase()
        });
        setShowEditModal(true);
    };

    const saveEditStation = async () => {
        if (!editForm.station_name.trim()) { showToast('Station name is required', 'warning'); return; }
        setEditSaving(true);
        try {
            await api.put(`/stations/${editForm.station_id}/update/`, {
                station_name: editForm.station_name,
                location: editForm.location,
                description: editForm.description,
                category: editForm.category,
                status: editForm.status
            });
            showSuccess('Station Updated', 'Station details have been updated.');
            setShowEditModal(false);
            // Invalidate both the list and the specific detail query
            queryClient.invalidateQueries({ queryKey: ['station', editForm.station_id] });
            refetch();
        } catch (err) {
            showToast(err.response?.data?.status || 'Failed to update station', 'error');
        } finally { setEditSaving(false); }
    };

    const handleDeleteStation = async (station) => {
        const confirmed = await showConfirm('Delete Station?', `Are you sure you want to delete ${station.station_name} (${station.station_id})? This will also remove associated devices.`);
        if (!confirmed) return;

        try {
            await api.delete(`/stations/${station.station_id}/delete/`);
            showSuccess('Station Deleted', 'Station has been successfully deleted.');
            refetch();
        } catch (err) {
            showToast(err.response?.data?.status || 'Failed to delete station', 'error');
        }
    };

    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const paginated = useMemo(() => {
        return filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    }, [filtered, currentPage, rowsPerPage]);

    const canCreate = user?.role === 'Super Admin' || user?.role === 'Admin';

    if (isError) return <MainLayout><div className="ssa-loading" style={{ color: '#dc3545' }}><i className="bi bi-exclamation-triangle me-2"></i> Failed to load stations. <button className="btn-ssa-outline" onClick={refetch}>Retry</button></div></MainLayout>;

    return (
        <MainLayout>
            <div className="page-header">
                <h2><i className="bi bi-building me-2"></i>Stations</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-ssa-outline" onClick={refetch}><i className="bi bi-arrow-clockwise"></i></button>
                    {canCreate && (
                        <Link to="/stations/create" className="btn-ssa-success" style={{ textDecoration: 'none' }}>
                            <i className="bi bi-plus-lg"></i> Create Station
                        </Link>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div className="ssa-search-bar">
                    <i className="bi bi-search"></i>
                    <input placeholder="Search stations..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>{filtered.length} station(s) found</span>
            </div>

            <div className="ssa-table-container">
                {isLoading ? (
                    <div className="ssa-loading"><div className="spinner-lg"></div> Loading...</div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table className="ssa-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th className="text-start">Station Name</th>
                                        <th>Station ID</th>
                                        <th>Location</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Created On</th>
                                        {canCreate && <th>Assigned To</th>}
                                        <th style={{ textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.length === 0 ? (
                                        <tr><td colSpan={canCreate ? 9 : 8} style={{ textAlign: 'center', padding: 30 }}>No stations found</td></tr>
                                    ) : paginated.map((station, idx) => (
                                        <tr key={station.station_id || idx}>
                                            <td>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                                            <td className="text-start" style={{ fontWeight: 600, color: '#0056b3' }}>{station.station_name}</td>
                                            <td><code style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>{station.station_id}</code></td>
                                            <td>{station.location}</td>
                                            <td>{station.category || 'N/A'}</td>
                                            <td>
                                                <span className={`status-badge ${station.status?.toLowerCase() === 'active' ? 'bg-success' : 'bg-danger'}`}>
                                                    {station.status || 'Active'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                                    {station.created_on ? new Date(station.created_on).toLocaleDateString() : 'N/A'}<br />
                                                    <small>{station.created_on ? new Date(station.created_on).toLocaleTimeString() : ''}</small>
                                                </div>
                                            </td>
                                            {canCreate && (
                                                <td>
                                                    {assignmentMap[station.station_id] ? (
                                                        <span style={{ fontWeight: 600, color: '#198754' }}>
                                                            <i className="bi bi-person-check me-1"></i>
                                                            {assignmentMap[station.station_id]}
                                                        </span>
                                                    ) : (
                                                        <span style={{ opacity: 0.5 }}>—</span>
                                                    )}
                                                </td>
                                            )}
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                                                    <Link to={`/stations/${station.station_id}`} className="btn-ssa-outline btn-ssa-sm" title="View Details">
                                                        <i className="bi bi-eye"></i>
                                                    </Link>
                                                    {(canCreate || user?.role === 'User') && (
                                                        <button
                                                            className="btn-ssa-outline btn-ssa-sm"
                                                            title="Edit Station"
                                                            onClick={() => openEditStation(station)}
                                                        >
                                                            <i className="bi bi-pencil"></i>
                                                        </button>
                                                    )}
                                                    {canCreate && (
                                                        <button
                                                            className="btn-ssa-outline btn-ssa-sm"
                                                            title="Assign User"
                                                            onClick={() => openAllocModal(station.station_id)}
                                                        >
                                                            <i className="bi bi-person-plus-fill"></i>
                                                        </button>
                                                    )}
                                                    {canCreate && (
                                                        <button
                                                            className="btn-ssa-danger btn-ssa-sm"
                                                            title="Delete Station"
                                                            onClick={() => handleDeleteStation(station)}
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filtered.length > 0 && (
                            <div className="ssa-pagination">
                                <div className="rows-per-page">
                                    <span>Rows:</span>
                                    <select value={rowsPerPage} onChange={e => { setRowsPerPage(+e.target.value); setCurrentPage(1); }}>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                <div className="page-info">
                                    Page {currentPage} of {totalPages} ({filtered.length} results)
                                </div>
                                <div className="page-controls">
                                    <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                                        <i className="bi bi-chevron-left"></i>
                                    </button>
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let page = i + 1;
                                        if (totalPages > 5 && currentPage > 3) page = currentPage - 2 + i;
                                        if (page > totalPages) return null;
                                        return (
                                            <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(page)}>{page}</button>
                                        );
                                    })}
                                    <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                                        <i className="bi bi-chevron-right"></i>
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Edit Station Modal */}
            {showEditModal && (
                <div className="ssa-modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="ssa-modal" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className="bi bi-pencil-square me-2"></i>Edit Station</h5>
                            <button className="close-btn" onClick={() => setShowEditModal(false)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label" style={{ fontWeight: 700 }}>Station ID</label>
                                <input className="ssa-form-control" value={editForm.station_id} readOnly style={{ background: '#eee', cursor: 'not-allowed' }} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label" style={{ fontWeight: 700 }}>Station Name *</label>
                                <input className="ssa-form-control" value={editForm.station_name} onChange={e => setEditForm({ ...editForm, station_name: e.target.value })} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label" style={{ fontWeight: 700 }}>Location</label>
                                <input className="ssa-form-control" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
                            </div>
                             <div className="ssa-form-group">
                                <label className="ssa-form-label" style={{ fontWeight: 700 }}>Description</label>
                                <textarea className="ssa-form-control" rows="3" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}></textarea>
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label" style={{ fontWeight: 700 }}>Category</label>
                                <input className="ssa-form-control" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label" style={{ fontWeight: 700 }}>Status</label>
                                <select className="ssa-form-control" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                            <button className="btn-ssa-primary" onClick={saveEditStation} disabled={editSaving}>
                                {editSaving ? 'Saving...' : <><i className="bi bi-check-lg me-1"></i>Save Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Allocation Modal */}
            {showAllocModal && (
                <div className="ssa-modal-overlay" onClick={() => setShowAllocModal(false)}>
                    <div className="ssa-modal" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className="bi bi-person-fill-gear me-2"></i>Assign User</h5>
                            <button className="close-btn" onClick={() => setShowAllocModal(false)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label" style={{ fontWeight: 700 }}>Station ID</label>
                                <input className="ssa-form-control" value={allocStationId} readOnly style={{ background: '#eee', cursor: 'not-allowed' }} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label" style={{ fontWeight: 700 }}>Select User</label>
                                <select className="ssa-form-control" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                                    <option value="">-- Select a User --</option>
                                    {assignmentMap[allocStationId] && (
                                        <option value="__unassign__" style={{ color: '#dc3545' }}>✕ Unassign Current User ({assignmentMap[allocStationId]})</option>
                                    )}
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setShowAllocModal(false)}>Cancel</button>
                            <button className="btn-ssa-primary" onClick={handleAssign} disabled={assigning}>
                                {assigning ? 'Assigning...' : <><i className="bi bi-check-lg me-1"></i>Confirm Allocation</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default StationsList;
