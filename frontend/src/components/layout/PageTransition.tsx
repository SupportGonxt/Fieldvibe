import { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

// ponytail: CSS animation replaces framer-motion (381KB source for one fade);
// exit variant was dead code — no AnimatePresence wrapped this.
export default function PageTransition({ children }: PageTransitionProps) {
  return <div className="animate-slide-up motion-reduce:animate-none">{children}</div>
}
