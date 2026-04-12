import { Handle, Position, type NodeProps } from '@xyflow/react'

type PersonNodeData = {
  label: string
  personId: number
}

export default function PersonNode({ data }: NodeProps) {
  const nodeData = data as unknown as PersonNodeData
  return (
    <div className="person-node">
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div>{nodeData.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  )
}
