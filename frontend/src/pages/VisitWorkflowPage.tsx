import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fieldMarketingService } from '../services/field-marketing.service';
import { useToast } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const VisitWorkflowPage: React.FC = () => {
  const { toast } = useToast()
  const location = useLocation();
  const navigate = useNavigate();
  const { customer, location: gpsLocation } = location.state || {};
  
  const [visit, setVisit] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<'create' | 'boards' | 'products' | 'survey' | 'complete'>('create');
  const [loading, setLoading] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<number[]>([]);
  const [activities, setActivities] = useState({
    boards: 0,
    products: 0,
    surveys: 0
  });

  useEffect(() => {
    if (!customer || !gpsLocation) {
      navigate('/field-marketing/customer-selection');
      return;
    }
    createVisit();
  }, []);

  const createVisit = async () => {
    setLoading(true);
    try {
      const result = await fieldMarketingService.createVisit({
        customerId: customer.id,
        visitType: 'field_marketing',
        startLatitude: gpsLocation.latitude,
        startLongitude: gpsLocation.longitude,
        selectedBrands: []
      });
      setVisit(result.visit);
      loadBoards();
    } catch (error) {
      console.error('Failed to create visit:', error);
      toast.error('Failed to create visit. Please try again.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const loadBoards = async () => {
    try {
      const result = await fieldMarketingService.getBoards();
      setBoards(result.boards || []);
    } catch (error) {
      console.error('Failed to load boards:', error);
    }
  };

  const addBoardPlacement = () => {
    navigate('/field-marketing/board-placement', {
      state: { visit, customer, boards }
    });
  };

  const addProductDistribution = () => {
    navigate('/field-marketing/product-distribution', {
      state: { visit, customer }
    });
  };

  const completeVisit = () => {
    setShowCompleteDialog(true);
  };

  const confirmCompleteVisit = async (notes?: string) => {
    setShowCompleteDialog(false);
    setLoading(true);
    try {
      await fieldMarketingService.completeVisit(visit.id, {
        endLatitude: gpsLocation.latitude,
        endLongitude: gpsLocation.longitude,
        visitNotes: notes || undefined
      });
      
      toast.success('Visit completed successfully!');
      navigate('/field-marketing');
    } catch (error) {
      console.error('Failed to complete visit:', error);
      toast.error('Failed to complete visit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visit) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-lg text-gray-600">Starting visit...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              <div className="text-sm text-gray-600">
                Visit: {visit.visit_code} • Started: {new Date(visit.start_time).toLocaleTimeString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-green-600">In Progress</div>
              <div className="text-sm text-gray-600">{customer.code}</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-blue-50 p-2 rounded">
              <div className="text-2xl font-bold text-blue-600">{activities.boards}</div>
              <div className="text-xs text-gray-600">Boards</div>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <div className="text-2xl font-bold text-green-600">{activities.products}</div>
              <div className="text-xs text-gray-600">Products</div>
            </div>
            <div className="bg-purple-50 p-2 rounded">
              <div className="text-2xl font-bold text-purple-600">{activities.surveys}</div>
              <div className="text-xs text-gray-600">Surveys</div>
            </div>
          </div>
        </div>

        {/* Activities Menu */}
        <div className="space-y-3 mb-6">
          <button
            onClick={addBoardPlacement}
            className="w-full bg-white rounded-lg shadow p-6 hover:shadow-md transition text-left"
          >
            <div className="flex items-center">
              <div className="text-4xl mr-4">📋</div>
              <div className="flex-1">
                <div className="text-lg font-bold text-gray-900">Install Marketing Board</div>
                <div className="text-sm text-gray-600">
                  Place board, capture photo, earn commission
                </div>
              </div>
              <div className="text-blue-600 text-2xl">→</div>
            </div>
          </button>

          <button
            onClick={addProductDistribution}
            className="w-full bg-white rounded-lg shadow p-6 hover:shadow-md transition text-left"
          >
            <div className="flex items-center">
              <div className="text-4xl mr-4">📦</div>
              <div className="flex-1">
                <div className="text-lg font-bold text-gray-900">Distribute Products</div>
                <div className="text-sm text-gray-600">
                  SIM cards, phones, promotional items
                </div>
              </div>
              <div className="text-green-600 text-2xl">→</div>
            </div>
          </button>

          <button
            onClick={() => toast.info('Survey feature is not configured for this visit type')}
            className="w-full bg-white rounded-lg shadow p-6 hover:shadow-md transition text-left opacity-75"
          >
            <div className="flex items-center">
              <div className="text-4xl mr-4">📝</div>
              <div className="flex-1">
                <div className="text-lg font-bold text-gray-900">Complete Survey</div>
                <div className="text-sm text-gray-600">
                  Collect customer feedback
                </div>
              </div>
              <div className="text-purple-600 text-2xl">→</div>
            </div>
          </button>
        </div>

        {/* Complete Visit Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={completeVisit}
            disabled={loading}
            className="w-full bg-red-600 text-white py-4 rounded-lg hover:bg-red-700 disabled:opacity-50 font-bold text-lg"
          >
            {loading ? 'Completing...' : '✓ Complete Visit'}
          </button>
          <div className="text-center text-sm text-gray-500 mt-2">
            You can add more activities before completing
          </div>
        </div>

        {/* Visit Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-gray-700">
            <div className="font-semibold mb-2">💡 Visit Tips:</div>
            <ul className="space-y-1 text-xs">
              <li>• Take clear photos for board placements</li>
              <li>• Verify recipient ID for product distributions</li>
              <li>• Complete all planned activities before finishing</li>
              <li>• GPS location is recorded for each activity</li>
            </ul>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        onConfirm={confirmCompleteVisit}
        title="Complete Visit"
        message="Complete this visit? You cannot add more activities after completion. Add any final notes below (optional)."
        confirmLabel="Complete Visit"
        variant="warning"
        showReasonInput
        reasonPlaceholder="Add any final notes (optional)..."
      />
    </div>
  );
};

export default VisitWorkflowPage;
