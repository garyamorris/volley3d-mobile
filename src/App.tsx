import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import './App.css'
import { createVolleyScene, type ShotKind, type VolleyScene } from './volleyScene'

type RallyPhase = 'serve-ready' | 'serve-flight' | 'set-flight' | 'spike-ready' | 'spike-flight' | 'block-ready' | 'point-home' | 'point-away'

type ShotEvent = {
  kind: ShotKind
  x: number
  z: number
}

const COURT = {
  userBack: new THREE.Vector3(-5.7, 1.6, 2.2),
  userSpike: new THREE.Vector3(-1.5, 1.65, 1.0),
  aiReceive: new THREE.Vector3(5.4, 1.45, -2.0),
  aiSet: new THREE.Vector3(1.8, 1.65, -0.5),
  aiBlock: new THREE.Vector3(1.1, 1.75, -0.4),
}

const BEATS = [
  { n: '1', label: 'SERVE', time: '00:00', color: '#67d8ff' },
  { n: '2', label: 'SET', time: '00:02', color: '#78f6ae' },
  { n: '3', label: 'SPIKE', time: '00:04', color: '#c87cff' },
  { n: '4', label: 'BLOCK', time: '00:05', color: '#ff89da' },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<VolleyScene | null>(null)
  const timeoutsRef = useRef<number[]>([])
  const [clock, setClock] = useState(() => performance.now())
  const [aim, setAim] = useState(1.8)
  const [phase, setPhase] = useState<RallyPhase>('serve-ready')
  const [message, setMessage] = useState('Tap SERVE to start the rally')
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [momentum, setMomentum] = useState(58)
  const [recentShots, setRecentShots] = useState<ShotEvent[]>([
    { kind: 'serve', x: -2.4, z: 1.2 },
    { kind: 'set', x: 1.2, z: -0.6 },
    { kind: 'spike', x: 2.0, z: -1.6 },
  ])
  const [timelineBeat, setTimelineBeat] = useState(0)
  const [reactionEndsAt, setReactionEndsAt] = useState(0)

  const clearTimers = () => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutsRef.current = []
  }

  const queue = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }

  const addShot = (kind: ShotKind, x: number, z: number) => {
    setRecentShots((shots) => [{ kind, x, z }, ...shots].slice(0, 9))
  }

  const restartRound = (nextMessage = 'Tap SERVE to keep the run alive') => {
    clearTimers()
    setPhase('serve-ready')
    setTimelineBeat(0)
    setReactionEndsAt(0)
    setMessage(nextMessage)
  }

  const startServe = () => {
    if (phase !== 'serve-ready' || !sceneRef.current) return

    clearTimers()
    setPhase('serve-flight')
    setTimelineBeat(0)
    setMessage('Serve launched — watch the arc')

    const serveSpeed = 760 - combo * 12
    sceneRef.current.animateShot({
      from: COURT.userBack,
      to: new THREE.Vector3(clamp(aim, -2.6, 2.6), 1.45, -2.2),
      durationMs: serveSpeed,
      height: 2.8,
      color: '#67d8ff',
      onComplete: () => {
        addShot('serve', clamp(aim, -2.6, 2.6), -2.2)
        setTimelineBeat(1)
        setPhase('set-flight')
        setMessage('AI sets the ball — prep your attack')

        sceneRef.current?.animateShot({
          from: COURT.aiReceive,
          to: COURT.userSpike,
          durationMs: 690 - combo * 10,
          height: 2.15,
          color: '#78f6ae',
          onComplete: () => {
            addShot('set', COURT.userSpike.x, COURT.userSpike.z)
            setTimelineBeat(2)
            setPhase('spike-ready')
            setMessage('Tap SPIKE at the peak')
          },
        })
      },
    })
  }

  const startSpike = () => {
    if (phase !== 'spike-ready' || !sceneRef.current) return

    setPhase('spike-flight')
    setMessage('Spike in motion — block window opening')

    const attackSpeed = 570 - combo * 8
    sceneRef.current.animateShot({
      from: COURT.userSpike,
      to: COURT.aiBlock,
      durationMs: attackSpeed,
      height: 3.35,
      color: '#c87cff',
      onComplete: () => {
        addShot('spike', COURT.aiBlock.x, COURT.aiBlock.z)
        setTimelineBeat(3)
        setPhase('block-ready')
        setReactionEndsAt(performance.now() + Math.max(640, 980 - combo * 26))
        setMessage('BLOCK now — save the rally')

        queue(() => {
          setAwayScore((score) => score + 1)
          setCombo(0)
          setMomentum((value) => Math.max(22, value - 7))
          setTimelineBeat(3)
          setPhase('point-away')
          setMessage('Point away — reset and serve again')
          sceneRef.current?.flashPoint()
          queue(() => restartRound('Tap SERVE to answer the point'), 1000)
        }, Math.max(650, 980 - combo * 26))
      },
    })
  }

  const block = () => {
    if (phase !== 'block-ready' || !sceneRef.current) return
    if (performance.now() > reactionEndsAt) return

    clearTimers()
    setPhase('point-home')
    setHomeScore((score) => score + 1)
    setCombo((value) => value + 1)
    setMomentum((value) => Math.min(92, value + 4))
    setTimelineBeat(3)
    setMessage('Point home — insane read 😄')
    addShot('block', clamp(aim, -2.6, 2.6), -1.4)
    sceneRef.current.flashPoint()

    queue(() => {
      restartRound('Tap SERVE for the next rally')
    }, 1100)
  }

  useEffect(() => {
    const id = window.setInterval(() => setClock(performance.now()), 80)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = createVolleyScene(canvas)
    sceneRef.current = scene
    scene.setAim(aim)

    const handleResize = () => scene.resize(canvas.clientWidth, canvas.clientHeight)
    handleResize()
    window.addEventListener('resize', handleResize)

    const observer = new ResizeObserver(handleResize)
    observer.observe(canvas)

    return () => {
      clearTimers()
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setAim(aim)
  }, [aim])

  const insightTempo = useMemo(() => (3.2 - combo * 0.09).toFixed(1), [combo])
  const attackSpeed = useMemo(() => (92 + combo * 3.6 + Math.abs(aim) * 1.5).toFixed(1), [aim, combo])
  const jumpHeight = useMemo(() => (3.1 + combo * 0.04).toFixed(2), [combo])
  const blockReach = useMemo(() => (2.95 + combo * 0.03).toFixed(2), [combo])
  const reactionLeft = phase === 'block-ready' ? Math.max(0, reactionEndsAt - clock) : 0
  const momentumAway = 100 - momentum

  const shotPath = useMemo(() => {
    const set = [...recentShots]
    return set.slice(0, 7)
  }, [recentShots])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">VOLLEY3D MOBILE</p>
          <h1>2 vs 2 ALL-AROUND PLAY</h1>
        </div>
        <div className="topbar-stats">
          <span className="pill active">Side Out</span>
          <span className="pill">Point {homeScore + awayScore + 1}</span>
        </div>
      </header>

      <main className="layout">
        <section className="court-stage card">
          <canvas ref={canvasRef} className="court-canvas" aria-label="3D volleyball court" />

          <div className="phase-card">
            <div className="phase-row">
              {BEATS.map((beat, index) => (
                <div key={beat.label} className={`beat ${timelineBeat >= index ? 'on' : ''}`} style={{ '--beat-color': beat.color } as CSSProperties}>
                  <span>{beat.n}</span>
                  <strong>{beat.label}</strong>
                  <small>{beat.time}</small>
                </div>
              ))}
            </div>
            <div className="phase-copy">
              <div>
                <strong>{message}</strong>
                <p>{phase === 'block-ready' ? `Reaction ${Math.ceil(reactionLeft)}ms` : `Combo x${combo}`}</p>
              </div>
              <button className={`primary-action ${phase === 'block-ready' ? 'danger' : ''}`} onClick={phase === 'block-ready' ? block : phase === 'spike-ready' ? startSpike : startServe}>
                {phase === 'block-ready' ? 'BLOCK' : phase === 'spike-ready' ? 'SPIKE' : 'SERVE'}
              </button>
            </div>
            <div className="aim-wrap">
              <label htmlFor="aim">AIM</label>
              <input
                id="aim"
                type="range"
                min={-2.6}
                max={2.6}
                step={0.05}
                value={aim}
                onChange={(event) => setAim(Number(event.target.value))}
              />
              <div className="aim-labels">
                <span>Cross</span>
                <span>Sharp line</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="sidebar">
          <section className="card insights">
            <div className="card-head">
              <h2>PLAY INSIGHTS</h2>
              <span className="mini-dot" />
            </div>
            <ul className="stat-list">
              <li><span>Tempo</span><strong>{insightTempo} sec</strong></li>
              <li><span>Attack Speed</span><strong>{attackSpeed} km/h</strong></li>
              <li><span>Jump Height</span><strong>{jumpHeight} m</strong></li>
              <li><span>Block Reach</span><strong>{blockReach} m</strong></li>
            </ul>
          </section>

          <section className="card map-card">
            <div className="card-head">
              <h2>SHOT MAP</h2>
              <span className="mini-dot alt" />
            </div>
            <svg viewBox="0 0 240 160" className="shot-map" role="img" aria-label="Shot map of recent plays">
              <rect x="8" y="8" width="224" height="144" rx="14" fill="#091322" stroke="#21314a" />
              <path d="M120 8v144M8 80h224M64 8v144M176 8v144" stroke="#23354f" />
              <path d="M16 44h208M16 116h208" stroke="#1a2840" opacity="0.8" />
              {shotPath.map((shot, index) => (
                <circle
                  key={`${shot.kind}-${index}`}
                  cx={120 + shot.x * 18}
                  cy={80 + shot.z * 10}
                  r={shot.kind === 'spike' ? 5 : 4}
                  fill={shot.kind === 'serve' ? '#67d8ff' : shot.kind === 'set' ? '#78f6ae' : shot.kind === 'spike' ? '#c87cff' : '#ff89da'}
                  opacity={0.92}
                />
              ))}
            </svg>
            <div className="legend">
              <span><i className="swatch serve" />Serve</span>
              <span><i className="swatch set" />Set</span>
              <span><i className="swatch spike" />Spike</span>
              <span><i className="swatch block" />Block</span>
            </div>
          </section>

          <section className="card momentum-card">
            <div className="card-head">
              <h2>TEAM MOMENTUM</h2>
            </div>
            <svg viewBox="0 0 240 120" className="momentum-chart" role="img" aria-label="Momentum chart">
              <polyline
                fill="none"
                stroke="#67d8ff"
                strokeWidth="3"
                points={Array.from({ length: 14 }, (_, index) => {
                  const x = 16 + index * 15
                  const y = 88 - Math.sin((index + combo) * 0.55) * 10 - index * 1.2 + (momentum - 50) * 0.15
                  return `${x},${y}`
                }).join(' ')}
              />
              <polyline
                fill="none"
                stroke="#c87cff"
                strokeWidth="3"
                points={Array.from({ length: 14 }, (_, index) => {
                  const x = 16 + index * 15
                  const y = 92 + Math.cos((index + combo) * 0.48) * 8 + index * 0.9 + (momentumAway - 50) * 0.12
                  return `${x},${y}`
                }).join(' ')}
              />
            </svg>
            <div className="momentum-footer">
              <div><strong>{momentum}%</strong><span>HOME</span></div>
              <div><strong>{momentumAway}%</strong><span>AWAY</span></div>
            </div>
          </section>
        </aside>
      </main>

      <footer className="bottom-bar card">
        <div className="transport">
          <div className="play-btn">▶</div>
          <div>
            <strong>{phase === 'block-ready' ? '0:05 / 0:10' : '0:00 / 0:10'}</strong>
            <p>Tap the big button or drag AIM for the next swing.</p>
          </div>
        </div>
        <div className="scoreboard">
          <div>
            <span>HOME</span>
            <strong>{homeScore}</strong>
          </div>
          <div>
            <span>AWAY</span>
            <strong>{awayScore}</strong>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
