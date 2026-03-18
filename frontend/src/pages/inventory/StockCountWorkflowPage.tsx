import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, MapPin, CheckCircle, Camera, AlertCircle, 
  Navigation, Warehouse, TrendingUp, TrendingDown
} from 'lucide-react';
import { apiClient } from '../../services/api.service';
import { compressPhoto } from '../../utils/photo-compression';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Product {
  id: string;
  name: string;
  code: string;
  system_quantity: number;
}

interface CountItem {
  product_id: string;
  product_name: string;
  system_quantity: number;
  counted_quantity: number;
  variance: number;
  variance_reason?: string;
}

const StockCountWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsValidated, setGpsValidated] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [countSummary, setCountSummary] = useState<any>(null);

  const steps = [
    { number: 1, title: 'Warehouse', icon: Warehouse },
    { number: 2, title: 'GPS Check', icon: MapPin },
    { number: 3, title: 'Count', icon: Package },
    { number: 4, title: 'Verify', icon: Camera },
    { number: 5, title: 'Complete', icon: CheckCircle }
  ];

  useEffect(() => {
    if (currentStep === 1) {
      loadWarehouses();
    } else if (currentStep === 3 && selectedWarehouse) {
      loadProducts();
    }
  }, [currentStep, selectedWarehouse]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/warehouses', {
        params: { limit: 100 }
      });
      setWarehouses(response.data.warehouses || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/products', {
        params: { limit: 100 }
      });
      const productsData = response.data.products || [];
      setProducts(productsData.map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.sku || p.code,
        system_quantity: p.stock_quantity || 0
      })));
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseSelect = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setCurrentStep(2);
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

        if (selectedWarehouse) {
          const dist = calculateDistance(
            latitude,
            longitude,
            selectedWarehouse.latitude,
            selectedWarehouse.longitude
          );
          setDistance(dist);

          if (dist <= 50) {
            setGpsValidated(true);
            setCurrentStep(3);
          } else {
            setError(`You are ${dist.toFixed(0)}m away from warehouse. Please move closer (max 50m).`);
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

  const handleCountProduct = (product: Product, countedQty: number) => {
    const variance = countedQty - product.system_quantity;
    const existingItem = countItems.find(item => item.product_id === product.id);

    if (existingItem) {
      setCountItems(countItems.map(item =>
        item.product_id === product.id
          ? { ...item, counted_quantity: countedQty, variance }
          : item
      ));
    } else {
      setCountItems([...countItems, {
        product_id: product.id,
        product_name: product.name,
        system_quantity: product.system_quantity,
        counted_quantity: countedQty,
        variance
      }]);
    }
  };

  const handleAddVarianceReason = (productId: string, reason: string) => {
    setCountItems(countItems.map(item =>
      item.product_id === productId
        ? { ...item, variance_reason: reason }
        : item
    ));
  };

  const handleCapturePhoto = () => {
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
            setPhoto(event.target?.result as string);
          };
          reader.readAsDataURL(compressed);
        } catch {
          const reader = new FileReader();
          reader.onload = (event) => {
            setPhoto(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    input.click();
  };

  const handleSubmitCount = async () => {
    if (!selectedWarehouse || !gpsLocation || countItems.length === 0) {
      setError('Please complete all required steps');
      return;
    }

    const variancesWithoutReasons = countItems.filter(
      item => item.variance !== 0 && !item.variance_reason
    );

    if (variancesWithoutReasons.length > 0) {
      setError('Please provide reasons for all variances');
      return;
    }

    try {
      setLoading(true);
      
      const countData = {
        warehouse_id: selectedWarehouse.id,
        items: countItems.map(item => ({
          product_id: item.product_id,
          system_quantity: item.system_quantity,
          counted_quantity: item.counted_quantity,
          variance: item.variance,
          variance_reason: item.variance_reason
        })),
        photo,
        notes,
        gps_lat: gpsLocation.lat,
        gps_lng: gpsLocation.lng
      };

      const response = await apiClient.post('/inventory/stock-counts', countData);
      
      setCountSummary(response.data);
      setCurrentStep(5);
    } catch (err: any) {
      setError(err.message || 'Failed to submit stock count');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-secondary pb-20">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Stock Count</h1>
          <p className="text-sm text-gray-600 mt-1">GPS-validated inventory count</p>
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStep >= step.number
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                </div>
                <span className="text-xs mt-1 text-gray-600">{step.title}</span>
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
        {currentStep === 1 && (
          <div className="space-y-3">
            {warehouses.map((warehouse) => (
              <button
                key={warehouse.id}
                onClick={() => handleWarehouseSelect(warehouse)}
                className="w-full bg-white border border-gray-100 rounded-lg p-4 text-left hover:border-blue-500 hover:shadow-md transition-all"
              >
                <h3 className="font-medium text-gray-900">{warehouse.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{warehouse.code}</p>
                <p className="text-sm text-gray-500 mt-1">{warehouse.address}</p>
              </button>
            ))}
          </div>
        )}

        {currentStep === 2 && selectedWarehouse && (
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Verify Location</h2>
            <p className="text-sm text-gray-600 mb-6">
              Confirm you are at {selectedWarehouse.name}
            </p>

            {gpsLocation && distance !== null && (
              <div className="mb-4 p-3 bg-surface-secondary rounded-lg text-sm text-gray-600">
                <div>Distance: {distance.toFixed(0)}m from warehouse</div>
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

        {currentStep === 3 && (
          <div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-lg"
            />

            <div className="space-y-3">
              {filteredProducts.map((product) => {
                const countItem = countItems.find(item => item.product_id === product.id);
                return (
                  <div key={product.id} className="bg-white border rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-600">{product.code}</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        defaultValue={countItem?.counted_quantity || product.system_quantity}
                        id={`count-${product.id}`}
                        className="flex-1 px-3 py-2 border rounded-lg"
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`count-${product.id}`) as HTMLInputElement;
                          handleCountProduct(product, parseInt(input.value) || 0);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                      >
                        Count
                      </button>
                    </div>
                    {countItem && countItem.variance !== 0 && (
                      <input
                        type="text"
                        placeholder="Reason for variance"
                        value={countItem.variance_reason || ''}
                        onChange={(e) => handleAddVarianceReason(product.id, e.target.value)}
                        className="w-full mt-2 px-3 py-2 border rounded-lg text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {countItems.length > 0 && (
              <button
                onClick={() => setCurrentStep(4)}
                className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg"
              >
                Continue
              </button>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <div className="bg-white rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-3">Photo (Required)</h3>
              {photo ? (
                <img src={photo} alt="Count" className="w-full rounded-lg" />
              ) : (
                <button
                  onClick={handleCapturePhoto}
                  className="w-full py-3 border-2 border-dashed rounded-lg"
                >
                  <Camera className="w-5 h-5 mx-auto" />
                </button>
              )}
            </div>

            <button
              onClick={handleSubmitCount}
              disabled={!photo}
              className="w-full bg-blue-600 text-white py-3 rounded-lg disabled:bg-gray-400"
            >
              Complete Count
            </button>
          </div>
        )}

        {currentStep === 5 && countSummary && (
          <div className="bg-white rounded-lg p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Count Complete!</h2>
            <p className="text-sm text-gray-600 mb-4">{countSummary.count_id}</p>
            <button
              onClick={() => navigate('/inventory')}
              className="w-full bg-blue-600 text-white py-3 rounded-lg"
            >
              Back to Inventory
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockCountWorkflowPage;
