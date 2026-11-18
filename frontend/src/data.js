export const POSITIONS = [
  { code: 'P', name: 'Pitcher', x: 50, y: 62 },
  { code: 'C', name: 'Catcher', x: 50, y: 88 },
  { code: '1B', name: 'First Base', x: 71, y: 52 },
  { code: '2B', name: 'Second Base', x: 59, y: 35 },
  { code: '3B', name: 'Third Base', x: 29, y: 52 },
  { code: 'SS', name: 'Shortstop', x: 40, y: 35 },
  { code: 'LF', name: 'Left Field', x: 25, y: 19 },
  { code: 'CF', name: 'Center Field', x: 50, y: 11 },
  { code: 'RF', name: 'Right Field', x: 75, y: 19 },
];

// Mirrors database/testdata.sql, with a few additional demo players for a full field.
export const SEED = {
  teams: [
    { team_id: 1, name: 'Brewers' },
    { team_id: 2, name: 'Cubs' },
  ],
  players: [
    { player_id: 1, team_id: 1, name: 'Alex Carter', jersey_number: 12 },
    { player_id: 2, team_id: 1, name: 'Jordan Lee', jersey_number: 7 },
    { player_id: 3, team_id: 1, name: 'Taylor Smith', jersey_number: 24 },
    { player_id: 4, team_id: 2, name: 'Morgan Reed', jersey_number: 9 },
    { player_id: 5, team_id: 1, name: 'Sam Rivera', jersey_number: 18 },
    { player_id: 6, team_id: 1, name: 'Chris Morgan', jersey_number: 31 },
    { player_id: 7, team_id: 1, name: 'Drew Martinez', jersey_number: 4 },
    { player_id: 8, team_id: 1, name: 'Jamie Brooks', jersey_number: 16 },
    { player_id: 9, team_id: 1, name: 'Casey Wilson', jersey_number: 22 },
    { player_id: 10, team_id: 1, name: 'Avery Johnson', jersey_number: 34 },
    { player_id: 11, team_id: 1, name: 'Riley Davis', jersey_number: 6 },
  ],
  lineups: [
    { lineup_id: 1, team_id: 1, name: 'Starting Defense' },
    { lineup_id: 2, team_id: 1, name: 'Alternate Defense' },
    { lineup_id: 3, team_id: 2, name: 'Starting Defense' },
  ],
  assignments: [
    { lineup_id: 1, player_id: 1, position: 'P' },
    { lineup_id: 1, player_id: 2, position: 'C' },
    { lineup_id: 1, player_id: 3, position: '1B' },
    { lineup_id: 2, player_id: 1, position: 'CF' },
    { lineup_id: 2, player_id: 2, position: 'P' },
    { lineup_id: 3, player_id: 4, position: 'SS' },
  ],
};

const STORAGE_KEY = 'diamond-desk-v1';

export function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      saved &&
      ['teams', 'players', 'lineups', 'assignments'].every((key) =>
        Array.isArray(saved[key]),
      )
    ) {
      return saved;
    }
  } catch {
    /* Ignore malformed browser storage. */
  }
  return structuredClone(SEED);
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
