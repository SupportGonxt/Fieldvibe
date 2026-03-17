import React, { useState, useEffect } from 'react';
import { useToast } from '../components/ui/Toast';
import { 
  Camera, MapPin, Users, DollarSign, Calendar, Clock, Target, 
  TrendingUp, MessageSquare, Star, Gift, Plus, X, Upload
} from 'lucide-react';

interface BrandActivation {
  id?: number;
  eventName: string;
  eventType: 'sampling' | 'demo' | 'promotion' | 'contest' | 'exhibition';
  storeId: number;
  storeName: string;
  location: string;
  gpsCoordinates: { latitude: number; longitude: number };
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  budget: number;
  teamMembers: string[];
  targetAttendance: number;
  actualAttendance: number;
  samplesDistributed: number;
  leadsCaptured: number;
  engagementScore: number; // 1-10
  customerFeedback: string[];
  photos: string[];
  activities: string[];
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  notes: string;
}

const BrandActivationFormPage: React.FC = () => {
  const { toast } = useToast()
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [formData, setFormData] = useState<Partial<BrandActivation>>({
    eventType: 'sampling',
    teamMembers: [],
    customerFeedback: [],
    photos: [],
    activities: [],
    status: 'planned',
    targetAttendance: 100,
    actualAttendance: 0,
    samplesDistributed: 0,
    leadsCaptured: 0,
    engagementScore: 7
  });

  const [newTeamMember, setNewTeamMember] = useState('');
  const [newFeedback, setNewFeedback] = useState('');
  const [newActivity, setNewActivity] = useState('');

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setFormData(prev => ({
            ...prev,
            gpsCoordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          }));
        },
        (error) => {
          console.error('GPS Error:', error);
        }
      );
    }
  };

  const handleInputChange = (field: keyof BrandActivation, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const addTeamMember = () => {
    if (newTeamMember.trim()) {
      setFormData({
        ...formData,
        teamMembers: [...(formData.teamMembers || []), newTeamMember.trim()]
      });
      setNewTeamMember('');
    }
  };

  const removeTeamMember = (index: number) => {
    const updated = [...(formData.teamMembers || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, teamMembers: updated });
  };

  const addFeedback = () => {
    if (newFeedback.trim()) {
      setFormData({
        ...formData,
        customerFeedback: [...(formData.customerFeedback || []), newFeedback.trim()]
      });
      setNewFeedback('');
    }
  };

  const removeFeedback = (index: number) => {
    const updated = [...(formData.customerFeedback || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, customerFeedback: updated });
  };

  const addActivity = () => {
    if (newActivity.trim()) {
      setFormData({
        ...formData,
        activities: [...(formData.activities || []), newActivity.trim()]
      });
      setNewActivity('');
    }
  };

  const removeActivity = (index: number) => {
    const updated = [...(formData.activities || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, activities: updated });
  };

  const handlePhotoCapture = () => {
    // Simulate photo capture
    const mockPhoto = `photo-${Date.now()}.jpg`;
    setFormData({
      ...formData,
      photos: [...(formData.photos || []), mockPhoto]
    });
  };

  const removePhoto = (index: number) => {
    const updated = [...(formData.photos || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, photos: updated });
  };

  const handleSubmit = async () => {
    if (!formData.eventName || !formData.location || !formData.startDate || !formData.endDate) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const response = await fetch('/api/trade-marketing-new/brand-activations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Brand Activation event created successfully!');
        // Reset form
        setFormData({
          eventType: 'sampling',
          teamMembers: [],
          customerFeedback: [],
          photos: [],
          activities: [],
          status: 'planned',
          targetAttendance: 100,
          actualAttendance: 0,
          samplesDistributed: 0,
          leadsCaptured: 0,
          engagementScore: 7
        });
      } else {
        const error = await response.json();
        toast.error('Failed to create event: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating brand activation:', error);
      toast.error('Error creating brand activation event');
    }
  };

  const getEventTypeColor = (type: string) => {
    const colors = {
      sampling: 'bg-blue-100 text-blue-800',
      demo: 'bg-purple-100 text-purple-800',
      promotion: 'bg-green-100 text-green-800',
      contest: 'bg-yellow-100 text-yellow-800',
      exhibition: 'bg-pink-100 text-pink-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      planned: 'bg-blue-100 text-blue-800',
      ongoing: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-surface-secondary p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Gift className="w-8 h-8 text-pink-600" />
                Brand Activation Event
              </h1>
              <p className="text-gray-600 mt-1">Create and manage brand activation events</p>
            </div>
            {gpsLocation && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <MapPin className="w-4 h-4" />
                GPS Active
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Event Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={formData.eventName || ''}
                    onChange={(e) => handleInputChange('eventName', e.target.value)}
                    placeholder="e.g., Summer Product Launch"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type *
                  </label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => handleInputChange('eventType', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="sampling">Product Sampling</option>
                    <option value="demo">Product Demo</option>
                    <option value="promotion">Promotional Event</option>
                    <option value="contest">Contest/Competition</option>
                    <option value="exhibition">Exhibition/Display</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Store/Venue name and address"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.endDate || ''}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={formData.startTime || ''}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={formData.endTime || ''}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.budget || ''}
                    onChange={(e) => handleInputChange('budget', parseFloat(e.target.value))}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="planned">Planned</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-600" />
                Team Members
              </h2>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTeamMember}
                  onChange={(e) => setNewTeamMember(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTeamMember()}
                  placeholder="Enter team member name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={addTeamMember}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {formData.teamMembers?.map((member, index) => (
                  <div key={index} className="flex items-center justify-between bg-surface-secondary px-4 py-2 rounded-lg">
                    <span className="text-gray-700">{member}</span>
                    <button
                      onClick={() => removeTeamMember(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Activities */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-pink-600" />
                Event Activities
              </h2>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addActivity()}
                  placeholder="e.g., Product demonstration"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={addActivity}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {formData.activities?.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between bg-surface-secondary px-4 py-2 rounded-lg">
                    <span className="text-gray-700">{activity}</span>
                    <button
                      onClick={() => removeActivity(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Feedback */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-pink-600" />
                Customer Feedback
              </h2>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newFeedback}
                  onChange={(e) => setNewFeedback(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addFeedback()}
                  placeholder="Enter customer feedback..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={addFeedback}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {formData.customerFeedback?.map((feedback, index) => (
                  <div key={index} className="flex items-start justify-between bg-surface-secondary px-4 py-3 rounded-lg">
                    <span className="text-gray-700 text-sm italic">"{feedback}"</span>
                    <button
                      onClick={() => removeFeedback(index)}
                      className="text-red-600 hover:text-red-800 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo Gallery */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-pink-600" />
                Event Photos
              </h2>
              
              <button
                onClick={handlePhotoCapture}
                className="mb-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Take Photo ({formData.photos?.length || 0})
              </button>

              <div className="grid grid-cols-3 gap-4">
                {formData.photos?.map((photo, index) => (
                  <div key={index} className="relative">
                    <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-600">
                      Photo {index + 1}
                    </div>
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Additional Notes</h2>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional information about the event..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Metrics - Right Column */}
          <div className="space-y-6">
            {/* Engagement Metrics */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Engagement Metrics</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Attendance
                  </label>
                  <input
                    type="number"
                    value={formData.targetAttendance || ''}
                    onChange={(e) => handleInputChange('targetAttendance', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Attendance
                  </label>
                  <input
                    type="number"
                    value={formData.actualAttendance || ''}
                    onChange={(e) => handleInputChange('actualAttendance', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Samples Distributed
                  </label>
                  <input
                    type="number"
                    value={formData.samplesDistributed || ''}
                    onChange={(e) => handleInputChange('samplesDistributed', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leads Captured
                  </label>
                  <input
                    type="number"
                    value={formData.leadsCaptured || ''}
                    onChange={(e) => handleInputChange('leadsCaptured', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Engagement Score (1-10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.engagementScore || 5}
                    onChange={(e) => handleInputChange('engagementScore', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-center text-2xl font-bold text-pink-600 mt-2">
                    {formData.engagementScore}/10
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Team Size:</span>
                  <span className="font-semibold">{formData.teamMembers?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Activities:</span>
                  <span className="font-semibold">{formData.activities?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Photos:</span>
                  <span className="font-semibold">{formData.photos?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Feedback:</span>
                  <span className="font-semibold">{formData.customerFeedback?.length || 0}</span>
                </div>
              </div>

              {formData.targetAttendance && formData.actualAttendance ? (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-sm text-gray-600 mb-1">Attendance Rate</div>
                  <div className="text-2xl font-bold text-pink-600">
                    {Math.round((formData.actualAttendance / formData.targetAttendance) * 100)}%
                  </div>
                </div>
              ) : null}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-medium text-lg flex items-center justify-center gap-2"
            >
              <Gift className="w-5 h-5" />
              Create Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandActivationFormPage;
