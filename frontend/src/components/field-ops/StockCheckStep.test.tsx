import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StockCheckStep from './StockCheckStep'
import StoreQuestionsStep from './StoreQuestionsStep'
import { EMPTY_STORE_ANSWERS, type StockEntry } from '../../utils/product-audit'

const PRODUCTS = ['HALLS CHERRY 72 X 48', 'OREO ORIGINAL LUP 41.57G']

describe('StockCheckStep', () => {
  it('lists every configured product with a Yes/No and no default answer', () => {
    render(<StockCheckStep products={PRODUCTS} value={[]} onChange={() => {}} />)
    for (const p of PRODUCTS) expect(screen.getByText(new RegExp(p))).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'No' })).toHaveLength(2)
    expect(screen.getByText('0 of 2 answered')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Why not/)).not.toBeInTheDocument()
  })

  it('emits the entry in configured order and opens "why not" only for a No', () => {
    const onChange = vi.fn()
    const value: StockEntry[] = [{ product: PRODUCTS[1], stock: 'Yes', why_not: '' }]
    render(<StockCheckStep products={PRODUCTS} value={value} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'No' })[0])
    expect(onChange).toHaveBeenCalledWith([
      { product: PRODUCTS[0], stock: 'No', why_not: '' },
      { product: PRODUCTS[1], stock: 'Yes', why_not: '' },
    ])
  })

  it('shows the why-not box under a product marked No and forwards the reason', () => {
    const onChange = vi.fn()
    const value: StockEntry[] = [{ product: PRODUCTS[0], stock: 'No', why_not: '' }]
    render(<StockCheckStep products={PRODUCTS} value={value} onChange={onChange} />)
    const why = screen.getByLabelText(/Why not/)
    fireEvent.change(why, { target: { value: 'Not listed by wholesaler' } })
    expect(onChange).toHaveBeenCalledWith([{ product: PRODUCTS[0], stock: 'No', why_not: 'Not listed by wholesaler' }])
  })

  it('flags what is still missing when validation is shown', () => {
    render(<StockCheckStep products={PRODUCTS} value={[{ product: PRODUCTS[0], stock: 'No', why_not: '' }]} onChange={() => {}} showValidation />)
    expect(screen.getByText(/1 still unanswered/)).toBeInTheDocument()
    expect(screen.getByText('Please say why this product is not stocked')).toBeInTheDocument()
  })

  it('warns instead of rendering rows when no products are configured', () => {
    render(<StockCheckStep products={[]} value={[]} onChange={() => {}} />)
    expect(screen.getByText(/No products are configured/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })
})

describe('StoreQuestionsStep', () => {
  it('opens the matching delivery follow-up for Yes and for No', () => {
    const { rerender } = render(<StoreQuestionsStep value={{ ...EMPTY_STORE_ANSWERS, deliveries: 'No' }} onChange={() => {}} />)
    expect(screen.getByLabelText(/how do they get their stock/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/what products are delivered/i)).not.toBeInTheDocument()

    rerender(<StoreQuestionsStep value={{ ...EMPTY_STORE_ANSWERS, deliveries: 'Yes' }} onChange={() => {}} />)
    expect(screen.getByLabelText(/what products are delivered/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/how do they get their stock/i)).not.toBeInTheDocument()
  })

  it('forwards each answer merged onto the current value', () => {
    const onChange = vi.fn()
    render(<StoreQuestionsStep value={EMPTY_STORE_ANSWERS} onChange={onChange} />)
    // First Yes button belongs to "Does a rep visit this store?"
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes' })[0])
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_STORE_ANSWERS, rep_visits: 'Yes' })
    fireEvent.change(screen.getByLabelText(/biggest challenge/i), { target: { value: 'Shelf space' } })
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_STORE_ANSWERS, biggest_challenge: 'Shelf space' })
  })

  it('keeps "other delivery issues" optional in the validation banner', () => {
    render(<StoreQuestionsStep value={{ rep_visits: 'Yes', deliveries: 'No', delivery_method: 'Collects', delivered_products: '', biggest_challenge: 'Price', other_delivery_issues: '' }} onChange={() => {}} showValidation />)
    expect(screen.queryByText(/Please answer every required question/)).not.toBeInTheDocument()
  })
})
