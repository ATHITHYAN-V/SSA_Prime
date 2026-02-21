import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { showToast, showConfirm, showSuccess } from '../utils/helpers';
import { useStationDetails } from '../hooks/useStationDetails';

/* ───────────────────────────────────────────
   Inline Create Form  (matches reference)
   ─────────────────────────────────────────── */
const DispenserCreateForm = ({ show, onSubmit, form, setForm, saving, onCancel }) => {
    if (!show) return null;
    return (
        <div className="ssa-card" style={{ marginTop: 16 }}>
            <div className="card-body">
                <h6 style={{ fontWeight: 700, marginBottom: 16 }}>
                    <i className="bi bi-plus-circle me-2"></i>Create Dispenser
                </h6>
                <form onSubmit={onSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Dispenser Type</label>
                            <select className="ssa-form-control" value={form.deviceType} onChange={e => setForm({ ...form, deviceType: e.target.value })}>
                                <option value="Bowser">Bowser</option>
                                <option value="Stationary">Stationary</option>
                            </select>
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Dispenser ID *</label>
                            <input
                                className="ssa-form-control"
                                value={form.id}
                                placeholder={form.deviceType === 'Bowser' ? 'e.g., BU001' : 'e.g., ST001'}
                                onChange={e => setForm({ ...form, id: e.target.value.toUpperCase() })}
                                required
                            />
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Device ID (10-Char) *</label>
                            <input
                                className="ssa-form-control"
                                value={form.mqtt_id}
                                placeholder="e.g., ABC1234567"
                                maxLength={10}
                                onChange={e => setForm({ ...form, mqtt_id: e.target.value })}
                                required
                            />
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Name *</label>
                            <input className="ssa-form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Status</label>
                            <select className="ssa-form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Description</label>
                            <input className="ssa-form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <button type="submit" className="btn-ssa-primary btn-ssa-sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                        <button type="button" className="btn-ssa-secondary btn-ssa-sm" onClick={onCancel}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TankCreateForm = ({ show, onSubmit, form, setForm, saving, onCancel }) => {
    if (!show) return null;
    return (
        <div className="ssa-card" style={{ marginTop: 16 }}>
            <div className="card-body">
                <h6 style={{ fontWeight: 700, marginBottom: 16 }}>
                    <i className="bi bi-plus-circle me-2"></i>Create Tank
                </h6>
                <form onSubmit={onSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Tank ID *</label>
                            <input className="ssa-form-control" value={form.id} placeholder="e.g., TA001" onChange={e => setForm({ ...form, id: e.target.value.toUpperCase() })} required />
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Tank Name *</label>
                            <input className="ssa-form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Device ID (10-Char) *</label>
                            <input className="ssa-form-control" value={form.mqtt_id} placeholder="e.g., ABC1234567" maxLength={10} onChange={e => setForm({ ...form, mqtt_id: e.target.value })} required />
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Description</label>
                            <input className="ssa-form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
                        </div>
                        <div className="ssa-form-group">
                            <label className="ssa-form-label">Status</label>
                            <select className="ssa-form-control" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                        <button type="submit" className="btn-ssa-primary btn-ssa-sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                        <button type="button" className="btn-ssa-secondary btn-ssa-sm" onClick={onCancel}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ───────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────── */
const StationDetail = () => {
    const { stationId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    // React Query hook — lazy loads station + devices, cached for 5 min
    const {
        station, bowsers, tanks, stationaries, transactions,
        isLoading, isError, invalidate, refetchAll
    } = useStationDetails(stationId);

    const [activeTab, setActiveTab] = useState('dispensers');
    const [selectedTxn, setSelectedTxn] = useState(null);

    // Create forms
    const [showDispenserForm, setShowDispenserForm] = useState(false);
    const [showTankForm, setShowTankForm] = useState(false);
    const [dispenserForm, setDispenserForm] = useState({ deviceType: 'Bowser', id: '', mqtt_id: '', name: '', description: '', status: 'inactive' });
    const [tankForm, setTankForm] = useState({ id: '', mqtt_id: '', name: '', description: '', status: 'inactive' });
    const [saving, setSaving] = useState(false);

    // Edit device modal
    const [editModal, setEditModal] = useState(null);
    const [editForm, setEditForm] = useState({});

    const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
    const canManageDevices = isAdmin || user?.role === 'User';

    // Combined dispensers list (bowsers + stationaries with type tag)
    const dispensers = [
        ...bowsers.map(b => ({ ...b, _type: 'Bowser', _idKey: 'bowser_id', _nameKey: 'bowser_name' })),
        ...stationaries.map(s => ({ ...s, _type: 'Stationary', _idKey: 'stationary_id', _nameKey: 'stationary_name' }))
    ];

    /* ── Validation ── */
    const validateDevice = (type, idValue, mqttId, name) => {
        const patterns = { bowser: /^BU\d{3}$/, tank: /^TA\d{3}$/, stationary: /^ST\d{3}$/ };
        const labels = { bowser: 'BU', tank: 'TA', stationary: 'ST' };
        if (!idValue || !mqttId || !name) { showToast('All required fields must be filled', 'error'); return false; }
        if (!/^[a-z0-9 ]+$/i.test(name)) { showToast('Name can only contain letters, numbers and spaces', 'error'); return false; }
        if (!patterns[type].test(idValue)) { showToast(`ID must be ${labels[type]} + 3 digits (e.g., ${labels[type]}001)`, 'error'); return false; }
        if (!/^[A-Za-z0-9]{10}$/.test(mqttId)) { showToast('Device ID must be exactly 10 alphanumeric characters', 'error'); return false; }
        return true;
    };

    /* ── Create Dispenser (Bowser or Stationary) ── */
    const addDispenser = async (e) => {
        e.preventDefault();
        const type = dispenserForm.deviceType === 'Bowser' ? 'bowser' : 'stationary';
        if (!validateDevice(type, dispenserForm.id, dispenserForm.mqtt_id, dispenserForm.name)) return;
        setSaving(true);
        try {
            if (type === 'bowser') {
                await api.post(`/stations/${stationId}/bowsers/add/`, {
                    bowser_id: dispenserForm.id, mqtt_id: dispenserForm.mqtt_id, bowser_name: dispenserForm.name,
                    bowser_description: dispenserForm.description, status: dispenserForm.status
                });
            } else {
                await api.post(`/stations/${stationId}/stationaries/add/`, {
                    stationary_id: dispenserForm.id, mqtt_id: dispenserForm.mqtt_id, stationary_name: dispenserForm.name,
                    stationary_description: dispenserForm.description, status: dispenserForm.status
                });
            }
            showToast(`${dispenserForm.deviceType} Added!`, 'success');
            setDispenserForm({ deviceType: 'Bowser', id: '', mqtt_id: '', name: '', description: '', status: 'inactive' });
            setShowDispenserForm(false);
            invalidate(type === 'bowser' ? 'bowsers' : 'stationaries');
        } catch (err) { showToast(`Failed to add ${dispenserForm.deviceType.toLowerCase()}`, 'error'); }
        finally { setSaving(false); }
    };

    /* ── Create Tank ── */
    const addTank = async (e) => {
        e.preventDefault();
        if (!validateDevice('tank', tankForm.id, tankForm.mqtt_id, tankForm.name)) return;
        setSaving(true);
        try {
            await api.post(`/stations/${stationId}/tanks/add/`, {
                tank_id: tankForm.id, mqtt_id: tankForm.mqtt_id, tank_name: tankForm.name,
                pump_count: 1, status: tankForm.status
            });
            showToast('Tank Added!', 'success');
            setTankForm({ id: '', mqtt_id: '', name: '', description: '', status: 'inactive' });
            setShowTankForm(false);
            invalidate('tanks');
        } catch (err) { showToast('Failed to add tank', 'error'); }
        finally { setSaving(false); }
    };

    /* ── Station Actions ── */
    const toggleStationStatus = async () => {
        const newStatus = station.status?.toLowerCase() === 'active' ? 'inactive' : 'active';
        const confirmed = await showConfirm(
            `${newStatus === 'active' ? 'Activate' : 'Deactivate'} Station?`,
            `Station will be marked as ${newStatus}.`
        );
        if (!confirmed) return;
        try {
            await api.put(`/stations/${stationId}/update/`, { status: newStatus });
            showToast(`Station ${newStatus === 'active' ? 'Activated' : 'Deactivated'}`, 'success');
            invalidate('station');
        } catch (err) { showToast('Failed to update status', 'error'); }
    };

    const handleDeleteStation = async () => {
        const confirmed = await showConfirm('Delete Station?', 'This action cannot be undone. All devices under this station will also be removed.', 'Yes, delete!');
        if (!confirmed) return;
        try {
            await api.delete(`/stations/${stationId}/delete/`);
            showSuccess('Station Deleted', 'The station has been removed.');
            navigate('/stations');
        } catch (err) { showToast('Failed to delete station', 'error'); }
    };

    /* ── Edit Device Modal ── */
    const openEditDevice = (device, deviceType) => {
        const nameKey = deviceType === 'bowser' ? 'bowser_name' : deviceType === 'tank' ? 'tank_name' : 'stationary_name';
        const idKey = deviceType === 'bowser' ? 'bowser_id' : deviceType === 'tank' ? 'tank_id' : 'stationary_id';
        const descKey = deviceType === 'bowser' ? 'bowser_description' : deviceType === 'tank' ? 'tank_description' : 'stationary_description';
        setEditModal({ device, deviceType });
        setEditForm({
            ...device,
            _name: device[nameKey] || '',
            _id: device[idKey] || '',
            _description: device[descKey] || device.description || '',
            _mqttId: device.mqtt_id || '',
            status: device.status || 'inactive'
        });
    };

    const saveEditDevice = async () => {
        if (!editModal) return;
        const { deviceType } = editModal;
        try {
            const dbId = editForm.id;
            let endpoint, payload;

            if (deviceType === 'bowser') {
                endpoint = `/bowsers/${dbId}/`;
                payload = { ...editForm, bowser_name: editForm._name, bowser_description: editForm._description, status: editForm.status };
            } else if (deviceType === 'tank') {
                endpoint = `/tanks/${dbId}/`;
                payload = { ...editForm, tank_name: editForm._name, tank_description: editForm._description, status: editForm.status };
            } else {
                endpoint = `/stationaries/${dbId}/`;
                payload = { ...editForm, stationary_name: editForm._name, stationary_description: editForm._description, status: editForm.status };
            }

            await api.put(endpoint, payload);
            showToast('Device Updated!', 'success');
            setEditModal(null);
            // Invalidate only the specific device type cache
            invalidate(deviceType === 'bowser' ? 'bowsers' : deviceType === 'tank' ? 'tanks' : 'stationaries');
        } catch (err) { showToast('Failed to update device', 'error'); }
    };

    const deleteDevice = async (deviceId, deviceType) => {
        const confirmed = await showConfirm('Delete Device?', 'This device will be permanently removed.');
        if (!confirmed) return;
        try {
            const endpoint = deviceType === 'bowser' ? `/bowsers/${deviceId}/` : deviceType === 'tank' ? `/tanks/${deviceId}/` : `/stationaries/${deviceId}/`;
            await api.delete(endpoint);
            showToast('Device Deleted', 'success');
            invalidate(deviceType === 'bowser' ? 'bowsers' : deviceType === 'tank' ? 'tanks' : 'stationaries');
        } catch (err) { showToast('Failed to delete', 'error'); }
    };

    /* ── Loading / Error States ── */
    if (isLoading) return <MainLayout><div className="ssa-loading"><div className="spinner-lg"></div> Loading station details...</div></MainLayout>;
    if (isError || !station) return (
        <MainLayout>
            <div style={{ textAlign: 'center', padding: 40 }}>
                <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', color: '#dc3545' }}></i>
                <p style={{ marginTop: 12 }}>Failed to load station details.</p>
                <button className="btn-ssa-outline" onClick={refetchAll}>Retry</button>
                <Link to="/stations" className="btn-ssa-secondary" style={{ textDecoration: 'none', marginLeft: 10 }}>Back to Stations</Link>
            </div>
        </MainLayout>
    );

    return (
        <MainLayout>
            {/* Page Header */}
            <div className="page-header">
                <h3><i class="bi bi-fuel-pump"></i>Station Name: {station.name || station.station_name}</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                    <Link to="/stations" className="btn-ssa-secondary" style={{ textDecoration: 'none' }}>
                        <i className="bi bi-arrow-left me-1"></i>Back
                    </Link>
                    {isAdmin && (
                        <button
                            className={`btn-ssa-${station.status?.toLowerCase() === 'active' ? 'danger' : 'success'}`}
                            onClick={toggleStationStatus}
                        >
                            <i className={`bi bi-${station.status?.toLowerCase() === 'active' ? 'pause-fill' : 'play-fill'} me-1`}></i>
                            {station.status?.toLowerCase() === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                    )}
                    {isAdmin && (
                        <button className="btn-ssa-danger" onClick={handleDeleteStation}>
                            <i className="bi bi-trash me-1"></i>Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Station Info Header */}
            <div className="station-info-header">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                    <div><span style={{ fontWeight: 600, fontSize: '0.82rem', opacity: 0.6, textTransform: 'uppercase' }}>Station ID</span><div style={{ fontWeight: 700 }}>{station.station_id}</div></div>
                    <div><span style={{ fontWeight: 600, fontSize: '0.82rem', opacity: 0.6, textTransform: 'uppercase' }}>Location</span><div style={{ fontWeight: 700 }}>{station.location}</div></div>
                    <div><span style={{ fontWeight: 600, fontSize: '0.82rem', opacity: 0.6, textTransform: 'uppercase' }}>Created On</span><div style={{ fontWeight: 700 }}>{station.created_on || 'N/A'}</div></div>
                    <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end' }}>
                        <div className="status-badge bg-success cursor-pointer" title="Dispensers" onClick={() => setActiveTab('dispensers')}>
                            <i className="bi bi-fuel-pump-fill me-1"></i> {dispensers.length}
                        </div>
                        <div className="status-badge bg-warning text-dark cursor-pointer" title="Tanks" onClick={() => setActiveTab('tanks')}>
                            <i className="bi bi-truck-flatbed me-1"></i> {tanks.length}
                        </div>
                        
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 12 }}>
                    <div><span style={{ fontWeight: 600, fontSize: '0.82rem', opacity: 0.6, textTransform: 'uppercase' }}>Category</span><div style={{ fontWeight: 700 }}>{station.category || 'N/A'}</div></div>
                    <div><span style={{ fontWeight: 600, fontSize: '0.82rem', opacity: 0.6, textTransform: 'uppercase' }}>Status</span><div><span className={`status-badge ${station.status?.toLowerCase() === 'active' ? 'bg-success' : 'bg-danger'}`}>{station.status}</span></div></div>
                    
                </div>
                <div><span style={{ fontWeight: 600, fontSize: '0.82rem', opacity: 0.6, textTransform: 'uppercase' }}>Description</span><div>{station.description}</div></div>
                
            </div>

            {/* ── Tabs ── */}
            <div className="ssa-tabs">
                <button className={`ssa-tab ${activeTab === 'dispensers' ? 'active' : ''}`} onClick={() => setActiveTab('dispensers')}>
                    <i className="bi bi-fuel-pump me-1"></i>Dispensers ({dispensers.length})
                </button>
                <button className={`ssa-tab ${activeTab === 'tanks' ? 'active' : ''}`} onClick={() => setActiveTab('tanks')}>
                    <i className="bi bi-droplet me-1"></i>Tanks ({tanks.length})
                </button>
            </div>

            {/* ═══════════════ DISPENSERS TAB ═══════════════ */}
            {activeTab === 'dispensers' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h5 style={{ fontWeight: 700 }}>Dispensers</h5>
                        {canManageDevices && (
                            <button className="btn-ssa-success btn-ssa-sm" onClick={() => { setShowDispenserForm(!showDispenserForm); setDispenserForm({ deviceType: 'Bowser', id: '', mqtt_id: '', name: '', description: '', status: 'inactive' }); }}>
                                <i className="bi bi-plus-lg me-1"></i>Add Dispenser
                            </button>
                        )}
                    </div>

                    <DispenserCreateForm
                        show={showDispenserForm}
                        onSubmit={addDispenser}
                        form={dispenserForm}
                        setForm={setDispenserForm}
                        saving={saving}
                        onCancel={() => { setShowDispenserForm(false); setDispenserForm({ deviceType: 'Bowser', id: '', mqtt_id: '', name: '', description: '', status: 'inactive' }); }}
                    />

                    <div className="ssa-table-container" style={{ marginTop: 12 }}>
                        <div className="table-responsive">
                            <table className="ssa-table">
                                <thead>
                                    <tr>
                                        <th>S.No</th><th>Dispenser ID</th><th>Dispenser Type</th><th>Name</th><th>Device ID</th><th>Created On</th><th>Status</th>
                                        {canManageDevices && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dispensers.length === 0 ? (
                                        <tr><td colSpan={canManageDevices ? 8 : 7} style={{ textAlign: 'center', padding: 30, opacity: 0.6 }}>No dispensers found</td></tr>
                                    ) : dispensers.map((d, i) => (
                                        <tr key={d[d._idKey] || i}>
                                            <td>{i + 1}</td>
                                            <td><code>{d[d._idKey]}</code></td>
                                            <td>{d._type}</td>
                                            <td style={{ fontWeight: 600 }}>{d[d._nameKey]}</td>
                                            <td>{d.mqtt_id}</td>
                                            <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{d.created_on ? new Date(d.created_on).toLocaleDateString() : '—'}</td>
                                            <td>
                                                <span className={`status-badge ${d.status?.toLowerCase() === 'active' ? 'bg-success' : 'bg-danger'}`}>
                                                    {d.status}
                                                </span>
                                            </td>
                                            {canManageDevices && (
                                                <td style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn-ssa-outline btn-ssa-sm" onClick={() => openEditDevice(d, d._type.toLowerCase())}>
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                    <button className="btn-ssa-danger btn-ssa-sm" onClick={() => deleteDevice(d.id, d._type.toLowerCase())}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ═══════════════ TANKS TAB ═══════════════ */}
            {activeTab === 'tanks' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h5 style={{ fontWeight: 700 }}>Tanks</h5>
                        {canManageDevices && (
                            <button className="btn-ssa-success btn-ssa-sm" onClick={() => { setShowTankForm(!showTankForm); setTankForm({ id: '', mqtt_id: '', name: '', description: '', status: 'inactive' }); }}>
                                <i className="bi bi-plus-lg me-1"></i>Add Tank
                            </button>
                        )}
                    </div>

                    <TankCreateForm
                        show={showTankForm}
                        onSubmit={addTank}
                        form={tankForm}
                        setForm={setTankForm}
                        saving={saving}
                        onCancel={() => { setShowTankForm(false); setTankForm({ id: '', mqtt_id: '', name: '', description: '', status: 'inactive' }); }}
                    />

                    <div className="ssa-table-container" style={{ marginTop: 12 }}>
                        <div className="table-responsive">
                            <table className="ssa-table">
                                <thead>
                                    <tr>
                                        <th>S.No</th><th>Tank ID</th><th>Name</th><th>Device ID</th><th>Created On</th><th>Status</th>
                                        {canManageDevices && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tanks.length === 0 ? (
                                        <tr><td colSpan={canManageDevices ? 7 : 6} style={{ textAlign: 'center', padding: 30, opacity: 0.6 }}>No tanks found</td></tr>
                                    ) : tanks.map((t, i) => (
                                        <tr key={t.tank_id || i}>
                                            <td>{i + 1}</td>
                                            <td><code>{t.tank_id}</code></td>
                                            <td style={{ fontWeight: 600 }}>{t.tank_name}</td>
                                            <td>{t.mqtt_id}</td>
                                            <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t.created_on ? new Date(t.created_on).toLocaleDateString() : '—'}</td>
                                            <td>
                                                <span className={`status-badge ${t.status?.toLowerCase() === 'active' ? 'bg-success' : 'bg-danger'}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            {canManageDevices && (
                                                <td style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn-ssa-outline btn-ssa-sm" onClick={() => openEditDevice(t, 'tank')}>
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                    <button className="btn-ssa-danger btn-ssa-sm" onClick={() => deleteDevice(t.id, 'tank')}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}


            {/* ═══════════════ EDIT DEVICE MODAL ═══════════════ */}
            {editModal && (
                <div className="ssa-modal-overlay" onClick={() => setEditModal(null)}>
                    <div className="ssa-modal" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className="bi bi-pencil-square me-2"></i>Edit {editModal.deviceType.charAt(0).toUpperCase() + editModal.deviceType.slice(1)}</h5>
                            <button className="close-btn" onClick={() => setEditModal(null)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Device / Tank ID</label>
                                <input className="ssa-form-control" value={editForm._id} readOnly style={{ background: '#eee', cursor: 'not-allowed' }} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Name</label>
                                <input className="ssa-form-control" value={editForm._name} onChange={e => setEditForm({ ...editForm, _name: e.target.value })} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Device ID (10-Char)</label>
                                <input className="ssa-form-control" value={editForm._mqttId} readOnly style={{ background: '#eee', cursor: 'not-allowed' }} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Description</label>
                                <textarea className="ssa-form-control" value={editForm._description} onChange={e => setEditForm({ ...editForm, _description: e.target.value })} rows={3} />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Status</label>
                                <select className="ssa-form-control" value={editForm.status || 'inactive'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setEditModal(null)}>Cancel</button>
                            <button className="btn-ssa-primary" onClick={saveEditDevice}><i className="bi bi-check-lg me-1"></i>Update</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ RECEIPT MODAL ═══════════════ */}
            {selectedTxn && (
                <div className="ssa-modal-overlay" onClick={() => setSelectedTxn(null)}>
                    <div className="ssa-modal ssa-modal-receipt" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header no-print">
                            <h5><i className="bi bi-receipt-cutoff me-2"></i>Transaction Receipt</h5>
                            <button className="close-btn" onClick={() => setSelectedTxn(null)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body print-padding">
                            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#003366' }}>SSA AUTOMATION PVT LTD</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Fueling Future with Technology</div>
                                <div style={{ marginTop: 15, fontWeight: 700, fontSize: '1.1rem' }}>STATION TRANSACTION</div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>ID: {selectedTxn.trnsid}</div>
                            </div>
                            <hr style={{ borderStyle: 'dashed', margin: '20px 0' }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
                                {[
                                    ['Station', station.station_name],
                                    ['Date', selectedTxn.todate],
                                    ['Time', selectedTxn.totime],
                                    ['Device ID', selectedTxn.devID],
                                    ['Pump / Slot', selectedTxn.pumpid || '01'],
                                    ['Vehicle #', selectedTxn.vehicle || 'N/A'],
                                ].map(([label, value], i) => (
                                    <div key={i}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>{label}</div>
                                        <div style={{ fontWeight: 700 }}>{value}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ margin: '30px 0', padding: '20px', background: '#f8f9fa', borderRadius: '12px', textAlign: 'center', border: '1px solid #eee' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#666' }}>TOTAL DISPENSED</div>
                                <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#007bff' }}>{parseFloat(selectedTxn.trnvol || 0).toFixed(2)} <span style={{ fontSize: '1.2rem' }}>L</span></div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#333', marginTop: 5 }}>₹ {parseFloat(selectedTxn.trnamt || 0).toFixed(2)}</div>
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.6, marginTop: 40 }}>Computer generated for {station.station_name}</div>
                        </div>
                        <div className="ssa-modal-footer no-print">
                            <button className="btn-ssa-secondary" onClick={() => setSelectedTxn(null)}>Close</button>
                            <button className="btn-ssa-primary" onClick={() => window.print()}><i className="bi bi-printer-fill me-2"></i>Print Receipt</button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default StationDetail;
