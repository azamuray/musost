import { Handle, Position, type NodeProps } from '@xyflow/react'

type PersonNodeData = {
  label: string
  personId: number
  childrenCount: number
  collapsed: boolean
  onToggle: (id: number) => void
}

export default function PersonNode({ data }: NodeProps) {
  const nodeData = data as unknown as PersonNodeData
  const hasChildren = nodeData.childrenCount > 0

  return (
    <div
      className={`person-node ${nodeData.collapsed ? 'collapsed' : ''}`}
      onClick={(e) => {
        if (hasChildren) {
          e.stopPropagation()
          nodeData.onToggle(nodeData.personId)
        }
      }}
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
