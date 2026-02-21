// ==========================================
// GLOBAL CONFIG
// ==========================================
// app.js (FINAL CLEAN VERSION)

// Change line 7 to exactly this:
// At the top of your app.js
const API_BASE_URL = 'http://127.0.0.1:8000'; // Ensure this matches your backend URL
const AUTH_KEY = "ssa123"; // Must match GLOBAL_TZ_KEY in settings.py
const PRODUCT_KEY = "ssa123";
// ==========================================
// GLOBAL STATE
// ==========================================
const DEBUG = false;// ==========================================
// 🔇 PRODUCTION LOG SILENCER
// ==========================================
if (!DEBUG) {
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
}


let reportExportData = [];           // Single source of truth for exports
let currentUser = null;

// --- PAGINATION GLOBALS ---
let currentPage = 1;
let rowsPerPage = 25;

let autoRefreshStarted = false;
let backendAlive = true;

// --- REPORT PAGINATION GLOBALS ---
let currentReportData = [];
let currentReportPage = 1;
let reportRowsPerPage = 50;

// --- TRANSACTIONS ---
let allStationsData = [];
let baseTransactionData = [];
let currentTransactionData = [];
let mainChart = null;

// --- STATION VIEW ---
let stationCurrentPage = 1;
let stationRowsPerPage = 10;
let currentFilteredStations = [];

// --- USERS ---
let mockAdminData = [];
let mockUserData = [];
let allAssignableUsers = [];

// --- SUB-RESOURCES ---
let allBowserData = [];
let allTankData = [];
let allStationaryData = [];
let currentStationId = null;
let globalStationAssignments = {};

// ==========================================
// LOAD USER SESSION
// ==========================================

const storedUser = localStorage.getItem("ssaUser");
if (storedUser) {
    currentUser = JSON.parse(storedUser);
}

// ==========================================
// SIDEBAR (RUNS ON ALL PAGES – SAFE)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebarMenu");
    const toggle = document.getElementById("sidebarToggle");

    if (!sidebar || !toggle) return;

    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        document.body.classList.toggle("sidebar-open");
        document.body.classList.toggle("sidebar-hidden");
    });

    document.addEventListener("click", (e) => {
        const isMobile = window.matchMedia("(max-width: 767.98px)").matches;
        if (
            isMobile &&
            document.body.classList.contains("sidebar-open") &&
            !sidebar.contains(e.target) &&
            !toggle.contains(e.target)
        ) {
            document.body.classList.remove("sidebar-open");
            document.body.classList.remove("sidebar-hidden");
        }
    });
});

// ==========================================
// PAGE INIT (NO HANDSHAKE / NO BLOCKING)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // Safe initialization only
    if (typeof initializeReportPage === "function") {
        initializeReportPage().catch(err => {
            console.error("Init error:", err);
        });
    }
});

// ==========================================
// CREATE STATION DEFAULT STATUS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const statusField = document.getElementById("status");
    if (statusField && !window.location.search.includes('edit=')) {
        statusField.value = "inactive";
    }
});

// ==========================================
// PAGINATION LISTENERS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const rowsPerPageSelect = document.getElementById('rowsPerPage');
    if (rowsPerPageSelect) {
        rowsPerPageSelect.addEventListener('change', function () {
            rowsPerPage = parseInt(this.value);
            currentPage = 1;
            populateFullTransactionTable(currentTransactionData);
        });
    }

    const reportRowsSelect = document.getElementById('reportRowsPerPage');
    if (reportRowsSelect) {
        reportRowsSelect.addEventListener('change', function () {
            reportRowsPerPage = parseInt(this.value);
            currentReportPage = 1;
            window.populateReportTable(currentReportData);
        });
    }
});

// ==========================================
// 🛡️ AUTHENTICATION, HEADERS & DATA FETCHING
// ==========================================

// Helper to get CSRF token from Django cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Updated Header Generator
 * Includes CSRF Token to prevent 403 Forbidden errors
 */
function getAuthHeaders() {
    let user = null;

    try {
        const userStr = localStorage.getItem("ssaUser");
        user = userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        localStorage.removeItem("ssaUser");
    }

    // --- CRITICAL FIX: GRAB THE CSRF TOKEN FROM COOKIES ---
    const csrfToken = getCookie('csrftoken'); 

    const headers = {
        "Content-Type": "application/json",
        "TZ-KEY": AUTH_KEY,
        "PRODUCT-KEY": PRODUCT_KEY,
        "X-CSRFToken": csrfToken // <-- This line stops the 403 error
    };

    if (user && user.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
    }

    return headers;
}

/**
 * Global Data Fetching wrapper
 * Injects security headers and handles URL cleanup for the SSA Project.
 */
async function smartFetch(endpoint, options = {}) {
    const controller = new AbortController();
    // 20-second timeout to prevent UI hanging on slow connections
    const timeoutId = setTimeout(() => controller.abort(), 20000); 

    try {
        // 🛡️ URL CLEANUP: Prevents double slashes or undefined prefixes
        // If the endpoint is already a full URL, use it. Otherwise, build it.
        const cleanEndpoint = endpoint.startsWith('http') 
            ? endpoint 
            : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        console.log(`[Fetching] ${cleanEndpoint}`);

        const fetchOptions = {
            ...options,
            signal: controller.signal,
            headers: {
                ...getAuthHeaders(), // 🔑 Injects Bearer Token and TZ-KEY
                ...(options.headers || {})
            }
        };

        const response = await fetch(cleanEndpoint, fetchOptions);
        clearTimeout(timeoutId);

        // 🛑 403: Middleware handshake or Bearer token rejected
        if (response.status === 403) {
            console.error(`[Security Denied] 403 at ${endpoint}. Handshake keys rejected.`);
            return [];
        }

        // 🛑 401: User session has expired in the backend
        if (response.status === 401) {
            console.warn("Auth Session Expired. Please log in again.");
            return [];
        }

        // 🛑 400: Handled specifically to catch "Invalid role or action"
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error(`Server Error: ${response.status}`, errorBody);
            return [];
        }

        // Handle No Content success
        if (response.status === 204) return { status: 'Success' };

        const json = await response.json();
        
        // --- DATA NORMALIZATION ---
        // Ensures the rest of the app always receives a clean array or object
        if (json.data && Array.isArray(json.data)) return json.data;
        if (Array.isArray(json)) return json;
        return json;

    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.warn(`[Timeout] Request for ${endpoint} cancelled.`);
        } else {
            console.error("Fetch failed:", err);
        }
        return [];
    }
}
// ==========================================
// LOGIN HANDLER (Standardized for Handshake & Bearer Token)
// 1️⃣ Login API: POST /auth/login/
// ==========================================
window.handleLogin = async function (e) {
    if (e) e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const portalId = document.getElementById("loginPortalId")?.value.trim() || "";
    
    const loginButton = document.getElementById('loginButton');
    const loginSpinner = document.getElementById('loginSpinner');
    const loginButtonText = document.getElementById('loginButtonText');

    if (loginButton) {
        loginButton.disabled = true;
        if (loginSpinner) loginSpinner.classList.remove('hidden');
        if (loginButtonText) loginButtonText.textContent = 'Authenticating...';
    }

    try {
        // 🔥 CRITICAL FIX: The handshake keys (AUTH_KEY) must match settings.GLOBAL_TZ_KEY
        const res = await fetch(`${API_BASE_URL}/auth/login/`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "TZ-KEY": AUTH_KEY,      // Synchronized Handshake Key
                "PRODUCT-KEY": PRODUCT_KEY 
            },
            body: JSON.stringify({
                email: email,
                password: password,
                portal_id: portalId
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            // Handle middleware "TZ-KEY missing" or backend "Invalid credentials"
            throw new Error(errData.detail || errData.status || "Authentication failed. Verify your TZ-KEY.");
        }

        const raw = await res.json();
        const data = raw.data || raw.user || raw;

        // --- ROLE NORMALIZATION ---
        // Ensuring roles match backend expectation (Super Admin, Admin, User)
        let finalRole = "User";
        let backendRole = (data.role || "").toLowerCase().trim();
        
        if (backendRole === "superadmin" || backendRole === "super admin") finalRole = "Super Admin";
        if (backendRole === "admin") finalRole = "Admin";

        // ✅ SESSION DATA: Including the Bearer token for future smartFetch calls
        const userData = {
            id: data.id,
            name: data.name || email.split("@")[0],
            email: data.email,
            role: finalRole,
            portalId: data.portal_id || null,
            token: data.token, // Bearer UUID token
            password: password 
        };

        // Save session to LocalStorage
        window.saveLoginSession(userData, password);
        
        // --- SUCCESS POPUP ---
        Swal.fire({
            icon: 'success',
            title: 'Welcome Back!',
            text: `Logging in as ${finalRole}`,
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            // Role-based redirection logic matching Django URL patterns
            if (finalRole === "Super Admin") {
                window.location.assign("/dashboard/");
            } else if (finalRole === "Admin") {
                window.location.assign("/dashboard/"); // Updated to match your manage_users_page route
            } else {
                window.location.assign("/dashboard/");
            }
        });

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        Swal.fire({
            icon: 'error',
            title: 'Login Failed',
            text: err.message,
            confirmButtonColor: '#003366'
        });
    } finally {
        if (loginButton) {
            loginButton.disabled = false;
            if (loginSpinner) loginSpinner.classList.add('hidden');
            if (loginButtonText) loginButtonText.textContent = 'Login';
        }
    }
};

// ==========================================
// SESSION & CREDENTIALS
// ==========================================
window.saveLoginSession = function (user, password) {
    // Standard User Session
    localStorage.setItem("ssaUser", JSON.stringify(user));
    localStorage.setItem("user_password", password);

    // Specialized storage for Super Admin
    if (user.role && user.role.toLowerCase() === "super admin") {
        localStorage.setItem("super_email", user.email);
        localStorage.setItem("super_pass", password);
    }
};

window.getQueryCredentials = function () {
    console.debug("[Security] Legacy query credentials suppressed — using header auth");
    return "";   // ← safest
};
/**
 * --- SUB-RESOURCE CREATION: FIXED STATUS & ALPHANUMERIC NAME VALIDATION ---
 */

// Global state to prevent overlapping saves
let isSubResourceSaving = false;

// Helper to check if Name, ID, or Device ID exists in ANY of the three local lists
const isAnyDuplicate = (inputId, inputMqtt, inputName) => {
    const checkId = inputId.toUpperCase().trim();
    const checkMqtt = inputMqtt.trim();
    const checkName = inputName.toLowerCase().trim();

    // 1. Check Bowsers
    const inBowsers = allBowserData.some(b => 
        (b.bowser_id || "").toUpperCase().trim() === checkId || 
        (b.mqtt_id || "").trim() === checkMqtt || 
        (b.bowser_name || "").toLowerCase().trim() === checkName
    );

    // 2. Check Tanks
    const inTanks = allTankData.some(t => 
        (t.tank_id || "").toUpperCase().trim() === checkId || 
        (t.mqtt_id || "").trim() === checkMqtt || 
        (t.tank_name || t.name || "").toLowerCase().trim() === checkName
    );

    // 3. Check Stationary
    const inStationary = allStationaryData.some(s => 
        (s.stationary_id || "").toUpperCase().trim() === checkId || 
        (s.mqtt_id || "").trim() === checkMqtt || 
        (s.stationary_name || "").toLowerCase().trim() === checkName
    );

    return inBowsers || inTanks || inStationary;
};

window.addBowser = async function (e, stationId) {
    if (e) e.preventDefault();
    if (isSubResourceSaving) return; // 🛑 BLOCK duplicate clicks

    const bId = document.getElementById('bowserId').value.trim().toUpperCase();
    const mId = document.getElementById('mqttId').value.trim();
    const bName = document.getElementById('deviceName').value.trim();
    const bDesc = document.getElementById('deviceDesc')?.value.trim() || '';
    // ✅ FIX: Capture status from the new dropdown
    const bStatus = document.getElementById('deviceStatus')?.value.toLowerCase() || 'inactive';

    if (!stationId || !bId || !mId || !bName) return showToast('Required fields missing.', 'error');

    // ✅ NEW: STRICT ALPHANUMERIC NAME VALIDATION
    const alphaNumericRegex = /^[a-z0-9 ]+$/i;
    if (!alphaNumericRegex.test(bName)) return showToast('Name can only contain letters and numbers.', 'error');

    // --- STRICT TRIPLE-CHECK (ID, MQTT, NAME) ---
    if (isAnyDuplicate(bId, mId, bName)) {
        return showToast(`Duplicate Name, ID, or Device ID detected in the station!`, 'error');
    }

    const bowserPattern = /^BU\d{3}$/;
    if (!bowserPattern.test(bId)) return showToast('Invalid ID → Use BU + 3 digits (e.g., BU001)', 'error');

    const mqttPattern = /^[A-Za-z0-9]{10}$/;
    if (!mqttPattern.test(mId)) return showToast('MQTT ID must be exactly 10 alphanumeric characters.', 'error');

    // Lock UI
    isSubResourceSaving = true;
    const saveBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('button[onclick*="addBowser"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Adding...`;
    }

    try {
        const payload = { mqtt_id: mId, bowser_id: bId, bowser_name: bName, bowser_description: bDesc, status: bStatus };
        const res = await smartFetch(`/stations/${stationId}/bowsers/add/`, { method: 'POST', body: JSON.stringify(payload) });

        if (res?.bowser_id) {
            showToast('Bowser Added Successfully!', 'success');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (err) {
        showToast('Network Error.', 'error');
    } finally {
        isSubResourceSaving = false; // 🔓 Unlock UI
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `Save`;
        }
    }
};

window.addTank = async function (e, stationId) {
    if (e) e.preventDefault();
    if (isSubResourceSaving) return;

    const tId = document.getElementById('tankId').value.trim().toUpperCase();
    const tName = document.getElementById('tankName').value.trim();
    const tMqttId = document.getElementById('tankMqttId').value.trim();
    const tStatus = document.getElementById('tankStatus')?.value.toLowerCase() || 'inactive';

    if (!stationId || !tId || !tName || !tMqttId) return showToast('Required fields missing.', 'error');

    // ✅ NEW: STRICT ALPHANUMERIC NAME VALIDATION
    const alphaNumericRegex = /^[a-z0-9 ]+$/i;
    if (!alphaNumericRegex.test(tName)) return showToast('Tank Name can only contain letters and numbers.', 'error');

    if (isAnyDuplicate(tId, tMqttId, tName)) {
        return showToast(`Duplicate Name, ID, or Device ID detected!`, 'error');
    }

    const tankPattern = /^TA\d{3}$/;
    if (!tankPattern.test(tId)) return showToast('Invalid Tank ID → Use TA + 3 digits (e.g., TA001)', 'error');

    const mqttPattern = /^[A-Za-z0-9]{10}$/;
    if (!mqttPattern.test(tMqttId)) return showToast('MQTT ID must be 10 characters.', 'error');

    isSubResourceSaving = true;
    try {
        const payload = { mqtt_id: tMqttId, tank_id: tId, tank_name: tName, pump_count: 1, status: tStatus };
        const res = await smartFetch(`/stations/${stationId}/tanks/add/`, { method: 'POST', body: JSON.stringify(payload) });

        if (res?.tank_id) {
            showToast('Tank Added Successfully!', 'success');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (err) {
        showToast('Error adding Tank.', 'error');
    } finally {
        isSubResourceSaving = false;
    }
};

window.addStationaryFromDispenserTab = async function (e, stationId) {
    if (e) e.preventDefault();
    if (isSubResourceSaving) return;

    const sId = document.getElementById('bowserId').value.trim().toUpperCase();
    const sMqttId = document.getElementById('mqttId').value.trim();
    const sName = document.getElementById('deviceName').value.trim();
    const sDesc = document.getElementById('deviceDesc')?.value.trim() || '';
    // ✅ FIX: Capture status from dropdown
    const sStatus = document.getElementById('deviceStatus')?.value.toLowerCase() || 'inactive';

    if (!stationId || !sId || !sMqttId || !sName) return showToast('Required fields missing.', 'error');

    // ✅ NEW: STRICT ALPHANUMERIC NAME VALIDATION
    const alphaNumericRegex = /^[a-z0-9 ]+$/i;
    if (!alphaNumericRegex.test(sName)) return showToast('Name can only contain letters and numbers.', 'error');

    if (isAnyDuplicate(sId, sMqttId, sName)) {
        return showToast(`Duplicate Name, ID, or Device ID detected!`, 'error');
    }

    const statPattern = /^ST\d{3}$/;
    if (!statPattern.test(sId)) return showToast('Invalid ID → Use ST + 3 digits (e.g., ST001)', 'error');

    const mqttPattern = /^[A-Za-z0-9]{10}$/;
    if (!mqttPattern.test(sMqttId)) return showToast('MQTT ID must be 10 characters.', 'error');

    isSubResourceSaving = true;
    try {
        const payload = { mqtt_id: sMqttId, stationary_id: sId, stationary_name: sName, stationary_description: sDesc, status: sStatus };
        const res = await smartFetch(`/stations/${stationId}/stationaries/add/`, { method: 'POST', body: JSON.stringify(payload) });

        if (res?.stationary_id) {
            showToast('Stationary Added Successfully!', 'success');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (err) {
        showToast('Error adding Stationary.', 'error');
    } finally {
        isSubResourceSaving = false;
    }
};// ==========================================
// 3. DATA FETCHING (FIXED: HANDLES URLS & 403)
// ==========================================
async function smartFetch(endpoint, options = {}) {
    const controller = new AbortController();
    // 20-second timeout to prevent long hangs
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    try {
        // 🛡️ URL FIX: Check if the endpoint already contains the full URL
        const cleanEndpoint = endpoint.startsWith('http') 
            ? endpoint 
            : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        console.log(`[Fetching] ${cleanEndpoint}`);

        const fetchOptions = {
            ...options,
            signal: controller.signal,
            headers: {
                ...getAuthHeaders(), // 🔑 Injects TZ-KEY and PRODUCT-KEY
                ...(options.headers || {})
            }
        };

        const response = await fetch(cleanEndpoint, fetchOptions);
        clearTimeout(timeoutId);

        // 🛑 Handle Security Handshake Fail (403)
        if (response.status === 403) {
            console.error(`[Security Denied] 403 at ${endpoint}. Handshake keys rejected.`);
            // backendAlive = false; // Optional circuit breaker
            return [];
        }

        if (response.status === 401) {
            console.warn("Auth Session Expired.");
            return [];
        }

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error(`Server Error: ${response.status}`, errorBody);
            return [];
        }

        if (response.status === 204) return { status: 'Success' };

        const json = await response.json();
        
        // --- DATA EXTRACTION LOGIC ---
        if (json.data && Array.isArray(json.data)) return json.data;
        if (json.results && Array.isArray(json.results)) return json.results;
        if (json.stations && Array.isArray(json.stations)) return json.stations;
        if (Array.isArray(json)) return json;
        if (json.data && (json.data.admins || json.data.users)) return json.data;
        if (json.data && typeof json.data === 'object') return json.data;

        return json;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.warn(`[Timeout] Request for ${endpoint} cancelled.`);
        } else {
            console.error(`[API Fail] ${endpoint}:`, error);
            backendAlive = false; 
        }
        throw error;
    }
}

// ==========================================
// LOGOUT FUNCTION (SYNCHRONIZED WITH BACKEND)
// ==========================================
window.handleLogout = async function (e) {
    if (e) e.preventDefault();

    // 1. Get the current session to extract the token
    const userStr = localStorage.getItem("ssaUser");
    const user = userStr ? JSON.parse(userStr) : null;

    if (user && user.token) {
        try {
            console.log("[Auth] Calling logout API to delete token on DB...");
            
            // 2. Call your backend API: auth/logout/
            // getAuthHeaders() must include: 
            // "Authorization": "Bearer <token>" and "TZ-KEY": "ssa123"
            await fetch(`${API_BASE_URL}/auth/logout/`, {
                method: 'POST',
                headers: getAuthHeaders() 
            });

        } catch (err) {
            console.warn("[Auth] API logout failed, clearing local session anyway.");
        }
    }

    // 3. Wipe local memory to prevent residual access
    localStorage.removeItem('ssaUser');
    localStorage.removeItem('user_password');
    localStorage.removeItem('ssaFilters');
    currentUser = null;

    // 4. Redirect to login page to avoid the 404 root error
    window.location.replace('/login/'); 
};

// --- LOGOUT BUTTON LOGIC ---
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    const newBtn = logoutBtn.cloneNode(true);
    if (logoutBtn.parentNode) {
        logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
    }
    newBtn.addEventListener('click', window.handleLogout);
}
// --- DOM ELEMENTS ---
// *** FIX FOR ReferenceError: DEFINING THESE GLOBALLY TO PREVENT CRASH ***
const loginSpinner = document.getElementById('loginSpinner');
const loginButtonText = document.getElementById('loginButtonText');
const loginError = document.getElementById('loginError');
const portalIdContainer = document.getElementById('portalIdContainer');

// Modals & Elements
const profileModalElement = document.getElementById('profileModal');
let adminModal = null;
const adminModalElement = document.getElementById('adminModal');
const saveAdminButton = document.getElementById('saveAdminButton');
const adminModalForm = document.getElementById('adminModalForm');
let viewUsersModal = null;
const viewUsersModalElement = document.getElementById('viewUsersModal');
const viewUsersModalLabel = document.getElementById('viewUsersModalLabel');
const viewUsersTableBody = document.getElementById('viewUsersTableBody');
let userModal = null;
const userModalElement = document.getElementById('userModal');
const userModalLabel = document.getElementById('userModalLabel');
const userModalForm = document.getElementById('userModalForm');
const saveUserButton = document.getElementById('saveUserButton');
const editUserId = document.getElementById('editUserId');
let currentAdminId = null;
let transactionDetailModal = null;
const transactionDetailModalElement = document.getElementById('transactionDetailModal');
let settingsModal = null;
const settingsModalElement = document.getElementById('settingsModal');
let profileModal = null;
let allocationModal = null;
let periodDetailModal = null;
let exportConfigModal = null;
let previewModal = null;
let emailReportModal = null; // Added email modal
let editDeviceModal = null; // New modal for device/tank/asset edit
const editDeviceModalElement = document.getElementById('editDeviceModal');


function showToast(title, icon = 'success') {
    if (typeof Swal === 'undefined') return;
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
    Toast.fire({ icon: icon, title: title });
}

async function showConfirm(title, text, confirmButtonText = 'Yes, do it!') {
    if (typeof Swal === 'undefined') return Promise.resolve(confirm(title + "\n" + text));
    const result = await Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: confirmButtonText
    });
    return result.isConfirmed;
}

// ================================================================
// *** HELPER FUNCTIONS ***
// ================================================================

function getStatusBadgeClass(status) {
    if (!status || status === 'null') return 'bg-secondary';
    const s = String(status).toUpperCase();
    if (['IDLE', 'CALL', 'ACTIVE', 'ONLINE', 'MONITORING', 'SUCCESS'].includes(s)) return 'bg-success';
    if (['AUTHORIZED', 'BUSY', 'MAINTENANCE'].includes(s)) return 'bg-warning text-dark';
    if (['EVENT', 'SEND DATA'].includes(s)) return 'bg-info text-dark';
    if (['DATA ERROR', 'DISABLED', 'ERROR'].includes(s)) return 'bg-danger';
    return 'bg-secondary';
}

function formatSSADate(rawStr) {
    if (!rawStr || rawStr === 'null' || rawStr === 'undefined') return 'N/A';
    
    try {
        // Handle ISO strings (e.g., 2025-12-26T09:28:28Z) from Swagger/Django
        const dateObj = new Date(rawStr);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(',', '');
        }
    } catch (e) { 
        console.warn("Date parse error:", rawStr); 
    }

    // Fallback for custom 12-digit format (yymmddhhmm)
    const str = String(rawStr).replace(/\s+/g, '');
    if (str.length === 12) {
        const yy = str.substring(0, 2);
        const mm = str.substring(2, 4);
        const dd = str.substring(4, 6);
        const hh = str.substring(6, 8);
        const min = str.substring(8, 10);
        return `${dd}-${mm}-20${yy} ${hh}:${min}`;
    }

    return rawStr;
}
function parseBackendDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    try {
        if (dateStr.length === 6 && !dateStr.includes('/') && !dateStr.includes('-')) {
            const year = '20' + dateStr.substring(0, 2);
            const month = dateStr.substring(2, 4);
            const day = dateStr.substring(4, 6);
            let hour, minute, second;
            if (timeStr.includes(':')) {
                [hour, minute, second] = timeStr.split(':');
            } else {
                hour = timeStr.substring(0, 2);
                minute = timeStr.substring(2, 4);
                second = timeStr.substring(4, 6) || '00';
            }
            return new Date(year, month - 1, day, hour, minute, second);
        }
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length !== 3) return null;
        let day, month, year;
        if (parts[0].length === 4) { year = parts[0]; month = parts[1]; day = parts[2]; }
        else { day = parts[0]; month = parts[1]; year = parts[2]; }
        const [hour, minute, second] = timeStr.split(':');
        return new Date(year, month - 1, day, hour, minute, second);
    } catch (e) {
        console.error("Failed to parse date:", dateStr, timeStr, e);
        return null;
    }
}

function processTransactionDataForChart(transactions) {

    // ✅ ALWAYS return a valid chart dataset
    if (!transactions || transactions.length === 0) {
        return {
            chartLabels: ["No Data"],
            chartCounts: [0],
            chartVolumes: [0]
        };
    }

    const daily = {};

    // --- Build buckets using LOCAL date ---
    transactions.forEach(tx => {
        const d = tx.dateTimeObj;

        const key =
            d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');

        if (!daily[key]) {
            daily[key] = { count: 0, volume: 0 };
        }

        daily[key].count += 1;
        daily[key].volume += tx.vol;
    });

    // --- Find range ---
    const times = transactions.map(t => t.dateTimeObj.getTime());
    const minDate = new Date(Math.min(...times));
    const maxDate = new Date(Math.max(...times));

    // Normalize to midnight LOCAL
    minDate.setHours(0,0,0,0);
    maxDate.setHours(0,0,0,0);

    const labels = [];
    const counts = [];
    const volumes = [];

    const cursor = new Date(minDate);

    while (cursor <= maxDate) {
        const key =
            cursor.getFullYear() + '-' +
            String(cursor.getMonth() + 1).padStart(2, '0') + '-' +
            String(cursor.getDate()).padStart(2, '0');

        labels.push(cursor.toLocaleDateString('en-GB'));
        counts.push(daily[key]?.count || 0);
        volumes.push(daily[key]?.volume || 0);

        cursor.setDate(cursor.getDate() + 1);
    }

    return {
        chartLabels: labels,
        chartCounts: counts,
        chartVolumes: volumes
    };
}

// *** FIX: getPeriodStats now uses baseTransactionData to prevent logical errors (e.g. 84 < 127) ***
function getPeriodStats(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let count = 0, vol = 0, amt = 0;
    // Use the full dataset (`baseTransactionData`) for the period calculations
    baseTransactionData.forEach(tx => {
        // FIX: Ensure tx.vol and tx.amt are numeric and present
        const txVol = parseFloat(tx.vol) || 0;
        const txAmt = parseFloat(tx.amt) || 0;

        if (tx.dateTimeObj && tx.dateTimeObj >= cutoff) {
            count++;
            vol += txVol;
            amt += txAmt;
        }
    });
    return { count, vol, amt };
}

/**
 * Renders the Transaction Analysis chart with dual y-axes.
 * Production-safe: always renders even with empty data.
 */
function drawTransactionChart(processedData) {
    const canvas = document.getElementById('transactionChart');
    if (typeof Chart === 'undefined' || !canvas) return;

    // ✅ FALLBACK: never allow empty chart
    if (
        !processedData ||
        !Array.isArray(processedData.chartLabels) ||
        processedData.chartLabels.length === 0
    ) {
        processedData = {
            chartLabels: ["No Data"],
            chartCounts: [0],
            chartVolumes: [0]
        };
    }

    // Detect Theme for dynamic UI colors
    const isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';

    const gridColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    const labelColor = isDarkMode ? '#e9ecef' : '#495057';
    const tooltipBg = isDarkMode ? 'rgba(33,37,41,0.95)' : 'rgba(255,255,255,0.95)';
    const tooltipText = isDarkMode ? '#fff' : '#000';

    const labels = processedData.chartLabels;
    const txData = processedData.chartCounts;
    const volData = processedData.chartVolumes;

    // Reset existing chart
    if (window.mainChart) {
        window.mainChart.destroy();
    }

    const ctx = canvas.getContext('2d');

    window.mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Transactions',
                    data: txData,
                    backgroundColor: isDarkMode ? '#2fb344' : '#198754',
                    borderColor: isDarkMode ? '#2fb344' : '#198754',
                    borderWidth: 1,
                    yAxisID: 'y',
                    order: 2,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Volume (Ltr)',
                    data: volData,
                    backgroundColor: isDarkMode ? '#4299e1' : '#0d6efd',
                    borderColor: isDarkMode ? '#4299e1' : '#0d6efd',
                    borderWidth: 1,
                    yAxisID: 'y1',
                    order: 1,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: labelColor,
                        padding: 20,
                        font: { size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: tooltipText,
                    bodyColor: tooltipText,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString();
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: labelColor,
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: gridColor },
                    ticks: { color: labelColor },
                    title: {
                        display: true,
                        text: 'Transaction Count',
                        color: labelColor,
                        font: { weight: 'bold' }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: labelColor },
                    title: {
                        display: true,
                        text: 'Volume (Ltr)',
                        color: labelColor,
                        font: { weight: 'bold' }
                    }
                }
            }
        }
    });
}
function populateFullTransactionTable(data) {
    const tableBody = document.getElementById('transactionTableBody');
    const paginationEl = document.getElementById('paginationControls');
    const infoEl = document.getElementById('tableInfo');
    
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        tableBody.innerHTML =
            '<tr><td colspan="15" class="text-center p-4 text-muted">No transactions found matching your filters.</td></tr>';
        if (paginationEl) paginationEl.innerHTML = '';
        if (infoEl) infoEl.textContent = 'Showing 0 to 0 of 0 entries';
        return;
    }

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
    const displayData = data.slice(startIndex, endIndex);

    const rowsHTML = displayData.map((transaction, index) => {
        const statusBadgeClass = getStatusBadgeClass(transaction.status);

        let typeBadge = 'bg-secondary';
        const type = (transaction.type || '').toLowerCase();
        if (type === 'bowser') typeBadge = 'bg-success';
        else if (type === 'stationary') typeBadge = 'bg-info';
        else if (type === 'tank') typeBadge = 'bg-warning text-dark';

        const sNo = totalItems - (startIndex + index);

        return `
            <tr>
                <td>${sNo}</td>
                <td>
                    <a href="#" class="text-primary text-decoration-none fw-bold"
                        onclick="window.openTransactionDetail('${transaction.id}'); return false;">
                        ${transaction.id}
                    </a>
                </td>
                <td>${transaction.deviceId || 'N/A'}</td>
                <td>${transaction.bowserId || 'N/A'}</td>
                <td class="col-device-type">
                    <span class="badge ${typeBadge}">${transaction.type}</span>
                </td>
                <td class="col-pump-id">${transaction.pumpId || 'N/A'}</td>
                <td class="col-datetime">${formatSSADate(transaction.datetimeString)}</td>
                <td class="col-volume fw-bold">${(transaction.vol || 0).toFixed(2)}</td>
                <td class="col-amount">${(transaction.amt || 0).toFixed(2)}</td>
                <td class="col-total-volume text-muted">${(transaction.totalVol || 0).toFixed(2)}</td>
                <td class="col-total-amount text-muted">${(transaction.totalAmt || 0).toFixed(2)}</td>
                <td class="col-attender">${transaction.attender || 'N/A'}</td>
                <td class="col-vehicle">${transaction.vehicle || 'N/A'}</td>
                <td><span class="badge ${statusBadgeClass}">${transaction.status}</span></td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rowsHTML;

    // ==========================================
    // CRITICAL FIX: RE-APPLY COLUMN VISIBILITY
    // ==========================================
    // This ensures that if a column was unchecked, it stays hidden on the new page.
    if (typeof window.applyColumnVisibility === 'function') {
        window.applyColumnVisibility();
    }

    if (infoEl) {
        infoEl.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;
    }

    renderPaginationControls(totalPages, paginationEl);
}

// --- HELPER: RENDER PAGINATION BUTTONS ---
function renderPaginationControls(totalPages, container) {
    if (!container) return;
    container.innerHTML = '';

    if (totalPages <= 1) return; // Don't show controls if only 1 page

    // Previous Button
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    let html = `
        <li class="page-item ${prevDisabled}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Previous</a>
        </li>
    `;

    // Page Numbers (Smart Logic: Show limited range if too many pages)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(1); return false;">1</a></li>`;
        if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'active' : '';
        html += `<li class="page-item ${active}"><a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a></li>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${totalPages}); return false;">${totalPages}</a></li>`;
    }

    // Next Button
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    html += `
        <li class="page-item ${nextDisabled}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Next</a>
        </li>
    `;

    container.innerHTML = html;
}

// --- HELPER: CHANGE PAGE CLICK HANDLER ---
window.changePage = function(newPage) {
    if (newPage < 1) return;
    currentPage = newPage;
    // Repopulate using the EXISTING filtered data
    populateFullTransactionTable(currentTransactionData);
    
    // Optional: Scroll to top of table
    document.getElementById('transactionView').scrollIntoView({ behavior: 'smooth' });
};
/**
 * Populates the main Stations table with data.
 * Updated to use clean Django URL paths for Detail View and Edit mode.
 */
function populateAllStationsTable(data) {
    const tableBody = document.getElementById('allStationsTableBody');
    const paginationEl = document.getElementById('stationPagination');
    const infoEl = document.getElementById('stationTableInfo');
    
    if (!tableBody) return;
    tableBody.innerHTML = '';

    currentFilteredStations = data;

    const userRole = currentUser?.role ? currentUser.role.trim().toLowerCase() : 'user';
    const isAdminOrSuperAdmin = (userRole === 'super admin' || userRole === 'admin');

    if (!data || data.length === 0) {
        const colSpan = isAdminOrSuperAdmin ? 9 : 8;
        tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-5 text-muted">No stations found matching your search.</td></tr>`;
        if(paginationEl) paginationEl.innerHTML = '';
        if(infoEl) infoEl.textContent = 'Showing 0 to 0 of 0 entries';
        return;
    }

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / stationRowsPerPage);
    
    if (stationCurrentPage > totalPages) stationCurrentPage = totalPages;
    if (stationCurrentPage < 1) stationCurrentPage = 1;

    const startIndex = (stationCurrentPage - 1) * stationRowsPerPage;
    const endIndex = Math.min(startIndex + stationRowsPerPage, totalItems);
    const displayData = data.slice(startIndex, endIndex);

    const getAssigneeName = (stationObj) => { 
        const possibleKeys = [String(stationObj.station_id || "").trim(), String(stationObj.id || "").trim()].filter(k => k !== "");
        for (let key of possibleKeys) {
            if (globalStationAssignments[key]) {
                const match = globalStationAssignments[key];
                const badgeClass = String(match.role).toLowerCase() === 'admin' ? 'bg-warning text-dark' : 'bg-info text-dark';
                return `<span class="badge ${badgeClass}">${match.name}</span>`;
            }
        }
        return '<span class="badge bg-secondary opacity-50">Unassigned</span>';
    };

    displayData.forEach((station, index) => {
        const stationCode = station.station_id || station.id || 'N/A';
        const dbPkId = station.id;
        const sStatus = station.status || (station.is_active ? 'Active' : 'Inactive');
        const statusBadge = (String(sStatus).toLowerCase() === 'active') ? 'bg-success' : 'bg-danger';

        // ================================================================
        // ✅ CRITICAL FIX: Update paths to match Django urls.py
        // ================================================================
        
        // 1. Station Name Link -> Points to /stations-detail/ID/
        const detailLink = `/stations-detail/${stationCode}/`;

        // 2. Action Buttons -> Points to /stations-create/?edit=ID
        let actionButtons = isAdminOrSuperAdmin ? `
            <div class="d-flex justify-content-start gap-1">
                <button class="btn btn-sm btn-warning" title="Allocate User" onclick="window.openAllocateModal('${stationCode}')">
                    <i class="bi bi-person-fill-gear"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary" title="Edit Station" onclick="window.location.href='/stations-create/?edit=${stationCode}'">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" title="Delete Station" onclick="window.deleteStation('${stationCode}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>` : 
            `<button onclick="window.location.href='/stations-create/?edit=${stationCode}'" class="btn btn-sm btn-link p-0 text-primary text-decoration-none">Edit</button>`;

        const row = tableBody.insertRow();
        let rowHTML = `
            <td class="align-middle text-start ps-3">${startIndex + index + 1}</td>
            <td class="align-middle text-start fw-bold">
                <a href="${detailLink}" class="text-primary text-decoration-none">${station.station_name || station.name}</a>
            </td>
            <td class="align-middle text-start">${stationCode}</td>
            <td class="align-middle text-start">${station.location || 'N/A'}</td>
            <td class="align-middle text-start small text-uppercase text-muted">${station.category || 'General'}</td>
            <td class="align-middle text-start"><span class="badge ${statusBadge}">${sStatus.toUpperCase()}</span></td>
            <td class="align-middle text-start small">${formatSSADate(station.created_on)}</td>
        `;

        // Only add data cell if User is an Admin
        if (isAdminOrSuperAdmin) {
            rowHTML += `<td class="align-middle text-start">${getAssigneeName(station)}</td>`;
        }

        rowHTML += `<td class="align-middle text-start">${actionButtons}</td>`;
        row.innerHTML = rowHTML;
    });

    // Update the Table Headers (Hide "Assigned To" for regular users)
    if (typeof updateStationTableHeaders === 'function') {
        updateStationTableHeaders(isAdminOrSuperAdmin);
    }

    if(infoEl) infoEl.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;
    
    if (typeof renderStationPaginationControls === 'function') {
        renderStationPaginationControls(totalPages, paginationEl);
    }
}

/**
 * Helper to dynamically toggle table headers based on role
 */
function updateStationTableHeaders(isAdmin) {
    const tableHeaderRow = document.querySelector('#stationTable thead tr');
    if (!tableHeaderRow) return;

    // Use specific IDs to find the headers
    const assignedHeader = document.getElementById('th-assigned');
    const actionHeader = document.getElementById('th-action');

    if (assignedHeader) assignedHeader.style.display = isAdmin ? '' : 'none';
    if (actionHeader) {
        actionHeader.textContent = 'Action';
        actionHeader.style.display = ''; // Always visible
    }
}
function updateLiveClock() {
    const now = new Date();
    // FIX: Set weather info here if available, otherwise use default
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const currentTimeElement = document.getElementById('currentTime');
    if (currentTimeElement) currentTimeElement.textContent = time;
    // Add temp/weather update (using static for now)
    const liveClockEl = document.getElementById('liveClock');
    if (liveClockEl) liveClockEl.innerHTML = `<i class="bi bi-cloud-sun me-1"></i> 26 °C &nbsp;|&nbsp; <span id="currentTime">${time}</span>`;
}

function applyTheme(theme) {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('data-bs-theme', theme);

    if (theme === 'dark') {
        htmlElement.setAttribute('data-swal2-theme', 'dark');
    } else {
        htmlElement.removeAttribute('data-swal2-theme');
    }

    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}
window.toggleTheme = function () {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);

    // Force the chart to redraw with new theme colors
    if (document.getElementById('transactionChart')) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const chartSet = baseTransactionData.filter(tx => tx.dateTimeObj >= cutoff);
        const processed = processTransactionDataForChart(chartSet);
        drawTransactionChart(processed); 
    }
}


// *** FIX: SIDEBAR OPTIMIZATION FOR USER ***
function optimizeSidebarForUser(role) {
    if (role !== 'User') return;

    // Find the link triggering the station menu dropdown
    const stationToggle = document.querySelector('a[href="#stationMenu"]');
    const stationSubMenu = document.getElementById('stationMenu');

    if (stationToggle) {
        // Remove Bootstrap Toggle attributes to make it a direct link
        stationToggle.removeAttribute('data-bs-toggle');
        stationToggle.removeAttribute('aria-expanded');
        stationToggle.classList.remove('collapsed');

        // Point directly to stations list
        stationToggle.setAttribute('href', '/stations/');
    }

    // Hide the actual submenu container (the dropdown part)
    if (stationSubMenu) {
        stationSubMenu.remove();
    }
}

// --- Role-Based UI Management (UPDATED: With Asset & Management Context) ---
function setupUIForRole(role) {
    if (!role) return;

    const normalizedRole = String(role).toLowerCase().trim();

    // 1. Reset: Hide elements by default to ensure strict enforcement
    // We target elements with data-role and our new data-role-user-only
    document.querySelectorAll('[data-role], [data-role-user-only]').forEach(el => {
        el.classList.add('hidden');
    });

    // 2. Role-Based Visibility Logic
    if (normalizedRole === 'super admin') {
        // Show everything tagged for Super Admin
        document.querySelectorAll('[data-role*="Super Admin"]').forEach(el => el.classList.remove('hidden'));
    } 
    else if (normalizedRole === 'admin') {
        // Show everything tagged for Admin, Hide Super Admin specific items
        document.querySelectorAll('[data-role*="Admin"]').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('[data-role="Super Admin"]').forEach(el => el.classList.add('hidden'));
    } 
    else if (normalizedRole === 'user') {
        // Show generic User items
        document.querySelectorAll('[data-role*="User"]').forEach(el => el.classList.remove('hidden'));
        
        // --- THE FIX: Show Assets link ONLY for User login ---
        document.querySelectorAll('[data-role-user-only="Asset"]').forEach(el => el.classList.remove('hidden'));

        // Hide Admin and Super Admin restricted areas
        document.querySelectorAll('[data-role="Super Admin"]').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[data-role="Super Admin Admin"]').forEach(el => el.classList.add('hidden'));

        if (typeof optimizeSidebarForUser === 'function') {
            optimizeSidebarForUser('User');
        }
    }

    // 3. Update Global Header Info
    const currentUserEl = document.getElementById('currentUser');
    const currentUserRoleEl = document.getElementById('currentUserRole');
    if (currentUserEl && currentUser) currentUserEl.textContent = `User: ${currentUser.email}`;

    const displayRole = normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
    if (currentUserRoleEl && currentUser) currentUserRoleEl.textContent = `Role: ${displayRole}`;

    // ================================================================
    // SET MANAGEMENT CONTEXT (For User Mapping Logic)
    // ================================================================
    const contextInfo = document.getElementById('portalContextInfo');
    const portalLabel = document.getElementById('portalIdLabel'); 

    if (contextInfo && currentUser) {
        if (normalizedRole === 'admin') {
            contextInfo.innerHTML = `<i class="bi bi-info-circle me-1"></i> Managing users for Portal ID: <strong class="text-primary">${currentUser.portalId || 'N/A'}</strong>`;
            if (portalLabel) portalLabel.textContent = "Assigned Portal ID";
        } else if (normalizedRole === 'super admin') {
            contextInfo.innerHTML = `<i class="bi bi-globe me-1"></i>  Global User Mapping`;
            if (portalLabel) portalLabel.textContent = "Assign User to Portal ID";
        }
    }
}
// *** SEARCH/FILTER FUNCTIONS ***
function filterAdminTable(searchTerm) {
    const term = searchTerm.toLowerCase();

    if (!term) {
        populateAdminTable(mockAdminData);
        return;
    }

    const filteredAdmins = mockAdminData.filter(admin => {
        // FIX: Defensive coding for undefined properties
        return (admin.name || '').toLowerCase().includes(term) ||
            (admin.email || '').toLowerCase().includes(term) ||
            (admin.portal_id || '').toLowerCase().includes(term);
    });

    populateAdminTable(filteredAdmins);
}

// --- SEARCH FILTER LOGIC ---
function filterStationTable(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    // Reset to page 1 whenever a filter is applied
    stationCurrentPage = 1; 

    if (!term) {
        currentFilteredStations = allStationsData; // Reset to full list
        populateAllStationsTable(allStationsData);
        return;
    }

    const filtered = allStationsData.filter(station => {
        const sName = (station.station_name || station.name || '').toLowerCase();
        const sId = (station.station_id || '').toLowerCase();
        const sLoc = (station.location || '').toLowerCase();
        return sName.includes(term) || sId.includes(term) || sLoc.includes(term);
    });

    // ✅ CRITICAL: Update the pagination source
    currentFilteredStations = filtered; 
    populateAllStationsTable(filtered);
}// BLOCK 2: UPDATE EXISTING STATION
window.handleUpdateStation = async function(dbId, data) {
    try {
        // Using the Station ID string in the URL as per your API documentation
        const response = await smartFetch(`/stations/${data.station_id}/update/`, {
            method: 'PUT',
            body: JSON.stringify({ ...data, is_active: (data.status === 'active') })
        });

        if (response && (response.code === 200 || response.status)) {
            showToast('Station Updated Successfully!', 'success');
            setTimeout(() => window.location.href = '/stations/', 1000);
        }
    } catch (err) {
        showToast('Error updating station.', 'error');
    }
};

/* ================================================================
   FIXED STATION CREATION & UPDATE LOGIC (NO DUPLICATES + EDIT FIX)
   ================================================================ */

// Global constant to ensure alerts are visible above all other UI
const SSA_SWAL_Z_INDEX = 9999; 

window.handleCreateStation = async function(data) {
    const submitBtn = document.querySelector('#createStationForm button[type="submit"]');
    // Identify if we are in Edit Mode
    const editPk = document.getElementById('editStationId').value;
    const isEditMode = editPk !== "" && editPk !== null;

    // 1. STOP THE DUAL POPUP: Immediately disable button
    if (submitBtn) {
        if (submitBtn.disabled) return; 
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Processing...`;
    }

    try {
        // 2. RE-SYNC LOCAL DIRECTORY
        if (!allStationsData || allStationsData.length === 0) {
            const syncRes = await smartFetch(`/stations/list/?_t=${Date.now()}`);
            allStationsData = Array.isArray(syncRes) ? syncRes : (syncRes.stations || []);
        }

        // --- NEW: ALPHANUMERIC NAME VALIDATION ---
        const nameRegex = /^[a-zA-Z0-9 ]+$/;
        if (!nameRegex.test(data.station_name)) {
            throw new Error("Station Name can only contain letters and numbers.");
        }

        // 3. SMART DUPLICATE CHECK: Ignores the current station if editing
        const normalizedInputName = data.station_name.trim().toLowerCase();
        const isDuplicate = allStationsData.some(s => {
            const sameName = (s.station_name || s.name || "").toLowerCase().trim() === normalizedInputName;
            // If editing, a duplicate is only a duplicate if it has a DIFFERENT station_id
            const isDifferentStation = isEditMode ? (String(s.station_id) !== String(data.station_id)) : true;
            return sameName && isDifferentStation;
        });

        if (isDuplicate) {
            throw new Error(`The station name "${data.station_name}" is already used by another station.`);
        }

        // 4. STATION ID VALIDATION (Only enforced on creation)
        if (!isEditMode) {
            const idPattern = /^STSSA\d{5}$/;
            if (!idPattern.test(data.station_id)) {
                throw new Error("Invalid Station ID. Format: STSSA + 5 digits (e.g., STSSA12345).");
            }
        }

        // 5. SERVER-SIDE EXECUTION (ENFORCED STATUS)
        // Correctly maps method to PUT for updates and POST for creation
        const url = isEditMode 
            ? `${API_BASE_URL}/stations/${data.station_id}/update/` 
            : `${API_BASE_URL}/stations/create/`;

        const response = await fetch(url, {
            method: isEditMode ? 'PUT' : 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                ...data,
                is_active: data.status.toLowerCase() === 'active', // Forces false if status is "inactive"
                admin_id: currentUser.id
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.detail || result.status || "Server rejected the station data.");
        }

        // 6. HANDLE ASSIGNMENT
        const autoAssignUserId = document.getElementById('assignToUser')?.value;
        if (autoAssignUserId) {
            await fetch(`${API_BASE_URL}/assignments/assign/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    user_id: parseInt(autoAssignUserId),
                    station_id: data.station_id
                })
            });
        }

        // 7. SUCCESS: Single, clean popup
        Swal.fire({
            icon: 'success',
            title: isEditMode ? 'Station Updated!' : 'Station Created!',
            text: 'Redirecting to directory...',
            timer: 1500,
            showConfirmButton: false,
            target: 'body',
            didOpen: () => { Swal.getContainer().style.zIndex = SSA_SWAL_Z_INDEX; }
        });

        sessionStorage.removeItem('ssa_stations_cache');
        setTimeout(() => { window.location.assign('/stations/'); }, 1600);

    } catch (err) {
        // 8. ERROR HANDLING: Re-enable UI and show alert correctly
        Swal.fire({
            icon: 'error',
            title: 'Action Blocked',
            text: err.message || "An unexpected error occurred.",
            target: 'body',
            confirmButtonColor: '#003366',
            didOpen: () => { Swal.getContainer().style.zIndex = SSA_SWAL_Z_INDEX; }
        });

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = isEditMode ? `Update Station` : `Save Station`;
        }
    }
};

// --- RE-ATTACH THE FORM LISTENER & UI DEFAULTS ---
document.addEventListener('DOMContentLoaded', () => {
    const createForm = document.getElementById('createStationForm');
    
    if (createForm) {
        // --- FORCED STATUS RESET FOR NEW STATIONS ---
        const statusField = document.getElementById("status");
        const isEditMode = window.location.search.includes('edit=');
        if (statusField && !isEditMode) {
            statusField.value = "inactive"; 
            Array.from(statusField.options).forEach(opt => {
                opt.selected = (opt.value === "inactive");
            });
        }

        // 1. CLEAR ALL PREVIOUS LISTENERS: Kills "Extra Popup"
        const cleanForm = createForm.cloneNode(true);
        createForm.parentNode.replaceChild(cleanForm, createForm);

        // 2. ATTACH ONE SINGLE CONTROLLED LISTENER
        cleanForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopImmediatePropagation(); 

            if (cleanForm.querySelector('button[type="submit"]').disabled) return;

            const data = {
                station_name: document.getElementById('stationName').value.trim(),
                station_id: document.getElementById('stationId').value.trim(),
                location: document.getElementById('location').value.trim(),
                category: document.getElementById('category').value.trim(),
                status: document.getElementById('status').value,
                description: document.getElementById('description').value.trim()
            };

            await window.handleCreateStation(data);
        });
    }
});
/* ================================================================
   STATION EDIT LOGIC (FIXED: Reliable Status & User Selection)
   ================================================================ */
window.loadStationForEdit = async (stationId) => {
    // 1. REDIRECT LOGIC: If not on the form page, go there first
    if (!document.getElementById('createStationView')) {
        window.location.href = `create-station.html?edit=${stationId}`;
        return;
    }

    console.log(`[Edit] Preparing to edit Station ID: ${stationId}`);

    // Helper to match ID (Handles both Numeric Primary Key and String Station ID like STSSA54111)
    const findStation = (list) => list.find(s => String(s.id) === String(stationId) || String(s.station_id) === String(stationId));

    // 2. CHECK MEMORY: Use globally loaded data if available
    let station = findStation(allStationsData);

    // 3. FETCH IF MISSING: If page refreshed, fetch from Server
    if (!station) {
        try {
            const creds = getQueryCredentials();
            // ✅ NEW: Clean URL. smartFetch automatically handles the Token in the headers.
const serverData = await smartFetch('/stations/list/');
            const rawList = Array.isArray(serverData) ? serverData : (serverData.stations || []);
            station = findStation(rawList);
        } catch (e) {
            console.error("Failed to fetch station for edit:", e);
        }
    }

    if (!station) {
        showToast('Error: Station not found.', 'error');
        setTimeout(() => window.location.href = '/stations/', 1500);
        return;
    }

    // 4. POPULATE BASIC FORM FIELDS
    document.getElementById('editStationId').value = station.id; 
    document.getElementById('stationName').value = station.station_name || station.name;
    document.getElementById('stationId').value = station.station_id || station.id;
    document.getElementById('stationId').disabled = true; // Station ID is non-editable
    
    document.getElementById('location').value = station.location || "";
    document.getElementById('category').value = station.category || "";
    document.getElementById('description').value = station.description || "";
    
    // ✅ FIX: Reliable Status Mapping (Handles exact match to prevent 'inactive' being read as 'active')
    const statusField = document.getElementById('status');
    if (statusField) {
        const rawStatus = String(station.status || (station.is_active ? 'active' : 'inactive')).toLowerCase();
        
        if (rawStatus === 'inactive' || station.is_active === false) {
            statusField.value = 'inactive';
        } else {
            statusField.value = 'active';
        }
    }

    // 5. THE CRITICAL FIX: POPULATE AND PRE-SELECT ASSIGNMENT
    const assignSelect = document.getElementById('assignToUser');
    if (assignSelect) {
        // Force refresh of user directory and assignment map to ensure latest data
        if (allAssignableUsers.length === 0) await window.fetchAdminsAndUsers();
        
        // Ensure the assignments map is built so we know who owns what
        await window.fetchAssignmentsMap();

        // Populate the dropdown options
        window.populateAllocationDropdown(assignSelect, 'User', "");

        // Find the current owner using the specific Station ID string
        const stationKey = String(station.station_id || station.id).trim();
        const currentOwner = globalStationAssignments[stationKey];

        if (currentOwner) {
            console.log(`[Edit] Setting current assignee in UI: ${currentOwner.name} (ID: ${currentOwner.id})`);
            assignSelect.value = currentOwner.id; 
        } else {
            assignSelect.value = ""; // Default to "-- Unassigned --"
        }
    }

    // Update UI Header & Button
    document.querySelector('#createStationView h1').textContent = "Edit Station";
    const submitBtn = document.querySelector('#createStationForm button[type="submit"]');
    if(submitBtn) submitBtn.textContent = "Update Station";
};

/* ================================================================
   STATION UPDATE HANDLER (FIXED: Saves Assignment & Syncs Status)
   ================================================================ */
window.handleUpdateStation = async function(dbId, data) {
    const submitBtn = document.querySelector('#createStationForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Updating...';
    }

    try {
        // ✅ Ensure the boolean flag is strictly synchronized with the dropdown choice
        const isCurrentlyActive = (data.status === 'active');

        // 1. Update basic station details
        await smartFetch(`/stations/${data.station_id}/update/`, {
            method: 'PUT',
            body: JSON.stringify({ 
                ...data, 
                is_active: isCurrentlyActive 
            })
        });

        // 2. Update user assignment if changed
        const newUserId = document.getElementById('assignToUser')?.value;
        if (newUserId) {
            console.log(`[Edit] Solidifying user assignment for ID: ${newUserId}`);
            await fetch(`${API_BASE_URL}/assignments/assign/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: currentUser.email,
                    password: currentUser.password || localStorage.getItem('user_password'),
                    station_id: String(data.station_id),
                    assigned_role: 'User',
                    admin_id: currentUser.id,
                    user_id: parseInt(newUserId)
                })
            });
            // Rebuild map locally so the table updates immediately
            await window.fetchAssignmentsMap(); 
        }

        showToast('Station Updated Successfully!', 'success');
        setTimeout(() => window.location.href = '/stations/', 1000);

    } catch (err) {
        console.error("Update Error:", err);
        showToast('Error updating station.', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Update Station";
        }
    }
};
window.deleteStation = async (stationId) => {
    // stationId passed here will now be the String ID (e.g., STSSA00001)
    const confirmed = await showConfirm(
        'Are you sure?',
        `You are about to delete Station ID: ${stationId}`,
        'Yes, delete it!'
    );
    if (confirmed) {
        try {
            // Using String ID in URL which matches your Update logic
            const response = await fetch(`${API_BASE_URL}/stations/${stationId}/delete/`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (response.ok) {
                showToast(`Station ${stationId} deleted.`, 'success');
                // Refresh
                window.fetchAndDisplayStations(); 
            } else {
                throw new Error(`Delete failed`);
            }
        } catch (e) {
            showToast('Error deleting station: ' + e.message, 'error');
        }
    }
}

// ==========================================
// DELETE FUNCTIONS
// ==========================================

window.deleteDevice = async (id) => {
    const confirmed = await showConfirm(
        'Delete Dispenser?',
        `Are you sure you want to delete Dispenser ID: ${id}?`
    );
    if (confirmed) {
        try {
            // API Endpoint: DELETE /bowsers/{id}/
            const response = await fetch(`${API_BASE_URL}/bowsers/${id}/`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            // Check for 204 (No Content) or 200 (OK)
            if (response.status === 204 || response.ok) { 
                showToast(`Dispenser ${id} deleted.`, 'success');
                setTimeout(() => window.location.reload(), 500);
            } else {
                throw new Error(`Delete failed: ${response.status}`);
            }
        } catch (e) {
            console.error("Delete Error:", e);
            showToast('Error deleting device.', 'error');
        }
    }
};

window.deleteTank = async (id) => {
    const confirmed = await showConfirm(
        'Delete Tank?',
        `Are you sure you want to delete Tank ID: ${id}?`
    );
    if (confirmed) {
        try {
            // API Endpoint: DELETE /tanks/{id}/
            const response = await fetch(`${API_BASE_URL}/tanks/${id}/`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.status === 204 || response.ok) {
                showToast(`Tank ${id} deleted.`, 'success');
                setTimeout(() => window.location.reload(), 500);
            } else {
                throw new Error(`Delete failed: ${response.status}`);
            }
        } catch (e) {
            console.error("Delete Error:", e);
            showToast('Error deleting tank.', 'error');
        }
    }
};

window.deleteAsset = async (id) => {
    const confirmed = await showConfirm(
        'Delete Stationary?',
        `Are you sure you want to delete Stationary ID: ${id}?`
    );
    if (confirmed) {
        try {
            // API Endpoint: DELETE /stationaries/{id}/
            // NOTE: We keep this because "Stationary" items are stored in the "stationaries" table
            const response = await fetch(`${API_BASE_URL}/stationaries/${id}/`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.status === 204 || response.ok) {
                showToast(`Stationary ${id} deleted.`, 'success');
                setTimeout(() => window.location.reload(), 500);
            } else {
                throw new Error(`Delete failed: ${response.status}`);
            }
        } catch (e) {
            console.error("Delete Error:", e);
            showToast('Error deleting stationary.', 'error');
        }
    }
};

// ==========================================
// 👤 PROFILE MODAL & PAGE LOGIC (FINAL SECURE VERSION)
// ==========================================

/**
 * 1. Open Profile Modal
 * Replaces logic at Line 1342. Handles both Modal and defensive UI checks.
 */
window.openProfileModal = () => {
    const profileModalEl = document.getElementById('editProfileModal');
    if (!profileModalEl || !currentUser) return;

    // Initialize Bootstrap Modal if not already an instance
    if (typeof bootstrap !== 'undefined' && !profileModal) {
        profileModal = new bootstrap.Modal(profileModalEl);
    }

    // Defensive UI population
    const fieldMap = {
        'profileEmail': currentUser.email,
        'profileRole': currentUser.role,
        'profileName': currentUser.name || currentUser.email.split('@')[0],
        'profilePortalId': currentUser.portalId || 'N/A'
    };

    Object.keys(fieldMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = fieldMap[id];
    });

    // Reset password fields every time modal opens for security
    ['profileCurrentPass', 'profileNewPass', 'profileConfirmPass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    profileModal.show();
};

/**
 * 2. Initialize Standalone Profile Page
 * Replaces old initializeProfilePage to use standardized Bearer logic.
 */
window.initializeProfilePage = function () {
    if (!currentUser) return;

    const elements = {
        name: document.getElementById('profileName'),
        role: document.getElementById('profileRole'),
        portal: document.getElementById('profilePortalId'),
        email: document.getElementById('profileEmail')
    };

    if (elements.name) elements.name.value = currentUser.name || "";
    if (elements.role) elements.role.value = currentUser.role || "";
    if (elements.portal) elements.portal.value = currentUser.portalId || "N/A";
    if (elements.email) elements.email.value = currentUser.email || "";
};

/**
 * 3. Handle Profile Update & Password Change
 * Optimized for Token-based authentication (No password in main body).
 */
window.handleSaveProfile = async function (e) {
    if (e) e.preventDefault();

    const profileName = document.getElementById('profileName')?.value.trim();
    const currentPass = document.getElementById('profileCurrentPass')?.value.trim();
    const newPass = document.getElementById('profileNewPass')?.value.trim();
    const confirmPass = document.getElementById('profileConfirmPass')?.value.trim();

    if (!profileName) return showToast('Name cannot be empty.', 'warning');

    // Password Change Validation
    if (newPass || confirmPass) {
        if (!currentPass) return showToast('Enter Current Password to authorize change.', 'error');
        if (newPass !== confirmPass) return showToast('New passwords do not match.', 'error');
        if (newPass.length < 6) return showToast('New password must be at least 6 characters.', 'warning');
    }

    // ===============================
    // 🔑 SECURE PAYLOAD
    // ===============================
    // Removed 'email' and 'password' from the base body.
    // Identity is proven via 'Authorization: Bearer <token>' in getAuthHeaders().
    const payload = {
        action: 'update_profile', 
        portal_id: currentUser.portalId || "GLOBAL",
        data: {
            user_id: currentUser.id,
            name: profileName,
            // Only send new password if user specifically requested a change
            ...(newPass && { 
                current_password: currentPass, 
                new_password: newPass 
            }) 
        }
    };

    try {
        console.log("[Action] Syncing profile updates via Bearer Token...");

        const res = await fetch(`${API_BASE_URL}/auth/manage/`, {
            method: 'POST',
            headers: getAuthHeaders(), // Injects Bearer Token, TZ-KEY, and PRODUCT-KEY
            body: JSON.stringify(payload)
        });

        const result = await res.json().catch(() => ({}));

        if (res.ok) {
            showToast('Profile updated successfully!', 'success');
            
            // Sync local state
            currentUser.name = profileName;
            
            // If password was changed, update local reference (optional, depends on your login flow)
            if (newPass) {
                localStorage.setItem('user_password', newPass);
                
                // Clear the password fields in UI
                ['profileCurrentPass', 'profileNewPass', 'profileConfirmPass'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.value = '';
                });
            }

            localStorage.setItem('ssaUser', JSON.stringify(currentUser));
            
            // Refresh Header UI
            const userDisplay = document.getElementById('currentUser');
            if (userDisplay) userDisplay.textContent = `User: ${currentUser.email}`;

            if (profileModal) profileModal.hide();
            
        } else {
            showToast(result.detail || result.status || 'Update failed.', 'error');
        }
    } catch (e) {
        console.error("Profile sync error:", e);
        showToast('Network error. Check server connectivity.', 'error');
    }
};


/* ================================================================
   OPEN ALLOCATION MODAL (Fixed for Existing Assignments)
   ================================================================ */
window.openAllocateModal = async (stationCode) => {
    const userRole = currentUser?.role?.toLowerCase();

    if (userRole !== 'super admin' && userRole !== 'admin') {
        return showToast('Access Denied.', 'error');
    }
    
    // 1. Ensure latest directory and assignments are loaded
    if (allAssignableUsers.length === 0) await window.fetchAdminsAndUsers();
    await window.fetchAssignmentsMap(); 

    // 2. Find the station in memory
    const station = allStationsData.find(s => String(s.station_id) === String(stationCode) || String(s.id) === String(stationCode));
    if (!station) return;

    const modalEl = document.getElementById('allocationModal');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);

    document.getElementById('allocateStationId').value = stationCode;
    const select = document.getElementById('allocateUserSelect');
    
    // ✅ FIX: Get the CURRENT owner's ID from the global assignments map
    // This ensures that if 'john' owns it, 'john' is selected in the dropdown.
    const currentOwner = globalStationAssignments[String(stationCode).trim()];
    const currentOwnerId = currentOwner ? currentOwner.id : "";

    // 3. UI logic
    const roleSelector = document.getElementById('assignRoleSelector');
    if (roleSelector) roleSelector.style.display = 'none'; // Hide radio buttons

    // 4. Populate dropdown with pre-selected ID
    window.populateAllocationDropdown(select, currentOwnerId);

    modalInstance.show();
};
window.fetchAssignmentsMap = async function () {

    if (window.__assignmentSyncRunning) return;
    window.__assignmentSyncRunning = true;

    try {

        // ✅ FORCE DIRECTORY READY
        if (!allAssignableUsers || allAssignableUsers.length === 0) {
            await window.fetchAdminsAndUsers();
        }

        const data = await smartFetch(`/assignments/all/?_t=${Date.now()}`);
        if (!Array.isArray(data)) return;

        const newMap = {};

        data.forEach(record => {

            const station = record.station || {};

            const keys = [
                String(record.station_id || ""),
                String(station.station_id || ""),
                String(station.id || "")
            ].filter(k => k.trim());

            const userId =
                record.user_id ||
                record.user?.id ||
                record.user;

            // ✅ MATCH FROM DIRECTORY
            const matchedUser = allAssignableUsers.find(u => String(u.id) === String(userId));

            const name =
                matchedUser?.name ||
                matchedUser?.email ||
                "Assigned";

            keys.forEach(key => {
                newMap[key.trim()] = {
                    id: userId,
                    name: name
                };
            });

        });

        globalStationAssignments = newMap;

        if (document.getElementById('allStationsTableBody')) {
            populateAllStationsTable(allStationsData);
        }

    } catch (e) {
        console.error("[Assignments] Bulk fetch failed:", e);BBBB
    } finally {
        window.__assignmentSyncRunning = false;
    }
};

/* ================================================================
   SAVE ALLOCATION (STRICT SWAGGER COMPLIANT)
   Fixes AttributeError by removing the manual 'admin_id'
   ================================================================ */
window.saveAllocation = async () => {
    const stationIdEl = document.getElementById('allocateStationId');
    const userSelectEl = document.getElementById('allocateUserSelect');

    if (!stationIdEl || !userSelectEl) return showToast('UI Error', 'error');

    const stationId = stationIdEl.value.trim();
    const selectedUserId = userSelectEl.value;

    if (!selectedUserId) return showToast('Please select a user.', 'warning');

    // ✅ THE FIX: Only send what Swagger actually requires.
    // The backend uses your Bearer Token to identify you as the assigner.
    const payload = {
        user_id: parseInt(selectedUserId),
        station_id: stationId
    };

    try {
        console.log("[Allocation] Sending Clean Payload:", payload);
        
        const response = await fetch(`${API_BASE_URL}/assignments/assign/`, {
            method: 'POST',
            headers: getAuthHeaders(), // 🛡️ Includes TZ-KEY and Authorization: Bearer <token>
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok || response.status === 201) {
            showToast('Station assigned successfully!', 'success');
            
            // Close the modal
            const modalEl = document.getElementById('allocationModal');
            if (modalEl) {
                const instance = bootstrap.Modal.getInstance(modalEl);
                if (instance) instance.hide();
            }

            // Refresh the UI data
            await window.fetchAssignmentsMap(); 
            if (typeof window.fetchAndDisplayStations === 'function') {
                window.fetchAndDisplayStations(); 
            }
        } else {
            // Log the backend error (e.g., station already assigned)
            const errorMsg = result.detail || result.status || 'Assignment failed.';
            showToast(errorMsg, 'error');
            console.error("[Backend Reject]:", result);
        }
    } catch (e) {
        console.error("Allocation Network Error:", e);
        showToast('Network error. Check server connectivity.', 'error');
    }
};

window.openMqttSettings = (deviceId) => {
    if (!settingsModal) return;
    const mockDeviceData = {
        id: deviceId,
        status: 'Disabled',
        description: 'Mock description for ' + deviceId,
        mqttId: '123456789012'
    };
    document.getElementById('settingsModalLabel').textContent = `Configuration for ${mockDeviceData.id}`;
    document.getElementById('settingDeviceId').value = mockDeviceData.id;
    document.getElementById('settingDeviceName').value = mockDeviceData.id;
    document.getElementById('settingStatus').value = mockDeviceData.status;
    document.getElementById('settingDescription').value = mockDeviceData.description;
    document.getElementById('settingMqttId').value = mockDeviceData.mqttId;
    settingsModal.show();
}
// --- Function to open Create Admin Modal ---
window.openCreateAdminModal = () => {
    const form = document.getElementById('adminModalForm');
    if (form) form.reset();
    
    document.getElementById('editAdminId').value = '';
    document.getElementById('adminModalLabel').textContent = 'Create New Admin';
    document.getElementById('saveAdminButton').textContent = 'Save Admin';
    
    // Portal ID should be editable for new admins
    document.getElementById('adminPortalId').readOnly = false;
    
    // Show password container for new admins
    document.getElementById('adminPassContainer').style.display = 'block';

    // ✅ DEFAULT DISPLAY TO INACTIVE
    // Targets the dropdown to ensure it shows Inactive when the form opens
    const statusSelect = document.getElementById('adminStatus');
    if (statusSelect) {
        statusSelect.value = "Inactive";
    }
    
    // Show the modal using the reliable instance method
    const modalEl = document.getElementById('adminModal');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
};

// --- Function to open Edit Admin Modal ---
window.openEditAdminModal = (id) => {
    // Look up admin in the global mockAdminData list
    const admin = mockAdminData.find(a => String(a.id) === String(id));
    if (!admin) return showToast("Admin data not found", "error");

    document.getElementById('editAdminId').value = id;
    document.getElementById('adminName').value = admin.name || "";
    document.getElementById('adminEmail').value = admin.email || "";
    document.getElementById('adminPortalId').value = admin.portal_id || "";
    
    // Note: Use 'adminStatus' to match the HTML ID I fixed below
    document.getElementById('adminStatus').value = admin.status || "Active";

    document.getElementById('adminModalLabel').textContent = 'Edit Admin Details';
    document.getElementById('saveAdminButton').textContent = 'Update Admin';
    
    // Portal ID is usually unique and non-editable once created
    document.getElementById('adminPortalId').readOnly = true;
    
    // Hide password field for edits (handled via profile/reset usually)
    document.getElementById('adminPassContainer').style.display = 'none';

    new bootstrap.Modal(document.getElementById('adminModal')).show();
};
window.openViewUsersModal = (adminId, adminName) => {
    if (!viewUsersModal) return;
    currentAdminId = adminId;
    document.getElementById('viewUsersAdminName').textContent = adminName;
    populateUsersTable(adminId);
    viewUsersModal.show();
}
window.openCreateUserModal = () => {
    const form = document.getElementById('userModalForm');
    if (form) form.reset();

    document.getElementById('editUserId').value = '';
    document.getElementById('userModalLabel').textContent = 'Create New User';
    document.getElementById('saveUserButton').textContent = 'Save User';

    // 🔐 PASSWORD RESET
    const passInput = document.getElementById('userPassword');
    if (passInput) {
        passInput.value = "";
        passInput.disabled = false;
        passInput.required = true;
    }

    // ✅ UNLOCK USER UNIQUE PORTAL ID (so you can type)
    const userUniqueIdInput = document.getElementById('userUniquePortalId');
    if (userUniqueIdInput) {
        userUniqueIdInput.value = "";
        userUniqueIdInput.readOnly = false;
        userUniqueIdInput.disabled = false;
        userUniqueIdInput.classList.remove('bg-light');
    }

    // ADMIN PORTAL LOCK LOGIC (unchanged)
    const adminPortalInput = document.getElementById('userPortalId');
    const userRole = currentUser?.role?.toLowerCase();

    if (adminPortalInput) {
        if (userRole === 'admin') {
            adminPortalInput.value = currentUser.portalId;
            adminPortalInput.readOnly = true;
            adminPortalInput.classList.add('bg-light');
        } else {
            adminPortalInput.value = "";
            adminPortalInput.readOnly = false;
            adminPortalInput.classList.remove('bg-light');
        }
    }

    // DEFAULT STATUS
    const statusSelect = document.getElementById('userStatus');
    if (statusSelect) statusSelect.value = "Inactive";

    // SHOW MODAL
    const modalEl = document.getElementById('userModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
};


window.openEditUserModal = (id) => {
    // 1. Find user in the local data
    const user = mockUserData.find(u => String(u.id || u.user_id) === String(id));
    if (!user) return showToast("User data not found", "error");

    // ✅ Ensure created_on exists (fallback for new users)
    if (!user.created_on) {
        user.created_on = new Date().toISOString();
    }

    // 2. Populate Basic Fields
    document.getElementById('editUserId').value = id;
    document.getElementById('userName').value = user.name || "";
    document.getElementById('userEmail').value = user.email || "";

    // 3. Populate Portal IDs (FIXED)
    const adminPortalInput = document.getElementById('userPortalId');       // Grouping Bar (Admin String)
    const userUniqueIdInput = document.getElementById('userUniquePortalId'); // Identity Bar (User String)

    if (userUniqueIdInput) {
        userUniqueIdInput.value = user.portal_id || "";

        // ✅ lock user portal ID on edit
        userUniqueIdInput.readOnly = true;
        userUniqueIdInput.classList.add('bg-light');
    }

    if (adminPortalInput) {
        if (currentUser.role.toLowerCase() === "admin") {
            // Admin role: Strictly lock to their own portal
            adminPortalInput.value = currentUser.portalId;
            adminPortalInput.readOnly = true;
            adminPortalInput.classList.add('bg-light');
        } else {
            // Super Admin logic preserved
            const parentAdmin = mockAdminData.find(a => String(a.id) === String(user.admin_id));
            const adminString = parentAdmin ? parentAdmin.portal_id : (user.admin_portal_id || "");

            adminPortalInput.value = adminString;
            adminPortalInput.readOnly = false;
            adminPortalInput.classList.remove('bg-light');
        }
    }

    // 4. FIX: Robust Status mapping
    const statusSelect = document.getElementById('userStatus');
    if (statusSelect) {
        const rawStatus = String(user.status || '').toLowerCase().trim();
        const isActive = (rawStatus === 'active' || user.status === true);
        statusSelect.value = isActive ? "Active" : "Inactive";
    }

    // 5. Password Security Lock
    const passInput = document.getElementById('userPassword');
    if (passInput) {
        passInput.value = "********";
        passInput.disabled = true;
        passInput.required = false;
    }

    // 6. Show Modal
    document.getElementById('userModalLabel').textContent = 'Edit User Details';
    const modalEl = document.getElementById('userModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

window.saveAdminChanges = async () => {
    const id = document.getElementById('editAdminId').value;
    const isEdit = id !== "";

    // 1. Get Form Values
    const adminPortalId = document.getElementById('adminPortalId').value.trim().toUpperCase();
    const adminName = document.getElementById('adminName').value.trim();
    const adminEmail = document.getElementById('adminEmail').value.trim();
    const adminStatus = document.getElementById('adminStatus').value;
    const adminPasswordInput = document.getElementById('adminPassword');
    const adminPassword = adminPasswordInput ? adminPasswordInput.value : "123456";

    // ============================================================
    // 2. STRICT VALIDATIONS
    // ============================================================

    // A. Gmail Validation
    if (!adminEmail.toLowerCase().endsWith('@gmail.com')) {
        return showToast('Invalid Email! Must be a valid @gmail.com address.', 'error');
    }

    // B. Password Validation (6-10 characters)
    const isPassVisible = document.getElementById('adminPassContainer')?.style.display !== 'none';
    if (!isEdit || isPassVisible) {
        if (adminPassword.length < 6 || adminPassword.length > 10) {
            return showToast('Password must be between 6 and 10 characters.', 'error');
        }
    }

    // C. Duplicate Portal ID Check (Local)
    if (!isEdit) { 
        const isDuplicate = mockAdminData.some(admin => (admin.portal_id || '').toUpperCase() === adminPortalId);
        if (isDuplicate) return showToast(`Error: Portal ID "${adminPortalId}" already exists!`, 'error');
    }

    // D. Admin ID Pattern (AD + 8 digits)
    const adminIdPattern = /^AD\d{8}$/;
    if (!isEdit && !adminIdPattern.test(adminPortalId)) {
        return showToast('Invalid Admin ID! Format: AD + 8 digits.', 'error');
    }

    // ============================================================
    // 3. CONSTRUCT PAYLOAD
    // ============================================================
    const payload = {
        email: currentUser.email,
        password: currentUser.password || localStorage.getItem('user_password'),
        action: isEdit ? "update_admin" : "create_admin",
        portal_id: currentUser.portalId || "GLOBAL",
        data: {
            name: adminName,
            email: adminEmail,
            portal_id: adminPortalId,
            status: adminStatus.toLowerCase(),

            role: "Admin"
        }
    };

    if (isEdit) {
        payload.data.id = parseInt(id); 
        payload.data.admin_id = parseInt(id);
    } else {
        payload.data.password = adminPassword;
    }

    try {
        console.log(`[Admin Sync] Sending ${payload.action}...`);
        showToast('Saving to database...', 'info');
        
        const res = await fetch(`${API_BASE_URL}/auth/manage/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        // ============================================================
        // 4. THE TIMESTAMP & 500 ERROR FIX
        // ============================================================
        
        // A. Wait 800ms to allow the DB to finalize the 'created_on' timestamp
        await new Promise(resolve => setTimeout(resolve, 800));

        // B. Refresh the list from the server immediately
        await window.fetchAdminsAndUsers();

        // C. Verify success by checking the updated local list (ignores server 500 crashes)
        const wasFoundInList = mockAdminData.some(a => (a.portal_id || '').toUpperCase() === adminPortalId);

        if (res.ok || wasFoundInList) {
            showToast(isEdit ? 'Admin Updated!' : 'Admin Created Successfully!', 'success');
            
            const modalEl = document.getElementById('adminModal');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }
        } else {
            showToast('Save failed. Please check your credentials.', 'error');
        }

    } catch (e) { 
        console.warn("Handled Sync Exception:", e.message);
        
        // Emergency Fallback: If JSON parsing failed due to HTML 500 error, sync anyway
        await new Promise(resolve => setTimeout(resolve, 1000));
        await window.fetchAdminsAndUsers();
        
        const modalEl = document.getElementById('adminModal');
        if (modalEl) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        }
        
        showToast('Operation complete. List synchronized.', 'success');
    }
};

/* ================================================================
   🚀 ULTRA-FAST LAZY LOADER (SUPER ADMIN OPTIMIZED)
   Fixes: UI Blocking, Dashboard Lag, and Assignment Delays.
   ================================================================ */
window.fetchAndDisplayStations = async function() {
    const tableBody = document.getElementById('allStationsTableBody');
    const isDashboard = !!document.getElementById('transactionChart');
    
    // 🏎️ 1. INSTANT CACHE RECOVERY
    const cachedData = sessionStorage.getItem('ssa_stations_cache');
    if (cachedData && tableBody) {
        allStationsData = JSON.parse(cachedData);
        currentFilteredStations = allStationsData;
        populateAllStationsTable(allStationsData);
        console.log("[Speed] UI restored from cache. Syncing fresh data in background...");
    } else if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Initializing Secure Directory...</td></tr>';
    }

    try {
        const queryParams = getQueryCredentials();
        const cb = `_t=${Date.now()}`;
        
        // ⚡ 2. PRIORITY FETCH: Load Stations FIRST
        // We do not wait for the heavy directory sync to start rendering.
   // ✅ NEW: Removed queryParams, kept the cache-buster (cb)
const stationsRes = await smartFetch(`/stations/list/?${cb}`);
        const rawStations = Array.isArray(stationsRes) ? stationsRes : (stationsRes.stations || []);

        // 🛡️ 3. HIGH-PERFORMANCE DEDUPLICATION
        const uniqueMap = new Map();
        rawStations.forEach(s => uniqueMap.set(String(s.station_id || s.id), s));
        allStationsData = Array.from(uniqueMap.values());

        // 💾 4. UPDATE CACHE & INITIAL RENDER (Render now, even without user names)
        sessionStorage.setItem('ssa_stations_cache', JSON.stringify(allStationsData));
        currentFilteredStations = allStationsData;
        if (tableBody) populateAllStationsTable(allStationsData);

        // ⚡ 5. BACKGROUND HYDRATION (The "Heavy" Stuff)
        // Fire directory sync and assignment mapping WITHOUT 'await'
        // This allows the table to stay interactive while the API works.
        const backgroundTasks = [
            allAssignableUsers.length === 0 ? window.fetchAdminsAndUsers() : Promise.resolve(),
            window.fetchAssignmentsMap()
        ];

        Promise.allSettled(backgroundTasks).then(() => {
            console.log("[Speed] Relational data hydrated. Updating assignment badges...");
            // Re-render the table silently to fill in the "Assigned To" names
            if (tableBody) populateAllStationsTable(allStationsData);
            
            // Hydrate the dashboard graph if we are on the dashboard
            if (isDashboard && typeof fetchDashboardData === 'function') {
                fetchDashboardData();
            }
        });

        // 📈 6. DASHBOARD TRANSACTIONS (Delayed start to prevent CPU spike)
        if (typeof window.fetchTransactions === 'function') {
            setTimeout(window.fetchTransactions, 800);
        }

    } catch (e) {
        console.error("[Performance Fix] Parallel Load Failed:", e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // ... other code ...
    const stationSearch = document.getElementById('stationSearchInput');
    if (stationSearch) {
        stationSearch.addEventListener('input', (e) => {
            filterStationTable(e.target.value);
        });
    }
});
// Inside DOMContentLoaded...
const generateBtn = document.querySelector('button[onclick="window.renderReportTable()"]') || document.getElementById('generateReport');
if (generateBtn) {
    generateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.renderReportTable();
    });
}

const exportBtn = document.querySelector('button[onclick="window.openExportConfig()"]') || document.getElementById('exportReport');
if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.openExportConfig();
    });
}
/**
 * NEW: Generates the HTML for pagination buttons
 */
function renderStationPaginationControls(totalPages, container) {
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    let html = `<li class="page-item ${stationCurrentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="changeStationPage(${stationCurrentPage - 1}); return false;">Prev</a>
                </li>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === stationCurrentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changeStationPage(${i}); return false;">${i}</a>
                 </li>`;
    }

    html += `<li class="page-item ${stationCurrentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changeStationPage(${stationCurrentPage + 1}); return false;">Next</a>
             </li>`;
    container.innerHTML = html;
}

window.changeStationPage = function(page) {
    if (page < 1) return;
    stationCurrentPage = page;
    populateAllStationsTable(currentFilteredStations);
};

window.saveUserChanges = async () => {
    const idValue = document.getElementById('editUserId').value;
    const isEdit = idValue !== "";

    const userName = document.getElementById('userName').value.trim();
    const userEmail = document.getElementById('userEmail').value.trim();
    const userStatus = document.getElementById('userStatus').value;

    const userSpecificId = document
        .getElementById('userUniquePortalId')
        .value
        .trim()
        .toUpperCase();

    const adminPortalId = document
        .getElementById('userPortalId')
        ?.value
        ?.trim();

    const userRole = currentUser.role.toLowerCase().replace(/\s+/g, '');

    // ✅ Portal validation
    const portalRegex = /^\d{1,8}$/;

    if (!userName || !userEmail || (!isEdit && !userSpecificId)) {
        return showToast('Name, Email, and User ID are required.', 'warning');
    }

    if (!isEdit && userSpecificId.length !== 10) {
    return showToast("User Unique ID must be exactly 10 characters.", "warning");
}

    // 🔥 BASE PAYLOAD
    const payload = {
        email: currentUser.email,
        password: currentUser.password || localStorage.getItem('user_password'),
        action: isEdit ? "update_user" : "create_user",
        data: {
            role: "user",
            name: userName,
            email: userEmail,
            status: userStatus
        }
    };

    // =========================
    // CREATE USER
    // =========================
    if (!isEdit) {
        payload.data.portal_id = userSpecificId;
        payload.data.user_specific_id = userSpecificId;
        payload.data.password =
            document.getElementById('userPassword')?.value || "123456";

        // 🔥 ONLY SUPERADMIN sends admin portal
        if (userRole === "superadmin") {
            if (!adminPortalId) {
                return showToast("Admin Portal ID required", "warning");
            }
            payload.data.admin_portal_id = adminPortalId;
        }
    }

    // =========================
    // UPDATE USER
    // =========================
    if (isEdit) {
        payload.data.id = Number(idValue);
        payload.data.user_id = Number(idValue);

        // superadmin can reassign admin
        if (userRole === "superadmin" && adminPortalId) {
            payload.data.admin_portal_id = adminPortalId;
        }
    }

    console.log("Sending payload:", payload);

    try {
        const res = await fetch(`${API_BASE_URL}/auth/manage/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (res.ok) {
            showToast(
                isEdit ? 'User Updated Successfully!' : 'User Created Successfully!',
                'success'
            );

            const modal = bootstrap.Modal.getInstance(
                document.getElementById('userModal')
            );
            modal?.hide();

            await window.fetchAdminsAndUsers();
        } else {
            showToast(result.status || 'Operation failed', 'error');
        }

    } catch (err) {
        console.error("Save User Error:", err);
        showToast('User Email already exists. ', 'error');
    }
};


window.deleteAdmin = async (id) => {
    const confirmed = await showConfirm('Delete Admin', 'Are you sure you want to permanently delete this admin?');
    if (!confirmed) return;

    const payload = {
        email: currentUser.email,
        password: currentUser.password || localStorage.getItem('user_password'),
        action: "delete_admin",
        portal_id: currentUser.portalId || "GLOBAL",
        data: { admin_id: id }
    };

    try {
        const res = await fetch(`${API_BASE_URL}/auth/manage/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast('Admin deleted successfully');
            window.fetchAdminsAndUsers();
        }
    } catch (e) { showToast('Delete failed', 'error'); }
};

window.deleteUser = async (id) => {
    // 1. Ask for confirmation using SweetAlert
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this user deletion!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    // 2. Construct the payload
    const payload = {
        email: currentUser.email,
        password: currentUser.password || localStorage.getItem('user_password'),
        action: "delete_user",
        portal_id: currentUser.portalId || "GLOBAL",
        data: { 
            // FIX: Backend strictly looks for 'id' based on the traceback
            id: id,
            user_id: id 
        }
    };

    try {
        const res = await fetch(`${API_BASE_URL}/auth/manage/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('User deleted successfully', 'success');
            // 3. Refresh the table to remove the deleted row
            await window.fetchAdminsAndUsers(); 
        } else {
            const err = await res.json();
            showToast(err.status || 'Delete failed', 'error');
        }
    } catch (e) {
        showToast('Network error during deletion', 'error');
    }
};

window.openViewStationsModal = async (userId, userName) => {
    const modalEl = document.getElementById('viewStationsModal');
    if (!modalEl) return;
    
    let modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (!modalInstance) {
        modalInstance = new bootstrap.Modal(modalEl);
    }
    
    document.getElementById('viewStationsUserName').textContent = userName;
    const tableBody = document.getElementById('viewStationsTableBody');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner-border spinner-border-sm text-primary"></div> Verifying current ownership...</td></tr>';

    modalInstance.show();

    try {
        // 1. REFRESH MAP: Ensure we know who the *latest* owner is for every station
        // This builds the 'globalStationAssignments' map using the "Latest ID Wins" logic
        await window.fetchAssignmentsMap();

        // ✅ NEW: Clean URL. Removed queryParams, kept the timestamp (_t) for fresh data.
const historyData = await smartFetch(`/assignments/user/${userId}/?_t=${Date.now()}`);
        
        if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
             tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No stations assigned.</td></tr>';
             return;
        }

        // 2. FILTERING LOGIC
        const seenIds = new Set();
        const validRows = [];

        historyData.forEach(record => {
            const s = record.station || record;
            const sId = String(s.station_id || s.id || "N/A");
            
            // A. Remove visual duplicates (API artifacts)
            if (seenIds.has(sId)) return;
            seenIds.add(sId);

            // ============================================================
            // B. OWNERSHIP CHECK (The Fix for "Multiple Users")
            // ============================================================
            // Check the Global Map to see who CURRENTLY owns this station.
            const realOwner = globalStationAssignments[sId];
            
            // If the map says someone else owns it, do not show it here.
            // (This handles cases where the DB has old history rows)
            if (realOwner && String(realOwner.id) !== String(userId)) {
                // console.log(`[Hidden] Station ${sId} belongs to ${realOwner.name}, not ${userName}`);
                return; 
            }

            // Render
            const statusBadge = (String(s.status || 'Active').toLowerCase() === 'active') ? 'bg-success' : 'bg-danger';
            
            validRows.push(`
                <tr>
                    <td>${sId}</td>
                    <td>${s.station_name || s.name || 'N/A'}</td>
                    <td>${s.location || 'N/A'}</td>
                    <td><span class="badge ${statusBadge}">${s.status || 'Active'}</span></td>
                </tr>
            `);
        });

        if (validRows.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No active stations (History only).</td></tr>';
        } else {
            tableBody.innerHTML = validRows.join('');
        }

    } catch (e) { 
        console.error("View Stations Error:", e);
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading data.</td></tr>'; 
    }
};


/**
 * DIRECTORY SYNC ENGINE
 * Fetches and normalizes Admins and Users based on the current session role.
 * Synchronized with Bearer Token Auth and Global Handshake.
 */
window.fetchAdminsAndUsers = async function () {

    // ===============================
    // 0. NORMALIZE CURRENT USER
    // ===============================
    const roleRaw = currentUser?.role || "";
    const userRole = roleRaw.toLowerCase().replace(/\s+/g, '');

    // Super Admin gets GLOBAL portal automatically
    const portal = currentUser.portalId || (userRole === "superadmin" ? "GLOBAL" : "");

    // Security guard
    if (userRole !== 'superadmin' && userRole !== 'admin') {
        console.warn("[Directory] Unauthorized access attempt:", userRole);
        return;
    }

    console.log(`[Directory] Sync start | role=${userRole} | portal=${portal}`);

    try {

        // ===============================
        // 1. BASE PAYLOAD
        // ===============================
        const basePayload = {
            portal_id: portal,
            data: {}
        };

        // ===============================
        // 2. NORMALIZER
        // ===============================
        const normalizeList = (response, defaultRole = 'User') => {

            const rawList =
                Array.isArray(response)
                    ? response
                    : response?.data || response?.users || response?.admins || [];

            const map = new Map();

            rawList.forEach(u => {

                const uid = u.id || u.user_id || u.admin_id;
                if (!uid || map.has(String(uid))) return;

                const rawStatus =
                    u.status ||
                    (u.is_active === false ? 'Inactive' : 'Active');

                const status =
                    rawStatus.charAt(0).toUpperCase() +
                    rawStatus.slice(1).toLowerCase();

                map.set(String(uid), {
                    id: uid,
                    name: u.name || (u.email ? u.email.split('@')[0] : 'Unknown'),
                    email: u.email || '',
                    portal_id: u.portal_id || 'GLOBAL',
                    role: u.role || defaultRole,
                    status: status,
                    created_on: u.created_on || u.created_at || null,
                    admin_id: u.admin_id || null
                });

            });

            return Array.from(map.values());
        };

        // ===============================
        // 3. FETCH USERS
        // ===============================
        const userRes = await smartFetch('/auth/manage/', {
            method: 'POST',
            body: JSON.stringify({
                ...basePayload,
                action: 'get_users'
            })
        });

        mockUserData = normalizeList(userRes, 'User');

        // ===============================
        // 4. FETCH ADMINS (SUPERADMIN ONLY)
        // ===============================
        if (userRole === 'superadmin') {

            const adminRes = await smartFetch('/auth/manage/', {
                method: 'POST',
                body: JSON.stringify({
                    ...basePayload,
                    action: 'get_admins'
                })
            });

            mockAdminData = normalizeList(adminRes, 'Admin');

        } else {
            mockAdminData = [];
        }

        // ===============================
        // 5. MERGE DIRECTORY
        // ===============================
        allAssignableUsers = [...mockAdminData, ...mockUserData];

        console.log(`[Directory] Hydrated: admins=${mockAdminData.length}, users=${mockUserData.length}`);

        // ===============================
        // 6. UI HYDRATION
        // ===============================
        const path = window.location.pathname;

        if (path.includes('/users/') && typeof window.populateUserTable === 'function') {
            window.populateUserTable(mockUserData);
        }

        if (path.includes('/admins/') && typeof window.populateAdminTable === 'function') {
            window.populateAdminTable(mockAdminData);
        }

        if (document.getElementById('vsTotalCount') && typeof updateDashboardStats === 'function') {
            updateDashboardStats();
        }

        console.log(`[Directory] Sync complete: total=${allAssignableUsers.length}`);

    } catch (error) {
        console.error('[Directory Fail] fetchAdminsAndUsers:', error);
    }
};
window.populateAdminTable = function (data) {

    const tableBody = document.getElementById('adminListTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) {
        tableBody.innerHTML =
            '<tr><td colspan="7" class="text-center p-4 text-muted">No admins found in the directory.</td></tr>';
        return;
    }

    data.forEach((admin, index) => {

        // ===============================
        // SAFE NORMALIZATION
        // ===============================
        const id = admin.id || admin.admin_id || '';
        const name = admin.name || 'Unknown';
        const email = admin.email || '—';

        const portalId = admin.portal_id || 'GLOBAL';

        const rawStatus = (admin.status || 'inactive').toLowerCase().trim();
        const statusText =
            rawStatus === 'active' ? 'Active' : 'Inactive';

        const statusClass =
            rawStatus === 'active' ? 'bg-success' : 'bg-danger';

        // Safe date formatting
        let createdOn = '—';
        if (admin.created_on) {
            createdOn = typeof formatSSADate === 'function'
                ? formatSSADate(admin.created_on)
                : new Date(admin.created_on).toLocaleString();
        }

        // UI portal style
        const pIdDisplay =
            `<span class="fw-bold" style="color:#d63384;">${portalId}</span>`;

        // ===============================
        // RENDER ROW
        // ===============================
        const row = tableBody.insertRow();
        row.className = "align-middle";

        row.innerHTML = `
            <td class="text-center">${index + 1}</td>

            <td class="text-start fw-bold">
                <a href="#" class="text-decoration-none text-primary"
                   onclick="window.openViewUsersModal('${id}', '${name}'); return false;">
                   ${name}
                </a>
            </td>

            <td class="text-start">${email}</td>

            <td class="text-start">${pIdDisplay}</td>

            <td class="text-center">
                <span class="badge ${statusClass}">
                    ${statusText}
                </span>
            </td>

            <td class="text-center small">${createdOn}</td>

            <td class="text-end pe-4">
                <div class="d-inline-flex gap-2">
                    <button class="btn btn-sm btn-info text-white"
                            title="Edit Admin"
                            onclick="window.openEditAdminModal('${id}')">
                        <i class="bi bi-pencil-square"></i>
                    </button>

                    <button class="btn btn-sm btn-outline-danger"
                            title="Delete Admin"
                            onclick="window.deleteAdmin('${id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
    });
};


// --- USER SEARCH & TABLE RENDERER ---
const userSearchInput = document.getElementById('userSearchInput');
if (userSearchInput) {
    userSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        
        // If search is empty, show full list
        if (!term) {
            window.populateUserTable(mockUserData);
            return;
        }

        const filteredUsers = mockUserData.filter(user => {
            const name = (user.name || "").toLowerCase();
            const email = (user.email || "").toLowerCase();
            const pId = (user.portal_id || "").toLowerCase();
            
            return name.includes(term) || 
                   email.includes(term) || 
                   pId.includes(term);
        });

        window.populateUserTable(filteredUsers);
    });
}

window.populateUserTable = function (data) {
    const tableBody = document.getElementById('manageUsersTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted">No users found for this portal.</td></tr>';
        return;
    }

    data.forEach((user, index) => {
        // 1. Unified ID Handling (from normalized fetch)
        const id = user.id || user.user_id;
        
        // 2. Status Mapping (Normalized for backend consistency)
        const rawStatus = (user.status || 'Inactive').trim();
        const isActuallyActive = rawStatus.toLowerCase() === 'active';
        const statusBadgeClass = isActuallyActive ? 'bg-success' : 'bg-danger';

        // 3. UI Styling
        // Using the same pinkish-red color for Portal IDs as the Admin list
        const pIdDisplay = `<span class="fw-bold" style="color: #d63384;">${user.portal_id || 'N/A'}</span>`;
        const createdOn = formatSSADate(user.created_on);

        const row = tableBody.insertRow();
        row.className = "align-middle"; // Ensures vertical center alignment
        row.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td class="fw-bold">
                <a href="#" class="text-decoration-none text-primary" 
                   onclick="window.openViewStationsModal('${id}', '${user.name}'); return false;">
                   ${user.name}
                </a>
            </td>
            <td>${user.email}</td>
            <td>${pIdDisplay}</td>
            <td class="text-center">
                <span class="badge ${statusBadgeClass}">${rawStatus.toUpperCase()}</span>
            </td>
            <td class="text-center small">${createdOn}</td>
            <td>
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-sm btn-info text-white" title="Edit User" 
                            onclick="window.openEditUserModal('${id}')">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" title="Delete User" 
                            onclick="window.deleteUser('${id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
    });
};/* ================================================================
   ALLOCATION DROPDOWN (Fixed Pre-selection & Admin Name Display)
   ================================================================ */
window.populateAllocationDropdown = function(selectElement, currentAssignmentId) {
    if (!selectElement) return;

    if (!allAssignableUsers.length) {
        selectElement.innerHTML = '<option value="">-- No Users Found --</option>';
        return;
    }

    // 1. Filter for 'User' roles only
    const usersOnly = allAssignableUsers.filter(u => String(u.role).toLowerCase() === 'user');

    let optionsHTML = '<option value="">-- Unassigned --</option>';
    
    // 2. Build options showing: "User Name [Admin: Name]"
    usersOnly.forEach(user => {
        // Find parent admin name from global directory
        const parentAdmin = mockAdminData.find(a => String(a.id) === String(user.admin_id));
        const adminNameDisplay = parentAdmin ? ` [Admin: ${parentAdmin.name}]` : ' [No Admin]';

        // ✅ CRITICAL FIX: Ensure IDs match as strings to handle pre-selection
        const isSelected = (String(currentAssignmentId) === String(user.id)) ? 'selected' : '';

        optionsHTML += `<option value="${user.id}" ${isSelected}>${user.name}${adminNameDisplay}</option>`;
    });

    selectElement.innerHTML = optionsHTML;
};
// --- FIX: Disable/Enable Admin using allowed 'update_admin' action ---
window.disableAdmin = async (adminId) => {
    const admin = mockAdminData.find(a => String(a.admin_id || a.id) === String(adminId));
    if (!admin) return;

    if (admin.email === 'ssa@gmail.com') return showToast('Cannot disable root admin', 'error');

    const newStatus = admin.status === 'Active' ? 'inactive' : 'active';
    const confirmed = await showConfirm('Status Change', `Set ${admin.name} to ${newStatus}?`);
    if (!confirmed) return;

    try {
        const payload = {
            email: currentUser.email,
            password: currentUser.password || localStorage.getItem('user_password'),
            action: "update_admin", // MUST be from the allowed list
            portal_id: currentUser.portalId || "GLOBAL",
            data: { 
                admin_id: parseInt(adminId),
                status: newStatus // Sending status update through the update action
            }
        };

        const res = await fetch(`${API_BASE_URL}/auth/manage/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast(`Admin status updated to ${newStatus}`, 'success');
            await window.fetchAdminsAndUsers();
        } else {
            const err = await res.json();
            showToast(err.status || 'Failed', 'error');
        }
    } catch (e) { showToast('Error', 'error'); }
};

// --- FIX: Disable/Enable User using allowed 'update_user' action ---
window.disableUser = async (userId) => {
    const user = mockUserData.find(u => String(u.id || u.user_id) === String(userId));
    if (!user) return;

    const newStatus = user.status === 'Active' ? 'inactive' : 'active';
    const confirmed = await showConfirm('Status Change', `Set ${user.name} to ${newStatus}?`);
    if (!confirmed) return;

    try {
        const payload = {
            email: currentUser.email,
            password: currentUser.password || localStorage.getItem('user_password'),
            action: "update_user", // MUST be from the allowed list
            portal_id: currentUser.portalId || "GLOBAL",
            data: { 
                user_id: parseInt(userId),
                status: newStatus 
            }
        };

        const res = await fetch(`${API_BASE_URL}/auth/manage/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast(`User set to ${newStatus}`, 'success');
            await window.fetchAdminsAndUsers();
        }
    } catch (e) { showToast('Error', 'error'); }
};

window.openTransactionDetail = (transactionId) => {
    if (!transactionDetailModal) return;

    const txn = currentTransactionData.find(t => t.id === transactionId);
    if (!txn) {
        showToast('Error: Transaction not found.', 'error');
        return;
    }

    // 1. Populate Transaction Header
    document.getElementById('transactionDetailId').textContent = txn.id;

    // 2. ✅ Update Device ID Label (Matches your request to remove 'Station')
    // This targets the specific element in your HTML modal
    const deviceIdValue = txn.deviceId || 'N/A';
    document.getElementById('detail-stationName').textContent = deviceIdValue;

    // 3. Populate Remaining Receipt Details
    document.getElementById('detail-deviceType').textContent = 
        `${txn.type} (${txn.bowserId} | Pump: ${txn.pumpId})`;

    document.getElementById('detail-volAmt').textContent = 
        `${(txn.vol || 0).toFixed(2)} Ltr / ₹${(txn.amt || 0).toFixed(2)}`;

    document.getElementById('detail-timestamp').textContent = formatSSADate(txn.datetimeString);
    document.getElementById('detail-attender').textContent = txn.attender || 'N/A';
    document.getElementById('detail-vehicle').textContent = txn.vehicle || 'N/A';
    document.getElementById('detail-sensor').textContent = txn.temp || '--'; 

    const statusSpan = document.getElementById('detail-status');
    if (statusSpan) {
        statusSpan.className = `badge ${getStatusBadgeClass(txn.status)}`;
        statusSpan.textContent = txn.status || 'IDLE';
    }

    transactionDetailModal.show();
};
// ==========================================
// GLOBAL CLEAR FILTERS LOGIC
// ==========================================
window.clearTransactionFilters = function() {
    console.log("[Action] Clearing all filters...");

    // 1. Remove saved state from browser memory
    localStorage.removeItem('ssaFilters');

    // 2. Define standard defaults (matching your initialization block)
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 60);
    const dateStrNow = now.toISOString().split('T')[0];
    const dateStrPast = past.toISOString().split('T')[0];

    // 3. Reset all possible DOM elements (Transactions and Reports)
    const filterIds = {
        'selectMachine': 'all-stations',
        'reportStationFilter': 'all-stations',
        'filterDeviceType': 'All Types',
        'reportDeviceTypeFilter': 'All Types',
        'searchId': '',
        'fromDate': dateStrPast,
        'reportFromDate': dateStrPast,
        'toDate': dateStrNow,
        'reportToDate': dateStrNow,
        'fromTime': '00:00',
        'reportFromTime': '00:00',
        'toTime': '23:59',
        'reportToTime': '23:59'
    };

    Object.keys(filterIds).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = filterIds[id];
    });

    // 4. Force Table Refresh
    if (typeof window.filterTransactions === 'function') {
        window.filterTransactions(); 
    } else if (typeof window.renderReportTable === 'function') {
        window.renderReportTable();
    }

    showToast('Filters reset to default', 'success');
};
// *** NEW FEATURE: PRINT TRANSACTION RECEIPT ***
window.printTransactionReceipt = function () {
    // NOTE: This function relies on the transactionDetailModal structure in the HTML
    const modalEl = document.getElementById('transactionDetailModal');
    if (!modalEl) {
        return showToast('Receipt modal not found.', 'error');
    }

    // 1. Clone the content for isolation
    const contentClone = modalEl.querySelector('.modal-body').cloneNode(true);

    // 2. Open a new window
    const printWindow = window.open('', '', 'height=600,width=800');

    // 3. Construct the HTML for the new window (minimal styling for receipt look)
    printWindow.document.write(`
        <html>
            <head>
                <title>Transaction Receipt</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    /* Force black text for printing clarity */
                    body, p, h4, h5, strong, div { color: #000 !important; }
                    /* Hide modal close button if present */
                    .btn-close { display: none; }
                    /* Center content for receipt style */
                    .receipt-content { max-width: 400px; margin: 0 auto; padding: 20px; font-family: 'Montserrat', sans-serif; }
                    .text-center img { width: 150px; }
                    hr { border-top: 1px dashed #999; }
                    .bg-light { background-color: #f8f9fa !important; }
                </style>
            </head>
            <body>
                <div class="receipt-content">
                    ${contentClone.innerHTML}
                </div>
                <script>
                    window.onload = function() {
                        // FIX: Added a small timeout before print to ensure DOM rendering completes
                        setTimeout(() => {
                           window.print();
                           window.close();
                        }, 200);  
                    };
                </script>
            </body>
        </html>
    `);

    printWindow.document.close();
};


// --- NEW FEATURE: Icon Redirection Functions (Called by station-detail.html) ---

window.redirectToSubResource = function (resourceType) {
    // This function is designed to switch between tabs within the Station Detail page.
    if (!currentStationId) {
        return showToast('Error: Station ID not loaded.', 'error');
    }

    // The resourceType passed is the target tab content ID (e.g., 'dispensers', 'tanks', 'assets')
    const tabElement = document.getElementById(resourceType + '-tab');
    if (tabElement) {
        // Use Bootstrap's Tab object to switch to the correct tab
        const tabTrigger = new bootstrap.Tab(tabElement);
        tabTrigger.show();
        showToast(`Switched view to ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} list.`, 'info');
    } else {
        showToast(`Error: Target tab '${resourceType}' not found.`, 'error');
    }
}

// *** FIX 6: Defensive function to read filter values from either Transactions or Reports page ***
function getFilterValues() {
    const savedFilters = JSON.parse(localStorage.getItem('ssaFilters')) || {};

    // Determine the current page's filter IDs (Reports uses 'report' prefix, Transactions does not)
    const isReportPage = !!document.getElementById('reportStationFilter');
    const prefix = isReportPage ? 'report' : '';

    const stationEl = document.getElementById(prefix + 'StationFilter') || document.getElementById('selectMachine');
    const typeEl = document.getElementById(prefix + 'DeviceTypeFilter') || document.getElementById('filterDeviceType');
    const searchEl = document.getElementById('searchId');

    // Use fallback element IDs for date/time fields across both pages
    const fromDateEl = document.getElementById(prefix + 'FromDate') || document.getElementById('fromDate');
    const toDateEl = document.getElementById(prefix + 'ToDate') || document.getElementById('toDate');
    const fromTimeEl = document.getElementById(prefix + 'FromTime') || document.getElementById('fromTime');
    const toTimeEl = document.getElementById(prefix + 'ToTime') || document.getElementById('toTime');

    // Default dates/times
    const today = new Date().toISOString().split('T')[0];
    const past = new Date();
    past.setDate(past.getDate() - 60);
    const pastDate = past.toISOString().split('T')[0];

    // Read current values defensively
    const currentValues = {
        station: stationEl?.value || savedFilters.station || 'all-stations',
        type: typeEl?.value || savedFilters.type || 'All Types',
        id: searchEl?.value || savedFilters.id || '',
        // Prioritize DOM value, then saved value, then default
        fromDate: fromDateEl?.value || savedFilters.fromDate || pastDate,
        toDate: toDateEl?.value || savedFilters.toDate || today,
        fromTime: fromTimeEl?.value || savedFilters.fromTime || '00:00',
        toTime: toTimeEl?.value || savedFilters.toTime || '23:59',
    };

    // Ensure 'all-stations' is the default if station filter is empty
    if (!currentValues.station || currentValues.station.trim() === '') {
        currentValues.station = 'all-stations';
    }

    return currentValues;
}
// ==========================================
// CHECK PERSISTENT LOGIN (OPTIMIZED)
// Fixes Flickering, 404s, and data loading for SSA Project
// ==========================================
function checkPersistentLogin() {
    // 1. Get current URL context
    const path = window.location.pathname; 
    const storedUser = localStorage.getItem('ssaUser');
    const storedPass = localStorage.getItem('user_password');
    
    // Normalize path to ensure exact matching with Django clean URLs
    const normalizedPath = path.endsWith('/') ? path : path + '/';
    const isLoginPage = normalizedPath === '/login/' || normalizedPath === '/';

    console.log(`[Auth] Checking session for path: ${normalizedPath}`);

    // 2. IF NO USER FOUND -> Redirect to Login unless already there
    if (!storedUser) {
        if (!isLoginPage) {
            console.warn("[Auth] No session found. Redirecting to login...");
            // replace() stops the back-button loop/flickering
            window.location.replace('/login/');
        }
        return;
    }

    // 3. IF USER FOUND -> Validate Session and Trigger UI
    try {
        currentUser = JSON.parse(storedUser);
        // Ensure unhashed password is available for query strings if needed
        if (storedPass) currentUser.password = storedPass;
        
        // Normalize role for robust checking (Super Admin, Admin, or User)
        const role = (currentUser.role || "").toLowerCase().trim();

        // 4. STOP REDIRECT LOOP: If already logged in, move away from login page
        if (isLoginPage) {
            console.log("[Auth] Active session found. Routing to home...");
            if (role === "admin") {
                window.location.replace("/users/");
            } else if (role === "super admin") {
                window.location.replace("/dashboard/");
            } else {
                window.location.replace("/dashboard/");
            }
            return;
        }

        // 5. SECURITY: Protect Admin/Super Admin restricted routes
        // Prevent regular users from accessing /admins/ or /users/
        if (normalizedPath.includes('/admins/') && role !== 'super admin') {
            console.error("[Security] Access denied to Admins page.");
            window.location.replace('/dashboard/');
            return;
        }
        
        if (normalizedPath.includes('/users/') && (role !== 'admin' && role !== 'super admin')) {
            console.error("[Security] Access denied to Users page.");
            window.location.replace('/dashboard/');
            return;
        }

        // 6. 🚀 TRIGGER UI VISIBILITY & DATA LOAD
        // Show/Hide sidebar items and buttons based on role (SSA Project logic)
        if (typeof setupUIForRole === 'function') {
            setupUIForRole(currentUser.role);
        }

        // Auto-fetch management directory lists if the current page requires them
        // This ensures "Total Admins" or "Total Users" stats populate immediately
        const needsDirectory = ['/users/', '/admins/', '/dashboard/'].some(p => normalizedPath.includes(p));
        if (needsDirectory && typeof window.fetchAdminsAndUsers === 'function') {
            window.fetchAdminsAndUsers(); 
        }

        // Trigger logic specific to the Dashboard (Transactions/Graph)
        if (normalizedPath.includes('/dashboard/') && typeof window.fetchAndDisplayStations === 'function') {
            window.fetchAndDisplayStations();
        }

        // Specific initialization for Profile Page
        if (normalizedPath.includes('/profile/') && typeof window.initializeProfilePage === 'function') {
            window.initializeProfilePage();
        }

    } catch (e) {
        console.error("[Auth Error] Login session corrupted:", e);
        // Clear broken data to allow a clean re-login
        localStorage.removeItem('ssaUser');
        localStorage.removeItem('user_password');
        window.location.replace('/login/');
    }
}

window.toggleMachineStatus = async function(id, currentStatus, type) {

    // normalize current state
    const isCurrentlyActive =
        String(currentStatus).toLowerCase() === "active";

    const nextStatusValue = isCurrentlyActive ? "inactive" : "active";
    const nextStatusText  = isCurrentlyActive ? "INACTIVE" : "ACTIVE";

    const confirmed = await showConfirm(
        "Hardware Control",
        `Confirm sending ${nextStatusText} command to ${type.toUpperCase()}?`
    );
    if (!confirmed) return;

    // find item in memory
    let sourceList =
        type === "tank" ? allTankData :
        type === "stationary" ? allStationaryData :
        allBowserData;

    const item = sourceList.find(i => String(i.id) === String(id));
    if (!item) {
        return showToast("Device not found", "error");
    }

    // correct backend endpoints
    let endpoint = "";
    let payload = {
        status: nextStatusValue,
        mqtt_id: item.mqtt_id
    };

    if (type === "bowser") {
        endpoint = `/bowsers/${id}/`;
        payload.bowser_id = item.bowser_id;
        payload.bowser_name = item.bowser_name;
        payload.bowser_description = item.bowser_description || "";
    }

    if (type === "tank") {
        endpoint = `/tanks/${id}/`;
        payload.tank_id = item.tank_id;
        payload.tank_name = item.tank_name;
    }

    if (type === "stationary") {
        endpoint = `/stationaries/${id}/`;
        payload.stationary_id = item.stationary_id;
        payload.stationary_name = item.stationary_name;
    }

    try {
        console.log("[TOGGLE PUT]", endpoint, payload);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error(err);
            return showToast("Backend rejected update", "error");
        }

        showToast(`${type.toUpperCase()} → ${nextStatusText}`, "success");

        setTimeout(() => location.reload(), 800);

    } catch (err) {
        console.error(err);
        showToast("Network error", "error");
    }
};



/**
 * Populates the Dispenser (Bowser & Stationary) table.
 * Includes a hardened Active/Inactive toggle.
 * Normalizes backend numeric status → string enum.
 */
function populateDeviceTable(data) {
    const tableBody = document.getElementById('deviceListTable');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        tableBody.innerHTML =
            '<tr><td colspan="8" class="text-center text-muted">No dispensers found.</td></tr>';
        return;
    }

    const userRole = currentUser ? currentUser.role : 'User';
    const isAdminOrSuperAdmin =
        userRole === 'Super Admin' || userRole === 'Admin';

    data.forEach((item, index) => {

        // ===============================
        // 1. Determine Asset Type
        // ===============================
        let type = 'Bowser';
        let displayId = item.bowser_id || item.id;
        let displayName = item.bowser_name || 'Device';
        let deleteId = item.id || item.bowser_id;
        let editTypeStr = 'bowser';
        let deleteFuncStr = `window.deleteDevice('${deleteId}')`;
        let badgeColor = 'bg-success';

        if (item.stationary_id) {
            type = 'Stationary';
            displayId = item.stationary_id;
            displayName = item.stationary_name || 'Stationary';
            deleteId = item.id || item.stationary_id;
            editTypeStr = 'stationary';
            deleteFuncStr = `window.deleteAsset('${deleteId}')`;
            badgeColor = 'bg-info';
        }

        // ===============================
        // 2. NORMALIZE STATUS (CRITICAL FIX)
        // ===============================
        let statusVal = item.status;

        // convert numeric → string
        if (statusVal === 100 || statusVal === "100") statusVal = "active";
        if (statusVal === 99  || statusVal === "99")  statusVal = "inactive";

        // fallback safety
        if (!statusVal) statusVal = "inactive";

        statusVal = String(statusVal).toLowerCase();

        const isActuallyActive = statusVal === 'active';

        const toggleColor =
            isActuallyActive ? 'btn-success' : 'btn-outline-secondary';

        const toggleIcon =
            isActuallyActive ? 'bi-toggle-on' : 'bi-toggle-off';

        const statusBadge = getStatusBadgeClass(statusVal);

        // ===============================
        // 3. Action Buttons
        // ===============================
        let actionButtons = `
            <div class="d-flex align-items-center gap-1">
                <button class="btn btn-sm ${toggleColor}" title="Toggle Status"
                        onclick="window.toggleMachineStatus('${item.id}', '${statusVal}', '${editTypeStr}')">
                    <i class="bi ${toggleIcon} fs-6"></i>
                </button>

                <button class="btn btn-sm btn-info text-white" title="Edit Details"
                        onclick="window.openEditDeviceModal('${item.id}', '${editTypeStr}')">
                    <i class="bi bi-pencil-square"></i>
                </button>
        `;

        if (isAdminOrSuperAdmin) {
            actionButtons += `
                <button class="btn btn-sm btn-outline-danger" title="Delete"
                        onclick="${deleteFuncStr}">
                    <i class="bi bi-trash"></i>
                </button>
            `;
        }

        actionButtons += `</div>`;

        // ===============================
        // 4. Render Row
        // ===============================
        const row = tableBody.insertRow();
        row.className = "align-middle";

        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="fw-bold">${displayId}</td>
            <td><span class="badge ${badgeColor}">${type}</span></td>
            <td>${displayName}</td>
            <td><code>${item.mqtt_id || '-'}</code></td>
            <td>${formatSSADate(item.created_on || item.created)}</td>
            <td><span class="badge ${statusBadge}">
                ${statusVal.toUpperCase()}
            </span></td>
            <td>${actionButtons}</td>
        `;
    });

    const bowserCountEl = document.getElementById('detailBowserCount');
    if (bowserCountEl) bowserCountEl.textContent = data.length;
}

/**
 * Populates the Tank list table.
 * Includes MQTT ID and a quick-toggle for Active/Inactive status.
 */
function populateTankTable(data) {
    const tableBody = document.getElementById('tankListTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // Store data globally for access in openEditDeviceModal
    allTankData = data;

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No tanks linked.</td></tr>';
        return;
    }

    const userRole = currentUser ? currentUser.role : 'User';
    const isAdminOrSuperAdmin = (userRole === 'Super Admin' || userRole === 'Admin');

    data.forEach((tank, index) => {
        const deleteId = tank.id || tank.tank_id;
        const tId = tank.tank_id || tank.id;
        const tName = tank.tank_name || tank.name || 'Tank';
        
        // 1. TOGGLE UI LOGIC
        const statusVal = tank.status || 'active';
        const isActuallyActive = statusVal.toLowerCase() === 'active';
        const toggleColor = isActuallyActive ? 'btn-success' : 'btn-outline-secondary';
        const toggleIcon = isActuallyActive ? 'bi-toggle-on' : 'bi-toggle-off';
        const statusBadge = getStatusBadgeClass(statusVal);

        // 2. Action Buttons Construction
        let actionButtons = `
            <div class="d-flex align-items-center gap-1">
                <button class="btn btn-sm ${toggleColor}" title="Toggle Status" 
                        onclick="window.toggleMachineStatus('${tank.id}', '${statusVal}', 'tank')">
                    <i class="bi ${toggleIcon} fs-6"></i>
                </button>
                
                <button class="btn btn-sm btn-info text-white" title="Edit Details"
                        onclick="window.openEditDeviceModal('${tank.id}', 'tank')">
                    <i class="bi bi-pencil-square"></i>
                </button>
        `;

        // Add Delete only for Admins
        if (isAdminOrSuperAdmin) {
            actionButtons += `
                <button class="btn btn-sm btn-outline-danger" title="Delete"
                        onclick="window.deleteTank('${deleteId}')">
                    <i class="bi bi-trash"></i>
                </button>
            `;
        }
        actionButtons += `</div>`;

        const row = tableBody.insertRow();
        row.className = "align-middle";
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="fw-bold">${tId}</td>
            <td>${tName}</td>
            <td><code>${tank.mqtt_id || '-'}</code></td>
            <td>${formatSSADate(tank.created_on || tank.created)}</td>
            <td><span class="badge ${statusBadge}">${statusVal.toUpperCase()}</span></td>
            <td>${actionButtons}</td>
        `;
    });

    // Update the UI count badge for tanks
    const tankCountEl = document.getElementById('detailTankCount');
    if (tankCountEl) tankCountEl.textContent = data.length;
}
/* ================================================================
   🚀 SUPER-FAST DASHBOARD HYDRATOR (404 FIX & OPTIMIZED)
   Fixes: Page Not Found error and slow UI rendering.
   ================================================================ */
/**
 * 🚀 ULTRA-FAST DASHBOARD HYDRATOR (MULTI-YEAR OPTIMIZED)
 * Synchronized with Django URL patterns and handles 700+ multi-year records.
 */
function updateDashboardStats() {
    // 1. CACHE DOM SELECTORS (Prevents slow repeated lookups)
    const els = {
        online: document.getElementById('machineStatusOnline'),
        offline: document.getElementById('machineStatusOffline'),
        total: document.getElementById('vsTotalCount'),
        userLabel: document.getElementById('userCardLabel'),
        userCount: document.getElementById('vsOnlineCount'),
        userCard: document.getElementById('userManagementCard'),
        txCount: document.getElementById('vsInactiveCount'),
        dashTotalTx: document.getElementById('dash_total_count'),
        dashTotalVol: document.getElementById('dash_total_vol'),
        dashTotalAmt: document.getElementById('dash_total_amt')
    };

    // 2. HIGH-SPEED STATUS CALCULATION (STATIONS)
    let onlineCount = 0;
    let offlineCount = 0;

    if (allStationsData && allStationsData.length > 0) {
        for (let i = 0; i < allStationsData.length; i++) {
            const s = allStationsData[i];
            const status = String(s.status || (s.is_active ? 'Active' : 'Inactive')).toLowerCase();
            (status === 'active' || status === 'online') ? onlineCount++ : offlineCount++;
        }
    }

    // 3. INSTANT UI UPDATE (Station Counts)
    if (els.online) els.online.textContent = onlineCount;
    if (els.offline) els.offline.textContent = offlineCount;
    if (els.total) els.total.textContent = allStationsData.length;

    // 4. ROLE-BASED REDIRECTION & DIRECTORY COUNTS (Django Route Sync)
    const role = currentUser ? String(currentUser.role).toLowerCase().trim() : 'user';

    if (role === 'super admin') {
        if (els.userLabel) els.userLabel.textContent = "Total Admins";
        if (els.userCount) els.userCount.textContent = mockAdminData.length || 0;
        if (els.userCard) {
            els.userCard.style.cursor = 'pointer';
            els.userCard.onclick = () => window.location.href = '/admins/';
        }
    } else if (role === 'admin') {
        if (els.userLabel) els.userLabel.textContent = "Total Users";
        if (els.userCount) els.userCount.textContent = mockUserData.length || 0;
        if (els.userCard) {
            els.userCard.style.cursor = 'pointer';
            els.userCard.onclick = () => window.location.href = '/users/';
        }
    }

    // 5. TRANSACTION AGGREGATION (MULTI-YEAR SOURCE OF TRUTH)
    // We use baseTransactionData to ensure we catch all 703+ records including 2025
    if (baseTransactionData && baseTransactionData.length > 0) {
        
        // Calculate Absolute Totals (No date restriction)
        const totalVol = baseTransactionData.reduce((sum, tx) => sum + (parseFloat(tx.vol || tx.trnvol) || 0), 0);
        const totalAmt = baseTransactionData.reduce((sum, tx) => sum + (parseFloat(tx.amt || tx.trnamt) || 0), 0);

        // Update Global Dashboard Badge
        if (els.txCount) els.txCount.textContent = baseTransactionData.length.toLocaleString();

        // 6. CALCULATE PERIOD STATS (Strict 7-Day / 30-Day / Total)
        const stats7 = getPeriodStats(7);
        const stats30 = getPeriodStats(30);

        const setPeriodUI = (prefix, data) => {
            const c = document.getElementById(`dash_${prefix}_count`);
            const v = document.getElementById(`dash_${prefix}_vol`);
            const a = document.getElementById(`dash_${prefix}_amt`);
            
            if (c) c.textContent = data.count;
            if (v) v.textContent = data.vol.toFixed(1) + ' L';
            if (a) a.textContent = '₹' + data.amt.toFixed(0);
        };

        // Update Period Cards
        setPeriodUI('7', stats7);
        setPeriodUI('30', stats30);
        
        // Update "Total Activity" card explicitly with full history (2025 + 2026)
        setPeriodUI('total', { 
            count: baseTransactionData.length, 
            vol: totalVol, 
            amt: totalAmt 
        });
    }
}
// --- INITIALIZATION ---
// *** FIX: Persist Filters when navigating away ***
window.addEventListener('beforeunload', () => {
    // Check if we are on a filterable page (Transactions or Reports)
    if (document.getElementById('fromDate') || document.getElementById('reportFromDate')) {
        const filters = getFilterValues();
        localStorage.setItem('ssaFilters', JSON.stringify(filters));
    }
});
// *** END FIX: Persist Filters ***

document.addEventListener('DOMContentLoaded', async function () {

    // --- SIDEBAR ICON FIX ---
    const stationIcon = document.querySelector('a[href="#stationMenu"] i');
    if (stationIcon) {
        stationIcon.className = "bi bi-fuel-pump-fill me-2";
    }

    checkPersistentLogin();

    // ... inside DOMContentLoaded ...
    // --- LOGIN PAGE LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Stop any default submission and use the global handleLogin
        loginForm.addEventListener('submit', window.handleLogin);

        const loginEmailInput = document.getElementById('loginEmail');
        if (loginEmailInput) {
            loginEmailInput.addEventListener('input', (e) => {
                const email = e.target.value.trim().toLowerCase();
                const pIdContainer = document.getElementById('portalIdContainer');
                const pIdInput = document.getElementById('loginPortalId');

                // 1. Logic to visually hide the Portal ID for ssa@gmail.com
                // 1. Logic to visually hide the Portal ID for super admin
                const isAppView = document.getElementById('appView');
                if (pIdContainer) {
                    if (email === 'csk@gmail.com' || email === 'ssa@gmail.com') { // support both if you want
                        pIdContainer.classList.add('hidden');
                    } else {
                        pIdContainer.classList.remove('hidden');
                    }
                }


                // 2. CRITICAL FIX: Never make this field 'required' in HTML validation
                // The backend validation is enough. This prevents the "Please fill out this field" error.
                if (pIdInput) {
                    pIdInput.required = false;
                }
            });

            // Trigger immediately in case browser autofilled the email
            loginEmailInput.dispatchEvent(new Event('input'));
        }
    }
    // --- ALL APP PAGES ---
    const appView = document.getElementById('appView');
    if (appView) {
        document.body.style.paddingTop = '60px';

  // Inside document.addEventListener('DOMContentLoaded', ...
    
    if (currentUser) {
        // Setup UI roles...
        if (typeof setupUIForRole === 'function') setupUIForRole(currentUser.role);

        // *** THIS IS THE ONLY PLACE WE FETCH STATIONS ***
        // Run on Dashboard OR Stations page
        if (document.getElementById('transactionChart') || document.getElementById('allStationsTableBody')) {
            window.fetchAndDisplayStations();
        }
        
        // Handle Edit Mode from URL
        const urlParams = new URLSearchParams(window.location.search);
        const editIdParam = urlParams.get('edit');
        if (editIdParam) window.loadStationForEdit(editIdParam);
    }
    
    // ... Rest of your init code ...

        initializeTheme();
        updateLiveClock();
        setInterval(updateLiveClock, 1000);

        // NOTE: profileModalElement uses the ID `editProfileModal` in your provided HTML, not `profileModal`.
        const editProfileModalEl = document.getElementById('editProfileModal');
        if (editProfileModalEl) {
            profileModal = new bootstrap.Modal(editProfileModalEl);
        }

        if (document.getElementById('allocationModal')) {
            allocationModal = new bootstrap.Modal(document.getElementById('allocationModal'));
            // Attach save listener
            document.getElementById('saveAllocationButton')?.addEventListener('click', window.saveAllocation);
        }

        // Admin modals
        if (document.getElementById('adminModal')) adminModal = new bootstrap.Modal(document.getElementById('adminModal'));
        if (document.getElementById('viewUsersModal')) viewUsersModal = new bootstrap.Modal(document.getElementById('viewUsersModal'));
        if (document.getElementById('userModal')) userModal = new bootstrap.Modal(document.getElementById('userModal'));
        if (document.getElementById('transactionDetailModal')) transactionDetailModal = new bootstrap.Modal(document.getElementById('transactionDetailModal'));
        if (document.getElementById('settingsModal')) settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
        if (document.getElementById('exportConfigModal')) exportConfigModal = new bootstrap.Modal(document.getElementById('exportConfigModal'));
        if (document.getElementById('previewModal')) previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
        if (document.getElementById('periodDetailModal')) periodDetailModal = new bootstrap.Modal(document.getElementById('periodDetailModal'));
        if (document.getElementById('emailReportModal')) emailReportModal = new bootstrap.Modal(document.getElementById('emailReportModal')); // Initialize email modal

        // Initialize Device Edit Modal
        // We initialize the modal here to ensure it exists before any function tries to call modal.show()
        if (editDeviceModalElement) {
            editDeviceModal = new bootstrap.Modal(editDeviceModalElement);
            // Attach listener to the edit form submit button
            const editDeviceForm = document.getElementById('editDeviceForm');
            if (editDeviceForm) editDeviceForm.addEventListener('submit', window.updateDeviceTankAsset);
        }

        // --- Profile Page Listener (Page Load Check) ---
        const profilePageForm = document.getElementById('profilePageForm');
        if (profilePageForm) {
            window.initializeProfilePage();
            profilePageForm.addEventListener('submit', window.handleSaveProfile);
        }

        // --- AUTO-POPULATE ASSIGNMENT DROPDOWN ---
const createStationView = document.getElementById('createStationView');
if (createStationView) {
    const assignSelect = document.getElementById('assignToUser');
    if (assignSelect) {
        // Ensure Users are loaded before populating
        if (allAssignableUsers.length === 0) {
            await window.fetchAdminsAndUsers();
        }
        // Filter and fill the dropdown for 'User' roles only
        window.populateAllocationDropdown(assignSelect, 'User', "");
    }
}

        // =====================================================================
        // END CRITICAL FIX
        // =====================================================================

        document.getElementById('themeToggle').addEventListener('click', toggleTheme);

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', window.handleLogout);

        // ... continue with the rest of the app.js file content ...

        // ============================================================
        // DATE DEFAULTS (Scoped to prevent crashes)
        // ============================================================
        {
            const now = new Date();
            const past = new Date();
            past.setDate(now.getDate() - 60); // Go back 60 days

            const dateStrNow = now.toISOString().split('T')[0];
            const dateStrPast = past.toISOString().split('T')[0];

            // *** FIX: Apply persistence filter state on load ***
            const savedFilters = JSON.parse(localStorage.getItem('ssaFilters'));

            // Helper to set filter value if element exists (using saved or default)
            const setFilterValue = (id, savedKey, defaultValue) => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = savedFilters ? (savedFilters[savedKey] || defaultValue) : defaultValue;
                }
            };

            setFilterValue('fromDate', 'fromDate', dateStrPast);
            setFilterValue('toDate', 'toDate', dateStrNow);
            setFilterValue('fromTime', 'fromTime', '00:00');
            setFilterValue('toTime', 'toTime', '23:59');

            // Reports Page filters
            setFilterValue('reportFromDate', 'fromDate', dateStrPast);
            setFilterValue('reportToDate', 'toDate', dateStrNow);
            setFilterValue('reportFromTime', 'fromTime', '00:00');
            setFilterValue('reportToTime', 'toTime', '23:59');

            setFilterValue('selectMachine', 'station', 'all-stations');
            setFilterValue('filterDeviceType', 'type', 'All Types');
            setFilterValue('searchId', 'id', '');

            setFilterValue('reportStationFilter', 'station', 'all-stations');
            setFilterValue('reportDeviceTypeFilter', 'type', 'All Types');
        }
        // *** END FIX: Apply persistence filter state on load ***

        const currentPage = window.location.pathname.split('/').pop();
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            const linkPage = link.getAttribute('href');
            if (linkPage === currentPage) {
                link.classList.add('active');

                const collapseParent = link.closest('.collapse');
                if (collapseParent) {
                    const trigger = document.querySelector(`[data-bs-target="#${collapseParent.id}"]`);
                    if (trigger) {
                        trigger.classList.remove('collapsed');
                        trigger.setAttribute('aria-expanded', 'true');
                        collapseParent.classList.add('show');
                    }
                }
            } else {
                link.classList.remove('active');
            }
        });
        if (currentPage === 'dashboard.html') {
            const dbLink = document.getElementById('showDashboard');
            if (dbLink) dbLink.classList.add('active');
        }

    } // end if(appView)

    // --- PAGE-SPECIFIC CODE ---

    // *** MANAGE ADMINS PAGE BLOCK (CRITICAL FIX) ***
    if (window.location.pathname.split('/').pop() === '/manage-admins/') {
        if (currentUser && currentUser.role?.toLowerCase() === 'super admin') { 
            window.fetchAdminsAndUsers(); // Call the new fetch function
        }
        // Re-attach Search Listener
        const searchInput = document.getElementById('adminSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterAdminTable(e.target.value);
            });
        }
        
        // Attach listener for the save button in the create modal
        document.getElementById('saveAdminButton')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.saveAdminChanges(false); // Pass flag for Create mode
        });
    }
    
    // *** MANAGE USERS PAGE BLOCK (CRITICAL FIX) ***
    if (window.location.pathname.split('/').pop() === '/manage-users/') {
        async function initializeManageUsers() {
            // Run fetch for Super Admin OR Admin (allowing Admins to manage their portal's users)
            if (currentUser && (currentUser.role?.toLowerCase() === 'super admin' || currentUser.role?.toLowerCase() === 'admin')) {
                // Ensure Admin/User lists are populated 
                if (mockUserData.length === 0) {
                     await window.fetchAdminsAndUsers();
                }
                window.populateUserTable(mockUserData);
            }
        }
        initializeManageUsers();
        
        // The saveUserButton listener is attached inside openCreateUserModal/openEditUserModal
        // The disableUser function handles local state and refresh
    }

// ==========================================
// DASHBOARD TRANSACTION GRAPH (FINAL SAFE VERSION)
// ==========================================
if (document.getElementById("transactionChart")) {

    window.isDashboard = true;
    let currentChartDays = 7;

    async function fetchDashboardData() {
        try {
            const cacheBuster = `_t=${Date.now()}`;

            await Promise.all([
                allStationsData.length === 0 ? window.fetchAndDisplayStations() : Promise.resolve(),
                allAssignableUsers.length === 0 ? window.fetchAdminsAndUsers() : Promise.resolve()
            ]);

            const rawData = await smartFetch(`/iot/transactions/?${cacheBuster}`);
            if (!Array.isArray(rawData) || rawData.length === 0) return;

            // -----------------------------------------
            // 1. MAP FULL DATASET (FOR REPORTS + CARDS)
            // -----------------------------------------
            const allMapped = [];

            for (let tx of rawData) {
                const d = parseBackendDateTime(tx.todate, tx.totime);
                if (!d) continue;

                allMapped.push({
                    station: String(tx.devID || "").trim(),
                    dateTimeObj: d,
                    vol: Number(tx.trnvol) || 0,
                    amt: Number(tx.trnamt) || 0
                });
            }

            // 🔥 IMPORTANT: preserve full dataset for reports
            window.fullTransactionData = allMapped;

            // Dashboard cards use full dataset
            baseTransactionData = allMapped;
            updateDashboardStats();

            // -----------------------------------------
            // 2. ROLE FILTER (UNCHANGED)
            // -----------------------------------------
            const userRole = (currentUser?.role || "").toLowerCase();
            let roleFiltered = allMapped;

            if (userRole !== "super admin") {
                const allowed = allStationsData
                    .map(s => String(s.station_id || s.id || "").trim())
                    .filter(Boolean);

                roleFiltered = allMapped.filter(tx =>
                    allowed.includes(tx.station)
                );
            }

            if (roleFiltered.length === 0) {
                if (window.mainChart) window.mainChart.destroy();
                return;
            }

            // -----------------------------------------
            // 3. CHART WINDOW FILTER (FAST)
            // -----------------------------------------
            const now = new Date();
now.setHours(0,0,0,0);

const cutoff = now.getTime() - (currentChartDays * 86400000);


            const chartSet = [];

            for (let tx of roleFiltered) {
                if (tx.dateTimeObj.getTime() >= cutoff) {
                    chartSet.push(tx);
                }
            }

            chartSet.sort((a, b) => a.dateTimeObj - b.dateTimeObj);

            const processed = processTransactionDataForChart(chartSet);

            if (processed?.chartLabels?.length) {
                drawTransactionChart(processed);
            } else {
                if (window.mainChart) window.mainChart.destroy();
            }

        } catch (err) {
            console.error("Dashboard graph error:", err);
        }
    }

    // -----------------------------------------
    // UI Toggle Buttons
    // -----------------------------------------
    const chartHeader = document.querySelector('#transactionChart')
        .closest('.card')
        .querySelector('h1, h2, h3, h4, h5, .card-title');

    if (chartHeader && !document.getElementById('chartToggleBtnGroup')) {
        chartHeader.classList.add('d-flex', 'align-items-center', 'justify-content-between', 'w-100');
        chartHeader.innerHTML = `
            <span style="font-family:'Montserrat'; font-weight:700;">Transaction Analysis</span>
            <div class="btn-group btn-group-sm shadow-sm" id="chartToggleBtnGroup">
                <button class="btn btn-outline-primary ${currentChartDays === 7 ? 'active' : ''}" onclick="window.setChartDays(7)">Last 7 Days</button>
                <button class="btn btn-outline-primary ${currentChartDays === 30 ? 'active' : ''}" onclick="window.setChartDays(30)">Last 30 Days</button>
            </div>`;
    }

    window.setChartDays = function(days) {
        currentChartDays = days;

        const btns = document.querySelectorAll('#chartToggleBtnGroup .btn');
        if(btns.length > 1) {
            btns[0].classList.toggle('active', days === 7);
            btns[1].classList.toggle('active', days === 30);
        }

        fetchDashboardData();
    };

    fetchDashboardData();
    setInterval(fetchDashboardData, 6000);
}


// --- TRANSACTIONS PAGE LOGIC ---
if (document.getElementById('transactionTableBody')) {
    (async function initTransactionsStations() {
    if (!allStationsData || allStationsData.length === 0) {
        await window.fetchAndDisplayStations();
    }

    populateStationDropdown();
})();

    // 1. Get Elements
    const stationFilter = document.getElementById('selectMachine');
    const deviceTypeFilter = document.getElementById('filterDeviceType');
    const searchIdFilter = document.getElementById('searchId');
    const fromDateFilter = document.getElementById('fromDate');
    const fromTimeFilter = document.getElementById('fromTime');
    const toDateFilter = document.getElementById('toDate');
    const toTimeFilter = document.getElementById('toTime');
    const filterButton = document.getElementById('filterButton');
    
    // Support for additional filters if they exist in HTML
    const mobileIdFilter = document.getElementById('filterMobileNo');
    const assetIdFilter = document.getElementById('filterAssetId');
    const assetModelFilter = document.getElementById('filterAssetModel');

    const table = document.getElementById('transactionTable');
    const columnTogglers = document.querySelectorAll('.column-toggle-item');
    const storageKey = 'ssaTransactionCols';

    // 2. Column Visibility Logic
    window.applyColumnVisibility = function() {
        if (!table) return;
        columnTogglers.forEach(checkbox => {
            const colClass = checkbox.getAttribute('data-col');
            const isChecked = checkbox.checked;
            const cells = table.querySelectorAll(`.${colClass}`);
            cells.forEach(cell => {
                cell.style.display = isChecked ? '' : 'none';
            });
        });
    };

    function saveColumnPreferences() {
        const prefs = {};
        columnTogglers.forEach(checkbox => {
            prefs[checkbox.getAttribute('data-col')] = checkbox.checked;
        });
        localStorage.setItem(storageKey, JSON.stringify(prefs));
    }

    function loadColumnPreferences() {
        const prefs = JSON.parse(localStorage.getItem(storageKey));
        if (prefs) {
            columnTogglers.forEach(checkbox => {
                const colClass = checkbox.getAttribute('data-col');
                if (prefs.hasOwnProperty(colClass)) checkbox.checked = prefs[colClass];
            });
        }
        window.applyColumnVisibility();
    }

    columnTogglers.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            window.applyColumnVisibility();
            saveColumnPreferences();
        });
    });
window.filterTransactions = function() {

    userFiltering = true;

    const currentFilters = getFilterValues();
    const station = String(currentFilters.station || "").trim();
    const deviceType = (currentFilters.type || "").toLowerCase();
    const searchId = (currentFilters.id || "").toLowerCase();

    const mIdSearch = (document.getElementById('filterMobileNo')?.value || "").toLowerCase();
    const aIdSearch = (document.getElementById('filterAssetId')?.value || "").toLowerCase();
    const aModelSearch = (document.getElementById('filterAssetModel')?.value || "").toLowerCase();

    // SAFE DATE PARSING
    const fromDateTime = currentFilters.fromDate
        ? new Date(`${currentFilters.fromDate}T${currentFilters.fromTime || "00:00"}`)
        : null;

    const toDateTime = currentFilters.toDate
        ? new Date(`${currentFilters.toDate}T${currentFilters.toTime || "23:59"}`)
        : null;

    let filteredData = baseTransactionData.filter(tx => {

        // Station
        if (station && station !== 'all-stations' && String(tx.station).trim() !== station)
            return false;

        // Device type
        if (deviceType && deviceType !== 'all types' && (tx.type || '').toLowerCase() !== deviceType)
            return false;

        // ID search
        if (searchId && !String(tx.id || "").toLowerCase().includes(searchId))
            return false;

        // Parameters
        if (mIdSearch && !String(tx.mobileId || "").toLowerCase().includes(mIdSearch))
            return false;

        if (aIdSearch && !String(tx.assetId || "").toLowerCase().includes(aIdSearch))
            return false;

        if (aModelSearch && !String(tx.assetModel || "").toLowerCase().includes(aModelSearch))
            return false;

        // Date range
        if (tx.dateTimeObj) {
            if (fromDateTime && tx.dateTimeObj < fromDateTime) return false;
            if (toDateTime && tx.dateTimeObj > toDateTime) return false;
        }

        return true;
    });

    currentTransactionData = filteredData;
    currentPage = 1;

    console.log("Filtered:", filteredData.length);

    populateFullTransactionTable(currentTransactionData);
};

function populateStationDropdown() {
    const dropdown = document.getElementById('selectMachine');
    if (!dropdown) return;

    dropdown.innerHTML = `<option value="all-stations">-- All Stations --</option>`;

    const userRole = (currentUser?.role || "").toLowerCase();
    let stations = allStationsData;

    if (userRole !== "super admin") {
        stations = allStationsData.filter(s =>
            s.assigned_users?.includes(currentUser?.id)
        );
    }

    stations.forEach(s => {
        const opt = document.createElement('option');
        opt.value = String(s.station_id).trim();
        opt.textContent = `${s.station_name} (${s.station_id})`;
        dropdown.appendChild(opt);
    });
}

    // 4. Attach Listeners
    if (stationFilter) stationFilter.addEventListener('change', window.filterTransactions);
    if (deviceTypeFilter) deviceTypeFilter.addEventListener('change', window.filterTransactions);
    if (searchIdFilter) searchIdFilter.addEventListener('keyup', window.filterTransactions);
    if (mobileIdFilter) mobileIdFilter.addEventListener('keyup', window.filterTransactions);
    if (assetIdFilter) assetIdFilter.addEventListener('keyup', window.filterTransactions);
    if (assetModelFilter) assetModelFilter.addEventListener('keyup', window.filterTransactions);
    if (fromDateFilter) fromDateFilter.addEventListener('change', window.filterTransactions);
    if (fromTimeFilter) fromTimeFilter.addEventListener('change', window.filterTransactions);
    if (toDateFilter) toDateFilter.addEventListener('change', window.filterTransactions);
    if (toTimeFilter) toTimeFilter.addEventListener('change', window.filterTransactions);
    if (filterButton) filterButton.addEventListener('click', (e) => { e.preventDefault(); window.filterTransactions(); });

    loadColumnPreferences();
}
// ==========================================
// 🔑 USER → STATION IDS (ROLE SAFE)
// ==========================================
async function fetchUserStationIds() {
    const creds = getQueryCredentials();
    const role = (currentUser?.role || '').toLowerCase();

    // 👤 USER: backend already filters stations
    if (role === 'user') {
        if (!Array.isArray(allStationsData) || allStationsData.length === 0) {
            await window.fetchAndDisplayStations();
        }

        return allStationsData
            .map(s => String(s.station_id || s.id).trim())
            .filter(Boolean);
    }

    // 👑 ADMIN / SUPER ADMIN
    const userId = currentUser?.id;
    if (!userId) return [];

   const assignments = await smartFetch(`/assignments/user/${userId}/`);

    if (!Array.isArray(assignments)) return [];

    return assignments
        .map(a =>
            String(
                a.station_id ||
                a.station?.station_id ||
                a.station?.id
            ).trim()
        )
        .filter(Boolean);
}
// ==========================================
// 🔑 STATION → BOWSER IDS
// ==========================================
async function fetchUserBowserIds() {
    const creds = getQueryCredentials();
    const stationIds = await fetchUserStationIds();
    const bowserIds = new Set();

    for (const stationId of stationIds) {
        try {
         const bowsers = await smartFetch(`/stations/${stationId}/bowsers/`);
            if (Array.isArray(bowsers)) {
                bowsers.forEach(b => {
                    bowserIds.add(
                        String(b.bowser_id || b.bwsrid).trim()
                    );
                });
            }
        } catch (e) {
            console.warn(`No bowsers for station ${stationId}`);
        }
    }

    return Array.from(bowserIds);
}
// ==========================================
// 🚀 FETCH TRANSACTIONS (FINAL VERSION)
// ==========================================
window.fetchTransactions = async function () {
    const tableBody = document.getElementById('transactionTableBody');
    const chartEl = document.getElementById('transactionChart');

    if (!tableBody && !chartEl) return;

    try {
        const creds = getQueryCredentials();
        // ✅ NEW: Clean URL. smartFetch handles the security headers automatically.
const rawData = await smartFetch('/iot/transactions/');

        let mappedData = [];

        // ----------------------------------
        // A. NORMALIZE TRANSACTIONS (🔥 FINAL FIX)
        // ----------------------------------
        if (Array.isArray(rawData)) {
            mappedData = rawData.map(apiTx => {
                if (!apiTx) return null;

                // 🔑 DEFENSIVE BOWSER ID EXTRACTION
                const bowserId =
                    apiTx.bowser?.bwsrid ||
                    apiTx.bwsrid ||
                    apiTx.bowser_id ||
                    apiTx.bwsr_id ||
                    null;

                if (!bowserId) return null;

                const bowser = apiTx.bowser || {};
                const dt = parseBackendDateTime(apiTx.todate, apiTx.totime);

                return {
                    id: bowser.trnsid || apiTx.trnsid || '-',

                    // 🔥 THIS NOW WORKS
                    bowserId: String(bowserId).trim(),
stationId: apiTx.stationid || apiTx.parent_station_id || null,
                    // Display-only fields
                    deviceId: apiTx.devID || 'N/A',
                    pumpId: bowser.pumpid || apiTx.pumpid || 'N/A',
                    type: 'Bowser',

                    datetimeString: `${apiTx.todate} ${apiTx.totime}`,
                    dateTimeObj: dt,

                    vol: parseFloat(bowser.trnvol || apiTx.trnvol) || 0,
                    amt: parseFloat(bowser.trnamt || apiTx.trnamt) || 0,
                    totalVol: parseFloat(bowser.totvol || apiTx.totvol) || 0,
                    totalAmt: parseFloat(bowser.totamt || apiTx.totamt) || 0,

                    status: bowser.pmpsts || apiTx.pmpsts || 'IDLE'
                };
            }).filter(Boolean);

            // Newest first
            mappedData.sort(
                (a, b) => (b.dateTimeObj || 0) - (a.dateTimeObj || 0)
            );
        }

        // ----------------------------------
        // B. ROLE-BASED FILTERING (FINAL)
        // ----------------------------------
        const role = (currentUser?.role || '').toLowerCase();
        let allowedBowserIds = [];

        if (role !== 'super admin') {
            allowedBowserIds = await fetchUserBowserIds();
        }

        console.log('Allowed Bowsers:', allowedBowserIds);
        console.log('TX Bowsers:', mappedData.map(t => t.bowserId));

        baseTransactionData =
            role === 'super admin'
                ? mappedData
                : mappedData.filter(tx =>
                    allowedBowserIds.includes(tx.bowserId)
                );

        currentTransactionData = baseTransactionData;

        // ----------------------------------
        // C. RENDER UI
        // ----------------------------------
        if (tableBody) {
            populateFullTransactionTable(currentTransactionData);
        }


        if (typeof updateDashboardStats === 'function') {
            updateDashboardStats();
        }

    } catch (err) {
        console.error('Transaction Fetch Failed:', err);
    }
};

let txAutoRefreshRunning = false;
let txBackendAlive = true;

async function startTransactionAutoRefresh() {
    if (txAutoRefreshRunning) return; // 🛑 prevent duplicates
    txAutoRefreshRunning = true;

    const loop = async () => {
        // Stop if page no longer has transaction UI
        if (
            !document.getElementById('transactionTableBody') &&
            !document.getElementById('transactionChart')
        ) {
            txAutoRefreshRunning = false;
            return;
        }

        if (!txBackendAlive) {
            console.warn("Transaction auto-refresh stopped: backend unreachable");
            txAutoRefreshRunning = false;
            return;
        }

        try {
            await window.fetchTransactions(); // MUST throw on failure
        } catch (err) {
            txBackendAlive = false; // 🔒 circuit breaker
            console.warn("Transaction auto-refresh halted due to API failure");
            txAutoRefreshRunning = false;
            return;
        }

        // Schedule next run ONLY after success
        setTimeout(loop, 15000);
    };

    loop();
}

// Start once
if (currentUser) {
    startTransactionAutoRefresh();
}

// ==========================================
// --- ALL STATIONS PAGE INITIALIZATION ---
// This block standardizes navigation for the SSA Project directory.
// ==========================================
if (document.getElementById('allStationsTableBody')) {
    console.log(">>> Station Page Detected. Synchronizing directory...");

    // 1. Initial Data Load
    // fetchAndDisplayStations handles the parallel load of stations, users, 
    // and assignment mapping to correctly show data in the directory.
    if (typeof window.fetchAndDisplayStations === 'function') {
        window.fetchAndDisplayStations();
    }

    // 2. Attach Search Input Listener
    // Provides real-time filtering of the station list based on Name, ID, or Location.
    const searchInput = document.getElementById('stationSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            // filterStationTable resets current pagination to page 1 
            // for accurate filtered results.
            if (typeof filterStationTable === 'function') {
                filterStationTable(e.target.value);
            }
        });
    }

    // 3. Attach "Create Station" Button Listener
    const createBtn = document.getElementById('goCreateStation');
    if (createBtn) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // ✅ Standardized Path: Matches the template route in urls.py.
            // Avoids the 405 error caused by GET requests to the /stations/create/ API endpoint.
            window.location.href = '/stations-create/'; 
        });
    }

    // 4. Page Detection for Direct ID Access (RESTful Navigation)
    // Supports clean URLs like /stations-detail/STSSA54311/ by splitting the path.
    const pathParts = window.location.pathname.split('/').filter(p => p !== "");
    const lastSegment = pathParts[pathParts.length - 1]; 

    // If the path ends with a valid SSA Station ID format (e.g., STSSA + 5 digits).
    if (lastSegment && lastSegment.startsWith('STSSA')) {
        currentStationId = lastSegment;
        console.log(`[Navigation] Direct access detected for ID: ${currentStationId}`);
        if (typeof initializeDetailView === 'function') {
            initializeDetailView();
        }
    }
}
/* ================================================================
   STATION DETAIL VIEW LOGIC (FIXED FOR DUPLICATES & DJANGO PATHS)
   ================================================================ */
if (document.getElementById('stationDetailView')) {
    // 1. Extract Station ID from the URL path (e.g., /stations-detail/STSSA00001/)
    const pathParts = window.location.pathname.split('/').filter(p => p !== "");
    const stationIdFromPath = pathParts[pathParts.length - 1]; 

    if (!stationIdFromPath || stationIdFromPath === 'view' || stationIdFromPath === 'stations-detail') {
        document.getElementById('stationDetailView').innerHTML = 
            '<div class="alert alert-danger">Error: Station ID not found in URL path.</div>';
    } else {
        currentStationId = stationIdFromPath;
        console.log("[Detail] Initializing data for Station:", currentStationId);

        // --- ASYNC INITIALIZATION ---
        (async function initializeDetailView() {
            // A. Ensure main station data is available for headers
            if (!allStationsData || allStationsData.length === 0) {
                await window.fetchAndDisplayStations(); 
            }

            // B. Find the specific station object
            const station = allStationsData.find(s => 
                String(s.station_id) === currentStationId || String(s.id) === currentStationId
            );

            if (station) {
                document.getElementById('stationDetailName').textContent = station.station_name || station.name || 'Unnamed Station';
                document.getElementById('detailStationId').textContent = station.station_id || station.id;
                document.getElementById('detailStationLocation').textContent = station.location || 'N/A';
                const dateEl = document.getElementById('detailStationDate');
                if (dateEl) dateEl.textContent = formatSSADate(station.created_on || station.created_at || '-');
            }

            // C. Fetch Sub-Resources
            try {
                const [b, t, s] = await Promise.all([
                    smartFetch(`/stations/${currentStationId}/bowsers/`),
                    smartFetch(`/stations/${currentStationId}/tanks/`),
                    smartFetch(`/stations/${currentStationId}/stationaries/`)
                ]);
                
                allBowserData = Array.isArray(b) ? b : [];
                allTankData = Array.isArray(t) ? t : [];
                allStationaryData = Array.isArray(s) ? s : [];

                populateDeviceTable([...allBowserData, ...allStationaryData]);
                populateTankTable(allTankData);
                
                const bCount = document.getElementById('detailBowserCount');
                const tCount = document.getElementById('detailTankCount');
                if(bCount) bCount.textContent = allBowserData.length + allStationaryData.length;
                if(tCount) tCount.textContent = allTankData.length;

            } catch (err) {
                console.error("[Detail Error] Sub-resource load failed:", err);
            }
        })();

        // --- C. DISPENSER FORM SUBMISSION (FIXED: REDIRECTS TO VALIDATION) ---
        const createDeviceForm = document.getElementById('createDeviceForm');
        if (createDeviceForm) {
            // Remove legacy listeners to stop unvalidated "Save First" bug
            const cleanDeviceForm = createDeviceForm.cloneNode(true);
            createDeviceForm.parentNode.replaceChild(cleanDeviceForm, createDeviceForm);

            cleanDeviceForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();

                const selectedType = document.getElementById('deviceType')?.value || 'Bowser';

                // Handover to validation engine (10-char MQTT & Duplicate checks)
                if (selectedType === 'Stationary') {
                    await window.addStationaryFromDispenserTab(e, currentStationId);
                } else {
                    await window.addBowser(e, currentStationId);
                }
            });
        }

        // --- D. TANK FORM SUBMISSION (FIXED: REDIRECTS TO VALIDATION) ---
        const createTankForm = document.getElementById('createTankForm');
        if (createTankForm) {
            // Remove legacy listeners
            const cleanTankForm = createTankForm.cloneNode(true);
            createTankForm.parentNode.replaceChild(cleanTankForm, createTankForm);

            cleanTankForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();

                // Handover to tank validation function
                await window.addTank(e, currentStationId);
            });
        }

        // --- BACK BUTTON ---
        document.getElementById('backToStations')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/stations/';
        });
    }
}
const createStationFormEl = document.getElementById('createStationForm');

if (createStationFormEl) {
    createStationFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (createStationFormEl.dataset.locked === "1") return;
        createStationFormEl.dataset.locked = "1";

        const stationName = document.getElementById('stationName').value.trim();
        const stationId = document.getElementById('stationId').value.trim();
        const location = document.getElementById('location').value.trim();
        const category = document.getElementById('category').value.trim();
        const description = document.getElementById('description').value.trim();

        if (!stationName) {
            showToast('Please fill the Station Name field', 'error');
            createStationFormEl.dataset.locked = "0";
            return;
        }
        if (!stationId) {
            showToast('Please fill the Station ID field', 'error');
            createStationFormEl.dataset.locked = "0";
            return;
        }
        if (!location) {
            showToast('Please fill the Location field', 'error');
            createStationFormEl.dataset.locked = "0";
            return;
        }
        if (!category) {
            showToast('Please fill the Category field', 'error');
            createStationFormEl.dataset.locked = "0";
            return;
        }
        if (!description) {
            showToast('Please fill the Description field', 'error');
            createStationFormEl.dataset.locked = "0";
            return;
        }

        const pattern = /^STSSA\d{5}$/;
        if (!pattern.test(stationId)) {
            showToast('Station ID must be in CAPS (STSSA) followed by 5 digits', 'error');
            createStationFormEl.dataset.locked = "0";
            return;
        }

        const stationData = {
            station_name: stationName,
            station_id: stationId,
            location,
            category,
            description,
            status: document.getElementById('status').value.toLowerCase()
        };

        try {
            const response = await fetch('/stations-create/', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(stationData)
            });

            const data = await response.json();

            if (!response.ok) {
                showToast(data.status || "Validation failed", 'error');
                createStationFormEl.dataset.locked = "0";
                return;
            }

            showToast("Station created successfully!", 'success');

            setTimeout(() => {
                window.location.href = '/stations/';
            }, 1200);

        } catch (err) {
            showToast('Network error', 'error');
            createStationFormEl.dataset.locked = "0";
        }
    });
}// ================================================================
// REPORTS: INITIALIZATION (ENFORCE USER LOGIN PERMISSIONS)
// ================================================================
async function initializeReportPage() {

    console.log('[Reports] Synchronizing Secure Data...');

    // ------------------------------------------------------------
    // 0. Ensure stations loaded BEFORE dropdown
    // ------------------------------------------------------------
    if (!allStationsData || allStationsData.length === 0) {
        await window.fetchAndDisplayStations();
    }

    // ------------------------------------------------------------
    // 1. Load transactions if not cached
    // ------------------------------------------------------------
    if (!baseTransactionData || baseTransactionData.length === 0) {

        const rawData = await smartFetch('/iot/transactions/');

        if (Array.isArray(rawData)) {

            baseTransactionData = rawData.map(apiTx => {

                if (!apiTx) return null;

                const bowser = apiTx.bowser || {};
                const stationary = apiTx.stationary || {};
                const tank = apiTx.tank || {};

                const type = (apiTx.type || 'bowser').toLowerCase();
                const dt = parseBackendDateTime(apiTx.todate, apiTx.totime);

                const bId =
                    bowser.bwsrid ||
                    apiTx.bwsrid ||
                    apiTx.bowser_id ||
                    stationary.stanid ||
                    tank.tankid;

                return {
                    id: apiTx.trnsid || bowser.trnsid || '-',
                    deviceId: apiTx.devID || apiTx.stationid || 'N/A',
                    bowserId: String(bId || 'N/A').trim(),
                    type: type,
                    pumpId: bowser.pumpid || stationary.pumpid || 'P01',
                    datetimeString: `${apiTx.todate} ${apiTx.totime}`,
                    dateTimeObj: dt,
                    vol: parseFloat(
                        bowser.trnvol ||
                        stationary.trnvol ||
                        tank.trnvol ||
                        apiTx.trnvol
                    ) || 0,
                    amt: parseFloat(
                        bowser.trnamt ||
                        stationary.trnamt ||
                        tank.trnamt ||
                        apiTx.trnamt
                    ) || 0,
                    totalVol: parseFloat(bowser.totvol || apiTx.totvol || 0),
                    totalAmt: parseFloat(bowser.totamt || apiTx.totamt || 0),
                    status:
                        bowser.pmpsts ||
                        stationary.pmpsts ||
                        tank.tnksts ||
                        apiTx.pmpsts ||
                        'IDLE',
                    attender: apiTx.attnid || 'N/A',
                    vehicle: apiTx.vehnum || 'N/A'
                };

            }).filter(Boolean);

            baseTransactionData.sort(
                (a, b) => (b.dateTimeObj || 0) - (a.dateTimeObj || 0)
            );
        }
    }

    // ------------------------------------------------------------
    // 🔥 CRITICAL: FEED MASTER DATASET FOR EXPORT PIPELINE
    // ------------------------------------------------------------
    masterReportData = [...baseTransactionData];

    // ------------------------------------------------------------
    // 2. Role permission filter
    // ------------------------------------------------------------
    const role = (currentUser?.role || '').toLowerCase();

    if (role !== 'super admin') {

        const allowedBowserIds = await fetchUserBowserIds();

        const allowed = allowedBowserIds.map(x =>
            String(x).trim().toLowerCase()
        );

        currentReportData = masterReportData.filter(tx =>
            allowed.includes(String(tx.bowserId).toLowerCase())
        );

    } else {
        currentReportData = [...masterReportData];
    }

    // ------------------------------------------------------------
    // 3. Populate station dropdown
    // ------------------------------------------------------------
    const stationSelect = document.getElementById('reportStationFilter');

    if (stationSelect) {

        stationSelect.innerHTML =
            `<option value="all-stations">-- All Stations --</option>`;

        allStationsData.forEach(s => {

            const id = s.station_id || s.id;
            const name = s.station_name || s.name || id;

            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${name} (${id})`;

            stationSelect.appendChild(opt);
        });
    }

    // ------------------------------------------------------------
    // 4. Sync export snapshot
    // ------------------------------------------------------------
    masterReportData = [...currentReportData];

    currentTransactionData = [...currentReportData];

    currentReportPage = 1;

    window.populateReportTable(currentReportData);

    console.log("[Reports] Ready. Records:", currentReportData.length);
}


// ==========================================
    // 🛡️ PAGE-SPECIFIC INITIALIZATION (STOP SPAM)
    // ==========================================
    const path = window.location.pathname.toLowerCase();

    if (document.getElementById('transactionChart')) {
        console.log("[Init] Dashboard detected.");
        startTransactionAutoRefresh(); 
    }

    if (path.includes('reports.html') || document.getElementById('reportTableBody')) {
        console.log("[Init] Reports detected.");
        initializeReportPage();
    }
});

// ==========================================
// ⏱ SECURE REFRESH LOGIC (STOPS ABORT ERROR)
// ==========================================
let isRefreshing = false;
async function startTransactionAutoRefresh() {
    if (isRefreshing) return; // Prevent overlapping fetches
    
    const needsData = document.getElementById('transactionTableBody') || 
                      document.getElementById('transactionChart');

    if (needsData && currentUser) {
        isRefreshing = true;
        try {
            await window.fetchTransactions(); // Wait for actual server response
        } finally {
            isRefreshing = false;
            // Only schedule the NEXT run after this one is 100% finished
            setTimeout(startTransactionAutoRefresh, 15000); 
        }
    }
}// --- NEW FUNCTIONS FOR DEVICE/TANK/ASSET EDITING (Resolves Uncaught TypeError) ---

/**
 * Global placeholder variable for the currently edited device's database ID (PK)
 * or unique string ID (e.g., BU007).
 */
let currentDeviceEditId = null;
let currentDeviceEditType = null;

/**
 * Finds device/tank/asset data and opens the edit modal.
 * @param {string} id - The unique database ID (PK) of the device/tank/asset.
 * @param {string} type - The type of device ('bowser', 'tank', 'stationary').
 */
window.openEditDeviceModal = function (id, type) {

    if (!editDeviceModal) {
        return showToast('Edit modal not initialized.', 'error');
    }

    let deviceData = null;
    let listData = [];

    if (type === 'bowser') listData = allBowserData;
    else if (type === 'tank') listData = allTankData;
    else if (type === 'stationary') listData = allStationaryData;

    deviceData = listData.find(d => String(d.id) === String(id));

    if (!deviceData) {
        return showToast(`Error: ${type} not found.`, 'error');
    }

    currentDeviceEditId = id;
    currentDeviceEditType = type;

    const idKey =
        type === 'bowser' ? 'bowser_id' :
        type === 'tank' ? 'tank_id' :
        'stationary_id';

    const nameKey =
        type === 'bowser' ? 'bowser_name' :
        type === 'tank' ? 'tank_name' :
        'stationary_name';

    const descKey =
        type === 'bowser' ? 'bowser_description' :
        type === 'tank' ? 'tank_description' :
        'stationary_description';

    document.getElementById('editDeviceModalLabel').textContent =
        `Edit ${type.toUpperCase()} : ${deviceData[idKey]}`;

    // ID LOCKED
    const idField = document.getElementById('editDeviceIdField');
    idField.value = deviceData[idKey];
    idField.disabled = true;

    // MQTT LOCKED
    const mqttField = document.getElementById('editDeviceMqttId');
    if (mqttField) {
        mqttField.value = deviceData.mqtt_id || '';
        mqttField.disabled = true;
    }

    // Editable fields
    document.getElementById('editDeviceName').value = deviceData[nameKey] || '';
    document.getElementById('editDeviceDescription').value = deviceData[descKey] || '';

    // REMOVE STATUS UI
    const statusEl = document.getElementById('editDeviceStatus');
    if (statusEl) statusEl.style.display = 'none';

    // Volume for stationary
    const volumeInput = document.getElementById('editDeviceVolume');
    if (volumeInput) {
        volumeInput.value = deviceData.volume || '0.00';
    }

    editDeviceModal.show();
};
window.updateDeviceTankAsset = async function (e) {

    if (e) e.preventDefault();

    const id = currentDeviceEditId;
    const type = currentDeviceEditType;

    if (!id || !type)
        return showToast('Nothing selected to update.', 'error');

    const name = document.getElementById('editDeviceName').value.trim();
    const desc = document.getElementById('editDeviceDescription').value.trim();
    const mqtt = document.getElementById('editDeviceMqttId')?.value || '';

    if (!name)
        return showToast('Name required.', 'error');

    let payload = { mqtt_id: mqtt };
    let endpoint = '';

    if (type === 'bowser') {
        payload.bowser_name = name;
        payload.bowser_description = desc;
        endpoint = `/bowsers/${id}/`;
    }

    if (type === 'tank') {
        payload.tank_name = name;
        payload.tank_description = desc;
        endpoint = `/tanks/${id}/`;
    }

    if (type === 'stationary') {
        payload.stationary_name = name;
        payload.stationary_description = desc;
        endpoint = `/stationaries/${id}/`;

        const volume = document.getElementById('editDeviceVolume')?.value;
        if (volume) payload.volume = volume;
    }

    try {

        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast(`${type} updated successfully!`, 'success');
            editDeviceModal.hide();
            window.location.reload();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast('Update failed', 'error');
            console.error(err);
        }

    } catch (err) {
        console.error(err);
        showToast('Update Failed. check credentials.', 'error');
    }
};
// ================================================================
// REPORTS: DATA LAYERS (DO NOT TOUCH AFTER THIS)
// ================================================================

window.masterReportData = window.masterReportData || [];
window.currentReportData = [];
window.currentTransactionData = [];


// ================================================================
// REPORT FILTER ENGINE (FIXED STATION MATCH)
// ================================================================
window.renderReportTable = function () {

    const filters = getFilterValues();

    const station = (filters.station || 'all-stations').trim();
    const type = (filters.type || '').toLowerCase();

    const fromDT = filters.fromDate
        ? new Date(`${filters.fromDate}T${filters.fromTime || "00:00"}`)
        : null;

    const toDT = filters.toDate
        ? new Date(`${filters.toDate}T${filters.toTime || "23:59"}`)
        : null;

    currentReportData = masterReportData.filter(tx => {

        // ✅ FIXED: station filter uses deviceId
        if (station !== 'all-stations') {
            if (String(tx.deviceId).trim() !== station) return false;
        }

        // type filter
        if (type && type !== 'all types') {
            if (tx.type.toLowerCase() !== type) return false;
        }

        // date filter
        if (tx.dateTimeObj) {
            if (fromDT && tx.dateTimeObj < fromDT) return false;
            if (toDT && tx.dateTimeObj > toDT) return false;
        }

        return true;
    });

    // export snapshot always syncs
    currentTransactionData = [...currentReportData];

    currentReportPage = 1;
    populateReportTable();

    console.log("Filtered:", currentReportData.length);
};


// ================================================================
// OPEN EXPORT CONFIG
// ================================================================
window.openExportConfig = function () {

    window.renderReportTable();

    if (!currentTransactionData.length) {
        showToast('No data to export.', 'warning');
        return;
    }

    exportConfigModal.show();
};


// ================================================================
// PREVIEW EXPORT
// ================================================================
window.previewExport = function () {

    window.renderReportTable();

    const data = currentTransactionData;

    if (!data.length) {
        showToast('No data to preview.', 'warning');
        return;
    }

    const columns = getSelectedColumns();
    const container = document.getElementById('previewContainer');

    let vol = 0;
    let amt = 0;

    data.forEach(tx => {
        vol += parseFloat(tx.vol || 0);
        amt += parseFloat(tx.amt || 0);
    });

    let html = `
        <h5 class="text-center mb-2">Preview</h5>
        <div class="text-center small mb-2">
            Records: ${data.length} |
            Total: ${vol.toFixed(2)} Ltr / ₹${amt.toFixed(2)}
        </div>
        <table class="table table-sm table-striped">
        <thead><tr>
        <th>#</th>
        ${columns.map(c => `<th>${c.title}</th>`).join('')}
        </tr></thead><tbody>
    `;

    data.slice(0, 50).forEach((row, i) => {
        html += `<tr><td>${i + 1}</td>`;
        columns.forEach(col => {
            let v = row[col.key];

            if (['vol','amt','totalVol','totalAmt'].includes(col.key))
                v = parseFloat(v || 0).toFixed(2);

            if (col.key === 'datetimeString')
                v = formatSSADate(v);

            html += `<td>${v ?? '-'}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;

    container.innerHTML = html;

    exportConfigModal.hide();
    previewModal.show();
};


// ================================================================
// DOWNLOAD REPORT
// ================================================================
window.downloadReport = function (type) {

    // rebuild dataset from UI filters
    window.renderReportTable();

    const data = currentReportData;

    if (!data || data.length === 0) {
        showToast('No data to export.', 'warning');
        return;
    }

    const columns = getSelectedColumns();

    const clean = v =>
        typeof v === 'string'
            ? parseFloat(v.replace(/[^\d.-]/g, '')) || 0
            : parseFloat(v) || 0;

    if (type === 'csv') {

        let csv = "S.No," + columns.map(c => c.title).join(",") + "\n";

        data.forEach((row, i) => {
            let r = `${i + 1},` + columns.map(col => {
                let val = row[col.key];
                if (['vol','amt','totalVol','totalAmt'].includes(col.key))
                    val = clean(val).toFixed(2);
                if (col.key === 'datetimeString')
                    val = formatSSADate(val);
                return `"${val ?? ''}"`;
            }).join(",");
            csv += r + "\n";
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `SSA_Report_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();

        showToast('CSV Downloaded!', 'success');
    }

    exportConfigModal.hide();
};

// 6. Download Logic (Updated with cleaned data parsing and Logo placement)
window.downloadReport = function (type) {
    const columns = getSelectedColumns();
    const data = currentTransactionData;

    // Rerun renderReportTable to ensure currentTransactionData is correctly filtered before download
    if (document.getElementById('reportsView')) {
        window.renderReportTable();
    }

    if (!data || data.length === 0) {
        showToast('No data to export. Please apply filters and generate the report first.', 'warning');
        return;
    }

    const filters = getFilterValues();
    const fromDate = filters.fromDate;
    const toDate = filters.toDate;
    const fromTime = filters.fromTime;
    const toTime = filters.toTime;

    // Helper to extract clean numbers (removing currency symbols or unit strings)
    const cleanNum = (val) => {
        if (typeof val === 'string') {
            return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
        }
        return parseFloat(val) || 0;
    };

    let finalVolumeSum = data.reduce((sum, tx) => sum + cleanNum(tx.vol), 0).toFixed(2);
    let finalAmountSum = data.reduce((sum, tx) => sum + cleanNum(tx.amt), 0).toFixed(2);

    if (type === 'csv') {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += `Report filtered from ${fromDate} ${fromTime} to ${toDate} ${toTime}\r\n`;
        csvContent += `Total Records Found,${data.length}\r\n`;
        csvContent += `Filtered Total Volume,${finalVolumeSum} Ltr\r\n`;
        csvContent += `Filtered Total Amount,Rs. ${finalAmountSum}\r\n\r\n`;

        csvContent += "S.No," + columns.map(c => c.title).join(",") + "\r\n";

        data.forEach((row, index) => {
            let rowStr = `${index + 1},`;
            rowStr += columns.map(col => {
                let val = row[col.key] || "";
                if (['vol', 'amt', 'totalVol', 'totalAmt'].includes(col.key)) {
                    val = cleanNum(val).toFixed(2);
                }
                if (col.key === 'datetimeString') val = formatSSADate(val);
                // Escape quotes for CSV safety
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(",");
            csvContent += rowStr + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.href = encodedUri;
        link.download = `SSA_Report_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        showToast('CSV Downloaded!', 'success');

    } else if (type === 'pdf') {
        if (!window.jspdf) {
            showToast('PDF library (jspdf) failed to load.', 'info');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation

        // SSA Logo Logic
        const logoImgEl = document.querySelector('.navbar-logo-final');
        let imgData = 'ssa_logo.png'; // Fallback path

        if (logoImgEl && logoImgEl.src) {
            imgData = logoImgEl.src;
        }

        const imgWidth = 35; 
        const imgHeight = 12;
        
        try {
            if (typeof doc.addImage === 'function') {
                doc.addImage(imgData, 'PNG', 14, 10, imgWidth, imgHeight);
            }
        } catch (e) {
            console.warn("Logo could not be added to PDF:", e);
        }

        // Header Text
        doc.setFontSize(18);
        doc.setTextColor(0, 51, 102); // Dark Blue
        doc.text("SSA AUTOMATION - TRANSACTION REPORT", 55, 18);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Date Range: ${fromDate} ${fromTime} to ${toDate} ${toTime}`, 14, 30);
        doc.text(`Total Records: ${data.length} | Total Volume: ${finalVolumeSum} Ltr | Total Amount: Rs. ${finalAmountSum}`, 14, 35);

        const tableHead = [['S.No', ...columns.map(c => c.title)]];
        const tableBody = data.map((row, i) => [
            i + 1,
            ...columns.map(col => {
                let val = row[col.key];
                if (['vol', 'amt', 'totalVol', 'totalAmt'].includes(col.key)) {
                    return cleanNum(val).toFixed(2);
                }
                if (col.key === 'datetimeString') return formatSSADate(val);
                return val || '-';
            })
        ]);

        doc.autoTable({
            head: tableHead,
            body: tableBody,
            startY: 42,
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 12 } } // Narrower S.No column
        });

        doc.save(`SSA_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('PDF Downloaded!', 'success');
    }
    exportConfigModal.hide();
};
window.changeReportPage = function (page) {
    const totalPages = Math.ceil(currentReportData.length / reportRowsPerPage);

    if (page < 1 || page > totalPages) return;

    currentReportPage = page;

    window.populateReportTable(currentReportData);

    const table = document.getElementById('reportTable');
    if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ================================================================
// RENDERS: GENERATE & POPULATE (NEAT ALIGNMENT LIKE TRANSACTION)
// ================================================================

// MISSING HELPER FIX: Defined here to resolve Console ReferenceError
function renderReportPagination(totalPages, container) {
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const prevDisabled = currentReportPage === 1 ? 'disabled' : '';
    let html = `
        <li class="page-item ${prevDisabled}">
            <a class="page-link" href="#" onclick="changeReportPage(${currentReportPage - 1});return false;">Previous</a>
        </li>
    `;

    let start = Math.max(1, currentReportPage - 2);
    let end = Math.min(totalPages, currentReportPage + 2);

    for (let i = start; i <= end; i++) {
        html += `
            <li class="page-item ${i === currentReportPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changeReportPage(${i});return false;">${i}</a>
            </li>
        `;
    }

    const nextDisabled = currentReportPage === totalPages ? 'disabled' : '';
    html += `
        <li class="page-item ${nextDisabled}">
            <a class="page-link" href="#" onclick="changeReportPage(${currentReportPage + 1});return false;">Next</a>
        </li>
    `;
    container.innerHTML = html;
}


window.populateReportTable = function () {
    const tableBody = document.getElementById('reportTableBody');
    const paginationEl = document.getElementById('reportPaginationControls');
    const infoEl = document.getElementById('reportTableInfo');

    if (!tableBody) return;
    tableBody.innerHTML = '';

    const data = currentReportData || [];

    if (data.length === 0) {
        tableBody.innerHTML =
            '<tr><td colspan="15" class="text-center p-4 text-muted">No records found.</td></tr>';
        if (paginationEl) paginationEl.innerHTML = '';
        if (infoEl) infoEl.textContent = 'Showing 0 entries';
        return;
    }

    // --- SAFETY: prevent invalid page index after filtering ---
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / reportRowsPerPage);

    if (currentReportPage > totalPages) {
        currentReportPage = totalPages;
    }
    if (currentReportPage < 1) {
        currentReportPage = 1;
    }

    const startIndex = (currentReportPage - 1) * reportRowsPerPage;
    const displayData = data.slice(startIndex, startIndex + reportRowsPerPage);

    tableBody.innerHTML = displayData.map((tx, index) => {
        const statusBadge = getStatusBadgeClass(tx.status);
        const typeBadge = tx.type === 'bowser' ? 'bg-success' : 'bg-info';
        const sNo = totalItems - (startIndex + index);

        return `
            <tr>
                <td>${sNo}</td>
                <td>${tx.id}</td>
                <td>${tx.deviceId}</td>
                <td>${tx.bowserId}</td>
                <td><span class="badge ${typeBadge}">${tx.type}</span></td>
                <td>${tx.pumpId || 'P01'}</td>
                <td>${formatSSADate(tx.datetimeString)}</td>
                <td class="fw-bold">${(tx.vol || 0).toFixed(2)}</td>
                <td class="text-success fw-bold">${(tx.amt || 0).toFixed(2)}</td>
                <td class="text-muted">${(tx.totalVol || 0).toFixed(2)}</td>
                <td class="text-muted">${(tx.totalAmt || 0).toFixed(2)}</td>
                <td>${tx.attender || 'N/A'}</td>
                <td>${tx.vehicle || 'N/A'}</td>
                <td><span class="badge ${statusBadge}">${tx.status}</span></td>
            </tr>
        `;
    }).join('');

    // --- TOTALS ---
    const totalVol = data.reduce((s, t) => s + (t.vol || 0), 0);
    const totalAmt = data.reduce((s, t) => s + (t.amt || 0), 0);

    document.getElementById('reportTotalVolume').textContent =
        totalVol.toFixed(2) + ' Ltr';
    document.getElementById('reportTotalAmount').textContent =
        '₹' + totalAmt.toFixed(2);

    // --- INFO TEXT ---
    if (infoEl) {
        infoEl.textContent =
            `Showing ${startIndex + 1} to ${Math.min(startIndex + reportRowsPerPage, totalItems)} of ${totalItems}`;
    }

    // --- PAGINATION ---
    renderReportPagination(totalPages, paginationEl);
};

function parseBackendDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    try {
        let year, month, day, hour, minute, second;

        // Handle YYMMDD (e.g., 251226 for Dec 26, 2025)
        if (dateStr.length === 6 && !dateStr.includes('/') && !dateStr.includes('-')) {
            year = parseInt('20' + dateStr.substring(0, 2)); // Correctly handles 2025
            month = parseInt(dateStr.substring(2, 4)) - 1;
            day = parseInt(dateStr.substring(4, 6));
        } 
        else {
            const parts = dateStr.split(/[\/\-]/);
            if (parts[0].length === 4) { // YYYY-MM-DD
                year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]);
            } else { // DD/MM/YYYY
                day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
            }
        }

        if (timeStr.includes(':')) {
            [hour, minute, second] = timeStr.split(':').map(n => parseInt(n));
        } else {
            hour = parseInt(timeStr.substring(0, 2));
            minute = parseInt(timeStr.substring(2, 4));
            second = parseInt(timeStr.substring(4, 6) || '00');
        }

        return new Date(year, month, day, hour, minute, second || 0);
    } catch (e) {
        console.error("Date Parse Failure:", dateStr, timeStr);
        return null;
    }
}/* ================================================================
   FINAL UNRESTRICTED: Period Detail Modal Logic
   ================================================================ */
window.openPeriodDetail = function (periodType) {
    if (!periodDetailModal) return;

    // Use baseTransactionData to access the full 703+ records
    const masterData = (typeof baseTransactionData !== 'undefined' && baseTransactionData.length > 0) 
                       ? baseTransactionData 
                       : currentTransactionData;

    if (!masterData || masterData.length === 0) return showToast('No data found.', 'error');

    const now = new Date();
    let title = "";
    let filteredData = [];

    if (periodType === '7') {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 7);
        cutoff.setHours(0,0,0,0);
        title = `Last 7 Days Activity (Since ${cutoff.toLocaleDateString('en-GB')})`;
        filteredData = masterData.filter(tx => tx.dateTimeObj && tx.dateTimeObj >= cutoff);
    } 
    else if (periodType === '30') {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 30);
        cutoff.setHours(0,0,0,0);
        title = `Last 30 Days Activity (Since ${cutoff.toLocaleDateString('en-GB')})`;
        filteredData = masterData.filter(tx => tx.dateTimeObj && tx.dateTimeObj >= cutoff);
    } 
    else {
        // TOTAL ACTIVITY - No date restriction
        title = `Total System Activity (${masterData.length} Records Found)`;
        filteredData = [...masterData]; 
    }

    document.getElementById('periodDetailTitle').textContent = title;
    const tbody = document.getElementById('periodDetailTableBody');
    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No records found.</td></tr>';
    } else {
        // Sort newest first: 2026 at top, 2025 follows below
        filteredData.sort((a, b) => (b.dateTimeObj || 0) - (a.dateTimeObj || 0));

        // Increased slice to 800 to ensure all 703 records can be seen
        const rowsHTML = filteredData.slice(0, 800).map(tx => {
            const dateDisplay = typeof formatSSADate === 'function' ? formatSSADate(tx.datetimeString) : tx.datetimeString;
            return `
                <tr>
                    <td>${tx.id || '-'}</td>
                    <td>${tx.station || tx.deviceId || 'N/A'}</td>
                    <td>${dateDisplay}</td>
                    <td class="fw-bold text-success">${parseFloat(tx.vol || 0).toFixed(2)}</td>
                    <td class="fw-bold text-primary">₹${parseFloat(tx.amt || 0).toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHTML;

        if (filteredData.length > 800) {
            tbody.insertAdjacentHTML('beforeend', `<tr><td colspan="5" class="text-center small text-muted bg-light">Showing newest 800 of ${filteredData.length} records...</td></tr>`);
        }
    }

    periodDetailModal.show();
};