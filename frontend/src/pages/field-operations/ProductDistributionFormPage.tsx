/**
 * Product Distribution Form Page - Mobile-First
 * For field agents to record product distributions with GPS and photo
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Package, Camera, AlertCircle, CheckCircle, User } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { useIsMobile } from '../../hooks/useMediaQuery'
import MobileWorkflowLayout from '../../components/mobile/MobileWorkflowLayout'
import MobileCard from '../../components/mobile/MobileCard'
import MobileInput from '../../components/mobile/MobileInput'
import MobileButton from '../../components/mobile/MobileButton'
import GPSCapture from '../../components/mobile/GPSCapture'
import CameraCapture from '../../components/mobile/CameraCapture'

interface Customer {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}

interface Product {
  id: string
  name: string
  sku: string
  description: string
}

export default function ProductDistributionFormPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)

  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientIdNumber, setRecipientIdNumber] = useState('')

  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsValidated, setGpsValidated] = useState(false)

  const [photo, setPhoto] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const [distributionId, setDistributionId] = useState<string | null>(null)

  const steps = ['Customer', 'Product', 'Recipient', 'GPS & Photo', 'Complete']

  useEffect(() => {
    loadCustomers()
    loadProducts()
  }, [])

  const loadCustomers = async () => {
    try {
      const response = await apiClient.get('/customers?limit=100')
      const data = response.data.data?.customers || response.data.data || response.data || []
      setCustomers(data)
    } catch (err) {
      console.error('Error loading customers:', err)
      setError('Failed to load customers')
    }
  }

  const loadProducts = async () => {
    try {
      const response = await apiClient.get('/products?limit=100')
      const data = response.data.data?.products || response.data.data || response.data || []
      setProducts(data)
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load products')
    }
  }

  const handleNext = async () => {
    setError(null)

    if (activeStep === 0 && !selectedCustomer) {
      setError('Please select a customer')
      return
    }

    if (activeStep === 1) {
      if (!selectedProduct) {
        setError('Please select a product')
        return
      }
      if (quantity < 1) {
        setError('Quantity must be at least 1')
        return
      }
    }

    if (activeStep === 2) {
      if (!recipientName.trim()) {
        setError('Please enter recipient name')
        return
      }
      if (!recipientPhone.trim()) {
        setError('Please enter recipient phone')
        return
      }
    }

    if (activeStep === 3) {
      if (!gpsValidated) {
        setError('Please capture and validate GPS location')
        return
      }
      if (!photo) {
        setError('Please capture a photo of the distribution')
        return
      }
      await submitDistribution()
    }

    if (activeStep === 4) {
      navigate('/field-operations/products')
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
      
      if (distance <= 10) {
        setGpsValidated(true)
        setError(null)
      } else {
        setGpsValidated(false)
        setError(`You are ${Math.round(distance)}m away. Please move within 10m of the customer.`)
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

  const submitDistribution = async () => {
    setLoading(true)
    try {
      const distributionData = {
        customer_id: selectedCustomer?.id,
        product_id: selectedProduct?.id,
        quantity: quantity,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_id_number: recipientIdNumber,
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng,
        photo_url: photo,
        notes: notes,
        distribution_date: new Date().toISOString(),
      }

      const response = await apiClient.post('/product-distributions', distributionData)
      const newDistributionId = response.data.data?.id || response.data.id
      setDistributionId(newDistributionId)

      await apiClient.post('/commission-ledgers', {
        agent_id: null, // Will be set by backend from auth token
        transaction_type: 'product_distribution',
        reference_id: newDistributionId,
        amount: 5.00 * quantity,
        status: 'pending',
      })
    } catch (err) {
      console.error('Error submitting distribution:', err)
      setError('Failed to submit product distribution')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
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
              icon={<MapPin className="h-5 w-5" />}
            />
            <div className="space-y-2">
              {filteredCustomers.map(customer => (
                <MobileCard
                  key={customer.id}
                  selected={selectedCustomer?.id === customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                    <div>
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.address}</p>
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
            <p className="text-sm text-gray-600">Select the product to distribute</p>
            <div className="space-y-2">
              {products.map(product => (
                <MobileCard
                  key={product.id}
                  selected={selectedProduct?.id === product.id}
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                      </div>
                    </div>
                    {selectedProduct?.id === product.id && (
                      <CheckCircle className="h-5 w-5 text-info-600" />
                    )}
                  </div>
                </MobileCard>
              ))}
            </div>

            {selectedProduct && (
              <MobileInput
                label="Quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                helperText="Number of units to distribute"
              />
            )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Enter recipient information</p>
            
            <MobileInput
              label="Recipient Name"
              placeholder="Full name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              icon={<User className="h-5 w-5" />}
              required
            />

            <MobileInput
              label="Phone Number"
              type="tel"
              placeholder="+1234567890"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              required
            />

            <MobileInput
              label="ID Number (Optional)"
              placeholder="National ID or other identification"
              value={recipientIdNumber}
              onChange={(e) => setRecipientIdNumber(e.target.value)}
              helperText="For verification purposes"
            />
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <GPSCapture
              onLocationCaptured={handleLocationCaptured}
              targetLatitude={selectedCustomer?.latitude}
              targetLongitude={selectedCustomer?.longitude}
              radiusMeters={10}
              showValidation={!!selectedCustomer}
            />

            <CameraCapture
              label="Distribution Photo"
              required
              onPhotoCapture={(photoData) => setPhoto(photoData)}
            />

            <MobileInput
              label="Notes (Optional)"
              placeholder="Add any notes about the distribution..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
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
                  <h3 className="text-xl font-bold text-gray-900">Distribution Complete!</h3>
                  <p className="text-gray-600 mt-1">Distribution #{distributionId?.slice(0, 8)}</p>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold text-green-600">
                    <span>${(5.00 * quantity).toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Commission Earned</p>
                  <p className="text-xs text-gray-500 mt-1">$5.00 × {quantity} units</p>
                </div>
                <div className="bg-surface-secondary rounded-lg p-4 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{selectedCustomer?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Product:</span>
                    <span className="font-medium">{selectedProduct?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium">{quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Recipient:</span>
                    <span className="font-medium">{recipientName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium">{recipientPhone}</span>
                  </div>
                </div>
              </div>
            </MobileCard>
          </div>
        )

      default:
        return null
    }
  }

  if (isMobile) {
    return (
      <MobileWorkflowLayout
        title="Product Distribution"
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

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Product Distribution Form</h1>
        {renderStepContent()}
        <div className="mt-6 flex gap-4">
          {activeStep > 0 && (
            <button
              onClick={handleBack}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-surface-secondary"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            className="px-4 py-2 bg-info-600 text-white rounded-lg hover:bg-info-700 disabled:opacity-50"
          >
            {activeStep === 4 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
