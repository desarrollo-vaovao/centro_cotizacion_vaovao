import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

export function useDashboard(period, trendGranularity = 'mes', refDate) {
  return useQuery({
    queryKey: ['dashboard', period, trendGranularity, refDate],
    queryFn: () => {
      const params = new URLSearchParams({ period, trendGranularity });
      if (refDate) params.set('refDate', refDate);
      return api.get(`/dashboard?${params.toString()}`);
    }
  });
}

export function useClientDashboard(clientId, period) {
  return useQuery({
    queryKey: ['dashboard', 'cliente', clientId, period],
    queryFn: () => api.get(`/dashboard/cliente/${clientId}?period=${period}`),
    enabled: Boolean(clientId)
  });
}
