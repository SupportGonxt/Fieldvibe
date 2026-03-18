import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  BarChart3,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { fieldMarketingService, Board } from '../../services/field-marketing.service'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface BoardFormData {
  brand_id: string
  board_code: string
  board_name: string
  dimensions: {
    width: number
    height: number
    unit: string
  }
  material_type: string
  installation_type: string
  commission_rate: number
  min_coverage_percentage: number
  total_available: number
}

export default function BoardManagement() {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [deleteBoardId, setDeleteBoardId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingBoard, setEditingBoard] = useState<Board | null>(null)
  const [formData, setFormData] = useState<BoardFormData>({
    brand_id: '',
    board_code: '',
    board_name: '',
    dimensions: {
      width: 2.0,
      height: 1.5,
      unit: 'meters'
    },
    material_type: 'vinyl',
    installation_type: 'outdoor',
    commission_rate: 0,
    min_coverage_percentage: 5,
    total_available: 0
  })

  useEffect(() => {
    loadBoards()
  }, [])

  const loadBoards = async () => {
    try {
      setLoading(true)
      const response = await fieldMarketingService.getBoards()
      setBoards(response.data)
    } catch (error) {
      console.error('Error loading boards:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fieldMarketingService.createBoard(formData)
      setShowForm(false)
      resetForm()
      loadBoards()
    } catch (error) {
      console.error('Error creating board:', error)
    }
  }

  const handleUpdateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBoard) return
    
    try {
      await fieldMarketingService.updateBoard(editingBoard.id, formData)
      setShowForm(false)
      setEditingBoard(null)
      resetForm()
      loadBoards()
    } catch (error) {
      console.error('Error updating board:', error)
    }
  }

  const handleDeleteBoard = (id: string) => {
    setDeleteBoardId(id)
  }

  const confirmDeleteBoard = async () => {
    if (!deleteBoardId) return
    try {
      await fieldMarketingService.deleteBoard(deleteBoardId)
      loadBoards()
    } catch (error) {
      console.error('Error deleting board:', error)
    }
    setDeleteBoardId(null)
  }

  const resetForm = () => {
    setFormData({
      brand_id: '',
      board_code: '',
      board_name: '',
      dimensions: {
        width: 2.0,
        height: 1.5,
        unit: 'meters'
      },
      material_type: 'vinyl',
      installation_type: 'outdoor',
      commission_rate: 0,
      min_coverage_percentage: 5,
      total_available: 0
    })
  }

  const filteredBoards = boards.filter(board => {
    const matchesSearch = board.board_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         board.board_code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || board.status === filterStatus
    return matchesSearch && matchesFilter
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Board Management</h1>
          <p className="text-gray-600 mt-1">Manage brand boards for field installations</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingBoard(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Create Board
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Boards</p>
              <p className="text-2xl font-bold text-gray-900">{boards.length}</p>
            </div>
            <BarChart3 className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Boards</p>
              <p className="text-2xl font-bold text-green-600">
                {boards.filter(b => b.status === 'active').length}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Available</p>
              <p className="text-2xl font-bold text-gray-900">
                {boards.reduce((sum, b) => sum + b.total_available, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Installed</p>
              <p className="text-2xl font-bold text-purple-600">
                {boards.reduce((sum, b) => sum + b.total_installed, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search boards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>

      {/* Board Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingBoard ? 'Edit Board' : 'Create New Board'}
            </h2>
            <form onSubmit={editingBoard ? handleUpdateBoard : handleCreateBoard} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Board Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.board_code}
                    onChange={(e) => setFormData({ ...formData, board_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Board Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.board_name}
                    onChange={(e) => setFormData({ ...formData, board_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width (meters)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.dimensions.width}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      dimensions: { ...formData.dimensions, width: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (meters)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.dimensions.height}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      dimensions: { ...formData.dimensions, height: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Rate
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Type
                  </label>
                  <select
                    value={formData.material_type}
                    onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="vinyl">Vinyl</option>
                    <option value="metal">Metal</option>
                    <option value="digital">Digital</option>
                    <option value="led">LED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Installation Type
                  </label>
                  <select
                    value={formData.installation_type}
                    onChange={(e) => setFormData({ ...formData, installation_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="outdoor">Outdoor</option>
                    <option value="indoor">Indoor</option>
                    <option value="window">Window</option>
                    <option value="rooftop">Rooftop</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Coverage %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.min_coverage_percentage}
                    onChange={(e) => setFormData({ ...formData, min_coverage_percentage: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Available
                  </label>
                  <input
                    type="number"
                    value={formData.total_available}
                    onChange={(e) => setFormData({ ...formData, total_available: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingBoard(null)
                    resetForm()
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingBoard ? 'Update Board' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Boards List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Board
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dimensions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Commission
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Inventory
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
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Loading boards...
                </td>
              </tr>
            ) : filteredBoards.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No boards found
                </td>
              </tr>
            ) : (
              filteredBoards.map((board) => (
                <tr key={board.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{board.board_name}</div>
                      <div className="text-sm text-gray-500">{board.board_code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {board.dimensions ? 
                      `${board.dimensions.width} x ${board.dimensions.height} m` : 
                      'N/A'
                    }
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{board.material_type}</div>
                    <div className="text-xs text-gray-500">{board.installation_type}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${board.commission_rate.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      Available: {board.total_available}
                    </div>
                    <div className="text-xs text-gray-500">
                      Installed: {board.total_installed}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      board.status === 'active' ? 'bg-green-100 text-green-800' :
                      board.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {board.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setEditingBoard(board)
                        setFormData({
                          brand_id: board.brand_id,
                          board_code: board.board_code,
                          board_name: board.board_name,
                          dimensions: board.dimensions || { width: 2, height: 1.5, unit: 'meters' },
                          material_type: board.material_type || 'vinyl',
                          installation_type: board.installation_type || 'outdoor',
                          commission_rate: board.commission_rate,
                          min_coverage_percentage: board.min_coverage_percentage,
                          total_available: board.total_available
                        })
                        setShowForm(true)
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBoard(board.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        isOpen={deleteBoardId !== null}
        onClose={() => setDeleteBoardId(null)}
        onConfirm={confirmDeleteBoard}
        title="Delete Board"
        message="Are you sure you want to delete this board? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
