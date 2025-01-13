import type { CreateClientHeadOptions, MergeHead } from '@unhead/schema'
import type { MaybeComputedRef, ReactiveHead, VueHeadClient } from '@unhead/vue'
import { createHead as _createHead } from 'unhead/client'
import { nextTick } from 'vue'
import { vueInstall } from './install'
import { VueReactivityPlugin } from './VueReactivityPlugin'

export { VueHeadMixin } from './VueHeadMixin'
export * from 'unhead/client'

export function createHead<T extends MergeHead>(options: CreateClientHeadOptions = {}): VueHeadClient<T> {
  const head = _createHead<MaybeComputedRef<ReactiveHead<T>>>({
    domOptions: {
      delayFn: fn => nextTick(() => setTimeout(() => fn(), 0)),
    },
    ...options,
    plugins: [
      ...(options.plugins || []),
      VueReactivityPlugin,
    ],
  }) as VueHeadClient<T>
  head.install = vueInstall(head)
  return head
}
