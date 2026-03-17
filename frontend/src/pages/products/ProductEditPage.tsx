import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TransactionForm from '../../components/transactions/TransactionForm'
import { productsService } from '../../services/products.service'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function ProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<any>(null)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [productRes, productsData] = await Promise.all([
        productsService.getProduct(id!),
        productsService.getProducts()
      ])
      setProduct(productRes)
      setCategories(productsData.categories || [])
      setBrands(productsData.brands || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      name: 'code',
      label: 'Product Code',
      type: 'text' as const,
      required: true,
      disabled: true
    },
    {
      name: 'name',
      label: 'Product Name',
      type: 'text' as const,
      required: true
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea' as const
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
      required: true
    },
    {
      name: 'selling_price',
      label: 'Selling Price',
      type: 'number' as const,
      required: true
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
      type: 'number' as const
    },
    {
      name: 'max_stock_level',
      label: 'Maximum Stock Level',
      type: 'number' as const
    },
    {
      name: 'tax_rate',
      label: 'Tax Rate (%)',
      type: 'number' as const
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'discontinued', label: 'Discontinued' }
      ]
    }
  ]

  const handleSubmit = async (data: any) => {
    try {
      await productsService.updateProduct(id!, data)
      navigate(`/products/${id}`)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update product')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!product) {
    return <ErrorState title="Product not found" message="The product you are looking for does not exist or has been deleted." />
  }

  return (
    <TransactionForm
      title={`Edit Product ${product.code || product.name}`}
      fields={fields}
      initialData={product}
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/products/${id}`)}
      submitLabel="Update Product"
    />
  )
}
