import * as types from '../mutation-types'

const state = {
  isLoggedIn: false,
  user: null,
  permissions: []
}

const mutations = {
  [types.LOGIN] (newState) {
    newState.isLoggedIn = true
  },
  [types.SET_USER] (newState, user) {
    newState.isLoggedIn = true
    newState.user = user
  },
  [types.SET_PERMISSIONS] (newState, permissions) {
    newState.permissions = permissions
  },
  [types.LOGOUT] (newState) {
    newState.isLoggedIn = false
    newState.user = null
  }
}

export default {
  state,
  mutations
}
