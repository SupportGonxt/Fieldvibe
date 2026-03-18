import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, MapPin, CheckCircle, Camera, AlertCircle, 
  Navigation, ShoppingCart, DollarSign, FileText
} from 'lucide-react';
import { apiClient } from '../../services/api.service';
import { compressPhoto } from '../../utils/photo-compression';

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  credit_limit: number;
  outstanding_balance: number;
  latitude: number;
  longitude: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

const VanSalesWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsValidated, setGpsValidated] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const [deliveryPhoto, setDeliveryPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [changeGiven, setChangeGiven] = useState<number>(0);

  const [orderSummary, setOrderSummary] = useState<any>(null);

  const steps = [
    { number: 1, title: 'Customer', icon: ShoppingCart },
    { number: 2, title: 'GPS Check', icon: MapPin },
    { number: 3, title: 'Products', icon: Package },
    { number: 4, title: 'Delivery', icon: Camera },
    { number: 5, title: 'Complete', icon: CheckCircle }
  ];

  useEffect(() => {
    if (currentStep === 1) {
      loadCustomers();
    } else if (currentStep === 3) {
      loadProducts();
    }
  }, [currentStep]);

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

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/products', {
        params: { limit: 100 }
      });
      setProducts(response.data.products || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
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

        if (selectedCustomer) {
          const dist = calculateDistance(
            latitude,
            longitude,
            selectedCustomer.latitude,
            selectedCustomer.longitude
          );
          setDistance(dist);

          if (dist <= 50) {
            setGpsValidated(true);
            setCurrentStep(3);
          } else {
            setError(`You are ${dist.toFixed(0)}m away from customer. Please move closer (max 50m).`);
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

  const handleAddProduct = (product: Product) => {
    const existingItem = orderItems.find(item => item.product_id === product.id);
    
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price
      }]);
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.product_id !== productId));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveProduct(productId);
      return;
    }

    setOrderItems(orderItems.map(item =>
      item.product_id === productId
        ? { ...item, quantity, total: quantity * item.price }
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
            setDeliveryPhoto(event.target?.result as string);
          };
          reader.readAsDataURL(compressed);
        } catch {
          const reader = new FileReader();
          reader.onload = (event) => {
            setDeliveryPhoto(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    input.click();
  };

  const handleSubmitOrder = async () => {
    if (!selectedCustomer || !gpsLocation || orderItems.length === 0) {
      setError('Please complete all required steps');
      return;
    }

    try {
      setLoading(true);
      
      const orderData = {
        customer_id: selectedCustomer.id,
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        })),
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'cash' ? cashReceived : 0,
        change_given: paymentMethod === 'cash' ? changeGiven : 0,
        delivery_photo: deliveryPhoto,
        signature,
        gps_lat: gpsLocation.lat,
        gps_lng: gpsLocation.lng
      };

      const response = await apiClient.post('/van-sales/orders', orderData);
      
      setOrderSummary(response.data);
      setCurrentStep(5);
    } catch (err: any) {
      setError(err.message || 'Failed to submit order');
    } finally {
      setLoading(false);
    }
  };

  const orderTotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  useEffect(() => {
    if (paymentMethod === 'cash' && cashReceived > 0) {
      setChangeGiven(Math.max(0, cashReceived - orderTotal));
    }
  }, [cashReceived, orderTotal, paymentMethod]);

  return (
    <div className="min-h-screen bg-surface-secondary pb-20">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Van Sales Order</h1>
          <p className="text-sm text-gray-600 mt-1">Complete order workflow</p>
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
        {/* Step 1: Customer Selection */}
        {currentStep === 1 && (
          <div>
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
            />
            <div className="space-y-3">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="w-full bg-white border border-gray-100 rounded-lg p-4 text-left hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <h3 className="font-medium text-gray-900">{customer.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{customer.address}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-500">{customer.phone}</span>
                    <span className="text-sm font-medium text-gray-900">
                      Credit: R {customer.credit_limit?.toLocaleString() || 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: GPS Validation */}
        {currentStep === 2 && selectedCustomer && (
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
                <div>Accuracy: {gpsLocation.accuracy.toFixed(0)}m</div>
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

        {/* Step 3: Product Selection */}
        {currentStep === 3 && (
          <div>
            <input
              type="text"
              placeholder="Search products..."
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
            />

            {orderItems.length > 0 && (
              <div className="mb-4 bg-white rounded-lg p-4 border border-gray-100">
                <h3 className="font-medium text-gray-900 mb-3">Order Items ({orderItems.length})</h3>
                {orderItems.map((item) => (
                  <div key={item.product_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                      <p className="text-sm text-gray-600">R {item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                        className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                        className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"
                      >
                        +
                      </button>
                      <span className="ml-2 font-medium text-gray-900">R {item.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="text-lg font-bold text-gray-900">R {orderTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleAddProduct(product)}
                  className="w-full bg-white border border-gray-100 rounded-lg p-4 text-left hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{product.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">R {product.price.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Stock: {product.stock_quantity}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {orderItems.length > 0 && (
              <button
                onClick={() => setCurrentStep(4)}
                className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Continue to Delivery
              </button>
            )}
          </div>
        )}

        {/* Step 4: Delivery Confirmation */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3">Delivery Photo</h3>
              {deliveryPhoto ? (
                <div className="relative">
                  <img src={deliveryPhoto} alt="Delivery" className="w-full rounded-lg" />
                  <button
                    onClick={() => setDeliveryPhoto(null)}
                    className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-lg text-sm"
                  >
                    Retake
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCapturePhoto}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-600 hover:border-blue-500 hover:text-blue-600"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capture Photo
                </button>
              )}
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3">Payment Method</h3>
              <div className="flex space-x-3 mb-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 py-2 rounded-lg border-2 ${
                    paymentMethod === 'cash'
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('credit')}
                  className={`flex-1 py-2 rounded-lg border-2 ${
                    paymentMethod === 'credit'
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  Credit
                </button>
              </div>

              {paymentMethod === 'cash' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cash Received
                    </label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="p-3 bg-surface-secondary rounded-lg">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Order Total:</span>
                      <span className="font-medium">R {orderTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Change:</span>
                      <span className="font-medium text-green-600">R {changeGiven.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmitOrder}
              disabled={loading || !deliveryPhoto}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Submitting...' : 'Complete Order'}
            </button>
          </div>
        )}

        {/* Step 5: Order Summary */}
        {currentStep === 5 && orderSummary && (
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Order Complete!</h2>
            <p className="text-sm text-gray-600 mb-6">
              Order ID: {orderSummary.order_id || orderSummary.id}
            </p>

            <div className="bg-surface-secondary rounded-lg p-4 mb-6 text-left">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium text-gray-900">{selectedCustomer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium text-gray-900">{orderItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-medium text-gray-900">R {orderTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment:</span>
                  <span className="font-medium text-gray-900">{paymentMethod === 'cash' ? 'Cash' : 'Credit'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/van-sales')}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              Back to Van Sales
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VanSalesWorkflowPage;
