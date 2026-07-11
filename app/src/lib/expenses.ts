import { supabase } from './supabase'
import type { ExpenseCategory } from './reports'

export type ExpenseRow = {
  id: string
  spent_at: string
  category: ExpenseCategory
  amount: number
  note: string | null
}

export async function fetchExpensesOn(dateStr: string): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, spent_at, category, amount, note')
    .eq('spent_at', dateStr)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ExpenseRow[]
}

export async function addExpense(input: {
  spentAt: string
  category: ExpenseCategory
  amount: number
  note: string | null
}): Promise<void> {
  const { error } = await supabase.from('expenses').insert({
    spent_at: input.spentAt,
    category: input.category,
    amount: input.amount,
    note: input.note,
  })
  if (error) throw error
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}
