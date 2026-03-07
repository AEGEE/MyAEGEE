export { createAxiosMock } from '../test-utils'

import { mountFrontendView } from '../test-utils'

export function mountDiscountsView (component, options = {}) {
  return mountFrontendView(component, options)
}
