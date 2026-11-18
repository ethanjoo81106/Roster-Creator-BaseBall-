"""Connection settings for the project's MySQL database."""

import os

import mysql.connector

def get_connection():
    """Open a fresh database connection using environment-based credentials."""
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.getenv("MYSQL_USER", "baseball_app"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "baseball_lineup"),
        connection_timeout=5,
    )