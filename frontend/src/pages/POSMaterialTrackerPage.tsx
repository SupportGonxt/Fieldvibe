import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Package, QrCode, Search, Calendar, CheckCircle2, AlertCircle, Upload, Download } from 'lucide-react';
import { useToast } from '../components/ui/Toast'
import SearchableSelect from '../components/ui/SearchableSelect'
import { apiClient } from '../services/api.service'
import toast from 'react-hot-toast'

interface POSMaterial {
  id: number;
  name: string;
  type: string;
  brand: string;
  dimensions: string;
  stockLevel: number;
  cost: number;
}

interface Installation {
  id?: number;
  materialId: number;
  materialName: string;
  storeId: number;
  storeName: string;
  installationDate: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  location: string;
  gpsCoordinates: { latitude: number; longitude: number };
  photosBefore: string[];
  photosAfter: string[];
  qrCode: string;
  installedBy: string;
  notes: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

const POSMaterialTrackerPage: React.FC = () => {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'library' | 'installation' | 'history'>('library');
  const [materials, setMaterials] = useState<POSMaterial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<POSMaterial | null>(null);
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  
  const [formData, setFormData] = useState<Partial<Installation>>({
    condition: 'good',
    location: '',
    notes: '',
    photosBefore: [],
    photosAfter: [],
    verificationStatus: 'pending'
  });

  // Track blob URLs for cleanup
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    loadMaterialLibrary();
    loadInstallationHistory();
    getCurrentLocation();

    // Cleanup blob URLs on unmount
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  const loadMaterialLibrary = async () => {
    try {
      const response = await apiClient.get('/trade-marketing-new/materials/library');
      setMaterials(response.data?.materials || []);
    } catch (error) {
      console.error('Error loading material library:', error);
    }
  };

  const loadInstallationHistory = async () => {
    try {
      const response = await apiClient.get('/trade-marketing-new/pos-materials');
      setInstallations(response.data?.installations || []);
    } catch (error) {
      console.error('Error loading installation history:', error);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('GPS Error:', error);
        }
      );
    }
  };

  const handleMaterialSelect = (material: POSMaterial) => {
    setSelectedMaterial(material);
    setShowInstallForm(true);
    setFormData({
      ...formData,
      materialId: material.id,
      materialName: material.name
    });
  };

  const handlePhotoCapture = (type: 'before' | 'after') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement)?.files?.[0];
      if (file) {
        const photoUrl = URL.createObjectURL(file);
        blobUrlsRef.current.push(photoUrl);
        if (type === 'before') {
          setFormData(prev => ({
            ...prev,
            photosBefore: [...(prev.photosBefore || []), photoUrl]
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            photosAfter: [...(prev.photosAfter || []), photoUrl]
          }));
        }
        toast.success(`${type === 'before' ? 'Before' : 'After'} photo captured`);
      }
    };
    input.click();
  };

  const handleQRScan = () => {
    // Simulate QR code scan
    const qrCode = `QR-${selectedMaterial?.type?.substring(0, 3).toUpperCase()}-${Date.now()}`;
    setFormData({ ...formData, qrCode });
    toast.info(`QR Code Scanned: ${qrCode}`);
  };

  const handleSubmitInstallation = async () => {
    if (!selectedMaterial || !formData.location) {
      toast.error('Please fill all required fields');
      return;
    }

    const installationData = {
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.name,
      storeId: 0, // Should come from store selection
      storeName: 'Selected Store',
      condition: formData.condition || 'good',
      location: formData.location || '',
      gpsCoordinates: gpsLocation || { latitude: 0, longitude: 0 },
      photosBefore: formData.photosBefore || [],
      photosAfter: formData.photosAfter || [],
      qrCode: formData.qrCode || '',
      notes: formData.notes || ''
    };

    try {
      const response = await apiClient.post('/trade-marketing-new/pos-materials', installationData);

      toast.success('Installation recorded successfully!');
      await loadInstallationHistory(); // Reload list
        setShowInstallForm(false);
        setSelectedMaterial(null);
        setFormData({
          condition: 'good',
          location: '',
          notes: '',
          photosBefore: [],
          photosAfter: [],
          verificationStatus: 'pending'
        });
    } catch (error) {
      console.error('Error submitting installation:', error);
      toast.error('Error recording installation');
    }
  };

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    material.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    material.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getConditionColor = (condition: string) => {
    const colors = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      fair: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-orange-100 text-orange-800',
      damaged: 'bg-red-100 text-red-800'
    };
    return colors[condition as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getVerificationColor = (status: string) => {
    const colors = {
      verified: 'text-green-600',
      pending: 'text-yellow-600',
      rejected: 'text-red-600'
    };
    return colors[status as keyof typeof colors] || 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-surface-secondary p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-8 h-8 text-purple-600" />
                POS Material Tracker
              </h1>
              <p className="text-gray-600 mt-1">Manage and track POS material installations</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast.success('Report exported')} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>

          {/* GPS Status */}
          {gpsLocation && (
            <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
              <MapPin className="w-4 h-4" />
              GPS Active: {gpsLocation.latitude.toFixed(4)}, {gpsLocation.longitude.toFixed(4)}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-100">
            <nav className="flex">
              {[
                { id: 'library', label: 'Material Library', count: materials.length },
                { id: 'installation', label: 'New Installation', count: null },
                { id: 'history', label: 'Installation History', count: installations.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count !== null && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Material Library Tab */}
        {activeTab === 'library' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search materials by name, type, or brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Materials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMaterials.map(material => (
                <div key={material.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{material.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{material.brand}</p>
                    </div>
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                      {material.type}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span>Dimensions:</span>
                      <span className="font-medium">{material.dimensions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stock Level:</span>
                      <span className={`font-medium ${material.stockLevel < 20 ? 'text-red-600' : 'text-green-600'}`}>
                        {material.stockLevel} units
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost:</span>
                      <span className="font-medium">₹{material.cost.toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleMaterialSelect(material)}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    Install Material
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Installation Form Tab */}
        {activeTab === 'installation' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            {!selectedMaterial ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Please select a material from the library first</p>
                <button
                  onClick={() => setActiveTab('library')}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Browse Material Library
                </button>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold mb-6">Installation Details: {selectedMaterial.name}</h2>

                <div className="space-y-6">
                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Installation Location *
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g., Store entrance - right side"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  {/* Condition */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Material Condition *
                    </label>
                    <SearchableSelect
                      options={[
                        { value: 'excellent', label: 'Excellent' },
                        { value: 'good', label: 'Good' },
                        { value: 'fair', label: 'Fair' },
                        { value: 'poor', label: 'Poor' },
                        { value: 'damaged', label: 'Damaged' },
                      ]}
                      value={formData.condition}
                      placeholder="Excellent"
                    />
                  </div>

                  {/* QR Code Scan */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      QR Code Verification
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.qrCode || ''}
                        readOnly
                        placeholder="Scan QR code..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-surface-secondary"
                      />
                      <button
                        onClick={handleQRScan}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                      >
                        <QrCode className="w-4 h-4" />
                        Scan
                      </button>
                    </div>
                  </div>

                  {/* Photos Before */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Photos Before Installation
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePhotoCapture('before')}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Take Photo ({formData.photosBefore?.length || 0})
                      </button>
                      <div className="flex gap-2">
                        {formData.photosBefore?.map((photo, idx) => (
                          <div key={idx} className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs">
                            Photo {idx + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Photos After */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Photos After Installation
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePhotoCapture('after')}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        Take Photo ({formData.photosAfter?.length || 0})
                      </button>
                      <div className="flex gap-2">
                        {formData.photosAfter?.map((photo, idx) => (
                          <div key={idx} className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs">
                            Photo {idx + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Installation Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional notes about the installation..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSubmitInstallation}
                      className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                    >
                      Submit Installation
                    </button>
                    <button
                      onClick={() => {
                        setShowInstallForm(false);
                        setSelectedMaterial(null);
                      }}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Installation History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="space-y-4">
              {installations.map(installation => (
                <div key={installation.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{installation.materialName}</h3>
                      <p className="text-sm text-gray-600 mt-1">{installation.storeName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {installation.verificationStatus === 'verified' && (
                        <CheckCircle2 className={`w-5 h-5 ${getVerificationColor(installation.verificationStatus)}`} />
                      )}
                      {installation.verificationStatus === 'pending' && (
                        <AlertCircle className={`w-5 h-5 ${getVerificationColor(installation.verificationStatus)}`} />
                      )}
                      <span className={`text-sm ${getVerificationColor(installation.verificationStatus)}`}>
                        {installation.verificationStatus.charAt(0).toUpperCase() + installation.verificationStatus.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Date:</span>
                      <p className="font-medium">{installation.installationDate}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Location:</span>
                      <p className="font-medium">{installation.location}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Condition:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getConditionColor(installation.condition)}`}>
                        {installation.condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Installed By:</span>
                      <p className="font-medium">{installation.installedBy}</p>
                    </div>
                  </div>

                  {installation.notes && (
                    <p className="text-sm text-gray-600 mb-3 italic">"{installation.notes}"</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      {installation.photosBefore.length + installation.photosAfter.length} photos
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {installation.gpsCoordinates.latitude.toFixed(4)}, {installation.gpsCoordinates.longitude.toFixed(4)}
                    </span>
                    {installation.qrCode && (
                      <span className="flex items-center gap-1">
                        <QrCode className="w-3 h-3" />
                        {installation.qrCode}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSMaterialTrackerPage;
