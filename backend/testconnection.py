import mysql.connector
import os

from getpass import getpass

password = os.getenv("MYSQL_PASSWORD") or getpass("MySQL password: ")

try:
    connection = mysql.connector.connect(
        host="localhost",
        user="root",
        password=password,
        database="baseball_lineup"
    )

    if connection.is_connected():
        print("Successfully connected to MySQL!")

        cursor = connection.cursor()
        cursor.execute("SELECT DATABASE()")

        result = cursor.fetchone()
        print("Connected to database:", result[0])

        cursor.close()

except mysql.connector.Error as error:
    print("Database connection failed:", error)

finally:
    if "connection" in locals() and connection.is_connected():
        connection.close()