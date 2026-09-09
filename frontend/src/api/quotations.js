import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/apiClient.js';

export function mapQuotation(row) {
  return {
    id: row.id,
    correlativoGeneral: row.correlativo_general,
    correlativoCliente: row.correlativo_cliente,
    fecha: row.fecha,
    validezDias: row.validez_dias,
    clientId: row.client_id,
    clienteNombreLibre: row.cliente_nombre_libre,
    pais: row.pais,
    lineaServicio: row.linea_servicio,
    executiveId: row.executive_id,
    proyecto: row.proyecto,
    descripcion: row.descripcion,
    detalle: row.detalle,
    monto: Number(row.monto),
    impuestos: Number(row.impuestos),
    moneda: row.moneda,
    estatus: row.estatus,
    fechaAprobacion: row.fecha_aprobacion,
    fechaCierreProyecto: row.fecha_cierre_proyecto,
    observaciones: row.observaciones,
    version: row.version,
    previousVersionId: row.previous_version_id,
    supersededBy: row.superseded_by,
    rootId: row.root_id
  };
}

function toQueryString(filters = {}) {
  const params = new URLSearchParams();
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.executiveId) params.set('executiveId', filters.executiveId);
  if (filters.estatus) params.set('estatus', filters.estatus);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useQuotations(filters = {}) {
  return useQuery({
    queryKey: ['quotations', filters],
    queryFn: async () => (await api.get(`/quotations${toQueryString(filters)}`)).map(mapQuotation)
  });
}

export function useQuotation(id) {
  const { data: quotations, ...rest } = useQuotations();
  return { ...rest, data: quotations ? quotations.find((q) => String(q.id) === String(id)) : undefined };
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/quotations', payload).then(mapQuotation),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations'] })
  });
}

export function useUpdateQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/quotations/${id}`, payload).then(mapQuotation),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations'] })
  });
}

export function useAdjustQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => api.post(`/quotations/${id}/adjust`, payload).then(mapQuotation),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations'] })
  });
}
