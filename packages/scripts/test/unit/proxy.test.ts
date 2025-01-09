import type { AsVoidFunctions } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createServerHeadWithContext } from '../../../../test/util'
import { createForwardingProxy } from '../../src'
import { createNoopedRecordingProxy, replayProxyRecordings } from '../../src/proxy'
import { useScript } from '../../src/useScript'
import { createSpyProxy } from '../../src/utils'

interface Api {
  _paq: any[]
  doSomething: () => Promise<'foo'>
  say: (message: string) => string
  foo: {
    bar: {
      fn: () => true
    }
  }
}

describe('proxy chain', () => {
  it('augments types', () => {
    const proxy = createNoopedRecordingProxy<Api>()
    expectTypeOf(proxy.proxy._paq).toBeArray()
    expectTypeOf(proxy.proxy.doSomething).toBeFunction()
    expectTypeOf(proxy.proxy.doSomething).returns.toBeVoid()
    expectTypeOf(proxy.proxy.say).parameter(0).toBeString()
    expectTypeOf(proxy.proxy.foo.bar.fn).toBeFunction()
  })
  it('e2e', async () => {
    // do recording
    const { proxy, stack } = createNoopedRecordingProxy<Api>()
    const script = { proxy, instance: null }
    script.proxy._paq.push(['test'])
    script.proxy.say('hello world')
    expect(stack.length).toBe(2)
    let called
    const w: any = {
      _paq: createSpyProxy([], () => {
        called = true
      }),
      say: (s: string) => {
        console.log(s)
        return s
      },
    }
    // did load
    script.instance = {
      _paq: w._paq,
      say: w.say,
    }
    const log = console.log
    // replay recording
    const consoleMock = vi.spyOn(console, 'log').mockImplementation((...args) => {
      log('mocked', ...args)
    })
    replayProxyRecordings(script.instance, stack)
    // @ts-expect-error untyped
    script.proxy = createForwardingProxy(script.instance)
    expect(consoleMock).toHaveBeenCalledWith('hello world')
    script.proxy.say('proxy updated!')
    expect(consoleMock).toHaveBeenCalledWith('proxy updated!')
    expect(script.instance).toMatchInlineSnapshot(`
      {
        "_paq": [
          [
            "test",
          ],
        ],
        "say": [Function],
      }
    `)
    script.proxy._paq.push(['test'])
    consoleMock.mockReset()
    expect(called).toBe(true)
  })
  it('spy', () => {
    const w: any = {}
    w._paq = []
    const stack: any[] = []
    w._paq = createSpyProxy(w._paq, (s) => {
      stack.push(s)
    })
    w._paq.push(['test'])
    expect(stack).toMatchInlineSnapshot(`
      [
        [
          [
            {
              "key": "push",
              "type": "get",
            },
            {
              "args": [
                [
                  "test",
                ],
              ],
              "key": "",
              "type": "apply",
            },
          ],
          [
            {
              "key": "length",
              "type": "get",
              "value": 0,
            },
          ],
        ],
      ]
    `)
  })
  it('use() provided', () => {
    const head = createServerHeadWithContext()
    const instance = useScript({
      src: 'https://cdn.example.com/script.js',
      head,
    }, {
      use() {
        return {
          greet: (foo: string) => {
            console.log(foo)
            return foo
          },
        }
      },
    })
    instance.onLoaded((vm) => {
      vm.greet('hello-world')
    })
    const consoleMock = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    expectTypeOf(instance.proxy.greet).toBeFunction()
    instance.proxy.greet('hello-world')
    expect(consoleMock).toHaveBeenCalledWith('hello-world')
  })
})

describe('types: AsVoidFunctions', () => {
  it('should keep array properties unchanged', () => {
    type Result = AsVoidFunctions<Api>
    expectTypeOf<Result['_paq']>().toEqualTypeOf<any[]>()
  })

  it('should convert function properties to void functions', () => {
    type Result = AsVoidFunctions<Api>
    expectTypeOf<Result['doSomething']>().toBeFunction()
    expectTypeOf<Result['doSomething']>().returns.toBeVoid()
    expectTypeOf<Result['say']>().toBeFunction()
    expectTypeOf<Result['say']>().parameters.toEqualTypeOf<[string]>()
    expectTypeOf<Result['say']>().returns.toBeVoid()
  })

  it('should recursively convert nested function properties to void functions', () => {
    type Result = AsVoidFunctions<Api>
    expectTypeOf<Result['foo']['bar']['fn']>().toBeFunction()
    expectTypeOf<Result['foo']['bar']['fn']>().returns.toBeVoid()
  })
})
