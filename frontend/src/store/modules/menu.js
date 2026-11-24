import * as types from '../mutation-types'
import categories from '../../menu'

// menuModule.state.items (imported from '../../components' above) should be an array of elements containing these fields:
//
// categoryName: name of the category (for label in the sidebar)
// auth: 'not-logged-in'|'logged-in'|null - displaying the entry if the user is not logged in, logged in or whatever.
// components: array of components for vue-router having this structure:
// -- name: component name
// -- path: component path
// -- params: params object.
// -- auth: 'not-logged-in'|'logged-in'|null - displaying the entry if the user is not logged in, logged in or whatever.
// -- component: the path to the component relative to client/views/ and without extension
// -- children: the array of the child elements containing the same fields.
// Children cannot have another children (because menu is only 2 levels deep).
// -- label: the label that would be displayed in sidebar and as the name
// -- icon: the icon (FontAwesome one) for sidebar
// -- permissions: the array of permissions required for that menu entry to be displayed. If empty, the menu entry will always be displayed.
//
// Keep in mind that if the component has children it must contain the <router-view> tag to display it
// within itself.

const mapComponent = (component, nested = false) => ({
  name: component.name,
  path: component.path,
  label: component.label,
  link: component.link,
  auth: component.auth,
  params: component.params || '',
  icon: typeof component.icon !== 'undefined' ? component.icon : null,
  // Every group starts closed; the sidebar opens the group of the page that is shown.
  expanded: false,
  permissions: Array.isArray(component.permissions) ? component.permissions : null,
  children: (component.children && !nested) ? component.children.map(child => mapComponent(child, true)) : null
})

const mapCategory = category => ({
  categoryName: category.categoryName,
  auth: category.auth,
  components: category.components.map(component => mapComponent(component))
})

const state = {
  items: categories.map(mapCategory)
}

const mutations = {
  // Opens or closes the group at `index` of the category at `categoryIndex`.
  [types.EXPAND_MENU] (newState, { index, categoryIndex, expanded }) {
    newState.items[categoryIndex].components[index].expanded = expanded
  }
}

export default {
  state,
  mutations
}
