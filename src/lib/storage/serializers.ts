import type { Serializer } from './types';

export function mapSerializer<K, V>(): Serializer<Map<K, V>> {
  return {
    serialize: (map) => JSON.stringify([...map.entries()]),
    deserialize: (raw) => new Map<K, V>(JSON.parse(raw)),
  };
}

export function setSerializer<T>(): Serializer<Set<T>> {
  return {
    serialize: (set) => JSON.stringify([...set]),
    deserialize: (raw) => new Set<T>(JSON.parse(raw)),
  };
}
