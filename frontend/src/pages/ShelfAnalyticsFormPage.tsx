import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tradeMarketingService } from '../services/tradeMarketing.service';
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import SearchableSelect from '../components/ui/SearchableSelect'

const ShelfAnalyticsFormPage: React.FC = () => {
  const { toast } = useToast()
  const location = useLocation();
  const navigate = useNavigate();
  const { visit, store } = location.state || {};
  
  const [loading, setLoading] = useState(false);
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);
  const [formData, setFormData] = useState({
    category: 'beverages',
    totalShelfSpace: 10,
    brandShelfSpace: 3,
    totalFacings: 100,
    brandFacings: 25,
    shelfPosition: 'eye_level',
    planogramCompliance: 80,
    shelfPhoto: '',
    competitors: [] as any[]
  });

  const [calculatedMetrics, setCalculatedMetrics] = useState({
    shelfShare: 0,
    facingsShare: 0
  });

  useEffect(() => {
    if (!visit || !store) {
      navigate('/trade-marketing');
      return;
    }
  }, []);

  useEffect(() => {
    // Calculate percentages
    const shelfShare = formData.totalShelfSpace > 0 
      ? (formData.brandShelfSpace / formData.totalShelfSpace) * 100 
      : 0;
    const facingsShare = formData.totalFacings > 0 
      ? (formData.brandFacings / formData.totalFacings) * 100 
      : 0;
    
    setCalculatedMetrics({ shelfShare, facingsShare });
  }, [formData.totalShelfSpace, formData.brandShelfSpace, formData.totalFacings, formData.brandFacings]);

  const captureShelfPhoto = () => {
    const photoUrl = `https://storage.example.com/shelf/${Date.now()}.jpg`;
    setFormData({ ...formData, shelfPhoto: photoUrl });
    toast.info('📸 Shelf photo captured! (Simulated)');
  };

  const addCompetitor = () => {
    setShowAddCompetitor(true);
  };

  const confirmAddCompetitor = (input?: string) => {
    setShowAddCompetitor(false);
    if (!input) return;
    const parts = input.split(',');
    const competitorName = parts[0]?.trim();
    const facings = parseInt(parts[1]?.trim() || '10');
    if (competitorName) {
      setFormData({
        ...formData,
        competitors: [...formData.competitors, { name: competitorName, facings: isNaN(facings) ? 10 : facings }]
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.shelfPhoto) {
      toast.info('Please capture shelf photo');
      return;
    }

    setLoading(true);
    try {
      await tradeMarketingService.createShelfAnalytics({
        visitId: visit.id,
        storeId: store.id,
        category: formData.category,
        totalShelfSpaceMeters: formData.totalShelfSpace,
        brandShelfSpaceMeters: formData.brandShelfSpace,
        totalFacings: formData.totalFacings,
        brandFacings: formData.brandFacings,
        shelfPosition: formData.shelfPosition,
        planogramCompliance: formData.planogramCompliance,
        shelfPhotoUrl: formData.shelfPhoto,
        competitorAnalysis: formData.competitors
      });

      toast.success('✅ Shelf analytics recorded successfully!');
      navigate(-1);
    } catch (error) {
      console.error('Failed to create shelf analytics:', error);
      toast.error('Failed to record shelf analytics. Please try again.');
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
          <h1 className="text-2xl font-bold text-gray-900">Shelf Analytics</h1>
          <p className="text-gray-600">{store?.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Product Category *
            </label>
            <SearchableSelect
              options={[
                { value: 'beverages', label: 'Beverages' },
                { value: 'snacks', label: 'Snacks' },
                { value: 'dairy', label: 'Dairy' },
                { value: 'personal_care', label: 'Personal Care' },
                { value: 'household', label: 'Household' },
                { value: 'telecommunications', label: 'Telecommunications' },
                { value: 'other', label: 'Other' },
              ]}
              value={formData.category}
              placeholder="Beverages"
            />
          </div>

          {/* Shelf Space Measurement */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Shelf Space (meters)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Total Shelf Space: {formData.totalShelfSpace}m
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="0.5"
                  value={formData.totalShelfSpace}
                  onChange={(e) => setFormData({ ...formData, totalShelfSpace: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Brand Shelf Space: {formData.brandShelfSpace}m
                </label>
                <input
                  type="range"
                  min="0"
                  max={formData.totalShelfSpace}
                  step="0.5"
                  value={formData.brandShelfSpace}
                  onChange={(e) => setFormData({ ...formData, brandShelfSpace: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {calculatedMetrics.shelfShare.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Brand Shelf Share</div>
                </div>
              </div>
            </div>
          </div>

          {/* Facings Count */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Facings Count</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Total Facings</label>
                <input
                  type="number"
                  value={formData.totalFacings}
                  onChange={(e) => setFormData({ ...formData, totalFacings: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Brand Facings</label>
                <input
                  type="number"
                  value={formData.brandFacings}
                  onChange={(e) => setFormData({ ...formData, brandFacings: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {calculatedMetrics.facingsShare.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Brand Facings Share</div>
              </div>
            </div>
          </div>

          {/* Shelf Position */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Shelf Position *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'top', label: '⬆️ Top Shelf' },
                { value: 'eye_level', label: '👁️ Eye Level' },
                { value: 'waist_level', label: '🤝 Waist Level' },
                { value: 'bottom', label: '⬇️ Bottom Shelf' }
              ].map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, shelfPosition: pos.value })}
                  className={`p-3 border-2 rounded-lg text-center transition ${
                    formData.shelfPosition === pos.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-100 hover:border-blue-300'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Planogram Compliance */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Planogram Compliance: {formData.planogramCompliance}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.planogramCompliance}
              onChange={(e) => setFormData({ ...formData, planogramCompliance: parseInt(e.target.value) })}
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Competitor Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Competitor Brands
              </label>
              <button
                type="button"
                onClick={addCompetitor}
                className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
              >
                + Add
              </button>
            </div>
            {formData.competitors.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">
                No competitors added yet
              </div>
            ) : (
              <div className="space-y-2">
                {formData.competitors.map((comp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-surface-secondary rounded">
                    <span className="font-medium">{comp.name}</span>
                    <span className="text-gray-600">{comp.facings} facings</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shelf Photo */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Shelf Photo *
            </label>
            {formData.shelfPhoto ? (
              <div>
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📸</div>
                    <div className="text-sm text-gray-600">Photo Captured</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={captureShelfPhoto}
                  className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
                >
                  Retake Photo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={captureShelfPhoto}
                className="w-full aspect-video bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center hover:bg-blue-100 transition"
              >
                <div className="text-center">
                  <div className="text-5xl mb-2">📷</div>
                  <div className="text-lg font-semibold text-blue-600">
                    Tap to Capture Shelf Photo
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !formData.shelfPhoto}
            className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
          >
            {loading ? 'Recording...' : '✓ Record Shelf Analytics'}
          </button>
        </form>
      </div>
      <ConfirmDialog
        isOpen={showAddCompetitor}
        onClose={() => setShowAddCompetitor(false)}
        onConfirm={confirmAddCompetitor}
        title="Add Competitor"
        message="Enter competitor brand name and number of facings separated by comma (e.g. 'Brand X, 10')."
        confirmLabel="Add"
        variant="info"
        showReasonInput
        reasonPlaceholder="Brand name, facings (e.g. Coca-Cola, 10)"
        reasonRequired
      />
    </div>
  );
};

export default ShelfAnalyticsFormPage;
