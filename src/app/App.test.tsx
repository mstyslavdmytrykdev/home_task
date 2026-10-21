import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('renders the application', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Venn onboarding', level: 1 })).toBeVisible()
})
