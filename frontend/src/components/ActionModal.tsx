import { useState, useEffect } from 'react'

type ActionType = 'add' | 'edit' | 'delete'

type Props = {
  action: ActionType
  personName: string
  personId: number
  parentId: number | null
  onClose: () => void
  onSuccess: (action: ActionType, parentId?: number | null) => void
}

function getStoredCode(): string | null {
  return sessionStorage.getItem('admin_code')
}

function storeCode(code: string) {
  sessionStorage.setItem('admin_code', code)
}

export default function ActionModal({ action, personName, personId, parentId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'code' | 'form'>(() =>
    getStoredCode() ? 'form' : 'code'
  )
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [name, setName] = useState(action === 'edit' ? personName : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const verifyCode = async () => {
    setLoading(true)
    setCodeError('')
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'X-Admin-Code': code },
      })
      if (res.ok) {
        storeCode(code)
        setStep('form')
      } else {
        setCodeError('Неверный код')
      }
    } catch {
      setCodeError('Ошибка соединения')
    }
    setLoading(false)
  }

  const getAdminCode = () => getStoredCode() || code

  const handleAdd = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/persons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Code': getAdminCode(),
        },
        body: JSON.stringify({ name: name.trim(), parent_id: personId }),
      })
      if (res.ok) {
        onSuccess('add')
      } else if (res.status === 403) {
        sessionStorage.removeItem('admin_code')
        setStep('code')
        setCodeError('Код устарел, введите заново')
      } else {
        setError('Ошибка при добавлении')
      }
    } catch {
      setError('Ошибка соединения')
    }
    setLoading(false)
  }

  const handleEdit = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/persons/${personId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Code': getAdminCode(),
        },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        onSuccess('edit')
      } else if (res.status === 403) {
        sessionStorage.removeItem('admin_code')
        setStep('code')
        setCodeError('Код устарел, введите заново')
      } else {
        setError('Ошибка при изменении')
      }
    } catch {
      setError('Ошибка соединения')
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/persons/${personId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Code': getAdminCode() },
      })
      if (res.ok) {
        onSuccess('delete', parentId)
      } else if (res.status === 403) {
        sessionStorage.removeItem('admin_code')
        setStep('code')
        setCodeError('Код устарел, введите заново')
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.detail || 'Ошибка при удалении')
      }
    } catch {
      setError('Ошибка соединения')
    }
    setLoading(false)
  }

  const titles: Record<ActionType, string> = {
    add: 'Добавить потомка',
    edit: 'Изменить имя',
    delete: 'Удалить',
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{titles[action]}</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        {step === 'code' && (
          <div className="modal-body">
            <p className="modal-hint">Введите код доступа</p>
            <input
              type="password"
              className="modal-input"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyCode()}
              placeholder="Код"
              autoFocus
            />
            {codeError && <p className="modal-error">{codeError}</p>}
            <button
              className="modal-btn"
              onClick={verifyCode}
              disabled={loading || !code}
            >
              {loading ? '...' : 'Подтвердить'}
            </button>
          </div>
        )}

        {step === 'form' && action === 'add' && (
          <div className="modal-body">
            <p className="modal-hint">Потомок для: <strong>{personName}</strong></p>
            <input
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Имя"
              autoFocus
            />
            {error && <p className="modal-error">{error}</p>}
            <button
              className="modal-btn"
              onClick={handleAdd}
              disabled={loading || !name.trim()}
            >
              {loading ? '...' : 'Добавить'}
            </button>
          </div>
        )}

        {step === 'form' && action === 'edit' && (
          <div className="modal-body">
            <input
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEdit()}
              placeholder="Новое имя"
              autoFocus
            />
            {error && <p className="modal-error">{error}</p>}
            <button
              className="modal-btn"
              onClick={handleEdit}
              disabled={loading || !name.trim()}
            >
              {loading ? '...' : 'Сохранить'}
            </button>
          </div>
        )}

        {step === 'form' && action === 'delete' && (
          <div className="modal-body">
            <p className="modal-hint">
              Удалить <strong>{personName}</strong>?
            </p>
            <p className="modal-hint modal-warning">Все потомки тоже будут удалены</p>
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-btn-row">
              <button className="modal-btn modal-btn-cancel" onClick={onClose}>
                Отмена
              </button>
              <button
                className="modal-btn modal-btn-danger"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? '...' : 'Удалить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
