/** Custom serializer for non-JSON-native types */
export interface Serializer<T> {
  serialize: (value: T) => string;
  deserialize: (raw: string) => T;
}

/**
 * Schema definition: each key maps to its value type and optional serializer.
 * If no serializer is provided, GM_setValue/GM_getValue handles natively.
 */
export type StoreSchemaDefinition<S extends object> = {
  [K in keyof S]: {
    default: S[K];
    serializer?: Serializer<S[K]>;
  };
};

/** The typed store returned by createStore */
export interface Store<S extends object> {
  get<K extends keyof S & string>(key: K): S[K];
  set<K extends keyof S & string>(key: K, value: S[K]): void;
  remove<K extends keyof S & string>(key: K): void;
}
