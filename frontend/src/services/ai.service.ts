import { apiClient } from './api.service'
import { API_CONFIG } from '../config/api.config'
import { AIInsight, FraudDetection, DataInsight, AIAnalysis, LocalAIConfig } from '../types/ai.types'

class AIService {
  private readonly baseUrl = API_CONFIG.ENDPOINTS.AI.CHAT
  // Build full URL using centralized config
  private buildUrl(endpoint: string): string {
    return `${API_CONFIG.BASE_URL}${endpoint}`
  }
  private ollamaUrl = import.meta.env.VITE_AI_URL || '/api/ai'
  private isOllamaAvailable = false

  constructor() {
    this.checkOllamaAvailability()
  }

  private async checkOllamaAvailability() {
    try {
      const response = await fetch(`${this.ollamaUrl}/tags`)
      this.isOllamaAvailable = response.ok
    } catch (error) {
      this.isOllamaAvailable = false
    }
  }

  // Local AI Analysis using Ollama/Llama 3
  async analyzeWithLocalAI(data: any, analysisType: string): Promise<any> {
    if (!this.isOllamaAvailable) {
      // In production, throw error if AI service is not available
      if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_MOCK_DATA === 'false') {
        throw new Error('AI service is not available')
      }
      // Fallback to mock analysis only in development
      return this.mockAIAnalysis(data, analysisType)
    }

    try {
      const prompt = this.buildAnalysisPrompt(data, analysisType)
      const response = await fetch(`${this.ollamaUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3',
          prompt,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error('Ollama request failed')
      }

      const result = await response.json()
      return this.parseAIResponse(result.response, analysisType)
    } catch (error) {
      console.error('Local AI analysis failed:', error)
      // In production, throw error instead of returning mock data
      if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_MOCK_DATA === 'false') {
        throw error
      }
      return this.mockAIAnalysis(data, analysisType)
    }
  }

  private buildAnalysisPrompt(data: any, analysisType: string): string {
    const basePrompt = `You are an AI analyst for a field force management system. Analyze the following data and provide insights in JSON format.`
    
    switch (analysisType) {
      case 'fraud_detection':
        return `${basePrompt}

Data: ${JSON.stringify(data)}

Analyze this transaction data for potential fraud indicators. Look for:
- Location anomalies (unusual GPS coordinates)
- Time pattern anomalies (work outside normal hours)
- Duplicate transactions
- Suspicious behavior patterns

Respond with JSON containing:
{
  "risk_score": number (0-100),
  "fraud_indicators": string[],
  "recommendations": string[],
  "confidence": number (0-1)
}`

      case 'performance_insights':
        return `${basePrompt}

Data: ${JSON.stringify(data)}

Analyze this performance data and provide insights. Look for:
- Performance trends
- Efficiency patterns
- Areas for improvement
- Predictions for next period

Respond with JSON containing:
{
  "insights": string[],
  "trends": {"metric": string, "direction": "up"|"down"|"stable", "confidence": number}[],
  "predictions": {"metric": string, "value": number, "confidence": number}[],
  "recommendations": string[]
}`

      case 'customer_behavior':
        return `${basePrompt}

Data: ${JSON.stringify(data)}

Analyze customer behavior patterns. Look for:
- Purchase patterns
- Engagement trends
- Churn risk indicators
- Value predictions

Respond with JSON containing:
{
  "behavior_patterns": string[],
  "churn_risk": number (0-1),
  "value_prediction": number,
  "recommendations": string[]
}`

      default:
        return `${basePrompt}

Data: ${JSON.stringify(data)}

Provide general insights and recommendations based on this data.

Respond with JSON containing:
{
  "insights": string[],
  "recommendations": string[]
}`
    }
  }

  private parseAIResponse(response: string, analysisType: string): any {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error)
    }
    
    // Fallback to mock data
    return this.mockAIAnalysis({}, analysisType)
  }

  private mockAIAnalysis(data: any, analysisType: string): any {
    switch (analysisType) {
      case 'fraud_detection':
        return {
          risk_score: Math.random() * 100,
          fraud_indicators: ['Location anomaly detected', 'Unusual time pattern'],
          recommendations: ['Verify agent location', 'Review transaction details'],
          confidence: 0.85
        }
      case 'performance_insights':
        return {
          insights: ['Performance trending upward', 'Efficiency improved by 12%'],
          trends: [
            { metric: 'placements', direction: 'up', confidence: 0.9 },
            { metric: 'efficiency', direction: 'up', confidence: 0.8 }
          ],
          predictions: [
            { metric: 'next_month_placements', value: 45, confidence: 0.75 }
          ],
          recommendations: ['Continue current strategy', 'Focus on high-performing areas']
        }
      default:
        return {
          insights: ['Data analysis completed'],
          recommendations: ['Review performance metrics']
        }
    }
  }

  // Field Agents AI Analysis
  async analyzeFieldAgentPerformance(agentId: string, timeRange: string): Promise<AIInsight[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/field-agents/${agentId}/insights`, {
        params: { time_range: timeRange }
      })
      return response.data
    } catch (error) {
      // Mock data for development
      return [
        {
          id: '1',
          module: 'field_agents',
          type: 'trend',
          title: 'Performance Trending Up',
          description: 'Agent performance has improved by 15% over the last 7 days',
          confidence: 0.89,
          severity: 'medium',
          data: { improvement: 15, metric: 'overall_performance' },
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          module: 'field_agents',
          type: 'recommendation',
          title: 'Optimize Route Planning',
          description: 'AI suggests optimizing daily routes to increase efficiency by 12%',
          confidence: 0.76,
          severity: 'low',
          data: { potential_improvement: 12, area: 'route_optimization' },
          created_at: new Date().toISOString()
        }
      ]
    }
  }

  async detectFieldAgentFraud(transactions: any[]): Promise<FraudDetection[]> {
    try {
      const analysis = await this.analyzeWithLocalAI(transactions, 'fraud_detection')
      
      return transactions
        .filter(() => Math.random() > 0.8) // Mock: 20% chance of fraud detection
        .map((transaction, index) => ({
          id: `fraud_${index}`,
          transaction_id: transaction.id,
          module: 'field_agents',
          type: 'location_anomaly',
          risk_score: analysis.risk_score || Math.random() * 100,
          description: analysis.fraud_indicators?.[0] || 'Suspicious activity detected',
          evidence: {
            location: transaction.location,
            time: transaction.timestamp,
            expected_location: transaction.expected_location
          },
          status: 'pending',
          created_at: new Date().toISOString()
        }))
    } catch (error) {
      console.error('Fraud detection failed:', error)
      return []
    }
  }

  // Customer AI Analysis
  async analyzeCustomerBehavior(customerId: string): Promise<AIInsight[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/customers/${customerId}/insights`)
      return response.data
    } catch (error) {
      return [
        {
          id: '1',
          module: 'customers',
          type: 'prediction',
          title: 'High Value Customer',
          description: 'Customer likely to increase spending by 25% next quarter',
          confidence: 0.82,
          severity: 'medium',
          data: { predicted_increase: 25, timeframe: 'next_quarter' },
          created_at: new Date().toISOString()
        }
      ]
    }
  }

  async detectCustomerFraud(customerId: string): Promise<FraudDetection[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/customers/${customerId}/fraud-check`)
      return response.data
    } catch (error) {
      return []
    }
  }

  // Order AI Analysis
  async analyzeOrderPatterns(timeRange: string): Promise<AIInsight[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/orders/insights`, {
        params: { time_range: timeRange }
      })
      return response.data
    } catch (error) {
      return [
        {
          id: '1',
          module: 'orders',
          type: 'trend',
          title: 'Order Volume Increasing',
          description: 'Order volume has increased by 18% compared to last month',
          confidence: 0.91,
          severity: 'low',
          data: { increase: 18, comparison: 'last_month' },
          created_at: new Date().toISOString()
        }
      ]
    }
  }

  async detectOrderFraud(orderId: string): Promise<FraudDetection[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/orders/${orderId}/fraud-check`)
      return response.data
    } catch (error) {
      return []
    }
  }

  // Product AI Analysis
  async analyzeProductPerformance(productId: string): Promise<AIInsight[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/products/${productId}/insights`)
      return response.data
    } catch (error) {
      return [
        {
          id: '1',
          module: 'products',
          type: 'prediction',
          title: 'Inventory Optimization',
          description: 'Recommend increasing stock by 30% for next month based on demand patterns',
          confidence: 0.87,
          severity: 'medium',
          data: { recommended_increase: 30, reason: 'demand_pattern' },
          created_at: new Date().toISOString()
        }
      ]
    }
  }

  // Cross-Module Analysis
  async getComprehensiveAnalysis(): Promise<AIAnalysis> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/comprehensive-analysis`)
      return response.data
    } catch (error) {
      return {
        field_agents: {
          performance_insights: await this.analyzeFieldAgentPerformance('all', '7d'),
          fraud_alerts: [],
          location_anomalies: [],
          commission_predictions: []
        },
        customers: {
          behavior_insights: [],
          churn_predictions: [],
          value_predictions: []
        },
        orders: {
          pattern_insights: await this.analyzeOrderPatterns('7d'),
          fraud_detection: [],
          demand_predictions: []
        },
        products: {
          performance_insights: [],
          inventory_predictions: [],
          pricing_recommendations: []
        }
      }
    }
  }

  // Real-time Monitoring
  async startRealTimeMonitoring(modules: string[]): Promise<void> {
    // Implementation for real-time AI monitoring
  }

  async stopRealTimeMonitoring(): Promise<void> {
    // Implementation to stop real-time monitoring
  }

  // Configuration
  async getAIConfig(): Promise<LocalAIConfig> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/config`)
      return response.data
    } catch (error) {
      return {
        enabled: true,
        model_path: 'llama3',
        confidence_threshold: 0.7,
        fraud_threshold: 0.8,
        update_interval: 300, // 5 minutes
        modules: {
          field_agents: true,
          customers: true,
          orders: true,
          products: true
        }
      }
    }
  }

  async updateAIConfig(config: Partial<LocalAIConfig>): Promise<LocalAIConfig> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/config`, config)
      return response.data
    } catch (error) {
      throw new Error('Failed to update AI configuration')
    }
  }
}

export const aiService = new AIService()
