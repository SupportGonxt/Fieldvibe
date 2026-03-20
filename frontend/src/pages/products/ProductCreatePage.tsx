import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TransactionForm from '../../components/transactions/TransactionForm'
import { productsService } from '../../services/products.service'

export default function ProductCreatePage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      const [cats, brnds] = await Promise.all([
        productsService.getCategories(),
        productsService.getBrands()
      ])
      setCategories(cats || [])
      setBrands(brnds || [])
    } catch (error) {
      console.error('Failed to load form data:', error)
    }
  }

  const fields = [
    {
      name: 'code',
      label: 'Product Code',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., PROD001'
    },
    {
      name: 'name',
      label: 'Product Name',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Coca Cola 500ml'
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea' as const,
      placeholder: 'Product description...'
    },
    {
      name: 'category_id',
      label: 'Category',
      type: 'select' as const,
      required: true,
      options: categories.map((c: any) => ({
        value: c.id,
        label: c.name
      }))
    },
    {
      name: 'brand_id',
      label: 'Brand',
      type: 'select' as const,
      required: true,
      options: brands.map((b: any) => ({
        value: b.id,
        label: b.name
      }))
    },
    {
      name: 'cost_price',
      label: 'Cost Price',
      type: 'number' as const,
      required: true,
      placeholder: 'e.g., 10.50'
    },
    {
      name: 'selling_price',
      label: 'Selling Price',
      type: 'number' as const,
      required: true,
      placeholder: 'e.g., 15.00'
    },
    {
      name: 'unit_of_measure',
      label: 'Unit of Measure',
      type: 'text' as const,
      placeholder: 'e.g., Each, Box, Carton'
    },
    {
      name: 'min_stock_level',
      label: 'Minimum Stock Level',
      type: 'number' as const,
      placeholder: 'e.g., 10'
    },
    {
      name: 'max_stock_level',
      label: 'Maximum Stock Level',
      type: 'number' as const,
      placeholder: 'e.g., 100'
    },
    {
      name: 'tax_rate',
      label: 'Tax Rate (%)',
      type: 'number' as const,
      placeholder: 'e.g., 15'
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await productsService.createProduct(data)
      navigate('/products')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create product')
    }
  }

  return (
    <TransactionForm
      title="Create Product"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/products')}
      submitLabel="Create Product"
    />
  )
}
