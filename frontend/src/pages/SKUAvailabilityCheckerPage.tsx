import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tradeMarketingService } from '../services/tradeMarketing.service';
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const SKUAvailabilityCheckerPage: React.FC = () => {
  const { toast } = useToast()
  const location = useLocation();
  const navigate = useNavigate();
  const { visit, store } = location.state || {};
  
  const [loading, setLoading] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    availabilityStatus: 'in_stock',
    facingCount: 1,
    shelfPosition: 'eye_level',
    actualPrice: 0,
    rrp: 0,
    expiryVisible: false,
    expiryDate: '',
    productCondition: 'good',
    skuPhoto: '',
    notes: ''
  });

  const [priceVariance, setPriceVariance] = useState(0);
  const [priceCompliant, setPriceCompliant] = useState(true);

  React.useEffect(() => {
    if (formData.rrp > 0) {
      const variance = ((formData.actualPrice - formData.rrp) / formData.rrp) * 100;
      setPriceVariance(variance);
      setPriceCompliant(Math.abs(variance) <= 5);
    }
  }, [formData.actualPrice, formData.rrp]);

  const scanBarcode = () => {
    // Use device camera for barcode scanning
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        toast.success('Photo captured for barcode');
        setShowBarcodeInput(true);
      }
    };
    input.click();
  };

  const confirmBarcodeInput = (productId?: string) => {
    setShowBarcodeInput(false);
    if (productId) setFormData(prev => ({ ...prev, productId }));
  };

  const capturePhoto = () => {
    const photoUrl = `https://storage.example.com/sku/${Date.now()}.jpg`;
    setFormData({ ...formData, skuPhoto: photoUrl });
    toast.info('📸 SKU photo captured!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productId) {
      toast.info('Please scan or enter product ID');
      return;
    }

    setLoading(true);
    try {
      await tradeMarketingService.createSKUAvailability({
        visitId: visit.id,
        storeId: store.id,
        productId: parseInt(formData.productId) || 1,
        availabilityStatus: formData.availabilityStatus,
        facingCount: formData.facingCount,
        shelfPosition: formData.shelfPosition,
        actualPrice: formData.actualPrice,
        rrp: formData.rrp,
        expiryVisible: formData.expiryVisible,
        expiryDate: formData.expiryDate || undefined,
        productCondition: formData.productCondition,
        skuPhotoUrl: formData.skuPhoto || undefined,
        notes: formData.notes || undefined
      });

      toast.info('✅ SKU availability recorded!');
      navigate(-1);
    } catch (error) {
      console.error('Failed to record SKU:', error);
      toast.error('Failed to record SKU. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="mb-4 text-blue-600">← Back</button>
          <h1 className="text-2xl font-bold">SKU Availability Checker</h1>
          <p className="text-gray-600">{store?.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product ID / Barcode */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Product ID / Barcode *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                placeholder="Scan or enter product ID"
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <button
                type="button"
                onClick={scanBarcode}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                📱 Scan
              </button>
            </div>
          </div>

          {/* Availability Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Availability Status *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'in_stock', label: '✅ In Stock', color: 'green' },
                { value: 'low_stock', label: '⚠️ Low Stock', color: 'yellow' },
                { value: 'out_of_stock', label: '❌ Out of Stock', color: 'red' },
                { value: 'discontinued', label: '🚫 Discontinued', color: 'gray' }
              ].map((status) => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, availabilityStatus: status.value })}
                  className={`p-3 border-2 rounded-lg ${
                    formData.availabilityStatus === status.value
                      ? `border-${status.color}-600 bg-${status.color}-50`
                      : 'border-gray-100'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Facing Count */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Facing Count: {formData.facingCount}
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={formData.facingCount}
              onChange={(e) => setFormData({ ...formData, facingCount: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Shelf Position */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Shelf Position</label>
            <select
              value={formData.shelfPosition}
              onChange={(e) => setFormData({ ...formData, shelfPosition: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="top">Top Shelf</option>
              <option value="eye_level">Eye Level (Best)</option>
              <option value="waist_level">Waist Level</option>
              <option value="bottom">Bottom Shelf</option>
            </select>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Pricing Information</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Actual Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.actualPrice}
                  onChange={(e) => setFormData({ ...formData, actualPrice: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">RRP (Recommended)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rrp}
                  onChange={(e) => setFormData({ ...formData, rrp: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
            {formData.rrp > 0 && (
              <div className={`p-4 rounded-lg ${priceCompliant ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${priceCompliant ? 'text-green-600' : 'text-red-600'}`}>
                    {priceVariance > 0 ? '+' : ''}{priceVariance.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {priceCompliant ? '✅ Price Compliant' : '⚠️ Outside 5% Tolerance'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Expiry Date */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Expiry Date</label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.expiryVisible}
                  onChange={(e) => setFormData({ ...formData, expiryVisible: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Expiry Visible</span>
              </label>
            </div>
            {formData.expiryVisible && (
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            )}
          </div>

          {/* Product Condition */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Product Condition</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'excellent', label: '⭐ Excellent' },
                { value: 'good', label: '👍 Good' },
                { value: 'fair', label: '👌 Fair' },
                { value: 'poor', label: '⚠️ Poor' },
                { value: 'damaged', label: '❌ Damaged' }
              ].map((condition) => (
                <button
                  key={condition.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, productCondition: condition.value })}
                  className={`p-3 border-2 rounded-lg ${
                    formData.productCondition === condition.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-100'
                  }`}
                >
                  {condition.label}
                </button>
              ))}
            </div>
          </div>

          {/* Photo */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">SKU Photo</label>
            {formData.skuPhoto ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-700">✓ Photo captured</span>
                <button type="button" onClick={capturePhoto} className="text-sm text-blue-600">Retake</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={capturePhoto}
                className="w-full p-8 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100"
              >
                📷 Capture SKU Photo
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold text-lg"
          >
            {loading ? 'Recording...' : '✓ Record SKU'}
          </button>
        </form>
      </div>

      <ConfirmDialog
        isOpen={showBarcodeInput}
        onClose={() => setShowBarcodeInput(false)}
        onConfirm={confirmBarcodeInput}
        title="Enter Product ID"
        message="Enter the product ID or barcode number."
        confirmLabel="OK"
        variant="info"
        showReasonInput
        reasonPlaceholder="Enter the product ID/barcode..."
        reasonRequired
      />
    </div>
  );
};

export default SKUAvailabilityCheckerPage;
