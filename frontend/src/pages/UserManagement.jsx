import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { showToast, showConfirm, showSuccess } from '../utils/helpers';

const UserManagement = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', portal_id: '', admin_portal_id: '' });
    const [saving, setSaving] = useState(false);
    const [viewStationsModal, setViewStationsModal] = useState(null);
    const [assignedStations, setAssignedStations] = useState([]);
    const [loadingStations, setLoadingStations] = useState(false);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return users.filter(u =>
            (u.name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.portal_id || '').toLowerCase().includes(q)
        );
    }, [search, users]);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.post('/auth/manage/', { action: 'get_users' });
            const data = res.data.data || res.data || [];
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch users', err);
        } finally { setLoading(false); }
    };

    const isSuperAdmin = currentUser?.role?.toLowerCase().replace(/\s+/g, '') === 'superadmin';

    const openCreate = () => {
        setEditingUser(null);
        setForm({
            name: '', email: '', password: '', portal_id: '',
            admin_portal_id: isSuperAdmin ? '' : (currentUser?.portalId || '')
        });
        setShowModal(true);
    };

    const openEdit = (u) => {
        setEditingUser(u);
        setForm({
            name: u.name, email: u.email, password: '', portal_id: u.portal_id || '',
            admin_portal_id: u.admin_portal_id || (isSuperAdmin ? '' : (currentUser?.portalId || ''))
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        const userEmail = form.email.trim();
        const userPortalId = form.portal_id.trim().toUpperCase();
        const adminPortalId = form.admin_portal_id.trim();

        if (!form.name || !form.email) {
            showToast('Name and email are required', 'error');
            return;
        }

        // User Unique ID validation (exactly 10 characters)
        if (!editingUser && userPortalId.length !== 10) {
            showToast("User Unique ID must be exactly 10 characters.", "warning");
            return;
        }

        // Admin Portal ID required for Super Admin
        if (isSuperAdmin && !adminPortalId) {
            showToast('Admin Portal ID is required.', 'warning');
            return;
        }

        setSaving(true);
        try {
            if (editingUser) {
                // Wrap in 'data' key for backend compatibility
                const updateData = {
                    user_id: editingUser.id,
                    ...form,
                    status: form.is_active ? 'active' : 'inactive'
                };
                if (!updateData.password) delete updateData.password;
                
                await api.post('/auth/manage/', {
                    action: 'update_user',
                    data: updateData
                });
                showSuccess('User Updated', 'User has been updated successfully.');
            } else {
                const createData = {
                    ...form,
                    role: 'User',
                    user_specific_id: userPortalId, // Backend expects 'user_specific_id' for creation
                    status: 'active'
                };
                if (adminPortalId) {
                    createData.admin_portal_id = adminPortalId;
                }
                
                await api.post('/auth/manage/', {
                    action: 'create_user',
                    data: createData
                });
                showSuccess('User Created', 'New user has been created successfully.');
            }
            setShowModal(false);
            fetchUsers();
        } catch (err) {
            showToast(err.response?.data?.status || 'Failed to save user', 'error');
        } finally { setSaving(false); }
    };

    const openViewStations = async (user) => {
        setViewStationsModal(user);
        setLoadingStations(true);
        try {
            const res = await api.get(`/assignments/user/${user.id}/`);
            const data = res.data.data || res.data || [];
            const arr = Array.isArray(data) ? data : [];
            // Deduplicate by station_id
            const seen = new Set();
            const unique = arr.filter(record => {
                const sid = record.station_id || record.station?.station_id;
                if (!sid || seen.has(sid)) return false;
                seen.add(sid);
                return true;
            });
            setAssignedStations(unique);
        } catch (err) {
            setAssignedStations([]);
        } finally { setLoadingStations(false); }
    };

    const toggleStatus = async (u) => {
        const newStatus = u.status?.toLowerCase() === 'active' ? 'inactive' : 'active';
        // Optimistic update
        setUsers(prev => prev.map(user => user.id === u.id ? { ...user, status: newStatus } : user));
        
        try {
            await api.post('/auth/manage/', {
                action: 'update_user',
                data: {
                    user_id: u.id,
                    status: newStatus
                }
            });
            showToast(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
        } catch (err) {
            // Revert on failure
            setUsers(prev => prev.map(user => user.id === u.id ? { ...user, status: u.status } : user));
            showToast(err.response?.data?.status || 'Failed to update status', 'error');
        }
    };

    const handleUnassign = async (assignmentId, stationName) => {
        const confirmed = await showConfirm('Unassign Station?', `Are you sure you want to remove access to ${stationName}?`);
        if (!confirmed) return;
        
        try {
            await api.delete(`/assignments/${assignmentId}/unassign/`);
            showToast('Station unassigned', 'success');
            // Remove from local list
            setAssignedStations(prev => prev.filter(a => a.id !== assignmentId));
        } catch (err) {
            showToast('Failed to unassign station', 'error');
        }
    };

    const handleDelete = async (u) => {
        const confirmed = await showConfirm('Delete User?', `Are you sure you want to delete ${u.name}?`);
        if (!confirmed) return;
        try {
            await api.post('/auth/manage/', { 
                action: 'delete_user', 
                data: { user_id: u.id } 
            });
            showToast('User deleted', 'success');
            fetchUsers();
        } catch (err) { showToast('Failed to delete user', 'error'); }
    };

    return (
        <MainLayout>
            <div className="page-header">
                <h2><i className="bi bi-people me-2"></i>Manage Users</h2>
                <button className="btn-ssa-success" onClick={openCreate}>
                    <i className="bi bi-plus-lg me-1"></i>Add User
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div className="ssa-search-bar">
                    <i className="bi bi-search"></i>
                    <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>{filtered.length} user(s)</span>
            </div>

            <div className="ssa-table-container">
                {loading ? (
                    <div className="ssa-loading"><div className="spinner-lg"></div> Loading users...</div>
                ) : (
                    <div className="table-responsive">
                        <table className="ssa-table">
                            <thead>
                                <tr><th>#</th><th>Name</th><th>Email</th><th>Portal ID</th><th>Status</th><th>Created On</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30 }}>No users found</td></tr>
                                ) : filtered.map((u, i) => (
                                    <tr key={u.id || u.portal_id || i}>
                                        <td>{i + 1}</td>
                                        <td style={{ fontWeight: 600 }}>
                                            <a href="#" className="text-decoration-none text-primary" onClick={(e) => { e.preventDefault(); openViewStations(u); }}>
                                                {u.name}
                                            </a>
                                        </td>
                                        <td>{u.email}</td>
                                        <td><code style={{ color: '#d63384', fontWeight: 'bold' }}>{u.portal_id || 'N/A'}</code></td>
                                        <td>
                                            <span className={`status-badge ${u.status?.toLowerCase() === 'active' ? 'bg-success' : 'bg-danger'}`}>
                                                {u.status || (u.is_active !== false ? 'Active' : 'Inactive')}
                                            </span>
                                        </td>
                                        <td className="small">{u.created_on ? new Date(u.created_on).toLocaleString() : '—'}</td>
                                        <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <button 
                                                className={`btn-ssa-sm ${u.status?.toLowerCase() === 'active' ? 'btn-ssa-success' : 'btn-ssa-secondary'}`} 
                                                onClick={() => toggleStatus(u)}
                                                style={{ minWidth: 80, marginRight: 8 }}
                                            >
                                                {u.status?.toLowerCase() === 'active' ? 'Active' : 'Inactive'}
                                            </button>
                                            <button className="btn-ssa-outline btn-ssa-sm" onClick={() => openEdit(u)} title="Edit">
                                                <i className="bi bi-pencil"></i>
                                            </button>
                                            <button className="btn-ssa-danger btn-ssa-sm" onClick={() => handleDelete(u)} title="Delete">
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit User Modal */}
            {showModal && (
                <div className="ssa-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="ssa-modal" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className={`bi ${editingUser ? 'bi-pencil-square' : 'bi-person-plus'} me-2`}></i>{editingUser ? 'Edit User' : 'Add New User'}</h5>
                            <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Full Name *</label>
                                <input className="ssa-form-control" autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Email *</label>
                                <input className="ssa-form-control" type="email" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                                <input className="ssa-form-control" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">User Portal ID {!editingUser && '*'}</label>
                                <input className="ssa-form-control" value={form.portal_id} onChange={e => setForm({ ...form, portal_id: e.target.value })} readOnly={!!editingUser} style={editingUser ? { backgroundColor: '#2a2f35', opacity: 0.7 } : {}} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Assign User to Portal ID {isSuperAdmin && '*'}</label>
                                <input className="ssa-form-control" value={form.admin_portal_id} onChange={e => setForm({ ...form, admin_portal_id: e.target.value })} readOnly={!isSuperAdmin} style={!isSuperAdmin ? { backgroundColor: '#f9fbfdff', opacity: 0.7 } : {}} placeholder={isSuperAdmin ? 'Enter Admin Portal ID' : ''} />
                            </div>
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn-ssa-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : <><i className="bi bi-check-lg me-1"></i>{editingUser ? 'Update' : 'Create'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Assigned Stations Modal */}
            {viewStationsModal && (
                <div className="ssa-modal-overlay" onClick={() => setViewStationsModal(null)}>
                    <div className="ssa-modal ssa-modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className="bi bi-geo-alt me-2"></i>Stations Assigned to {viewStationsModal.name}</h5>
                            <button className="close-btn" onClick={() => setViewStationsModal(null)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            {loadingStations ? (
                                <div className="ssa-loading"><div className="spinner-lg"></div> Loading stations...</div>
                            ) : assignedStations.length === 0 ? (
                                <p style={{ textAlign: 'center', opacity: 0.6 }}>No stations assigned to this user</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="ssa-table">
                                        <thead>
                                            <tr><th>Station ID</th><th>Name</th><th>Location</th><th>Status</th><th>Action</th></tr>
                                        </thead>
                                        <tbody>
                                            {assignedStations.map((record, i) => {
                                                const s = record.station || record;
                                                return (
                                                    <tr key={s.id || s.station_id || i}>
                                                        <td><code>{s.station_id || 'N/A'}</code></td>
                                                        <td style={{ fontWeight: 600 }}>
                                                            <a 
                                                                href="#" 
                                                                className="text-decoration-none text-primary" 
                                                                onClick={(e) => { 
                                                                    e.preventDefault(); 
                                                                    navigate(`/stations/${s.station_id}`); 
                                                                }}
                                                            >
                                                                {s.station_name || s.name}
                                                            </a>
                                                        </td>
                                                        <td>{s.location || 'N/A'}</td>
                                                        <td>
                                                            <span className={`status-badge ${s.status?.toLowerCase() === 'active' ? 'bg-success' : 'bg-danger'}`}>
                                                                {(s.status || (s.is_active ? 'Active' : 'Inactive')).toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button 
                                                                className="btn-ssa-danger btn-ssa-sm" 
                                                                onClick={() => handleUnassign(record.id, s.station_name || s.name)}
                                                                title="Unassign Station"
                                                            >
                                                                <i className="bi bi-x-lg"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setViewStationsModal(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default UserManagement;
