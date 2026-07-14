/**
 * Mobile-First Van Sales Workflow
 * 
 * Flow:
 * 1. Customer Selection
 * 2. GPS Validation
 * 3. Product Selection & Order Creation
 * 4. Delivery & Photo Capture
 * 5. Payment & Completion
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Store, 
  MapPin, 
  Package, 
  Camera,
  DollarSign,
  CheckCircle,
  Search,
  Plus,
  Minus,
  Trash2,
  AlertCircle
} from 'lucide-react'
import { apiClient } from '../../services/api.service'
import MobileWorkflowLayout from '../../components/mobile/MobileWorkflowLayout'
import MobileCard from '../../components/mobile/MobileCard'
import MobileButton from '../../components/mobile/MobileButton'
import MobileInput from '../../components/mobile/MobileInput'
import GPSCapture from '../../components/mobile/GPSCapture'
import CameraCapture from '../../components/mobile/CameraCapture'

interface Customer {
  id: string
  name: string
  address: string
  phone: string
  credit_limit: number
  outstanding_balance: number
  latitude: number
  longitude: number
}

interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock_quantity: number
}

interface OrderItem {
  product_id: string
  product_name: string
  quantity: number
  price: number
  total: number
}

const steps = [
  'Customer',
  'GPS Check',
  'Products',
  'Delivery',
  'Complete'
]

export default function VanSalesWorkflowPageMobile() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsValidated, setGpsValidated] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState('')

  const [deliveryPhoto, setDeliveryPhoto] = useState<string | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash')
  const [cashReceived, setCashReceived] = useState<number>(0)

  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderTotal, setOrderTotal] = useState(0)

  useEffect(() => {
    if (activeStep === 0) {
      loadCustomers()
    } else if (activeStep === 2) {
      loadProducts()
    }
  }, [activeStep])

  useEffect(() => {
    const total = orderItems.reduce((sum, item) => sum + item.total, 0)
    setOrderTotal(total)
  }, [orderItems])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/customers?limit=100')
      const data = response.data.data?.customers || response.data.data || response.data || []
      setCustomers(data)
    } catch (err) {
      console.error('Error loading customers:', err)
      setError('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/products?limit=100')
      const data = response.data.data?.products || response.data.data || response.data || []
      setProducts(data)
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = async () => {
    setError(null)

    if (activeStep === 0) {
      if (!selectedCustomer) {
        setError('Please select a customer')
        return
      }
    }

    if (activeStep === 1) {
      if (!gpsValidated) {
        setError('Please validate your GPS location')
        return
      }
    }

    if (activeStep === 2) {
      if (orderItems.length === 0) {
        setError('Please add at least one product to the order')
        return
      }
      await createOrder()
    }

    if (activeStep === 3) {
      if (!deliveryPhoto) {
        setError('Please capture a delivery photo')
        return
      }
    }

    if (activeStep === 4) {
      navigate('/van-sales')
      return
    }

    setActiveStep(prev => prev + 1)
  }

  const handleBack = () => {
    setError(null)
    setActiveStep(prev => prev - 1)
  }

  const handleLocationCaptured = (latitude: number, longitude: number) => {
    setGpsLocation({ lat: latitude, lng: longitude })
    
    if (selectedCustomer && selectedCustomer.latitude && selectedCustomer.longitude) {
      const distance = calculateDistance(
        latitude,
        longitude,
        selectedCustomer.latitude,
        selectedCustomer.longitude
      )
      
      if (distance <= 50) {
        setGpsValidated(true)
        setError(null)
      } else {
        setGpsValidated(false)
        setError(`You are ${Math.round(distance)}m away. Please move within 50m of the customer.`)
      }
    } else {
      setGpsValidated(true)
    }
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  const handleAddProduct = (product: Product) => {
    const existingItem = orderItems.find(item => item.product_id === product.id)
    
    if (existingItem) {
      setOrderItems(prev =>
        prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        )
      )
    } else {
      setOrderItems(prev => [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          price: product.price,
          total: product.price,
        },
      ])
    }
  }

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setOrderItems(prev =>
      prev
        .map(item => {
          if (item.product_id === productId) {
            const newQuantity = item.quantity + delta
            if (newQuantity <= 0) return null
            return {
              ...item,
              quantity: newQuantity,
              total: newQuantity * item.price,
            }
          }
          return item
        })
        .filter(Boolean) as OrderItem[]
    )
  }

  const handleRemoveProduct = (productId: string) => {
    setOrderItems(prev => prev.filter(item => item.product_id !== productId))
  }

  const createOrder = async () => {
    setLoading(true)
    try {
      const orderData = {
        customer_id: selectedCustomer?.id,
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
        })),
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng,
        payment_method: paymentMethod,
      }

      const response = await apiClient.post('/orders', orderData)
      const newOrderId = response.data.data?.id || response.data.id
      setOrderId(newOrderId)
    } catch (err) {
      console.error('Error creating order:', err)
      setError('Failed to create order')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
  )

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className="space-y-4">
            <MobileInput
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-5 w-5" />}
            />
            <div className="space-y-2">
              {filteredCustomers.map(customer => (
                <MobileCard
                  key={customer.id}
                  selected={selectedCustomer?.id === customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <div className="flex items-start gap-3">
                    <Store className="h-5 w-5 text-gray-400 mt-1" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.address}</p>
                      <p className="text-sm text-gray-600">{customer.phone}</p>
                      <div className="flex gap-4 mt-2">
                        <div>
                          <p className="text-xs text-gray-500">Credit Limit</p>
                          <p className="text-sm font-medium">${customer.credit_limit?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Outstanding</p>
                          <p className="text-sm font-medium text-red-600">${customer.outstanding_balance?.toFixed(2) || '0.00'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </MobileCard>
              ))}
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-4">
            <GPSCapture
              onLocationCaptured={handleLocationCaptured}
              targetLatitude={selectedCustomer?.latitude}
              targetLongitude={selectedCustomer?.longitude}
              radiusMeters={50}
              showValidation={!!selectedCustomer}
            />
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <MobileInput
              placeholder="Search products..."
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
              icon={<Search className="h-5 w-5" />}
            />

            {orderItems.length > 0 && (
              <MobileCard>
                <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
                <div className="space-y-2">
                  {orderItems.map(item => (
                    <div key={item.product_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        <p className="text-sm text-gray-600">${item.price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.product_id, -1)}
                          className="p-1 bg-gray-100 rounded touch-manipulation"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.product_id, 1)}
                          className="p-1 bg-gray-100 rounded touch-manipulation"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveProduct(item.product_id)}
                          className="p-1 bg-red-100 text-red-600 rounded touch-manipulation ml-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-info-600">${orderTotal.toFixed(2)}</span>
                  </div>
                </div>
              </MobileCard>
            )}

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Available Products</h3>
              {filteredProducts.map(product => (
                <MobileCard key={product.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                      <p className="text-sm font-medium text-info-600">${product.price.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Stock: {product.stock_quantity}</p>
                    </div>
                    <MobileButton
                      onClick={() => handleAddProduct(product)}
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                    >
                      Add
                    </MobileButton>
                  </div>
                </MobileCard>
              ))}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <MobileCard>
              <h3 className="font-semibold text-gray-900 mb-2">Order Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{selectedCustomer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium">{orderItems.length}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-info-600">${orderTotal.toFixed(2)}</span>
                </div>
              </div>
            </MobileCard>

            <CameraCapture
              label="Delivery Photo"
              required
              onPhotoCapture={(photo) => setDeliveryPhoto(photo)}
            />

            <MobileCard>
              <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
              <div className="flex gap-2">
                <MobileButton
                  variant={paymentMethod === 'cash' ? 'primary' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  fullWidth
                >
                  Cash
                </MobileButton>
                <MobileButton
                  variant={paymentMethod === 'credit' ? 'primary' : 'outline'}
                  onClick={() => setPaymentMethod('credit')}
                  fullWidth
                >
                  Credit
                </MobileButton>
              </div>

              {paymentMethod === 'cash' && (
                <div className="mt-4">
                  <MobileInput
                    label="Cash Received"
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                    icon={<DollarSign className="h-5 w-5" />}
                  />
                  {cashReceived > 0 && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Change:</span>
                        <span className="font-bold text-green-600">
                          ${(cashReceived - orderTotal).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </MobileCard>
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <MobileCard>
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Order Complete!</h3>
                  <p className="text-gray-600 mt-1">Order #{orderId?.slice(0, 8)}</p>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{orderItems.length}</p>
                      <p className="text-sm text-gray-600">Items</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-info-600">${orderTotal.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Total</p>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <p className="text-sm text-gray-600">
                    Payment: <span className="font-medium capitalize">{paymentMethod}</span>
                  </p>
                  {paymentMethod === 'cash' && cashReceived > 0 && (
                    <p className="text-sm text-gray-600">
                      Change Given: <span className="font-medium">${(cashReceived - orderTotal).toFixed(2)}</span>
                    </p>
                  )}
                </div>
              </div>
            </MobileCard>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <MobileWorkflowLayout
      title="Van Sales"
      currentStep={activeStep}
      totalSteps={steps.length}
      onBack={activeStep > 0 ? handleBack : undefined}
      onNext={handleNext}
      nextLabel={activeStep === 4 ? 'Finish' : 'Next'}
      nextDisabled={loading}
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {renderStepContent()}
      </div>
    </MobileWorkflowLayout>
  )
}
