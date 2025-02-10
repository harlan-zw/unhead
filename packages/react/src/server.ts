import type { ReactNode } from 'react'
import type { CreateServerHeadOptions, MergeHead } from 'unhead/types'
import type { MaybeComputedRef, ReactiveHead, ReactUnhead } from './types'
import { createElement } from 'react'
import { createHead as _createHead } from 'unhead/server'
import { UnheadContext } from './context'
import { ReactPropResolver } from './resolver'

export * from 'unhead/server'

export function createHead<T extends MergeHead>(options: CreateServerHeadOptions = {}): ReactUnhead<T> {
  return _createHead<MaybeComputedRef<ReactiveHead<T>>>({
    ...options,
    propResolvers: [
      ReactPropResolver,
    ],
  }) as ReactUnhead<T>
}

export function UnheadProvider({ children, value }: { children: ReactNode, value: ReturnType<typeof createHead> }) {
  return createElement(UnheadContext.Provider, { value }, children)
}
