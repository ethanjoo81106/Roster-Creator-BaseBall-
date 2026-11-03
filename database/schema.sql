
CREATE DATABASE IF NOT EXISTS baseball_lineup;
USE baseball_lineup;


CREATE TABLE IF NOT EXISTS Teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);


CREATE TABLE IF NOT EXISTS Players (
    player_id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    jersey_number INT,

    CONSTRAINT fk_players_team
    FOREIGN KEY (team_id) REFERENCES Teams(team_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

    CONSTRAINT chk_jersey_number
    CHECK (jersey_number IS NULL OR jersey_number BETWEEN 0 AND 99)
);

CREATE TABLE IF NOT EXISTS Lineups (
    lineup_id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,

    CONSTRAINT fk_lineups_team
    FOREIGN KEY (team_id) REFERENCES Teams(team_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS Lineup_players (
    lineup_id INT NOT NULL,
    player_id INT NOT NULL,
    position VARCHAR(2) NOT NULL,

    PRIMARY KEY (lineup_id, player_id),

    CONSTRAINT uq_lineup_position UNIQUE (lineup_id, position),

    CONSTRAINT fk_assignments_lineup
    FOREIGN KEY (lineup_id) REFERENCES Lineups(lineup_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

    CONSTRAINT fk_assignments_player
    FOREIGN KEY (player_id) REFERENCES Players(player_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

    CONSTRAINT chk_baseball_position
    CHECK (position IN ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'))
);