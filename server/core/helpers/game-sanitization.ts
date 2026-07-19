import sanitizeHtml from 'sanitize-html'

export function sanitizeGameDescription (value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'code', 'pre'
    ],
    allowedAttributes: {
      a: [ 'href', 'target', 'rel' ]
    },
    allowedSchemes: [ 'http', 'https', 'mailto' ],
    transformTags: {
      h1: 'h3',
      h2: 'h3'
    },
    exclusiveFilter: (frame: { tag: string, attribs: Record<string, string>, text: string }) => {
      // Block empty or whitespace-only elements
      return frame.text.trim().length === 0 && !['br', 'hr', 'img'].includes(frame.tag)
    }
  }).trim()
}

export function sanitizeGameTitle (value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim()
}
