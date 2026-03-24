import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createMockBoardPlacement, mockApiResponse } from '../utils/test-utils'
import BoardPlacementPage from '../../pages/field-agents/BoardPlacementPage'

// Mock the API service
vi.mock('../../services/api.service', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

describe('BoardPlacementPage', () => {
  const mockPlacements = [
    createMockBoardPlacement({ id: 'BB-001', type: 'billboard' }),
    createMockBoardPlacement({ id: 'PO-002', type: 'poster' }),
    createMockBoardPlacement({ id: 'BN-003', type: 'banner' }),
  ]

  const mockCampaigns = [
    { id: 'CAMP-001', name: 'Summer Sale 2024', client: 'Fashion Retailer Inc', status: 'active' },
    { id: 'CAMP-002', name: 'Tech Product Launch', client: 'TechCorp Solutions', status: 'active' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    const { apiService } = require('../../services/api.service')
    apiService.get.mockImplementation((endpoint) => {
      if (endpoint.includes('placements')) {
        return Promise.resolve(mockApiResponse({ placements: mockPlacements }))
      }
      if (endpoint.includes('campaigns')) {
        return Promise.resolve(mockApiResponse({ campaigns: mockCampaigns }))
      }
      return Promise.resolve(mockApiResponse({}))
    })
  })

  it('renders board placement page with header and description', async () => {
    render(<BoardPlacementPage />)
    
    expect(screen.getByRole('heading', { name: /board placement/i })).toBeInTheDocument()
    expect(screen.getByText(/manage advertising board placements/i)).toBeInTheDocument()
  })

  it('displays campaign overview cards', async () => {
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/summer sale 2024/i)).toBeInTheDocument()
      expect(screen.getByText(/tech product launch/i)).toBeInTheDocument()
    })

    // Check campaign details
    expect(screen.getByText(/fashion retailer inc/i)).toBeInTheDocument()
    expect(screen.getByText(/techcorp solutions/i)).toBeInTheDocument()
  })

  it('shows search and filter controls', async () => {
    render(<BoardPlacementPage />)
    
    expect(screen.getByPlaceholderText(/search by board id/i)).toBeInTheDocument()
    expect(screen.getByText(/all status/i)).toBeInTheDocument()
    expect(screen.getByText(/all campaigns/i)).toBeInTheDocument()
  })

  it('displays board placement table with data', async () => {
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      // Check table headers
      expect(screen.getByText(/board details/i)).toBeInTheDocument()
      expect(screen.getByText(/location/i)).toBeInTheDocument()
      expect(screen.getByText(/campaign/i)).toBeInTheDocument()
      expect(screen.getByText(/agent/i)).toBeInTheDocument()
      expect(screen.getByText(/status/i)).toBeInTheDocument()
      expect(screen.getByText(/performance/i)).toBeInTheDocument()
    })

    // Check if placements are displayed
    expect(screen.getByText('BB-001')).toBeInTheDocument()
    expect(screen.getByText('billboard')).toBeInTheDocument()
  })

  it('allows searching for board placements', async () => {
    const user = userEvent.setup()
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText('BB-001')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search by board id/i)
    await user.type(searchInput, 'BB-001')
    
    expect(searchInput).toHaveValue('BB-001')
  })

  it('filters placements by status', async () => {
    const user = userEvent.setup()
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText('BB-001')).toBeInTheDocument()
    })

    // Click on status filter
    const statusFilter = screen.getByText(/all status/i)
    await user.click(statusFilter)
    
    // Should show status options
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Removed')).toBeInTheDocument()
    expect(screen.getByText('Damaged')).toBeInTheDocument()
  })

  it('filters placements by campaign', async () => {
    const user = userEvent.setup()
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText('BB-001')).toBeInTheDocument()
    })

    // Click on campaign filter
    const campaignFilter = screen.getByText(/all campaigns/i)
    await user.click(campaignFilter)
    
    // Should show campaign options
    expect(screen.getByText('Summer Sale 2024')).toBeInTheDocument()
    expect(screen.getByText('Tech Product Launch')).toBeInTheDocument()
  })

  it('displays performance metrics for placements', async () => {
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/score:/i)).toBeInTheDocument()
      expect(screen.getByText(/impressions/i)).toBeInTheDocument()
    })
  })

  it('shows add placement button', async () => {
    render(<BoardPlacementPage />)
    
    expect(screen.getByRole('button', { name: /add placement/i })).toBeInTheDocument()
  })

  it('displays action buttons for each placement', async () => {
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      // Should have action buttons (view, edit, delete) for each placement
      const actionButtons = screen.getAllByRole('button')
      expect(actionButtons.length).toBeGreaterThan(3) // At least add button + action buttons
    })
  })

  it('handles API errors gracefully', async () => {
    const { apiService } = require('../../services/api.service')
    apiService.get.mockRejectedValue(new Error('API Error'))
    
    render(<BoardPlacementPage />)
    
    // Should handle error state
    await waitFor(() => {
      expect(screen.queryByText('BB-001')).not.toBeInTheDocument()
    })
  })

  it('shows campaign progress bars', async () => {
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/progress:/i)).toBeInTheDocument()
      // Progress should be displayed as fraction (e.g., "18/25")
      expect(screen.getByText(/18/)).toBeInTheDocument()
      expect(screen.getByText(/25/)).toBeInTheDocument()
    })
  })

  it('displays campaign budgets', async () => {
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/budget:/i)).toBeInTheDocument()
      expect(screen.getByText(/\$50,000\.00/)).toBeInTheDocument()
      expect(screen.getByText(/\$75,000\.00/)).toBeInTheDocument()
    })
  })

  it('shows placement verification requirements', async () => {
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/verification required/i)).toBeInTheDocument()
    })
  })

  it('displays board types correctly', async () => {
    render(<BoardPlacementPage />)
    
    await waitFor(() => {
      expect(screen.getByText('billboard')).toBeInTheDocument()
      expect(screen.getByText('poster')).toBeInTheDocument()
      expect(screen.getByText('banner')).toBeInTheDocument()
    })
  })
})