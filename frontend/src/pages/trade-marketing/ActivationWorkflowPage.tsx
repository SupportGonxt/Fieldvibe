import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, MapPin, CheckCircle, Camera, AlertCircle, 
  Navigation, Gift, Users, TrendingUp
} from 'lucide-react';
import { apiClient } from '../../services/api.service';
import { compressPhoto } from '../../utils/photo-compression';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  start_date: string;
  end_date: string;
  budget: number;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface ActivationTask {
  id: string;
  task_type: string;
  task_description: string;
  requires_photo: boolean;
  is_mandatory: boolean;
  status: string;
}

interface SampleAllocation {
  id: string;
  product_name: string;
  brand_name: string;
  allocated_quantity: number;
  distributed_quantity: number;
  remaining_quantity: number;
}

const ActivationWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsValidated, setGpsValidated] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  const [tasks, setTasks] = useState<ActivationTask[]>([]);
  const [taskPhotos, setTaskPhotos] = useState<{ [key: string]: string }>({});
  const [taskNotes, setTaskNotes] = useState<{ [key: string]: string }>({});

  const [sampleAllocations, setSampleAllocations] = useState<SampleAllocation[]>([]);
  const [sampleDistributions, setSampleDistributions] = useState<{ [key: string]: number }>({});
  const [recipientInfo, setRecipientInfo] = useState({
    name: '',
    phone: '',
    age_group: '',
    gender: '',
    feedback: ''
  });

  const [activationSummary, setActivationSummary] = useState<any>(null);

  const steps = [
    { number: 1, title: 'Campaign', icon: TrendingUp },
    { number: 2, title: 'Customer', icon: Users },
    { number: 3, title: 'GPS Check', icon: MapPin },
    { number: 4, title: 'Tasks', icon: CheckCircle },
    { number: 5, title: 'Samples', icon: Gift },
    { number: 6, title: 'Complete', icon: CheckCircle }
  ];

  useEffect(() => {
    if (currentStep === 1) {
      loadCampaigns();
    } else if (currentStep === 2 && selectedCampaign) {
      loadCustomers();
    } else if (currentStep === 4 && selectedCustomer) {
      loadActivationTasks();
    } else if (currentStep === 5) {
      loadSampleAllocations();
    }
  }, [currentStep, selectedCampaign, selectedCustomer]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/campaigns', {
        params: { status: 'active', limit: 100 }
      });
      setCampaigns(response.data.campaigns || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/customers', {
        params: { limit: 100 }
      });
      setCustomers(response.data.customers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const loadActivationTasks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/campaigns/${selectedCampaign?.id}/tasks`);
      setTasks(response.data.tasks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleAllocations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/samples/allocations', {
        params: { status: 'active' }
      });
      setSampleAllocations(response.data.allocations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sample allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignSelect = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCurrentStep(2);
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCurrentStep(3);
  };

  const handleGPSValidation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsLocation({ lat: latitude, lng: longitude, accuracy });

        if (selectedCustomer) {
          const dist = calculateDistance(
            latitude,
            longitude,
            selectedCustomer.latitude,
            selectedCustomer.longitude
          );
          setDistance(dist);

          if (dist <= 10) {
            setGpsValidated(true);
            setCurrentStep(4);
          } else {
            setError(`You are ${dist.toFixed(0)}m away from customer. Please move closer (max 10m).`);
          }
        }
        setLoading(false);
      },
      (error) => {
        setError(`GPS error: ${error.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleCaptureTaskPhoto = (taskId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const { compressed } = await compressPhoto(file);
          const reader = new FileReader();
          reader.onload = (event) => {
            setTaskPhotos(prev => ({ ...prev, [taskId]: event.target?.result as string }));
          };
          reader.readAsDataURL(compressed);
        } catch {
          const reader = new FileReader();
          reader.onload = (event) => {
            setTaskPhotos(prev => ({ ...prev, [taskId]: event.target?.result as string }));
          };
          reader.readAsDataURL(file);
        }
      }
    };
    input.click();
  };

  const handleSubmitActivation = async () => {
    if (!selectedCampaign || !selectedCustomer || !gpsLocation) {
      setError('Please complete all required steps');
      return;
    }

    const incompleteTasks = tasks.filter(
      task => task.is_mandatory && task.requires_photo && !taskPhotos[task.id]
    );

    if (incompleteTasks.length > 0) {
      setError('Please complete all mandatory tasks with photos');
      return;
    }

    try {
      setLoading(true);
      
      const activationData = {
        campaign_id: selectedCampaign.id,
        customer_id: selectedCustomer.id,
        tasks: tasks.map(task => ({
          task_id: task.id,
          photo: taskPhotos[task.id],
          notes: taskNotes[task.id],
          status: taskPhotos[task.id] ? 'completed' : 'pending'
        })),
        samples: Object.entries(sampleDistributions).map(([allocationId, quantity]) => ({
          allocation_id: allocationId,
          quantity,
          recipient_name: recipientInfo.name,
          recipient_phone: recipientInfo.phone,
          age_group: recipientInfo.age_group,
          gender: recipientInfo.gender,
          feedback: recipientInfo.feedback
        })),
        gps_lat: gpsLocation.lat,
        gps_lng: gpsLocation.lng
      };

      const response = await apiClient.post('/trade-marketing/activations', activationData);
      
      setActivationSummary(response.data);
      setCurrentStep(6);
    } catch (err: any) {
      setError(err.message || 'Failed to submit activation');
    } finally {
      setLoading(false);
    }
  };

  const allMandatoryTasksComplete = tasks
    .filter(t => t.is_mandatory)
    .every(t => !t.requires_photo || taskPhotos[t.id]);

  return (
    <div className="min-h-screen bg-surface-secondary pb-20">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Trade Marketing Activation</h1>
          <p className="text-sm text-gray-600 mt-1">Complete activation workflow</p>
        </div>

        <div className="flex items-center justify-between px-4 pb-3 overflow-x-auto">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStep >= step.number
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                </div>
                <span className="text-xs mt-1 text-gray-600 whitespace-nowrap">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-600 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Step 1: Campaign Selection */}
        {currentStep === 1 && (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => handleCampaignSelect(campaign)}
                className="w-full bg-white border border-gray-100 rounded-lg p-4 text-left hover:border-blue-500 hover:shadow-md transition-all"
              >
                <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{campaign.campaign_type}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-500">
                    {campaign.start_date} - {campaign.end_date}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    R {campaign.budget.toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Customer Selection */}
        {currentStep === 2 && (
          <div className="space-y-3">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => handleCustomerSelect(customer)}
                className="w-full bg-white border border-gray-100 rounded-lg p-4 text-left hover:border-blue-500 hover:shadow-md transition-all"
              >
                <h3 className="font-medium text-gray-900">{customer.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{customer.address}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: GPS Validation */}
        {currentStep === 3 && selectedCustomer && (
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Verify Location</h2>
            <p className="text-sm text-gray-600 mb-6">
              Confirm you are at {selectedCustomer.name}
            </p>

            {gpsLocation && distance !== null && (
              <div className="mb-4 p-3 bg-surface-secondary rounded-lg text-sm text-gray-600">
                <div>Distance: {distance.toFixed(0)}m from customer</div>
              </div>
            )}

            <button
              onClick={handleGPSValidation}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Getting Location...' : 'Verify GPS Location'}
            </button>
          </div>
        )}

        {/* Step 4: Activation Tasks */}
        {currentStep === 4 && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Activation Tasks</h2>
              <p className="text-sm text-gray-600">Complete all mandatory tasks</p>
            </div>

            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="bg-white border border-gray-100 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-medium text-gray-900">{task.task_type.replace('_', ' ')}</h3>
                        {task.is_mandatory && (
                          <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                            Mandatory
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{task.task_description}</p>
                    </div>
                    {taskPhotos[task.id] && (
                      <CheckCircle className="w-5 h-5 text-green-600 ml-2" />
                    )}
                  </div>

                  {task.requires_photo && (
                    <div>
                      {taskPhotos[task.id] ? (
                        <div className="relative">
                          <img src={taskPhotos[task.id]} alt="Task" className="w-full rounded-lg" />
                          <button
                            onClick={() => {
                              const newPhotos = { ...taskPhotos };
                              delete newPhotos[task.id];
                              setTaskPhotos(newPhotos);
                            }}
                            className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-lg text-sm"
                          >
                            Retake
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCaptureTaskPhoto(task.id)}
                          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:border-blue-500 hover:text-blue-600"
                        >
                          <Camera className="w-5 h-5 mr-2" />
                          Capture Photo
                        </button>
                      )}
                    </div>
                  )}

                  <textarea
                    placeholder="Notes (optional)"
                    value={taskNotes[task.id] || ''}
                    onChange={(e) => setTaskNotes({ ...taskNotes, [task.id]: e.target.value })}
                    rows={2}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              ))}
            </div>

            {allMandatoryTasksComplete && (
              <button
                onClick={() => setCurrentStep(5)}
                className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Continue to Sample Distribution
              </button>
            )}
          </div>
        )}

        {/* Step 5: Sample Distribution */}
        {currentStep === 5 && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Distribute Samples</h2>
              <p className="text-sm text-gray-600">Track sample distribution</p>
            </div>

            {/* Sample Allocations */}
            <div className="space-y-3 mb-4">
              {sampleAllocations.map((allocation) => (
                <div key={allocation.id} className="bg-white border border-gray-100 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900">{allocation.product_name}</h3>
                  <p className="text-sm text-gray-600">{allocation.brand_name}</p>
                  <div className="mt-2 text-sm text-gray-600">
                    Remaining: {allocation.remaining_quantity} of {allocation.allocated_quantity}
                  </div>
                  <div className="mt-3 flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max={allocation.remaining_quantity}
                      value={sampleDistributions[allocation.id] || 0}
                      onChange={(e) => setSampleDistributions({
                        ...sampleDistributions,
                        [allocation.id]: parseInt(e.target.value) || 0
                      })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Quantity to distribute"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Recipient Information */}
            {Object.values(sampleDistributions).some(qty => qty > 0) && (
              <div className="bg-white border border-gray-100 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">Recipient Information</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Recipient Name"
                    value={recipientInfo.name}
                    onChange={(e) => setRecipientInfo({ ...recipientInfo, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={recipientInfo.phone}
                    onChange={(e) => setRecipientInfo({ ...recipientInfo, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <select
                    value={recipientInfo.age_group}
                    onChange={(e) => setRecipientInfo({ ...recipientInfo, age_group: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Age Group</option>
                    <option value="18-25">18-25</option>
                    <option value="26-35">26-35</option>
                    <option value="36-45">36-45</option>
                    <option value="46-55">46-55</option>
                    <option value="56+">56+</option>
                  </select>
                  <select
                    value={recipientInfo.gender}
                    onChange={(e) => setRecipientInfo({ ...recipientInfo, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  <textarea
                    placeholder="Feedback (optional)"
                    value={recipientInfo.feedback}
                    onChange={(e) => setRecipientInfo({ ...recipientInfo, feedback: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSubmitActivation}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Submitting...' : 'Complete Activation'}
            </button>
          </div>
        )}

        {/* Step 6: Summary */}
        {currentStep === 6 && activationSummary && (
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Activation Complete!</h2>
            <p className="text-sm text-gray-600 mb-6">
              Activation ID: {activationSummary.activation_id}
            </p>

            <div className="bg-surface-secondary rounded-lg p-4 mb-6 text-left">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Campaign:</span>
                  <span className="font-medium text-gray-900">{activationSummary.campaign}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium text-gray-900">{activationSummary.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tasks Completed:</span>
                  <span className="font-medium text-gray-900">{activationSummary.tasks_completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Samples Distributed:</span>
                  <span className="font-medium text-gray-900">{activationSummary.samples_distributed}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/trade-marketing')}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              Back to Trade Marketing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivationWorkflowPage;
