import type {
  AsAsyncFunctionValues,
  UseScriptInput as BaseUseScriptInput,
  DataKeys,
  SchemaAugmentations,
  ScriptBase,
  ScriptInstance,
  UseFunctionType,
  UseScriptOptions,
  UseScriptResolvedInput,
  UseScriptStatus,
} from '@unhead/schema'
import { useScript as _useScript } from 'unhead'
import type { ComponentInternalInstance, Ref } from 'vue'
import { getCurrentInstance, onMounted, onScopeDispose, ref } from 'vue'
import type { MaybeComputedRefEntriesOnly } from '../types'
import { injectHead } from './injectHead'

export interface VueScriptInstance<T extends Record<symbol | string, any>> extends Omit<ScriptInstance<T>, 'status'> {
  status: Ref<UseScriptStatus>
}

export type UseScriptInput = string | (MaybeComputedRefEntriesOnly<Omit<ScriptBase & DataKeys & SchemaAugmentations['script'], 'src'>> & { src: string })

export type UseScriptContext<T extends Record<symbol | string, any>> =
  (Promise<T> & VueScriptInstance<T>)
  & AsAsyncFunctionValues<T>
  & {
  /**
   * @deprecated Use top-level functions instead.
   */
    $script: Promise<T> & VueScriptInstance<T>
  }

function registerVueScopeHandlers<T extends Record<symbol | string, any> = Record<symbol | string, any>>(script: UseScriptContext<UseFunctionType<UseScriptOptions<T, any>, T>>, scope?: ComponentInternalInstance | null) {
  if (!scope) {
    return
  }
  const _registerCb = (key: 'loaded' | 'error', cb: any) => {
    if (!script._cbs[key]) {
      cb(script.instance)
      return () => {}
    }
    let i: number | null = script._cbs[key].push(cb)
    const destroy = () => {
      // avoid removing the wrong callback
      if (i) {
        script._cbs[key]?.splice(i - 1, 1)
        i = null
      }
    }
    onScopeDispose(destroy)
    return destroy
  }
  onScopeDispose(() => {
    // if we registered the script using a promise trigger we need to drop the promise on dispose
    // i.e shouldn't load if we've out of the scope
    script._triggerAbortController?.abort()
  })
  // if we have a scope we should make these callbacks reactive
  script.onLoaded = (cb: (instance: T) => void | Promise<void>) => _registerCb('loaded', cb)
  script.onError = (cb: (err?: Error) => void | Promise<void>) => _registerCb('error', cb)
}

export function useScript<T extends Record<symbol | string, any> = Record<symbol | string, any>, U = Record<symbol | string, any>>(_input: UseScriptInput, _options?: UseScriptOptions<T, U>): UseScriptContext<UseFunctionType<UseScriptOptions<T, U>, T>> {
  const input = (typeof _input === 'string' ? { src: _input } : _input) as UseScriptResolvedInput
  const head = injectHead()
  const options = _options || {}
  // @ts-expect-error untyped
  options.head = head
  const scope = getCurrentInstance()
  options.eventContext = scope
  if (scope && typeof options.trigger === 'undefined')
    options.trigger = onMounted
  // we may be re-using an existing script
  // sync the status, need to register before useScript
  // @ts-expect-error untyped
  head._scriptStatusWatcher = head._scriptStatusWatcher || head.hooks.hook('script:updated', ({ script: s }) => {
    // @ts-expect-error untyped
    s._statusRef.value = s.status
  })
  const script = _useScript(input as BaseUseScriptInput, options)
  // @ts-expect-error untyped
  script._statusRef = script._statusRef || ref<UseScriptStatus>(script.status)
  // Note: we don't remove scripts on unmount as it's not a common use case and reloading the script may be expensive
  // @ts-expect-error untyped
  registerVueScopeHandlers(script, scope)
  return new Proxy(script, {
    get(_, key, a) {
      // we can't override status as it will break the unhead useScript API
      return Reflect.get(_, key === 'status' ? '_statusRef' : key, a)
    },
  }) as any as UseScriptContext<UseFunctionType<UseScriptOptions<T, U>, T>>
}
