import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    fetchStationById,
    fetchBowsers,
    fetchTanks,
    fetchStationaries,
    fetchTransactions
} from '../api/stationApi';

const STALE_5MIN = 5 * 60 * 1000;

/**
 * Lazy-loaded station details.
 * Fetches station info + bowsers + tanks + stationaries + transactions
 * ONLY when called (i.e., when the user navigates to a station page).
 * Results are cached for 5 minutes.
 */
export const useStationDetails = (stationId) => {
    const queryClient = useQueryClient();

    const stationQuery = useQuery({
        queryKey: ['station', stationId],
        queryFn: () => fetchStationById(stationId),
        staleTime: STALE_5MIN,
        enabled: !!stationId,
    });

    const bowsersQuery = useQuery({
        queryKey: ['bowsers', stationId],
        queryFn: () => fetchBowsers(stationId),
        staleTime: STALE_5MIN,
        enabled: !!stationId,
    });

    const tanksQuery = useQuery({
        queryKey: ['tanks', stationId],
        queryFn: () => fetchTanks(stationId),
        staleTime: STALE_5MIN,
        enabled: !!stationId,
    });

    const stationariesQuery = useQuery({
        queryKey: ['stationaries', stationId],
        queryFn: () => fetchStationaries(stationId),
        staleTime: STALE_5MIN,
        enabled: !!stationId,
    });

    const transactionsQuery = useQuery({
        queryKey: ['transactions', stationId],
        queryFn: () => fetchTransactions(stationId),
        staleTime: STALE_5MIN,
        enabled: !!stationId,
    });

    /** Invalidate a specific device type (after add/edit/delete) */
    const invalidate = (type) => {
        queryClient.invalidateQueries({ queryKey: [type, stationId] });
    };

    /** Invalidate all queries for this station */
    const refetchAll = () => {
        queryClient.invalidateQueries({ queryKey: ['station', stationId] });
        queryClient.invalidateQueries({ queryKey: ['bowsers', stationId] });
        queryClient.invalidateQueries({ queryKey: ['tanks', stationId] });
        queryClient.invalidateQueries({ queryKey: ['stationaries', stationId] });
        queryClient.invalidateQueries({ queryKey: ['transactions', stationId] });
    };

    const isLoading = stationQuery.isLoading || bowsersQuery.isLoading ||
        tanksQuery.isLoading || stationariesQuery.isLoading || transactionsQuery.isLoading;

    return {
        station: stationQuery.data || null,
        bowsers: bowsersQuery.data || [],
        tanks: tanksQuery.data || [],
        stationaries: stationariesQuery.data || [],
        transactions: transactionsQuery.data || [],
        isLoading,
        isError: stationQuery.isError,
        error: stationQuery.error,
        invalidate,
        refetchAll,
    };
};
