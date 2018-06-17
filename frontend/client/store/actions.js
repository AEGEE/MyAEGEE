import * as types from './mutation-types'

export const toggleSidebar = ({ commit }, config) => {
  if (config instanceof Object) {
    commit(types.TOGGLE_SIDEBAR, config)
  }
}

export const toggleDevice = ({ commit }, device) => commit(types.TOGGLE_DEVICE, device)

export const expandMenu = ({ commit }, menuItem) => {
  if (menuItem) {
    menuItem.expanded = menuItem.expanded || false
    commit(types.EXPAND_MENU, menuItem)
  }
}

export const switchEffect = ({ commit }, effectItem) => {
  if (effectItem) {
    commit(types.SWITCH_EFFECT, effectItem)
  }
}

export const login = ({ commit }) => {
  commit(types.LOGIN)
}

export const setUser = ({ commit }, user) => {
  if (user) {
    commit(types.SET_USER, user)
  }
}

export const logout = ({ commit }) => {
  commit(types.LOGOUT)
}
