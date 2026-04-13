import { useRef, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

type PersonNodeData = {
  label: string
  personId: number
  childrenCount: number
  collapsed: boolean
  onToggle: (id: number) => void
  onLongPress: (id: number) => void
}

const LONG_PRESS_MS = 800

export default function PersonNode({ data }: NodeProps) {
  const nodeData = data as unknown as PersonNodeData
  const hasChildren = nodeData.childrenCount > 0
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    didLongPress.current = false
    // Capture pointer so we get pointerup even if finger/mouse moves slightly
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      nodeData.onLongPress(nodeData.personId)
      // Vibrate on mobile if available
      navigator.vibrate?.(50)
    }, LONG_PRESS_MS)
  }, [nodeData])

  const handlePointerUp = useCallback(() => {
    clearTimer()
  }, [clearTimer])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    if (hasChildren) {
      nodeData.onToggle(nodeData.personId)
    } else {
      nodeData.onLongPress(nodeData.personId)
    }
  }, [hasChildren, nodeData])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Prevent context menu on long press (mobile)
    e.preventDefault()
  }, [])

  return (
    <div
      className={`person-node ${nodeData.collapsed ? 'collapsed' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div className="person-name">{nodeData.label}</div>
      {hasChildren && (
        <div className="person-badge">
          {nodeData.collapsed ? `+${nodeData.childrenCount}` : `${nodeData.childrenCount}`}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  )
}
