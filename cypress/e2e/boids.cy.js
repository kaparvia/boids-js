describe('Test 1', () => {
  it('Visits Boids', () => {
    cy.visit('index.html')
  })
  
  it('Clicks pause button', () => {
  	cy.get('button#pausePlay').should("have.text", "Pause")
  	cy.get('button#pausePlay').click()
  	cy.get('button#pausePlay').should("have.text", "Play")
  })
})