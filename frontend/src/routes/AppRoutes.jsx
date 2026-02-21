import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import StationsList from '../pages/StationsList';
import StationDetail from '../pages/StationDetail';
import CreateStation from '../pages/CreateStation';
import UserManagement from '../pages/UserManagement';
import AdminManagement from '../pages/AdminManagement';
import Transactions from '../pages/Transactions';
import Reports from '../pages/Reports';
import AssetManagement from '../pages/AssetManagement';
import ProtectedRoute from '../components/ProtectedRoute';

const AppRoutes = () => {
    return (
        <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/stations" element={<StationsList />} />
                <Route path="/stations/create" element={<CreateStation />} />
                <Route path="/stations/:stationId" element={<StationDetail />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/reports" element={<Reports />} />
                
                {/* Role Specific Routes */}
                <Route element={<ProtectedRoute allowedRoles={['Super Admin']} />}>
                    <Route path="/admins" element={<AdminManagement />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']} />}>
                    <Route path="/users" element={<UserManagement />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['User']} />}>
                    <Route path="/assets" element={<AssetManagement />} />
                </Route>
            </Route>

            {/* Default Redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
};

export default AppRoutes;
