import React, { useEffect, useState, useMemo } from 'react';
import MainLayout from '../components/MainLayout';
import api from '../services/api';
import { showToast } from '../utils/helpers';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStations } from '../hooks/useStations';
import ssaLogo from '../assets/ssa_logo.png';

const Reports = () => {
    const { stations } = useStations();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStation, setSelectedStation] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [timeFrom, setTimeFrom] = useState('00:00');
    const [timeTo, setTimeTo] = useState('23:59');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [showExport, setShowExport] = useState(false);
    const [exportCols, setExportCols] = useState({
        trnsid: true, devID: true, stationId: true, bowserId: true, type: true, pumpId: true,
        todate: true, totime: true, trnvol: true, trnamt: true,
        totalVol: true, totalAmt: true, attender: true, vehicle: true, 
        mobnum: true, barnum: true, status: true
    });
    const [showEmail, setShowEmail] = useState(false);
    const [emailAddr, setEmailAddr] = useState('');

    useEffect(() => { fetchData(); }, []);

    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const s = String(dateStr).trim();
        // YYYY-MM-DD
        if (s.includes('-') && s.indexOf('-') === 4) return new Date(s);
        // DD-MM-YYYY
        if (s.includes('-') && s.indexOf('-') === 2) {
             const [d, m, y] = s.split('-');
             return new Date(y, m - 1, d);
        }
        // DD/MM/YYYY
        if (s.includes('/')) {
            const [d, m, y] = s.split('/');
            return new Date(y, m - 1, d);
        }
        return new Date(s);
    };

    const formatDateForInput = (date) => {
        if (!date || isNaN(date)) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const filtered = useMemo(() => {
        let result = [...transactions];
        
        // 1. Station Filter
        if (selectedStation) {
            result = result.filter(t => (t.stnID || t.station_id) === selectedStation);
        }

        // 2. Date Filter
        if (dateFrom) {
            const dFrom = new Date(dateFrom);
            dFrom.setHours(0,0,0,0);
            result = result.filter(t => {
                const d = parseDate(t.todate);
                return d && d >= dFrom;
            });
        }
        if (dateTo) {
            const dTo = new Date(dateTo);
            dTo.setHours(23,59,59,999);
            result = result.filter(t => {
                const d = parseDate(t.todate);
                return d && d <= dTo;
            });
        }

        // 3. Time Filter
        if (timeFrom) {
            result = result.filter(t => (t.totime || '00:00') >= timeFrom);
        }
        if (timeTo) {
            const tTo = timeTo.length === 5 ? timeTo + ':59' : timeTo;
            result = result.filter(t => (t.totime || '23:59') <= tTo);
        }

        return result;
    }, [selectedStation, transactions, dateFrom, dateTo, timeFrom, timeTo]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const txnRes = await api.get('/iot/transactions/');
            const txns = txnRes.data.data || txnRes.data || [];
            const safeTxns = Array.isArray(txns) ? txns : [];
            setTransactions(safeTxns);
        } catch (err) {
            console.error('Reports fetch error', err);
        } finally { setLoading(false); }
    };

    const downloadCSV = () => {
        const activeCols = Object.entries(exportCols).filter(([, v]) => v).map(([k]) => k);
        const headers = activeCols.join(',');
        const rows = filtered.map(t => activeCols.map(c => `"${t[c] || ''}"`).join(',')).join('\n');
        const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        showToast('CSV Downloaded!', 'success');
        setShowExport(false);
    };

    const resetFilters = () => {
        setSelectedStation('');
        setDateFrom('');
        setDateTo('');
        setTimeFrom('00:00');
        setTimeTo('23:59');
        setCurrentPage(1);
    };

    const downloadPDF = async () => {
        try {
            const doc = new jsPDF("l", "mm", "a4"); // Landscape A4
            let startY = 25;

            // ============================================================
            // ✅ LOGO LOAD FUNCTION
            // ============================================================
            const loadImage = (src) =>
            new Promise((resolve, reject) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = (err) => reject(err);
            });

            // ============================================================
            // ✅ ADD LOGO
            // ============================================================
            try {
                const img = await loadImage(ssaLogo);
                const imgWidth = 35;
                const imgHeight = 15;
                doc.addImage(img, "PNG", 14, 10, imgWidth, imgHeight);
                startY = 30;
            } catch (error) {
                console.warn("Logo not loaded:", error);
                startY = 25;
            }
            
            doc.setFontSize(18);
            doc.setTextColor(0, 51, 102);
            doc.text('SSA AUTOMATION - TRANSACTION REPORT', 80, 18);

            doc.setFontSize(10);
            doc.setTextColor(80);

            // Determine Date Range Strings
            let displayDateFrom = dateFrom;
            let displayDateTo = dateTo;

            if (!displayDateFrom && filtered.length > 0) {
                 // Find earliest date in filtered data
                 const sortedDates = filtered
                    .map(t => parseDate(t.todate))
                    .filter(d => d) // remove nulls
                    .sort((a,b) => a - b);
                 
                 if (sortedDates.length > 0) {
                     displayDateFrom = formatDateForInput(sortedDates[0]);
                 }
            }
            if (!displayDateTo) {
                displayDateTo = formatDateForInput(new Date()); // Today
            }

            // Helper to format date as DD-MM-YYYY
            const formatDateDDMMYYYY = (val) => {
                if (!val) return "--";
                // If it's already DD-MM-YYYY or DD/MM/YYYY, ensure dashes
                if (typeof val === 'string') {
                    if (val.includes('T')) val = val.split('T')[0]; // Handle ISO
                    // Replace slashes with dashes
                    if (val.includes('/')) return val.replace(/\//g, '-');
                    if (val.includes('-')) {
                        // Check if it is YYYY-MM-DD
                        const parts = val.split('-');
                        if (parts[0].length === 4) {
                            return `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }
                    }
                    return val;
                }
                // If it's a Date object
                if (val instanceof Date && !isNaN(val)) {
                    const d = String(val.getDate()).padStart(2, '0');
                    const m = String(val.getMonth() + 1).padStart(2, '0');
                    const y = val.getFullYear();
                    return `${d}-${m}-${y}`;
                }
                return String(val);
            };

            // Format Date Range for Header
            let headerDateFrom = displayDateFrom;
            let headerDateTo = displayDateTo;
            
            // Convert YYYY-MM-DD inputs to DD-MM-YYYY for display
            if (headerDateFrom && headerDateFrom.includes('-')) {
                const parts = headerDateFrom.split('-');
                if (parts[0].length === 4) headerDateFrom = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            if (headerDateTo && headerDateTo.includes('-')) {
                const parts = headerDateTo.split('-');
                if (parts[0].length === 4) headerDateTo = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            const dateRangeStr = `Date Range: ${headerDateFrom || 'Start'} to ${headerDateTo || 'End'} | Time: ${timeFrom} - ${timeTo}`;
            doc.text(dateRangeStr, 14, startY);

            const summaryStr = `Total Records: ${filtered.length} | Total Volume: ${totalVol.toFixed(2)} Ltr | Total Amount: Rs. ${totalAmt.toFixed(2)}`;
            doc.text(summaryStr, 14, startY + 6);

            // ============================================================
            // ✅ TABLE HEADERS & ROWS (Dynamic based on exportCols)
            // ============================================================
            
            // Define Column Config: Key -> { Header, Data access/formatting, Width/Style }
            const colConfig = {
                trnsid:    { header: "Txn ID", width: 22 },
                devID:     { header: "Dev ID", width: 17 },
                stationId: { header: "Stn ID", width: 15, accessor: t => t.stnID || t.station_id || stations.find(s => s.station_id === t.devID)?.station_id || "--" },
                bowserId:  { header: "Bwsr", width: 15, accessor: t => t.bwsrid || t.tankid || "--" },
                type:      { header: "Type", width: 12 },
                pumpId:    { header: "Pmp", width: 10, accessor: t => t.pumpid || t.pump || "P01" },
                todate:    { header: "Date", width: 18, accessor: t => formatDateDDMMYYYY(t.todate) },
                totime:    { header: "Time", width: 12 },
                trnvol:    { header: "Vol", width: 15, align: "right", accessor: t => parseFloat(t.trnvol || 0).toFixed(2) },
                trnamt:    { header: "Amt", width: 15, align: "right", accessor: t => parseFloat(t.trnamt || 0).toFixed(2) },
                totalVol:  { header: "T.Vol", width: 18, align: "right", accessor: t => parseFloat(t.totvol || 0).toFixed(2) },
                totalAmt:  { header: "T.Amt", width: 18, align: "right", accessor: t => parseFloat(t.totamt || 0).toFixed(2) },
                attender:  { header: "Attn", width: 15, accessor: t => t.attender || "-" },
                vehicle:   { header: "Veh", width: 15, accessor: t => t.vehicle || "-" },
                mobnum:    { header: "Mob", width: 18, accessor: t => t.mobnum || "--" },
                barnum:    { header: "Barnum", width: 18, accessor: t => t.barnum || "--" },
                status:    { header: "Stat", width: 15, align: "center", accessor: t => t.pmpsts || "-" }
            };

            // 1. Get Active Columns (S.No always included first)
            const activeKeys = Object.keys(exportCols).filter(k => exportCols[k]);
            const headers = ["S.No", ...activeKeys.map(k => colConfig[k]?.header || k)];

            // 2. Generate Rows
            const tableRows = filtered.map((t, index) => {
                const rowData = [index + 1]; // S.No
                activeKeys.forEach(k => {
                    const config = colConfig[k];
                    let val = t[k]; // Default access
                    if (config && config.accessor) {
                         val = config.accessor(t);
                    } else if (val === undefined || val === null) {
                        val = "--";
                    }
                    rowData.push(val);
                });
                return rowData;
            });

            // 3. Generate Column Styles dynamic
            const dynamicColStyles = {
                0: { halign: "center", cellWidth: 10 } // S.No style
            };
            activeKeys.forEach((k, idx) => {
                const config = colConfig[k];
                if (config) {
                    // +1 because index 0 is S.No
                    dynamicColStyles[idx + 1] = { 
                        halign: config.align || "left",
                        cellWidth: config.width || "auto" 
                    };
                }
            });
            // ============================================================
            // ✅ AUTO TABLE GENERATION
            // ============================================================
            const autoTableFn = autoTable.default || autoTable;
            if (typeof autoTableFn === 'function') {
                autoTableFn(doc, {
                    startY: startY + 15,
                    head: [headers],
                    body: tableRows,
                    theme: "striped",
                    headStyles: {
                        fillColor: [0, 51, 102],
                        textColor: 255,
                        fontSize: 8, // Slightly larger header
                        halign: "center",
                        valign: "middle",
                    },
                    styles: {
                        fontSize: 7,
                        cellPadding: 2,
                        valign: "middle",
                        overflow: 'linebreak'
                    },
                    columnStyles: dynamicColStyles,
                    alternateRowStyles: { fillColor: [240, 248, 255] },
                    margin: { top: 20 },
                    
                    // 🔥 Highlight Logic
                    didParseCell: function (data) {
                        // Headers are section 'head'
                        if (data.section === 'head') return;

                        // Identify Column Index (S.No is 0)
                        // barnum and status depend on activeKeys order
                        const barnumIdx = activeKeys.indexOf('barnum');
                        const statusIdx = activeKeys.indexOf('status');

                        // +1 offset for S.No
                        const colIdx = data.column.index - 1;

                        // BARNUM Highlight
                        if (barnumIdx !== -1 && colIdx === barnumIdx) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.textColor = [0, 51, 102]; // Dark Blue
                        }

                        // STATUS Highlight
                        if (statusIdx !== -1 && colIdx === statusIdx) {
                            data.cell.styles.fontStyle = 'bold';
                            const text = (data.cell.raw || '').toString().toUpperCase();

                            if (text.includes('FILL') || text.includes('FUELLING')) {
                                data.cell.styles.textColor = [25, 135, 84]; // Success Green
                            } else if (text.includes('OFFLINE') || text === 'N/A') {
                                data.cell.styles.textColor = [220, 53, 69]; // Danger Red
                            } else if (text === 'IDLE') {
                                data.cell.styles.textColor = [108, 117, 125]; // Secondary Grey
                            } else {
                                data.cell.styles.textColor = [255, 193, 7]; // Warning Yellow/Orange (default)
                                if(text.includes('AUTH')) data.cell.styles.textColor = [13, 110, 253]; // Primary Blue
                            }
                        }
                    },

                    didDrawPage: function (data) {
                        const pageCount = doc.internal.getNumberOfPages();
                        doc.setFontSize(8);
                        doc.setTextColor(120);
                        doc.text(
                            `Page ${pageCount}`,
                            doc.internal.pageSize.width - 20,
                            doc.internal.pageSize.height - 10
                        );
                    },
                });

                const fileName = `SSA_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
                doc.save(fileName);
                showToast("PDF Downloaded Successfully!", "success");
            } else {
                 console.error("autoTable is not a function:", autoTable);
                 showToast("PDF Error: autoTable library failed to load", 'error');
            }
            setShowExport(false);

        } catch (err) {
            console.error("PDF Export Error:", err);
            showToast(`Failed to download PDF: ${err.message}`, 'error');
        }
    };

    const sendEmail = async () => {
        if (!emailAddr) { showToast('Please enter an email', 'error'); return; }
        showToast('Email report feature coming soon', 'info');
        setShowEmail(false);
    };

    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const paginated = useMemo(() => {
        return filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    }, [filtered, currentPage, rowsPerPage]);

    const totalVol = useMemo(() => filtered.reduce((a, t) => a + (parseFloat(t.trnvol) || 0), 0), [filtered]);
    const totalAmt = useMemo(() => filtered.reduce((a, t) => a + (parseFloat(t.trnamt) || 0), 0), [filtered]);

    const getStatusBadge = (status) => {
        const s = (status || '').toUpperCase();
        if (s === 'IDLE') return 'bg-secondary';
        if (s.includes('FILL') || s.includes('FUELLING')) return 'bg-success';
        if (s.includes('AUTH') || s.includes('CALL')) return 'bg-primary';
        if (s.includes('OFFLINE')) return 'bg-danger';
        return 'bg-warning text-dark';
    };

    return (
        <MainLayout>
            <div className="page-header">
                <h2><i className="bi bi-file-earmark-bar-graph me-2"></i>Reports</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-ssa-success" onClick={() => setShowExport(true)}>
                        <i className="bi bi-download me-1"></i>Export
                    </button>
                    <button className="btn-ssa-primary" onClick={() => setShowEmail(true)}>
                        <i className="bi bi-envelope me-1"></i>Email Report
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div className="ssa-card card-border-primary">
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.6 }}>Total Records</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{filtered.length}</div>
                    </div>
                </div>
                <div className="ssa-card card-border-info">
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.6 }}>Total Volume</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{totalVol.toFixed(2)} L</div>
                    </div>
                </div>
                <div className="ssa-card card-border-warning">
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, opacity: 0.6 }}>Total Amount</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>₹{totalAmt.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-bar" style={{ gap: '10px 20px' }}>
                <div className="filter-group">
                    <span className="filter-label">Station:</span>
                    <select value={selectedStation} onChange={e => { setSelectedStation(e.target.value); setCurrentPage(1); }}>
                        <option value="">All Stations</option>
                        {stations.map(s => <option key={s.station_id} value={s.station_id}>{s.station_name}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <span className="filter-label">From Date:</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="filter-group">
                    <span className="filter-label">To Date:</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                <div className="filter-group">
                    <span className="filter-label">From Time:</span>
                    <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} />
                </div>
                <div className="filter-group">
                    <span className="filter-label">To Time:</span>
                    <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} />
                </div>
                <button className="btn-ssa-outline btn-ssa-sm" onClick={fetchData} title="Refresh Data"><i className="bi bi-arrow-clockwise"></i></button>
                <button className="btn-ssa-outline btn-ssa-sm" onClick={resetFilters} title="Clear Filters" style={{ borderColor: '#dc3545', color: '#dc3545' }}><i className="bi bi-x-lg"></i></button>
            </div>

            <div className="ssa-table-container">
                {loading ? (
                    <div className="ssa-loading"><div className="spinner-lg"></div> Loading report data...</div>
                ) : (
                    <>
                        <div className="table-responsive">
                            <table className="ssa-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Txn ID</th>
                                        <th>Device ID</th>
                                        <th>Station ID</th>
                                        <th>Disp ID</th>
                                        <th>Type</th>
                                        <th>Pump</th>
                                        <th>Date & Time</th>
                                        <th>Vol (L)</th>
                                        <th>Amt (₹)</th>
                                        <th>Total Vol</th>
                                        <th>Total Amt</th>
                                        <th>Attender</th>
                                        <th>Vehicle</th>
                                        <th>Mobile No.</th>
                                        <th>BARNUM</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.length === 0 ? (
                                        <tr><td colSpan="16" style={{ textAlign: "center", padding: 30 }}>No data found</td></tr>
                                    ) : (
                                        paginated.map((t, i) => (
                                            <tr key={t.trnsid || i}>
                                                <td>{(currentPage - 1) * rowsPerPage + i + 1}</td>
                                                <td style={{ fontWeight: 600 }}>{t.trnsid || "--"}</td>
                                                <td><code>{t.devID || "--"}</code></td>
                                                <td>{t.stnID || t.station_id || stations.find(s => s.station_id === t.devID)?.station_id || "--"}</td>
                                                <td>{t.bwsrid || t.tankid || "--"}</td>
                                                <td><span className={`badge ${t.type === "bowser" ? "bg-success" : t.type === "stationary" ? "bg-info" : "bg-warning text-dark"}`}>{t.type}</span></td>
                                                <td>{t.pumpid || "--"}</td>
                                                <td className="small">{t.todate || "--"} {t.totime || "--"}</td>
                                                <td style={{ fontWeight: 700, color: "#007bff" }}>{parseFloat(t.trnvol || 0).toFixed(2)}</td>
                                                <td>₹{parseFloat(t.trnamt || 0).toFixed(2)}</td>
                                                <td className="text-muted">{parseFloat(t.totvol || 0).toFixed(2)}</td>
                                                <td className="text-muted">₹{parseFloat(t.totamt || 0).toFixed(2)}</td>
                                                <td>{t.attender || "--"}</td>
                                                <td>{t.vehnum || "--"}</td>
                                                <td>{t.mobnum || "--"}</td>
                                                <td>{t.barnum || "--"}</td>
                                                <td><span className={`badge ${getStatusBadge(t.pmpsts)}`}>{t.pmpsts || "N/A"}</span></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {filtered.length > 0 && (
                            <div className="ssa-pagination">
                                <div className="rows-per-page">
                                    <span>Rows:</span>
                                    <select value={rowsPerPage} onChange={e => { setRowsPerPage(+e.target.value); setCurrentPage(1); }}>
                                        <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                                    </select>
                                </div>
                                <div className="page-info">Page {currentPage} of {totalPages}</div>
                                <div className="page-controls">
                                    <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}><i className="bi bi-chevron-left"></i></button>
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let page = i + 1;
                                        if (totalPages > 5 && currentPage > 3) page = currentPage - 2 + i;
                                        if (page > totalPages) return null;
                                        return <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>;
                                    })}
                                    <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><i className="bi bi-chevron-right"></i></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Export Config Modal */}
            {showExport && (
                <div className="ssa-modal-overlay" onClick={() => setShowExport(false)}>
                    <div className="ssa-modal" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className="bi bi-gear me-2"></i>Export Configuration</h5>
                            <button className="close-btn" onClick={() => setShowExport(false)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            <p style={{ fontSize: '0.9rem', marginBottom: 16 }}>Select columns to include:</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {Object.entries(exportCols).map(([key, checked]) => (
                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={checked}
                                            onChange={e => setExportCols({ ...exportCols, [key]: e.target.checked })} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                            {key === 'trnsid' ? 'Transaction ID' :
                                                key === 'devID' ? 'Dispenser ID' :
                                                    key === 'stationId' ? 'Station ID' :
                                                        key === 'bowserId' ? 'Bowser ID' :
                                                            key === 'type' ? 'Type' :
                                                            key === 'pumpId' ? 'Pump ID' :
                                                                key === 'todate' ? 'Date' :
                                                                    key === 'totime' ? 'Time' :
                                                                        key === 'trnvol' ? 'Volume' :
                                                                            key === 'trnamt' ? 'Amount' :
                                                                                key === 'totalVol' ? 'Total Volume' :
                                                                                    key === 'totalAmt' ? 'Total Amount' :
                                                                                        key === 'attender' ? 'Attender' :
                                                                                            key === 'vehicle' ? 'Vehicle' :
                                                                                                key === 'mobnum' ? 'Mobile No.' :
                                                                                                    key === 'barnum' ? 'BARNUM' :
                                                                                                        'Status'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setShowExport(false)}>Cancel</button>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn-ssa-outline" onClick={downloadCSV}><i className="bi bi-file-earmark-spreadsheet me-1"></i>CSV</button>
                                <button className="btn-ssa-success" onClick={downloadPDF}><i className="bi bi-file-earmark-pdf me-1"></i>Download PDF</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Email Modal */}
            {showEmail && (
                <div className="ssa-modal-overlay" onClick={() => setShowEmail(false)}>
                    <div className="ssa-modal" onClick={e => e.stopPropagation()}>
                        <div className="ssa-modal-header">
                            <h5><i className="bi bi-envelope me-2"></i>Email Report</h5>
                            <button className="close-btn" onClick={() => setShowEmail(false)}>&times;</button>
                        </div>
                        <div className="ssa-modal-body">
                            <div className="ssa-form-group">
                                <label className="ssa-form-label">Recipient Email</label>
                                <input className="ssa-form-control" type="email" placeholder="Enter email address"
                                    value={emailAddr} onChange={e => setEmailAddr(e.target.value)} />
                            </div>
                            <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>The report with {filtered.length} records will be sent as a PDF attachment.</p>
                        </div>
                        <div className="ssa-modal-footer">
                            <button className="btn-ssa-secondary" onClick={() => setShowEmail(false)}>Cancel</button>
                            <button className="btn-ssa-primary" onClick={sendEmail}><i className="bi bi-send me-1"></i>Send</button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default Reports;
