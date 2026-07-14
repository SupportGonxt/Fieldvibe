import { useState, useEffect } from 'react'
import {
  Camera,
  FileText,
  ShoppingCart,
  Package,
  CreditCard,
  Star,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Upload,
  Mic,
  Video,
  BarChart3,
  Users,
  Target,
  Award
} from 'lucide-react'
import { VisitActivity, Survey, Photo, Sale, Agent } from '../../types/agent.types'

interface ActivityTrackerProps {
  visitId: string
  agent: Agent
  activities: VisitActivity[]
  onActivityUpdate: (activity: VisitActivity) => void
  onActivityComplete: (activityId: string) => void
}

export default function ActivityTracker({
  visitId,
  agent,
  activities,
  onActivityUpdate,
  onActivityComplete
}: ActivityTrackerProps) {
  const [selectedActivity, setSelectedActivity] = useState<VisitActivity | null>(null)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [activityType, setActivityType] = useState<string>('')

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'photo':
        return <Camera className="h-5 w-5" />
      case 'survey':
        return <FileText className="h-5 w-5" />
      case 'sale':
        return <ShoppingCart className="h-5 w-5" />
      case 'delivery':
        return <Package className="h-5 w-5" />
      case 'collection':
        return <CreditCard className="h-5 w-5" />
      case 'merchandising':
        return <BarChart3 className="h-5 w-5" />
      case 'promotion':
        return <Target className="h-5 w-5" />
      case 'competitor_check':
        return <Users className="h-5 w-5" />
      case 'training':
        return <Award className="h-5 w-5" />
      default:
        return <CheckCircle className="h-5 w-5" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'photo':
        return 'bg-purple-100 text-purple-600'
      case 'survey':
        return 'bg-blue-100 text-blue-600'
      case 'sale':
        return 'bg-green-100 text-green-600'
      case 'delivery':
        return 'bg-orange-100 text-orange-600'
      case 'collection':
        return 'bg-yellow-100 text-yellow-600'
      case 'merchandising':
        return 'bg-indigo-100 text-indigo-600'
      case 'promotion':
        return 'bg-pink-100 text-pink-600'
      case 'competitor_check':
        return 'bg-red-100 text-red-600'
      case 'training':
        return 'bg-teal-100 text-teal-600'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const canPerformActivity = (activityType: string) => {
    return agent.roles.some(role => {
      switch (activityType) {
        case 'sale':
          return role.permissions.includes('sales')
        case 'delivery':
          return role.permissions.includes('inventory') || role.permissions.includes('logistics')
        case 'merchandising':
          return role.permissions.includes('merchandising')
        case 'promotion':
          return role.permissions.includes('promotions') || role.permissions.includes('brand_activities')
        case 'competitor_check':
          return role.permissions.includes('competitor_analysis')
        default:
          return role.permissions.includes('customer_visits')
      }
    })
  }

  const availableActivities = [
    { type: 'photo', name: 'Photo Capture', description: 'Take photos of store, products, or displays' },
    { type: 'survey', name: 'Survey', description: 'Conduct customer or store surveys' },
    { type: 'sale', name: 'Sales Transaction', description: 'Record sales and process payments' },
    { type: 'delivery', name: 'Product Delivery', description: 'Deliver products and get signatures' },
    { type: 'collection', name: 'Payment Collection', description: 'Collect payments or returns' },
    { type: 'merchandising', name: 'Merchandising', description: 'Arrange displays and check planograms' },
    { type: 'promotion', name: 'Promotion Activity', description: 'Execute promotional campaigns' },
    { type: 'competitor_check', name: 'Competitor Analysis', description: 'Check competitor presence and pricing' },
    { type: 'training', name: 'Training Session', description: 'Conduct product or sales training' },
    { type: 'inventory_check', name: 'Inventory Check', description: 'Check stock levels and availability' },
    { type: 'complaint', name: 'Complaint Handling', description: 'Handle customer complaints' },
    { type: 'feedback', name: 'Feedback Collection', description: 'Collect customer feedback' }
  ].filter(activity => canPerformActivity(activity.type))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Activity Tracker</h3>
          <p className="text-sm text-gray-600">
            {activities.filter(a => a.completed).length} of {activities.length} activities completed
          </p>
        </div>
        <button
          onClick={() => setShowActivityForm(true)}
          className="btn-primary btn-sm"
        >
          Add Activity
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-info-600 h-2 rounded-full transition-all duration-300"
          style={{
            width: `${activities.length > 0 ? (activities.filter(a => a.completed).length / activities.length) * 100 : 0}%`
          }}
        />
      </div>

      {/* Activities List */}
      <div className="space-y-3">
        {activities.map(activity => (
          <div
            key={activity.id}
            className={`border rounded-lg p-4 transition-all duration-200 ${
              activity.completed
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-100 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{activity.title}</h4>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                    {activity.location && (
                      <span className="text-xs text-gray-500 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {activity.completed ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-1" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedActivity(activity)}
                    className="btn-primary btn-sm"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Form Modal */}
      {showActivityForm && (
        <ActivityFormModal
          visitId={visitId}
          availableActivities={availableActivities}
          onClose={() => setShowActivityForm(false)}
          onSubmit={(newActivity) => {
            onActivityUpdate(newActivity)
            setShowActivityForm(false)
          }}
        />
      )}

      {/* Activity Execution Modal */}
      {selectedActivity && (
        <ActivityExecutionModal
          activity={selectedActivity}
          agent={agent}
          onClose={() => setSelectedActivity(null)}
          onComplete={(completedActivity) => {
            onActivityUpdate(completedActivity)
            onActivityComplete(completedActivity.id)
            setSelectedActivity(null)
          }}
        />
      )}
    </div>
  )
}

interface ActivityFormModalProps {
  visitId: string
  availableActivities: any[]
  onClose: () => void
  onSubmit: (activity: VisitActivity) => void
}

function ActivityFormModal({ visitId, availableActivities, onClose, onSubmit }: ActivityFormModalProps) {
  const [selectedType, setSelectedType] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newActivity: VisitActivity = {
      id: `activity_${Date.now()}`,
      visit_id: visitId,
      type: selectedType as any,
      title,
      description,
      data: {},
      completed: false,
      timestamp: new Date().toISOString()
    }

    onSubmit(newActivity)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Activity</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="form-select w-full"
                required
              >
                <option value="">Select activity type</option>
                {availableActivities.map(activity => (
                  <option key={activity.type} value={activity.type}>
                    {activity.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input w-full"
                placeholder="Activity title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-textarea w-full"
                rows={3}
                placeholder="Activity description"
                required
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Add Activity
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

interface ActivityExecutionModalProps {
  activity: VisitActivity
  agent: Agent
  onClose: () => void
  onComplete: (activity: VisitActivity) => void
}

function ActivityExecutionModal({ activity, agent, onClose, onComplete }: ActivityExecutionModalProps) {
  const [activityData, setActivityData] = useState<any>(activity.data || {})
  const [notes, setNotes] = useState('')

  const handleComplete = () => {
    const completedActivity: VisitActivity = {
      ...activity,
      completed: true,
      data: {
        ...activityData,
        notes,
        completed_at: new Date().toISOString(),
        completed_by: agent.id
      }
    }
    onComplete(completedActivity)
  }

  const renderActivitySpecificFields = () => {
    switch (activity.type) {
      case 'photo':
        return <PhotoCaptureComponent onPhotoCapture={(photos) => setActivityData({ ...activityData, photos })} />
      case 'survey':
        return <SurveyComponent onSurveyComplete={(responses) => setActivityData({ ...activityData, responses })} />
      case 'sale':
        return <SalesComponent onSaleComplete={(sale) => setActivityData({ ...activityData, sale })} />
      case 'delivery':
        return <DeliveryComponent onDeliveryComplete={(delivery) => setActivityData({ ...activityData, delivery })} />
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{activity.title}</h3>
              <p className="text-sm text-gray-600">{activity.description}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {renderActivitySpecificFields()}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-textarea w-full"
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button onClick={onClose} className="btn-outline">
                Cancel
              </button>
              <button onClick={handleComplete} className="btn-success">
                Complete Activity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Activity-specific components
function PhotoCaptureComponent({ onPhotoCapture }: { onPhotoCapture: (photos: string[]) => void }) {
  const [photos, setPhotos] = useState<string[]>([])

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Photo Capture</h4>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">Take photos or upload from gallery</p>
        <div className="flex justify-center space-x-3">
          <button className="btn-primary">
            <Camera className="h-4 w-4 mr-2" />
            Take Photo
          </button>
          <button className="btn-outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </button>
        </div>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <img key={index} src={photo} alt={`Photo ${index + 1}`} className="w-full h-20 object-cover rounded" />
          ))}
        </div>
      )}
    </div>
  )
}

function SurveyComponent({ onSurveyComplete }: { onSurveyComplete: (responses: any) => void }) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Customer Survey</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            How satisfied are you with our service?
          </label>
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button key={rating} className="p-2 border rounded hover:bg-surface-secondary">
                <Star className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Comments
          </label>
          <textarea className="form-textarea w-full" rows={3} />
        </div>
      </div>
    </div>
  )
}

function SalesComponent({ onSaleComplete }: { onSaleComplete: (sale: any) => void }) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Sales Transaction</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Products Sold
          </label>
          <div className="border rounded-lg p-3">
            <p className="text-sm text-gray-600">Add products to this sale...</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subtotal
            </label>
            <input type="number" className="form-input w-full" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select className="form-select w-full">
              <option>Cash</option>
              <option>Card</option>
              <option>Credit</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeliveryComponent({ onDeliveryComplete }: { onDeliveryComplete: (delivery: any) => void }) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Product Delivery</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Items Delivered
          </label>
          <div className="border rounded-lg p-3">
            <p className="text-sm text-gray-600">Scan or select items for delivery...</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Signature
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <p className="text-gray-600">Capture customer signature</p>
          </div>
        </div>
      </div>
    </div>
  )
}