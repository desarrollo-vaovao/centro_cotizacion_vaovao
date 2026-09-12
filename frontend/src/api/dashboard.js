import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

export function useDashboard(period, trendGranularity = 'mes') {
  return useQuery({
    queryKey: ['dashboard', period, trendGranularity],
    queryFn: () => api.get(`/dashboard?period=${period}&trendGranularity=${trendGranularity}`)
  });
}

export function useClientDashboard(clientId, period) {
  return useQuery({
    queryKey: ['dashboard', 'cliente', clientId, period],
    queryFn: () => api.get(`/dashboard/cliente/${clientId}?period=${period}`),
    enabled: Boolean(clientId)
  });
}
