import { createStore, mapSerializer } from '@lib/storage';

export type ExportMode = 'single' | 'merged';

interface HusqvarnaStorageSchema {
  mode: ExportMode;
  orderNameOverrides: Map<string, string>;
}

export const store = createStore<HusqvarnaStorageSchema>('husqvarna', {
  mode: {
    default: 'single' as ExportMode,
  },
  orderNameOverrides: {
    default: new Map<string, string>(),
    serializer: mapSerializer<string, string>(),
  },
});
