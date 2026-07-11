import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './App'

test('menampilkan bottom nav dengan 4 tab', () => {
  render(
    <MemoryRouter initialEntries={['/lainnya']}>
      <AppShell />
    </MemoryRouter>,
  )
  const nav = screen.getByRole('navigation', { name: 'Navigasi utama' })
  expect(nav).toBeInTheDocument()
  for (const label of ['Jual', 'Stok', 'Rekap', 'Lainnya']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})
