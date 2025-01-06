import type { CreateHeadOptions } from '@unhead/schema'
import type { JSDOM } from 'jsdom'
import { useDom } from '../../fixtures'
import { createHeadWithContext } from '../../util'

// eslint-disable-next-line import/no-mutable-exports
export let activeDom: JSDOM | null = null

export function useDOMHead(options: CreateHeadOptions = {}) {
  activeDom = useDom()
  return createHeadWithContext({
    document: activeDom.window.document,
    ...options,
  })
}

export function useDelayedSerializedDom() {
  return new Promise<string>((resolve) => {
    setTimeout(() => resolve(activeDom!.serialize()), 250)
  })
}
