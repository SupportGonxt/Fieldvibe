import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, LayoutGrid } from 'lucide-react'
import { brandService } from '../../services/brand.service'

export default function BrandBoards() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: brand } = useQuery({
    queryKey: ['brand', id],
    queryFn: () => brandService.getBrand(id!),
  })

  const { data: boards = [], isLoading, isError } = useQuery({
    queryKey: ['brand-boards', id],
    queryFn: () => brandService.getBrandBoards(id!),
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/brands/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Brand
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{brand?.name} - Board Placements</h1>
            <p className="text-gray-600">Physical board placements for this brand</p>
          </div>
          <button
            onClick={() => navigate(`/field-operations/boards/create?brand_id=${id}`)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Board
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading board placements...</div>
        ) : boards.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <LayoutGrid className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No board placements found for this brand.</p>
            <button
              onClick={() => navigate(`/field-operations/boards/create?brand_id=${id}`)}
              className="mt-4 btn-primary"
            >
              Add First Board
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Board ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Placed Date
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
                {boards.map((board: any) => (
                  <tr key={board.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{board.board_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {board.location || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {board.customer_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {board.placed_date ? new Date(board.placed_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        board.status === 'active' ? 'bg-green-100 text-green-800' : 
                        board.status === 'removed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {board.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/field-operations/boards/${board.id}`)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
