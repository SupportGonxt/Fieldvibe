import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fieldMarketingService } from '../services/field-marketing.service';
import { useToast } from '../components/ui/Toast'

const BoardPlacementFormPage: React.FC = () => {
  const { toast } = useToast()
  const location = useLocation();
  const navigate = useNavigate();
  const { visit, customer, boards } = location.state || {};
  
  const [loading, setLoading] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<any>(null);
  const [formData, setFormData] = useState({
    placementPhoto: '',
    coveragePercentage: 50,
    qualityScore: 5,
    visibilityScore: 5,
    placementNotes: ''
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
        },
        (error) => console.error('GPS error:', error),
        { enableHighAccuracy: true }
      );
    }
  };

  const capturePhoto = () => {
    // Simulate photo capture - in production, this would open camera
    const photoUrl = `https://storage.example.com/boards/${Date.now()}.jpg`;
    setFormData({ ...formData, placementPhoto: photoUrl });
    toast.info('📸 Photo captured! (Simulated)');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBoard) {
      toast.info('Please select a board type');
      return;
    }

    if (!formData.placementPhoto) {
      toast.info('Please capture placement photo');
      return;
    }

    if (!currentLocation) {
      toast.info('GPS location not available');
      return;
    }

    setLoading(true);
    try {
      await fieldMarketingService.createBoardPlacement({
        visitId: visit.id,
        boardId: selectedBoard.id,
        customerId: customer.id,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        placementPhotoUrl: formData.placementPhoto,
        storefrontCoveragePercentage: formData.coveragePercentage,
        qualityScore: formData.qualityScore,
        visibilityScore: formData.visibilityScore,
        placementNotes: formData.placementNotes
      });

      toast.info(`Board placement recorded! Commission: $${selectedBoard.commission_rate || 0}`);
      navigate(-1);
    } catch (error) {
      console.error('Failed to create board placement:', error);
      toast.error('Failed to record board placement. Please try again.');
    } finally {
      setLoading(false);
    }
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
            ← Back to Visit
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Board Placement</h1>
          <p className="text-gray-600">{customer?.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Board Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Board Type *
            </label>
            <div className="space-y-2">
              {boards?.map((board: any) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => setSelectedBoard(board)}
                  className={`w-full p-4 border-2 rounded-lg text-left transition ${
                    selectedBoard?.id === board.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-100 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{board.board_name}</div>
                      <div className="text-sm text-gray-600">
                        {board.board_type} • {board.board_size}
                      </div>
                      <div className="text-sm text-gray-600">
                        Brand: {board.brand_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        ${board.commission_rate}
                      </div>
                      <div className="text-xs text-gray-600">commission</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Photo Capture */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Placement Photo *
            </label>
            {formData.placementPhoto ? (
              <div className="relative">
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📸</div>
                    <div className="text-sm text-gray-600">Photo Captured</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
                >
                  Retake Photo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={capturePhoto}
                className="w-full aspect-video bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center hover:bg-blue-100 transition"
              >
                <div className="text-center">
                  <div className="text-5xl mb-2">📷</div>
                  <div className="text-lg font-semibold text-blue-600">
                    Tap to Capture Photo
                  </div>
                  <div className="text-sm text-gray-600">
                    Show full storefront with board placement
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Coverage Percentage */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Storefront Coverage: {formData.coveragePercentage}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.coveragePercentage}
              onChange={(e) => setFormData({ ...formData, coveragePercentage: parseInt(e.target.value) })}
              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Quality Score */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Installation Quality: {formData.qualityScore}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.qualityScore}
              onChange={(e) => setFormData({ ...formData, qualityScore: parseInt(e.target.value) })}
              className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Poor</span>
              <span>Good</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Visibility Score */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Visibility Score: {formData.visibilityScore}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.visibilityScore}
              onChange={(e) => setFormData({ ...formData, visibilityScore: parseInt(e.target.value) })}
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Hidden</span>
              <span>Visible</span>
              <span>Prominent</span>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Placement Notes (Optional)
            </label>
            <textarea
              value={formData.placementNotes}
              onChange={(e) => setFormData({ ...formData, placementNotes: e.target.value })}
              rows={4}
              placeholder="Any additional notes about the placement..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !selectedBoard || !formData.placementPhoto}
            className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
          >
            {loading ? 'Recording...' : `✓ Record Placement${selectedBoard ? ` (+$${selectedBoard.commission_rate})` : ''}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BoardPlacementFormPage;
