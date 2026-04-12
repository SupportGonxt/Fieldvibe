import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, Users, MapPin, BarChart3,
  Zap, Shield, Smartphone, Star, Truck,
  Package, Target, Camera, ClipboardList, Building2, ChevronRight,
  Eye, PieChart, Navigation, Wifi, ShoppingCart,
  Settings, Menu, X
} from 'lucide-react'

/* ── Intersection Observer reveal hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function Reveal({ delay = 0, children, className = '' }: { delay?: number; children: React.ReactNode; className?: string }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay * 0.08}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay * 0.08}s`,
      }}
    >
      {children}
    </div>
  )
}

/* ── Animated counter ── */
function Counter({ end, suffix = '', duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [started, setStarted] = useState(false)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) setStarted(true)
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    let rafId: number
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * end))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [started, end, duration])

  return <span ref={ref}>{value}{suffix}</span>
}

/* ── Platform module data ── */
const platformModules = [
  {
    icon: MapPin,
    title: 'GPS-Verified Field Visits',
    description: 'Every visit is stamped with precise GPS coordinates, timestamps, and photo evidence. Support for both store and individual visits with 30-day revisit prevention.',
    features: ['GPS check-in/check-out', 'Photo capture with compression', 'Store & individual visit types', 'Duplicate visit detection'],
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    icon: ClipboardList,
    title: 'Dynamic Surveys & Questionnaires',
    description: 'Build custom survey forms with conditional logic, brand-specific templates, and multiple question types including text, radio, checkbox, and image capture.',
    features: ['Drag-and-drop form builder', 'Conditional logic & branching', 'Brand-specific templates', 'Photo & signature capture'],
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    icon: Truck,
    title: 'Van Sales & Distribution',
    description: 'Complete van sales management from warehouse loading to field selling. Real-time inventory tracking, cash reconciliation, and denomination counting.',
    features: ['Van load management', 'Real-time stock tracking', 'Cash reconciliation', 'Return & damage tracking'],
    gradient: 'from-orange-500 to-amber-600',
  },
  {
    icon: ShoppingCart,
    title: 'Sales Order Management',
    description: 'Create and process orders at point of visit with product catalog, multi-payment support, invoice generation, and full VAT calculation.',
    features: ['Product catalog with hierarchy', 'Multi-payment methods', 'Auto invoice generation', 'Price list management'],
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Package,
    title: 'Inventory & Warehousing',
    description: 'Multi-warehouse inventory with reorder alerts, purchase order lifecycle, stock movements with full audit trail, and batch tracking.',
    features: ['Multi-warehouse support', 'Purchase order lifecycle', 'Stock movement audit trail', 'Low-stock alerts'],
    gradient: 'from-cyan-500 to-teal-600',
  },
  {
    icon: Target,
    title: 'Targets & Commissions',
    description: 'Set daily, weekly, and monthly targets for agents. Auto-track progress from visits and sales. Commission engine calculates earnings and routes approvals.',
    features: ['Flexible target periods', 'Auto progress tracking', 'Commission calculation', 'Approval workflows'],
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Live dashboards with visit trends, revenue charts, agent rankings, brand coverage maps, and KPI tracking. Export to Excel instantly.',
    features: ['Interactive dashboards', 'Agent performance rankings', 'Revenue & visit trends', 'One-click Excel export'],
    gradient: 'from-purple-500 to-fuchsia-600',
  },
  {
    icon: Camera,
    title: 'Trade Marketing & Merchandising',
    description: 'Photo analysis for shelf compliance, board placement tracking, POSM material management, and brand activation monitoring.',
    features: ['Shelf compliance photos', 'Board placement tracking', 'POSM material tracking', 'Brand activation monitoring'],
    gradient: 'from-yellow-500 to-orange-500',
  },
  {
    icon: Users,
    title: 'Team Hierarchy & Management',
    description: 'Organize your field force with hierarchical roles: Super Admin, Admin, Manager, Team Lead, and Agent. Assign agents to companies and territories.',
    features: ['Role-based access control', 'Multi-company assignment', 'Territory management', 'Hierarchical reporting'],
    gradient: 'from-sky-500 to-blue-600',
  }
]

const howItWorks = [
  { step: '01', title: 'Set Up Your Team', description: 'Create your organization, add team members, and configure roles and territories in minutes.', icon: Settings },
  { step: '02', title: 'Deploy to the Field', description: 'Agents log in with their PIN on mobile and start capturing visits with GPS verification.', icon: Smartphone },
  { step: '03', title: 'Monitor in Real-Time', description: 'Managers track agent activity, view live GPS positions, and monitor KPIs from the dashboard.', icon: Eye },
  { step: '04', title: 'Analyze & Optimize', description: 'Use analytics to identify top performers, optimize routes, and make data-driven decisions.', icon: PieChart },
]

const testimonials = [
  { name: 'David M.', role: 'Regional Sales Manager', company: 'FMCG Corp', quote: 'FieldVibe eliminated ghost visits completely. GPS verification and photo evidence give us 100% confidence in our field data.', rating: 5 },
  { name: 'Sarah K.', role: 'Operations Director', company: 'BevCo SA', quote: 'Van sales reconciliation used to take hours. With FieldVibe, our drivers close out in minutes with accurate cash counts.', rating: 5 },
  { name: 'Michael T.', role: 'Trade Marketing Lead', company: 'Consumer Brands', quote: 'The survey builder and photo capture features transformed how we measure in-store compliance across 500+ outlets.', rating: 5 },
]

export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeModule, setActiveModule] = useState(0)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-[#06090F] overflow-x-hidden">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#06090F]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#00E87B] to-[#00C968] rounded-lg flex items-center justify-center shadow-lg shadow-[#00E87B]/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">FieldVibe</span>
            </div>

            <nav className="hidden md:flex items-center space-x-1">
              {['Features', 'Modules', 'How It Works', 'Pricing'].map((item) => (
                <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 text-sm font-medium">
                  {item}
                </a>
              ))}
              <div className="w-px h-6 bg-white/10 mx-2" />
              <Link to="/auth/mobile-login" className="text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 text-sm font-medium">
                Agent Login
              </Link>
              <Link
                to="/auth/login"
                className="ml-2 bg-[#00E87B] hover:bg-[#1DFFB2] text-[#06090F] px-5 py-2 rounded-full transition-all font-semibold text-sm shadow-lg shadow-[#00E87B]/20 hover:shadow-[#00E87B]/40"
              >
                Sign In
              </Link>
            </nav>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white p-2">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0A0E18] border-t border-white/5 px-4 py-4 space-y-2">
            {['Features', 'Modules', 'How It Works', 'Pricing'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-white py-2 px-3 rounded-lg hover:bg-white/5 text-sm font-medium">
                {item}
              </a>
            ))}
            <Link to="/auth/mobile-login" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-white py-2 px-3 rounded-lg hover:bg-white/5 text-sm font-medium">
              Agent Login
            </Link>
            <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)} className="block bg-[#00E87B] text-[#06090F] py-2.5 px-4 rounded-full font-semibold text-sm text-center mt-3">
              Sign In
            </Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className={`pt-28 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute top-20 -left-40 w-[500px] h-[500px] bg-[#00E87B]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[100px]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center space-x-2 bg-[#00E87B]/10 border border-[#00E87B]/20 text-[#00E87B] px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                <Star className="w-3.5 h-3.5" />
                <span>Enterprise Field Force Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight">
                Power Your{' '}
                <span className="bg-gradient-to-r from-[#00E87B] via-[#1DFFB2] to-[#4BFFB5] bg-clip-text text-transparent">
                  Field Operations
                </span>
              </h1>

              <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
                The complete platform for field force management, van sales, trade marketing,
                and real-time analytics. GPS-verified visits, mobile-first agents,
                and enterprise-grade security.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center justify-center bg-[#00E87B] hover:bg-[#1DFFB2] text-[#06090F] px-7 py-3.5 rounded-full transition-all font-bold text-base group shadow-lg shadow-[#00E87B]/25 hover:shadow-[#00E87B]/40 hover:scale-[1.02]"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center justify-center border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white px-7 py-3.5 rounded-full transition-all font-semibold text-base"
                >
                  Explore Features
                </a>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <CheckCircle className="h-4 w-4 text-[#00E87B]" />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <CheckCircle className="h-4 w-4 text-[#00E87B]" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <CheckCircle className="h-4 w-4 text-[#00E87B]" />
                  <span>SOC2 compliant</span>
                </div>
              </div>
            </div>

            {/* Hero dashboard mockup */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00E87B]/20 to-blue-500/20 rounded-3xl blur-3xl opacity-40" />
              <div className="relative bg-[#0A1628]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0A1628]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 mx-4 bg-white/5 rounded-lg px-3 py-1 text-xs text-slate-500">
                    fieldvibe.vantax.co.za/dashboard
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Visits Today', value: '847', change: '+12%', color: 'text-[#00E87B]' },
                      { label: 'Revenue', value: 'R2.4M', change: '+8%', color: 'text-blue-400' },
                      { label: 'Active Agents', value: '234', change: '+3%', color: 'text-purple-400' },
                      { label: 'Orders', value: '1,203', change: '+15%', color: 'text-amber-400' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
                        <p className="text-lg font-bold text-white mt-1">{stat.value}</p>
                        <p className={`text-[10px] font-semibold ${stat.color} mt-0.5`}>{stat.change}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-white">Visit Performance</p>
                      <p className="text-[10px] text-slate-500">Last 30 days</p>
                    </div>
                    <div className="flex items-end gap-1 h-20">
                      {[35, 52, 44, 68, 55, 78, 60, 85, 72, 90, 65, 95, 70, 80, 62, 88, 75, 92, 58, 82, 70, 88, 95, 78].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm bg-gradient-to-t from-[#00E87B] to-[#00E87B]/60"
                          style={{ height: `${h}%`, opacity: 0.4 + (i / 24) * 0.6 }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs font-semibold text-white mb-3">Top Agents Today</p>
                    {[
                      { name: 'Sipho N.', visits: 12, status: 'Online' },
                      { name: 'Thandi M.', visits: 10, status: 'Online' },
                      { name: 'James K.', visits: 8, status: 'In Visit' },
                    ].map((agent, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-t border-white/5 first:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00E87B]/30 to-blue-500/30 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-white">{agent.name[0]}</span>
                          </div>
                          <span className="text-xs text-slate-300">{agent.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{agent.visits} visits</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${agent.status === 'Online' ? 'bg-[#00E87B]/10 text-[#00E87B]' : 'bg-blue-500/10 text-blue-400'}`}>
                            {agent.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUSTED BY */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-y border-white/5 bg-[#0A0E18]/50">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-xs font-semibold text-slate-500 uppercase tracking-widest mb-8">Trusted by leading enterprises across Africa</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40">
            {['FMCG Corp', 'BevCo SA', 'Consumer Brands', 'Retail Group', 'AgriTech Co', 'PharmaDist'].map((name) => (
              <div key={name} className="text-slate-400 font-bold text-lg tracking-wider">{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* KEY FEATURES */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-[#00E87B] text-sm font-semibold uppercase tracking-widest mb-3">Core Capabilities</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Everything you need to run field operations
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                From GPS-verified visits to real-time analytics, FieldVibe covers every aspect of
                modern field force and van sales management.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: MapPin, title: 'GPS Check-In', desc: 'Every visit verified with precise coordinates, timestamps, and radius locking', gradient: 'from-emerald-500 to-green-600' },
              { icon: Camera, title: 'Photo Evidence', desc: 'Compressed photo capture with metadata for shelf audits, store fronts, and compliance', gradient: 'from-blue-500 to-indigo-600' },
              { icon: ClipboardList, title: 'Smart Surveys', desc: 'Dynamic questionnaires with conditional logic, multiple question types, and templates', gradient: 'from-purple-500 to-violet-600' },
              { icon: Navigation, title: 'Live GPS Tracking', desc: 'Real-time agent positions on map with route history and geofencing alerts', gradient: 'from-cyan-500 to-teal-600' },
              { icon: Smartphone, title: 'Mobile-First Agents', desc: 'PIN-based mobile login with offline mode, bottom nav, and step-by-step workflows', gradient: 'from-rose-500 to-pink-600' },
              { icon: BarChart3, title: 'Live Dashboards', desc: 'Real-time KPIs, agent rankings, visit trends, revenue charts, and one-click exports', gradient: 'from-amber-500 to-orange-600' },
              { icon: ShoppingCart, title: 'Order Processing', desc: 'Create orders at point of visit with product catalog, pricing tiers, and invoicing', gradient: 'from-sky-500 to-blue-600' },
              { icon: Truck, title: 'Van Sales', desc: 'Load stock, sell in-field, track inventory, reconcile cash with denomination counting', gradient: 'from-orange-500 to-red-600' },
              { icon: Shield, title: 'Enterprise Security', desc: 'Role-based access, audit logs, API key management, and multi-tenant architecture', gradient: 'from-slate-500 to-zinc-600' },
            ].map((feature, index) => (
              <Reveal key={index} delay={index}>
                <div className="group p-5 bg-white/[0.02] backdrop-blur-sm rounded-2xl border border-white/5 hover:border-[#00E87B]/30 hover:bg-white/[0.04] transition-all duration-300">
                  <div className={`inline-flex p-2.5 bg-gradient-to-br ${feature.gradient} rounded-xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM MODULES */}
      <section id="modules" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0A0E18]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-[#00E87B] text-sm font-semibold uppercase tracking-widest mb-3">Platform Modules</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                9 integrated modules, one platform
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Each module works seamlessly together to give you complete visibility and control over your field operations.
              </p>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-[340px_1fr] gap-8">
            <div className="space-y-2">
              {platformModules.map((mod, i) => (
                <button
                  key={i}
                  onClick={() => setActiveModule(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                    activeModule === i
                      ? 'bg-[#00E87B]/10 border border-[#00E87B]/30 text-white'
                      : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${activeModule === i ? 'bg-[#00E87B]/20' : 'bg-white/5'}`}>
                    <mod.icon className={`w-4 h-4 ${activeModule === i ? 'text-[#00E87B]' : 'text-slate-500'}`} />
                  </div>
                  <span className="text-sm font-semibold">{mod.title}</span>
                  {activeModule === i && <ChevronRight className="w-4 h-4 text-[#00E87B] ml-auto" />}
                </button>
              ))}
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8">
              <div className={`inline-flex p-3 bg-gradient-to-br ${platformModules[activeModule].gradient} rounded-xl mb-5 shadow-lg`}>
                {(() => { const Icon = platformModules[activeModule].icon; return <Icon className="h-6 w-6 text-white" /> })()}
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{platformModules[activeModule].title}</h3>
              <p className="text-slate-400 leading-relaxed mb-6">{platformModules[activeModule].description}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {platformModules[activeModule].features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-white/[0.03] px-4 py-3 rounded-xl border border-white/5">
                    <CheckCircle className="w-4 h-4 text-[#00E87B] flex-shrink-0" />
                    <span className="text-sm text-slate-300">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-[#00E87B] text-sm font-semibold uppercase tracking-widest mb-3">How It Works</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Up and running in under an hour
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                From setup to first field visit, FieldVibe gets your team productive fast.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item, i) => (
              <Reveal key={i} delay={i}>
                <div className="relative p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-[#00E87B]/20 transition-colors">
                  <div className="text-5xl font-extrabold text-white/[0.03] absolute top-3 right-4">{item.step}</div>
                  <div className="inline-flex p-2.5 bg-[#00E87B]/10 rounded-xl mb-4">
                    <item.icon className="w-5 h-5 text-[#00E87B]" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* MOBILE APP SHOWCASE */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0A0E18] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00E87B]/5 rounded-full blur-[120px]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#00E87B]/20 to-blue-500/20 rounded-[3rem] blur-3xl opacity-50" />
                  <div className="relative w-[280px] bg-[#06090F] rounded-[2.5rem] border-[3px] border-white/10 overflow-hidden shadow-2xl">
                    <div className="flex justify-center pt-2 pb-1">
                      <div className="w-20 h-5 bg-[#06090F] rounded-full border border-white/10" />
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex justify-between items-center px-1 py-1">
                        <div className="flex items-center gap-1">
                          <Wifi className="w-3 h-3 text-[#00E87B]" />
                          <span className="text-[9px] text-[#00E87B] font-medium">Online</span>
                        </div>
                        <span className="text-[9px] text-slate-500">9:41 AM</span>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500">Good Morning</p>
                        <p className="text-base font-bold text-white">Sipho</p>
                        <p className="text-[9px] text-slate-500">Friday, 20 March</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gradient-to-r from-[#00E87B] to-[#00C968] rounded-xl py-2.5 text-center">
                          <Building2 className="w-4 h-4 text-white mx-auto mb-0.5" />
                          <p className="text-[9px] font-semibold text-white">Store Visit</p>
                        </div>
                        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl py-2.5 text-center">
                          <Users className="w-4 h-4 text-white mx-auto mb-0.5" />
                          <p className="text-[9px] font-semibold text-white">Individual</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Today', value: '5', icon: MapPin, color: 'text-blue-400' },
                          { label: 'Regs', value: '3', icon: Users, color: 'text-purple-400' },
                        ].map((s, i) => (
                          <div key={i} className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                            <s.icon className={`w-3.5 h-3.5 ${s.color} mb-1`} />
                            <p className="text-sm font-bold text-white">{s.value}</p>
                            <p className="text-[8px] text-slate-500 uppercase">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-around pt-2 border-t border-white/5">
                        {[
                          { label: 'Home', active: true },
                          { label: 'Visits', active: false },
                          { label: 'Stats', active: false },
                          { label: 'Profile', active: false },
                        ].map((tab, i) => (
                          <div key={i} className={`text-center ${tab.active ? 'text-[#00E87B]' : 'text-slate-600'}`}>
                            <div className={`w-5 h-5 mx-auto mb-0.5 rounded ${tab.active ? 'bg-[#00E87B]/20' : 'bg-white/5'}`} />
                            <p className="text-[8px] font-medium mt-0.5">{tab.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={2}>
              <div className="space-y-6">
                <div className="inline-flex items-center space-x-2 bg-[#00E87B]/10 border border-[#00E87B]/20 text-[#00E87B] px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile-First Experience</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                  Built for agents in the field
                </h2>
                <p className="text-lg text-slate-400 leading-relaxed">
                  FieldVibe&apos;s mobile app is designed for field agents who spend their day visiting stores and individuals.
                  PIN-based login, GPS-verified check-ins, guided workflows, and offline mode ensure
                  every visit is captured accurately.
                </p>
                <div className="space-y-3">
                  {[
                    'PIN-based authentication \u2014 no email needed',
                    'Step-by-step visit workflow with GPS lock',
                    'Offline mode with automatic background sync',
                    'Photo capture with compression and metadata',
                    'Bottom navigation for one-thumb operation',
                    'Daily targets and performance dashboard'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-[#00E87B] flex-shrink-0" />
                      <span className="text-sm text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#00C968] via-[#00E87B] to-[#1DFFB2] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { value: 500, suffix: '+', label: 'Companies' },
              { value: 50, suffix: 'K+', label: 'Field Agents' },
              { value: 99, suffix: '.9%', label: 'Uptime' },
              { value: 2, suffix: 'M+', label: 'Visits Tracked' },
            ].map((stat, i) => (
              <Reveal key={i} delay={i}>
                <div>
                  <div className="text-4xl sm:text-5xl font-extrabold text-[#06090F]">
                    <Counter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-[#06090F]/70 font-semibold mt-1">{stat.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-[#00E87B] text-sm font-semibold uppercase tracking-widest mb-3">What They Say</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Trusted by field operations leaders
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Reveal key={i} delay={i}>
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {Array(t.rating).fill(0).map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-[#00E87B] fill-[#00E87B]" />
                    ))}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed flex-1 mb-5">&ldquo;{t.quote}&rdquo;</p>
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role}, {t.company}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0A0E18]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-[#00E87B] text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Start free, scale as you grow. No hidden fees.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: 'Starter',
                price: '$49',
                period: 'per user / month',
                description: 'For small teams getting started with field operations.',
                features: ['Up to 10 agents', 'GPS-verified visits', 'Mobile app', 'Basic analytics', 'Email support'],
                popular: false
              },
              {
                name: 'Professional',
                price: '$99',
                period: 'per user / month',
                description: 'For growing teams that need advanced features.',
                features: ['Up to 100 agents', 'Van sales module', 'Survey builder', 'Advanced analytics', 'Priority support', 'API access'],
                popular: true
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                period: 'contact sales',
                description: 'For large organizations with custom requirements.',
                features: ['Unlimited agents', 'All modules', 'Custom integrations', 'Dedicated account manager', '24/7 phone support', 'SLA guarantee'],
                popular: false
              }
            ].map((plan, i) => (
              <Reveal key={i} delay={i}>
                <div className={`relative p-7 rounded-2xl border h-full flex flex-col ${
                  plan.popular
                    ? 'border-[#00E87B]/40 bg-gradient-to-b from-[#00E87B]/5 to-transparent shadow-xl shadow-[#00E87B]/10 scale-[1.02]'
                    : 'border-white/5 bg-white/[0.02]'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-[#00E87B] text-[#06090F] px-4 py-1 rounded-full text-xs font-bold">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mb-4">{plan.description}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                      <span className="text-sm text-slate-500">{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-3 flex-1 mb-7">
                    {plan.features.map((feat, j) => (
                      <li key={j} className="flex items-center gap-2.5">
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${plan.popular ? 'text-[#00E87B]' : 'text-slate-600'}`} />
                        <span className="text-sm text-slate-300">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/auth/login"
                    className={`block text-center py-3 rounded-full font-semibold text-sm transition-all ${
                      plan.popular
                        ? 'bg-[#00E87B] hover:bg-[#1DFFB2] text-[#06090F] shadow-lg shadow-[#00E87B]/20'
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                    }`}
                  >
                    {plan.price === 'Custom' ? 'Contact Sales' : 'Start Free Trial'}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E87B]/10 via-blue-600/5 to-purple-600/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00E87B]/5 rounded-full blur-[120px]" />

        <Reveal>
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-6">
              Ready to transform your field operations?
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
              Join hundreds of enterprises using FieldVibe to drive growth,
              eliminate ghost visits, and make data-driven decisions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/auth/login"
                className="inline-flex items-center justify-center bg-[#00E87B] hover:bg-[#1DFFB2] text-[#06090F] px-8 py-4 rounded-full transition-all font-bold text-base group shadow-lg shadow-[#00E87B]/25 hover:shadow-[#00E87B]/40 hover:scale-[1.02]"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/auth/mobile-login"
                className="inline-flex items-center justify-center border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-full transition-all font-semibold text-base"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Agent Login
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#06090F] text-slate-400 py-16 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-[#00E87B] to-[#00C968] rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">FieldVibe</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4 max-w-[200px]">
                The complete field force and van sales platform for modern enterprises.
              </p>
              <p className="text-xs text-slate-600">
                A product of <a href="https://www.gonxt.tech" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white font-semibold">GONXT</a>
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Product</h4>
              <ul className="space-y-2.5">
                {['Features', 'Modules', 'Pricing', 'Documentation', 'API Reference'].map((item) => (
                  <li key={item}><a href={`#${item.toLowerCase()}`} className="text-sm text-slate-500 hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li><a href="https://www.gonxt.tech" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-white transition-colors">About GONXT</a></li>
                {[
                  { label: 'Careers', path: '/careers' },
                  { label: 'Blog', path: '/blog' },
                  { label: 'Contact', path: '/contact' },
                  { label: 'Support', path: '/support' },
                ].map((item) => (
                  <li key={item.label}><Link to={item.path} className="text-sm text-slate-500 hover:text-white transition-colors">{item.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'Privacy Policy', path: '/privacy' },
                  { label: 'Terms of Service', path: '/terms' },
                  { label: 'Cookie Policy', path: '/cookies' },
                  { label: 'Security', path: '/security' },
                ].map((item) => (
                  <li key={item.label}><Link to={item.path} className="text-sm text-slate-500 hover:text-white transition-colors">{item.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-600">
              &copy; {new Date().getFullYear()} GONXT Technology (Pty) Ltd. A Vanta X Holdings company.
            </p>
            <div className="flex items-center gap-6">
              <Link to="/auth/login" className="text-xs text-slate-500 hover:text-[#00E87B] font-medium transition-colors">Admin Login</Link>
              <Link to="/auth/mobile-login" className="text-xs text-slate-500 hover:text-[#00E87B] font-medium transition-colors">Agent Login</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
