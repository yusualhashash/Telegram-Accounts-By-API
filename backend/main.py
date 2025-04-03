from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import timedelta
from database import add_session, get_sessions, create_user, get_user_by_email, associate_session_with_user, conn, cursor
from session_manager import start_login, complete_login, clients, load_sessions_on_startup, disconnect_all_clients, pending_clients
from auth import User, get_password_hash, verify_password, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
import config
import os

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class StartLoginRequest(BaseModel):
    phone: str
    force_code: bool = True  # Default to always force code

class CompleteLoginRequest(BaseModel):
    phone: str
    code: str

class SendMessageRequest(BaseModel):
    phone: str
    recipient: str
    message: str

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

# Health check endpoint
@app.get("/health/")
async def health_check():
    return {"status": "ok"}

# Authentication endpoints
@app.post("/register/")
async def register(user_data: UserRegister):
    user = create_user(user_data.username, user_data.email, user_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data.username}, expires_delta=access_token_expires
    )
    
    return {"user": user, "token": access_token}

@app.post("/login/")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user_by_email(form_data.username)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        },
        "token": access_token
    }

@app.get("/me/")
async def read_users_me(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": current_user}

# Telegram endpoints
@app.post("/start_login/")
async def start_telegram_login(request: StartLoginRequest, current_user: User = Depends(get_current_user)):
    try:
        # Use the imported start_login function from session_manager.py
        result = await start_login(
            request.phone, 
            config.API_ID, 
            config.API_HASH, 
            force_code=True  # Always force code verification
        )
        
        # If login successful, associate the session with the user
        if result["status"] in ["code_sent", "authorized"]:
            add_session(request.phone, config.API_ID, config.API_HASH, current_user["id"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/complete_login/")
async def complete_telegram_login(request: CompleteLoginRequest, current_user: User = Depends(get_current_user)):
    try:
        # Always require code verification, never use already_authorized
        result = await complete_login(request.phone, request.code)
        
        # If login successful, associate the session with the user
        if result["status"] == "success":
            add_session(request.phone, config.API_ID, config.API_HASH, current_user["id"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/list_accounts/")
async def list_accounts(current_user: User = Depends(get_current_user)):
    try:
        if current_user:
            # Return accounts associated with the current user
            user_sessions = get_sessions(current_user["id"])
            return {"accounts": [phone for phone, _, _ in user_sessions]}
        else:
            # For backward compatibility, return all accounts if not authenticated
            all_sessions = get_sessions()
            return {"accounts": [phone for phone, _, _ in all_sessions]}
    except Exception as e:
        print(f"Error in list_accounts: {str(e)}")
        # Fallback to all accounts
        all_sessions = get_sessions()
        return {"accounts": [phone for phone, _, _ in all_sessions]}

@app.post("/send_message/")
async def send_message(request: SendMessageRequest, current_user: User = Depends(get_current_user)):
    if request.phone not in clients:
        raise HTTPException(status_code=404, detail="Account not connected")
    
    # If authenticated, verify that this account belongs to the current user
    if current_user:
        user_sessions = get_sessions(current_user["id"])
        user_phones = [phone for phone, _, _ in user_sessions]
        
        if request.phone not in user_phones:
            # Check if the account exists but is not associated with this user
            cursor.execute("SELECT phone FROM sessions WHERE phone = ?", (request.phone,))
            if cursor.fetchone():
                # If the account exists, associate it with this user
                associate_session_with_user(request.phone, current_user["id"])
            else:
                raise HTTPException(status_code=403, detail="You don't have access to this account")
    
    client = clients[request.phone]
    await client.send_message(request.recipient, request.message)
    return {"message": "Message sent successfully"}

# Add this function to handle invalid sessions
async def handle_invalid_session(phone: str, current_user: User = None):
    """Handle an invalid session by removing it from clients and database."""
    print(f"Handling invalid session for {phone}")
    
    # Remove from active clients
    if phone in clients:
        try:
            await clients[phone].disconnect()
        except Exception as e:
            print(f"Error disconnecting client: {str(e)}")
        del clients[phone]
    
    # Remove from pending clients
    if phone in pending_clients:
        try:
            await pending_clients[phone].disconnect()
        except Exception as e:
            print(f"Error disconnecting pending client: {str(e)}")
        del pending_clients[phone]
    
    # Remove session file
    session_path = os.path.join("sessions", phone + ".session")
    if os.path.exists(session_path):
        try:
            os.remove(session_path)
            print(f"Removed session file: {session_path}")
        except Exception as e:
            print(f"Error removing session file: {str(e)}")
    
    # Remove from database
    try:
        cursor.execute("DELETE FROM sessions WHERE phone = ?", (phone,))
        conn.commit()
        print(f"Removed session from database: {phone}")
    except Exception as e:
        print(f"Error removing session from database: {str(e)}")
    
    return {"status": "session_invalid", "message": "Session is no longer valid. Please log in again."}

# Update the get_chats function to handle invalid sessions
@app.get("/get_chats/")
async def get_chats(phone: str, current_user: User = Depends(get_current_user)):
    if phone not in clients:
        raise HTTPException(status_code=404, detail="Account not connected")
    
    # If authenticated, verify that this account belongs to the current user
    if current_user:
        user_sessions = get_sessions(current_user["id"])
        user_phones = [phone for phone, _, _ in user_sessions]
        
        if phone not in user_phones:
            # Check if the account exists but is not associated with this user
            cursor.execute("SELECT phone FROM sessions WHERE phone = ?", (phone,))
            if cursor.fetchone():
                # If the account exists, associate it with this user
                associate_session_with_user(phone, current_user["id"])
            else:
                raise HTTPException(status_code=403, detail="You don't have access to this account")
    
    client = clients[phone]
    
    try:
        dialogs = await client.get_dialogs()
        chats = []
        for dialog in dialogs:
            chats.append({
                "id": dialog.id,
                "name": dialog.name,
                "unread_count": dialog.unread_count
            })
        return {"chats": chats}
    except Exception as e:
        error_str = str(e)
        print(f"Error getting chats for {phone}: {error_str}")
        
        # Check for AuthKeyUnregisteredError
        if "AuthKeyUnregisteredError" in error_str or "The key is not registered in the system" in error_str:
            # Handle invalid session
            await handle_invalid_session(phone, current_user)
            raise HTTPException(
                status_code=401, 
                detail="Session is no longer valid. Please log in again."
            )
        
        # Handle other errors
        raise HTTPException(status_code=500, detail=error_str)

@app.get("/get_messages/")
async def get_messages(phone: str, chat_id: int, limit: int = 50, current_user: User = Depends(get_current_user)):
    if phone not in clients:
        raise HTTPException(status_code=404, detail="Account not connected")
    
    # If authenticated, verify that this account belongs to the current user
    if current_user:
        user_sessions = get_sessions(current_user["id"])
        user_phones = [phone for phone, _, _ in user_sessions]
        
        if phone not in user_phones:
            # Check if the account exists but is not associated with this user
            cursor.execute("SELECT phone FROM sessions WHERE phone = ?", (phone,))
            if cursor.fetchone():
                # If the account exists, associate it with this user
                associate_session_with_user(phone, current_user["id"])
            else:
                raise HTTPException(status_code=403, detail="You don't have access to this account")
    
    client = clients[phone]
    
    try:
        entity = await client.get_entity(int(chat_id))
        messages = await client.get_messages(entity, limit=limit, reverse=True)
        
        formatted_messages = []
        for msg in messages:
            text = msg.text if msg.text is not None else ""
            
            message_obj = {
                "id": msg.id,
                "text": text,
                "date": msg.date.isoformat(),
                "out": msg.out,
                "sender_id": msg.sender_id
            }
            
            if hasattr(msg, 'reply_to_msg_id') and msg.reply_to_msg_id is not None:
                message_obj["reply_to_msg_id"] = msg.reply_to_msg_id
                
            formatted_messages.append(message_obj)
        
        return {"messages": formatted_messages}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid chat ID: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.on_event("startup")
async def startup_event():
    background_tasks = BackgroundTasks()
    background_tasks.add_task(load_sessions_on_startup)

@app.on_event("shutdown")
async def shutdown_event():
    await disconnect_all_clients()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

