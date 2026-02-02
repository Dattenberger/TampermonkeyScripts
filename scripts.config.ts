export interface ScriptConfig {
  entry: string;
  outputFileName: string;
  userscript: {
    name: string;
    namespace: string;
    version: string;
    description: string;
    author: string;
    match: string[];
    grant: string[];
    connect?: string[];
    icon?: string;
    updateURL?: string;
    downloadURL?: string;
  };
  externalGlobals?: Record<string, string | [string, (version: string) => string]>;
  externalResource?: Record<string, string>;
}

export const scripts: Record<string, ScriptConfig> = {
  'husqvarna-skripte': {
    entry: 'src/scripts/husqvarna-skripte/main.ts',
    outputFileName: 'husqvarna-skripte.user.js',
    userscript: {
      name: 'Husqvarna Skripte',
      namespace: 'https://github.com/Dattenberger/TampermonkeyScripts',
      version: '3.0.0',
      description: 'Husqvarna Portal Tools – Bestellexport via GraphQL mit Multi-Order-Support und Live-Status',
      author: 'Lukas Dattenberger',
      match: ['https://portal.husqvarnagroup.com/de/orders/*'],
      grant: ['GM_addStyle', 'GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', 'GM_deleteValue'],
      connect: ['portal.husqvarnagroup.com'],
      updateURL: 'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/dist/husqvarna-skripte.user.js',
      downloadURL: 'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/dist/husqvarna-skripte.user.js',
    },
    externalGlobals: {
      'jquery': 'jQuery',
    },
  },
};
