import { renderDOMHead } from '@unhead/dom'
import { defineOrganization, defineQuestion, defineWebPage, defineWebSite, useSchemaOrg } from '@unhead/schema-org'
import { renderSSRHead } from '@unhead/ssr'
import { createHead, useHead } from 'unhead'
import { describe, expect, it } from 'vitest'
import { useDom } from '../../fixtures'

describe('schema.org e2e no plugin', () => {
  it('basic hydration', async () => {
    const ssrHead = createHead()

    useSchemaOrg([
      defineWebPage({
        name: 'test',
      }),
    ])

    const data = await renderSSRHead(ssrHead)
    expect(data.bodyTags).toMatchInlineSnapshot(`
      "<script type="application/ld+json" data-hid="3437552">{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": "#webpage",
            "@type": "WebPage",
            "name": "test"
          }
        ]
      }</script>"
    `)

    const dom = useDom(data)

    const csrHead = createHead()
    await renderDOMHead(csrHead, { document: dom.window.document })
    expect(dom.serialize()).toMatchInlineSnapshot(`
      "<!DOCTYPE html><html><head>

      </head>
      <body>

      <div>
      <h1>hello world</h1>
      </div>
      <script type="application/ld+json" data-hid="3437552">{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": "#webpage",
            "@type": "WebPage",
            "name": "test"
          }
        ]
      }</script>


      </body></html>"
    `)
  })

  it('hierarchy', async () => {
    const ssrHead = createHead()

    useHead({
      templateParams: {
        schemaOrg: {
          path: '/about',
        },
      },
    })

    useSchemaOrg([
      defineWebPage({
        name: 'Home',
      }),
    ])

    useSchemaOrg([
      defineWebPage({
        '@type': 'AboutPage',
        'name': 'About',
      }),
    ])

    const data = await renderSSRHead(ssrHead)
    expect(data.bodyTags).toMatchInlineSnapshot(`
      "<script type="application/ld+json" data-hid="3437552">{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": "/about#webpage",
            "name": "About",
            "url": "/about",
            "@type": [
              "WebPage",
              "AboutPage"
            ]
          }
        ]
      }</script>"
    `)

    const dom = useDom(data)

    const csrHead = createHead()
    await renderDOMHead(csrHead, { document: dom.window.document })
    expect(dom.serialize()).toMatchInlineSnapshot(`
      "<!DOCTYPE html><html><head>

      </head>
      <body>

      <div>
      <h1>hello world</h1>
      </div>
      <script type="application/ld+json" data-hid="3437552">{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": "/about#webpage",
            "name": "About",
            "url": "/about",
            "@type": [
              "WebPage",
              "AboutPage"
            ]
          }
        ]
      }</script>


      </body></html>"
    `)
  })

  it('linking', async () => {
    const ssrHead = createHead()

    useHead({
      templateParams: {
        schemaOrg: {
          path: '/about',
          host: 'https://example.com',
        },
      },
    })

    useSchemaOrg([
      defineOrganization({
        name: 'test',
      }),
      defineWebSite({
        name: 'test',
        publisher: {
          '@type': 'Organization',
          '@id': '#identity',
        },
      }),
    ])

    const data = await renderSSRHead(ssrHead)
    expect(data.bodyTags).toMatchInlineSnapshot(`
      "<script type="application/ld+json" data-hid="3437552">{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": "https://example.com#identity",
            "@type": "Organization",
            "name": "test",
            "url": "https://example.com"
          },
          {
            "@id": "https://example.com#website",
            "@type": "WebSite",
            "name": "test",
            "url": "https://example.com",
            "publisher": {
              "@id": "https://example.com#identity"
            }
          }
        ]
      }</script>"
    `)
  })

  it('faq', async () => {
    const ssrHead = createHead()

    useHead({
      templateParams: {
        schemaOrg: {
          path: '/about',
          host: 'https://example.com',
        },
      },
    })

    useSchemaOrg([
      defineWebPage({
        '@type': 'FAQPage',
      }),
      defineQuestion({
        name: 'What is your return policy?',
        acceptedAnswer: 'Most unopened items in new condition and returned within 90 days will receive a refund or exchange.',
      }),
      defineQuestion({
        name: 'What is something else?',
        acceptedAnswer: 'Something else',
      }),
    ])
    const data = await renderSSRHead(ssrHead)
    expect(data.bodyTags).toMatchInlineSnapshot(`
      "<script type="application/ld+json" data-hid="3437552">{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": "https://example.com/about#webpage",
            "url": "https://example.com/about",
            "@type": [
              "WebPage",
              "FAQPage"
            ],
            "mainEntity": [
              {
                "@id": "https://example.com/about#/schema/question/ab1c398"
              },
              {
                "@id": "https://example.com/about#/schema/question/6396da9"
              }
            ]
          },
          {
            "@id": "https://example.com/about#/schema/question/ab1c398",
            "@type": "Question",
            "name": "What is your return policy?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Most unopened items in new condition and returned within 90 days will receive a refund or exchange."
            }
          },
          {
            "@id": "https://example.com/about#/schema/question/6396da9",
            "@type": "Question",
            "name": "What is something else?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Something else"
            }
          }
        ]
      }</script>"
    `)
  })

  it('many registrations', async () => {
    const ssrHead = createHead()
    useSchemaOrg([
      defineWebPage({
        name: 'One',
      }),
    ])
    useSchemaOrg([
      defineWebPage({
        name: 'Two',
      }),
    ])
    useSchemaOrg([
      defineWebPage({
        name: 'Three',
      }),
    ])
    const data = await renderSSRHead(ssrHead)
    expect(data.bodyTags).toMatchInlineSnapshot(`
      "<script type="application/ld+json" data-hid="3437552">{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@id": "#webpage",
            "@type": "WebPage",
            "name": "Three"
          }
        ]
      }</script>"
    `)
  })
})
