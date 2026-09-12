import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

export function useDashboard(period, refDate) {
  return useQuery({
    queryKey: ['dashboard', period, refDate],
    queryFn: () => {
      const params = new URLSearchParams({ period });
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
