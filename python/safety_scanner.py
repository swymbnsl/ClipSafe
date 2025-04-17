import time
import re
import pyperclip
import requests
import subprocess
import hashlib
import os
import json
import threading
import logging
import sys
from urllib.parse import urlparse
from datetime import datetime
from pynput.keyboard import Listener, Key, KeyCode, Controller

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("safety_scanner.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("SafetyScanner")

class ClipboardSafetyScanner:
    def __init__(self, groq_api_key=None):
        self.last_clipboard = ""
        self.keyboard = Controller()
        self.paste_monitoring_active = True
        self.groq_api_key = groq_api_key
        
        # Safety patterns
        self.suspicious_command_patterns = [
            r"rm\s+-rf", r"dd\s+if=", r":(){", r"wget.+\|\s*bash",
            r"curl.+\|\s*bash", r"chmod\s+777", r"sudo\s+rm", r"mkfs",
            r">\s*/dev/sda", r"fork\s*bomb", r"shutdown", r"format\s+c:"
        ]
        self.suspicious_url_patterns = [
            r"bit\.ly", r"goo\.gl", r"tinyurl", r"t\.co", 
            r"(?:http|https)://(?:[0-9]+\.){3}[0-9]+",  # IP addresses
            r"phish", r"hack", r"crack", r"malware", r"trojan", r"warez",
            r"keygen", r"pirate", r"torrent", r"darkweb", r"onion$"
        ]
        self.suspicious_code_patterns = [
            r"eval\(", r"exec\(", r"os\.system\(", r"subprocess\.call\(",
            r"subprocess\.Popen\(", r"shell=True", r"chmod\(", r"_import_\(",
            r"base64\.b64decode\(", r"powershell\.exe", r"Process\.Start\(",
            r"Runtime\.exec\(", r"ScriptEngine", r"document\.write\(escape\("
        ]
        
        # Create directories for caches if they don't exist
        self.cache_dir = os.path.join(os.path.expanduser("~"), ".safety_scanner_cache")
        self.log_dir = os.path.join(os.path.expanduser("~"), ".safety_scanner_logs")
        for directory in [self.cache_dir, self.log_dir]:
            if not os.path.exists(directory):
                os.makedirs(directory)
        
        # Initialize the security event log
        self.security_log_path = os.path.join(self.log_dir, "security_events.log")
        
        # Start clipboard monitoring thread
        self.clipboard_thread = threading.Thread(target=self.monitor_clipboard)
        self.clipboard_thread.daemon = True
        self.clipboard_thread.start()
    
    def monitor_clipboard(self):
        """Main loop to monitor clipboard content"""
        logger.info("Clipboard safety scanner is now running.")
        
        last_content = ""
        last_check_time = 0
        
        try:
            while True:
                current_clipboard = pyperclip.paste()
                current_time = time.time()
                
                # Check if clipboard content has changed
                if current_clipboard != last_content:
                    # If this is the same content we saw recently (within 1 second),
                    # it's likely a paste operation
                    if current_clipboard == self.last_clipboard and (current_time - last_check_time) < 1.0:
                        logger.info("Paste operation detected")
                        self.check_pasted_content()
                    
                    # Update our tracking variables
                    last_content = current_clipboard
                    last_check_time = current_time
                    
                    # Store the new clipboard content
                    self.last_clipboard = current_clipboard
                    
                    # Truncate long content for display
                    if len(current_clipboard) > 10000:
                        content_sample = current_clipboard[:100] + "..."
                        logger.info("Content too large to display completely")
                    else:
                        content_sample = current_clipboard if len(current_clipboard) < 100 else current_clipboard[:100] + "..."
                    
                    logger.info(f"Clipboard content: {content_sample}")
                    
                    # Check the safety of the clipboard content
                    is_safe, message = self.check_clipboard_content(current_clipboard)
                    
                    # Log the security event
                    self.log_security_event("COPY", current_clipboard, is_safe, message)
                    
                    # Send notification to Electron app
                    notification_type = "safe" if is_safe else "warning"
                    notification_data = {
                        "type": "notification",
                        "title": "ClipSafe Alert",
                        "message": message,
                        "notification_type": notification_type
                    }
                    print(json.dumps(notification_data))
                    sys.stdout.flush()
                    
                    # Send log to Electron app
                    log_data = {
                        "type": "log",
                        "message": f"{'SAFE' if is_safe else 'WARNING'}: {message} - {content_sample}"
                    }
                    print(json.dumps(log_data))
                    sys.stdout.flush()
                
                # Wait a bit before checking again
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            logger.info("Clipboard safety scanner stopped.")
        except Exception as e:
            logger.error(f"Error in clipboard monitoring: {str(e)}")
    
    def log_security_event(self, event_type, content, is_safe, message):
        """Log security events to the security log file"""
        try:
            content_preview = content[:50] + "..." if len(content) > 50 else content
            content_preview = content_preview.replace("\n", " ")
            
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            status = "SAFE" if is_safe else "UNSAFE"
            
            log_entry = f"{timestamp} | {event_type} | {status} | {message} | {content_preview}\n"
            
            with open(self.security_log_path, "a", encoding="utf-8") as log_file:
                log_file.write(log_entry)
                
            logger.info(f"Security event logged: {event_type} - {status}")
        except Exception as e:
            logger.error(f"Failed to log security event: {str(e)}")
    
    def analyze_with_groq(self, content):
        """Use Groq AI to analyze the content for safety"""
        if not self.groq_api_key:
            logger.warning("Groq API key not provided, skipping AI analysis")
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            # Limit content length to avoid large API requests
            content_to_analyze = content[:5000] if len(content) > 5000 else content
            
            data = {
                "model": "llama3-70b-8192",  # Use appropriate Groq model
                "messages": [
                    {"role": "system", "content": """
                    You are a security analyst specialized in identifying potentially harmful content.
                    Analyze the provided text and determine if it contains:
                    1. Malicious URLs or suspicious links
                    2. Dangerous commands that could harm a computer system
                    3. Malicious code snippets with harmful intent
                    4. Phishing attempts or social engineering
                    5. Other security concerns
                    
                    Provide a JSON response with:
                    - is_safe: boolean
                    - confidence: number between 0 and 1
                    - category: string (url, command, code, phishing, other)
                    - explanation: brief explanation of your assessment
                    - potential_threat: description of the potential threat if not safe
                    """}, 
                    {"role": "user", "content": f"Analyze this content for safety concerns:\n\n{content_to_analyze}"}
                ],
                "temperature": 0.2,
                "max_tokens": 500
            }
            
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                data=json.dumps(data),
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result["choices"][0]["message"]["content"]
                
                # Extract the JSON part from the response
                try:
                    # Find JSON in the response (it might be wrapped in markdown code blocks)
                    json_match = re.search(r'json\s*(.*?)\s*', ai_response, re.DOTALL)
                    if json_match:
                        ai_response = json_match.group(1)
                    
                    analysis = json.loads(ai_response)
                    logger.info("Groq AI analysis complete")
                    return analysis
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse Groq AI response: {ai_response}")
                    return None
            else:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error in Groq AI analysis: {str(e)}")
            return None
    
    def check_url_safety(self, url):
        """Check if a URL is safe"""
        try:
            parsed_url = urlparse(url)
            domain = parsed_url.netloc
            
            # Check if the URL contains suspicious patterns
            for pattern in self.suspicious_url_patterns:
                if re.search(pattern, url, re.IGNORECASE):
                    return False, f"URL contains suspicious pattern: {pattern}"
            
            # Create a cached filename based on the domain
            cache_file = os.path.join(self.cache_dir, f"url_{hashlib.md5(domain.encode()).hexdigest()}")
            
            # Check if we have a recent cache for this domain (less than 1 hour old)
            if os.path.exists(cache_file) and (time.time() - os.path.getmtime(cache_file)) < 3600:
                with open(cache_file, 'r') as f:
                    cached_result = f.read()
                    is_safe = cached_result.startswith("safe")
                    message = cached_result[5:] if len(cached_result) > 5 else "URL appears safe (cached result)"
                    return is_safe, message
            
            # If Groq API key is available, use AI analysis
            if self.groq_api_key:
                analysis = self.analyze_with_groq(url)
                if analysis and 'is_safe' in analysis:
                    is_safe = analysis['is_safe']
                    message = analysis.get('explanation', 'Analysis provided by Groq AI')
                    
                    # Cache the result
                    with open(cache_file, 'w') as f:
                        f.write(f"{'safe' if is_safe else 'unsafe'}: {message}")
                    
                    return is_safe, message
            
            # Simple URL checks if AI analysis is not available
            # For a real implementation, use proper URL reputation services
            
            # For now, we'll consider it potentially safe but warn the user
            with open(cache_file, 'w') as f:
                f.write("safe: Basic checks passed but no deep analysis performed")
            
            return True, "URL appears to be safe (basic checks only)"
        except Exception as e:
            return False, f"Error analyzing URL: {str(e)}"
    
    def check_command_safety(self, command):
        """Check if a command is safe"""
        # Check if the command contains suspicious patterns
        for pattern in self.suspicious_command_patterns:
            if re.search(pattern, command, re.IGNORECASE):
                return False, f"Command contains suspicious pattern: {pattern}"
        
        # If Groq API key is available, use AI analysis
        if self.groq_api_key:
            analysis = self.analyze_with_groq(command)
            if analysis and 'is_safe' in analysis:
                return analysis['is_safe'], analysis.get('explanation', 'Analysis provided by Groq AI')
        
        # Simple checks if we don't have AI analysis
        dangerous_operations = ["shutdown", "reboot", "format", "fdisk", "mkfs", "rm -"]
        for op in dangerous_operations:
            if op in command.lower():
                return False, f"Command may perform potentially dangerous operation: {op}"
        
        return True, "Command appears to be safe"
    
    def check_code_safety(self, code):
        """Check if code is safe"""
        # Check if the code contains suspicious patterns
        for pattern in self.suspicious_code_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return False, f"Code contains suspicious pattern: {pattern}"
        
        # If Groq API key is available, use AI analysis
        if self.groq_api_key:
            analysis = self.analyze_with_groq(code)
            if analysis and 'is_safe' in analysis:
                return analysis['is_safe'], analysis.get('explanation', 'Analysis provided by Groq AI')
        
        # Additional code safety checks
        suspicious_code_elements = [
            "system(", "exec(", "eval(", "dangerouslySetInnerHTML", 
            "innerHTML =", ".write(", "document.location =", "window.location ="
        ]
        
        for element in suspicious_code_elements:
            if element in code:
                return False, f"Code contains potentially dangerous element: {element}"
        
        return True, "Code appears to be safe"
    
    def check_clipboard_content(self, content):
        """Analyze clipboard content for safety"""
        # Skip empty content
        if not content:
            return True, "Empty clipboard"
        
        # Check if content looks like a URL
        if re.match(r'^https?://\S+$', content):
            is_safe, message = self.check_url_safety(content)
        
        # Check if content looks like a terminal command
        elif content.startswith("$") or content.startswith("#") or "/" in content or "\\" in content:
            is_safe, message = self.check_command_safety(content)
        
        # Check if content looks like code
        elif any(keyword in content for keyword in ["import", "function", "def ", "class ", "var ", "let ", "const "]):
            is_safe, message = self.check_code_safety(content)
        
        # If we're not sure what it is, use Groq AI if available
        elif self.groq_api_key:
            analysis = self.analyze_with_groq(content)
            if analysis and 'is_safe' in analysis:
                is_safe = analysis['is_safe']
                message = analysis.get('explanation', 'Analysis provided by Groq AI')
            else:
                # Fallback to basic pattern matching
                for pattern in (self.suspicious_command_patterns + 
                              self.suspicious_url_patterns + 
                              self.suspicious_code_patterns):
                    if re.search(pattern, content, re.IGNORECASE):
                        return False, f"Content contains suspicious pattern: {pattern}"
                is_safe, message = True, "Content appears to be safe (basic checks only)"
        else:
            # For general content without Groq, do basic checks
            for pattern in (self.suspicious_command_patterns + 
                          self.suspicious_url_patterns + 
                          self.suspicious_code_patterns):
                if re.search(pattern, content, re.IGNORECASE):
                    return False, f"Content contains suspicious pattern: {pattern}"
            is_safe, message = True, "Content appears to be safe (basic checks only)"
        
        return is_safe, message
    
    def check_pasted_content(self):
        """Check the content that was just pasted"""
        if not self.paste_monitoring_active:
            return
        
        current_clipboard = pyperclip.paste()
        is_safe, message = self.check_clipboard_content(current_clipboard)
        
        if not is_safe:
            # Send notification to Electron app
            notification_data = {
                "type": "notification",
                "title": "ClipSafe Warning",
                "message": f"Potentially unsafe content pasted: {message}",
                "notification_type": "warning"
            }
            print(json.dumps(notification_data))
            sys.stdout.flush()
            
            # Send log to Electron app
            log_data = {
                "type": "log",
                "message": f"WARNING: Unsafe paste detected - {message}"
            }
            print(json.dumps(log_data))
            sys.stdout.flush()

if __name__ == "__main__":
    # Get Groq API key from command line argument
    groq_api_key = sys.argv[1] if len(sys.argv) > 1 else None
    
    # Create and start the scanner
    scanner = ClipboardSafetyScanner(groq_api_key=groq_api_key)
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Scanner stopped by user") 