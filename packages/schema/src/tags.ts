import type { MaybePromiseProps } from 'zhead'
import type { Head } from './schema'
import type { RuntimeMode } from './head'

export interface ResolvesDuplicates {
  /**
   * By default, tags which share the same unique key `name`, `property` are de-duped. To allow duplicates
   * to be made you can provide a unique key for each entry.
   */
  key?: string
  /**
   * The strategy to use when a duplicate tag is encountered.
   *
   * - `replace` - Replace the existing tag with the new tag
   * - `merge` - Merge the existing tag with the new tag
   *
   * @default 'replace' (some tags will default to 'merge', such as htmlAttr)
   */
  tagDuplicateStrategy?: 'replace' | 'merge'
  /**
   * @deprecated Use `key` instead
   */
  hid?: string
  /**
   * @deprecated Use `key` instead
   */
  vmid?: string
}

export type ValidTagPositions = 'head' | 'bodyClose' | 'bodyOpen'

export interface TagPosition {
  /**
   * Specify where to render the tag.
   *
   * @default 'head'
   */
  tagPosition?: ValidTagPositions
}

export type InnerContentVal = string | Record<string, any>

export interface InnerContent {
  /**
   * Text content of the tag.
   *
   * Warning: This is not safe for XSS. Do not use this with user input, use `textContent` instead.
   */
  innerHTML?: InnerContentVal
  /**
   * Sets the textContent of an element. Safer for XSS.
   */
  textContent?: InnerContentVal
  /**
   * Sets the textContent of an element.
   *
   * @deprecated Use `textContent` or `innerHTML`.
   */
  children?: InnerContentVal
}

export interface TagPriority {
  /**
   * The priority for rendering the tag, without this all tags are rendered as they are registered
   * (besides some special tags).
   *
   * The following special tags have default priorities:
   * * -2 `<meta charset ...>`
   * * -1 `<base>`
   * * 0 `<meta http-equiv="content-security-policy" ...>`
   *
   * All other tags have a default priority of 10: `<meta>`, `<script>`, `<link>`, `<style>`, etc
   */
  tagPriority?: number | 'critical' | 'high' | 'low' | `before:${string}` | `after:${string}`
}

export type TagUserProperties = TagPriority & TagPosition & MaybePromiseProps<InnerContent> & ResolvesDuplicates

export type TagKey = keyof Head

export type TemplateParams = { separator?: string } & Record<string, null | string | Record<string, string>>

export interface HasTemplateParams {
  templateParams?: TemplateParams
}

export interface HeadTag extends TagPriority, TagPosition, ResolvesDuplicates, HasTemplateParams {
  tag: TagKey
  props: Record<string, string>
  innerHTML?: string
  textContent?: string
  /**
   * Entry ID
   * @internal
   */
  _e?: number
  /**
   * Position
   * @internal
   */
  _p?: number
  /**
   * Dedupe key
   * @internal
   */
  _d?: string
  /**
   * Hash code used to represent the tag.
   * @internal
   */
  _h?: string
  /**
   * @internal
   */
  _m?: RuntimeMode
}

export type HeadTagKeys = (keyof HeadTag)[]
