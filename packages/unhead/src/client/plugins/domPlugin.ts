import type { DomPluginOptions } from '../../types'
import { defineHeadPlugin } from '@unhead/shared'

export function DomPlugin(options: DomPluginOptions) {
  return defineHeadPlugin((head) => {
    // restore initial entry from payload (titleTemplate and templateParams)
    const initialPayload = head.resolvedOptions.document?.head.querySelector('script[id="unhead:payload"]')?.innerHTML || false
    if (initialPayload) {
      head.push(JSON.parse(initialPayload))
    }
    return {
      mode: 'client',
      hooks: {
        'entries:updated': (head) => {
          // async load the renderDOMHead function
          options.render(head)
        },
      },
    }
  })
}
