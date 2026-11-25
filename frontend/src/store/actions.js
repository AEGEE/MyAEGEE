import * as types from './mutation-types'

export const toggleSidebar = ({ commit }, config) => commit(types.TOGGLE_SIDEBAR, config)

export const toggleNavbarMenu = ({ commit }, config) => commit(types.TOGGLE_NAVBAR_MENU, config)

export const toggleDevice = ({ commit }, device) => commit(types.TOGGLE_DEVICE, device)

export const expandMenu = ({ commit }, menuItem) => commit(types.EXPAND_MENU, menuItem)

export const login = ({ commit }) => {
  commit(types.LOGIN)
}

export const setUser = ({ commit }, user) => {
  commit(types.SET_USER, user)
}

export const setPermissions = ({ commit }, permissions) => {
  commit(types.SET_PERMISSIONS, permissions)
}

export const logout = ({ commit }) => {
  commit(types.LOGOUT)
}
