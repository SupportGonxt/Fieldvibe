/**
 * Board Placement Form Page - Mobile-First
 * For field agents to record board placements with GPS and photo
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Package, Camera, AlertCircle, CheckCircle } from 'lucide-react'
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

interface Board {
  id: string
  board_type: string
  size: string
  material: string
}

export default function BoardPlacementFormPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null)

  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsValidated, setGpsValidated] = useState(false)

  const [photo, setPhoto] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const [placementId, setPlacementId] = useState<string | null>(null)

  const steps = ['Customer', 'Board', 'GPS & Photo', 'Complete']

  useEffect(() => {
    loadCustomers()
    loadBoards()
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

  const loadBoards = async () => {
    try {
      const response = await apiClient.get('/boards?limit=100')
      const data = response.data.data?.boards || response.data.data || response.data || []
      setBoards(data)
    } catch (err) {
      console.error('Error loading boards:', err)
      setError('Failed to load boards')
    }
  }

  const handleNext = async () => {
    setError(null)

    if (activeStep === 0 && !selectedCustomer) {
      setError('Please select a customer')
      return
    }

    if (activeStep === 1 && !selectedBoard) {
      setError('Please select a board type')
      return
    }

    if (activeStep === 2) {
      if (!gpsValidated) {
        setError('Please capture and validate GPS location')
        return
      }
      if (!photo) {
        setError('Please capture a photo of the board placement')
        return
      }
      await submitPlacement()
    }

    if (activeStep === 3) {
      navigate('/field-operations/boards')
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

  const submitPlacement = async () => {
    setLoading(true)
    try {
      const placementData = {
        customer_id: selectedCustomer?.id,
        board_id: selectedBoard?.id,
        latitude: gpsLocation?.lat,
        longitude: gpsLocation?.lng,
        photo_url: photo,
        notes: notes,
        placement_date: new Date().toISOString(),
      }

      const response = await apiClient.post('/board-placements', placementData)
      const newPlacementId = response.data.data?.id || response.data.id
      setPlacementId(newPlacementId)

      await apiClient.post('/commission-ledgers', {
        agent_id: null, // Will be set by backend from auth token
        transaction_type: 'board_placement',
        reference_id: newPlacementId,
        amount: 10.00,
        status: 'pending',
      })
    } catch (err) {
      console.error('Error submitting placement:', err)
      setError('Failed to submit board placement')
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
            <p className="text-sm text-gray-600">Select the type of board you're placing</p>
            <div className="space-y-2">
              {boards.map(board => (
                <MobileCard
                  key={board.id}
                  selected={selectedBoard?.id === board.id}
                  onClick={() => setSelectedBoard(board)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{board.board_type}</p>
                        <p className="text-sm text-gray-600">
                          {board.size} - {board.material}
                        </p>
                      </div>
                    </div>
                    {selectedBoard?.id === board.id && (
                      <CheckCircle className="h-5 w-5 text-info-600" />
                    )}
                  </div>
                </MobileCard>
              ))}
            </div>
          </div>
        )

      case 2:
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
              label="Board Placement Photo"
              required
              onPhotoCapture={(photoData) => setPhoto(photoData)}
            />

            <MobileInput
              label="Notes (Optional)"
              placeholder="Add any notes about the placement..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              helperText="e.g., Visibility, location details, etc."
            />
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <MobileCard>
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Board Placed!</h3>
                  <p className="text-gray-600 mt-1">Placement #{placementId?.slice(0, 8)}</p>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold text-green-600">
                    <span>$10.00</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Commission Earned</p>
                </div>
                <div className="bg-surface-secondary rounded-lg p-4 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{selectedCustomer?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Board Type:</span>
                    <span className="font-medium">{selectedBoard?.board_type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-medium">
                      {gpsLocation?.lat.toFixed(6)}, {gpsLocation?.lng.toFixed(6)}
                    </span>
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
        title="Board Placement"
        currentStep={activeStep}
        totalSteps={steps.length}
        onBack={activeStep > 0 ? handleBack : undefined}
        onNext={handleNext}
        nextLabel={activeStep === 3 ? 'Finish' : 'Next'}
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Board Placement Form</h1>
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
            {activeStep === 3 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
