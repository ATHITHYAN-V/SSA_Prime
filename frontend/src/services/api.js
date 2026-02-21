import axios from 'axios';

// Configuration
const API_BASE_URL = 'http://127.0.0.1:8000';
const AUTH_KEY = "ssa123";      // Must match settings.GLOBAL_TZ_KEY
const PRODUCT_KEY = "ssa123";

// Create Axios Instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'TZ-KEY': AUTH_KEY,
        'PRODUCT-KEY': PRODUCT_KEY,
    }
});

// Helper: Get CSRF Token from cookies
const getCookie = (name) => {
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
};

// Request Interceptor: Inject Tokens
api.interceptors.request.use(
    (config) => {
        // 1. Inject CSRF Token (prevent 403 on some Django setups)
        const csrfToken = getCookie('csrftoken');
        if (csrfToken) {
            config.headers['X-CSRFToken'] = csrfToken;
        }

        // 2. Inject Bearer Token from LocalStorage
        try {
            const userStr = localStorage.getItem('ssaUser');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.token) {
                    config.headers['Authorization'] = `Bearer ${user.token}`;
                }
            }
        } catch (e) {
            console.error("Error parsing user session:", e);
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle Global Errors
api.interceptors.response.use(
    (response) => {
        // Return .data directly to match "smartFetch" behavior if desired,
        // or return the full response. For now, we return full response 
        // but can extract data in the services.
        return response;
    },
    (error) => {
        const status = error.response ? error.response.status : null;

        if (status === 401) {
            console.warn("Session expired. Redirecting to login...");
            localStorage.removeItem('ssaUser');
            window.location.href = '/login';
        } else if (status === 403) {
            console.error("Access Denied (403). Check TZ-KEY or permissions.");
        }

        return Promise.reject(error);
    }
);

export default api;
