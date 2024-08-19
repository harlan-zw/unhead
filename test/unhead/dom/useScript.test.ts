import { describe, it } from 'vitest'
import { useScript } from 'unhead'
import { useDOMHead, useDelayedSerializedDom } from './util'

describe('dom useScript', () => {
  it('basic', async () => {
    const head = useDOMHead()

    const instance = useScript<{ test: (foo: string) => void }>({
      src: 'https://cdn.example.com/script.js',
    }, {
      use() {
        return {
          test: (foo: string) => {},
        }
      },
    })

    expect(await useDelayedSerializedDom()).toMatchInlineSnapshot(`
      "<!DOCTYPE html><html><head>

      <script data-onload="" data-onerror="" defer="" fetchpriority="low" crossorigin="anonymous" referrerpolicy="no-referrer" src="https://cdn.example.com/script.js" data-hid="c5c65b0"></script></head>
      <body>

      <div>
      <h1>hello world</h1>
      </div>



      </body></html>"
    `)

    let calledFn
    const hookPromise = new Promise<void>((resolve) => {
      head.hooks.hook('script:instance-fn', ({ script, fn }) => {
        if (script.id === instance.$script.id) {
          calledFn = fn
          resolve()
        }
      })
    })
    instance.test('hello-world')
    await hookPromise
    expect(calledFn).toBe('test')
  })
  it('proxy', async () => {
    const head = useDOMHead()

    const instance = useScript<{ test: (foo: string) => string }>({
      src: 'https://cdn.example.com/script.js',
    }, {
      use() {
        return {
          test: (foo: string) => foo,
        }
      },
    })

    expect(await instance.proxy.test('hello-world')).toEqual('hello-world')
  })
})
