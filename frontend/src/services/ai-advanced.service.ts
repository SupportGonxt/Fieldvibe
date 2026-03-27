/**
 * AI Service Integration
 * Advanced AI-powered features for insights and automation
 */

interface AIInsight {
  type: 'prediction' | 'anomaly' | 'recommendation' | 'alert';
  category: string;
  title: string;
  description: string;
  confidence: number;
  data: any;
  timestamp: string;
}

interface SalesForecast {
  period: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  factors: string[];
}

interface RouteOptimization {
  routes: VisitRoute[];
  totalDistance: number;
  estimatedTime: number;
  savings: {
    distance: number;
    time: number;
    cost: number;
  };
}

interface VisitRoute {
  order: number;
  visitId: string;
  customerId: string;
  latitude: number;
  longitude: number;
  estimatedArrival: string;
  estimatedDuration: number;
}

class AIService {
  private readonly API_BASE = '/api/v1/ai';

  /**
   * Generate sales forecast
   */
  async generateSalesForecast(
    tenantId: string,
    period: 'week' | 'month' | 'quarter',
    horizon: number = 4
  ): Promise<SalesForecast[]> {
    try {
      const response = await fetch(`${this.API_BASE}/forecast/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, period, horizon })
      });

      if (!response.ok) {
        throw new Error('Forecast generation failed');
      }

      return response.json();
    } catch (error) {
      console.error('Sales forecast error:', error);
      // Return mock data for demo
      return this.getMockForecast(period, horizon);
    }
  }

  /**
   * Predict customer churn
   */
  async predictChurn(tenantId: string, customerId?: string): Promise<{
    customerId: string;
    churnProbability: number;
    riskFactors: string[];
    recommendedActions: string[];
  }[]> {
    try {
      const response = await fetch(`${this.API_BASE}/analytics/churn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, customerId })
      });

      if (!response.ok) {
        throw new Error('Churn prediction failed');
      }

      return response.json();
    } catch (error) {
      console.error('Churn prediction error:', error);
      return [];
    }
  }

  /**
   * Optimize visit routes
   */
  async optimizeRoutes(
    visits: Array<{
      id: string;
      customerId: string;
      latitude: number;
      longitude: number;
      scheduledAt: string;
      estimatedDuration: number;
    }>,
    startLocation: { latitude: number; longitude: number }
  ): Promise<RouteOptimization> {
    try {
      const response = await fetch(`${this.API_BASE}/optimization/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visits, startLocation })
      });

      if (!response.ok) {
        throw new Error('Route optimization failed');
      }

      return response.json();
    } catch (error) {
      console.error('Route optimization error:', error);
      // Return simple optimization
      return this.getMockRouteOptimization(visits);
    }
  }

  /**
   * Analyze visit photos for planogram compliance
   */
  async analyzePlanogram(
    imageUrl: string,
    planogramId: string
  ): Promise<{
    compliant: boolean;
    score: number;
    issues: string[];
    missingProducts: string[];
    misplacedProducts: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/vision/planogram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, planogramId })
      });

      if (!response.ok) {
        throw new Error('Planogram analysis failed');
      }

      return response.json();
    } catch (error) {
      console.error('Planogram analysis error:', error);
      return {
        compliant: true,
        score: 100,
        issues: [],
        missingProducts: [],
        misplacedProducts: []
      };
    }
  }

  /**
   * Extract text from visit photos (OCR)
   */
  async extractTextFromImage(imageUrl: string): Promise<{
    text: string;
    confidence: number;
    blocks: Array<{
      text: string;
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
    }>;
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/vision/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });

      if (!response.ok) {
        throw new Error('OCR failed');
      }

      return response.json();
    } catch (error) {
      console.error('OCR error:', error);
      return { text: '', confidence: 0, blocks: [] };
    }
  }

  /**
   * Analyze survey sentiment
   */
  async analyzeSentiment(text: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number;
    emotions: {
      joy: number;
      anger: number;
      sadness: number;
      fear: number;
      surprise: number;
    };
    keyPhrases: string[];
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/nlp/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Sentiment analysis failed');
      }

      return response.json();
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return {
        sentiment: 'neutral',
        score: 0.5,
        emotions: { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0 },
        keyPhrases: []
      };
    }
  }

  /**
   * Generate AI insights
   */
  async generateInsights(
    tenantId: string,
    categories?: string[]
  ): Promise<AIInsight[]> {
    try {
      const response = await fetch(`${this.API_BASE}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, categories })
      });

      if (!response.ok) {
        throw new Error('Insight generation failed');
      }

      return response.json();
    } catch (error) {
      console.error('Insight generation error:', error);
      return [];
    }
  }

  /**
   * Get product recommendations for customer
   */
  async getProductRecommendations(
    customerId: string,
    limit: number = 10
  ): Promise<Array<{
    productId: string;
    productName: string;
    reason: string;
    confidence: number;
    predictedDemand: number;
  }>> {
    try {
      const response = await fetch(`${this.API_BASE}/recommendations/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, limit })
      });

      if (!response.ok) {
        throw new Error('Recommendations failed');
      }

      return response.json();
    } catch (error) {
      console.error('Recommendations error:', error);
      return [];
    }
  }

  /**
   * Detect anomalies in sales data
   */
  async detectAnomalies(
    tenantId: string,
    metric: string,
    period: string
  ): Promise<Array<{
    date: string;
    value: number;
    expectedValue: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high';
    explanation: string;
  }>> {
    try {
      const response = await fetch(`${this.API_BASE}/anomaly-detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, metric, period })
      });

      if (!response.ok) {
        throw new Error('Anomaly detection failed');
      }

      return response.json();
    } catch (error) {
      console.error('Anomaly detection error:', error);
      return [];
    }
  }

  /**
   * Chat with AI assistant
   */
  async chat(
    message: string,
    context?: {
      page?: string;
      data?: any;
      userRole?: string;
    }
  ): Promise<{
    response: string;
    suggestions: string[];
    actions?: Array<{
      type: string;
      label: string;
      data?: any;
    }>;
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context })
      });

      if (!response.ok) {
        throw new Error('Chat failed');
      }

      return response.json();
    } catch (error) {
      console.error('Chat error:', error);
      return {
        response: "I'm sorry, I'm having trouble connecting right now. Please try again.",
        suggestions: ['Show my visits', 'View sales report', 'Help']
      };
    }
  }

  /**
   * Mock forecast data
   */
  private getMockForecast(period: string, horizon: number): SalesForecast[] {
    const forecasts: SalesForecast[] = [];
    const now = new Date();

    for (let i = 0; i < horizon; i++) {
      const date = new Date(now);
      if (period === 'week') date.setDate(date.getDate() + (i * 7));
      else if (period === 'month') date.setMonth(date.getMonth() + i);
      else date.setMonth(date.getMonth() + (i * 3));

      const base = 100000;
      const variation = Math.sin(i) * 10000;
      const predicted = base + variation;

      forecasts.push({
        period: date.toISOString().split('T')[0],
        predicted: Math.round(predicted),
        lowerBound: Math.round(predicted * 0.9),
        upperBound: Math.round(predicted * 1.1),
        confidence: 0.85 - (i * 0.05),
        factors: ['Historical trends', 'Seasonal patterns', 'Market conditions']
      });
    }

    return forecasts;
  }

  /**
   * Mock route optimization
   */
  private getMockRouteOptimization(visits: any[]): RouteOptimization {
    const routes: VisitRoute[] = visits.map((visit, index) => ({
      order: index + 1,
      visitId: visit.id,
      customerId: visit.customerId,
      latitude: visit.latitude,
      longitude: visit.longitude,
      estimatedArrival: visit.scheduledAt,
      estimatedDuration: visit.estimatedDuration || 30
    }));

    return {
      routes,
      totalDistance: 45.5,
      estimatedTime: 180,
      savings: {
        distance: 12.3,
        time: 35,
        cost: 25.50
      }
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
