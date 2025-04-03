import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, 'sessions.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create a new table for user-account relationships
cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        UNIQUE(user_id, phone)
    )
''')
conn.commit()

# Migrate existing user-account relationships
cursor.execute("SELECT phone, user_id FROM sessions WHERE user_id IS NOT NULL")
existing_relationships = cursor.fetchall()

for phone, user_id in existing_relationships:
    try:
        cursor.execute("INSERT INTO user_accounts (user_id, phone) VALUES (?, ?)", (user_id, phone))
    except sqlite3.IntegrityError:
        # Skip if relationship already exists
        pass

conn.commit()
print(f"Migrated {len(existing_relationships)} existing relationships")

conn.close()
print("Database migration completed.")