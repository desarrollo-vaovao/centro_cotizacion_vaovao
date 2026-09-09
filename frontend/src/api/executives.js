import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

export function useExecutives() {
  return useQuery({ queryKey: ['executives'], queryFn: () => api.get('/executives') });
}

export function useCreateExecutive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/executives', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executives'] })
  });
}
