import { isIE } from '../../../../core/test/specHelper'
import { IGNORED_NODE_ID } from './serializationUtils'
import { serializeNodeWithId } from './serialize'

describe('serializeNodeWithId', () => {
  describe('ignores some nodes', () => {
    const defaultOptions = {
      doc: document,
      map: {},
    }

    beforeEach(() => {
      if (isIE()) {
        pending('IE not supported')
      }
    })

    it('does not save ignored nodes in the map', () => {
      const map = {}
      serializeNodeWithId(document.createElement('script'), { ...defaultOptions, map })
      expect(map).toEqual({})
    })

    it('sets ignored serialized node id to IGNORED_NODE_ID', () => {
      const scriptElement = document.createElement('script')
      serializeNodeWithId(scriptElement, defaultOptions)
      expect((scriptElement as any).__sn).toEqual(jasmine.objectContaining({ id: IGNORED_NODE_ID }))
    })

    it('ignores script tags', () => {
      expect(serializeNodeWithId(document.createElement('script'), defaultOptions)).toEqual(null)
    })

    it('ignores comments', () => {
      expect(serializeNodeWithId(document.createComment('foo'), defaultOptions)).toEqual(null)
    })

    it('ignores link favicons', () => {
      const linkElement = document.createElement('link')
      linkElement.setAttribute('rel', 'shortcut icon')
      expect(serializeNodeWithId(linkElement, defaultOptions)).toEqual(null)
    })

    it('ignores meta keywords', () => {
      const metaElement = document.createElement('meta')
      metaElement.setAttribute('name', 'keywords')
      expect(serializeNodeWithId(metaElement, defaultOptions)).toEqual(null)
    })

    it('ignores meta name attribute casing', () => {
      const metaElement = document.createElement('meta')
      metaElement.setAttribute('name', 'KeYwOrDs')
      expect(serializeNodeWithId(metaElement, defaultOptions)).toEqual(null)
    })
  })
})
