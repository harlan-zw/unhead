import { defineHeadPlugin, NetworkEvents } from '../../utils'

const ValidEventTags = new Set(['script', 'link', 'bodyAttrs'])

/**
 * Supports DOM event handlers (i.e `onload`) as functions.
 *
 * When SSR we need to strip out these values. On CSR we
 */
export const ClientEventHandlerPlugin = defineHeadPlugin({
  key: 'client-event-handler',
  hooks: {
    'tags:resolve': (ctx) => {
      for (const tag of ctx.tags) {
        if (!ValidEventTags.has(tag.tag)) {
          continue
        }

        const props = tag.props

        for (const key in props) {
          // on
          if (key[0] !== 'o' || key[1] !== 'n') {
            continue
          }

          if (!Object.prototype.hasOwnProperty.call(props, key)) {
            continue
          }

          const value = props[key]

          if (typeof value !== 'function') {
            continue
          }

          delete props[key]
          tag._eventHandlers = tag._eventHandlers || {}
          tag._eventHandlers![key] = value
        }
      }
    },
    'dom:renderTag': ({ $el, tag }) => {
      const dataset = ($el as HTMLScriptElement | undefined)?.dataset

      if (!dataset) {
        return
      }

      // this is only handling SSR rendered tags with event handlers
      for (const k in dataset) {
        if (!k.endsWith('fired')) {
          continue
        }

        // onloadfired -> onload
        const ek = k.slice(0, -5)

        if (!NetworkEvents.has(ek)) {
          continue
        }

        // onload -> load
        tag._eventHandlers?.[ek]?.call($el, new Event(ek.substring(2)))
      }
    },
  },
})
