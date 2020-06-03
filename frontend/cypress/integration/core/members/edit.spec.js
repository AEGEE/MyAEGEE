// / <reference types="cypress" />

context('Members editing', () => {
  beforeEach(() => {
    cy.resetDatabase()
    cy.login()
    cy.visit('/members/me/edit')
  })

  it('should redirect if the user is not found', () => {
    cy.visit('/members/not-existant/edit')
    cy.contains('User is not found')
    cy.url().should('match', /\/members$/)
  })

  it('should complain if the data is invalid', () => {
    cy.get('[data-cy=first_name]').clear().type('admin2')
    cy.contains('Save user').click()

    cy.contains('Some of the user data is invalid.')
  })

  it('should complain on error when loading user', () => {
    cy.server()
    cy.route({
      method: 'GET',
      url: /api\/core\/members\/admin/,
      response: 'Some garbage',
      status: 500
    })

    cy.visit('/members/admin/edit')
    cy.contains('Some error happened')
    cy.url().should('match', /\/members$/)
  })

  it('should complain on error when saving user', () => {
    cy.server()
    cy.route({
      method: 'PUT',
      url: /api\/core\/members\/me/,
      response: 'Some garbage',
      status: 500
    })

    cy.get('[data-cy=first_name]').clear().type('new')
    cy.contains('Save user').click()

    cy.contains('Could not save user')
  })


  it('should save user is all is correct', () => {
    cy.viewport(1024, 768) // to be not tablet size, so date_of_birth won't be a popup

    cy.get('[data-cy=first_name]').clear().type('new')
    cy.get('[data-cy=last_name]').clear().type('new')
    cy.get('[data-cy=username]').clear().type('new')
    cy.get('[data-cy=phone]').clear().type('new')

    cy.typeDate('[data-cy=date_of_birth]', '1973-02-02')

    cy.get('[data-cy=gender]').clear().type('new')
    cy.get('[data-cy=address]').clear().type('new')
    cy.get('[data-cy=about_me]').clear().type('new')
    cy.contains('Save user').click()

    cy.contains('User is saved.')

    cy.get('[data-cy=first_name]').contains('new')
    cy.get('[data-cy=last_name]').contains('new')
    cy.get('[data-cy=username]').contains('new')
    cy.get('[data-cy=phone]').contains('new')
    cy.get('[data-cy=date_of_birth]').contains('1973-02-02')
    cy.get('[data-cy=gender]').contains('new')
    cy.get('[data-cy=address]').contains('new')
    cy.get('[data-cy=about_me]').contains('new')
  })
})
