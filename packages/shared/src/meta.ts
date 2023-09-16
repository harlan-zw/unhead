import { packArray, unpackToArray, unpackToString } from 'packrup'
import type { TransformValueOptions } from 'packrup'
import type { BaseMeta, Head, MetaFlatInput } from '@unhead/schema'

interface PackingDefinition {
  metaKey?: keyof BaseMeta
  keyValue?: string
  unpack?: TransformValueOptions
}

const p = (p: string) => ({ keyValue: p, metaKey: 'property' }) as PackingDefinition
const k = (p: string) => ({ keyValue: p }) as PackingDefinition

const MetaPackingSchema: Record<string, PackingDefinition> = {
  appleItunesApp: {
    unpack: {
      entrySeparator: ', ',
      resolve({ key, value }) {
        return `${fixKeyCase(key)}=${value}`
      },
    },
  },
  articleExpirationTime: p('article:expiration_time'),
  articleModifiedTime: p('article:modified_time'),
  articlePublishedTime: p('article:published_time'),
  bookReleaseDate: p('book:release_date'),
  charset: {
    metaKey: 'charset',
  },
  contentSecurityPolicy: {
    unpack: {
      entrySeparator: '; ',
      resolve({ key, value }) {
        return `${fixKeyCase(key)} ${value}`
      },
    },
    metaKey: 'http-equiv',
  },
  contentType: {
    metaKey: 'http-equiv',
  },
  defaultStyle: {
    metaKey: 'http-equiv',
  },
  fbAppId: p('fb:app_id'),
  msapplicationConfig: k('msapplication-Config'),
  msapplicationTileColor: k('msapplication-TileColor'),
  msapplicationTileImage: k('msapplication-TileImage'),
  ogAudioSecureUrl: p('og:audio:secure_url'),
  ogAudioUrl: p('og:audio'),
  ogImageSecureUrl: p('og:image:secure_url'),
  ogImageUrl: p('og:image'),
  ogSiteName: p('og:site_name'),
  ogVideoSecureUrl: p('og:video:secure_url'),
  ogVideoUrl: p('og:video'),
  profileFirstName: p('profile:first_name'),
  profileLastName: p('profile:last_name'),
  profileUsername: p('profile:username'),
  refresh: {
    metaKey: 'http-equiv',
    unpack: {
      entrySeparator: ';',
      keyValueSeparator: '=',
      resolve({ key, value }) {
        if (key === 'seconds')
          return `${value}`
      },
    },
  },
  robots: {
    unpack: {
      entrySeparator: ', ',
      resolve({ key, value }) {
        if (typeof value === 'boolean')
          return `${fixKeyCase(key)}`
        else
          return `${fixKeyCase(key)}:${value}`
      },
    },
  },
  xUaCompatible: {
    metaKey: 'http-equiv',
  },
} as const

const openGraphNamespaces = [
  'og',
  'book',
  'article',
  'profile',
]

export function resolveMetaKeyType(key: string): keyof BaseMeta {
  const fKey = fixKeyCase(key).split(':')[0]
  if (openGraphNamespaces.includes(fKey))
    return 'property'
  return MetaPackingSchema[key]?.metaKey || 'name'
}

export function resolveMetaKeyValue(key: string): string {
  return MetaPackingSchema[key]?.keyValue || fixKeyCase(key)
}

function fixKeyCase(key: string) {
  const updated = key.replace(/([A-Z])/g, '-$1').toLowerCase()
  const fKey = updated.split('-')[0]
  if (openGraphNamespaces.includes(fKey) || fKey === 'twitter')
    return key.replace(/([A-Z])/g, ':$1').toLowerCase()
  return updated
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
function changeKeyCasingDeep<T extends any>(input: T): T {
  if (Array.isArray(input)) {
    // @ts-expect-error untyped
    return input.map(entry => changeKeyCasingDeep(entry))
  }
  if (typeof input !== 'object' || Array.isArray(input))
    return input

  const output: Record<string, any> = {}
  for (const [key, value] of Object.entries(input as object))
    output[fixKeyCase(key)] = changeKeyCasingDeep(value)

  return output as T
}

export function resolvePackedMetaObjectValue(value: string, key: string): string {
  const definition = MetaPackingSchema[key]

  // refresh is weird...
  if (key === 'refresh')
    // @ts-expect-error untyped
    return `${value.seconds};url=${value.url}`

  return unpackToString(
    changeKeyCasingDeep(value), {
      entrySeparator: ', ',
      resolve({ value, key }) {
        if (value === null)
          return ''
        if (typeof value === 'boolean')
          return `${key}`
      },
      ...definition?.unpack,
    },
  )
}

const ObjectArrayEntries = ['og:image', 'og:video', 'og:audio', 'twitter:image']

function sanitize(input: Record<string, any>) {
  const out: Record<string, any> = {}
  Object.entries(input).forEach(([k, v]) => {
    if (String(v) !== 'false' && k)
      out[k] = v
  })
  return out
}

function handleObjectEntry(key: string, v: Record<string, any>) {
  // filter out falsy values
  const value: Record<string, any> = sanitize(v)
  const fKey = fixKeyCase(key)
  const attr = resolveMetaKeyType(fKey)
  if (ObjectArrayEntries.includes(fKey as keyof MetaFlatInput)) {
    const input: MetaFlatInput = {}
    // we need to prefix the keys with og:
    Object.entries(value).forEach(([k, v]) => {
      // @ts-expect-error untyped
      input[`${key}${k === 'url' ? '' : `${k.charAt(0).toUpperCase()}${k.slice(1)}`}`] = v
    })
    const unpacked = unpackMeta(input)
      // sort by property name
      .sort((a, b) =>
        // @ts-expect-error untyped
        (a[attr]?.length || 0) - (b[attr]?.length || 0),
      ) as BaseMeta[]
    return unpacked
  }
  return [{ [attr]: fKey, ...value }] as BaseMeta[]
}

/**
 * Converts a flat meta object into an array of meta entries.
 * @param input
 */
export function unpackMeta<T extends MetaFlatInput>(input: T): Required<Head>['meta'] {
  const extras: BaseMeta[] = []
  // need to handle array input of the object
  const primitives: Record<string, any> = {}
  Object.entries(input).forEach(([key, value]) => {
    if (!Array.isArray(value)) {
      if (typeof value === 'object' && value) {
        if (ObjectArrayEntries.includes(fixKeyCase(key) as keyof MetaFlatInput)) {
          extras.push(...handleObjectEntry(key, value))
          return
        }
        primitives[key] = sanitize(value)
      }
      else {
        primitives[key] = value
      }
      return
    }
    value.forEach((v) => {
      extras.push(...(typeof v === 'string' ? unpackMeta({ [key]: v }) as BaseMeta[] : handleObjectEntry(key, v)))
    })
  })

  const meta = unpackToArray((primitives), {
    key({ key }) {
      return resolveMetaKeyType(key) as string
    },
    value({ key }) {
      return key === 'charset' ? 'charset' : 'content'
    },
    resolveKeyData({ key }) {
      return resolveMetaKeyValue(key)
    },
    resolveValueData({ value, key }) {
      if (value === null)
        return '_null'

      if (typeof value === 'object')
        return resolvePackedMetaObjectValue(value, key)

      return typeof value === 'number' ? value.toString() : value
    },
  }) as BaseMeta[]
  // remove keys with defined but empty content
  return [...extras, ...meta].map((m) => {
    if (m.content === '_null')
      m.content = null
    return m
  }) as unknown as Required<Head>['meta']
}

/**
 * Convert an array of meta entries to a flat object.
 * @param inputs
 */
export function packMeta<T extends Required<Head>['meta']>(inputs: T): MetaFlatInput {
  const mappedPackingSchema = Object.entries(MetaPackingSchema)
    .map(([key, value]) => [key, value.keyValue])

  return packArray(inputs, {
    key: ['name', 'property', 'httpEquiv', 'http-equiv', 'charset'],
    value: ['content', 'charset'],
    resolveKey(k) {
      let key = (mappedPackingSchema.filter(sk => sk[1] === k)?.[0]?.[0] || k) as string
      // turn : into a capital letter
      // @ts-expect-error untyped
      const replacer = (_, letter) => letter?.toUpperCase()
      key = key
        .replace(/:([a-z])/g, replacer)
        .replace(/-([a-z])/g, replacer)
      return key as string
    },
  })
}
