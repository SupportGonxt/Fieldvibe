import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fieldMarketingService } from '../services/fieldMarketing.service';

const CustomerSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [validatingGPS, setValidatingGPS] = useState(false);
  const [gpsValidation, setGpsValidation] = useState<any>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLoading(false);
        },
        (error) => {
          setLocationError('Failed to get your location. Please enable GPS.');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError('Geolocation is not supported by your device.');
    }
  };

  const searchCustomers = async () => {
    if (!searchQuery && !currentLocation) return;
    
    setLoading(true);
    try {
      const params: any = { query: searchQuery };
      if (currentLocation) {
        params.latitude = currentLocation.latitude;
        params.longitude = currentLocation.longitude;
        params.radius = 100;
      }
      
      const result = await fieldMarketingService.searchCustomers(params);
      setCustomers(result.customers || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateCustomerGPS = async (customer: any) => {
    if (!currentLocation) {
      alert('Your location is not available. Please enable GPS.');
      return;
    }

    setSelectedCustomer(customer);
    setValidatingGPS(true);
    
    try {
      const result = await fieldMarketingService.validateGPS({
        customerId: customer.id,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: 10
      });
      
      setGpsValidation(result);
      
      if (result.valid) {
        setTimeout(() => startVisit(customer), 1500);
      }
    } catch (error) {
      console.error('GPS validation failed:', error);
      setGpsValidation({ valid: false, distance: 999, requiredDistance: 10 });
    } finally {
      setValidatingGPS(false);
    }
  };

  const startVisit = (customer: any) => {
    if (!currentLocation) return;
    
    navigate('/field-marketing/visit-workflow', {
      state: {
        customer,
        location: currentLocation
      }
    });
  };

  return (
    <div className="min-h-screen bg-surface-secondary p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Select Customer</h1>
          <p className="text-gray-600">GPS validation required within 10 meters</p>
        </div>

        {/* GPS Status */}
        <div className={`p-4 rounded-lg mb-6 ${
          currentLocation ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        } border`}>
          <div className="flex items-center">
            <div className="text-2xl mr-3">
              {currentLocation ? '✅' : '❌'}
            </div>
            <div className="flex-1">
              <div className="font-semibold">
                {currentLocation ? 'GPS Active' : 'GPS Unavailable'}
              </div>
              <div className="text-sm text-gray-600">
                {currentLocation 
                  ? `Lat: ${currentLocation.latitude.toFixed(6)}, Long: ${currentLocation.longitude.toFixed(6)}`
                  : locationError || 'Getting your location...'
                }
              </div>
            </div>
            {!currentLocation && (
              <button
                onClick={getCurrentLocation}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name, code, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchCustomers()}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={searchCustomers}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Search
            </button>
          </div>
          {currentLocation && (
            <div className="mt-2 text-sm text-gray-600">
              💡 Results sorted by proximity to your location
            </div>
          )}
        </div>

        {/* Customer List */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-8 text-gray-500">
              Searching...
            </div>
          )}
          
          {!loading && customers.length === 0 && searchQuery && (
            <div className="text-center py-8 text-gray-500">
              No customers found. Try a different search.
            </div>
          )}
          
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-lg">{customer.name}</div>
                  <div className="text-sm text-gray-600">{customer.code}</div>
                  <div className="text-sm text-gray-600">{customer.phone}</div>
                  {customer.address && (
                    <div className="text-sm text-gray-600 mt-1">{customer.address}</div>
                  )}
                  {customer.distance !== undefined && (
                    <div className="mt-2">
                      <span className={`text-sm px-2 py-1 rounded ${
                        customer.distance <= 10 
                          ? 'bg-green-100 text-green-800'
                          : customer.distance <= 50
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        📍 {customer.distance.toFixed(0)}m away
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => validateCustomerGPS(customer)}
                  disabled={!currentLocation || validatingGPS}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 ml-4"
                >
                  {validatingGPS && selectedCustomer?.id === customer.id
                    ? 'Validating...'
                    : 'Select'
                  }
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* GPS Validation Modal */}
        {gpsValidation && selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="text-center">
                <div className="text-6xl mb-4">
                  {gpsValidation.valid ? '✅' : '❌'}
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {gpsValidation.valid ? 'GPS Validated!' : 'GPS Validation Failed'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {gpsValidation.valid 
                    ? `You are ${gpsValidation.distance.toFixed(1)}m from ${selectedCustomer.name}`
                    : `You are ${gpsValidation.distance.toFixed(1)}m away. Please move closer (within ${gpsValidation.requiredDistance}m)`
                  }
                </p>
                {gpsValidation.valid ? (
                  <div className="text-sm text-gray-500">
                    Starting visit...
                  </div>
                ) : (
                  <button
                    onClick={() => setGpsValidation(null)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSelectionPage;
