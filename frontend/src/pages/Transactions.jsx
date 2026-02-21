import React, { useEffect, useState, useMemo } from 'react';
import MainLayout from '../components/MainLayout';
import api from '../services/api';
import { showToast } from '../utils/helpers';
import { useStations } from '../hooks/useStations';

const Transactions = () => {
    const { stations } = useStations();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [timeFrom, setTimeFrom] = useState('');
    const [timeTo, setTimeTo] = useState('');
    const [selectedStation, setSelectedStation] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [selectedTxn, setSelectedTxn] = useState(null);

    // Date parser helper
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
        // DDMMYY
        if (/^\d{6}$/.test(s)) {
            return new Date(2000 + parseInt(s.slice(4, 6)), parseInt(s.slice(2, 4)) - 1, parseInt(s.slice(0, 2)));
        }
        // DDMMYYYY
        if (/^\d{8}$/.test(s)) {
            return new Date(parseInt(s.slice(4, 8)), parseInt(s.slice(2, 4)) - 1, parseInt(s.slice(0, 2)));
        }
        return new Date(s);
    };

    const resetFilters = () => {
        setSearch('');
        setDateFrom('');
        setDateTo('');
        setTimeFrom('');
        setTimeTo('');
        setSelectedStation('');
        setSelectedType('');
        setCurrentPage(1);
    };

    const filtered = useMemo(() => {
        let result = [...transactions];
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                (t.trnsid || '').toLowerCase().includes(q) ||
                (t.devID || '').toLowerCase().includes(q) ||
                (t.stnID || t.station_id || '').toLowerCase().includes(q) ||
                (t.trnamt || '').toString().includes(q)
            );
        }
        if (selectedStation) result = result.filter(t => (t.stnID || t.station_id) === selectedStation);
        if (selectedType) result = result.filter(t => t.type === selectedType);
        
        // Date Filtering
        if (dateFrom) {
            const fromD = new Date(dateFrom); fromD.setHours(0,0,0,0);
            result = result.filter(t => {
                const d = parseDate(t.todate);
                return d && d >= fromD;
            });
        }
        if (dateTo) {
            const toD = new Date(dateTo); toD.setHours(23,59,59,999);
            result = result.filter(t => {
                const d = parseDate(t.todate);
                return d && d <= toD;
            });
        }

        // Time Filtering
        if (timeFrom) result = result.filter(t => (t.totime || '00:00') >= timeFrom);
        if (timeTo) {
            const tTo = timeTo.length === 5 ? timeTo + ':59' : timeTo;
            result = result.filter(t => (t.totime || '23:59') <= tTo);
        }

        return result;
    }, [search, transactions, selectedStation, selectedType, dateFrom, dateTo, timeFrom, timeTo]);

    useEffect(() => { fetchTransactions(); }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/iot/transactions/');
            setTransactions(Array.isArray(res.data.data) ? res.data.data : Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch transactions', err);
            showToast('Failed to load transaction data', 'error');
        } finally { setLoading(false); }
    };

    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const paginated = useMemo(() => {
        return filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    }, [filtered, currentPage, rowsPerPage]);

    return (
        <MainLayout>
            <div className="page-header">
                <h2><i className="bi bi-currency-dollar me-2"></i>Transactions</h2>
            </div>

            {/* Filters matching Reports Page UI */}
            <div className="filter-bar" style={{ gap: '10px 20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="ssa-search-bar" style={{ minWidth: 200, flex: '1 1 200px' }}>
                    <i className="bi bi-search"></i>
                    <input placeholder="Search Txn ID, Device..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
                </div>

                <div className="filter-group">
                    <span className="filter-label">Station:</span>
                    <select value={selectedStation} onChange={e => setSelectedStation(e.target.value)}>
                        <option value="">All Stations</option>
                        {stations.map(s => <option key={s.id || s.station_id} value={s.station_id}>{s.station_name || s.name}</option>)}
                    </select>
                </div>

                <div className="filter-group">
                    <span className="filter-label">Type:</span>
                    <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                        <option value="">All Types</option>
                        <option value="bowser">Bowser</option>
                        <option value="stationary">Stationary</option>
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

                <button className="btn-ssa-outline btn-ssa-sm" onClick={fetchTransactions} title="Refresh Data"><i className="bi bi-arrow-clockwise"></i></button>
                <button className="btn-ssa-outline btn-ssa-sm" onClick={resetFilters} title="Clear Filters" style={{ borderColor: '#dc3545', color: '#dc3545' }}><i className="bi bi-x-lg"></i></button>
            </div>

            <div className="ssa-table-container">
                {loading ? (
                    <div className="ssa-loading"><div className="spinner-lg"></div> Loading transactions...</div>
                ) : (
                    <>
                        <div className="table-responsive">
  <table className="ssa-table">
    {/* ===================== */}
    {/* ✅ UPDATED TABLE HEAD */}
    {/* ===================== */}
    <thead>
      <tr>
        <th>S.No</th>
        <th>Transaction ID</th>
        <th>Device ID</th>
        <th>Station ID</th>
        <th>Disp ID</th>
        <th>Type</th>
        <th>Pump</th>
        <th>Date & Time</th>
        <th>Volume (Ltr)</th>
        <th>Amount (₹)</th>
        <th>Total Vol</th>
        <th>Total Amt</th>
        <th>Attender</th>
        <th>Vehicle</th>
        <th>Mobile No.</th>
        <th>BARNUM</th>
        <th>Status</th>
        <th style={{ textAlign: "center" }}>Receipt</th>
      </tr>
    </thead>

    {/* ===================== */}
    {/* ✅ UPDATED TABLE BODY */}
    {/* ===================== */}
    <tbody>
      {paginated.length === 0 ? (
        <tr>
          <td colSpan="17" style={{ textAlign: "center", padding: 30 }}>
            No transactions found
          </td>
        </tr>
      ) : (
        paginated.map((t, idx) => {
          // ✅ Detect transaction type + nested data
          const getStatusBadge = (status) => {
              const s = (status || '').toUpperCase();
              if (s === 'IDLE') return 'bg-success';
              if (s.includes('FILL') || s.includes('FUELLING')) return 'bg-primary';
              if (s.includes('AUTH') || s.includes('CALL')) return 'bg-primary';
              if (s.includes('OFFLINE')) return 'bg-danger';
              return 'bg-warning text-dark';
          };

          const details = t.bowser
            ? t.bowser
            : t.tank
            ? t.tank
            : t.stationary
            ? t.stationary
            : {};

          const typeLabel = t.bowser
            ? "Bowser"
            : t.tank
            ? "Tank"
            : t.stationary
            ? "Stationary"
            : "N/A";

          return (
            <tr
              key={t.trnsid || idx}
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedTxn(t)}
            >
              {/* S.No */}
              <td>{(currentPage - 1) * rowsPerPage + idx + 1}</td>

              {/* Transaction ID */}
              <td style={{ fontWeight: 600 }}>
                {t.trnsid || "--"}
              </td>

              {/* Device ID */}
              <td>
                <code>{t.devID || "--"}</code>
              </td>

              {/* Station ID */}
              <td>
                  {t.stnID || t.station_id || stations.find(s => s.station_id === t.devID)?.station_id || "--"}
              </td>

              {/* Disp ID */}
              <td>{t.bwsrid || t.tankid || "--"}</td>

              {/* Type */}
              <td>
                <span className="badge bg-primary">{t.type}</span>
              </td>

              {/* Pump */}
              <td>{t.pumpid || "--"}</td>

              {/* Date & Time */}
              <td>
                {t.todate || "--"} {t.totime || "--"}
              </td>

              {/* Volume */}
              <td style={{ fontWeight: 700, color: "#007bff" }}>
                {parseFloat(t.trnvol || 0).toFixed(2)}
              </td>

              {/* Amount */}
              <td>
                ₹{parseFloat(t.trnamt || 0).toFixed(2)}
              </td>

              {/* Total Volume */}
              <td>{t.totvol || "--"}</td>

              {/* Total Amount */}
              <td>₹{t.totamt || "--"}</td>

              {/* Attender */}
              <td>{t.attender || "--"}</td>

              {/* Vehicle */}
              <td>{t.vehnum || "--"}</td>

              {/* Mobile No. */}
              <td>{t.mobnum || "--"}</td>

              {/* Barcode */}
              <td>{t.barnum || "N/A"}</td>

              {/* Status */}
              <td>
                <span className={`badge ${getStatusBadge(t.pmpsts)}`}>
                  {t.pmpsts || "N/A"}
                </span>
              </td>

              {/* Receipt */}
              <td style={{ textAlign: "center" }}>
                <button
                  className="btn-ssa-outline btn-ssa-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTxn(t);
                  }}
                >
                  <i className="bi bi-printer"></i>
                </button>
              </td>
            </tr>
          );
        })
      )}
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
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                                <div className="page-info">Page {currentPage} of {totalPages}</div>
                                <div className="page-controls">
                                    <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                                        <i className="bi bi-chevron-left"></i>
                                    </button>
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let page = i + 1;
                                        if (totalPages > 5 && currentPage > 3) page = currentPage - 2 + i;
                                        if (page > totalPages) return null;
                                        return <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>;
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

            {/* Transaction Detail Modal (Receipt Look) */}
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
                                <div style={{ marginTop: 15, fontWeight: 700, fontSize: '1.1rem' }}>TRANSACTION RECEIPT</div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>ID: {selectedTxn.trnsid}</div>
                            </div>

                            <hr style={{ borderStyle: 'dashed', margin: '20px 0' }} />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
                                {[
                                    ['Date', selectedTxn.todate],
                                    ['Time', selectedTxn.totime],
                                    ['Device ID', selectedTxn.devID],
                                    ['Device Type', selectedTxn.type || 'N/A'],
                                    ['Pump / Slot', selectedTxn.pumpid || '01'],
                                    ['Vehicle #', selectedTxn.vehnum || 'N/A'],
                                    ['Attender', selectedTxn.attender || 'N/A'],
                                    ['Location', (stations.find(s => s.station_id === selectedTxn.devID)?.location) || 'N/A'],
                                    ['Avg Temp', (selectedTxn.temp || '24.5') + ' °C'],
                                    ['BARNUM', selectedTxn.barnum || 'N/A'],
                                ].map(([label, value], i) => (
                                    <div key={i}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>{label}</div>
                                        <div style={{ fontWeight: 700 }}>{value}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{
                                margin: '30px 0',
                                padding: '20px',
                                background: '#f8f9fa',
                                borderRadius: '12px',
                                textAlign: 'center',
                                border: '1px solid #eee'
                            }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#666' }}>TOTAL DISPENSED</div>
                                <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#007bff' }}>{parseFloat(selectedTxn.trnvol || 0).toFixed(2)} <span style={{ fontSize: '1.2rem' }}>L</span></div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#333', marginTop: 5 }}>₹ {parseFloat(selectedTxn.trnamt || 0).toFixed(2)}</div>
                            </div>

                            <div style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.6, marginTop: 40 }}>
                                This is a computer generated receipt.
                            </div>
                        </div>
                        <div className="ssa-modal-footer no-print">
                            <button className="btn-ssa-secondary" onClick={() => setSelectedTxn(null)}>Close</button>
                            <button className="btn-ssa-primary" onClick={() => window.print()}>
                                <i className="bi bi-printer-fill me-2"></i>Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default Transactions;
