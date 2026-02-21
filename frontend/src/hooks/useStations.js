import { useQuery } from '@tanstack/react-query';
import { fetchStations, fetchAllAssignments, fetchUsers } from '../api/stationApi';

const STALE_5MIN = 5 * 60 * 1000;

/**
 * Cached station list + assignments + users for the Stations page.
 * Revisiting the page within 5 minutes = zero API calls.
 */
export const useStations = () => {
    const stationsQuery = useQuery({
        queryKey: ['stations'],
        queryFn: fetchStations,
        staleTime: STALE_5MIN,
    });

    const assignmentsQuery = useQuery({
        queryKey: ['assignments'],
        queryFn: () => fetchAllAssignments().catch(() => []),
        staleTime: STALE_5MIN,
    });

    const usersQuery = useQuery({
        queryKey: ['users'],
        queryFn: () => fetchUsers().catch(() => []),
        staleTime: STALE_5MIN,
    });

    return {
        stations: stationsQuery.data || [],
        assignments: assignmentsQuery.data || [],
        users: usersQuery.data || [],
        isLoading: stationsQuery.isLoading,
        isError: stationsQuery.isError,
        error: stationsQuery.error,
        refetch: () => {
            stationsQuery.refetch();
            assignmentsQuery.refetch();
            usersQuery.refetch();
        },
    };
};
