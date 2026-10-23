import React, { forwardRef } from 'react'

const ControlsPanel = forwardRef(function ControlsPanel(
  { open, query, onQueryChange, results, onPickResult, types, activeTypes, onToggleType, onOpenOffline },
  searchInputRef
) {
  const trimmed = query.trim()
  const status = !trimmed ? '' : results.length ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : `No locations match “${trimmed}”.`

  const handleSubmit = (event) => {
    event.preventDefault()
    if (results[0]) onPickResult(results[0])
  }

  return (
    <aside id="mapControls" className={`controls-panel${open ? ' visible' : ''}`} aria-label="Map tools" aria-hidden={!open}>
      <div className="controls-heading">
        <div>
          <span className="controls-eyebrow">SL2 world map</span>
          <h2>Explore</h2>
        </div>
        <span className="shortcut-badge" aria-hidden="true">H</span>
      </div>
      <form className="control-group search-group" role="search" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="searchInput">Search locations</label>
        <input ref={searchInputRef} type="search" id="searchInput" placeholder="Search locations..." autoComplete="off" value={query} onChange={(event) => onQueryChange(event.target.value)} />
        <button type="submit" className="search-btn" aria-label="Go to first match">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
      </form>
      <div id="searchStatus" className="search-status" role="status" aria-live="polite">{status}</div>
      {results.length > 0 && (
        <ul className="search-results" aria-label="Search results">
          {results.map((location) => (
            <li key={location.id}>
              <button type="button" className="search-result" onClick={() => onPickResult(location)}>
                <span className={`result-dot type-${location.type}`} aria-hidden="true"></span>
                <span className="result-name">{location.name}</span>
                <span className="result-type">{location.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {types.length > 1 && (
        <fieldset className="type-filters">
          <legend>Show on map</legend>
          {types.map((type) => (
            <button key={type} type="button" className={`filter-chip type-${type}`} aria-pressed={activeTypes.has(type)} onClick={() => onToggleType(type)}>
              {type}
            </button>
          ))}
        </fieldset>
      )}
      <div className="control-group offline-group">
        <div className="offline-copy">
          <strong>Offline access</strong>
          <span>Save the full map only when you choose.</span>
        </div>
        <button className="offline-btn" onClick={onOpenOffline}>Manage</button>
      </div>
      {import.meta.env.DEV && <a className="dev-link" href="/?arrange">Arrange regions (dev)</a>}
      <details className="keyboard-help">
        <summary>Map tips</summary>
        <div id="keyboardHelpText" className="shortcut-grid">
          <span>Pan</span><kbd>Arrow keys</kbd>
          <span>Zoom</span><kbd>+ / −</kbd>
          <span>Reset</span><kbd>0</kbd>
          <span>Tools</span><kbd>H or Space</kbd>
          <span>Close</span><kbd>Esc</kbd>
          <span>Link to a spot</span><kbd>Right-click / long-press</kbd>
        </div>
      </details>
    </aside>
  )
})

export default ControlsPanel
