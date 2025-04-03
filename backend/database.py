import sqlite3
import os
import uuid
from auth import get_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, 'sessions.db')
conn = sqlite3.connect(db_path, check_same_thread=False)
cursor = conn.cursor()

# Create tables if they don't exist
cursor.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        phone TEXT PRIMARY KEY,
        api_id INTEGER,
        api_hash TEXT
    )
''')

cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        hashed_password TEXT,
        disabled INTEGER DEFAULT 0
    )
''')

cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        UNIQUE(user_id, phone)
    )
''')

conn.commit()

# Check if user_id column exists in sessions table
cursor.execute("PRAGMA table_info(sessions)")
columns = cursor.fetchall()
column_names = [column[1] for column in columns]

if 'user_id' not in column_names:
    try:
        print("Adding user_id column to sessions table...")
        cursor.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")
        conn.commit()
        print("Column added successfully.")
    except sqlite3.OperationalError as e:
        print(f"Error adding user_id column: {str(e)}")

# User management functions
def create_user(username, email, password):
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(password)
    
    try:
        cursor.execute(
            "INSERT INTO users (id, username, email, hashed_password) VALUES (?, ?, ?, ?)",
            (user_id, username, email, hashed_password)
        )
        conn.commit()
        return {"id": user_id, "username": username, "email": email}
    except sqlite3.IntegrityError:
        # Check if username or email already exists
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
        result = cursor.fetchone()
        if result:
            return None
        raise

def get_user_by_username(username):
    cursor.execute("SELECT id, username, email, hashed_password, disabled FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    if user:
        return {
            "id": user[0],
            "username": user[1],
            "email": user[2],
            "hashed_password": user[3],
            "disabled": bool(user[4])
        }
    return None

def get_user_by_email(email):
    cursor.execute("SELECT id, username, email, hashed_password, disabled FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    if user:
        return {
            "id": user[0],
            "username": user[1],
            "email": user[2],
            "hashed_password": user[3],
            "disabled": bool(user[4])
        }
    return None

# Session management functions
def add_session(phone, api_id, api_hash, user_id=None):
    try:
        # Check if session exists
        cursor.execute("SELECT phone FROM sessions WHERE phone = ?", (phone,))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing session
            cursor.execute("UPDATE sessions SET api_id = ?, api_hash = ? WHERE phone = ?",
                       (api_id, api_hash, phone))
        else:
            # Insert new session
            cursor.execute("INSERT INTO sessions (phone, api_id, api_hash) VALUES (?, ?, ?)",
                       (phone, api_id, api_hash))
        
        # If user_id is provided, associate this account with the user
        if user_id:
            associate_session_with_user(phone, user_id)
            
        conn.commit()
    except Exception as e:
        print(f"Error in add_session: {str(e)}")
        raise

def get_sessions(user_id=None):
    try:
        if user_id:
            # Get sessions associated with this user from the user_accounts table
            cursor.execute("""
                SELECT s.phone, s.api_id, s.api_hash 
                FROM sessions s
                JOIN user_accounts ua ON s.phone = ua.phone
                WHERE ua.user_id = ?
            """, (user_id,))
        else:
            cursor.execute("SELECT phone, api_id, api_hash FROM sessions")
        return cursor.fetchall()
    except sqlite3.OperationalError as e:
        print(f"Database error in get_sessions: {str(e)}")
        # Fallback to getting all sessions if there's an error
        cursor.execute("SELECT phone, api_id, api_hash FROM sessions")
        return cursor.fetchall()

def associate_session_with_user(phone, user_id):
    try:
        # Add to user_accounts table (many-to-many relationship)
        cursor.execute("INSERT OR IGNORE INTO user_accounts (user_id, phone) VALUES (?, ?)", 
                      (user_id, phone))
        conn.commit()
        return True
    except sqlite3.OperationalError as e:
        print(f"Error in associate_session_with_user: {str(e)}")
        return False

def is_account_associated_with_user(phone, user_id):
    cursor.execute("SELECT 1 FROM user_accounts WHERE user_id = ? AND phone = ?", (user_id, phone))
    return cursor.fetchone() is not None