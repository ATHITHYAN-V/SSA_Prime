import React from 'react';

const EditAdminModal = ({ show, onClose, onSave, form, setForm, editingAdmin, saving }) => {
    if (!show) return null;

    return (
        <div className="ssa-modal-overlay" onClick={onClose}>
            <div className="ssa-modal" onClick={e => e.stopPropagation()}>
                <div className="ssa-modal-header">
                    <h5><i className={`bi ${editingAdmin ? 'bi-pencil-square' : 'bi-shield-plus'} me-2`}></i>{editingAdmin ? 'Edit Admin' : 'Add Admin'}</h5>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="ssa-modal-body">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Full Name *</label>
                                <input 
                                    className="ssa-form-control" 
                                    autoComplete="off" 
                                    value={form.name} 
                                    onChange={e => setForm({ ...form, name: e.target.value })} 
                                />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Email *</label>
                                <input 
                                    className="ssa-form-control" 
                                    type="email" 
                                    autoComplete="off" 
                                    value={form.email} 
                                    onChange={e => setForm({ ...form, email: e.target.value })} 
                                />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">{editingAdmin ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                                <input 
                                    className="ssa-form-control" 
                                    type="password" 
                                    autoComplete="new-password" 
                                    value={form.password} 
                                    onChange={e => setForm({ ...form, password: e.target.value })} 
                                />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Portal ID</label>
                                <input 
                                    className="ssa-form-control" 
                                    value={form.portal_id} 
                                    onChange={e => setForm({ ...form, portal_id: e.target.value })} 
                                />
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Status</label>
                                <select 
                                    className="ssa-form-control" 
                                    value={form.status || 'active'} 
                                    onChange={e => setForm({ ...form, status: e.target.value })}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="ssa-modal-footer">
                    <button className="btn-ssa-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-ssa-primary" onClick={onSave} disabled={saving}>
                        {saving ? 'Saving...' : <><i className="bi bi-check-lg me-1"></i>{editingAdmin ? 'Update' : 'Create'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditAdminModal;
