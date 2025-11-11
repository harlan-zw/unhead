import type { Id, SchemaOrgNode } from '../types'
import { hashCode as hash } from '../utils'
import { resolveAsGraphKey } from '../utils'

function groupBy<T>(array: T[], predicate: (value: T, index: number, array: T[]) => string) {
  return array.reduce((acc, value, index, array) => {
    const key = predicate(value, index, array)
    if (!acc[key])
      acc[key] = []
    acc[key].push(value)
    return acc
  }, {} as { [key: string]: T[] })
}

function uniqueBy<T>(array: T[], predicate: (value: T, index: number, array: T[]) => string) {
  // get last item
  return Object.values(groupBy(array, predicate)).map(a => a[a.length - 1])
}

/**
 * Custom merge function with array deduplication logic
 * Merges source into target, with target taking precedence for non-array values
 */
function merge(target: any, source: any): any {
  // Handle primitives
  if (typeof target !== 'object' || target === null) {
    return target
  }
  if (typeof source !== 'object' || source === null) {
    return target
  }

  // Handle arrays - target array takes precedence but we don't merge arrays at top level
  if (Array.isArray(target)) {
    return target
  }

  // Merge objects
  const result = { ...target }

  for (const key in source) {
    if (!(key in result)) {
      // Key doesn't exist in target, copy from source
      result[key] = source[key]
    }
    else if (Array.isArray(result[key]) && Array.isArray(source[key])) {
      // Both are arrays - dedupe merge
      const map = {} as Record<string, any>
      for (const item of [...result[key], ...source[key]]) {
        map[hash(item)] = item
      }
      // @ts-expect-error untyped
      result[key] = Object.values(map)

      // Special handling for itemListElement
      if (key === 'itemListElement') {
        // @ts-expect-error untyped
        result[key] = [...uniqueBy(result[key], item => item.position)]
      }
    }
    else if (Array.isArray(result[key]) && !Array.isArray(source[key])) {
      // Target is array, source is not - merge recursively
      result[key] = merge(result[key], [source[key]])
    }
    else if (typeof result[key] === 'object' && result[key] !== null && typeof source[key] === 'object' && source[key] !== null && !Array.isArray(result[key]) && !Array.isArray(source[key])) {
      // Both are objects - merge recursively
      result[key] = merge(result[key], source[key])
    }
    // else: target value takes precedence
  }

  return result
}

/**
 * Dedupe, flatten and a collection of nodes. Will also sort node keys and remove meta keys.
 * @param nodes
 */
export function dedupeNodes(nodes: SchemaOrgNode[]) {
  // assign based on id to dedupe across context
  const dedupedNodes: Record<Id, SchemaOrgNode> = {}
  for (const key of nodes.keys()) {
    const n = nodes[key]
    const nodeKey = resolveAsGraphKey(n['@id'] || hash(n)) as Id
    if (dedupedNodes[nodeKey] && n._dedupeStrategy !== 'replace')
      dedupedNodes[nodeKey] = merge(nodes[key], dedupedNodes[nodeKey]) as SchemaOrgNode
    else
      dedupedNodes[nodeKey] = nodes[key]
  }
  return Object.values(dedupedNodes)
}

export function normaliseNodes(nodes: SchemaOrgNode[]) {
  const sortedNodeKeys = nodes.keys()

  // assign based on id to dedupe across context
  const dedupedNodes: Record<Id, SchemaOrgNode> = {}
  for (const key of sortedNodeKeys) {
    const n = nodes[key]
    const nodeKey = resolveAsGraphKey(n['@id'] || hash(n)) as Id
    const groupedKeys = groupBy(Object.keys(n), (key) => {
      const val = n[key]
      if (key[0] === '_')
        return 'ignored'
      if (Array.isArray(val) || typeof val === 'object')
        return 'relations'
      return 'primitives'
    })

    const keys = [
      ...(groupedKeys.primitives || []).sort(),
      ...(groupedKeys.relations || []).sort(),
    ]
    let newNode = {} as SchemaOrgNode
    for (const key of keys)
      newNode[key] = n[key]
    if (dedupedNodes[nodeKey])
      newNode = merge(newNode, dedupedNodes[nodeKey]) as SchemaOrgNode
    dedupedNodes[nodeKey] = newNode
  }
  return Object.values(dedupedNodes)
}
