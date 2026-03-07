/* eslint-env jest */

import { validate } from 'src/validate-user'

describe('validate user', () => {
  test('allows superadmins without further checks', () => {
    expect(validate({ superadmin: true })).toEqual({})
  })

  test('rejects restricted email domains', () => {
    expect(validate({
      superadmin: false,
      email: 'member@aegee.org',
      bodies: [{ type: 'antenna' }],
      privacy_consent: true,
      username: 'valid_user'
    })).toEqual(expect.objectContaining({
      email: expect.stringContaining('aegee.org')
    }))
  })

  test('requires a membership in an allowed body type', () => {
    expect(validate({
      superadmin: false,
      email: 'member@example.org',
      bodies: [{ type: 'committee' }],
      privacy_consent: true,
      username: 'valid_user'
    })).toEqual(expect.objectContaining({
      bodies: 'You should be a member of at least 1 local.'
    }))
  })

  test('requires privacy consent', () => {
    expect(validate({
      superadmin: false,
      email: 'member@example.org',
      bodies: [{ type: 'antenna' }],
      privacy_consent: false,
      username: 'valid_user'
    })).toEqual(expect.objectContaining({
      privacy: 'You should agree to the Privacy Policy.'
    }))
  })

  test('rejects numeric-only usernames and allows mixed usernames', () => {
    expect(validate({
      superadmin: false,
      email: 'member@example.org',
      bodies: [{ type: 'antenna' }],
      privacy_consent: true,
      username: '12345'
    })).toEqual(expect.objectContaining({
      username: 'Your username cannot consist of numbers only.'
    }))

    expect(validate({
      superadmin: false,
      email: 'member@example.org',
      bodies: [{ type: 'antenna' }],
      privacy_consent: true,
      username: 'user_123'
    })).toEqual({})
  })
})
