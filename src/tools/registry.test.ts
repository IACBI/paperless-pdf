import { describe, expect, it } from 'vitest';
import { TOOLS, getTool } from './registry';

describe('tool registry', () => {
  it('exposes the seven MVP tools', () => {
    expect(TOOLS).toHaveLength(7);
  });

  it('has unique ids and paths', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((t) => t.path)).size).toBe(TOOLS.length);
  });

  it('resolves a tool by its path', () => {
    expect(getTool('merge')?.title).toBe('Merge PDFs');
    expect(getTool('does-not-exist')).toBeUndefined();
  });
});
