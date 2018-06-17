import * as types from '../../mutation-types'
import lazyLoading from './lazyLoading'

import categories from '../../components'

// menuModule.state.items (imported from '../../components' above) should be an array of elements containing these fields:
//
// categoryName: name of the category (for label in the sidebar)
// components: array of components for vue-router having this structure:
// -- name: component name
// -- path: component path
// -- component: the path to the component relative to client/views/ and without extension
// -- children: the array of the child elements containing the same fields.
// Children cannot have another children (because menu is only 2 levels deep).
// -- meta: the optional object for component storing meta information and having these fields:
// -- meta.icon: the icon (FontAwesome one) for sidebar
// -- meta.auth: if set to false, the user can go to this route unauthorized and the user fetching is skipped
// -- meta.skipMenu: if set to true, this item won't be displayed in the sidebar (but will be available as a route)
// -- meta.skipLazyLoad: if set to true, the item would be imported with 'require', not 'lazyLoading', loading it with all the bundle
//
// Keep in mind that if the component has children it must contain the <router-view> tag to display it
// within itself.

const mapComponent = (component, nested = false) => ({
  name: component.name,
  path: component.path,
  meta: {
    auth: (component.meta && typeof component.meta.auth !== 'undefined') ? component.meta.auth : true,
    icon: (component.meta && typeof component.meta.icon !== 'undefined') ? component.meta.icon : null,
    skipMenu: (component.meta && typeof component.meta.skipMenu !== 'undefined') ? component.meta.skipMenu : false,
    skipLazyLoad: (component.meta && typeof component.meta.skipLazyLoad !== 'undefined') ? component.meta.skipLazyLoad : false,
    expanded: (component.meta && typeof component.meta.expanded !== 'undefined') ? component.meta.expanded : false
  },
  component: component.meta && component.meta.skipLazyLoad ? require(`views/${component.component}.vue`) : lazyLoading(component.component),
  children: (component.children && !nested) ? component.children.map(mapComponent, true) : null
})

const mapCategory = category => ({
  categoryName: category.categoryName,
  components: category.components.map(component => mapComponent(component))
})

const state = {
  items: categories.map(mapCategory)
}

const mutations = {
  [types.EXPAND_MENU] (state, menuItem) {
    if (menuItem.index > -1 && menuItem.categoryIndex > -1) {
      if (state.items[menuItem.categoryIndex].components[menuItem.index]) {
        state.items[menuItem.categoryIndex].components[menuItem.index].meta.expanded = menuItem.expanded
      }
    } else if (menuItem.item && 'expanded' in menuItem.item.meta) {
      menuItem.item.meta.expanded = menuItem.expanded
    }
  }
}

export default {
  state,
  mutations
}
