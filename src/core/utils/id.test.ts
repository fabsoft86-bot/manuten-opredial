import { describe, expect, it } from 'vitest';

import { generateId } from './id';

describe('generateId', () => {
  it('gera um UUID quando crypto.randomUUID existe', () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('não repete identificadores', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
