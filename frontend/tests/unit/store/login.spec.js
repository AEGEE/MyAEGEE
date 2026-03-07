/* eslint-env jest */

import * as types from 'src/store/mutation-types'
import loginModule from 'src/store/modules/login'

describe('login store module', () => {
  function cloneState () {
    return {
      isLoggedIn: false,
      user: null,
      isValid: true,
      validationErrors: {},
      permissions: []
    }
  }

  test('LOGIN only marks the user as logged in', () => {
    const state = cloneState()

    loginModule.mutations[types.LOGIN](state)

    expect(state.isLoggedIn).toEqual(true)
    expect(state.user).toEqual(null)
  })

  test('SET_USER stores a valid user and marks it valid', () => {
    const state = cloneState()
    const user = {
      superadmin: false,
      email: 'member@example.org',
      bodies: [{ type: 'antenna' }],
      privacy_consent: true,
      username: 'valid_user'
    }

    loginModule.mutations[types.SET_USER](state, user)

    expect(state.isLoggedIn).toEqual(true)
    expect(state.user).toEqual(user)
    expect(state.validationErrors).toEqual({})
    expect(state.isValid).toEqual(true)
  })

  test('SET_USER stores validation errors for an invalid user', () => {
    const state = cloneState()
    const user = {
      superadmin: false,
      email: 'member@aegee.org',
      bodies: [{ type: 'committee' }],
      privacy_consent: false,
      username: '12345'
    }

    loginModule.mutations[types.SET_USER](state, user)

    expect(state.isValid).toEqual(false)
    expect(state.validationErrors).toEqual(expect.objectContaining({
      email: expect.any(String),
      bodies: expect.any(String),
      privacy: expect.any(String),
      username: expect.any(String)
    }))
  })

  test('SET_PERMISSIONS replaces the permissions list', () => {
    const state = cloneState()

    loginModule.mutations[types.SET_PERMISSIONS](state, ['view:member'])

    expect(state.permissions).toEqual(['view:member'])
  })

  test('LOGOUT clears login state but leaves validation and permissions untouched', () => {
    const state = {
      isLoggedIn: true,
      user: { id: 1 },
      isValid: false,
      validationErrors: { email: 'bad' },
      permissions: ['view:member']
    }

    loginModule.mutations[types.LOGOUT](state)

    expect(state.isLoggedIn).toEqual(false)
    expect(state.user).toEqual(null)
    expect(state.isValid).toEqual(false)
    expect(state.validationErrors).toEqual({ email: 'bad' })
    expect(state.permissions).toEqual(['view:member'])
  })
})
