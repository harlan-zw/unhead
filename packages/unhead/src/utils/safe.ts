import type { HeadSafe, MaybeArray } from '@unhead/schema'

const WhitelistAttributes = {
  htmlAttrs: ['id', 'class', 'lang', 'dir'],
  bodyAttrs: ['id', 'class'],
  meta: ['id', 'name', 'property', 'charset', 'content'],
  noscript: ['id', 'textContent'],
  script: ['id', 'type', 'textContent'],
  link: ['id', 'color', 'crossorigin', 'fetchpriority', 'href', 'hreflang', 'imagesrcset', 'imagesizes', 'integrity', 'media', 'referrerpolicy', 'rel', 'sizes', 'type'],
}
export function whitelistSafeInput(input: Record<string, MaybeArray<Record<string, string>>>): HeadSafe {
  const filtered: Record<string, MaybeArray<Record<string, string>>> = {}
  // remove any keys that can be used for XSS
  Object.keys(input).forEach((key) => {
    const tagValue = input[key]
    if (!tagValue)
      return
    switch (key as keyof HeadSafe) {
      // always safe
      case 'title':
      case 'titleTemplate':
      case 'templateParams':
        filtered[key] = tagValue
        break
      case 'htmlAttrs':
      case 'bodyAttrs':
        filtered[key] = {}
        // @ts-expect-error untyped
        WhitelistAttributes[key].forEach((a) => {
          // @ts-expect-error untyped
          if (tagValue[a])
            // @ts-expect-error untyped
            filtered[key][a] = tagValue[a]
        })
        // add any data attributes
        Object.keys(tagValue || {})
          .filter(a => a.startsWith('data-'))
          .forEach((a) => {
            // @ts-expect-error untyped
            filtered[key][a] = tagValue[a]
          })
        break
      // meta is safe, except for http-equiv
      case 'meta':
        if (Array.isArray(tagValue)) {
          filtered[key] = (tagValue as Record<string, string>[])
            .map((meta) => {
              const safeMeta: Record<string, string> = {}
              WhitelistAttributes.meta.forEach((key) => {
                if (meta[key] || key.startsWith('data-'))
                  safeMeta[key] = meta[key]
              })
              return safeMeta
            })
            .filter(meta => Object.keys(meta).length > 0)
        }
        break
      // link tags we don't allow stylesheets, scripts, preloading, prerendering, prefetching, etc
      case 'link':
        if (Array.isArray(tagValue)) {
          filtered[key] = (tagValue as Record<string, string>[])
            .map((meta) => {
              const link: Record<string, string> = {}
              WhitelistAttributes.link.forEach((key) => {
                const val = meta[key]
                // block bad rel types
                if (key === 'rel' && ['stylesheet', 'canonical', 'modulepreload', 'prerender', 'preload', 'prefetch'].includes(val))
                  return

                if (key === 'href') {
                  if (val.includes('javascript:') || val.includes('data:'))
                    return
                  link[key] = val
                }
                else if (val || key.startsWith('data-')) {
                  link[key] = val
                }
              })
              return link
            })
            .filter(link => Object.keys(link).length > 1 && !!link.rel)
        }
        break
      case 'noscript':
        if (Array.isArray(tagValue)) {
          filtered[key] = (tagValue as Record<string, string>[])
            .map((meta) => {
              const noscript: Record<string, string> = {}
              WhitelistAttributes.noscript.forEach((key) => {
                if (meta[key] || key.startsWith('data-'))
                  noscript[key] = meta[key]
              })
              return noscript
            })
            .filter(meta => Object.keys(meta).length > 0)
        }
        break
      // we only allow JSON in scripts
      case 'script':
        if (Array.isArray(tagValue)) {
          filtered[key] = (tagValue as Record<string, string>[])
            .map((script) => {
              const safeScript: Record<string, string> = {}
              WhitelistAttributes.script.forEach((s) => {
                if (script[s] || s.startsWith('data-')) {
                  if (s === 'textContent') {
                    try {
                      const jsonVal = typeof script[s] === 'string' ? JSON.parse(script[s]) : script[s]
                      safeScript[s] = JSON.stringify(jsonVal, null, 0)
                    }
                    catch (e) {}
                  }
                  else {
                    safeScript[s] = script[s]
                  }
                }
              })
              return safeScript
            })
            .filter(meta => Object.keys(meta).length > 0)
        }
        break
    }
  })
  return filtered as HeadSafe
}
