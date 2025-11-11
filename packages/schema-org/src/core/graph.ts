import type { Arrayable, Id, MetaInput, ResolvedMeta, SchemaOrgNode, Thing } from '../types'
import { createDefu } from 'defu'
import { imageResolver } from '../nodes'
import { asArray, hashCode as hash, resolveAsGraphKey } from '../utils'
import { resolveMeta, resolveNode, resolveNodeId, resolveRelation } from './resolve'
import { normaliseNodes } from './util'

export interface SchemaOrgGraph {
  nodes: SchemaOrgNode[]
  meta: ResolvedMeta
  push: <T extends Arrayable<Thing>>(node: T) => void
  resolveGraph: (meta: MetaInput) => SchemaOrgNode[]
  find: <T extends Thing>(id: Id | string) => T | null
}

const baseRelationNodes = [
  'translationOfWork',
  'workTranslation',
] as const

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

const merge = createDefu((object, key, value) => {
  // dedupe merge arrays
  if (Array.isArray(object[key])) {
    if (Array.isArray(value)) {
      // unique set
      // make a record with hash'es as keys for [...object[key], ...value]
      const map = {} as Record<string, any>
      for (const item of [...object[key], ...value])
        map[hash(item)] = item
      // @ts-expect-error untyped
      object[key] = Object.values(map)
      if (key === 'itemListElement') {
        // @ts-expect-error untyped
        object[key] = [...uniqueBy(object[key], item => item.position)]
      }
      return true
    }
    object[key] = merge(object[key], Array.isArray(value) ? value : [value])
    return true
  }
})

export function createSchemaOrgGraph(): SchemaOrgGraph {
  const nodeIndex = new Map<Id, SchemaOrgNode>()
  const ctx: SchemaOrgGraph = {
    find<T extends Thing>(id: Id | string) {
      // if it starts with # we can assume we match any fragment
      // if it starts with / then we need to also match the path
      // if it starts with http we need to match the full url
      let resolver = (s: string) => s
      if (id[0] === '#') {
        // @ts-expect-error untyped
        resolver = resolveAsGraphKey
      }
      else if (id[0] === '/') {
        resolver = (s: string) => s
          .replace(/(https?:)?\/\//, '')
          .split('/')[0]
      }
      const key = resolver(id) as Id
      // For simple cases without complex resolvers, use O(1) Map lookup
      if (id[0] !== '#' && id[0] !== '/') {
        const node = nodeIndex.get(key)
        if (node)
          return node as unknown as T
      }
      // Fallback to O(n) array search for complex resolver cases
      return ctx.nodes
        .filter(n => !!n['@id'])
        .find(n => resolver(n['@id'] as Id) === key) as unknown as T | null
    },
    push(input: Arrayable<Thing>) {
      asArray(input).forEach((node) => {
        const registeredNode = node as SchemaOrgNode
        ctx.nodes.push(registeredNode)
        // Index nodes with @id for O(1) lookups
        if (registeredNode['@id'])
          nodeIndex.set(registeredNode['@id'] as Id, registeredNode)
      })
    },
    resolveGraph(meta: MetaInput) {
      ctx.meta = resolveMeta({ ...meta })

      // Pass 1: Resolve nodes and IDs
      ctx.nodes
        .forEach((node, key) => {
          const resolver = node._resolver
          node = resolveNode(node, ctx, resolver)
          node = resolveNodeId(node, ctx, resolver, true)
          ctx.nodes[key] = node
        })

      // Pass 2: Dedupe and process relations (combined to reduce iterations)
      // Inline dedupe logic to avoid separate iteration
      const dedupedNodes: Record<Id, SchemaOrgNode> = {}
      for (const node of ctx.nodes) {
        const nodeKey = resolveAsGraphKey(node['@id'] || hash(node)) as Id
        if (dedupedNodes[nodeKey] && node._dedupeStrategy !== 'replace')
          dedupedNodes[nodeKey] = merge(node, dedupedNodes[nodeKey]) as SchemaOrgNode
        else
          dedupedNodes[nodeKey] = node
      }

      // Update ctx.nodes with deduped array (required for resolveRelation lookups)
      ctx.nodes = Object.values(dedupedNodes)

      // Rebuild index and process relations in a single pass
      nodeIndex.clear()
      ctx.nodes.forEach((node) => {
        // Rebuild index after deduplication
        if (node['@id'])
          nodeIndex.set(node['@id'] as Id, node)

        // Process relations for each deduped node
        // handle images for all nodes
        if (node.image && typeof node.image === 'string') {
          node.image = resolveRelation(node.image, ctx, imageResolver, {
            root: true,
          })
        }
        baseRelationNodes.forEach((k) => {
          node[k] = resolveRelation(node[k], ctx)
        })
        if (node._resolver?.resolveRootNode)
          node._resolver.resolveRootNode(node, ctx)

        // node is resolved, no longer need resolver
        delete node._resolver
      })

      return normaliseNodes(ctx.nodes)
    },
    nodes: [],
    meta: {} as ResolvedMeta,
  }
  return ctx
}
