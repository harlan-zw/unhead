import type { TransformValueOptions } from 'packrup'

export type ValidMetaType = 'name' | 'http-equiv' | 'property' | 'charset'

export interface PackingDefinition {
  metaKey?: ValidMetaType
  keyValue?: string
  unpack?: TransformValueOptions
}

export const MetaPackingSchema: Record<string, PackingDefinition> = {
  robots: {
    unpack: {
      keyValueSeparator: ':',
    },
  },
  // Pragma directives
  contentSecurityPolicy: {
    unpack: {
      keyValueSeparator: ' ',
      entrySeparator: '; ',
    },
    metaKey: 'http-equiv',
  },
  fbAppId: {
    keyValue: 'fb:app_id',
    metaKey: 'property',
  },
  ogSiteName: {
    keyValue: 'og:site_name'
  },
  msapplicationTileImage: {
    keyValue: 'msapplication-TileImage',
  },
  /**
   * Tile colour for windows
   */
  msapplicationTileColor: {
    keyValue: 'msapplication-TileColor',
  },
  /**
   * URL of a config for windows tile.
   */
  msapplicationConfig: {
    keyValue: 'msapplication-Config',
  },
  charset: {
    metaKey: 'charset',
  },
  contentType: {
    metaKey: 'http-equiv',
  },
  defaultStyle: {
    metaKey: 'http-equiv',
  },
  xUaCompatible: {
    metaKey: 'http-equiv',
  },
  refresh: {
    metaKey: 'http-equiv',
  },
}
