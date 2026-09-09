import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

function mapLogos(row) {
  return { logoAgencia: row.logo_agencia, logoVelarc: row.logo_velarc };
}

export function useLogos() {
  return useQuery({ queryKey: ['logos'], queryFn: async () => mapLogos(await api.get('/settings/logos')) });
}

export function useSaveLogos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.put('/settings/logos', payload).then(mapLogos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logos'] })
  });
}

export function useDeleteLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key) => api.delete(`/settings/logos/${key}`).then(mapLogos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logos'] })
  });
}
