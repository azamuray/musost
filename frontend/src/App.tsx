import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import PersonNode from './components/PersonNode'

type Person = {
  id: number
  name: string
  parent_id: number | null
}

const nodeTypes = { person: PersonNode }

function layoutTree(persons: Person[]) {
  const childrenMap = new Map<number | null, Person[]>()
  for (const p of persons) {
    const key = p.parent_id
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key)!.push(p)
  }

  const nodes: Node[] = []
  const edges: Edge[] = []
  const nodeWidth = 120
  const nodeHeight = 60
  const horizontalGap = 20
  const verticalGap = 80

  let xCounter = 0

  function traverse(personId: number, depth: number): { minX: number; maxX: number } {
    const children = childrenMap.get(personId) || []
    const person = persons.find(p => p.id === personId)!

    if (children.length === 0) {
      const x = xCounter * (nodeWidth + horizontalGap)
      xCounter++
      nodes.push({
        id: String(personId),
        type: 'person',
        position: { x, y: depth * (nodeHeight + verticalGap) },
        data: { label: person.name, personId: person.id },
      })
      return { minX: x, maxX: x }
    }

    const ranges = children.map(child => {
      edges.push({
        id: `e${personId}-${child.id}`,
        source: String(personId),
        target: String(child.id),
      })
      return traverse(child.id, depth + 1)
    })

    const minX = Math.min(...ranges.map(r => r.minX))
    const maxX = Math.max(...ranges.map(r => r.maxX))
    const x = (minX + maxX) / 2

    nodes.push({
      id: String(personId),
      type: 'person',
      position: { x, y: depth * (nodeHeight + verticalGap) },
      data: { label: person.name, personId: person.id },
    })

    return { minX, maxX }
  }

  const roots = childrenMap.get(null) || []
  for (const root of roots) {
    traverse(root.id, 0)
  }

  return { nodes, edges }
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/persons')
      .then(res => res.json())
      .then((data: Person[]) => {
        setPersons(data)
        const { nodes: n, edges: e } = layoutTree(data)
        setNodes(n)
        setEdges(e)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load persons:', err)
        setLoading(false)
      })
  }, [setNodes, setEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const person = persons.find(p => p.id === Number(node.id))
      setSelectedPerson(person || null)
    },
    [persons],
  )

  if (loading) return <div className="loading">Loading tree...</div>

  const parent = selectedPerson?.parent_id
    ? persons.find(p => p.id === selectedPerson.parent_id)
    : null
  const children = selectedPerson
    ? persons.filter(p => p.parent_id === selectedPerson.id)
    : []

  return (
    <div className="app-container">
      <div className="header">
        <h1>Musost</h1>
        <span>Genealogical Tree</span>
      </div>
      <div className="tree-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      {selectedPerson && (
        <div className="person-panel">
          <button className="close-btn" onClick={() => setSelectedPerson(null)}>
            x
          </button>
          <h2>{selectedPerson.name}</h2>
          <div className="info-row">
            <span className="label">ID</span>
            <span>{selectedPerson.id}</span>
          </div>
          {parent && (
            <div className="info-row">
              <span className="label">Father</span>
              <span>{parent.name}</span>
            </div>
          )}
          <div className="info-row">
            <span className="label">Children</span>
            <span>{children.length > 0 ? children.map(c => c.name).join(', ') : '-'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
