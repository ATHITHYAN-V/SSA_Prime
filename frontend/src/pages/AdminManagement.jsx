import React, { useEffect, useState, useMemo } from 'react';
import MainLayout from '../components/MainLayout';
import api from '../services/api';
import { showToast, showConfirm, showSuccess } from '../utils/helpers';
import EditAdminModal from '../components/EditAdminModal';

const AdminManagement = () => {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', portal_id: '', status: 'active' });
    const [saving, setSaving] = useState(false);

    // View Users Modal
    const [viewUsersModal, setViewUsersModal] = useState(null);
    const [adminUsers, setAdminUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return admins.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.email || '').toLowerCase().includes(q) ||
            (a.portal_id || '').toLowerCase().includes(q)
        );
    }, [search, admins]);

    useEffect(() => { fetchAdmins(); }, []);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const res = await api.post('/auth/manage/', { action: 'get_admins' });
            const data = res.data.data || res.data || [];
            setAdmins(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch admins', err);
        } finally { setLoading(false); }
    };

    const openCreate = () => {
        setEditingAdmin(null);
        setForm({ name: '', email: '', password: '', portal_id: '', status: 'active' });
        setShowModal(true);
    };

    const openEdit = (a) => {
        setEditingAdmin(a);
        setForm({ 
            name: a.name, 
            email: a.email, 
            password: '', 
            portal_id: a.portal_id || '', 
            status: (a.status || (a.is_active ? 'active' : 'inactive')).toLowerCase() 
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        const adminEmail = form.email.trim();
        const adminPassword = form.password;
        const adminPortalId = form.portal_id.trim().toUpperCase();

        // 1. Gmail Validation
        if (!adminEmail.toLowerCase().endsWith('@gmail.com')) {
            showToast('Invalid Email! Must be a valid @gmail.com address.', 'error');
            return;
        }

        // 2. Password Validation (6-10 characters)
        if (!editingAdmin || adminPassword) {
            if (adminPassword.length < 6 || adminPassword.length > 10) {
                showToast('Password must be between 6 and 10 characters.', 'error');
                return;
            }
        }

        // 3. Admin ID Pattern (AD + 8 digits)
        const adminIdPattern = /^AD\d{8}$/;
        if (!editingAdmin && !adminIdPattern.test(adminPortalId)) {
            showToast('Invalid Admin ID! Format: AD + 8 digits.', 'error');
            return;
        }

        if (!form.name || !form.email) {
            showToast('Name and email are required', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editingAdmin) {
                const updateData = {
                    admin_id: editingAdmin.admin_id,
                    ...form,
                    status: form.status
                };
                if (!updateData.password) delete updateData.password;
                
                await api.post('/auth/manage/', {
                    action: 'update_admin',
                    data: updateData
                });
                showSuccess('Admin Updated', 'Admin has been updated.');
            } else {
                await api.post('/auth/register/', {
                    ...form,
                    role: 'admin',
                    portal_id: adminPortalId,
                    status: form.status
                });
                showSuccess('Admin Created', 'New admin has been created.');
            }
            setShowModal(false);
            fetchAdmins();
        } catch (err) {
            showToast(err.response?.data?.status || 'Failed to save admin', 'error');
        } finally { setSaving(true); } // Keep loading for a moment to match app.js behavior
        setTimeout(() => setSaving(false), 500);
    };

    const handleDelete = async (a) => {
        const confirmed = await showConfirm('Delete Admin?', `Are you sure you want to delete ${a.name}?`);
        if (!confirmed) return;
        try {
            await api.post('/auth/manage/', { 
                action: 'delete_admin', 
                data: { admin_id: a.admin_id } 
            });
            showToast('Admin deleted', 'success');
            fetchAdmins();
        } catch (err) { showToast('Failed to delete admin', 'error'); }
    };

    const viewUsers = async (admin) => {
        setViewUsersModal(admin);
        setLoadingUsers(true);
        try {
            await api.post('/auth/manage/', { 
                action: 'get_users', 
                data: { admin_id: admin.admin_id } 
            });
            // Note: Current backend get_users for superadmin returns ALL users, 
            // filtering might need backend update if specific admin users are required.
            // For now, we fetch generic list.
            const res = await api.post('/auth/manage/', { action: 'get_users' }); 
            const data = res.data.data || res.data || [];
            
            // Client-side filter if backend returns all (temporary fix if needed)
            const filteredUsers = Array.isArray(data) ? data.filter(u => u.admin_id === admin.admin_id) : [];
            setAdminUsers(filteredUsers);
        } catch (err) {
            setAdminUsers([]);
        } finally { setLoadingUsers(false); }
    };

    return (
        <MainLayout>
            <div className="page-header">
                <h2><i className="bi bi-shield-lock me-2"></i>Manage Admins</h2>
                <button className="btn-ssa-success" onClick={openCreate}>
                    <i className="bi bi-plus-lg me-1"></i>Add Admin
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div className="ssa-search-bar">
                    <i className="bi bi-search"></i>
                    <input placeholder="Search admins..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>{filtered.length} admin(s)</span>
            </div>

            <div className="ssa-table-container">
                {loading ? (
                    <div className="ssa-loading"><div className="spinner-lg"></div> Loading admins...</div>
                ) : (
                    <div className="table-responsive">
                        <table className="ssa-table">
                            <thead>

                                <tr>
                                    <th>#</th>
                                    <th className="text-start">Name</th>
                                    <th className="text-start">Email</th>
                                    <th>Portal ID</th>
                                    <th>Status</th>
                                    <th>Created On</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30 }}>No admins found</td></tr>
                                ) : filtered.map((a, i) => (
                                    <tr key={a.admin_id || a.portal_id || i}>
                                        <td>{i + 1}</td>
                                        <td className="text-start" style={{ fontWeight: 600 }}>{a.name}</td>
                                        <td className="text-start">{a.email}</td>
                                        <td><code style={{ color: '#d63384', fontWeight: 'bold' }}>{a.portal_id || 'N/A'}</code></td>
                                        <td>
                                            <span className={`status-badge ${a.status?.toLowerCase() === 'active' ? 'bg-success' : 'bg-danger'}`}>
                                                {a.status || (a.is_active !== false ? 'Active' : 'Inactive')}
                                            </span>
                                        </td>
                                        <td className="small">{a.created_on ? new Date(a.created_on).toLocaleString() : '—'}</td>
                                        <td style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn-ssa-outline btn-ssa-sm" onClick={() => viewUsers(a)} title="View Users">
                                                <i className="bi bi-people"></i>
                                            </button>
                                            <button className="btn-ssa-outline btn-ssa-sm" onClick={() => openEdit(a)} title="Edit">
                                                <i className="bi bi-pencil"></i>
                                            </button>
                                            <button className="btn-ssa-danger btn-ssa-sm" onClick={() => handleDelete(a)} title="Delete">
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

            {/* Create/Edit Admin Modal */}
            <EditAdminModal 
                show={showModal} 
                onClose={() => setShowModal(false)} 
                onSave={handleSave} 
                form={form} 
                setForm={setForm} 
                editingAdmin={editingAdmin} 
                saving={saving} 
            />

            {/* View Users Modal */}
            {viewUsersModal && (
                <div className="ssa-modal-overlay" onClick={() => setViewUsersModal(null)}>
                    <div className="ssa-modal ssa-modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className="bi bi-people me-2"></i>Users under {viewUsersModal.name}</h5>
                            <button className="close-btn" onClick={() => setViewUsersModal(null)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            {loadingUsers ? (
                                <div className="ssa-loading"><div className="spinner-lg"></div> Loading...</div>
                            ) : adminUsers.length === 0 ? (
                                <p style={{ textAlign: 'center', opacity: 0.6 }}>No users found under this admin</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="ssa-table">
                                        <thead><tr><th>Name</th><th>Email</th><th>Portal ID</th></tr></thead>
                                        <tbody>
                                            {adminUsers.map((u, i) => (
                                                <tr key={u.id || u.portal_id || i}><td>{u.name}</td><td>{u.email}</td><td>{u.portal_id || 'N/A'}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setViewUsersModal(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default AdminManagement;
