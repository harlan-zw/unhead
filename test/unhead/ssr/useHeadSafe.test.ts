import { renderSSRHead } from '@unhead/ssr'
import { useHeadSafe } from 'unhead'
import { describe, it } from 'vitest'
import { basicSchema } from '../../fixtures'
import { createHeadWithContext } from '../../util'

describe('dom useHeadSafe', () => {
  it('basic', async () => {
    const head = createHeadWithContext()

    useHeadSafe(basicSchema)

    const ctx = await renderSSRHead(head)
    expect(ctx).toMatchInlineSnapshot(`
      {
        "bodyAttrs": " class="dark"",
        "bodyTags": "",
        "bodyTagsOpen": "",
        "headTags": "<meta charset="utf-8">
      <link href="https://cdn.example.com/favicon.ico" rel="icon" type="image/x-icon">",
        "htmlAttrs": " lang="en" dir="ltr"",
      }
    `)
  })

  it('link href', async () => {
    const head = createHeadWithContext()

    useHeadSafe({
      link: [
        // relative from root
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/icon.png',
        },
        // relative to path
        {
          rel: 'icon',
          href: 'favicon.ico',
        },
      ],
    })

    const ctx = await renderSSRHead(head)
    expect(ctx).toMatchInlineSnapshot(`
      {
        "bodyAttrs": "",
        "bodyTags": "",
        "bodyTagsOpen": "",
        "headTags": "<link href="/icon.png" rel="apple-touch-icon" sizes="180x180">
      <link href="favicon.ico" rel="icon">",
        "htmlAttrs": "",
      }
    `)
  })

  it('meta charset allows safe', async () => {
    const head = createHeadWithContext()

    useHeadSafe({
      meta: [
        {
          charset: 'utf-8',
        },
      ],
    })

    const ctx = await renderSSRHead(head)
    expect(ctx).toMatchInlineSnapshot(`
      {
        "bodyAttrs": "",
        "bodyTags": "",
        "bodyTagsOpen": "",
        "headTags": "<meta charset="utf-8">",
        "htmlAttrs": "",
      }
    `)
  })

  it('meta charset is actually safe', async () => {
    const head = createHeadWithContext()

    useHeadSafe({
      meta: [
        {
          charset: 'utf-8"><script>alert("pwned?")</script>',
        },
      ],
    })

    const ctx = await renderSSRHead(head)
    expect(ctx).toMatchInlineSnapshot(`
      {
        "bodyAttrs": "",
        "bodyTags": "",
        "bodyTagsOpen": "",
        "headTags": "<meta charset="utf-8&quot;><script>alert(&quot;pwned?&quot;)</script>">",
        "htmlAttrs": "",
      }
    `)
  })
})
