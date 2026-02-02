import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../create-store';
import { mapSerializer } from '../serializers';

describe('createStore', () => {
  it('returns defaults when no value stored', () => {
    const store = createStore<{ name: string }>('test', {
      name: { default: 'hello' },
    });
    expect(store.get('name')).toBe('hello');
  });

  it('round-trips string values', () => {
    const store = createStore<{ mode: string }>('test', {
      mode: { default: 'single' },
    });
    store.set('mode', 'merged');
    expect(store.get('mode')).toBe('merged');
  });

  it('round-trips number values', () => {
    const store = createStore<{ count: number }>('test', {
      count: { default: 0 },
    });
    store.set('count', 42);
    expect(store.get('count')).toBe(42);
  });

  it('round-trips boolean values', () => {
    const store = createStore<{ enabled: boolean }>('test', {
      enabled: { default: false },
    });
    store.set('enabled', true);
    expect(store.get('enabled')).toBe(true);
  });

  it('round-trips Map via serializer', () => {
    const store = createStore<{ data: Map<string, string> }>('test', {
      data: { default: new Map(), serializer: mapSerializer<string, string>() },
    });
    const map = new Map([['order1', 'Custom Name']]);
    store.set('data', map);
    const result = store.get('data');
    expect(result).toBeInstanceOf(Map);
    expect(result.get('order1')).toBe('Custom Name');
  });

  it('isolates stores with different prefixes', () => {
    const store1 = createStore<{ val: string }>('prefix1', {
      val: { default: 'a' },
    });
    const store2 = createStore<{ val: string }>('prefix2', {
      val: { default: 'b' },
    });
    store1.set('val', 'x');
    expect(store2.get('val')).toBe('b');
  });

  it('remove() resets to default', () => {
    const store = createStore<{ mode: string }>('test', {
      mode: { default: 'single' },
    });
    store.set('mode', 'merged');
    store.remove('mode');
    expect(store.get('mode')).toBe('single');
  });

  it('calls serializer methods correctly', () => {
    const serialize = vi.fn(() => '[]');
    const deserialize = vi.fn(() => new Map<string, string>());
    const store = createStore<{ data: Map<string, string> }>('test', {
      data: { default: new Map(), serializer: { serialize, deserialize } },
    });
    const map = new Map([['a', 'b']]);
    store.set('data', map);
    expect(serialize).toHaveBeenCalledWith(map);
    store.get('data');
    expect(deserialize).toHaveBeenCalledWith('[]');
  });
});
