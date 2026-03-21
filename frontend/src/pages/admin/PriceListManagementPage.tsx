import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, DollarSign, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { pricingService, PriceList } from '../../services/pricing.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

export default function PriceListManagementPage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
  const { toast } = useToast()
  const navigate = useNavigate()
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    loadPriceLists()
  }, [filterActive])

  const loadPriceLists = async () => {
    try {
      setLoading(true)
      const data = await pricingService.getPriceLists({ 
        is_active: filterActive,
        search: searchTerm 
      })
      setPriceLists(data)
    } catch (error) {
      console.error('Failed to load price lists:', error)
      toast.error('Failed to load price lists')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this price list?')) return
    
    try {
      await pricingService.deletePriceList(id)
      toast.success('Price list deleted successfully')
      loadPriceLists()
    } catch (error) {
      console.error('Failed to delete price list:', error)
      toast.error('Failed to delete price list')
    }
  }

  const handleSearch = () => {
    loadPriceLists()
  }

  const filteredPriceLists = priceLists.filter(priceList =>
    priceList.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (priceList.description && priceList.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price List Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage pricing for different customer types, regions, and channels</p>
        </div>
        <button
          onClick={() => navigate('/admin/price-lists/create')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Price List
        </button>
      </div>

      <div className="mb-4 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search price lists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <SearchableSelect
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          value={filterActive === undefined ? 'all' : filterActive ? 'active' : 'inactive'}
          onChange={(val) => setFilterActive(val === 'all' || !val ? undefined : val === 'active')}
          placeholder="All Status"
        />
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Channel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Currency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Effective Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPriceLists.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-lg font-medium">No price lists found</p>
                  <p className="text-sm">Create your first price list to get started</p>
                </td>
              </tr>
            ) : (
              filteredPriceLists.map((priceList) => (
                <tr key={priceList.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{priceList.name}</div>
                    {priceList.description && (
                      <div className="text-sm text-gray-500">{priceList.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {priceList.customer_type || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {priceList.channel || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {priceList.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(priceList.effective_start).toLocaleDateString()}</span>
                      {priceList.effective_end && (
                        <>
                          <span>-</span>
                          <span>{new Date(priceList.effective_end).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {priceList.priority}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      priceList.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {priceList.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => navigate(`/admin/price-lists/${priceList.id}`)}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                      title="View/Edit"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(priceList.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { pendingAction.action(); setConfirmOpen(false); }}
        title={pendingAction.title}
        message={pendingAction.message}
        confirmLabel="Confirm"
        variant="danger"
      />
    </div>
  )
}
