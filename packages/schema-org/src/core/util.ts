import type { Id, SchemaOrgNode } from '../types'
import { hashCode as hash, resolveAsGraphKey } from '../utils'

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

function merge(target: any, source: any): any {
  if (!source || typeof source !== 'object')
    return target

  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key))
      continue

    const sourceValue = source[key]
    const targetValue = target[key]

    // Handle array merging with deduplication
    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      // unique set using hash
      const map = {} as Record<string, any>
      for (const item of [...targetValue, ...sourceValue])
        map[hash(item)] = item
      target[key] = Object.values(map)

      // Special handling for itemListElement
      if (key === 'itemListElement')
        target[key] = [...uniqueBy(target[key], item => item.position)]
    }
    else if (Array.isArray(targetValue)) {
      target[key] = merge(targetValue, Array.isArray(sourceValue) ? sourceValue : [sourceValue])
    }
    else if (targetValue && typeof targetValue === 'object' && sourceValue && typeof sourceValue === 'object') {
      // Recursively merge objects
      target[key] = merge(targetValue, sourceValue)
    }
    else if (sourceValue !== undefined) {
      // Source value takes precedence
      target[key] = sourceValue
    }
  }

  return target
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
