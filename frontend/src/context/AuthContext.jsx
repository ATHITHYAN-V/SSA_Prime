import React, { createContext, useState, useEffect, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const queryClient = useQueryClient();

    useEffect(() => {
        // Load user from localStorage on mount
        const storedUser = localStorage.getItem('ssaUser');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse stored user", e);
                localStorage.removeItem('ssaUser');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password, portalId) => {
        try {
            const response = await api.post('/auth/login/', {
                email,
                password,
                portal_id: portalId
            });

            // Handle different structure based on backend response (data.data or data directly)
            // Legacy app.js handles: raw.data || raw.user || raw
            const raw = response.data;
            const data = raw.data || raw.user || raw;

            if (!data || !data.token) {
                throw new Error("Invalid response from server");
            }

            // Normalize Role
            let finalRole = "User";
            const backendRole = (data.role || "").toLowerCase().trim();
            if (backendRole === "superadmin" || backendRole === "super admin") finalRole = "Super Admin";
            if (backendRole === "admin") finalRole = "Admin";

            const userData = {
                id: data.id,
                name: data.name || email.split("@")[0],
                email: data.email,
                role: finalRole,
                portalId: data.portal_id || null,
                token: data.token
            };

            setUser(userData);
            localStorage.setItem('ssaUser', JSON.stringify(userData));
            return { success: true, role: finalRole };

        } catch (error) {
            console.error("Login failed:", error);
            const msg = error.response?.data?.detail || error.response?.data?.status || "Login failed";
            return { success: false, message: msg };
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout/');
        } catch (e) {
            console.warn("Logout API call failed", e);
        }
        setUser(null);
        localStorage.removeItem('ssaUser');
        localStorage.removeItem('ssaFilters');
        
        // Clear all React Query cache
        queryClient.removeQueries();
        queryClient.clear();
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

