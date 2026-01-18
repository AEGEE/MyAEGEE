import * as types from '../mutation-types'
import { validate } from '../../validate-user'

const state = {
  isLoggedIn: false,
  user: null,
  isValid: true,
  validationErrors: {},
  permissions: []
}

const mutations = {
  [types.LOGIN] (newState) {
    newState.isLoggedIn = true
  },
  [types.SET_USER] (newState, user) {
    newState.isLoggedIn = true
    newState.user = user

    newState.validationErrors = validate(user)
    newState.isValid = (Object.keys(newState.validationErrors).length === 0)
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
