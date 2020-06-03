// / <reference types="cypress" />

context('Members list', () => {
  beforeEach(() => {
    cy.resetDatabase()
    cy.login()
    cy.visit('/members')
  })

  it('should display users', () => {
    cy.get('table thead tr').should('have.length', 1)
    cy.get('table tbody tr').its('length').should('be.gt', 1)
  })

  it('should display an error on network error', () => {
    cy.server()
    cy.route({
      method: 'GET',
      url: /api\/core\/members(\?)/,
      response: 'Some garbage',
      status: 500
    })

    cy.visit('/members')
    cy.contains('Could not fetch user list')
  })

  it('should display a stub if no users', () => {
    cy.server()
    cy.route({
      method: 'GET',
      url: /api\/core\/members/,
      response: { success: true, data: [] },
      status: 200
    })

    cy.visit('/members')
    cy.contains('Nothing here')
  })

  it('should paginate', () => {
    cy.server()
    cy.route({
      method: 'GET',
      url: /api\/core\/members/,
      response: {
        success: true,
        data: Array(30).fill().map(() => ({
          email: 'test@example.com',
          first_name: 'test',
          last_name: 'test',
          about_me: 'test',
          address: 'test'
        }))
      },
      status: 200
    }).as('membersList')

    cy.visit('/members')
    cy.contains('test@example.com')
    cy.get('table tbody tr').its('length').should('be.eq', 30)
    cy.contains('Load more users').click()
    cy.get('table tbody tr').its('length').should('be.eq', 60)
  })

  it('should filter', () => {
    cy.get('[data-cy=query]').type('admin@example.com')
    cy.get('table tbody tr').its('length').should('be.eq', 1)
  })
})
