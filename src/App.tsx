import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  FileUp,
  FolderOpen,
  GitBranch,
  Leaf,
  LoaderCircle,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react'
import type { Dataset, Expansion, Project } from './lib/types'
import { newProject } from './lib/types'
import { exportGedcom, readGedcomFile, updatePerson } from './lib/gedcom'
import { personName } from './lib/format'
import {
  backupProject,
  download,
  hasPendingSaves,
  loadProject,
  saveProject,
  validateProject,
} from './lib/storage'
import { themes, projectTheme } from './lib/themes'
import { demoDataset } from './lib/demo'
import { layoutTree } from './lib/tree'
import { expandAllTree } from './lib/expandTree'
import { rasterSize, treePrintMetrics } from './lib/exportSizing'
import { Modal, Field, FormatControls, Section, Toggle } from './components/Controls'
import { Ornament, TreePrint } from './components/Artwork'
import { TreeCanvas } from './components/TreeCanvas'
import { PersonEditor } from './components/PersonEditor'
import { BookSidebar, BookWorkspace } from './components/BookWorkspace'

export default function App() {
  const [project, setProject] = useState<Project | null>(null),
    [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState('Saved on this device'),
    [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [mode, setMode] = useState<'tree' | 'book'>('tree'),
    [selected, setSelected] = useState<string>(),
    [sidebarTab, setSidebarTab] = useState<'design' | 'people'>('design'),
    [sidebar, setSidebar] = useState(true),
    [query, setQuery] = useState('')
  const [pending, setPending] = useState<Dataset | null>(null),
    [pickPrimary, setPickPrimary] = useState(false),
    [primaryQuery, setPrimaryQuery] = useState(''),
    [chosen, setChosen] = useState(''),
    [exportOpen, setExportOpen] = useState(false),
    [help, setHelp] = useState(false)
  const [expandAllOpen, setExpandAllOpen] = useState(false)
  const [expandOtherSpouses, setExpandOtherSpouses] = useState(false)
  const [expandCollateralChildren, setExpandCollateralChildren] = useState(false)
  const [centerRequest, setCenterRequest] = useState(0)
  const [format, setFormat] = useState<'png' | 'jpeg' | 'svg' | 'pdf'>('png'),
    [scale, setScale] = useState(2),
    [exportTitle, setExportTitle] = useState(''),
    [exportSubtitle, setExportSubtitle] = useState(''),
    [busy, setBusy] = useState(''),
    [importing, setImporting] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null),
    backupRef = useRef<HTMLInputElement>(null),
    revision = useRef(0)
  const notify = useCallback((text: string, error = false) => setMessage({ text, error }), [])
  useEffect(() => {
    let cancelled = false
    // A blocked or unavailable IndexedDB request must not leave the whole app
    // on the loading screen indefinitely. The user can still open a GEDCOM or
    // restore a project backup once the workspace is available.
    const restore = Promise.race([
      loadProject(),
      new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), 4000)),
    ])
    restore
      .then((saved) => {
        if (saved && !cancelled) {
          setProject(validateProject(saved))
          setSelected(saved.primary)
        }
      })
      .catch((err) => {
        if (!cancelled)
          notify('Could not restore the previous workspace: ' + (err as Error).message, true)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [notify])
  useEffect(() => {
    if (!ready || !project) return
    const current = ++revision.current
    setSaveStatus('Saving…')
    void saveProject(project)
      .then(() => {
        if (revision.current === current) setSaveStatus('Saved on this device')
      })
      .catch(() => {
        setSaveStatus('Save failed — download a backup')
        notify('Local saving failed. Download a project backup to keep your work.', true)
      })
  }, [project, ready, notify])
  useEffect(() => {
    if (!message || message.error) return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (hasPendingSaves()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])
  const updateViewport = useCallback(
    (viewport: Project['viewport']) => setProject((p) => (p ? { ...p, viewport } : p)),
    [],
  )
  const toggle = useCallback(
    (id: string, group: keyof Expansion) =>
      setProject((p) =>
        p
          ? {
              ...p,
              expanded: {
                ...p.expanded,
                [id]: { ...p.expanded[id], [group]: !p.expanded[id]?.[group] },
              },
            }
          : p,
      ),
    [],
  )
  const toggleBook = (id: string) => {
    if (!project) return
    const ids = project.book.ids
    if (!ids.includes(id) && ids.length >= 100) {
      notify('A book can include up to 100 people.', true)
      return
    }
    setProject({
      ...project,
      book: { ...project.book, ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] },
    })
  }
  const beginDataset = (data: Dataset) => {
    setPending(data)
    setChosen('')
    setPrimaryQuery('')
    setPickPrimary(true)
  }
  const importFile = async (file: File) => {
    setImporting(true)
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error('Please choose a GEDCOM file smaller than 100 MB.')
      beginDataset(await readGedcomFile(file))
    } catch (err) {
      notify((err as Error).message, true)
    } finally {
      setImporting(false)
    }
  }
  const selectPrimary = (id?: string) => {
    setPending(null)
    setChosen(id || project?.primary || '')
    setPrimaryQuery('')
    setPickPrimary(true)
  }
  const confirmPrimary = () => {
    if (!chosen) return
    if (pending) {
      const next = newProject(pending, chosen)
      setProject(next)
      setSelected(chosen)
      setMode('tree')
      setPending(null)
    } else if (project) {
      setProject({ ...project, primary: chosen, expanded: {}, viewport: { x: 0, y: 0, zoom: 1 } })
      setSelected(chosen)
    }
    setPickPrimary(false)
  }
  const showExport = () => {
    if (!project) return
    setExportTitle(project.title)
    setExportSubtitle(project.subtitle)
    setExportOpen(true)
  }
  const runExport = async () => {
    if (!project) return
    setBusy('Preparing your tree…')
    try {
      const result = await (
        await import('./lib/exports')
      ).exportTree(project, format, scale, exportTitle, exportSubtitle)
      setExportOpen(false)
      notify(
        result
          ? `Your tree export is ready: ${result.width.toLocaleString()} × ${result.height.toLocaleString()} pixels${result.reduced ? ' (sized to fit)' : ''}.`
          : 'Your tree export is ready.',
      )
    } catch (err) {
      notify((err as Error).message, true)
    } finally {
      setBusy('')
    }
  }
  const runBook = async () => {
    if (!project) return
    setBusy('Preparing your book…')
    try {
      await (
        await import('./lib/exports')
      ).exportBook(project, (n, total) => setBusy(`Rendering page ${n} of ${total}…`))
      notify('Your ancestry book PDF is ready.')
    } catch (err) {
      notify((err as Error).message, true)
    } finally {
      setBusy('')
    }
  }
  const dataForPicker = pending || project?.dataset,
    pickerPeople = dataForPicker
      ? Object.values(dataForPicker.people)
          .filter((p) =>
            (personName(p) + ' ' + p.birthDate + ' ' + p.id)
              .toLowerCase()
              .includes(primaryQuery.toLowerCase()),
          )
          .sort((a, b) => personName(a).localeCompare(personName(b)))
      : []
  const theme = project ? projectTheme(project) : themes[0]
  const exportLayout = useMemo(
    () => (exportOpen && project ? layoutTree(project) : null),
    [exportOpen, project?.dataset, project?.expanded, project?.display, project?.primary],
  )
  const exportMetrics = exportLayout
    ? treePrintMetrics(exportLayout, exportTitle, exportSubtitle, project?.decorationSize)
    : null
  const exportPixels = exportMetrics
    ? rasterSize(exportMetrics.width, exportMetrics.height, scale)
    : null
  if (!ready)
    return (
      <div className="loading">
        <Leaf size={32} />
        <span>Opening your family studio…</span>
      </div>
    )
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">
            <GitBranch size={21} strokeWidth={1.7} />
          </span>
          <span>
            gedcomber<span className="brand-dot">.</span>
          </span>
        </div>
        {project ? (
          <>
            <div className="project-label">
              <span className="project-name">
                {project.dataset.filename.replace(/\.ged$/i, '')}
              </span>
              <span className="save-state">
                <span className={saveStatus.startsWith('Save failed') ? 'bad-dot' : 'good-dot'} />
                {saveStatus}
              </span>
            </div>
            <nav className="view-tabs" aria-label="Workspace">
              <button className={mode === 'tree' ? 'active' : ''} onClick={() => setMode('tree')}>
                <GitBranch size={15} />
                Family tree
              </button>
              <button className={mode === 'book' ? 'active' : ''} onClick={() => setMode('book')}>
                <BookOpen size={15} />
                Ancestry book
              </button>
            </nav>
            <div className="top-actions">
              {mode === 'tree' && (
                <button
                  className="btn"
                  disabled={!!busy || importing}
                  onClick={() => setExpandAllOpen(true)}
                >
                  <GitBranch size={15} /> Expand / Collapse all
                </button>
              )}
              <button
                className="icon-btn"
                title="Start a new tree from a GEDCOM"
                aria-label="Start a new tree from a GEDCOM"
                disabled={importing}
                onClick={() => uploadRef.current?.click()}
              >
                <FolderOpen size={18} />
              </button>
              <button
                className="icon-btn"
                title="Download project backup"
                aria-label="Download project backup"
                onClick={() => {
                  backupProject(project)
                  notify('Project backup downloaded, including photographs and stories.')
                }}
              >
                <ArrowDownToLine size={18} />
              </button>
              <span className="top-divider" />
              <button
                className="btn btn-primary"
                onClick={mode === 'tree' ? showExport : runBook}
                disabled={!!busy || (mode === 'book' && !project.book.ids.length)}
              >
                {busy ? <LoaderCircle className="spin" size={15} /> : <ArrowDownToLine size={15} />}
                <span>{mode === 'tree' ? 'Export tree' : 'Export book'}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="brand-caption">A home for your family’s story</span>
            <div className="top-actions">
              <button className="btn" onClick={() => backupRef.current?.click()}>
                <FolderOpen size={15} />
                Open project
              </button>
              <button className="icon-btn" onClick={() => setHelp(true)} aria-label="Help">
                <CircleHelp size={19} />
              </button>
            </div>
          </>
        )}
      </header>
      <input
        className="hidden"
        type="file"
        ref={uploadRef}
        accept=".ged,.gedcom"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importFile(file)
        }}
      />
      <input
        className="hidden"
        type="file"
        ref={backupRef}
        accept=".gedcomber,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            const restored = validateProject(JSON.parse(await file.text()))
            if (
              project &&
              !window.confirm(
                'Replace the current workspace with this backup? Download a backup of your current project first if you need to keep it.',
              )
            )
              return
            setProject(restored)
            setSelected(restored.primary)
            setMode('tree')
            notify('Project restored.')
          } catch (err) {
            notify((err as Error).message, true)
          }
        }}
      />
      {!project ? (
        <main className="welcome">
          <div className="welcome-copy">
            <div className="welcome-kicker">
              <span />
              ROOTED IN YOUR STORY
            </div>
            <h1>
              Every family
              <br />
              has a <em>beautiful story.</em>
            </h1>
            <p>
              Bring your family tree to life. Explore your connections, preserve the little details,
              and turn generations of stories into something to treasure.
            </p>
            <div
              className="upload-zone"
              onDragOver={(e) => {
                e.preventDefault()
                e.currentTarget.classList.add('drag-over')
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('drag-over')
                if (e.dataTransfer.files[0]) void importFile(e.dataTransfer.files[0])
              }}
            >
              <span className="upload-icon">
                <FileUp size={24} strokeWidth={1.5} />
              </span>
              <strong>Start with your family tree</strong>
              <span>Drop a GEDCOM file here, or choose a file</span>
              <button
                className="btn btn-primary"
                disabled={importing}
                onClick={() => uploadRef.current?.click()}
              >
                {importing ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}
                Upload GEDCOM
                <ArrowRight size={15} />
              </button>
              <small>.ged & .gedcom · Everything stays on your device</small>
            </div>
            <button className="demo-link" onClick={() => beginDataset(demoDataset())}>
              Take a look around with an example family
              <ArrowRight size={15} />
            </button>
            <div className="welcome-trust">
              <ShieldCheck size={15} />
              <span>Private by design. No account. No cloud uploads.</span>
            </div>
          </div>
          <div className="welcome-art">
            <div className="paper-shadow" />
            <div className="welcome-paper">
              <svg viewBox="0 0 610 720">
                <rect width="610" height="720" fill="#fbfaf5" />
                <Ornament theme={themes[0]} width={610} height={720} />
                <text
                  x="305"
                  y="110"
                  textAnchor="middle"
                  fontFamily="Inter"
                  fontSize="10"
                  letterSpacing="5"
                  fill="#7f8c76"
                >
                  THE
                </text>
                <text
                  x="305"
                  y="160"
                  textAnchor="middle"
                  fontFamily="Cormorant Garamond"
                  fontSize="44"
                  fill="#354539"
                >
                  Ashford family
                </text>
                <text
                  x="305"
                  y="188"
                  textAnchor="middle"
                  fontFamily="Inter"
                  fontSize="9"
                  letterSpacing="3"
                  fill="#7f8c76"
                >
                  A STORY THROUGH GENERATIONS
                </text>
                <g fill="none" stroke="#a8b39d" strokeWidth="1">
                  <path d="M 155 300 V 340 H 305 V 395 M 455 300 V 340 H 305 M 305 467 V 520 H 155 V 550 M 305 520 H 455 V 550" />
                </g>
                {[
                  {
                    x: 155,
                    y: 260,
                    name: 'Thomas James',
                    surname: 'Ashford',
                    dates: '1914 — 1987',
                  },
                  {
                    x: 455,
                    y: 260,
                    name: 'Rose Elizabeth',
                    surname: 'Whitmore',
                    dates: '1918 — 2002',
                  },
                  {
                    x: 305,
                    y: 410,
                    name: 'Eleanor Margaret',
                    surname: 'Ashford',
                    dates: 'BORN 1942',
                  },
                  { x: 155, y: 565, name: 'Oliver James', surname: 'Hale', dates: 'BORN 1966' },
                  { x: 455, y: 565, name: 'Alice Eleanor', surname: 'Hale', dates: 'BORN 1969' },
                ].map((p, i) => (
                  <g key={p.name}>
                    <text
                      x={p.x}
                      y={p.y}
                      textAnchor="middle"
                      fontFamily="Cormorant Garamond"
                      fontSize={i === 2 ? 26 : 21}
                      fontStyle="italic"
                      fill="#354539"
                    >
                      {p.name}
                    </text>
                    <text
                      x={p.x}
                      y={p.y + 24}
                      textAnchor="middle"
                      fontFamily="Cormorant Garamond"
                      fontSize={i === 2 ? 26 : 21}
                      fill="#354539"
                    >
                      {p.surname}
                    </text>
                    <text
                      x={p.x}
                      y={p.y + 45}
                      textAnchor="middle"
                      fontFamily="Inter"
                      fontSize="7"
                      letterSpacing="1.5"
                      fill="#7f8c76"
                    >
                      {p.dates}
                    </text>
                  </g>
                ))}
                <text
                  x="305"
                  y="675"
                  textAnchor="middle"
                  fontFamily="Cormorant Garamond"
                  fontStyle="italic"
                  fontSize="16"
                  fill="#7f8c76"
                >
                  Every branch has a story.
                </text>
              </svg>
            </div>
            <span className="art-caption">
              <Sparkles size={14} />
              Made to explore. Designed to keep.
            </span>
          </div>
          <div className="welcome-bottom">
            <span>
              01 <strong>Grow your tree</strong>One connection at a time
            </span>
            <span>
              02 <strong>Make it yours</strong>Thoughtful, personal themes
            </span>
            <span>
              03 <strong>Keep their stories</strong>Beautiful books & prints
            </span>
          </div>
        </main>
      ) : (
        <div
          className={`workspace ${!sidebar ? 'sidebar-hidden' : ''} ${mode === 'tree' && selected ? 'has-inspector' : ''}`}
        >
          {sidebar &&
            (mode === 'book' ? (
              <BookSidebar
                project={project}
                onChange={setProject}
                onToggle={toggleBook}
                onError={(text) => notify(text, true)}
              />
            ) : (
              <aside className="sidebar">
                <div className="sidebar-title">
                  <Settings2 size={17} />
                  <h2>Your tree studio</h2>
                  <button
                    className="icon-btn"
                    onClick={() => setSidebar(false)}
                    aria-label="Hide sidebar"
                  >
                    <PanelLeftClose size={16} />
                  </button>
                </div>
                <div className="segmented">
                  <button
                    className={sidebarTab === 'design' ? 'active' : ''}
                    onClick={() => setSidebarTab('design')}
                  >
                    <Palette size={14} />
                    Design
                  </button>
                  <button
                    className={sidebarTab === 'people' ? 'active' : ''}
                    onClick={() => setSidebarTab('people')}
                  >
                    <Users size={14} />
                    People
                  </button>
                </div>
                <div className="sidebar-scroll">
                  {sidebarTab === 'design' ? (
                    <>
                      <Section title="Choose a theme" aside={<span className="subtle">04</span>}>
                        <div className="theme-grid">
                          {themes.map((t) => (
                            <button
                              className={`theme-option ${project.theme === t.id ? 'selected' : ''}`}
                              onClick={() => setProject({ ...project, theme: t.id, colors: {} })}
                              key={t.id}
                              title={t.description}
                            >
                              <div
                                className="theme-swatch"
                                style={{ background: t.paper, color: t.ink }}
                              >
                                <svg viewBox="0 0 110 65">
                                  <Ornament theme={t} width={110} height={65} />
                                  <path
                                    d="M 35 26 V 37 H 75 V 26 M 55 37 V 47"
                                    fill="none"
                                    stroke={t.line}
                                  />
                                  <text
                                    x="55"
                                    y="23"
                                    textAnchor="middle"
                                    fontFamily={t.font}
                                    fontSize="12"
                                    fill={t.ink}
                                  >
                                    Aa
                                  </text>
                                </svg>
                                {project.theme === t.id && (
                                  <span className="theme-check">
                                    <Check size={10} />
                                  </span>
                                )}
                              </div>
                              <span>{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </Section>
                      <Section
                        title="Make it yours"
                        aside={
                          <button
                            className="text-btn"
                            onClick={() => setProject({ ...project, colors: {} })}
                          >
                            Reset
                          </button>
                        }
                      >
                        <div className="colour-row">
                          {(['paper', 'ink', 'accent'] as const).map((key) => (
                            <label key={key}>
                              <input
                                type="color"
                                aria-label={`${key} colour`}
                                value={theme[key]}
                                onChange={(e) =>
                                  setProject({
                                    ...project,
                                    colors: { ...project.colors, [key]: e.target.value },
                                  })
                                }
                              />
                              <span>
                                {key === 'paper' ? 'Background' : key === 'ink' ? 'Text' : 'Accent'}
                              </span>
                            </label>
                          ))}
                        </div>
                      </Section>
                      <Section title="Person cards">
                        <Toggle
                          label="Show person boxes"
                          checked={project.personBoxes !== false}
                          onChange={(personBoxes) => setProject({ ...project, personBoxes })}
                          hint="Turn off for an open, skeletal tree."
                        />
                        <FormatControls
                          display={project.display}
                          onChange={(display) => setProject({ ...project, display })}
                        />
                      </Section>
                      <Section title="Finishing touches">
                        <Field label="Tree title">
                          <input
                            value={project.title}
                            onChange={(e) => setProject({ ...project, title: e.target.value })}
                            placeholder="Our family tree"
                          />
                        </Field>
                        <Field label="Subheading">
                          <input
                            value={project.subtitle}
                            onChange={(e) => setProject({ ...project, subtitle: e.target.value })}
                            placeholder="Every branch has a story"
                          />
                        </Field>
                      </Section>
                      <Section title="Project files">
                        <button
                          className="btn full"
                          disabled={importing}
                          onClick={() => uploadRef.current?.click()}
                        >
                          {importing ? (
                            <LoaderCircle size={14} className="spin" />
                          ) : (
                            <FileUp size={14} />
                          )}
                          Start a new tree from GEDCOM
                        </button>
                        <p className="help">
                          Choose a new file and primary person to start fresh. You can save a backup
                          of this project before replacing it.
                        </p>
                        <button
                          className="btn full"
                          onClick={() => {
                            download(
                              exportGedcom(project.dataset),
                              project.dataset.filename.replace(/\.[^.]+$/, '') + '-edited.ged',
                              'text/plain;charset=utf-8',
                            )
                            notify(
                              `Exported all ${Object.keys(project.dataset.people).length} people in the GEDCOM.`,
                            )
                          }}
                        >
                          <ArrowDownToLine size={14} />
                          Export whole GEDCOM
                        </button>
                        <button className="btn full" onClick={() => backupProject(project)}>
                          <ArrowDownToLine size={14} />
                          Save project backup
                        </button>
                        <button className="btn full" onClick={() => backupRef.current?.click()}>
                          <FolderOpen size={14} />
                          Restore project backup
                        </button>
                        <p className="help">
                          Project backups include photos, stories, book settings, and expanded
                          branches.
                        </p>
                      </Section>
                    </>
                  ) : (
                    <>
                      <Section title={`${Object.keys(project.dataset.people).length} people`}>
                        <div className="search-input">
                          <Search size={14} />
                          <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Find someone…"
                            aria-label="Search all people"
                          />
                        </div>
                        <p className="help">
                          Select anyone to edit their details, even if their branch is closed.
                        </p>
                        <div className="people-list">
                          {Object.values(project.dataset.people)
                            .filter((p) =>
                              (personName(p) + ' ' + p.id)
                                .toLowerCase()
                                .includes(query.toLowerCase()),
                            )
                            .slice(0, 200)
                            .map((p) => (
                              <button
                                key={p.id}
                                className={`person-list-row ${selected === p.id ? 'selected' : ''}`}
                                onClick={() => setSelected(p.id)}
                              >
                                <span className="avatar">
                                  {p.photo ? (
                                    <img src={p.photo} alt="" />
                                  ) : (
                                    p.given.charAt(0) + p.surname.charAt(0)
                                  )}
                                </span>
                                <span>
                                  <strong>{personName(p)}</strong>
                                  <small>{p.birthDate || 'Birth date unknown'}</small>
                                </span>
                                <ChevronRight size={13} />
                              </button>
                            ))}
                        </div>
                        {Object.keys(project.dataset.people).length > 200 && (
                          <p className="help">
                            Showing up to 200 matches. Use search to find anyone in the file.
                          </p>
                        )}
                      </Section>
                    </>
                  )}
                </div>
                <div className="sidebar-foot">
                  <button className="text-btn" onClick={() => setHelp(true)}>
                    <CircleHelp size={14} />A little help growing your tree
                  </button>
                </div>
              </aside>
            ))}
          <div className="main-workspace">
            {!sidebar && (
              <button
                className="sidebar-restore icon-btn"
                onClick={() => setSidebar(true)}
                aria-label="Show sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            {mode === 'tree' ? (
              <TreeCanvas
                project={project}
                selected={selected}
                onSelect={setSelected}
                onToggle={toggle}
                onViewport={updateViewport}
                onPrimary={() => selectPrimary()}
                centerRequest={centerRequest}
              />
            ) : (
              <BookWorkspace project={project} onTree={() => setMode('tree')} />
            )}
          </div>
          {mode === 'tree' && selected && project.dataset.people[selected] && (
            <PersonEditor
              key={selected}
              person={project.dataset.people[selected]}
              onChange={(person) =>
                setProject((p) => (p ? { ...p, dataset: updatePerson(p.dataset, person) } : p))
              }
              onClose={() => setSelected(undefined)}
              onPrimary={() => selectPrimary(selected)}
              onBook={() => toggleBook(selected)}
              inBook={project.book.ids.includes(selected)}
              onError={(text) => notify(text, true)}
            />
          )}
        </div>
      )}
      {expandAllOpen && project && (
        <Modal
          title="Expand or collapse the tree"
          eyebrow="TREE BRANCHES"
          onClose={() => setExpandAllOpen(false)}
        >
          <p className="modal-intro">
            Show the primary person’s ancestors, their siblings, and the primary person’s
            descendants. Collapse all closes every branch and returns to the primary person. Both
            actions centre the view on them.
          </p>
          <div className="notice">
            This can create a very large tree and may take some time. Are you sure you want to
            expand all these branches?
          </div>
          <div className="modal-options">
            <Toggle
              label="Include other spouses"
              hint="Show additional spouses beside their partners, without opening those spouses’ other families."
              checked={expandOtherSpouses}
              onChange={setExpandOtherSpouses}
            />
            <Toggle
              label="Include children of siblings"
              hint="Also expand down through cousins, nieces, nephews, and their descendants."
              checked={expandCollateralChildren}
              onChange={setExpandCollateralChildren}
            />
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setExpandAllOpen(false)}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => {
                setProject({ ...project, expanded: {} })
                setSelected(project.primary)
                setCenterRequest((n) => n + 1)
                setExpandAllOpen(false)
              }}
            >
              Collapse all
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setProject(
                  expandAllTree(project, {
                    otherSpouses: expandOtherSpouses,
                    collateralChildren: expandCollateralChildren,
                  }),
                )
                setSelected(project.primary)
                setCenterRequest((n) => n + 1)
                setExpandAllOpen(false)
              }}
            >
              Yes, expand all
            </button>
          </div>
        </Modal>
      )}
      {pickPrimary && dataForPicker && (
        <Modal
          title="Who is the Primary Person?"
          eyebrow={pending ? 'LET’S START YOUR TREE' : 'A NEW PERSPECTIVE'}
          onClose={() => {
            setPickPrimary(false)
            setPending(null)
          }}
        >
          <p className="modal-intro">
            Choose the person at the heart of your tree. We’ll start with just them — you decide
            which branches to open.
          </p>
          <div className="search-input large">
            <Search size={17} />
            <input
              autoFocus
              value={primaryQuery}
              onChange={(e) => setPrimaryQuery(e.target.value)}
              placeholder="Search by name, birth date, or ID…"
              aria-label="Search for primary person"
            />
          </div>
          <div className="primary-list">
            {pickerPeople.slice(0, 150).map((p) => (
              <button
                key={p.id}
                className={`primary-person ${chosen === p.id ? 'chosen' : ''}`}
                onClick={() => setChosen(p.id)}
              >
                <span className="avatar">
                  {p.given.charAt(0)}
                  {p.surname.charAt(0)}
                </span>
                <span>
                  <strong>{personName(p)}</strong>
                  <small>
                    {p.birthDate ? `Born ${p.birthDate}` : 'Birth date unknown'}
                    {p.birthPlace ? ' · ' + p.birthPlace : ''} · {p.id}
                  </small>
                </span>
                <span className="radio">{chosen === p.id && <span />}</span>
              </button>
            ))}
            {!pickerPeople.length && (
              <div className="empty-small">No matching people. Try another name.</div>
            )}
          </div>
          <p className="help">
            {pickerPeople.length} matching people
            {pickerPeople.length > 150 ? ' · Showing the first 150. Narrow your search.' : ''}
          </p>
          {project && (
            <div className="notice">
              {pending
                ? 'Opening this file replaces the current workspace.'
                : 'Changing the primary person resets the visible tree to one person.'}{' '}
              <button className="text-btn" onClick={() => backupProject(project)}>
                Save a backup first
              </button>
            </div>
          )}
          <div className="modal-footer">
            <span>
              <ShieldCheck size={14} />
              Your file stays on this device
            </span>
            <button className="btn btn-primary" disabled={!chosen} onClick={confirmPrimary}>
              Begin with this person
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {exportOpen && project && (
        <Modal
          title="A family tree to keep"
          eyebrow="EXPORT YOUR CURRENT TREE"
          onClose={() => {
            if (!busy) setExportOpen(false)
          }}
          wide
        >
          <div className="export-body">
            <div className="export-preview">
              <TreePrint
                project={project}
                layout={exportLayout!}
                theme={theme}
                title={exportTitle}
                subtitle={exportSubtitle}
              />
              <span>
                {new Set(exportLayout!.nodes.map((node) => node.personId ?? node.id)).size} visible
                people · {theme.label} theme
                {exportLayout!.nodes.some((node) => node.personId) &&
                  ` · ${exportLayout!.nodes.filter((node) => node.personId).length} linked repeat cards`}
              </span>
            </div>
            <div>
              <Field label="Title (optional)">
                <input value={exportTitle} onChange={(e) => setExportTitle(e.target.value)} />
              </Field>
              <Field label="Subheading (optional)">
                <input value={exportSubtitle} onChange={(e) => setExportSubtitle(e.target.value)} />
              </Field>
              <Field label="File format">
                <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                  <option value="png">PNG · crisp, lossless image</option>
                  <option value="jpeg">JPEG · smaller image file</option>
                  <option value="svg">SVG · scalable vector artwork</option>
                  <option value="pdf">PDF · print-ready document</option>
                </select>
              </Field>
              <Field label="Resolution">
                <select
                  disabled={format === 'svg'}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                >
                  <option value={1}>Standard · 1×</option>
                  <option value={2}>High quality · 2×</option>
                  <option value={4}>Print quality · 4×</option>
                </select>
              </Field>
              <Field label="Decoration size">
                <select
                  value={project.decorationSize ?? 1}
                  onChange={(e) =>
                    setProject({ ...project, decorationSize: Number(e.target.value) })
                  }
                >
                  <option value={0.75}>Subtle · 75%</option>
                  <option value={1}>Balanced · 100%</option>
                  <option value={1.5}>Prominent · 150%</option>
                  <option value={2}>Bold · 200%</option>
                </select>
              </Field>
              {format !== 'svg' && exportPixels && (
                <p className="help">
                  Image size: {exportPixels.width.toLocaleString()} ×{' '}
                  {exportPixels.height.toLocaleString()} pixels.
                  {exportPixels.reduced &&
                    ' Automatically reduced to fit a large image. Text will be smaller; SVG preserves full detail.'}
                </p>
              )}
              <p className="help">
                Exports all currently expanded people, including those outside the viewport. Hidden
                branches and editing controls are omitted. Decorations scale with the artwork. Large
                images are sized to fit; SVG keeps full detail at any zoom.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <span>{busy || 'Made for sharing, framing, and remembering.'}</span>
            <button className="btn btn-primary" disabled={!!busy} onClick={runExport}>
              {busy ? <LoaderCircle size={15} className="spin" /> : <ArrowDownToLine size={15} />}
              Download {format.toUpperCase()}
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="A little help with your tree"
          eyebrow="WELCOME TO GEDCOMBER"
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <h3>Grow one branch at a time</h3>
            <p>
              Start with one primary person. Use the arrow above a card for parents, the side arrow
              for siblings, the heart for partners, and the lower arrow for children. Click an open
              control again to collapse that branch. People connected through another open branch
              can remain visible.
            </p>
            <h3>Keep every detail</h3>
            <p>
              Click a card, or find someone in the People list, to edit facts, add a photo, or
              upload a .txt or .md Life Story. Dates are stored as GEDCOM text; formatting changes
              only how they are displayed.
            </p>
            <h3>Make a keepsake</h3>
            <p>
              Export tree saves the expanded view. Export whole GEDCOM includes every record and
              your edits. Photographs and view settings are included in .gedcomber project backups;
              life stories also export as custom _STORY records. Source records are retained in
              GEDCOM exports but are not displayed or edited here.
            </p>
            <h3>Build a book</h3>
            <p>
              Select up to 100 people in the book workspace, arrange their order, and adjust the
              page layout. Facts and stories come directly from the tree. Long stories flow onto as
              many pages as needed.
            </p>
            <h3>Your data stays here</h3>
            <p>
              Work is saved in this browser on this device. Keep project backups, especially before
              clearing browser data or switching computers. For consistent local storage, keep using
              the same address and port.
            </p>
          </div>
        </Modal>
      )}
      {busy && !exportOpen && (
        <div className="working-banner" role="status">
          <LoaderCircle size={17} className="spin" />
          {busy}
        </div>
      )}
      {importing && (
        <div className="working-banner" role="status">
          <LoaderCircle size={17} className="spin" />
          Reading your GEDCOM…
        </div>
      )}
      {message && (
        <div
          className={`toast ${message.error ? 'error' : ''}`}
          role={message.error ? 'alert' : 'status'}
        >
          {message.error ? <CircleHelp size={17} /> : <Check size={17} />}
          <span>{message.text}</span>
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setMessage(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
