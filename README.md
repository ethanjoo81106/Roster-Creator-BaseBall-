# Baseball Lineup Creator

## Project Overview

This project is a baseball lineup creator that allows users to create teams, manage players, and assign players to positions on a baseball diamond.
The application will allow users to save and load different lineup configurations using a MySQL database.

## Planned Features

- Create and manage baseball teams.
- Add, edit, and remove players.
- Create and manage lineups.
- Assign players to different baseball positions.
- Save and load lineups from the database.

## Database Design

The database consists of four tables:

- **Teams:** Stores team information.
- **Players:** Stores players and their associated teams.
- **Lineups:** Stores saved lineups for each team.
- **Lineup_players:** Stores players assigned to specific positions within a lineup.

The Lineup_players table establishes a many-to-many relationship between Players and Lineups.

## Project Structure

```text
Roster-Creator-Baseball/
|── frontend/
|── backend/
|── database/
│   |── schema.sql
│   |── testdata.sql
|── README.md
```

This is the planned project structure. Some folders and files may not yet be implemented.

## Setup Instructions 


To test connection

Create db by running schema.sql in mysql db.

enter backend folder run python file and enter the mysql password

if successful it will conect to the db.

### Database Setup

1. Install MySQL Server and MySQL Workbench.
2. Open MySQL Workbench and connect to a local MySQL server.
3. Open `database/schema.sql`.
4. Execute the SQL script to create the database tables.
5. Optionally, execute `database/testdata.sql` to insert sample data.