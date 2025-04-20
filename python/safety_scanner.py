import time
import re
import pyperclip
import requests
import hashlib
import os
import json
import threading
import logging
import sys
from urllib.parse import urlparse
from datetime import datetime

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
            r"subprocess\.Popen\(", r"shell=True", r"chmod\(", r"__import__\(",
            r"base64\.b64decode\(", r"powershell\.exe", r"Process\.Start\(",
            r"Runtime\.exec\(", r"ScriptEngine", r"document\.write\(escape\("
        ]
        
        # Create directories for caches and logs
        self.cache_dir = os.path.join(os.path.expanduser("~"), ".safety_scanner_cache")
        self.log_dir = os.path.join(os.path.expanduser("~"), ".safety_scanner_logs")
        for directory in [self.cache_dir, self.log_dir]:
            os.makedirs(directory, exist_ok=True)
        
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
        total_checks = 0
        
        try:
            while True:
                current_clipboard = pyperclip.paste()
                
                # Check if clipboard content has changed
                if current_clipboard != last_content:
                    total_checks += 1
                    content_sample = current_clipboard[:100] + "..." if len(current_clipboard) > 100 else current_clipboard
                    logger.info(f"Clipboard content: {content_sample}")
                    
                    # Check the safety of the clipboard content
                    is_safe, message = self.check_clipboard_content(current_clipboard)
                    
                    try:
                        # Parse the message to ensure proper JSON structure
                        msg_obj = json.loads(message)
                        
                        # Determine severity level
                        severity = "info"
                        if not is_safe:
                            severity = "danger" if msg_obj.get("groq_analysis", {}).get("confidence", 0) > 0.8 else "warning"
                        
                        # Format log message with better structure and stats
                        log_message = {
                            "type": "log",
                            "message": {
                                "content": content_sample,
                                "local_check": msg_obj["local_check"],
                                "groq_analysis": msg_obj.get("groq_analysis", {}),
                                "timestamp": datetime.now().strftime("%I:%M %p"),
                                "stats": {
                                    "total_checks": total_checks,
                                    "is_safe": is_safe,
                                    "severity": severity
                                }
                            },
                            "severity": severity
                        }
                        
                        # Log to both file and stdout
                        logger.info(json.dumps(log_message))
                        print(json.dumps(log_message))
                        sys.stdout.flush()
                        
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse analysis result: {message}")
                    
                    last_content = current_clipboard
                
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
            
            # Create a structured log entry
            log_entry = {
                "timestamp": timestamp,
                "event_type": event_type,
                "status": "SAFE" if is_safe else "UNSAFE",
                "message": message,
                "content_preview": content_preview
            }
            
            # Write to log file
            with open(self.security_log_path, "a", encoding="utf-8") as log_file:
                log_file.write(json.dumps(log_entry) + "\n")
            
            logger.info(f"Security event logged: {event_type} - {'SAFE' if is_safe else 'UNSAFE'}")
            
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
            
            content_to_analyze = content[:5000] if len(content) > 5000 else content
            
            data = {
                "model": "compound-beta-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": """
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
                        """
                    },
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
                
                try:
                    json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                    if json_match:
                        ai_response = json_match.group(0)
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
            domain = parsed_url.netloc or parsed_url.path.split("/")[0]
            
            # Check for suspicious patterns
            for pattern in self.suspicious_url_patterns:
                if re.search(pattern, url, re.IGNORECASE):
                    return False, f"URL contains suspicious pattern: {pattern}"
            
            # Create a cached filename based on the domain
            cache_file = os.path.join(self.cache_dir, f"url_{hashlib.sha256(domain.encode()).hexdigest()}")
            
            # Check cache
            if os.path.exists(cache_file) and (time.time() - os.path.getmtime(cache_file)) < 3600:
                with open(cache_file, 'r') as f:
                    cached_result = f.read()
                    is_safe = cached_result.startswith("safe")
                    message = cached_result[5:] if len(cached_result) > 5 else "URL appears safe (cached result)"
                    return is_safe, message
            
            # Use Groq AI for analysis if available
            if self.groq_api_key:
                analysis = self.analyze_with_groq(url)
                if analysis and 'is_safe' in analysis:
                    is_safe = analysis['is_safe']
                    message = analysis.get('explanation', 'Analysis provided by Groq AI')
                    
                    # Cache the result
                    with open(cache_file, 'w') as f:
                        f.write(f"{'safe' if is_safe else 'unsafe'}: {message}")
                    
                    return is_safe, message
            
            # Fallback to basic checks
            with open(cache_file, 'w') as f:
                f.write("safe: Basic checks passed but no deep analysis performed")
            return True, "URL appears to be safe (basic checks only)"
            
        except Exception as e:
            return False, f"Error analyzing URL: {str(e)}"

    def check_command_safety(self, command):
        """Check if a command is safe"""
        for pattern in self.suspicious_command_patterns:
            if re.search(pattern, command, re.IGNORECASE):
                return False, f"Command contains suspicious pattern: {pattern}"
        
        if self.groq_api_key:
            analysis = self.analyze_with_groq(command)
            if analysis and 'is_safe' in analysis:
                return analysis['is_safe'], analysis.get('explanation', 'Analysis provided by Groq AI')
        
        dangerous_operations = ["shutdown", "reboot", "format", "fdisk", "mkfs", "rm -"]
        for op in dangerous_operations:
            if op in command.lower():
                return False, f"Command may perform potentially dangerous operation: {op}"
        
        return True, "Command appears to be safe"

    def check_code_safety(self, code):
        """Check if code is safe"""
        for pattern in self.suspicious_code_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return False, f"Code contains suspicious pattern: {pattern}"
        
        if self.groq_api_key:
            analysis = self.analyze_with_groq(code)
            if analysis and 'is_safe' in analysis:
                return analysis['is_safe'], analysis.get('explanation', 'Analysis provided by Groq AI')
        
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
        if not content:
            return True, json.dumps({"local_check": {"is_safe": True, "message": "Empty clipboard"}})
        
        local_is_safe = True
        local_message = "Content appears safe (local check)"
        
        # First do local checks 
        if re.match(r'^https?://\S+$', content):
            local_is_safe, local_message = self.check_url_safety(content)
        elif content.startswith(("$", "#")) or "/" in content or "\\" in content:
            local_is_safe, local_message = self.check_command_safety(content)
        elif any(keyword in content for keyword in ["import", "function", "def ", "class ", "var ", "let ", "const "]):
            local_is_safe, local_message = self.check_code_safety(content)
        else:
            for pattern in (self.suspicious_command_patterns + self.suspicious_url_patterns + self.suspicious_code_patterns):
                if re.search(pattern, content, re.IGNORECASE):
                    local_is_safe, local_message = False, f"Content contains suspicious pattern: {pattern}"
                    break
        
        # Create initial message structure
        initial_message = {
            "local_check": {
                "is_safe": local_is_safe,
                "message": local_message
            }
        }

        # Only do notifications after Groq analysis
        if self.groq_api_key:
            analysis = self.analyze_with_groq(content)
            if analysis and 'is_safe' in analysis:
                groq_is_safe = analysis['is_safe']
                groq_confidence = analysis.get('confidence', 0) 
                
                # Only send notification if Groq identifies it as unsafe
                if not groq_is_safe:
                    notification_data = {
                        "type": "notification",
                        "title": "ClipSafe AI Analysis",
                        "message": {
                            "local_check": initial_message["local_check"],
                            "groq_analysis": {
                                "is_safe": groq_is_safe,
                                "confidence": groq_confidence,
                                "category": analysis.get('category', 'unknown'),
                                "explanation": analysis.get('explanation', 'No explanation provided'),
                                "potential_threat": analysis.get('potential_threat', 'None identified')
                            }
                        },
                        "notification_type": "danger" if groq_confidence > 0.8 else "warning",
                        "details": {
                            "content_preview": content[:100] + "..." if len(content) > 100 else content,
                            "timestamp": datetime.now().strftime("%I:%M %p"),
                            "local_check": initial_message["local_check"],
                            "groq_analysis": analysis
                        }
                    }
                    print(json.dumps(notification_data))
                    sys.stdout.flush()
                
                # Return combined results
                is_safe = local_is_safe and groq_is_safe
                message = {
                    "local_check": initial_message["local_check"],
                    "groq_analysis": analysis
                }
                return is_safe, json.dumps(message)
        
        return local_is_safe, json.dumps(initial_message)

    def check_pasted_content(self):
        """Check the content that was just pasted"""
        if not self.paste_monitoring_active:
            return
        
        current_clipboard = pyperclip.paste()
        is_safe, message = self.check_clipboard_content(current_clipboard)
        
        if not is_safe:
            try:
                message_obj = json.loads(message)
                notification_data = {
                    "type": "notification",
                    "title": "ClipSafe Warning",
                    "message": message_obj.get("groq_analysis", {}).get("explanation", message_obj["local_check"]["message"]),
                    "notification_type": "warning"
                }
                print(json.dumps(notification_data))
                sys.stdout.flush()
                
                log_data = {
                    "type": "log",
                    "message": f"WARNING: Unsafe paste detected - {message}",
                    "timestamp": datetime.now().strftime("%I:%M %p"),
                    "severity": "warning"
                }
                print(json.dumps(log_data))
                sys.stdout.flush()
            except json.JSONDecodeError:
                logger.error(f"Failed to parse message for paste notification: {message}")

if __name__ == "__main__":
    groq_api_key = sys.argv[1] if len(sys.argv) > 1 else None
    scanner = ClipboardSafetyScanner(groq_api_key=groq_api_key)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Scanner stopped by user")