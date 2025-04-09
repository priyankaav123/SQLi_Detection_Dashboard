import logging
import re
import datetime
import os
import urllib.parse
import random
import json
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit
import hashlib
import binascii
import os
from werkzeug.middleware.proxy_fix import ProxyFix

# Initialize Flask App
app = Flask(__name__)
app.secret_key = 'your_secret_key_for_sessions'  # Added for session support
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)

@app.before_request
def handle_forwarded_for():
    if 'X-Forwarded-For' in request.headers:
        # Use the forwarded IP for detection and logging
        request.environ['REMOTE_ADDR'] = request.headers.get('X-Forwarded-For').split(',')[0].strip()

# Allow CORS for frontend projects
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}}, supports_credentials=True)

# Initialize WebSockets with CORS allowed
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000", "http://localhost:5173"], async_mode="threading")

# Configure logging
LOG_FILE = 'requests.log'
logging.basicConfig(filename=LOG_FILE, level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Define User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)  # Increased length for hash

login_attempts = {}  
blocked_sessions = set()  
otp_store = {}  

# Password hashing functions
def hash_password(password):
    """Hash a password using PBKDF2 with SHA-256."""
    # Generate a random salt
    salt = hashlib.sha256(os.urandom(60)).hexdigest().encode('ascii')
    # Hash password using PBKDF2
    pwdhash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    pwdhash = binascii.hexlify(pwdhash)
    # Return the salt + hash
    return (salt + pwdhash).decode('ascii')

def verify_password(stored_password, provided_password):
    """Verify a stored password against one provided by user."""
    # Extract the salt
    salt = stored_password[:64]
    # Extract the stored hash
    stored_hash = stored_password[64:]
    # Hash the provided password with the same salt
    pwdhash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt.encode('ascii'), 100000)
    pwdhash = binascii.hexlify(pwdhash).decode('ascii')
    # Compare the calculated hash with the stored hash
    return pwdhash == stored_hash

# Function to initialize database
def init_db():
    with app.app_context():
        db.create_all()
        if not User.query.first():  # Add users only if none exist
            users = [
                User(username='alice', password=hash_password('password1')),
                User(username='bob', password=hash_password('password2')),
                User(username='charlie', password=hash_password('password3')),
                User(username='dave', password=hash_password('password4')),
                User(username='eve', password=hash_password('password5')),
            ]
            db.session.bulk_save_objects(users)
            db.session.commit()

init_db()

# SQL Injection detection patterns (unchanged)
DANGEROUS_PATTERNS = [
    # SQL Keywords & Commands
    r"(?i)\bselect\b\s*\**\s*\bfrom\b", r"(?i)\bunion\b\s*\bselect\b", r"(?i)\border by\b\s*\d+", 
    r"(?i)\bcase when\b", r"(?i)\binsert into\b", r"(?i)\bupdate\b\s*\bset\b", 
    r"(?i)\bdelete from\b", r"(?i)\bdrop table\b", r"(?i)\bexec\b", r"(?i)\breplace into\b", 
    r"(?i)\balter table\b", r"(?i)\btruncate\b", r"(?i)\bcreate\b\s*\btable\b",

    # Logical Conditions (Bypass Authentication)
    r"(?i)\band\s*\d+=\d+\b", r"(?i)\bor\s*\d+=\d+\b", r"(?i)\bsleep\s*\(\d+\)", r"(?i)\bwaitfor delay\b",
    r"(?i)\bif\s*\(.*=.*\)", r"(?i)\btrue\b.*\bfalse\b", r"(?i)\bnull is null\b",

    # Obfuscation Tricks
    r"(?i)\bselect\s*/\*\*/\s*\*?\s*from\b",  # Inline comments (`SELECT/**/FROM`)
    r"(?i)\bunion\s*/\*\*/\s*select\b",  # `UNION/**/SELECT`
    r"(?i)\bunion%20select\b", r"(?i)\bunion%09select\b",  # URL encoding tricks
    r"(?i)\bselect%20from\b", r"(?i)\bselect%09from\b",  # `SELECT%20FROM`
    r"(?i)or\s*1\s*=\s*1", r"(?i)and\s*1\s*=\s*1", r"(?i)1=1", r"(?i)\bnull is null\b",

    # System Access & OOB SQLi
    r"(?i)\bxp_cmdshell\b", r"(?i)\bsystem_user\b", r"(?i)\bcurrent_user\b", r"(?i)\buser\b\(\)", 
    r"(?i)\bpg_sleep\b", r"(?i)\bschema_name\b", r"(?i)\btable_name\b", r"(?i)\bcolumn_name\b",

    # Encoded SQL Injection Bypasses
    r"(?i)0x[0-9A-Fa-f]+",  # Hex encoding
    r"(?i)char\([0-9,]+\)", r"(?i)concat\(", r"(?i)union all select", r"(?i)case when",
    r"(?i)base64_decode\(", r"(?i)unhex\(",  

    # SQL Comment Injection
    r"--", r"#", r"/\*", r"\*/", r";", r"'",  

    # Nested Queries and Subqueries
    r"(?i)\bexists\s*\(", r"(?i)\bnot exists\s*\(", r"(?i)\bselect.*\bfrom\s*\(.*select",

    # Mixed Casing Obfuscation
    r"(?i)[Ss][Ee][Ll][Ee][Cc][T]", r"(?i)[Uu][Nn][Ii][Oo][N]", r"(?i)[Oo][Rr][Dd][Ee][R]",
]

def detect_sql_injection(data):
    """Detects SQL Injection patterns and ensures security."""

    if not data:
        return False

    # Decode URL-encoded payloads & Normalize Input
    data = urllib.parse.unquote(data)  
    data = data.replace("+", " ")  
    data = re.sub(r"\s+", " ", data).strip().lower()  # Normalize Whitespace & Case

    # Remove ALL spaces between characters
    compressed_data = re.sub(r"\s+", "", data)  # Example: `select     union` → `selectunion`

    # Allow Only Safe Inputs (Strict Alphanumeric Check)
    if re.fullmatch(r"^[a-z0-9_]+$", data):
        return False  

    # Check Against Dangerous SQL Patterns
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, data) or re.search(pattern, compressed_data):
            return True  

    return False  # No SQL Injection Detected

def log_event(level, message):
    """Logs events with timestamp and IP address, and sends to WebSocket for React Dashboards."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ip_address = request.remote_addr or "Unknown IP"
    log_entry = f"[{timestamp}] [IP: {ip_address}] [{level}] {message}"
    
    # Write to log file
    with open(LOG_FILE, "a") as f:
        f.write(log_entry + "\n")

    # Send real-time update to React Dashboards
    socketio.emit('new_log', {'log': log_entry}, namespace='/logs')

def load_security_settings():
    try:
        if os.path.exists('security_settings.json'):
            with open('security_settings.json', 'r') as f:
                return json.load(f)
    except Exception as e:
        logging.error(f"Error loading security settings: {e}")
    
    return {
        "captcha": {
            "enabled": True,
            "trigger_threshold": 2  # After 2 failed attempts
        },
        "rate_limiting": {
            "enabled": True,
            "max_attempts": 5,
            "window_minutes": 15
        },
        "two_factor": {
            "enabled": True,
            "method": "email"  # Could be "email", "sms", "app"
        },
        "password_policy": {
            "min_length": 8,
            "require_special": True,
            "require_numbers": True,
            "require_uppercase": True
        },
        "session": {
            "timeout_minutes": 30,
            "remember_me_days": 7
        }
    }

# Save settings to JSON file
def save_security_settings(settings):
    try:
        with open('security_settings.json', 'w') as f:
            json.dump(settings, f, indent=4)
        log_event("SETTINGS", f"Security settings updated")
        return True
    except Exception as e:
        logging.error(f"Error saving security settings: {e}")
        return False

# ===== ROUTES =====

# Route to get security settings
@app.route('/settings', methods=['GET'])
def get_settings():
    settings = load_security_settings()
    return jsonify(settings)

# Route to update security settings (admin only)
@app.route('/settings', methods=['POST'])
def update_settings():
    # In a real app, you would authenticate admin access here
    # For demo purposes, we're allowing direct updates
    
    try:
        new_settings = request.json
        current_settings = load_security_settings()
        
        # Update only valid fields
        for category in current_settings:
            if category in new_settings and isinstance(new_settings[category], dict):
                for key in current_settings[category]:
                    if key in new_settings[category]:
                        current_settings[category][key] = new_settings[category][key]
        
        if save_security_settings(current_settings):
            return jsonify({"success": True, "message": "Settings updated successfully"})
        else:
            return jsonify({"success": False, "message": "Failed to save settings"}), 500
            
    except Exception as e:
        logging.error(f"Error updating settings: {e}")
        return jsonify({"success": False, "message": str(e)}), 400

@app.route('/login', methods=['POST'])
def login():
    """Handles user login with security features"""
    try:
        data = request.json
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        captcha_response = data.get('captcha')
        otp = data.get('otp')

        # Get security settings
        security_settings = load_security_settings()

        # Ensure session is created
        if 'id' not in session:
            session['id'] = str(random.randint(10000, 99999))

        # Required fields check
        if not username or not password:
            return jsonify({"message": "Both fields are required.", "success": False}), 400

        # SQL Injection check
        if detect_sql_injection(username) or detect_sql_injection(password):
            log_event("SQLI ATTEMPT", f"SQL Injection detected! Username: '{username}', Password: '{password}'")
            return jsonify({"message": "SQL Injection detected!", "success": False}), 400

        # CAPTCHA validation if enabled
        if security_settings['captcha']['enabled'] and captcha_response:
            expected_captcha = data.get('expected_captcha')
            if captcha_response != expected_captcha:
                log_event("FAILED CAPTCHA", f"Invalid CAPTCHA for user '{username}'")
                return jsonify({"message": "Invalid CAPTCHA response", "success": False, "requireCaptcha": True}), 401

        # Rate limiting check if enabled
        if security_settings['rate_limiting']['enabled']:
            session_id = session.get('id')
            
            # Check if the session is blocked
            if session_id in blocked_sessions:
                log_event("BLOCKED SESSION", f"Blocked session '{session_id}' attempted login")
                return jsonify({"message": "Your session has been blocked due to too many failed attempts.", "success": False}), 403
            
            # Check rate limits for this username
            if username in login_attempts:
                attempts, first_attempt_time = login_attempts[username]
                window_minutes = security_settings['rate_limiting']['window_minutes']
                max_attempts = security_settings['rate_limiting']['max_attempts']
                
                # If within time window, check attempt count
                if (datetime.datetime.now() - first_attempt_time).total_seconds() < (window_minutes * 60):
                    if attempts >= max_attempts:
                        log_event("RATE LIMITED", f"Rate limit exceeded for user '{username}'")
                        blocked_sessions.add(session_id)
                        return jsonify({"message": f"Too many login attempts. Please try again later.", "success": False}), 429
                else:
                    # Reset counter if outside time window
                    login_attempts[username] = (0, datetime.datetime.now())
            else:
                # Initialize counter for first attempt
                login_attempts[username] = (0, datetime.datetime.now())

        # Verify user credentials
        user = User.query.filter_by(username=username).first()
        
        # If credentials are wrong
        if not user or not verify_password(user.password, password):
            message = "Invalid credentials."
            status_code = 401
            
            # Increment failed attempt counter
            if username in login_attempts:
                attempts, first_attempt = login_attempts[username]
                login_attempts[username] = (attempts + 1, first_attempt)
            else:
                login_attempts[username] = (1, datetime.datetime.now())
            
            if user:
                log_event("FAILED LOGIN", f"Incorrect password attempt for user '{username}'")
            else:
                log_event("FAILED LOGIN", f"Unknown user '{username}' attempted to log in")
                
            # Check if we should trigger CAPTCHA
            captcha_threshold = security_settings['captcha']['trigger_threshold']
            if security_settings['captcha']['enabled'] and login_attempts.get(username, (0, None))[0] >= captcha_threshold:
                return jsonify({"message": message, "success": False, "requireCaptcha": True}), status_code
                
            return jsonify({"message": message, "success": False}), status_code

        # Check for 2FA if enabled
        if security_settings['two_factor']['enabled'] and not otp:
            # In a real app, you'd generate and send the OTP here
            # For demo, we'll just create a random 6-digit code
            generated_otp = str(random.randint(100000, 999999))
            otp_store[username] = generated_otp
            log_event("2FA", f"Generated OTP for user '{username}': {generated_otp}")
            return jsonify({"message": "Please enter the verification code", "success": False, "require2FA": True}), 200
            
        # Verify OTP if 2FA is enabled
        if security_settings['two_factor']['enabled'] and otp:
            stored_otp = otp_store.get(username)
            if not stored_otp or otp != stored_otp:
                log_event("FAILED 2FA", f"Invalid OTP for user '{username}'")
                return jsonify({"message": "Invalid verification code", "success": False, "require2FA": True}), 401
            # Clear OTP after successful verification
            del otp_store[username]

        # Successful login
        log_event("SUCCESSFUL LOGIN", f"User '{username}' logged in successfully.")
        
        # Reset rate limiting counter on successful login
        if username in login_attempts:
            login_attempts[username] = (0, datetime.datetime.now())
            
        return jsonify({"message": "Login successful!", "success": True}), 200

    except Exception as e:
        logging.error(f"Error in /login: {str(e)}")
        return jsonify({"message": "Server error", "success": False}), 500


@app.route('/reset-blocks', methods=['POST'])
def reset_blocks():
    """Reset all blocked sessions"""
    blocked_sessions.clear()
    login_attempts.clear()
    log_event("SECURITY", "All blocks and rate limits reset")
    return jsonify({"message": "All blocks reset successfully"}), 200

@app.route('/logs', methods=['GET'])
def get_logs():
    """Fetch only login and SQL injection logs for the React Dashboard."""
    if not os.path.exists(LOG_FILE):
        return jsonify({"logs": []}), 200  # Return an empty JSON array if no logs exist

    with open(LOG_FILE, "r", encoding="utf-8") as f:
        logs = f.readlines()

    logs = [log.strip() for log in logs if "SUCCESSFUL LOGIN" in log or "FAILED LOGIN" in log or "SQLI ATTEMPT" in log or "RATE LIMITED" in log or "BLOCKED SESSION" in log or "SETTINGS" in log]

    return jsonify({"logs": logs}), 200

# Health check endpoint 
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "service": "secured-login-api"
    })

# WebSocket Event for React Dashboards
@socketio.on('connect', namespace='/logs')
def handle_connect():
    emit('message', {'data': 'Connected to WebSocket'})

if __name__ == "__main__":
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)