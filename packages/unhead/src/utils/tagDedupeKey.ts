import type { HeadTag } from '../types'
import { MetaTagsArrayable, TagsWithInnerContent, UniqueTags } from './const'

const allowedMetaProperties = ['name', 'property', 'http-equiv']

export function isMetaArrayDupeKey(v: string) {
  const k = v.split(':')[1]
  return MetaTagsArrayable.has(k)
}

export function tagDedupeKey<T extends HeadTag>(tag: T): string | undefined {
  const { props, tag: name } = tag
  // must only be a single base so we always dedupe
  if (UniqueTags.has(name))
    return name

  // support only a single canonical
  if (name === 'link' && props.rel === 'canonical')
    return 'canonical'

  if (props.charset)
    return 'charset'

  if (tag.tag === 'meta') {
    for (const n of allowedMetaProperties) {
      // open graph props can have multiple tags with the same property
      if (props[n] !== undefined) {
        // const val = isMetaArrayDupeKey(props[n]) ? `:${props.content}` : ''
        // for example: meta-name-description
        return `${name}:${props[n]}`
      }
    }
  }

  if (tag.key) {
    return `${name}:key:${tag.key}`
  }

  if (props.id) {
    return `${name}:id:${props.id}`
  }

  // avoid duplicate tags with the same content (if no key is provided)
  if (TagsWithInnerContent.has(name)) {
    const v = tag.textContent || tag.innerHTML
    if (v) {
      return `${name}:content:${v}`
    }
  }
}
