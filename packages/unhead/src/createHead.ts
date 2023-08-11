import { createHooks } from 'hookable'
import type {
  CreateHeadOptions,
  Head,
  HeadEntry,
  HeadHooks,
  HeadPlugin,
  HeadTag,
  SideEffectsRecord,
  Unhead,
} from '@unhead/schema'
import { PatchDomOnEntryUpdatesPlugin } from '@unhead/dom'
import { setActiveHead } from './runtime/state'
import {
  DedupesTagsPlugin,
  DeprecatedTagAttrPlugin,
  EventHandlersPlugin,
  ProvideTagKeyHash,
  SortTagsPlugin,
  TemplateParamsPlugin,
  TitleTemplatePlugin,
} from './plugin'
import { normaliseEntryTags } from './utils'
import { IsBrowser } from './env'

export function CorePlugins() {
  return [
  // dedupe needs to come first
    DedupesTagsPlugin(),
    SortTagsPlugin(),
    TemplateParamsPlugin(),
    TitleTemplatePlugin(),
    ProvideTagKeyHash(),
    EventHandlersPlugin(),
    DeprecatedTagAttrPlugin(),
  ]
}

/* @__NO_SIDE_EFFECTS__ */ export function DOMPlugins(options: CreateHeadOptions = {}) {
  return [
    PatchDomOnEntryUpdatesPlugin({ document: options?.document, delayFn: options?.domDelayFn }),
  ]
}

/* @__NO_SIDE_EFFECTS__ */ export function createHead<T extends {} = Head>(options: CreateHeadOptions = {}) {
  const head = createHeadCore<T>({
    ...options,
    plugins: [...DOMPlugins(options), ...(options?.plugins || [])],
  })
  setActiveHead(head)
  return head
}

/* @__NO_SIDE_EFFECTS__ */ export function createServerHead<T extends {} = Head>(options: CreateHeadOptions = {}) {
  const head = createHeadCore<T>({
    ...options,
    mode: 'server',
  })
  setActiveHead(head)
  return head
}

/**
 * Creates a core instance of unhead. Does not provide a global ctx for composables to work
 * and does not register DOM plugins.
 *
 * @param options
 */
export function createHeadCore<T extends {} = Head>(options: CreateHeadOptions = {}) {
  let entries: HeadEntry<T>[] = new Proxy([], {
    set(target, prop, value) {
      // @ts-expect-error untyped
      target[prop] = value
      updated()
      return true
    },
  })
  // queued side effects
  let _sde: SideEffectsRecord = {}
  // counter for keeping unique ids of head object entries
  let _eid = 0
  const hooks = createHooks<HeadHooks>()
  if (options?.hooks)
    hooks.addHooks(options.hooks)

  options.plugins = [
    ...CorePlugins(),
    ...(options?.plugins || []),
  ]
  options.plugins.forEach(p => p.hooks && hooks.addHooks(p.hooks))
  options.document = options.document || (IsBrowser ? document : undefined)

  // does the dom rendering by default
  // es-lint-disable-next-line @typescript-eslint/no-use-before-define
  const updated = () => hooks.callHook('entries:updated', head)

  const head: Unhead<T> = {
    resolvedOptions: options,
    headEntries() {
      return entries
    },
    get hooks() {
      return hooks
    },
    use(plugin: HeadPlugin) {
      if (plugin.hooks)
        hooks.addHooks(plugin.hooks)
    },
    push(input, entryOptions) {
      const activeEntry: HeadEntry<T> = {
        _i: _eid++,
        input,
        _sde: {},
        ...entryOptions as Partial<HeadEntry<T>>,
      }
      const mode = activeEntry?.mode || options.mode
      // if a mode is provided via options, set it
      if (mode)
        activeEntry.mode = mode
      entries.push(activeEntry)
      return {
        dispose() {
          entries = entries.filter((e) => {
            if (e._i !== activeEntry._i)
              return true
            // queue side effects
            _sde = { ..._sde, ...e._sde || {} }
            e._sde = {}
            return false
          })
        },
        // a patch is the same as creating a new entry, just a nice DX
        patch(input) {
          entries = entries.map((e) => {
            if (e._i === activeEntry._i) {
              // bit hacky syncing
              activeEntry.input = e.input = input
            }
            return e
          })
        },
      }
    },
    async resolveTags() {
      const resolveCtx: { tags: HeadTag[]; entries: HeadEntry<T>[] } = { tags: [], entries: [...entries] }
      await hooks.callHook('entries:resolve', resolveCtx)
      for (const entry of resolveCtx.entries) {
        // apply any custom transformers applied to the entry
        const resolved = entry.resolvedInput || entry.input
        entry.resolvedInput = await (entry.transform ? entry.transform(resolved) : resolved) as T
        if (entry.resolvedInput) {
          for (const tag of await normaliseEntryTags<T>(entry)) {
            const tagCtx = { tag, entry, resolvedOptions: head.resolvedOptions }
            await hooks.callHook('tag:normalise', tagCtx)
            resolveCtx.tags.push(tagCtx.tag)
          }
        }
      }
      await hooks.callHook('tags:beforeResolve', resolveCtx)
      await hooks.callHook('tags:resolve', resolveCtx)
      return resolveCtx.tags
    },
    _popSideEffectQueue() {
      const sde = { ..._sde }
      _sde = {}
      return sde
    },
    _elMap: {},
  }

  head.hooks.callHook('init', head)
  return head
}
