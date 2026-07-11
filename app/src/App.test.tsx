import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

test('menampilkan bottom nav dengan 4 tab', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  const nav = screen.getByRole('navigation', { name: 'Navigasi utama' })
  expect(nav).toBeInTheDocument()
  for (const label of ['Jual', 'Stok', 'Rekap', 'Lainnya']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})
