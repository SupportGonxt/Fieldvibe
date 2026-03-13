import { useState, useEffect } from 'react'

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

export default function AnimatedLogo({ 
  size = 'md', 
  showText = true, 
  className = '' 
}: AnimatedLogoProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
    xl: 'h-32 w-32'
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl'
  }

  return (
    <div 
      className={`flex flex-col items-center space-y-3 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated Logo Container */}
      <div className="relative">
        {/* Outer glow ring */}
        <div 
          className={`
            absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600
            transition-all duration-700 ease-out
            ${isLoaded ? 'opacity-20 scale-110' : 'opacity-0 scale-100'}
            ${isHovered ? 'opacity-40 scale-125 blur-sm' : ''}
          `}
        />
        
        {/* Main logo container */}
        <div 
          className={`
            relative ${sizeClasses[size]} 
            bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700
            rounded-2xl shadow-2xl
            flex items-center justify-center
            transition-all duration-500 ease-out
            ${isLoaded ? 'scale-100 rotate-0' : 'scale-0 rotate-180'}
            ${isHovered ? 'scale-105 shadow-3xl' : ''}
            overflow-hidden
          `}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>

          {/* Animated S letters */}
          <div className="relative z-10 flex items-center justify-center">
            <div className="relative">
              {/* First S */}
              <span 
                className={`
                  font-bold text-white
                  transition-all duration-700 ease-out
                  ${size === 'sm' ? 'text-sm' : size === 'md' ? 'text-xl' : size === 'lg' ? 'text-2xl' : 'text-3xl'}
                  ${isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
                  ${isHovered ? 'scale-110' : ''}
                `}
                style={{ 
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  animationDelay: '0.2s'
                }}
              >
                S
              </span>
              
              {/* Second S */}
              <span 
                className={`
                  font-bold text-white ml-0.5
                  transition-all duration-700 ease-out
                  ${size === 'sm' ? 'text-sm' : size === 'md' ? 'text-xl' : size === 'lg' ? 'text-2xl' : 'text-3xl'}
                  ${isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
                  ${isHovered ? 'scale-110' : ''}
                `}
                style={{ 
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  animationDelay: '0.4s'
                }}
              >
                S
              </span>
            </div>
          </div>

          {/* Floating particles */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`
                  absolute w-1 h-1 bg-white rounded-full opacity-30
                  transition-all duration-1000 ease-out
                  ${isHovered ? 'animate-pulse' : ''}
                `}
                style={{
                  left: `${20 + (i * 12)}%`,
                  top: `${15 + (i * 8)}%`,
                  animationDelay: `${i * 0.2}s`,
                  transform: isHovered ? `translateY(-${i * 2}px)` : 'translateY(0)'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Animated text */}
      {showText && (
        <div className="text-center">
          <h1 
            className={`
              ${textSizeClasses[size]} font-bold 
              bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 
              bg-clip-text text-transparent
              transition-all duration-700 ease-out
              ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
              ${isHovered ? 'scale-105' : ''}
            `}
            style={{ animationDelay: '0.6s' }}
          >
            FieldVibe
          </h1>
          <p 
            className={`
              text-gray-600 font-medium
              transition-all duration-700 ease-out
              ${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'}
              ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
              ${isHovered ? 'text-blue-600' : ''}
            `}
            style={{ animationDelay: '0.8s' }}
          >
            Field Force Management Platform
          </p>
        </div>
      )}
    </div>
  )
}