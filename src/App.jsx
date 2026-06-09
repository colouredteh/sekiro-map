import { useEffect, useRef, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import mapImage from '/map.png'
import markersData from './data/markers.json'
import './App.css'

const MARKER_TYPES = [
  { id: 'boss', label: 'Boss', color: '#ff4444' },
  { id: 'mini-boss', label: 'Mini-Boss', color: '#ff8844' },
  { id: 'sculptor-idol', label: "Sculptor's Idol", color: '#4488ff' },
  { id: 'prayer-bead', label: 'Prayer Bead', color: '#e8b84b' },
  { id: 'gourd-seed', label: 'Gourd Seed', color: '#44cc88' },
  { id: 'prosthetic', label: 'Prosthetic', color: '#ff66aa' },
  { id: 'combat-art', label: 'Combat Art', color: '#aa66ff' },
]

function Marker({ marker, onToggleVisited }) {
  const type = MARKER_TYPES.find(t => t.id === marker.type) || MARKER_TYPES[0]
  const [hovered, setHovered] = useState(false)
  const hideTimer = useRef(null)

  const show = () => {
    clearTimeout(hideTimer.current)
    setHovered(true)
  }

  const hide = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setHovered(false), 80)
  }

  const handleClick = (e) => {
    e.stopPropagation()
    onToggleVisited(marker.id)
  }

  return (
    <div
      className={`marker ${marker.visited ? 'visited' : ''}`}
      style={{ left: marker.screenX, top: marker.screenY }}
    >
      <div
        className="marker-dot"
        style={{ background: type.color, boxShadow: `0 0 8px ${type.color}88, 0 0 16px ${type.color}44` }}
        onClick={handleClick}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {marker.visited && <span className="marker-check">&#10003;</span>}
      </div>
      {hovered && (
        <div className="marker-tooltip" onMouseEnter={show} onMouseLeave={hide}>
          <span className="marker-type">{type.label}</span>
          <span className="marker-name">{marker.name}</span>
          <span className="marker-name-en">{marker.name}</span>
          <label className="tooltip-check">
            <input
              type="checkbox"
              checked={!!marker.visited}
              onChange={() => onToggleVisited(marker.id)}
            />
            Visited
          </label>
        </div>
      )}
    </div>
  )
}

function App() {
  const [init, setInit] = useState(null)
  const [transform, setTransform] = useState(null)
  const [customMarkers, setCustomMarkers] = useState(() => {
    const saved = localStorage.getItem('sekiro-markers')
    if (saved) {
      const savedMarkers = JSON.parse(saved)
      return markersData.map(m => {
        const s = savedMarkers.find(sm => sm.id === m.id)
        return s ? { ...m, visited: s.visited } : m
      })
    }
    return markersData
  })
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 })
  const [sideOpen, setSideOpen] = useState(false)
  const [hiddenMarkers, setHiddenMarkers] = useState(() => {
    const saved = localStorage.getItem('sekiro-hidden')
    return new Set(saved ? JSON.parse(saved) : [])
  })
  const [collapsedTypes, setCollapsedTypes] = useState(() => {
    const saved = localStorage.getItem('sekiro-collapsed')
    return new Set(saved ? JSON.parse(saved) : [])
  })
  const transformRef = useRef(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const sx = vw / img.naturalWidth
      const sy = vh / img.naturalHeight
      const fs = Math.min(sx, sy) * 0.95
      const cx = (vw - img.naturalWidth * fs) / 2
      const cy = (vh - img.naturalHeight * fs) / 2
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
      setInit({ scale: fs, minScale: fs * 0.8, x: cx, y: cy })
      setTransform({ x: cx, y: cy, scale: fs })
    }
    img.src = mapImage
  }, [])

  useEffect(() => {
    localStorage.setItem('sekiro-markers', JSON.stringify(customMarkers.map(m => ({ id: m.id, visited: m.visited }))))
  }, [customMarkers])

  useEffect(() => {
    localStorage.setItem('sekiro-hidden', JSON.stringify([...hiddenMarkers]))
  }, [hiddenMarkers])

  useEffect(() => {
    localStorage.setItem('sekiro-collapsed', JSON.stringify([...collapsedTypes]))
  }, [collapsedTypes])

  const toggleVisited = (id) => {
    setCustomMarkers(prev => prev.map(m =>
      m.id === id ? { ...m, visited: !m.visited } : m
    ))
  }

  const toggleHidden = (id) => {
    setHiddenMarkers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTypeHidden = (typeId) => {
    const ids = customMarkers.filter(m => m.type === typeId).map(m => m.id)
    const allHidden = ids.every(id => hiddenMarkers.has(id))
    setHiddenMarkers(prev => {
      const next = new Set(prev)
      ids.forEach(id => {
        if (allHidden) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  const toggleTypeCollapsed = (typeId) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev)
      if (next.has(typeId)) next.delete(typeId)
      else next.add(typeId)
      return next
    })
  }

  const flyToMarker = (m) => {
    if (!transformRef.current || !transform) return
    const scale = transform.scale
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const nx = cx - (m.x / 100) * imgSize.w * scale
    const ny = cy - (m.y / 100) * imgSize.h * scale
    transformRef.current.setTransform(nx, ny, scale, 0)
  }

  if (!init || !transform) {
    return <div className="map-container map-loading" />
  }

  const visibleMarkers = customMarkers.filter(m => !hiddenMarkers.has(m.id))
  const mappedMarkers = visibleMarkers.map(m => ({
    ...m,
    screenX: (m.x / 100) * imgSize.w * transform.scale + transform.x,
    screenY: (m.y / 100) * imgSize.h * transform.scale + transform.y,
  }))

  const totalByType = {}
  const visitedByType = {}
  MARKER_TYPES.forEach(t => {
    totalByType[t.id] = customMarkers.filter(m => m.type === t.id).length
    visitedByType[t.id] = customMarkers.filter(m => m.type === t.id && m.visited).length
  })

  return (
    <div className="map-container">
      <TransformWrapper
        ref={transformRef}
        initialScale={init.scale}
        initialPositionX={init.x}
        initialPositionY={init.y}
        minScale={init.minScale}
        maxScale={4}
        limitToBounds={false}
        wheel={{ step: 0.005 }}
        pinch={{ step: 0.005 }}
        zoomAnimation={{ disabled: true }}
        velocityAnimation={{ disabled: true }}
        onTransform={(_, state) => setTransform({ x: state.positionX, y: state.positionY, scale: state.scale })}
      >
        <TransformComponent wrapperClass="map-wrapper">
          <div className="map-image-wrapper">
            <img src={mapImage} alt="Sekiro Map" className="map-image" draggable={false} />
          </div>
        </TransformComponent>
      </TransformWrapper>

      <div className="markers-overlay">
        {mappedMarkers.map(m => (
          <Marker
            key={m.id}
            marker={m}
            onToggleVisited={toggleVisited}
          />
        ))}
      </div>

      <button className={`side-toggle ${sideOpen ? 'open' : ''}`} onClick={() => setSideOpen(o => !o)}>
        {sideOpen ? '\u276E' : '\u276F'}
      </button>

      <div className={`side-menu ${sideOpen ? 'open' : ''}`}>
        <div className="side-header">Markers</div>
        <div className="side-body">
          {MARKER_TYPES.map(type => {
            const total = totalByType[type.id]
            if (total === 0) return null
            const visited = visitedByType[type.id]
            const collapsed = collapsedTypes.has(type.id)
            const typeMarkers = customMarkers.filter(m => m.type === type.id)
            const allHidden = typeMarkers.every(m => hiddenMarkers.has(m.id))
            return (
              <div key={type.id} className="side-group">
                <div className="side-group-header">
                  <span
                    className="side-collapse"
                    onClick={() => toggleTypeCollapsed(type.id)}
                  >
                    {collapsed ? '\u25B6' : '\u25BC'}
                  </span>
                  <span
                    className="side-group-dot"
                    style={{ background: type.color }}
                    onClick={() => toggleTypeHidden(type.id)}
                  >
                    <span className={`side-eye ${allHidden ? 'hidden' : ''}`}>
                      {allHidden ? '\u25CB' : '\u25CF'}
                    </span>
                  </span>
                  <span className="side-group-label">{type.label}</span>
                  <span className="side-group-count">{visited}/{total}</span>
                </div>
                {!collapsed && typeMarkers.map(m => (
                  <div key={m.id} className={`side-item ${m.visited ? 'visited' : ''}`} onClick={() => flyToMarker(m)}>
                    <span
                      className="side-item-eye"
                      onClick={() => toggleHidden(m.id)}
                    >
                      {hiddenMarkers.has(m.id) ? '\u25CB' : '\u25CF'}
                    </span>
                    <span
                      className="side-item-dot"
                      style={{ background: type.color }}
                    />
                    <span className="side-item-name">{m.name}</span>
                    <input
                      type="checkbox"
                      className="side-item-check"
                      checked={!!m.visited}
                      onChange={() => toggleVisited(m.id)}
                    />
                  </div>
                ))}
              </div>
            )
          })}
          {customMarkers.length === 0 && (
            <div className="side-empty">No markers yet</div>
          )}
        </div>
        <div className="side-footer">
          <span className="side-total">
            {customMarkers.filter(m => m.visited).length}/{customMarkers.length}
          </span>
          <span className="side-visible">
            {visibleMarkers.length} visible
          </span>
          <button className="side-clear" onClick={() => setCustomMarkers(prev => prev.map(m => ({ ...m, visited: false })))}>Clear</button>
          <span className="side-credit">World Map By <a href="https://www.reddit.com/r/Sekiro/comments/bi276t/sekiro_world_map_by_lucas_reiner/" target="_blank" rel="noopener noreferrer">Lucas Rainer</a></span>
        </div>
      </div>
    </div>
  )
}

export default App
