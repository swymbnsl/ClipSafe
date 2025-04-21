# ClipSafe

ClipSafe is a beautiful, modern desktop application that monitors your clipboard for potentially harmful content. It combines pattern matching and AI-powered analysis to detect and protect against malicious content before it can cause harm to your system.

![ClipSafe Screenshot](assets/screenshot.png)

## Features

### Core Security

- **Real-time Clipboard Monitoring**: Continuously monitors clipboard changes
- **AI-Powered Analysis**: Uses Groq AI for advanced threat detection
- **Pattern Matching**: Local security checks for immediate threat detection
- **Multi-layer Protection**: Combines local and cloud-based security analysis

### Threat Detection

- **URL Analysis**: Detects malicious links, phishing attempts, and suspicious domains
- **Command Protection**: Identifies dangerous system commands and scripts
- **Code Analysis**: Scans for harmful code patterns and potential malware
- **Social Engineering Detection**: Identifies potential phishing and scam attempts

### User Interface

- **Modern Dashboard**: Clean, intuitive interface with real-time updates
- **Activity Logs**: Detailed history of all clipboard events and analyses
- **Threat Statistics**: Visual breakdowns of detected threats by category
- **System Tray Integration**: Runs quietly in the background
- **Dark/Light Theme**: Customizable appearance for user comfort

### Analysis Features

- **Threat Categories**: Organizes threats into code, command, URL, and other types
- **Confidence Scoring**: AI-powered threat probability assessment
- **Detailed Reports**: Comprehensive analysis of each security event
- **Historical Tracking**: Maintains history of threats and analyses

### Notifications

- **Real-time Alerts**: Instant notifications for potential threats
- **Customizable Warnings**: Configure notification preferences
- **Threat Details**: Detailed explanations of detected issues
- **Action Recommendations**: Suggested responses to security concerns

## Installation

### Prerequisites

- Node.js (v14 or higher)
- Python 3.8 or higher
- npm or yarn

### Setup

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/clipsafe.git
   cd clipsafe
   ```

2. Install Node.js dependencies:

   ```
   npm install
   ```

3. Install Python dependencies:

   ```
   cd python
   pip install -r requirements.txt
   cd ..
   ```

4. Start the application:
   ```
   npm start
   ```

## Building for Distribution

To build the application for distribution:

```
npm run build
```

This will create distributable packages in the `dist` directory.

## Configuration

### Groq API Key

For enhanced AI-powered analysis, you can add your Groq API key in the settings tab. Without an API key, the application will still work but will rely solely on pattern matching for security checks.

## Advanced Features

### AI Analysis

- Pattern recognition for unknown threats
- Context-aware security assessment
- Automated threat categorization
- Confidence-based risk assessment

### Security Measures

- Local pattern matching for instant protection
- Cloud-based AI analysis for complex threats
- Cache system for faster repeated checks
- Secure logging and event tracking

### Performance

- Minimal system resource usage
- Background processing
- Efficient clipboard monitoring
- Quick response times

### Customization

- Configurable monitoring settings
- Adjustable security levels
- Notification preferences
- Start-up options

## Usage

1. Launch ClipSafe
2. The application will start monitoring your clipboard automatically
3. When you copy or paste content, ClipSafe will analyze it for safety
4. If potentially harmful content is detected, you'll receive a notification
5. View detailed logs and statistics in the dashboard

## Technical Details

### Architecture

- Electron-based desktop application
- Python backend for security analysis
- Groq AI integration for advanced threat detection
- Real-time event system for immediate responses

### Security Features

ClipSafe protects against:

- Malicious URLs and phishing attempts
- Dangerous system commands
- Harmful code snippets
- Social engineering attacks
- Command injection attempts
- Suspicious scripts
- Known malware patterns
- Data exfiltration attempts

## License

MIT

## Acknowledgements

- [Electron](https://www.electronjs.org/)
- [Groq AI](https://groq.com/)
- [Font Awesome](https://fontawesome.com/)
