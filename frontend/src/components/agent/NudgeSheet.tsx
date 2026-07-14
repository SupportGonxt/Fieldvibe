import { useState } from 'react'
import { Bell } from 'lucide-react'
import { defaultNudgeMessage } from '../../hooks/useRemediate'

/**
 * Small bottom-sheet editor for the nudge message, pre-filled with the default text.
 * Rendered by the PWA roster tabs (TeamTab, ManagerTeamsTab); send/cancel only.
 */
export function NudgeSheet({ target, onSend, onClose }: {
  target: { id: string; name: string } | null
  onSend: (message: string) => void
  onClose: () => void
}) {
  if (!target) return null
  // key remounts the editor so the textarea re-seeds per person
  return <Editor key={target.id} name={target.name} onSend={onSend} onClose={onClose} />
}

function Editor({ name, onSend, onClose }: {
  name: string
  onSend: (message: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(defaultNudgeMessage(name))
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md m-4 mb-6 p-4 bg-surface border border-token rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-token mb-2 flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-amber-300" /> Nudge {name}
        </h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          rows={3}
          autoFocus
          className="w-full p-3 text-sm bg-white/5 border border-token rounded-lg text-token placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 resize-none"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="min-h-[44px] py-2 bg-white/5 border border-token rounded-lg text-xs font-semibold text-token-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onSend(text)}
            disabled={!text.trim()}
            className="min-h-[44px] py-2 bg-amber-400/10 border border-amber-400/25 rounded-lg text-xs font-semibold text-amber-300 disabled:opacity-50"
          >
            Send Nudge
          </button>
        </div>
      </div>
    </div>
  )
}
