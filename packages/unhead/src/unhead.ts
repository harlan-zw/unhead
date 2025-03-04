import type {
  ActiveHeadEntry,
  CreateHeadOptions,
  HeadEntry,
  HeadEntryOptions,
  HeadHooks,
  HeadPlugin,
  HeadPluginInput,
  HeadTag,
  ResolvableHead,
  Unhead,
} from './types'
import { createHooks } from 'hookable'
import { isMetaArrayDupeKey, sortTags, tagWeight, UsesMergeStrategy, ValidHeadTags } from './utils'
import { dedupeKey } from './utils/dedupe'
import { normalizeEntryToTags } from './utils/normalize'

function registerPlugin(head: Unhead<any>, p: HeadPluginInput) {
  const plugin = (typeof p === 'function' ? p(head) : p)
  // key is required in types but we avoid breaking changes
  const key = plugin.key || String(head.plugins.size + 1)
  const exists = head.plugins.get(key)
  if (!exists) {
    head.plugins.set(key, plugin)
    head.hooks.addHooks(plugin.hooks || {})
  }
}

/**
 * @deprecated use `createUnhead` instead
 */
export function createHeadCore<T = ResolvableHead>(resolvedOptions: CreateHeadOptions = {}) {
  return createUnhead<T>(resolvedOptions)
}

/**
 * Creates a core instance of unhead. Does not provide a global ctx for composables to work
 * and does not register DOM plugins.
 */
export function createUnhead<T = ResolvableHead>(resolvedOptions: CreateHeadOptions = {}) {
  // counter for keeping unique ids of head object entries
  const hooks = createHooks<HeadHooks>()
  hooks.addHooks(resolvedOptions.hooks || {})
  const ssr = !resolvedOptions.document

  const entries: Map<number, HeadEntry<T>> = new Map()
  const plugins: Map<string, HeadPlugin> = new Map()
  const normalizeQueue: number[] = []
  const head: Unhead<T> = {
    _entryCount: 1, // 0 is reserved for internal use
    plugins,
    dirty: false,
    resolvedOptions,
    hooks,
    ssr,
    entries,
    headEntries() {
      return [...entries.values()]
    },
    use: (p: HeadPluginInput) => registerPlugin(head, p),
    push(input: T, _options?: HeadEntryOptions | undefined) {
      const options = { ..._options || {} } as HeadEntryOptions
      delete options.head
      const _i = options._index ?? head._entryCount++
      const inst = { _i, input, options }
      const _: ActiveHeadEntry<T> = {
        _poll(rm = false) {
          head.dirty = true
          !rm && normalizeQueue.push(_i)
          hooks.callHook('entries:updated', head)
        },
        dispose() {
          if (entries.delete(_i)) {
            _._poll(true)
          }
          _._h?.()
        },
        // a patch is the same as creating a new entry, just a nice DX
        patch(input, force = false) {
          if (!options.mode || (options.mode === 'server' && ssr) || (options.mode === 'client' && !ssr)) {
            if (!ssr && !force && !head._dom) {
              // dom has not been rendered we need to queue the patch so that removals will work
              _._h?.()
              _._h = head.hooks.hookOnce('dom:rendered', () => _.patch(input, true))
              return
            }
            inst.input = input
            entries.set(_i, inst)
            _._poll()
          }
        },
      }
      _.patch(input, true)
      return _
    },
    async resolveTags() {
      const ctx: { tagMap: Map<string, HeadTag>, tags: HeadTag[], entries: HeadEntry<T>[] } = {
        tagMap: new Map(),
        tags: [],
        entries: [...head.entries.values()],
      }
      await hooks.callHook('entries:resolve', ctx)
      while (normalizeQueue.length) {
        const i = normalizeQueue.shift()!
        const e = entries.get(i)
        if (e) {
          const normalizeCtx = {
            tags: normalizeEntryToTags(e.input, resolvedOptions.propResolvers || [])
              .map(t => Object.assign(t, e.options)),
            entry: e,
          }
          await hooks.callHook('entries:normalize', normalizeCtx)
          e._tags = normalizeCtx.tags.map((t, i) => {
            t._w = tagWeight(head, t)
            t._p = (e._i << 10) + i
            t._d = dedupeKey(t)
            return t
          })
        }
      }
      let hasFlatMeta = false
      ctx.entries
        .flatMap(e => (e._tags || []).map(t => ({ ...t, props: { ...t.props } })))
        .sort(sortTags)
        .reduce((acc, next) => {
          const k = String(next._d || next._p)
          if (!acc.has(k))
            return acc.set(k, next)

          const prev = acc.get(k)!
          const strategy = next?.tagDuplicateStrategy || (UsesMergeStrategy.has(next.tag) ? 'merge' : null)
            || (next.key && next.key === prev.key ? 'merge' : null)

          if (strategy === 'merge') {
            const newProps = { ...prev.props }
            Object.entries(next.props).forEach(([p, v]) =>
            // @ts-expect-error untyped
              newProps[p] = p === 'style'
              // @ts-expect-error untyped
                ? new Map([...(prev.props.style || new Map()), ...v])
                : p === 'class' ? new Set([...(prev.props.class || new Set()), ...v]) : v)
            acc.set(k, { ...next, props: newProps })
          }
          else if ((next._p! >> 10) === (prev._p! >> 10) && isMetaArrayDupeKey(next._d!)) {
            acc.set(k, Object.assign([...(Array.isArray(prev) ? prev : [prev]), next], next))
            hasFlatMeta = true
          }
          // @ts-expect-error untyped
          else if (next._w === prev._w ? next._p! > prev._p! : next?._w < prev?._w) {
            acc.set(k, next)
          }
          return acc
        }, ctx.tagMap)

      const title = ctx.tagMap.get('title')
      const titleTemplate = ctx.tagMap.get('titleTemplate')?.textContent
      head._title = title?.textContent
      head._titleTemplate = typeof titleTemplate === 'string' ? titleTemplate : undefined

      if (titleTemplate && title) {
        // @ts-expect-error todo
        let newTitle = typeof titleTemplate === 'function' ? titleTemplate(title.textContent) : titleTemplate
        if (typeof newTitle === 'string' && !head.plugins.has('template-params')) {
          newTitle = newTitle.replace('%s', title.textContent || '')
        }
        newTitle === null ? ctx.tagMap.delete('title') : ctx.tagMap.set('title', { ...title, textContent: newTitle })
      }
      // merge _tags into one map
      ctx.tags = Array.from(ctx.tagMap!.values())
      if (hasFlatMeta) {
        ctx.tags = ctx.tags.flat().sort(sortTags)
      }

      await hooks.callHook('tags:beforeResolve', ctx)
      await hooks.callHook('tags:resolve', ctx)
      // post-processing mainly for XSS prevention
      await hooks.callHook('tags:afterResolve', ctx)
      const finalTags: HeadTag[] = []
      for (const t of ctx.tags) {
        const { innerHTML, tag, props } = t
        if (!ValidHeadTags.has(tag)) {
          continue
        }
        // avoid rendering empty tags
        if (Object.keys(props).length === 0 && !t.innerHTML && !t.textContent) {
          continue
        }
        if (tag === 'meta' && !props.content && !props['http-equiv'] && !props.charset) {
          continue
        }
        // final XSS
        if (tag === 'script' && innerHTML) {
          if (props.type?.endsWith('json')) {
            const v = typeof innerHTML === 'string' ? innerHTML : JSON.stringify(innerHTML)
            // ensure </script> tags get encoded, this is only for JSON, it will break HTML if used
            t.innerHTML = v.replace(/</g, '\\u003C')
          }
          else if (typeof innerHTML === 'string') {
            // make sure the tag isn't being ended
            t.innerHTML = innerHTML.replace(new RegExp(`</${tag}`, 'g'), `<\\/${tag}`)
          }
          // the dedupe key may have become invalid
          t._d = dedupeKey(t)
        }
        finalTags.push(t)
      }
      return finalTags
    },
  }
  ;(resolvedOptions?.plugins || []).forEach(p => registerPlugin(head, p))
  head.hooks.callHook('init', head)
  resolvedOptions.init?.forEach(e => e && head.push(e as T))
  return head
}
