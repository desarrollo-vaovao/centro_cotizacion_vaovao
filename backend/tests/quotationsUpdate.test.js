import { describe, it, expect, beforeEach } from 'vitest';
import { makeAgent, resetDb, seedTestUser, loginAgent } from './helpers/index.js';

async function createQuotation(agent, csrfToken) {
  const client = (await agent.post('/clients').set('X-CSRF-Token', csrfToken).send({ name: 'C807', country: 'Guatemala', code: 'C807' })).body;
  const exec = (await agent.post('/executives').set('X-CSRF-Token', csrfToken).send({ name: 'Marco' })).body;
  const res = await agent.post('/quotations').set('X-CSRF-Token', csrfToken).send({
    clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id,
    proyecto: 'Contenidos', detalle: ['Edición'], monto: 3100, impuestos: 372
  });
  return { client, exec, quotation: res.body };
}

describe('quotations update/adjust', () => {
  let agent, csrfToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestUser();
    agent = makeAgent();
    csrfToken = await loginAgent(agent);
  });

  it('auto-sets fecha_aprobacion when approving without an explicit date', async () => {
    const { quotation } = await createQuotation(agent, csrfToken);
    const res = await agent.patch(`/quotations/${quotation.id}`).set('X-CSRF-Token', csrfToken).send({ estatus: 'Aprobada' });
    expect(res.body.fecha_aprobacion).toBeTruthy();
  });

  it('rejects edits to a superseded quotation', async () => {
    const { quotation, client, exec } = await createQuotation(agent, csrfToken);
    await agent.post(`/quotations/${quotation.id}/adjust`).set('X-CSRF-Token', csrfToken).send({
      clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id,
      proyecto: 'Contenidos ajustados', detalle: ['Edición'], monto: 3200, impuestos: 384
    });
    const res = await agent.patch(`/quotations/${quotation.id}`).set('X-CSRF-Token', csrfToken).send({ estatus: 'Aprobada' });
    expect(res.status).toBe(409);
  });

  it('rejects PATCH estatus set directly to Sustituida on a normal quotation', async () => {
    const { quotation } = await createQuotation(agent, csrfToken);
    const res = await agent.patch(`/quotations/${quotation.id}`).set('X-CSRF-Token', csrfToken).send({ estatus: 'Sustituida' });
    expect(res.status).toBe(400);
  });

  it('does not 500 when fechaCierreProyecto is an empty string', async () => {
    const { quotation } = await createQuotation(agent, csrfToken);
    const res = await agent.patch(`/quotations/${quotation.id}`).set('X-CSRF-Token', csrfToken).send({ fechaCierreProyecto: '' });
    expect(res.status).toBe(200);
    expect(res.body.fecha_cierre_proyecto).toBeFalsy();
  });

  it('leaves fechaCierreProyecto unchanged when the key is omitted from the PATCH body', async () => {
    const { quotation } = await createQuotation(agent, csrfToken);
    const setRes = await agent.patch(`/quotations/${quotation.id}`).set('X-CSRF-Token', csrfToken).send({ fechaCierreProyecto: '2026-12-31' });
    expect(setRes.status).toBe(200);
    expect(setRes.body.fecha_cierre_proyecto).toBeTruthy();

    const res = await agent.patch(`/quotations/${quotation.id}`).set('X-CSRF-Token', csrfToken).send({ observaciones: 'sin cambios en fecha' });
    expect(res.status).toBe(200);
    expect(res.body.fecha_cierre_proyecto).toBeTruthy();
  });

  it('creates a new version and marks the original as sustituida', async () => {
    const { quotation, client, exec } = await createQuotation(agent, csrfToken);
    const res = await agent.post(`/quotations/${quotation.id}/adjust`).set('X-CSRF-Token', csrfToken).send({
      clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id,
      proyecto: 'Contenidos ajustados', detalle: ['Edición', 'Dron'], monto: 3900, impuestos: 468
    });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);
    expect(res.body.correlativo_general).toBe(`${quotation.correlativo_general} v2`);
    expect(res.body.previous_version_id).toBe(quotation.id);
    expect(res.body.root_id).toBe(quotation.id);

    const list = await agent.get('/quotations').query({ clientId: client.id });
    const originalRow = list.body.find((q) => q.id === quotation.id);
    expect(originalRow.estatus).toBe('Sustituida');
    expect(originalRow.superseded_by).toBe(res.body.id);
  });

  it('rejects adjusting a quotation that has already been superseded', async () => {
    const { quotation, client, exec } = await createQuotation(agent, csrfToken);
    const firstAdjust = await agent.post(`/quotations/${quotation.id}/adjust`).set('X-CSRF-Token', csrfToken).send({
      clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id,
      proyecto: 'Contenidos ajustados', detalle: ['Edición', 'Dron'], monto: 3900, impuestos: 468
    });
    expect(firstAdjust.status).toBe(201);

    const secondAdjust = await agent.post(`/quotations/${quotation.id}/adjust`).set('X-CSRF-Token', csrfToken).send({
      clientId: client.id, pais: 'Guatemala', lineaServicio: 'Video', executiveId: exec.id,
      proyecto: 'Otro ajuste', detalle: ['Edición'], monto: 4200, impuestos: 504
    });
    expect(secondAdjust.status).toBe(409);
  });
});
