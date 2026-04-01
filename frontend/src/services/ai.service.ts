import { apiClient } from './api.service'
import { API_CONFIG } from '../config/api.config'
import { AIInsight, FraudDetection, DataInsight, AIAnalysis, LocalAIConfig } from '../types/ai.types'
import { toast } from 'react-hot-toast'

class AIService {
  private readonly baseUrl = API_CONFIG.ENDPOINTS.AI.CHAT
  // Build full URL using centralized config
  private buildUrl(endpoint: string): string {
    return `${API_CONFIG.BASE_URL}${endpoint}`
  }
  private ollamaUrl = import.meta.env.VITE_AI_URL || 'http://localhost:11434/api'
  private isOllamaAvailable = false
  private readonly AI_ENABLED = import.meta.env.VITE_ENABLE_AI === 'true'

  constructor() {
    this.checkOllamaAvailability()
  }

  private async checkOllamaAvailability() {
    if (!this.AI_ENABLED) {
      this.isOllamaAvailable = false
      return
    }
    try {
      const response = await fetch(`${this.ollamaUrl}/tags`)
      this.isOllamaAvailable = response.ok
    } catch (error) {
      this.isOllamaAvailable = false
    }
  }

  // Local AI Analysis using Ollama/Llama 3
  async analyzeWithLocalAI(data: any, analysisType: string): Promise<any> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled. Enable with VITE_ENABLE_AI=true')
    }
    
    if (!this.isOllamaAvailable) {
      throw new Error('AI service (Ollama) is not available. Please ensure Ollama is running with llama3 model.')
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
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return this.parseAIResponse(result.response, analysisType)
    } catch (error) {
      console.error('Local AI analysis failed:', error)
      toast.error('AI analysis failed. Please ensure Ollama is running.')
      throw error // Re-throw instead of returning mock data
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
      throw new Error('Invalid AI response format - no JSON found')
    } catch (error) {
      console.error('Failed to parse AI response:', error)
      throw new Error('Failed to parse AI response. Please check Ollama output format.')
    }
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
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const response = await apiClient.get(`${this.baseUrl}/field-agents/${agentId}/insights`, {
        params: { time_range: timeRange }
      })
      return response.data?.data || response.data
    } catch (error) {
      console.error('Failed to fetch agent insights:', error)
      throw new Error('Failed to load agent performance insights')
    }
  }

  async detectFieldAgentFraud(transactions: any[]): Promise<FraudDetection[]> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const analysis = await this.analyzeWithLocalAI(transactions, 'fraud_detection')
      
      return transactions
        .filter((_t, i) => (analysis.fraud_indicators?.length || 0) > 0)
        .map((transaction, index) => ({
          id: `fraud_${index}`,
          transaction_id: transaction.id,
          module: 'field_agents',
          type: 'location_anomaly',
          risk_score: analysis.risk_score || 0,
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
      throw new Error('Fraud detection failed. Please ensure AI service is running.')
    }
  }

  // Customer AI Analysis
  async analyzeCustomerBehavior(customerId: string): Promise<AIInsight[]> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const response = await apiClient.get(`${this.baseUrl}/customers/${customerId}/insights`)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Failed to fetch customer insights:', error)
      throw new Error('Failed to load customer behavior insights')
    }
  }

  async detectCustomerFraud(customerId: string): Promise<FraudDetection[]> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const response = await apiClient.get(`${this.baseUrl}/customers/${customerId}/fraud-check`)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Customer fraud check failed:', error)
      throw new Error('Customer fraud check failed')
    }
  }

  // Order AI Analysis
  async analyzeOrderPatterns(timeRange: string): Promise<AIInsight[]> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const response = await apiClient.get(`${this.baseUrl}/orders/insights`, {
        params: { time_range: timeRange }
      })
      return response.data?.data || response.data
    } catch (error) {
      console.error('Failed to fetch order insights:', error)
      throw new Error('Failed to load order pattern insights')
    }
  }

  async detectOrderFraud(orderId: string): Promise<FraudDetection[]> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const response = await apiClient.get(`${this.baseUrl}/orders/${orderId}/fraud-check`)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Order fraud check failed:', error)
      throw new Error('Order fraud check failed')
    }
  }

  // Product AI Analysis
  async analyzeProductPerformance(productId: string): Promise<AIInsight[]> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const response = await apiClient.get(`${this.baseUrl}/products/${productId}/insights`)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Failed to fetch product insights:', error)
      throw new Error('Failed to load product performance insights')
    }
  }

  // Cross-Module Analysis
  async getComprehensiveAnalysis(): Promise<AIAnalysis> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const response = await apiClient.get(`${this.baseUrl}/comprehensive-analysis`)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Comprehensive analysis failed:', error)
      throw new Error('Failed to load comprehensive AI analysis')
    }
  }

  // Real-time Monitoring
  async startRealTimeMonitoring(modules: string[]): Promise<void> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      await apiClient.post(`${this.baseUrl}/monitoring/start`, { modules })
      console.log('Real-time AI monitoring started for modules:', modules)
    } catch (error) {
      console.error('Failed to start real-time monitoring:', error)
      throw new Error('Failed to start real-time AI monitoring')
    }
  }

  async stopRealTimeMonitoring(): Promise<void> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      await apiClient.post(`${this.baseUrl}/monitoring/stop`)
      console.log('Real-time AI monitoring stopped')
    } catch (error) {
      console.error('Failed to stop real-time monitoring:', error)
      throw new Error('Failed to stop real-time AI monitoring')
    }
  }

  // Configuration
  async getAIConfig(): Promise<LocalAIConfig> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/config`)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Failed to fetch AI config:', error)
      // Return default config instead of throwing
      return {
        enabled: this.AI_ENABLED,
        model_path: 'llama3',
        confidence_threshold: 0.7,
        fraud_threshold: 0.8,
        update_interval: 300, // 5 minutes
        modules: {
          field_agents: this.AI_ENABLED,
          customers: this.AI_ENABLED,
          orders: this.AI_ENABLED,
          products: this.AI_ENABLED
        }
      }
    }
  }

  async updateAIConfig(config: Partial<LocalAIConfig>): Promise<LocalAIConfig> {
    if (!this.AI_ENABLED) {
      throw new Error('AI features are disabled')
    }
    
    try {
      const response = await apiClient.put(`${this.baseUrl}/config`, config)
      return response.data?.data || response.data
    } catch (error) {
      console.error('Failed to update AI config:', error)
      throw new Error('Failed to update AI configuration')
    }
  }
}

export const aiService = new AIService()
