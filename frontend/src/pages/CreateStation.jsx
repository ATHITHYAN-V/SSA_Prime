import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import api from '../services/api';
import { showToast, showSuccess } from '../utils/helpers';

const CreateStation = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        station_name: '', station_id: '', location: '',
        description: '', category: 'COCO', status: 'inactive'
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // ID validation
        if (formData.station_id && !/^STSSA\d{5}$/.test(formData.station_id)) {
            showToast('Station ID must be STSSA + 5 digits (e.g., STSSA00001)', 'error');
            setLoading(false);
            return;
        }

        try {
            await api.post('/stations/create/', formData);
            await showSuccess('Station Created!', `${formData.station_name} has been created successfully.`);
            navigate('/stations');
        } catch (err) {
            let msg = err.response?.data?.status || err.response?.data?.detail || 'Failed to create station';
            if (msg === 'Validation failed' && err.response?.data?.data) {
                const errors = err.response.data.data;
                if (errors.station_id) {
                    msg = `Station ID Error: ${Array.isArray(errors.station_id) ? errors.station_id[0] : errors.station_id}`;
                } else {
                    // Get first error message from object
                    const firstKey = Object.keys(errors)[0];
                    const firstError = errors[firstKey];
                    msg = `${firstKey}: ${Array.isArray(firstError) ? firstError[0] : firstError}`;
                }
            }
            showToast(msg, 'error');
        } finally { setLoading(false); }
    };

    return (
        <MainLayout>
            <div className="page-header">
                <h2><i className="bi bi-plus-circle me-2"></i>Create New Station</h2>
                <button className="btn-ssa-secondary" onClick={() => navigate('/stations')}>
                    <i className="bi bi-arrow-left me-1"></i> Back to Stations
                </button>
            </div>

            <div className="ssa-card" style={{ maxWidth: 700 }}>
                <div className="card-body" style={{ padding: 30 }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Station Name *</label>
                                <input className="ssa-form-control" name="station_name" required
                                    value={formData.station_name} onChange={handleChange}
                                    placeholder="e.g., Main Depot" />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Station ID *</label>
                                <input className="ssa-form-control" name="station_id" required
                                    value={formData.station_id} onChange={handleChange}
                                    placeholder="e.g., STSSA00001" />
                            </div>
                        </div>

                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Location *</label>
                            <input className="ssa-form-control" name="location" required
                                value={formData.location} onChange={handleChange}
                                placeholder="e.g., Mumbai, Maharashtra" />
                        </div>

                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Description *</label>
                            <textarea className="ssa-form-control" name="description" required rows="3"
                                value={formData.description} onChange={handleChange}
                                placeholder="Brief description of the station" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Category</label>
                                <select className="ssa-form-control" name="category"
                                    value={formData.category} onChange={handleChange}>
                                    <option value="COCO">COCO</option>
                                    <option value="DODO">DODO</option>
                                </select>
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Status</label>
                                <select className="ssa-form-control" name="status"
                                    value={formData.status} onChange={handleChange}>
                                    <option value="inactive">Inactive</option>
                                    <option value="active">Active</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                            <button type="submit" className="btn-ssa-primary" disabled={loading}>
                                {loading ? <><span className="ssa-spinner"></span> Creating...</> : <><i className="bi bi-check-lg"></i> Create Station</>}
                            </button>
                            <button type="button" className="btn-ssa-secondary" onClick={() => navigate('/stations')}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        </MainLayout>
    );
};

export default CreateStation;
