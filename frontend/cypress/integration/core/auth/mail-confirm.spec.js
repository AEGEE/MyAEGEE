// / <reference types="cypress" />

context('Mail confirmation', () => {
  beforeEach(() => {
    cy.resetDatabase()
    cy.visit('/confirm_signup')
  })

  it('should complain if the token is not found', () => {
    cy.get('[data-cy=token]').type('not-existant')
    cy.get('button').contains('Confirm your email').click()

    cy.contains('The token is invalid')
  })

  it('should complain on server errors', () => {
    cy.server()
    cy.route({
      method: 'POST',
      url: /confirm-email$/,
      response: 'Some garbage',
      status: 500
    })

    cy.get('[data-cy=token]').type('5ecr3t')
    cy.get('button').contains('Confirm your email').click()

    cy.contains('Could not confirm email')
  })

  it('should prefill token if provided', () => {
    cy.visit('/confirm_signup?token=5ecr3t')
    cy.get('button').contains('Confirm your email').click()

    cy.contains('Your email is verified.')
    cy.url().should('include', '/login')
  })

  it('should succeed if everything is okay', () => {
    cy.get('[data-cy=token]').type('5ecr3t')
    cy.get('button').contains('Confirm your email').click()

    cy.contains('Your email is verified.')
    cy.url().should('include', '/login')
  })
})
