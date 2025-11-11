import type { SchemaOrgGraph } from './core/graph'
import type { MetaInput, ResolvedMeta } from './types'
import { defineHeadPlugin, TemplateParamsPlugin } from 'unhead/plugins'
import { processTemplateParams } from 'unhead/utils'
import {
  createSchemaOrgGraph,
} from './core/graph'
import { resolveMeta } from './core/resolve'
import { loadResolver } from './resolver'

export interface PluginSchemaOrgOptions {
  minify?: boolean
  trailingSlash?: boolean
}

/**
 * Simple object merge that doesn't override existing properties
 */
function simpleMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target }
  for (const key in source) {
    if (!(key in result)) {
      result[key] = source[key]
    }
  }
  return result
}

export function UnheadSchemaOrg(options?: PluginSchemaOrgOptions) {
  return SchemaOrgUnheadPlugin({} as MetaInput, () => ({}), options)
}

/**
 * @deprecated Providing a plugin is no longer required. You can remove this code.
 */
export function PluginSchemaOrg(options?: PluginSchemaOrgOptions & { resolveMeta?: () => Record<string, any> }) {
  const fallback = () => ({} as Partial<MetaInput>)
  return SchemaOrgUnheadPlugin({} as MetaInput, options?.resolveMeta || fallback, options)
}

/**
 * @deprecated Providing a plugin is no longer required. You can remove this code.
 */
export function SchemaOrgUnheadPlugin(config: MetaInput, meta: () => Partial<MetaInput> | Promise<Partial<MetaInput>>, options?: PluginSchemaOrgOptions) {
  config = resolveMeta({ ...config })
  let graph: SchemaOrgGraph
  let resolvedMeta = {} as ResolvedMeta
  return defineHeadPlugin((head) => {
    head.use(TemplateParamsPlugin)
    return {
      key: 'schema-org',
      hooks: {
        'entries:normalize': async ({ tags }) => {
          graph = graph || createSchemaOrgGraph()
          for (const tag of tags) {
            if (tag.tag === 'script' && tag.props.type === 'application/ld+json' && tag.props.nodes) {
              // this is a bit expensive, load in seperate chunk
              const nodes = await tag.props.nodes
              for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
                // malformed input
                if (typeof node !== 'object' || Object.keys(node).length === 0) {
                  continue
                }
                const newNode = {
                  ...node,
                  _dedupeStrategy: tag.tagDuplicateStrategy,
                  _resolver: loadResolver(await node._resolver),
                }
                graph.push(newNode)
              }
              tag.tagPosition = tag.tagPosition || config.tagPosition === 'head' ? 'head' : 'bodyClose'
            }
            if (tag.tag === 'htmlAttrs' && tag.props.lang) {
              resolvedMeta.inLanguage = tag.props.lang
            }
            else if (tag.tag === 'title') {
              resolvedMeta.title = tag.textContent
            }
            else if (tag.tag === 'meta' && tag.props.name === 'description') {
              resolvedMeta.description = tag.props.content
            }
            else if (tag.tag === 'link' && tag.props.rel === 'canonical') {
              resolvedMeta.url = tag.props.href
              // may be using template params that aren't resolved
              if (resolvedMeta.url && !resolvedMeta.host) {
                try {
                  resolvedMeta.host = new URL(resolvedMeta.url).origin
                }
                catch {
                }
              }
            }
            else if (tag.tag === 'meta' && tag.props.property === 'og:image') {
              resolvedMeta.image = tag.props.content
            }
            // use template params
            else if (tag.tag === 'templateParams' && tag.props.schemaOrg) {
              resolvedMeta = {
                ...resolvedMeta,
                // @ts-expect-error untyped
                ...tag.props.schemaOrg,
              }
              delete tag.props.schemaOrg
            }
          }
        },
        'tags:resolve': async (ctx) => {
          // find the schema.org node, should be a single instance
          for (const k in ctx.tags) {
            const tag = ctx.tags[k]
            if (tag.tag === 'script' && tag.props.type === 'application/ld+json' && tag.props.nodes) {
              delete tag.props.nodes
              const resolvedGraph = graph.resolveGraph({ ...(await meta?.() || {}), ...config, ...resolvedMeta })
              if (!resolvedGraph.length) {
                // removes the tag
                tag.props = {}
                return
              }
              // eslint-disable-next-line node/prefer-global/process
              const minify = options?.minify || process.env.NODE_ENV === 'production'
              tag.innerHTML = JSON.stringify({
                '@context': 'https://schema.org',
                '@graph': resolvedGraph,
              }, (_, value) => {
                // process template params here
                if (typeof value !== 'object')
                  return processTemplateParams(value, head._templateParams!, head._separator!)
                return value
              }, minify ? 0 : 2)
              return
            }
          }
        },
        'tags:afterResolve': (ctx) => {
          let firstNodeKey: number | undefined
          for (const k in ctx.tags) {
            const tag = ctx.tags[k]
            if ((tag.props.type === 'application/ld+json' && tag.props.nodes) || tag.key === 'schema-org-graph') {
              delete tag.props.nodes
              if (typeof firstNodeKey === 'undefined') {
                firstNodeKey = k as any
                continue
              }
              // merge props on to first node and delete
              ctx.tags[firstNodeKey].props = simpleMerge(ctx.tags[firstNodeKey].props, tag.props)
              delete ctx.tags[firstNodeKey].props.nodes
              // @ts-expect-error untyped
              ctx.tags[k] = false
            }
          }
          // there many be multiple script nodes within the same entry
          ctx.tags = ctx.tags.filter(Boolean)
        },
      },
    }
  })
}
