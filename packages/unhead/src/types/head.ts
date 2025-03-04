import type { Hookable, NestedHooks } from 'hookable'
import type { HeadHooks } from './hooks'
import type { DomPluginOptions } from './plugins'
import type { ResolvableHead } from './schema'
import type { HeadTag, ProcessesTemplateParams, ResolvesDuplicates, TagPosition, TagPriority, TemplateParams } from './tags'

/**
 * Side effects are mapped with a key and their cleanup function.
 *
 * For example, `meta:data-h-4h46h465`: () => { document.querySelector('meta[data-h-4h46h465]').remove() }
 */
export type SideEffectsRecord = Record<string, () => void>

export type RuntimeMode = 'server' | 'client'

export interface HeadEntry<Input> {
  /**
   * User provided input for the entry.
   */
  input: Input
  options?: {
    /**
     * The mode that the entry should be used in.
     *
     * @internal
     */
    mode?: RuntimeMode
    /**
     * Default tag position.
     *
     * @internal
     */
    tagPosition?: TagPosition['tagPosition']
    /**
     * Default tag priority.
     *
     * @internal
     */
    tagPriority?: TagPriority['tagPriority']
    /**
     * Default tag duplicate strategy.
     *
     * @internal
     */
    tagDuplicateStrategy?: HeadTag['tagDuplicateStrategy']
    /**
     * @internal
     */
    _safe?: boolean
  }
  /**
   * Head entry index
   *
   * @internal
   */
  _i: number
  /**
   * Resolved tags
   *
   * @internal
   */
  _tags?: HeadTag[]
  /**
   * @internal
   */
  _promisesProcessed?: boolean
}

export type HeadPluginOptions = Omit<CreateHeadOptions, 'plugins'>

export type HeadPluginInput = HeadPluginOptions & { key: string } | ((head: Unhead) => HeadPluginOptions & { key: string })
export type HeadPlugin = HeadPluginOptions & { key: string }

/**
 * An active head entry provides an API to manipulate it.
 */
export interface ActiveHeadEntry<Input> {
  /**
   * Updates the entry with new input.
   *
   * Will first clear any side effects for previous input.
   */
  patch: (input: Input, force?: boolean) => void
  /**
   * Dispose the entry, removing it from the active head.
   *
   * Will queue side effects for removal.
   */
  dispose: () => void
  /**
   * @internal
   */
  _poll: (rm?: boolean) => void
  /**
   * Hook side effect persisted for deduping and clean up.
   */
  _h?: () => void
}

export type PropResolver = (key: string, value: any, tag?: HeadTag) => any

export interface CreateHeadOptions {
  document?: Document
  plugins?: HeadPluginInput[]
  hooks?: NestedHooks<HeadHooks>
  /**
   * Initial head input that should be added.
   *
   * Any tags here are added with low priority.
   */
  init?: (ResolvableHead | undefined)[]
  /**
   * Disable the Capo.js tag sorting algorithm.
   *
   * This is added to make the v1 -> v2 migration easier allowing users to opt-out of the new sorting algorithm.
   */
  disableCapoSorting?: boolean
  /**
   * Prop resolvers for tags.
   */
  propResolvers?: PropResolver[]
}

export interface CreateServerHeadOptions extends CreateHeadOptions {
  /**
   * Should default important tags be skipped.
   *
   * Adds the following tags with low priority:
   * - <html lang="en">
   * - <meta charset="utf-8">
   * - <meta name="viewport" content="width=device-width, initial-scale=1">
   */
  disableDefaults?: boolean
}

export interface CreateClientHeadOptions extends CreateHeadOptions {
  /**
   * Options to pass to the DomPlugin.
   */
  domOptions?: DomPluginOptions
}

export interface HeadEntryOptions extends TagPosition, TagPriority, ProcessesTemplateParams, ResolvesDuplicates {
  /**
   * @deprecated Tree shaking should now be handled using import.meta.* if statements.
   */
  mode?: RuntimeMode
  head?: Unhead
  /**
   * @internal
   */
  _safe?: boolean
  /**
   * @internal
   */
  _index?: number
}

export interface Unhead<Input = ResolvableHead> {
  /**
   * Registered plugins.
   */
  plugins: Map<string, HeadPlugin>
  /**
   * The head entries.
   */
  entries: Map<number, HeadEntry<Input>>
  /**
   * The active head entries.
   *
   * @deprecated Use entries instead.
   */
  headEntries: () => HeadEntry<Input>[]
  /**
   * Create a new head entry.
   */
  push: (entry: Input, options?: HeadEntryOptions) => ActiveHeadEntry<Input>
  /**
   * Resolve tags from head entries.
   */
  resolveTags: () => Promise<HeadTag[]>
  /**
   * Exposed hooks for easier extension.
   */
  hooks: Hookable<HeadHooks>
  /**
   * Resolved options
   */
  resolvedOptions: CreateHeadOptions
  /**
   * Use a head plugin, loads the plugins hooks.
   */
  use: (plugin: HeadPluginInput) => void
  /**
   * Is it a server-side render context.
   */
  ssr: boolean
  // dom specific runtime state
  /**
   * @internal
   */
  _dom?: DomState
  /**
   * @internal
   */
  _domUpdatePromise?: Promise<void>
  /**
   * @internal
   */
  dirty: boolean
  /**
   * @internal
   */
  _scripts?: Record<string, any>
  /**
   * @internal
   */
  _templateParams?: TemplateParams
  /**
   * @internal
   */
  _separator?: string
  /**
   * @internal
   */
  _entryCount: number
  /**
   * @internal
   */
  _title?: string
  /**
   * @internal
   */
  _titleTemplate?: string
}

export interface DomState {
  pendingSideEffects: SideEffectsRecord
  sideEffects: SideEffectsRecord
  elMap: Map<string, Element | Element[]>
}
