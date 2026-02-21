import { useQuery } from '@tanstack/react-query';
import { 
    fetchStations, fetchAllTransactions, fetchAdmins, fetchUsers,
    fetchAssetBarcodes 
} from '../api/stationApi';

const STALE_5MIN = 5 * 60 * 1000;

/**
 * Dashboard stats hook.
 * For Super Admin: fetches admins AND users separately.
 * For others: fetches users only.
 * Machine status counts active/inactive stations.
 */
export const useDashboardStats = (role) => {
    const isSuperAdmin = role === 'Super Admin';
    const isUser = role === 'User';

    const stationsQuery = useQuery({
        queryKey: ['stations'],
        queryFn: fetchStations,
        staleTime: STALE_5MIN,
    });

    const adminsQuery = useQuery({
        queryKey: ['admins'],
        queryFn: () => fetchAdmins().catch(() => []),
        staleTime: STALE_5MIN,
        enabled: isSuperAdmin,
    });

    const usersQuery = useQuery({
        queryKey: ['users'],
        queryFn: () => fetchUsers().catch(() => []),
        staleTime: STALE_5MIN,
    });

    const transactionsQuery = useQuery({
        queryKey: ['allTransactions'],
        queryFn: () => fetchAllTransactions().catch(() => []),
        staleTime: STALE_5MIN,
    });

    // Asset Queries (Only for 'User')
    const assetsQuery = useQuery({
        queryKey: ['assetBarcodes'],
        queryFn: () => fetchAssetBarcodes().catch(() => []),
        staleTime: STALE_5MIN,
        enabled: isUser
    });

    const stations = stationsQuery.data || [];
    const admins = adminsQuery.data || [];
    const users = usersQuery.data || [];
    const transactions = transactionsQuery.data || [];
    
    const assetBarcodes = assetsQuery.data || [];

    const activeStations = stations.filter(s => s.status?.toLowerCase() === 'active' || s.is_active).length;
    const inactiveStations = stations.length - activeStations;
    
    // Calculate total assets
    const totalAssets = assetBarcodes.length;

    return {
        stations,
        admins,
        users,
        transactions,
        assets: { barcodes: assetBarcodes },
        isSuperAdmin,
        stats: {
            stations: stations.length,
            admins: admins.length,
            users: users.length,
            transactions: transactions.length,
            active_machines: activeStations,
            inactive_machines: inactiveStations,
            totalAssets,
        },
        isLoading: stationsQuery.isLoading || usersQuery.isLoading ||
            transactionsQuery.isLoading || (isSuperAdmin && adminsQuery.isLoading) ||
            (isUser && assetsQuery.isLoading),
        isError: stationsQuery.isError,
    };
};
