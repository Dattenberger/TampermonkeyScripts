import type { Store, StoreSchemaDefinition } from './types';

const UNSET = '__GM_STORE_UNSET__';

export function createStore<S extends object>(
  prefix: string,
  schema: StoreSchemaDefinition<S>,
): Store<S> {
  const prefixedKey = (key: string) => `${prefix}.${key}`;

  return {
    get<K extends keyof S & string>(key: K): S[K] {
      const def = schema[key];
      const raw: unknown = GM_getValue(prefixedKey(key), UNSET);
      if (raw === UNSET) return def.default;
      if (def.serializer) return def.serializer.deserialize(raw as string);
      return raw as S[K];
    },

    set<K extends keyof S & string>(key: K, value: S[K]): void {
      const def = schema[key];
      if (def.serializer) {
        GM_setValue(prefixedKey(key), def.serializer.serialize(value));
      } else {
        GM_setValue(prefixedKey(key), value);
      }
    },

    remove<K extends keyof S & string>(key: K): void {
      GM_deleteValue(prefixedKey(key));
    },
  };
}
