import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

function mapClient(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    country: row.country,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    seq: row.seq
  };
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => (await api.get('/clients')).map(mapClient)
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/clients', payload).then(mapClient),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/clients/${id}`, payload).then(mapClient),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  });
}
