import { describe, it, expect } from 'vitest';
import { mapSerializer, setSerializer } from '../serializers';

describe('mapSerializer', () => {
  const serializer = mapSerializer<string, string>();

  it('round-trips an empty Map', () => {
    const map = new Map<string, string>();
    const result = serializer.deserialize(serializer.serialize(map));
    expect(result).toEqual(map);
    expect(result).toBeInstanceOf(Map);
  });

  it('round-trips a populated Map', () => {
    const map = new Map([['a', '1'], ['b', '2'], ['key with spaces', 'val']]);
    const result = serializer.deserialize(serializer.serialize(map));
    expect(result).toEqual(map);
  });

  it('serializes to valid JSON', () => {
    const map = new Map([['x', 'y']]);
    const json = serializer.serialize(map);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('setSerializer', () => {
  const serializer = setSerializer<number>();

  it('round-trips an empty Set', () => {
    const set = new Set<number>();
    const result = serializer.deserialize(serializer.serialize(set));
    expect(result).toEqual(set);
    expect(result).toBeInstanceOf(Set);
  });

  it('round-trips a populated Set', () => {
    const set = new Set([1, 2, 3]);
    const result = serializer.deserialize(serializer.serialize(set));
    expect(result).toEqual(set);
  });
});
