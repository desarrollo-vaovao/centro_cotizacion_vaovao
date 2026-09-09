import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

export function useDashboard(period) {
  return useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => api.get(`/dashboard?period=${period}`)
  });
}

export function useClientDashboard(clientId, period) {
  return useQuery({
    queryKey: ['dashboard', 'cliente', clientId, period],
    queryFn: () => api.get(`/dashboard/cliente/${clientId}?period=${period}`),
    enabled: Boolean(clientId)
  });
}
