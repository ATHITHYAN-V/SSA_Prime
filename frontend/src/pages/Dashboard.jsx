
import React, { useEffect, useState, useMemo } from 'react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useDashboardStats } from '../hooks/useDashboardStats';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Dashboard = () => {
    const { user } = useAuth();
    const {
        stations: stationsData,
        admins: adminsData,
        users: usersData,
        transactions: transactionsData,
        assets: assetsData,
        isSuperAdmin,
        stats,
        isLoading
    } = useDashboardStats(user?.role);

    const [chartData, setChartData] = useState({ labels: [], datasets: [] });
    const [expandedModal, setExpandedModal] = useState(null);
    const [timeFilter, setTimeFilter] = useState('7d');

    useEffect(() => {
        if (transactionsData.length > 0) {
            updateChartData();
        }
    }, [transactionsData, timeFilter]);

    // Parse todate field which can be DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD, DDMMYY, or DDMMYYYY
    const parseToDate = (dateStr) => {
        if (!dateStr) return null;
        const s = String(dateStr).trim();
        // If ISO format (YYYY-MM-DD)
        if (s.includes('-') && s.indexOf('-') === 4) {
            return new Date(s);
        }
        // DD/MM/YYYY or D/M/YYYY format (has slashes)
        if (s.includes('/')) {
            const parts = s.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                return new Date(year, month, day);
            }
        }
        // 6-digit packed DDMMYY
        if (/^\d{6}$/.test(s)) {
            const day = parseInt(s.slice(0, 2), 10);
            const month = parseInt(s.slice(2, 4), 10) - 1;
            const year = 2000 + parseInt(s.slice(4, 6), 10);
            return new Date(year, month, day);
        }
        // 8-digit packed DDMMYYYY
        if (/^\d{8}$/.test(s)) {
            const day = parseInt(s.slice(0, 2), 10);
            const month = parseInt(s.slice(2, 4), 10) - 1;
            const year = parseInt(s.slice(4, 8), 10);
            return new Date(year, month, day);
        }
        // Fallback
        return new Date(s);
    };

    // Format date + time for display
    const formatDateTime = (todate, totime) => {
        const d = parseToDate(todate);
        let dateStr = todate || '';
        if (d && !isNaN(d)) {
            dateStr = d.toLocaleDateString('en-GB');
        }
        let timeStr = String(totime || '').trim();
        if (timeStr && !timeStr.includes(':') && timeStr.length >= 6) {
            timeStr = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`;
        }
        return `${dateStr} ${timeStr}`.trim();
    };

    const updateChartData = () => {
        let cutoff = new Date();
        if (timeFilter === '7d') {
            cutoff.setDate(cutoff.getDate() - 7);
        } else if (timeFilter === '30d') {
            cutoff.setDate(cutoff.getDate() - 30);
        } else {
            // 'all' -> set to beginning of time
            cutoff = new Date(0);
        }
        cutoff.setHours(0, 0, 0, 0);
        
        const grouped = {};
        transactionsData.forEach(t => {
            const d = parseToDate(t.todate);
            if (d && !isNaN(d) && d >= cutoff) {
                const key = d.toLocaleDateString('en-GB');
                if (!grouped[key]) grouped[key] = { count: 0, vol: 0 };
                grouped[key].count += 1;
                grouped[key].vol += (parseFloat(t.trnvol) || 0);
            }
        });

        const labels = Object.keys(grouped).sort((a, b) => {
            const partsA = a.split('/');
            const partsB = b.split('/');
            return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
        });

        setChartData({
            labels,
            datasets: [
                {
                    label: 'Volume (L)',
                    data: labels.map(l => grouped[l].vol),
                    backgroundColor: '#3b82f6',
                    yAxisID: 'y',
                    barPercentage: 0.6,
                },
                {
                    label: 'Transactions',
                    data: labels.map(l => grouped[l].count),
                    backgroundColor: '#22c55e',
                    yAxisID: 'y1',
                    barPercentage: 0.6,
                }
            ]
        });
    };

    const filterByDays = (days) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        cutoff.setHours(0, 0, 0, 0);
        return transactionsData.filter(t => {
            const d = parseToDate(t.todate);
            return d && !isNaN(d) && d >= cutoff;
        });
    };

    const stats7d = filterByDays(7);
    const stats30d = filterByDays(30);

    const getAggregates = (data) => ({
        count: data.length,
        vol: data.reduce((a, t) => a + (parseFloat(t.trnvol) || 0), 0),
        amt: data.reduce((a, t) => a + (parseFloat(t.trnamt) || 0), 0)
    });

    const aggregates = {
        total: getAggregates(transactionsData),
        d7: getAggregates(stats7d),
        d30: getAggregates(stats30d)
    };

    const statCards = [
        { 
            title: 'TOTAL STATIONS', 
            value: stats.stations, 
            icon: 'bi-layers', 
            accentColor: '#ffc107',
            bgColor: '#212529',
            textColor: '#fff',
            customContent: null,
            data: stationsData,
            type: 'stations'
        },
        ...(isSuperAdmin ? [{
            title: 'TOTAL ADMINS', 
            value: stats.admins, 
            icon: 'bi-people', 
            accentColor: '#0d6efd',
            bgColor: '#212529',
            textColor: '#fff',
            customContent: null,
            data: adminsData,
            type: 'admins'
        }] : user?.role === 'Admin' ? [{
            title: 'TOTAL USERS', 
            value: stats.users, 
            icon: 'bi-people-fill', 
            accentColor: '#0d6efd',
            bgColor: '#212529',
            textColor: '#fff',
            customContent: null,
            data: usersData,
            type: 'users'
        }] : user?.role === 'User' ? [{
            title: 'TOTAL ASSETS',
            value: stats.totalAssets || 0,
            icon: 'bi-box-seam',
            accentColor: '#6f42c1', // Purple accent
            bgColor: '#212529',
            textColor: '#fff',
            customContent: null,
            data: assetsData.barcodes || [],
            type: 'assets'
        }] : []),
        { 
            title: 'STATIONS STATUS', 
            value: null, 
            icon: 'bi-server', 
            accentColor: '#198754',
            bgColor: '#212529',
            textColor: '#fff',
            customContent: (
                <div style={{ display: 'flex', gap: 20, marginTop: 5 }}>
                    <span style={{ color: '#198754', fontWeight: 'bold' }}>{stats.active_machines} Active</span>
                    <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{stats.inactive_machines} Inactive</span>
                </div>
            ),
            data: stationsData,
            type: 'machines'
        },
        ...(isSuperAdmin ? [{
            title: 'TOTAL USERS',
            value: stats.users,
            icon: 'bi-people-fill',
            accentColor: '#6f42c1',
            bgColor: '#212529',
            textColor: '#fff',
            customContent: null,
            data: usersData,
            type: 'users'
        }] : []),
        ...(!isSuperAdmin ? [{
            title: 'TRANSACTIONS', 
            value: stats.transactions, 
            icon: 'bi-graph-up', 
            accentColor: '#dc3545',
            bgColor: '#212529',
            textColor: '#fff',
            customContent: null,
            data: transactionsData,
            type: 'transactions'
        }] : [])
    ];

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'bottom', labels: { color: '#adb5bd' } },
            title: { display: false }
        },
        scales: {
            x: { 
                grid: { color: '#343a40' },
                ticks: { color: '#adb5bd' }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                grid: { color: '#343a40' },
                ticks: { color: '#adb5bd' },
                title: { display: true, text: 'Volume (Ltr)', color: '#adb5bd' }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                grid: { drawOnChartArea: false },
                ticks: { color: '#adb5bd' },
                title: { display: true, text: 'Transaction Count', color: '#adb5bd' }
            }
        }
    };

    const renderModalContent = (card) => {
        if (!card || !card.data) return <p>No data available</p>;

        const styles = {
            table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
            th: { textAlign: 'left', padding: '12px', borderBottom: '2px solid #dee2e6', color: '#6c757d', fontWeight: 600 },
            td: { padding: '12px', borderBottom: '1px solid #dee2e6', color: '#212529' },
            badge: { padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' },
            badgeSuccess: { backgroundColor: '#198754', color: '#fff' },
            badgeDanger: { backgroundColor: '#f8d7da', color: '#842029' },
            badgeWarning: { backgroundColor: '#fff3cd', color: '#664d03' },
            badgeInfo: { backgroundColor: '#cff4fc', color: '#055160' }
        };

        if (card.type === 'stations') {
            return (
                <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Station ID</th>
                                <th style={styles.th}>Name</th>
                                <th style={styles.th}>Location</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {card.data.map((item, i) => (
                                <tr key={i}>
                                    <td style={styles.td}><code>{item.station_id}</code></td>
                                    <td style={{ ...styles.td, fontWeight: 600 }}>{item.station_name}</td>
                                    <td style={styles.td}>{item.location}</td>
                                    <td style={styles.td}>
                                        <span style={{ 
                                            ...styles.badge, 
                                            ...((item.status && item.status.toLowerCase() === 'active') || item.is_active ? styles.badgeSuccess : styles.badgeDanger) 
                                        }}>
                                            {item.status || (item.is_active ? 'Active' : 'Inactive')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (card.type === 'machines') {
            return (
                <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Station ID</th>
                                <th style={styles.th}>Name</th>
                                <th style={styles.th}>Location</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {card.data.length === 0 ? (
                                <tr><td colSpan="5" style={{ ...styles.td, textAlign: 'center' }}>No stations found</td></tr>
                            ) : card.data.map((item, i) => (
                                <tr key={i}>
                                    <td style={styles.td}>{i + 1}</td>
                                    <td style={styles.td}><code>{item.station_id}</code></td>
                                    <td style={{ ...styles.td, fontWeight: 600 }}>{item.station_name}</td>
                                    <td style={styles.td}>{item.location || 'N/A'}</td>
                                    <td style={styles.td}>
                                        <span style={{ 
                                            ...styles.badge, 
                                            ...((item.status?.toLowerCase() === 'active' || item.is_active) ? styles.badgeSuccess : styles.badgeDanger)
                                        }}>
                                            {item.status || (item.is_active ? 'Active' : 'Inactive')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (card.type === 'admins') {
            return (
                <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Name</th>
                                <th style={styles.th}>Email</th>
                                <th style={styles.th}>Role</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {card.data.map((item, i) => (
                                <tr key={i}>
                                    <td style={{ ...styles.td, fontWeight: 600 }}>{item.username || item.name}</td>
                                    <td style={styles.td}>{item.email}</td>
                                    <td style={styles.td}><span style={{...styles.badge, ...styles.badgeInfo}}>{item.role || 'Admin'}</span></td>
                                    <td style={styles.td}>
                                        <span style={{ 
                                            ...styles.badge, 
                                            ...(item.is_active ? styles.badgeSuccess : styles.badgeDanger) 
                                        }}>
                                            {item.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (card.type === 'users') {
            return (
                <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Name</th>
                                <th style={styles.th}>Email</th>
                                <th style={styles.th}>Portal ID</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {card.data.map((item, i) => (
                                <tr key={i}>
                                    <td style={{ ...styles.td, fontWeight: 600 }}>{item.name}</td>
                                    <td style={styles.td}>{item.email}</td>
                                    <td style={styles.td}><code>{item.portal_id || 'N/A'}</code></td>
                                    <td style={styles.td}>
                                        <span style={{ 
                                            ...styles.badge, 
                                            ...((item.status && item.status.toLowerCase() === 'active') || item.is_active ? styles.badgeSuccess : styles.badgeDanger) 
                                        }}>
                                            {item.status || (item.is_active ? 'Active' : 'Inactive')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (card.type === 'transactions') {
            return (
                <div style={{ overflowX: 'auto' }}>
                    {card.data.length === 0 ? (
                        <p className="text-center text-muted py-4">No transactions found for this period.</p>
                    ) : (
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Txn ID</th>
                                    <th style={styles.th}>Date & Time</th>
                                    <th style={styles.th}>Volume (L)</th>
                                    <th style={styles.th}>Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {card.data.slice(0, 100).map((item, i) => (
                                    <tr key={i}>
                                        <td style={styles.td}><code>{item.trnsid}</code></td>
                                        <td style={styles.td}>{(() => {
                                            // Format date
                                            const d = parseToDate(item.todate);
                                            let dateStr = item.todate || '';
                                            if (d && !isNaN(d)) {
                                                dateStr = d.toLocaleDateString('en-GB');
                                            } else if (dateStr.length === 6) {
                                                // DDMMYY format
                                                dateStr = `${dateStr.slice(0,2)}/${dateStr.slice(2,4)}/20${dateStr.slice(4,6)}`;
                                            }
                                            // Format time
                                            let timeStr = item.totime || '';
                                            if (timeStr && !timeStr.includes(':') && timeStr.length >= 6) {
                                                timeStr = `${timeStr.slice(0,2)}:${timeStr.slice(2,4)}:${timeStr.slice(4,6)}`;
                                            }
                                            return `${dateStr} ${timeStr}`.trim();
                                        })()}</td>
                                        <td style={{ ...styles.td, fontWeight: 600 }}>{parseFloat(item.trnvol).toFixed(2)}</td>
                                        <td style={styles.td}>₹{parseFloat(item.trnamt).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            );
        }

        if (card.type === 'assets') {
            return (
                <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Asset ID</th>
                                <th style={styles.th}>Name</th>
                                <th style={styles.th}>Volume (L)</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {card.data.map((item, i) => (
                                <tr key={i}>
                                    <td style={styles.td}><code>{item.model}</code></td>
                                    <td style={{ ...styles.td, fontWeight: 600 }}>{item.descriptions || '-'}</td>
                                    <td style={styles.td}>{item.volume || '0'}</td>
                                    <td style={styles.td}>
                                        <span style={{ 
                                            ...styles.badge, 
                                            ...(item.status && item.status.toLowerCase() === 'active' ? styles.badgeSuccess : styles.badgeDanger) 
                                        }}>
                                            {item.status || 'Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        return <p>No specific view for this category.</p>;
    };

    const getSinceDate = (days) => {
        const start = new Date();
        start.setDate(start.getDate() - days);
        const options = { day: 'numeric', month: 'short' };
        return start.toLocaleDateString('en-GB', options);
    };

    if (isLoading) return <MainLayout><div className="ssa-loading"><div className="spinner-lg"></div> Loading Dashboard...</div></MainLayout>;

    return (
        <MainLayout>
            <style>
                {`
                    .dashboard-container { padding: 0; overflow: hidden; }
                    .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; margin-bottom: 24px; }
                    .main-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 1fr); gap: 24px; }
                    .dashboard-card {
                        background-color: var(--card-bg); border-radius: 8px; padding: 24px; height: 100%;
                        border-left: 5px solid transparent; box-shadow: var(--ssa-card-shadow);
                        color: var(--text-color);
                        cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
                        min-width: 0; overflow: hidden;
                    }
                    .dashboard-card:hover { transform: translateY(-5px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
                    .chart-container { background-color: var(--card-bg); border-radius: 8px; padding: 24px; box-shadow: var(--ssa-card-shadow); height: 100%; min-width: 0; overflow: hidden; color: var(--text-color); }
                    .summary-card {
                        border-radius: 8px; color: white; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                        overflow: hidden; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .summary-card:hover { transform: translateY(-3px); box-shadow: 0 6px 10px rgba(0,0,0,0.4); }
                    .summary-header { padding: 12px 20px; font-weight: 700; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
                    .summary-date { font-size: 0.7rem; font-weight: 400; opacity: 0.8; text-transform: none; }
                    .summary-body { padding: 20px; background-color: rgba(0,0,0,0.2); }
                    .stat-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.95rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
                    .stat-row:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
                    @media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
                    @media (max-width: 992px) { .main-grid { grid-template-columns: 1fr; } }
                    @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr; } }
                    .card-title-text { color: #6c757d; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
                    .card-value-text { font-size: 2rem; font-weight: 700; margin: 0; line-height: 1.2; color: var(--text-color); }
                    .card-icon-wrapper { background-color: var(--border-color); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; margin-top: 10px; }
                `}
            </style>
            
            {/* Top Stats Row */}
            <div className="stats-grid">
                {statCards.map((card, idx) => (
                    <div 
                        key={idx} 
                        className="dashboard-card" 
                        style={{ borderLeftColor: card.accentColor }}
                        onClick={() => setExpandedModal({ ...card, type: card.type || 'default', data: card.data || [] })}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div className="card-title-text" style={{ marginBottom: 0 }}>{card.title}</div>
                            <div className="card-icon-wrapper" style={{ color: card.accentColor, marginTop: 0 }}>
                                <i className={`bi ${card.icon}`} style={{ fontSize: '1.4rem' }}></i>
                            </div>
                        </div>
                        <div>
                            {card.customContent ? card.customContent : (
                                <h2 className="card-value-text">{card.value}</h2>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="main-grid">
                {/* Left Column - Chart */}
                <div>
                    <div className="chart-container">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h5 className="fw-bold text-white mb-0">Transaction Analysis</h5>
                            <div className="btn-group" role="group">
                                <button 
                                    type="button" 
                                    className={`btn btn-sm ${timeFilter === '7d' ? 'btn-primary' : 'btn-outline-light'}`} 
                                    onClick={() => setTimeFilter('7d')}
                                    style={{ padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                                >
                                    Last 7 Days
                                </button>
                                <button 
                                    type="button" 
                                    className={`btn btn-sm ${timeFilter === '30d' ? 'btn-primary' : 'btn-outline-light'}`} 
                                    onClick={() => setTimeFilter('30d')}
                                    style={{ padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                                >
                                    Last 30 Days
                                </button>
                                <button 
                                    type="button" 
                                    className={`btn btn-sm ${timeFilter === 'all' ? 'btn-primary' : 'btn-outline-light'}`} 
                                    onClick={() => setTimeFilter('all')}
                                    style={{ padding: '4px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                                >
                                    All Time
                                </button>
                            </div>
                        </div>
                        <div style={{ height: 400 }}>
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                    </div>
                </div>

                {/* Right Column - Activity Stats */}
                <div>
                    <div className="d-flex flex-column h-100 gap-3">
                        {/* Total Activity */}
                        <div 
                            className="summary-card" 
                            style={{ backgroundColor: '#6f42c1' }}
                            onClick={() => setExpandedModal({ 
                                title: 'Total Activity', value: aggregates.total.count, icon: 'bi-list-check', 
                                accentColor: '#6f42c1', data: transactionsData, type: 'transactions' 
                            })}
                        >
                            <div className="summary-header" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}>Total Activity</div>
                            <div className="summary-body">
                                <div className="stat-row"><span>Transactions</span> <span className="fw-bold">{aggregates.total.count}</span></div>
                                <div className="stat-row"><span>Volume</span> <span className="fw-bold">{aggregates.total.vol.toFixed(1)} L</span></div>
                                <div className="stat-row"><span>Amount</span> <span className="fw-bold">₹{aggregates.total.amt.toLocaleString()}</span></div>
                            </div>
                        </div>

                        {/* Last 7 Days */}
                        <div 
                            className="summary-card" 
                            style={{ backgroundColor: '#198754' }}
                            onClick={() => setExpandedModal({ 
                                title: 'Last 7 Days', subTitle: `Since ${getSinceDate(7)}`, value: aggregates.d7.count, 
                                icon: 'bi-calendar-week', accentColor: '#198754', data: stats7d, type: 'transactions' 
                            })}
                        >
                            <div className="summary-header" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}>
                                <span>Last 7 Days</span>
                                <span className="summary-date">Since {getSinceDate(7)}</span>
                            </div>
                            <div className="summary-body">
                                <div className="stat-row"><span>Transactions</span> <span className="fw-bold">{aggregates.d7.count}</span></div>
                                <div className="stat-row"><span>Volume</span> <span className="fw-bold">{aggregates.d7.vol.toFixed(1)} L</span></div>
                                <div className="stat-row"><span>Amount</span> <span className="fw-bold">₹{aggregates.d7.amt.toLocaleString()}</span></div>
                            </div>
                        </div>

                        {/* Last 30 Days */}
                        <div 
                            className="summary-card" 
                            style={{ backgroundColor: '#0dcaf0', color: '#000' }}
                            onClick={() => setExpandedModal({ 
                                title: 'Last 30 Days', subTitle: `Since ${getSinceDate(30)}`, value: aggregates.d30.count, 
                                icon: 'bi-calendar-month', accentColor: '#0dcaf0', data: stats30d, type: 'transactions' 
                            })}
                        >
                            <div className="summary-header" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
                                <span>Last 30 Days</span>
                                <span className="summary-date" style={{ color: '#000', opacity: 0.6 }}>Since {getSinceDate(30)}</span>
                            </div>
                            <div className="summary-body" style={{ color: '#000', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                <div className="stat-row"><span>Transactions</span> <span className="fw-bold">{aggregates.d30.count}</span></div>
                                <div className="stat-row"><span>Volume</span> <span className="fw-bold">{aggregates.d30.vol.toFixed(1)} L</span></div>
                                <div className="stat-row"><span>Amount</span> <span className="fw-bold">₹{aggregates.d30.amt.toLocaleString()}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Modal */}
            {expandedModal && (
                <div className="ssa-modal-overlay" onClick={() => setExpandedModal(null)}>
                    <div className="ssa-modal ssa-modal-lg" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', color: '#000' }}>
                        <div className="ssa-modal-header" style={{ borderBottom: '1px solid #dee2e6' }}>
                            <h5 style={{ margin: 0, color: '#000', display: 'flex', alignItems: 'center' }}>
                                <i className={`bi ${expandedModal.icon} me-2`} style={{ color: expandedModal.accentColor }}></i>
                                {expandedModal.title}
                                {expandedModal.subTitle && <span style={{ fontSize: '0.8rem', marginLeft: '12px', color: '#6c757d', fontWeight: 400 }}>{expandedModal.subTitle}</span>}
                            </h5>
                            <button className="close-btn" onClick={() => setExpandedModal(null)} style={{ color: '#000' }}>&times;</button>
                        </div>
                        <div className="ssa-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {renderModalContent(expandedModal)}
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default Dashboard;
