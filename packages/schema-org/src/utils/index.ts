import type {
  Arrayable,
  Id,
  Thing,
} from '../types'
import { hasProtocol, withBase } from 'ufo'

export function idReference<T extends Thing>(node: T | string) {
  return {
    '@id': typeof node !== 'string' ? node['@id'] : node,
  }
}

export function resolvableDateToDate(val: Date | string) {
  try {
    const date = val instanceof Date ? val : new Date(Date.parse(val))
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  // not too fussed if it can't be resolved, this is on the user to validate
  catch {}
  return typeof val === 'string' ? val : val.toString()
}

const IS_VALID_W3C_DATE = [
  /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/,
  /^\d{4}-[01]\d-[0-3]\d$/,
  /^\d{4}-[01]\d$/,
  /^\d{4}$/,
]
export function isValidW3CDate(d: string) {
  return IS_VALID_W3C_DATE.some(r => r.test(d))
}

export function resolvableDateToIso(val: Date | string | undefined) {
  if (!val)
    return val
  try {
    if (val instanceof Date)
      return val.toISOString()
    else if (isValidW3CDate(val))
      return val
    else
      return new Date(Date.parse(val)).toISOString()
  }
  // not too fussed if it can't be resolved, this is on the user to validate
  catch {}
  return typeof val === 'string' ? val : val.toString()
}

export const IdentityId = '#identity'

export function setIfEmpty<T extends Thing>(node: T, field: keyof T, value: any) {
  if (!node?.[field] && value)
    node[field] = value
}

export interface ResolverOptions {
  /**
   * Return single images as an object.
   */
  array?: boolean
  /**
   * Move added nodes to the root graph.
   */
  root?: boolean
  /**
   * Generates ids for nodes.
   */
  generateId?: boolean
  afterResolve?: (node: any) => void
}

export function asArray(input: any) {
  return Array.isArray(input) ? input : [input]
}

export function dedupeMerge<T extends Thing>(node: T, field: keyof T, value: any) {
  const data = new Set(asArray(node[field]))
  data.add(value)
  // @ts-expect-error untyped key
  node[field] = [...data].filter(Boolean)
}

export function prefixId(url: string, id: Id | string) {
  // already prefixed
  if (hasProtocol(id))
    return id as Id
  if (!id.includes('#'))
    id = `#${id}`
  return `${url || ''}${id}` as Id
}

export function trimLength(val: string | undefined, length: number) {
  if (!val)
    return val

  if (val.length > length) {
    const trimmedString = val.substring(0, length)
    return trimmedString.substring(0, Math.min(trimmedString.length, trimmedString.lastIndexOf(' ')))
  }
  return val
}

export function resolveDefaultType(node: Thing, defaultType: Arrayable<string>) {
  const val = node['@type']
  if (val === defaultType)
    return
  const types = new Set<string>([
    ...asArray(defaultType),
    ...asArray(val),
  ])
  node['@type'] = types.size === 1 ? val : [...types.values()]
}

export function resolveWithBase(base: string, urlOrPath: string) {
  // can't apply base if there's a protocol
  if (!urlOrPath || hasProtocol(urlOrPath) || ((urlOrPath[0] !== '/') && (urlOrPath[0] !== '#')))
    return urlOrPath
  return withBase(urlOrPath, base)
}

export function resolveAsGraphKey(key?: Id | string) {
  if (!key)
    return key
  return key.substring(key.lastIndexOf('#')) as Id
}

/**
 * Removes attributes which have a null or undefined value
 */
export function stripEmptyProperties(obj: any) {
  for (const k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) {
      continue
    }

    if (obj[k] && typeof obj[k] === 'object') {
      // avoid walking vue reactivity
      if (obj[k].__v_isReadonly || obj[k].__v_isRef)
        continue
      stripEmptyProperties(obj[k])
      continue
    }
    if (obj[k] === '' || obj[k] === null || obj[k] === undefined)
      delete obj[k]
  }

  return obj
}

export function hashCode(s: string) {
  let h = 9
  for (let i = 0; i < s.length;)
    h = Math.imul(h ^ s.charCodeAt(i++), 9 ** 9)
  return ((h ^ h >>> 9) + 0x10000)
    .toString(16)
    .substring(1, 8)
    .toLowerCase()
}
