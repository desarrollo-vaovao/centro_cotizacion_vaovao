import { describe, it, expect } from 'vitest';
import { buildGeneralCorrelativo, buildClientCorrelativo, withVersionSuffix } from '../src/utils/correlativo.js';

describe('correlativo', () => {
  it('builds the general correlativo padded to 3 digits', () => {
    expect(buildGeneralCorrelativo(2026, 1)).toBe('PC-2026-001');
    expect(buildGeneralCorrelativo(2026, 42)).toBe('PC-2026-042');
  });

  it('builds the client correlativo from its code', () => {
    expect(buildClientCorrelativo('C807', 2)).toBe('PC-C807-002');
  });

  it('leaves version 1 untouched', () => {
    expect(withVersionSuffix('PC-2026-001', 1)).toBe('PC-2026-001');
  });

  it('appends a version suffix from version 2 onward', () => {
    expect(withVersionSuffix('PC-2026-001', 2)).toBe('PC-2026-001 v2');
  });

  it('replaces an existing version suffix instead of stacking it', () => {
    expect(withVersionSuffix('PC-2026-001 v2', 3)).toBe('PC-2026-001 v3');
  });
});
