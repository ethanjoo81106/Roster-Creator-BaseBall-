import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Shirt,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { loadData, POSITIONS, saveData } from './data';

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function nextId(items, key) {
  return Math.max(0, ...items.map((item) => item[key])) + 1;
}

function Modal({ title, subtitle, children, onClose }) {
  useEffect(() => {
    const dismiss = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close">
          <X size={19} />
        </button>
        <h2>{title}</h2>
        <p className="modal-subtitle">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [teamId, setTeamId] = useState(1);
  const [lineupId, setLineupId] = useState(1);
  const [view, setView] = useState('lineups');
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => saveData(data), [data]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const teams = data.teams;
  const team = teams.find((item) => item.team_id === teamId);
  const teamPlayers = useMemo(
    () => data.players.filter((item) => item.team_id === teamId),
    [data.players, teamId],
  );
  const teamLineups = data.lineups.filter((item) => item.team_id === teamId);
  const lineup = teamLineups.find((item) => item.lineup_id === lineupId);
  const assignments = data.assignments.filter((item) => item.lineup_id === lineupId);
  const assignedIds = new Set(assignments.map((item) => item.player_id));
  const getPlayer = (id) => data.players.find((player) => player.player_id === id);
  const visiblePlayers = teamPlayers.filter((player) =>
    `${player.name} ${player.jersey_number ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function updateData(updater) {
    setData((current) => updater(current));
  }

  function changeTeam(id) {
    setTeamId(id);
    setLineupId(data.lineups.find((item) => item.team_id === id)?.lineup_id ?? null);
    setSelectedPosition(null);
  }

  function notify(message) {
    setToast(message);
  }

  function createTeam(name) {
    const clean = name.trim();
    if (!clean) return 'Enter a team name.';
    if (teams.some((item) => item.name.toLowerCase() === clean.toLowerCase()))
      return 'That team already exists.';
    const id = nextId(teams, 'team_id');
    updateData((current) => ({
      ...current,
      teams: [...current.teams, { team_id: id, name: clean }],
    }));
    setTeamId(id);
    setLineupId(null);
    setModal(null);
    notify('Team created successfully');
  }

  function savePlayer(values, editing) {
    const name = values.name.trim();
    const raw = values.number.trim();
    if (!name) return 'Player name is required.';
    if (raw && (!/^\d+$/.test(raw) || Number(raw) > 99))
      return 'Jersey number must be between 0 and 99.';
    const number = raw === '' ? null : Number(raw);
    if (
      number !== null &&
      teamPlayers.some(
        (item) => item.jersey_number === number && item.player_id !== editing?.player_id,
      )
    ) {
      return 'That jersey number is already taken on this team.';
    }
    updateData((current) => ({
      ...current,
      players: editing
        ? current.players.map((item) =>
            item.player_id === editing.player_id
              ? { ...item, name, jersey_number: number }
              : item,
          )
        : [
            ...current.players,
            {
              player_id: nextId(current.players, 'player_id'),
              team_id: teamId,
              name,
              jersey_number: number,
            },
          ],
    }));
    setModal(null);
    notify(editing ? 'Player updated' : 'Player added to roster');
  }

  function deletePlayer(player) {
    if (!window.confirm(`Remove ${player.name} from the roster and all saved lineups?`))
      return;
    updateData((current) => ({
      ...current,
      players: current.players.filter((item) => item.player_id !== player.player_id),
      assignments: current.assignments.filter(
        (item) => item.player_id !== player.player_id,
      ),
    }));
    notify('Player removed');
  }

  function saveLineup(name) {
    const clean = name.trim();
    if (!clean) return 'Enter a lineup name.';
    if (teamLineups.some((item) => item.name.toLowerCase() === clean.toLowerCase()))
      return 'That lineup name is already in use.';
    const id = nextId(data.lineups, 'lineup_id');
    updateData((current) => ({
      ...current,
      lineups: [...current.lineups, { lineup_id: id, team_id: teamId, name: clean }],
    }));
    setLineupId(id);
    setSelectedPosition(null);
    setModal(null);
    notify('New lineup created');
  }

  function deleteLineup() {
    if (!lineup || !window.confirm(`Delete lineup “${lineup.name}”?`)) return;
    updateData((current) => ({
      ...current,
      lineups: current.lineups.filter((item) => item.lineup_id !== lineupId),
      assignments: current.assignments.filter((item) => item.lineup_id !== lineupId),
    }));
    setLineupId(
      teamLineups.find((item) => item.lineup_id !== lineupId)?.lineup_id ?? null,
    );
    setSelectedPosition(null);
    notify('Lineup deleted');
  }

  function assignPlayer(position, playerId) {
    if (!lineup) return;
    // Matches the SQL primary key (lineup_id, player_id) and unique (lineup_id, position).
    updateData((current) => ({
      ...current,
      assignments: [
        ...current.assignments.filter(
          (item) =>
            item.lineup_id !== lineupId ||
            (item.position !== position && item.player_id !== playerId),
        ),
        ...(playerId ? [{ lineup_id: lineupId, player_id: playerId, position }] : []),
      ],
    }));
    setSelectedPosition(null);
    notify(playerId ? `${position} position updated` : `${position} position cleared`);
  }

  function exportLineup() {
    const lines = [
      `${team.name} — ${lineup.name}`,
      '',
      ...POSITIONS.map((position) => {
        const player = getPlayer(
          assignments.find((item) => item.position === position.code)?.player_id,
        );
        return `${position.name} (${position.code}): ${player ? `${player.name} #${player.jersey_number ?? '—'}` : 'Unassigned'}`;
      }),
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download =
      `${team.name}-${lineup.name}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '.txt';
    link.click();
    URL.revokeObjectURL(url);
    notify('Lineup exported');
  }

  const navigation = [
    { id: 'lineups', label: 'Lineup Builder', icon: LayoutDashboard },
    { id: 'players', label: 'Player Roster', icon: Users },
    { id: 'teams', label: 'My Teams', icon: Trophy },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <span>◆</span>
          </div>
          <div>
            <strong>
              diamond<span>desk</span>
            </strong>
            <small>LINEUP MANAGER</small>
          </div>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'active' : ''}`}
              onClick={() => {
                setView(id);
                setMobileMenu(false);
              }}
            >
              <Icon size={19} strokeWidth={1.9} />
              {label}
              {view === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <CircleHelp size={20} />
            <div>
              <strong>Building your lineup?</strong>
              <p>Pick a field position, then choose a player from your roster.</p>
            </div>
          </div>
          <div className="sidebar-footer">
            <span className="avatar-mini">BB</span>
            <div>
              <strong>Baseball Workspace</strong>
              <small>Front-end demo</small>
            </div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle menu"
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>{navigation.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-pill">
              <span /> DEMO MODE
            </span>
            <div className="top-avatar">BB</div>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                YOUR BASEBALL WORKSPACE <span className="eyebrow-line" />
              </div>
              <h1>
                {view === 'lineups'
                  ? 'Lineup Builder'
                  : view === 'players'
                    ? 'Player Roster'
                    : 'My Teams'}
              </h1>
              <p>
                {view === 'lineups'
                  ? 'Build your defense. Own the diamond.'
                  : view === 'players'
                    ? 'Keep your squad organized and game-ready.'
                    : 'Every great lineup starts with a team.'}
              </p>
            </div>
            <button
              className="button button-primary heading-action"
              onClick={() =>
                setModal({
                  type:
                    view === 'teams' ? 'team' : view === 'players' ? 'player' : 'lineup',
                })
              }
            >
              <Plus size={18} />
              {view === 'teams'
                ? 'New Team'
                : view === 'players'
                  ? 'Add Player'
                  : 'New Lineup'}
            </button>
          </div>

          {view === 'lineups' && (
            <>
              <div className="workspace-toolbar">
                <div className="selector-group">
                  <div className="selector-label">TEAM</div>
                  <div className="select-wrap">
                    <Shirt size={17} />
                    <select
                      aria-label="Choose team"
                      value={teamId}
                      onChange={(event) => changeTeam(Number(event.target.value))}
                    >
                      {teams.map((item) => (
                        <option key={item.team_id} value={item.team_id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                </div>
                <div className="toolbar-divider" />
                <div className="selector-group lineup-selector">
                  <div className="selector-label">ACTIVE LINEUP</div>
                  <div className="select-wrap">
                    <ClipboardList size={17} />
                    <select
                      aria-label="Choose lineup"
                      value={lineupId ?? ''}
                      onChange={(event) => {
                        setLineupId(Number(event.target.value));
                        setSelectedPosition(null);
                      }}
                    >
                      <option value="" disabled>
                        {teamLineups.length ? 'Choose lineup' : 'No lineups yet'}
                      </option>
                      {teamLineups.map((item) => (
                        <option key={item.lineup_id} value={item.lineup_id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                </div>
                <div className="toolbar-actions">
                  <button
                    className="button button-ghost"
                    onClick={() => setModal({ type: 'lineup' })}
                  >
                    <Plus size={17} /> New lineup
                  </button>
                  <button
                    className="button button-outline"
                    disabled={!lineup}
                    onClick={exportLineup}
                  >
                    <ArrowDownToLine size={17} /> Export
                  </button>
                </div>
              </div>

              <div className="summary-row">
                <div className="stat-card">
                  <div className="stat-icon green">
                    <Users size={20} />
                  </div>
                  <div>
                    <span>TEAM PLAYERS</span>
                    <strong>{teamPlayers.length.toString().padStart(2, '0')}</strong>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon orange">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <span>POSITIONS FILLED</span>
                    <strong>
                      {assignments.length}
                      <em> / 9</em>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon blue">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <span>SAVED LINEUPS</span>
                    <strong>{teamLineups.length.toString().padStart(2, '0')}</strong>
                  </div>
                </div>
              </div>

              <div className="builder-grid">
                <section className="panel diamond-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Defensive Field</h2>
                      <p>Click a position on the field to assign a player.</p>
                    </div>
                    <span className="live-tag">
                      <span /> LIVE PREVIEW
                    </span>
                  </div>
                  {lineup ? (
                    <>
                      <div className="field-wrapper">
                        <div className="field">
                          <div className="outfield-arc" />
                          <div className="infield-dirt">
                            <div className="infield-grass" />
                          </div>
                          <div className="baseline baseline-left" />
                          <div className="baseline baseline-right" />
                          <div className="base base-home" />
                          <div className="base base-first" />
                          <div className="base base-second" />
                          <div className="base base-third" />
                          <div className="mound" />
                          {POSITIONS.map((position) => {
                            const player = getPlayer(
                              assignments.find((item) => item.position === position.code)
                                ?.player_id,
                            );
                            return (
                              <button
                                key={position.code}
                                className={`field-position ${player ? 'filled' : ''} ${selectedPosition === position.code ? 'selected' : ''}`}
                                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                                onClick={() => setSelectedPosition(position.code)}
                                aria-label={`Assign ${position.name}`}
                              >
                                <span className="position-circle">{position.code}</span>
                                <span className="position-name">
                                  {player ? player.name.split(' ').at(-1) : 'Add player'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="field-legend">
                        <span>
                          <i className="legend-dot filled-dot" /> Assigned
                        </span>
                        <span>
                          <i className="legend-dot empty-dot" /> Open position
                        </span>
                        <span className="field-legend-right">
                          {assignments.length} of 9 positions filled
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="empty-large">
                      <ClipboardList size={34} />
                      <h3>No lineup selected</h3>
                      <p>Create a lineup to start placing players on the field.</p>
                      <button
                        className="button button-primary"
                        onClick={() => setModal({ type: 'lineup' })}
                      >
                        <Plus size={17} /> Create lineup
                      </button>
                    </div>
                  )}
                </section>

                <section className="panel assignment-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Position Assignments</h2>
                      <p>Your starting nine, one position at a time.</p>
                    </div>
                    <span className="count-badge">9 SPOTS</span>
                  </div>
                  <div className="position-list">
                    {POSITIONS.map((position) => {
                      const player = getPlayer(
                        assignments.find((item) => item.position === position.code)
                          ?.player_id,
                      );
                      return (
                        <button
                          key={position.code}
                          className={`assignment-row ${selectedPosition === position.code ? 'row-selected' : ''}`}
                          disabled={!lineup}
                          onClick={() => setSelectedPosition(position.code)}
                        >
                          <div
                            className={`position-number ${player ? 'has-player' : ''}`}
                          >
                            {position.code}
                          </div>
                          <div className="assignment-info">
                            <strong>{position.name}</strong>
                            <span>
                              {player
                                ? `#${player.jersey_number ?? '—'} · ${player.name}`
                                : 'No player assigned'}
                            </span>
                          </div>
                          {player ? (
                            <span className="assigned-check">
                              <Check size={16} />
                            </span>
                          ) : (
                            <Plus size={18} className="add-muted" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="assignment-footer">
                    <button
                      className="text-action"
                      disabled={!lineup}
                      onClick={() => {
                        if (
                          window.confirm('Clear all player assignments in this lineup?')
                        ) {
                          updateData((current) => ({
                            ...current,
                            assignments: current.assignments.filter(
                              (item) => item.lineup_id !== lineupId,
                            ),
                          }));
                          notify('Lineup cleared');
                        }
                      }}
                    >
                      Clear all positions <ArrowRight size={15} />
                    </button>
                    <button
                      className="icon-button delete-lineup"
                      disabled={!lineup}
                      onClick={deleteLineup}
                      title="Delete current lineup"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="tip-strip">
                <div className="tip-icon">✦</div>
                <div>
                  <strong>Quick tip</strong>
                  <span>
                    {' '}
                    Each player can fill only one position per lineup. You can switch
                    between saved lineups to try different defensive setups.
                  </span>
                </div>
              </div>
            </>
          )}

          {view === 'players' && (
            <>
              <div className="list-toolbar">
                <div className="selector-group">
                  <span className="selector-label">TEAM ROSTER</span>
                  <div className="select-wrap">
                    <Shirt size={17} />
                    <select
                      value={teamId}
                      onChange={(event) => changeTeam(Number(event.target.value))}
                    >
                      {teams.map((item) => (
                        <option key={item.team_id} value={item.team_id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                </div>
                <div className="search-wrap">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search players or jersey #"
                  />
                </div>
              </div>
              <section className="panel roster-panel">
                <div className="table-heading">
                  <h2>
                    {team?.name} Roster <span>{teamPlayers.length} players</span>
                  </h2>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>PLAYER</th>
                        <th>JERSEY</th>
                        <th>LINEUP STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePlayers.map((player) => (
                        <tr key={player.player_id}>
                          <td>
                            <div className="player-cell">
                              <span className="player-avatar">
                                {initials(player.name)}
                              </span>
                              <strong>{player.name}</strong>
                            </div>
                          </td>
                          <td>
                            <span className="jersey-tag">
                              #{player.jersey_number ?? '—'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${data.assignments.some((item) => item.player_id === player.player_id) ? 'status-active' : ''}`}
                            >
                              {data.assignments.some(
                                (item) => item.player_id === player.player_id,
                              )
                                ? 'In a lineup'
                                : 'Available'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="icon-button"
                                onClick={() =>
                                  setModal({ type: 'player', editing: player })
                                }
                                title="Edit player"
                              >
                                <Pencil size={17} />
                              </button>
                              <button
                                className="icon-button danger-hover"
                                onClick={() => deletePlayer(player)}
                                title="Delete player"
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visiblePlayers.length === 0 && (
                    <div className="no-results">
                      No players found. Try a different search or add a player.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {view === 'teams' && (
            <div className="teams-grid">
              {teams.map((item) => {
                const playerCount = data.players.filter(
                  (player) => player.team_id === item.team_id,
                ).length;
                const lineupCount = data.lineups.filter(
                  (entry) => entry.team_id === item.team_id,
                ).length;
                return (
                  <button
                    key={item.team_id}
                    className="team-card"
                    onClick={() => {
                      changeTeam(item.team_id);
                      setView('lineups');
                    }}
                  >
                    <div className="team-card-top">
                      <span className="team-emblem">
                        <Trophy size={26} />
                      </span>
                      <ArrowRight size={21} />
                    </div>
                    <h2>{item.name}</h2>
                    <p>Baseball team</p>
                    <div className="team-card-footer">
                      <span>
                        <Users size={16} /> {playerCount} players
                      </span>
                      <span>
                        <ClipboardList size={16} /> {lineupCount} lineups
                      </span>
                    </div>
                  </button>
                );
              })}
              <button
                className="team-card add-team-card"
                onClick={() => setModal({ type: 'team' })}
              >
                <span className="team-add-circle">
                  <Plus size={25} />
                </span>
                <h2>Add a new team</h2>
                <p>Start building a fresh roster</p>
              </button>
            </div>
          )}
        </div>
      </main>

      {selectedPosition && lineup && (
        <Modal
          title={`Assign ${POSITIONS.find((item) => item.code === selectedPosition)?.name}`}
          subtitle="Choose a player from this team's roster."
          onClose={() => setSelectedPosition(null)}
        >
          <div className="player-picker">
            <button
              className="picker-player picker-clear"
              onClick={() => assignPlayer(selectedPosition, null)}
            >
              <span className="picker-initials">
                <X size={18} />
              </span>
              <span>Leave this position empty</span>
              <ArrowRight size={17} />
            </button>
            {teamPlayers.map((player) => {
              const used = assignments.some(
                (item) =>
                  item.player_id === player.player_id &&
                  item.position !== selectedPosition,
              );
              const current = assignments.some(
                (item) =>
                  item.player_id === player.player_id &&
                  item.position === selectedPosition,
              );
              return (
                <button
                  key={player.player_id}
                  disabled={used}
                  className="picker-player"
                  onClick={() => assignPlayer(selectedPosition, player.player_id)}
                >
                  <span className="picker-initials">{initials(player.name)}</span>
                  <span>
                    <strong>{player.name}</strong>
                    <small>
                      Jersey #{player.jersey_number ?? '—'}{' '}
                      {used
                        ? '· Already assigned'
                        : current
                          ? '· Currently selected'
                          : ''}
                    </small>
                  </span>
                  {current ? <Check size={18} /> : <ArrowRight size={17} />}
                </button>
              );
            })}
            {!teamPlayers.length && (
              <p className="picker-empty">Add players to this team first.</p>
            )}
          </div>
        </Modal>
      )}
      {modal?.type === 'player' && (
        <FormModal
          key={modal.editing?.player_id ?? 'new'}
          title={modal.editing ? 'Edit Player' : 'Add New Player'}
          subtitle={`Manage players on the ${team?.name} roster.`}
          fields={[
            {
              key: 'name',
              label: 'PLAYER NAME',
              placeholder: 'e.g. Alex Carter',
              initial: modal.editing?.name ?? '',
            },
            {
              key: 'number',
              label: 'JERSEY NUMBER (OPTIONAL)',
              placeholder: '0–99',
              initial: modal.editing?.jersey_number?.toString() ?? '',
            },
          ]}
          action={modal.editing ? 'Save Changes' : 'Add Player'}
          onClose={() => setModal(null)}
          onSubmit={(values) => savePlayer(values, modal.editing)}
        />
      )}
      {modal?.type === 'lineup' && (
        <FormModal
          title="Create New Lineup"
          subtitle={`Set up another defensive lineup for ${team?.name}.`}
          fields={[
            {
              key: 'name',
              label: 'LINEUP NAME',
              placeholder: 'e.g. Game Day Starters',
              initial: '',
            },
          ]}
          action="Create Lineup"
          onClose={() => setModal(null)}
          onSubmit={(values) => saveLineup(values.name)}
        />
      )}
      {modal?.type === 'team' && (
        <FormModal
          title="Create New Team"
          subtitle="Give your team a name to start its roster."
          fields={[
            {
              key: 'name',
              label: 'TEAM NAME',
              placeholder: 'e.g. Milwaukee Brewers',
              initial: '',
            },
          ]}
          action="Create Team"
          onClose={() => setModal(null)}
          onSubmit={(values) => createTeam(values.name)}
        />
      )}
      {toast && (
        <div role="status" className="toast">
          <span>
            <Check size={16} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function FormModal({ title, subtitle, fields, action, onClose, onSubmit }) {
  const [values, setValues] = useState(
    Object.fromEntries(fields.map((field) => [field.key, field.initial])),
  );
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    setError(onSubmit(values) || '');
  }
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={submit} className="entity-form">
        {fields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              autoFocus={field.key === fields[0].key}
              value={values[field.key]}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field.key]: event.target.value }));
                setError('');
              }}
              placeholder={field.placeholder}
            />
          </label>
        ))}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {action} <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
