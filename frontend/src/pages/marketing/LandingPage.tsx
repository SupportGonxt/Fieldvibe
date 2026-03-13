import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowRight, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  MapPin, 
  BarChart3,
  Zap,
  Shield,
  Globe,
  Smartphone,
  Clock,
  DollarSign,
  Play,
  Star,
  Truck,
  Package,
  Target
} from 'lucide-react'

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">FieldVibe</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-300 hover:text-white transition-colors font-medium">Features</a>
              <a href="#benefits" className="text-slate-300 hover:text-white transition-colors font-medium">Benefits</a>
              <a href="#pricing" className="text-slate-300 hover:text-white transition-colors font-medium">Pricing</a>
              <Link 
                to="/auth/login" 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2.5 rounded-full transition-all font-semibold shadow-lg shadow-blue-500/25"
              >
                Sign In
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className={`pt-32 pb-20 px-4 sm:px-6 lg:px-8 transition-all duration-1000 relative overflow-hidden ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 rounded-full text-sm font-semibold">
                <Star className="w-4 h-4" />
                <span>Enterprise Field Force & Van Sales Platform</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
                Transform Your
                <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Field Operations
                </span>
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed">
                Empower your sales teams with real-time visibility, intelligent route optimization, 
                and seamless order management. Built for modern enterprises.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to="/auth/login"
                  className="inline-flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-4 rounded-full transition-all font-semibold text-lg group shadow-lg shadow-blue-500/25"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a 
                  href="#features"
                  className="inline-flex items-center justify-center border-2 border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white px-8 py-4 rounded-full transition-all font-semibold text-lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </a>
              </div>
              <div className="flex items-center space-x-8 pt-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-slate-400">No credit card required</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-slate-400">14-day free trial</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur-3xl opacity-20"></div>
              <div className="relative bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-blue-600/10 rounded-xl border border-blue-500/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Sales Growth</p>
                        <p className="text-2xl font-bold text-white">+42%</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500/10 to-green-600/10 rounded-xl border border-green-500/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                        <Users className="h-6 w-6 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Active Agents</p>
                        <p className="text-2xl font-bold text-white">1,247</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-purple-600/10 rounded-xl border border-purple-500/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Routes Optimized</p>
                        <p className="text-2xl font-bold text-white">8,432</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything You Need to Scale
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Comprehensive tools designed for enterprise field operations and van sales management
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: MapPin,
                title: 'Route Optimization',
                description: 'AI-powered route planning that saves time and fuel costs while maximizing coverage',
                gradient: 'from-blue-500 to-cyan-500'
              },
              {
                icon: Smartphone,
                title: 'Mobile-First Design',
                description: 'Native mobile experience for field agents with offline capabilities',
                gradient: 'from-green-500 to-emerald-500'
              },
              {
                icon: BarChart3,
                title: 'Real-Time Analytics',
                description: 'Live dashboards with actionable insights into sales performance and KPIs',
                gradient: 'from-purple-500 to-pink-500'
              },
              {
                icon: Users,
                title: 'Team Management',
                description: 'Efficiently manage field teams, territories, and commission structures',
                gradient: 'from-orange-500 to-amber-500'
              },
              {
                icon: Zap,
                title: 'Instant Sync',
                description: 'Real-time data synchronization across all devices and locations',
                gradient: 'from-yellow-500 to-orange-500'
              },
              {
                icon: Shield,
                title: 'Enterprise Security',
                description: 'Bank-level encryption and compliance with industry standards',
                gradient: 'from-red-500 to-rose-500'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group p-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-800 transition-all duration-300"
              >
                <div className={`inline-flex p-3 bg-gradient-to-br ${feature.gradient} rounded-xl mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Why Choose FieldVibe?
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Join hundreds of enterprises transforming their field operations
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Clock, value: '40%', label: 'Time Saved' },
              { icon: DollarSign, value: '35%', label: 'Cost Reduction' },
              { icon: TrendingUp, value: '50%', label: 'Sales Increase' }
            ].map((stat, index) => (
              <div key={index} className="text-center p-8 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 hover:bg-white/15 transition-colors">
                <stat.icon className="h-12 w-12 text-white mx-auto mb-4" />
                <div className="text-5xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-blue-100 text-lg">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              See FieldVibe in Action
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Powerful features designed for modern field operations
            </p>
          </div>
          <div className="space-y-16">
            {/* Dashboard Screenshot */}
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <h3 className="text-3xl font-bold text-white">Real-Time Dashboard</h3>
                <p className="text-lg text-slate-400">
                  Monitor your entire field operation at a glance. Track sales performance, agent activity, 
                  and key metrics in real-time with our intuitive dashboard.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Live KPI tracking and performance metrics</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Customizable widgets and reports</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Role-based access and permissions</span>
                  </li>
                </ul>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-2xl opacity-30"></div>
                <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                  <div className="bg-slate-900 rounded-xl p-6 aspect-video flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                      <p className="text-slate-400">Dashboard Preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Operations Screenshot */}
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="relative lg:order-1">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl blur-2xl opacity-30"></div>
                <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                  <div className="bg-slate-900 rounded-xl p-6 aspect-video flex items-center justify-center">
                    <div className="text-center">
                      <Smartphone className="w-16 h-16 text-green-400 mx-auto mb-4" />
                      <p className="text-slate-400">Mobile App Preview</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4 lg:order-2">
                <h3 className="text-3xl font-bold text-white">Mobile Field Operations</h3>
                <p className="text-lg text-slate-400">
                  Empower your field agents with a mobile-first workflow. Capture visits, take photos, 
                  complete surveys, and process orders—all from their smartphone.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Step-by-step guided workflows</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Offline mode with automatic sync</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">GPS tracking and route optimization</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Analytics Screenshot */}
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <h3 className="text-3xl font-bold text-white">Advanced Analytics</h3>
                <p className="text-lg text-slate-400">
                  Make data-driven decisions with comprehensive analytics. Visualize trends, 
                  identify opportunities, and optimize your field operations.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Interactive charts and visualizations</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Daily, weekly, and monthly tracking</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Export reports in multiple formats</span>
                  </li>
                </ul>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-2xl opacity-30"></div>
                <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                  <div className="bg-slate-900 rounded-xl p-6 aspect-video flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                      <p className="text-slate-400">Analytics Preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Van Sales Screenshot */}
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="relative lg:order-1">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-2xl opacity-30"></div>
                <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                  <div className="bg-slate-900 rounded-xl p-6 aspect-video flex items-center justify-center">
                    <div className="text-center">
                      <Truck className="w-16 h-16 text-orange-400 mx-auto mb-4" />
                      <p className="text-slate-400">Van Sales Preview</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4 lg:order-2">
                <h3 className="text-3xl font-bold text-white">Van Sales Management</h3>
                <p className="text-lg text-slate-400">
                  Complete van sales solution with route planning, inventory tracking, 
                  and cash management—all in one platform.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Route optimization and scheduling</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Real-time inventory management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">Cash reconciliation and reporting</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Choose the plan that fits your business needs
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Starter',
                price: '$49',
                period: 'per user/month',
                features: [
                  'Up to 10 field agents',
                  'Basic route optimization',
                  'Mobile app access',
                  'Email support',
                  'Standard analytics'
                ]
              },
              {
                name: 'Professional',
                price: '$99',
                period: 'per user/month',
                features: [
                  'Up to 50 field agents',
                  'Advanced route optimization',
                  'Offline mode',
                  'Priority support',
                  'Advanced analytics',
                  'Custom integrations'
                ],
                popular: true
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                period: 'contact sales',
                features: [
                  'Unlimited field agents',
                  'AI-powered optimization',
                  'Dedicated account manager',
                  '24/7 phone support',
                  'Custom development',
                  'SLA guarantee'
                ]
              }
            ].map((plan, index) => (
              <div 
                key={index}
                className={`relative p-8 rounded-2xl border ${
                  plan.popular 
                    ? 'border-blue-500 bg-gradient-to-b from-blue-500/10 to-purple-500/10 shadow-2xl shadow-blue-500/20 scale-105' 
                    : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-4xl font-bold text-white mb-1">{plan.price}</div>
                  <div className="text-slate-400">{plan.period}</div>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth/login"
                  className={`block text-center py-3 px-6 rounded-full font-semibold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Field Operations?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join leading enterprises using FieldVibe to drive growth and efficiency
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth/login"
              className="inline-flex items-center justify-center bg-white hover:bg-gray-100 text-blue-600 px-8 py-4 rounded-full transition-all font-semibold text-lg group"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center border-2 border-white/30 hover:bg-white/10 text-white px-8 py-4 rounded-full transition-all font-semibold text-lg"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">FieldVibe</span>
              </div>
              <p className="text-slate-400 mb-6 max-w-md">
                The complete field force and van sales platform for modern enterprises. Streamline operations, boost productivity, and drive growth.
              </p>
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <span>A Product of</span>
                <span className="text-slate-300 font-semibold">GONXT</span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="https://www.gonxt.tech" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">About GONXT</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-500 text-sm">
              &copy; 2025 FieldVibe by Vantax. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-slate-500 hover:text-white transition-colors text-sm">Terms</a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors text-sm">Privacy</a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors text-sm">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
