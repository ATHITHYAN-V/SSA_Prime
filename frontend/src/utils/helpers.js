import Swal from 'sweetalert2';

// ==========================================
// STATUS BADGE CLASS
// ==========================================
export function getStatusBadgeClass(status) {
    if (!status || status === 'null') return 'bg-secondary';
    const s = String(status).toUpperCase();
    if (['IDLE', 'CALL', 'ACTIVE', 'ONLINE', 'MONITORING', 'SUCCESS'].includes(s)) return 'bg-success';
    if (['AUTHORIZED', 'BUSY', 'MAINTENANCE'].includes(s)) return 'bg-warning text-dark';
    if (['EVENT', 'SEND DATA'].includes(s)) return 'bg-info text-dark';
    if (['DATA ERROR', 'DISABLED', 'ERROR'].includes(s)) return 'bg-danger';
    return 'bg-secondary';
}

// ==========================================
// DATE FORMATTING
// ==========================================
export function formatSSADate(rawStr) {
    if (!rawStr || rawStr === 'null' || rawStr === 'undefined') return 'N/A';

    try {
        const dateObj = new Date(rawStr);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleString('en-GB', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).replace(',', '');
        }
    } catch (e) { /* fallback */ }

    // Fallback for custom 12-digit format (yymmddhhmm)
    const str = String(rawStr).replace(/\s+/g, '');
    if (str.length === 12) {
        const yy = str.substring(0, 2), mm = str.substring(2, 4), dd = str.substring(4, 6);
        const hh = str.substring(6, 8), min = str.substring(8, 10);
        return `${dd}-${mm}-20${yy} ${hh}:${min}`;
    }
    return rawStr;
}

export function parseBackendDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    try {
        const d = String(dateStr).trim();
        const t = String(timeStr).trim();
        if (d.length === 6 && t.length === 6) {
            const yy = d.substring(0, 2), mm = d.substring(2, 4), dd = d.substring(4, 6);
            const hh = t.substring(0, 2), min = t.substring(2, 4), ss = t.substring(4, 6);
            return new Date(`20${yy}-${mm}-${dd}T${hh}:${min}:${ss}`);
        }
        return new Date(`${d} ${t}`);
    } catch { return null; }
}

// ==========================================
// SWEETALERT2 WRAPPERS
// ==========================================
export function showToast(title, icon = 'success') {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.onmouseenter = Swal.stopTimer;
            toast.onmouseleave = Swal.resumeTimer;
        }
    });
    Toast.fire({ icon, title });
}

export async function showConfirm(title, text, confirmButtonText = 'Yes, do it!') {
    const result = await Swal.fire({
        title, text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText
    });
    return result.isConfirmed;
}

export function showSuccess(title, text) {
    return Swal.fire({
        icon: 'success', title, text,
        timer: 1500, showConfirmButton: false
    });
}

export function showError(title, text) {
    return Swal.fire({
        icon: 'error', title, text,
        confirmButtonColor: '#003366'
    });
}
