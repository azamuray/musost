import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TreeDeciduous, Plus, Pencil, Trash2 } from 'lucide-react'
import PersonNode from './components/PersonNode'
import ActionModal from './components/ActionModal'

type Person = {
  id: number
  name: string
  parent_id: number | null
}

const nodeTypes = { person: PersonNode }

const INITIAL_DEPTH = 3
const NODE_WIDTH = 140
const NODE_HEIGHT = 50
const H_GAP = 16
const V_GAP = 70

function makeChildrenMap(persons: Person[]) {
  const map = new Map<number | null, Person[]>()
  for (const p of persons) {
    if (!map.has(p.parent_id)) map.set(p.parent_id, [])
    map.get(p.parent_id)!.push(p)
  }
  return map
}

function computeInitialCollapsed(childrenMap: Map<number | null, Person[]>) {
  const toCollapse = new Set<number>()
  function walk(id: number, depth: number) {
    const children = childrenMap.get(id) || []
    if (children.length > 0 && depth >= INITIAL_DEPTH) {
      toCollapse.add(id)
    }
    for (const child of children) {
      walk(child.id, depth + 1)
    }
  }
  const roots = childrenMap.get(null) || []
  for (const root of roots) walk(root.id, 0)
  return toCollapse
}

function countDescendants(id: number, childrenMap: Map<number | null, Person[]>): number {
  const children = childrenMap.get(id) || []
  let count = children.length
  for (const child of children) {
    count += countDescendants(child.id, childrenMap)
  }
  return count
}

function buildLayout(
  persons: Person[],
  childrenMap: Map<number | null, Person[]>,
  collapsedSet: Set<number>,
) {
  const layoutNodes: Node[] = []
  const layoutEdges: Edge[] = []
  let xCounter = 0

  function traverse(personId: number, depth: number): { minX: number; maxX: number } {
    const person = persons.find(p => p.id === personId)!
    const children = childrenMap.get(personId) || []
    const isCollapsed = collapsedSet.has(personId)
    const visibleChildren = isCollapsed ? [] : children

    if (visibleChildren.length === 0) {
      const x = xCounter * (NODE_WIDTH + H_GAP)
      xCounter++
      layoutNodes.push({
        id: String(personId),
        type: 'person',
        position: { x, y: depth * (NODE_HEIGHT + V_GAP) },
        data: {
          label: person.name,
          personId: person.id,
          childrenCount: countDescendants(personId, childrenMap),
          collapsed: isCollapsed,
          onToggle: () => {},
        },
      })
      return { minX: x, maxX: x }
    }

    const ranges = visibleChildren.map(child => {
      layoutEdges.push({
        id: `e${personId}-${child.id}`,
        source: String(personId),
        target: String(child.id),
      })
      return traverse(child.id, depth + 1)
    })

    const minX = Math.min(...ranges.map(r => r.minX))
    const maxX = Math.max(...ranges.map(r => r.maxX))
    const x = (minX + maxX) / 2

    layoutNodes.push({
      id: String(personId),
      type: 'person',
      position: { x, y: depth * (NODE_HEIGHT + V_GAP) },
      data: {
        label: person.name,
        personId: person.id,
        childrenCount: countDescendants(personId, childrenMap),
        collapsed: isCollapsed,
        onToggle: () => {},
      },
    })

    return { minX, maxX }
  }

  const roots = childrenMap.get(null) || []
  for (const root of roots) traverse(root.id, 0)

  return { nodes: layoutNodes, edges: layoutEdges }
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ action: 'add' | 'edit' | 'delete'; personId: number; personName: string; parentId: number | null } | null>(null)

  const { setCenter, getZoom, fitView } = useReactFlow()
  const personsRef = useRef<Person[]>([])
  const childrenMapRef = useRef<Map<number | null, Person[]>>(new Map())
  const collapsedRef = useRef<Set<number>>(new Set())
  const [isExpanded, setIsExpanded] = useState(false)

  const handleLongPress = useCallback((id: number) => {
    const person = personsRef.current.find(p => p.id === id)
    if (person) setSelectedPerson(person)
  }, [])

  const rebuildTree = useCallback(
    (collapsedSet: Set<number>, focusNodeId?: number) => {
      collapsedRef.current = collapsedSet
      const { nodes: n, edges: e } = buildLayout(
        personsRef.current,
        childrenMapRef.current,
        collapsedSet,
      )
      // Inject toggle and long-press handlers
      const withToggle = n.map(node => ({
        ...node,
        data: {
          ...node.data,
          onLongPress: handleLongPress,
          onToggle: (id: number) => {
            const next = new Set(collapsedRef.current)
            if (next.has(id)) {
              next.delete(id)
            } else {
              next.add(id)
              // Collapse all descendants so they don't stay open
              const collapseDescendants = (parentId: number) => {
                const ch = childrenMapRef.current.get(parentId) || []
                for (const child of ch) {
                  if ((childrenMapRef.current.get(child.id) || []).length > 0) {
                    next.add(child.id)
                  }
                  collapseDescendants(child.id)
                }
              }
              collapseDescendants(id)
            }
            rebuildTree(next, id)
          },
        },
      }))
      setNodes(withToggle)
      setEdges(e)
      if (focusNodeId !== undefined) {
        const target = withToggle.find(nd => nd.id === String(focusNodeId))
        if (target) {
          setTimeout(() => {
            setCenter(
              target.position.x + NODE_WIDTH / 2,
              target.position.y + NODE_HEIGHT / 2,
              { zoom: getZoom(), duration: 200 },
            )
          }, 50)
        }
      }
    },
    [setNodes, setEdges, setCenter, getZoom, handleLongPress],
  )

  useEffect(() => {
    fetch('/api/persons')
      .then(res => res.json())
      .then((data: Person[]) => {
        personsRef.current = data
        childrenMapRef.current = makeChildrenMap(data)
        const initial = computeInitialCollapsed(childrenMapRef.current)
        setPersons(data)
        setLoading(false)
        rebuildTree(initial)
      })
      .catch(err => {
        console.error('Failed to load persons:', err)
        setLoading(false)
      })
  }, [rebuildTree])

  const reloadData = useCallback(() => {
    return fetch('/api/persons')
      .then(res => res.json())
      .then((data: Person[]) => {
        personsRef.current = data
        childrenMapRef.current = makeChildrenMap(data)
        setPersons(data)
        rebuildTree(collapsedRef.current)
        return data
      })
  }, [rebuildTree])

  const handleActionSuccess = useCallback((action: 'add' | 'edit' | 'delete', parentId?: number | null) => {
    setModal(null)
    setSelectedPerson(null)
    reloadData().then((data) => {
      if (action === 'delete' && parentId && data) {
        const parent = data.find((p: Person) => p.id === parentId)
        if (parent) setSelectedPerson(parent)
      }
    })
  }, [reloadData])

  const toggleExpandAll = useCallback(() => {
    if (isExpanded) {
      const initial = computeInitialCollapsed(childrenMapRef.current)
      rebuildTree(initial)
      requestAnimationFrame(() => fitView({ padding: 0.3, duration: 300 }))
    } else {
      rebuildTree(new Set())
      requestAnimationFrame(() => fitView({ padding: 0.3, duration: 300 }))
    }
    setIsExpanded(!isExpanded)
  }, [isExpanded, rebuildTree, fitView])

  if (loading) return <div className="loading">Loading...</div>

  const parent = selectedPerson?.parent_id
    ? persons.find(p => p.id === selectedPerson.parent_id)
    : null
  const children = selectedPerson
    ? persons.filter(p => p.parent_id === selectedPerson.id)
    : []

  return (
    <div className="app-container">
      <div className="header">
        <div className="logo">
          <TreeDeciduous size={24} color="#4ecca3" />
          <span className="logo-text">Тайпан дитт</span>
        </div>
        <span>{persons.length} стаг</span>
      </div>
      <div className="tree-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false}>
            <button
              className="expand-all-btn"
              onClick={toggleExpandAll}
              title={isExpanded ? 'Свернуть дерево' : 'Раскрыть всё дерево'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                {isExpanded ? (
                  <>
                    <path d="M4 10L8 6L12 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 14L8 10L12 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </>
                ) : (
                  <>
                    <path d="M4 2L8 6L12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </>
                )}
              </svg>
            </button>
          </Controls>
        </ReactFlow>
      </div>
      {selectedPerson && (
        <div className="person-panel">
          <button className="close-btn" onClick={() => setSelectedPerson(null)}>
            x
          </button>
          <h2>{selectedPerson.name}</h2>
          <div className="action-buttons">
            <button
              className="action-btn"
              title="Добавить потомка"
              onClick={() => setModal({ action: 'add', personId: selectedPerson.id, personName: selectedPerson.name, parentId: selectedPerson.parent_id })}
            >
              <Plus size={16} />
            </button>
            <button
              className="action-btn"
              title="Изменить имя"
              onClick={() => setModal({ action: 'edit', personId: selectedPerson.id, personName: selectedPerson.name, parentId: selectedPerson.parent_id })}
            >
              <Pencil size={16} />
            </button>
            <button
              className="action-btn action-btn-danger"
              title="Удалить"
              onClick={() => setModal({ action: 'delete', personId: selectedPerson.id, personName: selectedPerson.name, parentId: selectedPerson.parent_id })}
            >
              <Trash2 size={16} />
            </button>
          </div>
          {parent && (
            <div className="info-row">
              <span className="label">Отец</span>
              <span
                className="link"
                onClick={() => setSelectedPerson(parent)}
              >
                {parent.name}
              </span>
            </div>
          )}
          {children.length > 0 && (
            <div className="info-row children-list">
              <span className="label">Дети ({children.length})</span>
              <div className="children-names">
                {children.map(c => (
                  <span
                    key={c.id}
                    className="link"
                    onClick={() => setSelectedPerson(c)}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {modal && (
        <ActionModal
          action={modal.action}
          personName={modal.personName}
          personId={modal.personId}
          parentId={modal.parentId}
          onClose={() => setModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  )
}
