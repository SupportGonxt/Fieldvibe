import { Outlet, Link } from 'react-router-dom'
import { Zap, Shield, Globe, Smartphone, BarChart3, Users } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div id="auth-layout" className="auth-layout min-h-screen bg-[#06090F] flex">
      {/* Left side - Modern Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#06090F] via-[#0A1628] to-[#0F1D35]"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#00E87B] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-[#4BFFB5] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-[#00E87B] rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <Link to="/" className="inline-flex items-center space-x-3 group">
              <div className="w-12 h-12 bg-[#00E87B]/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:bg-[#00E87B]/30 transition-colors">
                <Zap className="w-7 h-7 text-[#00E87B]" />
              </div>
              <div>
                <span className="text-2xl font-bold text-white">FieldVibe</span>
                <p className="text-slate-400 text-xs">Enterprise Platform</p>
              </div>
            </Link>
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-5xl font-bold text-white leading-tight mb-4">
                Power Your
                <span className="block bg-gradient-to-r from-[#00E87B] to-[#4BFFB5] bg-clip-text text-transparent">
                  Field Operations
                </span>
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed max-w-md">
                The complete platform for field force management, van sales, and trade marketing excellence.
              </p>
            </div>
            
            {/* Feature highlights */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
                <BarChart3 className="w-8 h-8 text-[#00E87B] mb-3" />
                <div className="text-white font-semibold mb-1">Real-Time Analytics</div>
                <div className="text-slate-400 text-sm">Live dashboards & insights</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
                <Users className="w-8 h-8 text-[#4BFFB5] mb-3" />
                <div className="text-white font-semibold mb-1">Team Management</div>
                <div className="text-slate-400 text-sm">GPS tracking & routes</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
                <Smartphone className="w-8 h-8 text-[#00E87B] mb-3" />
                <div className="text-white font-semibold mb-1">Mobile First</div>
                <div className="text-slate-400 text-sm">iOS & Android apps</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
                <Shield className="w-8 h-8 text-green-300 mb-3" />
                <div className="text-white font-semibold mb-1">Enterprise Security</div>
                <div className="text-slate-400 text-sm">SOC2 compliant</div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-8 pt-4">
              <div>
                <div className="text-3xl font-bold text-white">500+</div>
                <div className="text-slate-400 text-sm">Companies</div>
              </div>
              <div className="w-px h-12 bg-white/20"></div>
              <div>
                <div className="text-3xl font-bold text-white">50K+</div>
                <div className="text-slate-400 text-sm">Field Agents</div>
              </div>
              <div className="w-px h-12 bg-white/20"></div>
              <div>
                <div className="text-3xl font-bold text-white">99.9%</div>
                <div className="text-slate-400 text-sm">Uptime</div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Globe className="w-5 h-5 text-[#00E87B]" />
            <span className="text-slate-400 text-sm">Trusted by enterprises in 25+ countries</span>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gradient-to-b from-[#0A0E18] to-[#06090F]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <Link to="/" className="inline-flex items-center justify-center space-x-3">
              <div className="w-12 h-12 bg-[#00E87B]/20 rounded-xl flex items-center justify-center">
                <Zap className="w-7 h-7 text-[#00E87B]" />
              </div>
              <span className="text-2xl font-bold text-white">FieldVibe</span>
            </Link>
            <p className="text-slate-400 text-sm mt-3">Enterprise Field Force Platform</p>
          </div>

          {/* Form container */}
          <div className="bg-[#0A1628]/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
            <Outlet />
          </div>

          {/* GONXT branding */}
          <div className="mt-8 text-center flex items-center justify-center space-x-2">
            <span className="text-slate-500 text-sm">A Product of</span>
            <a href="https://www.gonxt.tech" target="_blank" rel="noopener noreferrer" className="text-slate-300 font-semibold hover:text-[#00E87B] transition-colors">GONXT</a>
          </div>
        </div>
      </div>
    </div>
  )
}
