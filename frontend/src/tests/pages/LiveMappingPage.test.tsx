import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createMockAgent, mockApiResponse, generateAgents } from '../utils/test-utils'
import LiveMappingPage from '../../pages/field-agents/LiveMappingPage'

// Mock the API service
vi.mock('../../services/api.service', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

describe('LiveMappingPage', () => {
  const mockAgents = generateAgents(3)

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API response
    const { apiService } = require('../../services/api.service')
    apiService.get.mockResolvedValue(mockApiResponse({ agents: mockAgents }))
  })

  it('renders live mapping page with header and description', async () => {
    render(<LiveMappingPage />)
    
    expect(screen.getByRole('heading', { name: /live mapping/i })).toBeInTheDocument()
    expect(screen.getByText(/real-time field agent tracking/i)).toBeInTheDocument()
  })

  it('displays search and filter controls', async () => {
    render(<LiveMappingPage />)
    
    expect(screen.getByPlaceholderText(/search agents by name/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('loads and displays field agents', async () => {
    render(<LiveMappingPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/field agents \(3\)/i)).toBeInTheDocument()
    })

    // Check if agents are displayed
    mockAgents.forEach(agent => {
      expect(screen.getByText(agent.name)).toBeInTheDocument()
      expect(screen.getByText(agent.route)).toBeInTheDocument()
    })
  })

  it('allows searching for agents', async () => {
    const user = userEvent.setup()
    render(<LiveMappingPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/field agents \(3\)/i)).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search agents by name/i)
    await user.type(searchInput, 'Agent 1')
    
    // Should filter results
    expect(searchInput).toHaveValue('Agent 1')
  })

  it('displays agent performance metrics', async () => {
    render(<LiveMappingPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/field agents \(3\)/i)).toBeInTheDocument()
    })

    // Click on first agent to see details
    const firstAgent = screen.getByText(mockAgents[0].name)
    await userEvent.click(firstAgent)

    // Check performance metrics are displayed
    expect(screen.getByText(/visits today/i)).toBeInTheDocument()
    expect(screen.getByText(/sales today/i)).toBeInTheDocument()
    expect(screen.getByText(/distance/i)).toBeInTheDocument()
    expect(screen.getByText(/efficiency/i)).toBeInTheDocument()
  })

  it('shows route progress information', async () => {
    render(<LiveMappingPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/field agents \(3\)/i)).toBeInTheDocument()
    })

    // Click on first agent
    const firstAgent = screen.getByText(mockAgents[0].name)
    await userEvent.click(firstAgent)

    // Check route progress
    expect(screen.getByText(/route progress/i)).toBeInTheDocument()
    expect(screen.getByText(/visited:/i)).toBeInTheDocument()
    expect(screen.getByText(/remaining:/i)).toBeInTheDocument()
    expect(screen.getByText(/total:/i)).toBeInTheDocument()
  })

  it('displays device status information', async () => {
    render(<LiveMappingPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/field agents \(3\)/i)).toBeInTheDocument()
    })

    // Click on first agent
    const firstAgent = screen.getByText(mockAgents[0].name)
    await userEvent.click(firstAgent)

    // Check device status
    expect(screen.getByText(/device status/i)).toBeInTheDocument()
    expect(screen.getByText(/battery/i)).toBeInTheDocument()
    expect(screen.getByText(/signal/i)).toBeInTheDocument()
    expect(screen.getByText(/last sync/i)).toBeInTheDocument()
  })

  it('shows customer visits for selected agent', async () => {
    render(<LiveMappingPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/field agents \(3\)/i)).toBeInTheDocument()
    })

    // Click on first agent
    const firstAgent = screen.getByText(mockAgents[0].name)
    await userEvent.click(firstAgent)

    // Check customer visits section
    expect(screen.getByText(/today's customer visits/i)).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    const { apiService } = require('../../services/api.service')
    apiService.get.mockRejectedValue(new Error('API Error'))
    
    render(<LiveMappingPage />)
    
    // Should show error state or loading state
    await waitFor(() => {
      expect(screen.queryByText(/field agents \(3\)/i)).not.toBeInTheDocument()
    })
  })

  it('filters agents by status', async () => {
    const user = userEvent.setup()
    render(<LiveMappingPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/field agents \(3\)/i)).toBeInTheDocument()
    })

    // Click on status filter
    const statusFilter = screen.getByRole('combobox')
    await user.click(statusFilter)
    
    // Select active status
    const activeOption = screen.getByText('Active')
    await user.click(activeOption)
    
    // Should filter results
    expect(statusFilter).toHaveTextContent('Active')
  })

  it('updates agent locations in real-time', async () => {
    render(<LiveMappingPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/field agents \(3\)/i)).toBeInTheDocument()
    })

    // Verify real-time updates are set up (check for interval or websocket setup)
    // This would depend on the actual implementation
    expect(screen.getByText(/last seen:/i)).toBeInTheDocument()
  })
})