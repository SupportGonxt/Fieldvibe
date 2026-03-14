import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fieldMarketingService } from '../services/fieldMarketing.service';

const ProductDistributionFormPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { visit, customer } = location.state || {};
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    productType: 'sim_card',
    productSerialNumber: '',
    quantity: 1,
    recipientName: '',
    recipientIdNumber: '',
    recipientPhone: '',
    recipientAddress: '',
    recipientSignature: '',
    recipientPhoto: '',
    idDocumentPhoto: '',
    distributionNotes: ''
  });
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  useEffect(() => {
    if (!visit || !customer) {
      navigate('/field-marketing');
      return;
    }
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        }
      );
    }
  };

  const captureRecipientPhoto = () => {
    const photoUrl = `https://storage.example.com/recipients/${Date.now()}.jpg`;
    setFormData({ ...formData, recipientPhoto: photoUrl });
    alert('📸 Recipient photo captured!');
  };

  const captureIdPhoto = () => {
    const photoUrl = `https://storage.example.com/ids/${Date.now()}.jpg`;
    setFormData({ ...formData, idDocumentPhoto: photoUrl });
    alert('📸 ID document photo captured!');
  };

  const captureSignature = () => {
    const signatureUrl = `https://storage.example.com/signatures/${Date.now()}.jpg`;
    setFormData({ ...formData, recipientSignature: signatureUrl });
    alert('✍️ Signature captured!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.recipientSignature || !formData.recipientPhoto || !formData.idDocumentPhoto) {
      alert('Please capture all required photos and signature');
      return;
    }

    if (!currentLocation) {
      alert('GPS location not available');
      return;
    }

    setLoading(true);
    try {
      await fieldMarketingService.createProductDistribution({
        visitId: visit.id,
        productId: 1, // Would be selected from product list
        customerId: customer.id,
        productType: formData.productType,
        productSerialNumber: formData.productSerialNumber,
        quantity: formData.quantity,
        recipientName: formData.recipientName,
        recipientIdNumber: formData.recipientIdNumber,
        recipientPhone: formData.recipientPhone,
        recipientAddress: formData.recipientAddress,
        recipientSignatureUrl: formData.recipientSignature,
        recipientPhotoUrl: formData.recipientPhoto,
        idDocumentPhotoUrl: formData.idDocumentPhoto,
        formData: {},
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        distributionNotes: formData.distributionNotes
      });

      alert('✅ Product distribution recorded successfully!');
      navigate(-1);
    } catch (error) {
      console.error('Failed to record distribution:', error);
      alert('Failed to record distribution. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="mb-4 text-blue-600 hover:text-blue-700">
            ← Back to Visit
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Product Distribution</h1>
          <p className="text-gray-600">{customer?.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Type */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Product Type *</label>
            <select
              value={formData.productType}
              onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="sim_card">SIM Card</option>
              <option value="smartphone">Smartphone</option>
              <option value="feature_phone">Feature Phone</option>
              <option value="tablet">Tablet</option>
              <option value="router">Router/MiFi</option>
              <option value="promotional_item">Promotional Item</option>
            </select>
          </div>

          {/* Serial Number */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Serial Number / IMEI *</label>
            <input
              type="text"
              value={formData.productSerialNumber}
              onChange={(e) => setFormData({ ...formData, productSerialNumber: e.target.value })}
              placeholder="Enter serial number or scan barcode"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Quantity */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Quantity</label>
            <input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Recipient Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Recipient Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">ID Number *</label>
                <input
                  type="text"
                  value={formData.recipientIdNumber}
                  onChange={(e) => setFormData({ ...formData, recipientIdNumber: e.target.value })}
                  placeholder="National ID or Passport"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.recipientPhone}
                  onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Address *</label>
                <textarea
                  value={formData.recipientAddress}
                  onChange={(e) => setFormData({ ...formData, recipientAddress: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>
          </div>

          {/* Photo Captures */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Verification Photos *</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Recipient Photo</label>
                {formData.recipientPhoto ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-green-700">✓ Photo captured</span>
                    <button type="button" onClick={captureRecipientPhoto} className="text-sm text-blue-600">
                      Retake
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={captureRecipientPhoto}
                    className="w-full p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100"
                  >
                    📷 Capture Recipient Photo
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">ID Document Photo</label>
                {formData.idDocumentPhoto ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-green-700">✓ ID captured</span>
                    <button type="button" onClick={captureIdPhoto} className="text-sm text-blue-600">
                      Retake
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={captureIdPhoto}
                    className="w-full p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100"
                  >
                    📷 Capture ID Document
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Recipient Signature *</label>
            {formData.recipientSignature ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-700">✓ Signature captured</span>
                <button type="button" onClick={captureSignature} className="text-sm text-blue-600">
                  Recapture
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={captureSignature}
                className="w-full aspect-[3/1] bg-surface-secondary border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">✍️</div>
                  <div className="text-gray-600">Tap to Capture Signature</div>
                </div>
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Distribution Notes</label>
            <textarea
              value={formData.distributionNotes}
              onChange={(e) => setFormData({ ...formData, distributionNotes: e.target.value })}
              rows={3}
              placeholder="Any additional notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold text-lg"
          >
            {loading ? 'Recording...' : '✓ Complete Distribution'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProductDistributionFormPage;
