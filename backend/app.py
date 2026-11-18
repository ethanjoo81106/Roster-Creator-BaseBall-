import hmac
import os
from functools import wraps

import mysql.connector
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from db import get_connection

load_dotenv()

POSITIONS = frozenset({"P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"})

class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(JSON_SORT_KEYS=False)
    if test_config:
        app.config.update(test_config)

    origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    CORS(app, resources={r"/api/*": {"origins": [origin]}}, allow_headers=["Content-Type", "X-API-Key"])

    @app.errorhandler(ApiError)
    def api_error(error):
        return jsonify({"error": str(error)}), error.status

    @app.errorhandler(mysql.connector.Error)
    def database_error(error):
        app.logger.error("Database operation failed: %s", error)
        if getattr(error, "errno", None) in (1062, 1451, 1452, 3819):
            return jsonify({"error": "The operation conflicts with a database constraint."}), 409
        return jsonify({"error": "Database unavailable or request could not be completed."}), 503

    def require_write_key(handler):
        @wraps(handler)
        def wrapper(*args, **kwargs):
            expected = os.getenv("API_KEY", "")
            supplied = request.headers.get("X-API-Key", "")
            if not expected:
                return jsonify({"error": "API_KEY is not configured on the server."}), 503
            if not hmac.compare_digest(supplied, expected):
                return jsonify({"error": "Missing or invalid API key."}), 401
            return handler(*args, **kwargs)

        return wrapper

    def body(*allowed):
        if not request.is_json or not isinstance(request.get_json(silent=True), dict):
            raise ApiError("Send a JSON object with Content-Type: application/json.")
        values = request.get_json()
        unexpected = set(values) - set(allowed)
        if unexpected:
            raise ApiError(f"Unexpected field(s): {', '.join(sorted(unexpected))}.")
        return values

    def name_field(values):
        name = values.get("name")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
            raise ApiError("name must contain 1 to 100 characters.")
        return name.strip()

    def integer_field(values, key, nullable=False):
        value = values.get(key)
        if value is None and nullable:
            return None
        if isinstance(value, bool) or not isinstance(value, int):
            raise ApiError(f"{key} must be an integer.")
        return value

    def jersey_field(values):
        jersey = integer_field(values, "jersey_number", nullable=True)
        if jersey is not None and not 0 <= jersey <= 99:
            raise ApiError("jersey_number must be between 0 and 99, or null.")
        return jersey

    def record(cursor, sql, args, label):
        cursor.execute(sql, args)
        result = cursor.fetchone()
        if result is None:
            raise ApiError(f"{label} not found.", 404)
        return result

    def run_query(sql, args=(), many=False):
        connection = get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(sql, args)
                return cursor.fetchall() if many else cursor.fetchone()
            finally:
                cursor.close()
        finally:
            connection.close()

    def run_write(operation):
        connection = get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                result = operation(cursor)
                connection.commit()
                return result
            except Exception:
                connection.rollback()
                raise
            finally:
                cursor.close()
        finally:
            connection.close()

    @app.get("/api/health")
    def health():
        try:
            row = run_query("SELECT 1 AS connected")
            return jsonify({"status": "ok", "database": bool(row["connected"])})
        except mysql.connector.Error:
            return jsonify({"status": "unavailable", "database": False}), 503

    @app.get("/api/teams")
    def list_teams():
        return jsonify(run_query("SELECT team_id, name FROM Teams ORDER BY name", many=True))

    @app.post("/api/teams")
    @require_write_key
    def add_team():
        name = name_field(body("name"))

        def operation(cursor):
            cursor.execute("INSERT INTO Teams (name) VALUES (%s)", (name,))
            return {"team_id": cursor.lastrowid, "name": name}

        return jsonify(run_write(operation)), 201

    @app.put("/api/teams/<int:team_id>")
    @require_write_key
    def edit_team(team_id):
        name = name_field(body("name"))

        def operation(cursor):
            record(cursor, "SELECT team_id FROM Teams WHERE team_id = %s", (team_id,), "Team")
            cursor.execute("UPDATE Teams SET name = %s WHERE team_id = %s", (name, team_id))
            return {"team_id": team_id, "name": name}

        return jsonify(run_write(operation))

    @app.delete("/api/teams/<int:team_id>")
    @require_write_key
    def delete_team(team_id):
        def operation(cursor):
            record(cursor, "SELECT team_id FROM Teams WHERE team_id = %s", (team_id,), "Team")
            cursor.execute("DELETE FROM Teams WHERE team_id = %s", (team_id,))

        run_write(operation)
        return "", 204

    @app.get("/api/teams/<int:team_id>/players")
    def list_players(team_id):
        return jsonify(run_query(
            "SELECT player_id, team_id, name, jersey_number FROM Players "
            "WHERE team_id = %s ORDER BY name", (team_id,), many=True
        ))

    @app.post("/api/players")
    @require_write_key
    def add_player():
        values = body("name", "team_id", "jersey_number")
        name = name_field(values)
        team_id = integer_field(values, "team_id")
        jersey = jersey_field(values)
        if team_id <= 0:
            raise ApiError("team_id must be positive.")

        def operation(cursor):
            record(cursor, "SELECT team_id FROM Teams WHERE team_id = %s", (team_id,), "Team")
            cursor.execute(
                "INSERT INTO Players (team_id, name, jersey_number) VALUES (%s, %s, %s)",
                (team_id, name, jersey),
            )
            return {"player_id": cursor.lastrowid, "team_id": team_id, "name": name, "jersey_number": jersey}

        return jsonify(run_write(operation)), 201

    @app.put("/api/players/<int:player_id>")
    @require_write_key
    def edit_player(player_id):
        values = body("name", "jersey_number")
        name = name_field(values)
        jersey = jersey_field(values)

        def operation(cursor):
            previous = record(
                cursor, "SELECT team_id FROM Players WHERE player_id = %s", (player_id,), "Player"
            )
            cursor.execute(
                "UPDATE Players SET name = %s, jersey_number = %s WHERE player_id = %s",
                (name, jersey, player_id),
            )
            return {"player_id": player_id, "team_id": previous["team_id"], "name": name, "jersey_number": jersey}

        return jsonify(run_write(operation))

    @app.delete("/api/players/<int:player_id>")
    @require_write_key
    def delete_player(player_id):
        def operation(cursor):
            record(cursor, "SELECT player_id FROM Players WHERE player_id = %s", (player_id,), "Player")
            cursor.execute("DELETE FROM Players WHERE player_id = %s", (player_id,))

        run_write(operation)
        return "", 204

    @app.get("/api/teams/<int:team_id>/lineups")
    def list_lineups(team_id):
        return jsonify(run_query(
            "SELECT lineup_id, team_id, name FROM Lineups WHERE team_id = %s ORDER BY name",
            (team_id,), many=True,
        ))

    @app.post("/api/lineups")
    @require_write_key
    def add_lineup():
        values = body("name", "team_id")
        name = name_field(values)
        team_id = integer_field(values, "team_id")
        if team_id <= 0:
            raise ApiError("team_id must be positive.")

        def operation(cursor):
            record(cursor, "SELECT team_id FROM Teams WHERE team_id = %s", (team_id,), "Team")
            cursor.execute("INSERT INTO Lineups (team_id, name) VALUES (%s, %s)", (team_id, name))
            return {"lineup_id": cursor.lastrowid, "team_id": team_id, "name": name}

        return jsonify(run_write(operation)), 201

    @app.put("/api/lineups/<int:lineup_id>")
    @require_write_key
    def edit_lineup(lineup_id):
        name = name_field(body("name"))

        def operation(cursor):
            previous = record(cursor, "SELECT team_id FROM Lineups WHERE lineup_id = %s", (lineup_id,), "Lineup")
            cursor.execute("UPDATE Lineups SET name = %s WHERE lineup_id = %s", (name, lineup_id))
            return {"lineup_id": lineup_id, "team_id": previous["team_id"], "name": name}

        return jsonify(run_write(operation))

    @app.delete("/api/lineups/<int:lineup_id>")
    @require_write_key
    def delete_lineup(lineup_id):
        def operation(cursor):
            record(cursor, "SELECT lineup_id FROM Lineups WHERE lineup_id = %s", (lineup_id,), "Lineup")
            cursor.execute("DELETE FROM Lineups WHERE lineup_id = %s", (lineup_id,))

        run_write(operation)
        return "", 204

    @app.get("/api/lineups/<int:lineup_id>/players")
    def lineup_players(lineup_id):
        return jsonify(run_query(
            "SELECT lp.lineup_id, lp.player_id, lp.position, p.name, p.jersey_number "
            "FROM Lineup_players AS lp "
            "JOIN Players AS p ON p.player_id = lp.player_id "
            "WHERE lp.lineup_id = %s ORDER BY FIELD(lp.position, 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF')",
            (lineup_id,), many=True,
        ))

    @app.put("/api/lineups/<int:lineup_id>/positions/<position>")
    @require_write_key
    def assign_position(lineup_id, position):
        position = position.upper()
        if position not in POSITIONS:
            raise ApiError("Unknown baseball position.")
        player_id = integer_field(body("player_id"), "player_id")
        if player_id <= 0:
            raise ApiError("player_id must be positive.")

        def operation(cursor):
            lineup = record(
                cursor, "SELECT team_id FROM Lineups WHERE lineup_id = %s FOR UPDATE",
                (lineup_id,), "Lineup",
            )
            player = record(
                cursor, "SELECT team_id FROM Players WHERE player_id = %s", (player_id,), "Player",
            )
            if lineup["team_id"] != player["team_id"]:
                raise ApiError("Player must belong to the lineup's team.", 409)

            cursor.execute(
                "DELETE FROM Lineup_players WHERE lineup_id = %s "
                "AND (position = %s OR player_id = %s)",
                (lineup_id, position, player_id),
            )
            cursor.execute(
                "INSERT INTO Lineup_players (lineup_id, player_id, position) VALUES (%s, %s, %s)",
                (lineup_id, player_id, position),
            )
            return {"lineup_id": lineup_id, "player_id": player_id, "position": position}

        return jsonify(run_write(operation))

    @app.delete("/api/lineups/<int:lineup_id>/positions/<position>")
    @require_write_key
    def clear_position(lineup_id, position):
        position = position.upper()
        if position not in POSITIONS:
            raise ApiError("Unknown baseball position.")

        def operation(cursor):
            record(cursor, "SELECT lineup_id FROM Lineups WHERE lineup_id = %s", (lineup_id,), "Lineup")
            cursor.execute(
                "DELETE FROM Lineup_players WHERE lineup_id = %s AND position = %s",
                (lineup_id, position),
            )

        run_write(operation)
        return "", 204

    return app


if __name__ == "__main__":
    if not os.getenv("API_KEY"):
        raise SystemExit("Set API_KEY in backend/.env before running the API.")
    create_app().run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
