import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { showToast, showSuccess } from '../utils/helpers';
import ssaLogo from '../assets/ssa_logo.png';

const MainLayout = ({ children }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarHidden, setSidebarHidden] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [clock, setClock] = useState('');
    const profileRef = useRef(null);

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        name: '', email: '', currentPassword: '', password: '', confirmPassword: ''
    });

    // Live Clock
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setClock(now.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            }));
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, []);

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Close mobile sidebar on outside click
    useEffect(() => {
        const handler = (e) => {
            const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
            if (isMobile && sidebarOpen) {
                const sidebar = document.getElementById('ssaSidebar');
                const toggle = document.getElementById('sidebarToggle');
                if (sidebar && !sidebar.contains(e.target) && toggle && !toggle.contains(e.target)) {
                    setSidebarOpen(false);
                }
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [sidebarOpen]);

    // Apply sidebar body classes
    useEffect(() => {
        document.body.classList.toggle('sidebar-open', sidebarOpen);
        document.body.classList.toggle('sidebar-hidden', sidebarHidden);
        return () => {
            document.body.classList.remove('sidebar-open', 'sidebar-hidden');
        };
    }, [sidebarOpen, sidebarHidden]);

    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
    const isExactActive = (path) => location.pathname === path;

    const toggleSidebar = (e) => {
        e.stopPropagation();
        const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
        if (isMobile) {
            setSidebarOpen(prev => !prev);
        } else {
            setSidebarHidden(prev => !prev);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const openProfileModal = () => {
        setProfileOpen(false);
        setProfileForm({
            name: user?.name || '',
            email: user?.email || '',
            portal_id: user?.portalId || '',
            currentPassword: '',
            password: '',
            confirmPassword: ''
        });
        setProfileModalOpen(true);
    };

    const handleProfileSave = async () => {
        if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        // If password is being changed, current password is strictly required
        if (profileForm.password && !profileForm.currentPassword) {
            showToast('Current password is required to set a new password', 'error');
            return;
        }

        try {
            const payload = {
                action: 'update_profile',
                data: {
                    user_id: user?.id,
                    name: profileForm.name,
                    email: profileForm.email,
                }
            };

            if (profileForm.password) {
                payload.data.current_password = profileForm.currentPassword;
                payload.data.new_password = profileForm.password;
            }

            await api.post('/auth/manage/', payload);
            showSuccess('Profile Updated', 'Your profile has been saved.');
            setProfileModalOpen(false);
        } catch (err) {
            showToast(err.response?.data?.data || 'Failed to update profile', 'error');
        }
    };

    const navItems = [
        { path: '/dashboard', icon: 'bi-house-door-fill', label: 'Dashboard', roles: ['Super Admin', 'Admin', 'User'] },
        { path: '/admins', icon: 'bi-person-lines-fill', label: 'Manage Admins', roles: ['Super Admin'] },
        { path: '/users', icon: 'bi-people-fill', label: 'Manage Users', roles: ['Super Admin', 'Admin'] },
        { path: '/stations', icon: 'bi-geo-alt-fill', label: 'Stations', roles: ['Super Admin', 'Admin', 'User'] },
        { path: '/transactions', icon: 'bi-currency-dollar', label: 'Transactions', roles: ['Super Admin', 'Admin', 'User'] },
        { path: '/reports', icon: 'bi-bar-chart-fill', label: 'Reports', roles: ['Super Admin', 'Admin', 'User'] },
        { path: '/assets', icon: 'bi-box-seam-fill', label: 'Assets', roles: ['User'] },
    ];

    return (
        <>
            {/* HEADER */}
            <header className="ssa-navbar">
                <div className="brand-section">
                    <Link to="/dashboard" className="logo-box" style={{ textDecoration: 'none' }}>
                        <img src={ssaLogo} alt="SSA Logo" />
                        
                    </Link>
                    <button className="sidebar-toggle" id="sidebarToggle" onClick={toggleSidebar}>
                        <i className="bi bi-list"></i>
                    </button>
                </div>

                <div className="header-controls">
                    <span className="live-clock">
                        <i className="bi bi-cloud-sun me-1"></i>
                        28 °C &nbsp;|&nbsp;&nbsp;
                        <i className="bi bi-clock me-1"></i>
                        {clock}
                    </span>

                    <button className="header-btn" onClick={toggleTheme} title="Toggle Theme">
                        <i className={`bi ${theme === 'light' ? 'bi-moon-stars-fill' : 'bi-sun-fill'}`}></i>
                    </button>

                    <div className="profile-dropdown" ref={profileRef}>
                        <button className="profile-trigger" onClick={() => setProfileOpen(!profileOpen)}>
                            <i className="bi bi-person-circle"></i>
                            <div className="user-info">
                                <div className="user-name">{user?.name || 'User'}</div>
                                <div className="user-role">{user?.role || 'User'}</div>
                            </div>
                        </button>
                        <div className={`dropdown-menu ${profileOpen ? 'show' : ''}`}>
                            <button className="dropdown-item" onClick={openProfileModal}>
                                <i className="bi bi-person-gear"></i> Edit Profile
                            </button>
                            <div className="dropdown-divider"></div>
                            <button className="dropdown-item" onClick={handleLogout} style={{ color: '#dc3545' }}>
                                <i className="bi bi-box-arrow-right"></i> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* SIDEBAR */}
            <nav className="ssa-sidebar" id="ssaSidebar">
                <ul className="nav-list">
                    {navItems.filter(item => item.roles.includes(user?.role || 'User')).map(item => (
                        <li className="nav-item" key={item.path}>
                            <Link
                                to={item.path}
                                className={`nav-link ${isExactActive(item.path) || (item.path !== '/dashboard' && isActive(item.path)) ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <i className={`bi ${item.icon}`}></i>
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* MAIN CONTENT */}
            <main className="ssa-main-content">
                {children}
            </main>

            {/* PROFILE MODAL */}
            {profileModalOpen && (
                <div className="ssa-modal-overlay" onClick={() => setProfileModalOpen(false)}>
                    <div className="ssa-modal" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className="bi bi-person-gear me-2"></i>Edit Profile</h5>
                            <button className="close-btn" onClick={() => setProfileModalOpen(false)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            {user?.portalId && (
                                <div className="ssa-form-group">
                                    <label className="ssa-form-label">Portal ID</label>
                                    <input
                                        className="ssa-form-control"
                                        value={user.portalId}
                                        disabled
                                        style={{ backgroundColor: '#f0f2f5', cursor: 'not-allowed', color: '#666' }}
                                    />
                                </div>
                            )}
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Full Name</label>
                                <input
                                    className="ssa-form-control"
                                    value={profileForm.name}
                                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                                />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Email</label>
                                <input
                                    className="ssa-form-control"
                                    type="email"
                                    value={profileForm.email}
                                    onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                                />
                            </div>
                            
                            <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid var(--border-color)' }} />
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Change Password</div>

                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Current Password <span style={{color:'red'}}>*</span></label>
                                <input
                                    className="ssa-form-control"
                                    type="password"
                                    placeholder="Required to set new password"
                                    value={profileForm.currentPassword}
                                    onChange={e => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                                />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">New Password</label>
                                <input
                                    className="ssa-form-control"
                                    type="password"
                                    placeholder="Leave blank to keep current"
                                    value={profileForm.password}
                                    onChange={e => setProfileForm({ ...profileForm, password: e.target.value })}
                                />
                            </div>
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Confirm New Password</label>
                                <input
                                    className="ssa-form-control"
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={profileForm.confirmPassword}
                                    onChange={e => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setProfileModalOpen(false)}>Cancel</button>
                            <button className="btn-ssa-primary" onClick={handleProfileSave}>
                                <i className="bi bi-check-lg"></i> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MainLayout;
