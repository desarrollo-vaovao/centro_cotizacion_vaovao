import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

function mapServiceLine(row) {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

export function useServiceLines() {
  return useQuery({
    queryKey: ['serviceLines'],
    queryFn: async () => (await api.get('/service-lines')).map(mapServiceLine)
  });
}

export function useCreateServiceLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/service-lines', payload).then(mapServiceLine),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['serviceLines'] })
  });
}

export function useUpdateServiceLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/service-lines/${id}`, payload).then(mapServiceLine),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['serviceLines'] })
  });
}

export function useDeleteServiceLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/service-lines/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['serviceLines'] })
  });
}
