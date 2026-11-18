"""API tests using a fake MySQL connection (no running server required)."""

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app import create_app  # noqa: E402


class FakeCursor:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.statements = []
        self.lastrowid = 42

    def execute(self, sql, params=()):
        self.statements.append((sql, params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def fetchall(self):
        return self.rows

    def close(self):
        pass


class FakeConnection:
    def __init__(self, rows=None):
        self.fake_cursor = FakeCursor(rows)
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self, dictionary=False):
        assert dictionary is True
        return self.fake_cursor

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


@pytest.fixture
def client():
    with patch.dict(os.environ, {"API_KEY": "local-test-secret"}):
        yield create_app({"TESTING": True}).test_client()


def authorized():
    return {"X-API-Key": "local-test-secret"}


def test_health_uses_database(client):
    connection = FakeConnection([{"connected": 1}])
    with patch("app.get_connection", return_value=connection):
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json == {"status": "ok", "database": True}
    assert connection.closed


def test_missing_api_key_is_rejected_before_database_access(client):
    with patch("app.get_connection") as connect:
        response = client.post("/api/teams", json={"name": "Brewers"})
    assert response.status_code == 401
    assert "API key" in response.json["error"]
    connect.assert_not_called()


@pytest.mark.parametrize("name", ["", " ", 123, "a" * 101])
def test_invalid_team_name_is_rejected(client, name):
    with patch("app.get_connection") as connect:
        response = client.post("/api/teams", json={"name": name}, headers=authorized())
    assert response.status_code == 400
    connect.assert_not_called()


def test_add_team_uses_parameterized_query_and_commits(client):
    connection = FakeConnection()
    with patch("app.get_connection", return_value=connection):
        response = client.post(
            "/api/teams", json={"name": "O'Brien's Team"}, headers=authorized()
        )
    assert response.status_code == 201
    assert response.json == {"team_id": 42, "name": "O'Brien's Team"}
    assert connection.fake_cursor.statements == [
        ("INSERT INTO Teams (name) VALUES (%s)", ("O'Brien's Team",))
    ]
    assert connection.commits == 1


@pytest.mark.parametrize("jersey", [-1, 100, "12", True])
def test_invalid_jersey_number_is_rejected(client, jersey):
    with patch("app.get_connection") as connect:
        response = client.post(
            "/api/players",
            json={"name": "Alex", "team_id": 1, "jersey_number": jersey},
            headers=authorized(),
        )
    assert response.status_code == 400
    connect.assert_not_called()


def test_cross_team_assignment_rolls_back(client):
    connection = FakeConnection([{"team_id": 1}, {"team_id": 2}])
    with patch("app.get_connection", return_value=connection):
        response = client.put(
            "/api/lineups/1/positions/P", json={"player_id": 4}, headers=authorized()
        )
    assert response.status_code == 409
    assert "lineup's team" in response.json["error"]
    assert connection.rollbacks == 1
    assert connection.commits == 0
    assert len(connection.fake_cursor.statements) == 2


def test_successful_assignment_is_one_transaction(client):
    connection = FakeConnection([{"team_id": 1}, {"team_id": 1}])
    with patch("app.get_connection", return_value=connection):
        response = client.put(
            "/api/lineups/1/positions/SS", json={"player_id": 3}, headers=authorized()
        )
    assert response.status_code == 200
    assert response.json == {"lineup_id": 1, "player_id": 3, "position": "SS"}
    statements = connection.fake_cursor.statements
    assert "FOR UPDATE" in statements[0][0]
    assert statements[2][1] == (1, "SS", 3)
    assert statements[3][1] == (1, 3, "SS")
    assert connection.commits == 1
    assert connection.rollbacks == 0


def test_unknown_position_is_rejected(client):
    with patch("app.get_connection") as connect:
        response = client.put(
            "/api/lineups/1/positions/DH", json={"player_id": 3}, headers=authorized()
        )
    assert response.status_code == 400
    connect.assert_not_called()


def test_missing_lineup_returns_404_and_rolls_back(client):
    connection = FakeConnection()
    with patch("app.get_connection", return_value=connection):
        response = client.put(
            "/api/lineups/999/positions/P", json={"player_id": 1}, headers=authorized()
        )
    assert response.status_code == 404
    assert connection.rollbacks == 1


def test_player_delete_is_parameterized(client):
    connection = FakeConnection([{"player_id": 3}])
    with patch("app.get_connection", return_value=connection):
        response = client.delete("/api/players/3", headers=authorized())
    assert response.status_code == 204
    assert connection.fake_cursor.statements[-1] == (
        "DELETE FROM Players WHERE player_id = %s", (3,)
    )
    assert connection.commits == 1
