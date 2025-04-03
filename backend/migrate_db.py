import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, 'sessions.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if user_id column exists in sessions table
cursor.execute("PRAGMA table_info(sessions)")
columns = cursor.fetchall()
column_names = [column[1] for column in columns]

if 'user_id' not in column_names:
    print("Adding user_id column to sessions table...")
    cursor.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")
    conn.commit()
    print("Column added successfully.")
else:
    print("user_id column already exists.")

# Create users table if it doesn't exist
cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        hashed_password TEXT,
        disabled INTEGER DEFAULT 0
    )
''')
conn.commit()
print("Users table created or already exists.")

conn.close()
print("Database migration completed.")