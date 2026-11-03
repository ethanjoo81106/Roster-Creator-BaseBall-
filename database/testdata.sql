USE baseball_lineup;

INSERT INTO Teams (team_id, name) VALUES
    (1, 'Brewers'),
    (2, 'Cubs');

INSERT INTO Players (player_id, team_id, name, jersey_number) VALUES
    (1, 1, 'Alex Carter', 12),
    (2, 1, 'Jordan Lee', 7),
    (3, 1, 'Taylor Smith', 24),
    (4, 2, 'Morgan Reed', 9);

INSERT INTO Lineups (lineup_id, team_id, name) VALUES
    (1, 1, 'Starting Defense'),
    (2, 1, 'Alternate Defense'),
    (3, 2, 'Starting Defense');

INSERT INTO Lineup_players (lineup_id, player_id, position) VALUES
    (1, 1, 'P'),
    (1, 2, 'C'),
    (1, 3, '1B'),
    (2, 1, 'CF'),
    (2, 2, 'P'),
    (3, 4, 'SS');

-- Example verification query --- show player names and positions.
SELECT l.name AS lineup_name, p.name AS player_name, lp.position FROM Lineup_players AS lp
JOIN Lineups AS l ON l.lineup_id = lp.lineup_id
JOIN Players AS p ON p.player_id = lp.player_id
ORDER BY l.lineup_id, lp.position;
