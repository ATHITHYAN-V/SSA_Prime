import React, { useEffect, useState, useMemo } from 'react';
import MainLayout from '../components/MainLayout';
import api from '../services/api';
import { showToast } from '../utils/helpers';

const AssetManagement = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    
    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        model: '',
        volume: '',
        descriptions: '',
        valitity: '',
        status: 'active'
    });

    useEffect(() => {
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const response = await api.get('/asset/list/');
            // Handle different response structures if needed
            const data = Array.isArray(response.data.data) ? response.data.data : 
                         Array.isArray(response.data) ? response.data : [];
            setAssets(data);
        } catch (err) {
            console.error('Asset fetch error', err);
            showToast('Failed to load assets', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData({ model: '', volume: '', descriptions: '', valitity: '', status: 'active' });
        setIsEditing(false);
        setEditId(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const handleEdit = (asset) => {
        setIsEditing(true);
        setEditId(asset.id);
        setFormData({
            model: asset.model,
            volume: asset.volume,
            descriptions: asset.descriptions || '',
            valitity: asset.valitity ? asset.valitity.slice(0, 16) : '', // Format for datetime-local
            status: asset.status
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Validation
            if (!formData.model || !formData.volume || !formData.valitity) {
                showToast('Please fill all required fields', 'error');
                return;
            }

            // Ensure valid datetime string if needed, or send as is if input type="datetime-local"
            // Backend expects 'valitity' (note spelling)
            const payload = {
                ...formData,
                volume: parseFloat(formData.volume),
                // Ensure date format compatibility if needed. 
                // HTML datetime-local gives "YYYY-MM-DDTHH:mm". Django typically accepts this.
            };

            if (isEditing) {
                await api.put(`/asset/update/${editId}/`, payload);
                showToast('Asset updated successfully', 'success');
            } else {
                await api.post('/asset/create/', payload);
                showToast('Asset created successfully', 'success');
            }

            setShowModal(false);
            resetForm();
            fetchAssets();
        } catch (err) {
            console.error('Save asset error', err);
            const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save asset';
            showToast(msg, 'error');
        }
    };

    const handleToggleStatus = async (asset) => {
        const newStatus = asset.status === 'active' ? 'inactive' : 'active';
        try {
            // We need to send the full payload or partial update if backend supports PATCH.
            // Assuming PUT requires all fields, we construct the payload from the asset.
            // If backend supports partial updates with PATCH, that's better, but let's stick to PUT strictness for now.
            // Or typically a specific "toggle" endpoint is better.
            // Let's try sending the full object with swapped status.
            
            const payload = {
                model: asset.model,
                volume: parseFloat(asset.volume),
                descriptions: asset.descriptions,
                valitity: asset.valitity,
                status: newStatus
            };

            await api.put(`/asset/update/${asset.id}/`, payload);
            
            // Optimistic update
            setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: newStatus } : a));
            showToast(`Asset marked as ${newStatus}`, 'success');
        } catch (err) {
            console.error('Status toggle error', err);
            showToast('Failed to update status', 'error');
            // Revert on failure (reload)
            fetchAssets(); 
        }
    };

    const handleDelete = (id) => {
        setDeleteTargetId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        try {
            await api.delete(`/asset/delete/${deleteTargetId}/`);
            showToast('Asset deleted', 'success');
            fetchAssets();
            setShowDeleteModal(false);
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.error || 'Failed to delete asset';
            showToast(msg, 'error');
        }
    };

    const currentData = useMemo(() => {
        if (!search) return assets;
        const q = search.toLowerCase();
        return assets.filter(item => 
            (item.model || '').toLowerCase().includes(q) ||
            (item.descriptions || '').toLowerCase().includes(q)
        );
    }, [assets, search]);

    // Styles
    const styles = {
        pageHeader: { marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        summaryCard: {
            background: 'var(--card-bg)', 
            borderRadius: '12px',
            padding: '20px',
            width: '300px',
            position: 'relative',
            borderLeft: '4px solid #00d2d3', // Cyan accent
            marginBottom: '30px',
            color: 'var(--text-color)',
            boxShadow: 'var(--ssa-card-shadow)'
        },
        cardTitle: { fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-color)', opacity: 0.7, marginBottom: '8px', fontWeight: 600 },
        cardValue: { fontSize: '2.5rem', fontWeight: 700, margin: 0, lineHeight: 1, color: 'var(--text-color)' },
        cardIcon: { position: 'absolute', top: '20px', right: '20px', fontSize: '2rem', color: '#00d2d3', opacity: 0.8 },
        searchBar: {
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '8px 12px',
            color: 'var(--text-color)',
            width: '250px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        },
        searchInput: { background: 'transparent', border: 'none', color: 'var(--text-color)', width: '100%', outline: 'none' },
        tableContainer: { background: 'var(--card-bg)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--ssa-card-shadow)' },
        table: { width: '100%', borderCollapse: 'collapse', color: 'var(--text-color)' },
        th: { textAlign: 'left', padding: '16px', background: 'var(--ssa-primary-bg)', borderBottom: '1px solid var(--border-color)', color: '#fff', fontWeight: 600, textTransform: 'capitalize' },
        td: { padding: '16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-color)', verticalAlign: 'middle' },
        actionBtn: { background: 'none', border: 'none', color: 'var(--text-color)', opacity: 0.8, cursor: 'pointer', marginRight: '16px', fontSize: '1.5rem', transition: 'all 0.2s' },
        createBtn: {
            background: 'var(--ssa-primary-bg)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        modalOverlay: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        },
        modalContent: {
            background: 'var(--card-bg)', width: '500px', borderRadius: '12px', padding: '24px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)', color: 'var(--text-color)'
        },
        formGroup: { marginBottom: '16px' },
        label: { display: 'block', marginBottom: '6px', fontSize: '0.9rem', opacity: 0.9 },
        input: {
            width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)',
            background: 'var(--body-bg)', color: 'var(--text-color)', outline: 'none'
        },
        modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
        btnSecondary: { padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' },
        btnPrimary: { padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--ssa-primary-bg)', color: '#fff', cursor: 'pointer' }
    };

    return (
        <MainLayout>
            <div style={{ padding: '20px', minHeight: '100vh', background: 'var(--body-bg)' }}> 
                <div style={styles.pageHeader}>
                    <h2 style={{ color: 'var(--text-color)', margin: 0 }}>Asset Management</h2>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={styles.searchBar}>
                            <i className="bi bi-search" style={{ color: 'var(--text-color)', opacity: 0.6 }}></i>
                            <input 
                                style={styles.searchInput} 
                                placeholder="Search Asset ID..." 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                            />
                        </div>
                        <button style={styles.createBtn} onClick={openCreateModal}>
                            <i className="bi bi-plus-lg"></i> Create Asset
                        </button>
                    </div>
                </div>

                {/* Summary Card */}
                <div style={styles.summaryCard}>
                    <div style={styles.cardTitle}>Total Assets</div>
                    <h3 style={styles.cardValue}>{assets.length}</h3>
                    <i className="bi bi-box-seam" style={styles.cardIcon}></i>
                </div>

                {/* Assets Table */}
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>ID (Model)</th>
                                <th style={styles.th}>Volume</th>
                                <th style={styles.th}>Description</th>
                                <th style={styles.th}>Validity</th>
                                <th style={styles.th}>Status</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
                            ) : currentData.length > 0 ? (
                                currentData.map((item) => (
                                    <tr key={item.id}>
                                        <td style={styles.td}>{item.model}</td>
                                        <td style={styles.td}>{item.volume}</td>
                                        <td style={styles.td}>{item.descriptions || '-'}</td>
                                        <td style={styles.td}>{item.valitity ? new Date(item.valitity).toLocaleString() : '-'}</td>
                                        <td style={styles.td}>
                                            <span 
                                                className="badge"
                                                style={{ 
                                                    textTransform: 'uppercase', 
                                                    backgroundColor: (item.status || '').toLowerCase() === 'active' ? '#198754' : '#dc3545', 
                                                    color: '#fff',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    padding: '5px 12px',
                                                    borderRadius: '20px',
                                                    letterSpacing: '0.5px'
                                                }}
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            <button 
                                                style={{...styles.actionBtn, color: (item.status || '').toLowerCase() === 'active' ? '#00d32aff' : '#ff6b6b'}} 
                                                title={(item.status || '').toLowerCase() === 'Active' ? 'Deactivate' : 'Activate'}
                                                onClick={() => handleToggleStatus(item)}
                                            >
                                                <i className={`bi bi-toggle-${(item.status || '').toLowerCase() === 'active' ? 'on' : 'off'}`} style={{ fontSize: '1.8rem' }}></i>
                                            </button>
                                            <button 
                                                style={styles.actionBtn} 
                                                title="Edit" 
                                                onClick={() => handleEdit(item)}
                                            >
                                                <i className="bi bi-pencil-square" style={{ fontSize: '1.5rem' }}></i>
                                            </button>
                                            <button 
                                                style={{...styles.actionBtn, color: '#ff6b6b', marginRight: 0}} 
                                                title="Delete" 
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <i className="bi bi-trash3-fill" style={{ fontSize: '1.5rem' }}></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-color)', opacity: 0.7 }}>
                                        <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}></i>
                                        No assets found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Create/Edit Modal */}
                {showModal && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.modalContent}>
                            <h3 style={{ marginTop: 0 }}>{isEditing ? 'Edit Asset' : 'Create New Asset'}</h3>
                            <form onSubmit={handleSubmit}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Model ID *</label>
                                    <input 
                                        name="model" 
                                        value={formData.model} 
                                        onChange={handleInputChange} 
                                        style={styles.input} 
                                        placeholder="e.g. ASSET-001"
                                        required 
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Volume *</label>
                                    <input 
                                        name="volume" 
                                        type="number" 
                                        step="0.01"
                                        value={formData.volume} 
                                        onChange={handleInputChange} 
                                        style={styles.input} 
                                        required 
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Description</label>
                                    <input 
                                        name="descriptions" 
                                        value={formData.descriptions} 
                                        onChange={handleInputChange} 
                                        style={styles.input} 
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Validity *</label>
                                    <input 
                                        name="valitity" 
                                        type="datetime-local" 
                                        value={formData.valitity} 
                                        onChange={handleInputChange} 
                                        style={styles.input} 
                                        required 
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>Status</label>
                                    <select 
                                        name="status" 
                                        value={formData.status} 
                                        onChange={handleInputChange} 
                                        style={styles.input}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                                <div style={styles.modalActions}>
                                    <button type="button" onClick={() => setShowModal(false)} style={styles.btnSecondary}>Cancel</button>
                                    <button type="submit" style={styles.btnPrimary}>{isEditing ? 'Save Changes' : 'Create'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.modalContent}>
                            <h3 style={{ marginTop: 0, color: '#ff6b6b' }}><i className="bi bi-exclamation-triangle-fill me-2"></i>Confirm Deletion</h3>
                            <p style={{ opacity: 0.8, fontSize: '1rem', margin: '20px 0' }}>
                                Are you sure you want to delete this asset? This action cannot be undone.
                            </p>
                            <div style={styles.modalActions}>
                                <button onClick={() => setShowDeleteModal(false)} style={styles.btnSecondary}>Cancel</button>
                                <button onClick={confirmDelete} style={{ ...styles.btnPrimary, background: '#ff6b6b' }}>
                                    <i className="bi bi-trash-fill me-2"></i>Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default AssetManagement;
