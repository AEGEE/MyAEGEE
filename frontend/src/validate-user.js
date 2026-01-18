const RESTRICTED_EMAILS = ['aegee.org', 'aegee.eu']

// TODO: Remove 'other' and find a different way to allow non-AEGEEans in the system (Secretariat, but maybe also Honorary Members and Les Anciens until they can be anciens in their own body)
const ALLOWED_BODY_TYPES = ['antenna', 'contact antenna', 'contact', 'external', 'other']

const validate = (user) => {
  if (user.superadmin) {
    return {}
  }

  const errorsMap = {}
  if (RESTRICTED_EMAILS.some(email => user.email.endsWith(email))) {
    errorsMap.email = 'Your email can not be in one of the following domains: ' + RESTRICTED_EMAILS.join(', ').trim() + '.'
  }

  if (!user.bodies.some(body => ALLOWED_BODY_TYPES.includes(body.type))) {
    errorsMap.bodies = 'You should be a member of at least 1 local.'
  }

  if (!user.privacy_consent) {
    errorsMap.privacy = 'You should agree to the Privacy Policy.'
  }

  if (!user.username.match(/^(?![0-9._-]*$)[a-zA-Z0-9._-]+$/)) {
    errorsMap.username = 'Your username cannot consist of numbers only.'
  }

  return errorsMap
}

export {
  validate,
  RESTRICTED_EMAILS,
  ALLOWED_BODY_TYPES
}
