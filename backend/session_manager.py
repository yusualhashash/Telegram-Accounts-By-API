from telethon import TelegramClient
import os
import asyncio
from database import get_sessions, conn, cursor

# Make sure the sessions folder exists
session_folder = os.path.join(os.path.dirname(__file__), "sessions")
if not os.path.exists(session_folder):
    os.makedirs(session_folder)

clients = {}
pending_clients = {}

async def start_login(phone, api_id, api_hash, force_code=True):
    """Start the login process for a Telegram account."""
    try:
        # Check if the client already exists
        if phone in clients:
            client = clients[phone]
            
            # Always force a new code by logging out first
            if await client.is_user_authorized():
                # Log out to force a new code
                await client.log_out()
                
                # Create a new client
                client = TelegramClient(os.path.join("sessions", phone), api_id, api_hash)
                await client.connect()
                clients[phone] = client
        
        # Create a new client if it doesn't exist
        client = TelegramClient(os.path.join("sessions", phone), api_id, api_hash)
        await client.connect()
        
        # Send the code
        await client.send_code_request(phone)
        pending_clients[phone] = client
        return {"status": "code_sent", "message": "Verification code sent to your Telegram app"}
    except Exception as e:
        print(f"Error in start_login: {str(e)}")
        raise Exception(str(e))

async def complete_login(phone, code):
    """Complete the login process with the verification code."""
    if phone not in pending_clients and phone not in clients:
        raise Exception("Login session not found")
    
    try:
        # Get the client from pending or active clients
        client = pending_clients.get(phone) or clients.get(phone)
        
        # Always sign in with the code
        await client.sign_in(phone, code)
        
        # Move from pending to active clients
        clients[phone] = client
        if phone in pending_clients:
            del pending_clients[phone]
        
        # Get the user info
        me = await client.get_me()
        
        return {
            "status": "success", 
            "message": f"Successfully logged in as {me.first_name if hasattr(me, 'first_name') else phone}"
        }
    except Exception as e:
        print(f"Error in complete_login: {str(e)}")
        raise Exception(str(e))

async def load_sessions_on_startup():
    """Load all sessions from the database on startup."""
    print("Loading Telegram sessions on startup...")
    from database import get_sessions
    try:
        sessions = get_sessions()
        loaded_count = 0
        
        for session in sessions:
            phone, api_id, api_hash = session
            try:
                # Check if session file exists
                session_path = os.path.join("sessions", phone)
                session_file = session_path + ".session"
                
                if not os.path.exists(session_file):
                    print(f"Session file for {phone} does not exist, skipping")
                    continue
                
                # Create and connect client
                client = TelegramClient(session_path, api_id, api_hash)
                await client.connect()
                
                # Check if authorized
                if await client.is_user_authorized():
                    clients[phone] = client
                    loaded_count += 1
                    print(f"Loaded session for {phone}")
                else:
                    print(f"Session for {phone} exists but is not authorized")
            except Exception as e:
                print(f"Error loading session for {phone}: {str(e)}")
        
        print(f"Successfully loaded {loaded_count} Telegram sessions")
    except Exception as e:
        print(f"Error in load_sessions_on_startup: {str(e)}")

async def disconnect_all_clients():
    """Disconnect all clients when shutting down."""
    for phone, client in list(clients.items()):
        try:
            await client.disconnect()
            print(f"Disconnected client for {phone}")
        except Exception as e:
            print(f"Error disconnecting client for {phone}: {str(e)}")
    
    for phone, client in list(pending_clients.items()):
        try:
            await client.disconnect()
            print(f"Disconnected pending client for {phone}")
        except Exception as e:
            print(f"Error disconnecting pending client for {phone}: {str(e)}")

