import type { Arrayable, Id, MetaInput, ResolvedMeta, SchemaOrgNode, Thing } from '../types'
import { imageResolver } from '../nodes'
import { asArray, resolveAsGraphKey } from '../utils'
import { resolveMeta, resolveNode, resolveNodeId, resolveRelation } from './resolve'
import { dedupeNodes, normaliseNodes } from './util'

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
      ctx.nodes
        .forEach((node, key) => {
          const resolver = node._resolver
          node = resolveNode(node, ctx, resolver)
          node = resolveNodeId(node, ctx, resolver, true)
          ctx.nodes[key] = node
        })
      ctx.nodes = dedupeNodes(ctx.nodes)

      // Rebuild index after deduplication and ID resolution
      nodeIndex.clear()
      ctx.nodes.forEach((node) => {
        if (node['@id'])
          nodeIndex.set(node['@id'] as Id, node)
      })

      ctx.nodes
        .forEach((node) => {
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
