import request from 'supertest';
import { createApp } from '../../src/app.js';

export function makeAgent() {
  return request.agent(createApp());
}
