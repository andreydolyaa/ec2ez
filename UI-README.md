# EC2EZ Web UI

Modern web interface for EC2EZ with dark theme and real-time logging.

## Features

- 🎨 **Clean Dark Theme** - Modern, professional UI with accurate fonts and spacing
- 📊 **Real-time Logging** - WebSocket-based live console output
- 🗂️ **Sidebar Navigation** - Organized sections for all features
- ⚡ **Fast & Responsive** - Built with React and Vite
- 🔄 **Auto-sync** - Session data updates in real-time

## Quick Start

### 1. Setup (First Time Only)

Install dependencies for both UI and server:

```bash
npm run ui:setup
```

### 2. Run UI Mode

Launch the web interface:

```bash
node ec2ez.js --ui
```

This will:
- Start the backend server on http://localhost:3001
- Start the frontend on http://localhost:3000
- Automatically open your browser

### 3. Use the UI

1. Navigate to http://localhost:3000
2. Enter your SSRF endpoint URL in the "Get Started" section
3. Click "Start Exploitation"
4. Watch real-time logs in the "Live Logs" section
5. Explore results in other sections (S3, Secrets, IAM, etc.)

## Architecture

```
ec2ez/
├── ui/                      # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   └── LogOutput.jsx
│   │   ├── sections/        # Feature sections
│   │   │   ├── Start.jsx
│   │   │   ├── IMDS.jsx
│   │   │   ├── S3.jsx
│   │   │   ├── Secrets.jsx
│   │   │   └── ...
│   │   ├── styles/          # Global styles
│   │   │   └── theme.css
│   │   ├── App.jsx          # Main app component
│   │   └── main.jsx         # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── server/                  # Express backend
│   ├── server.js            # API server with WebSocket
│   └── package.json
│
└── ui-launcher.js           # Launcher script

```

## Development

### Run in Development Mode

```bash
npm run ui:dev
```

This runs both frontend and backend with hot-reload enabled.

### Build for Production

```bash
npm run ui:build
```

Builds optimized production bundle in `ui/dist/`.

## Tech Stack

**Frontend:**
- React 18
- Vite
- Socket.io-client
- Axios

**Backend:**
- Express
- Socket.io
- CORS

## UI Sections

### 🚀 Get Started
Enter SSRF endpoint and start exploitation

### 🔑 IMDS Extraction
View extracted IMDSv2 token and metadata

### 🪣 S3 Operations
List buckets, objects, upload/download files

### 🔐 Secrets Manager
Browse and retrieve secrets

### ⚙️ SSM Parameters
Manage Systems Manager parameters

### 👤 IAM Operations
View users and roles

### λ Lambda Functions
List and invoke functions

### 🖥️ EC2 Instances
Manage EC2 instances

### 📊 CloudWatch Logs
Scan logs for secrets

### 🛡️ Permissions
View enumerated IAM permissions

### 📝 Live Logs
Real-time console output

### 📋 Session Summary
Comprehensive results overview

## API Endpoints

The backend exposes REST APIs for all CLI features:

- `POST /api/start` - Start exploitation
- `GET /api/s3/buckets` - List S3 buckets
- `POST /api/s3/list-objects` - List bucket objects
- `GET /api/secrets/list` - List secrets
- `POST /api/secrets/get` - Get secret value
- `GET /api/ssm/parameters` - List SSM parameters
- `POST /api/ssm/get-parameter` - Get parameter value
- `GET /api/iam/users` - List IAM users
- `GET /api/iam/roles` - List IAM roles
- `GET /api/lambda/functions` - List Lambda functions
- `POST /api/lambda/invoke` - Invoke Lambda
- `GET /api/ec2/instances` - List EC2 instances
- `GET /api/cloudwatch/log-groups` - List log groups
- `GET /api/summary` - Get session summary

## WebSocket Events

Real-time updates via Socket.io:

- `log` - Console log messages
- `sessionUpdate` - Session data updates
- `exploitationComplete` - Exploitation finished

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is in use:

```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill
lsof -ti:3001 | xargs kill
```

### Dependencies Not Installed

```bash
npm run ui:setup
```

### UI Not Loading

1. Check if both servers are running
2. Check browser console for errors
3. Verify http://localhost:3001 is accessible

## Contributing

When adding new features:
1. Add CLI functionality to `src/` modules
2. Add API endpoint to `server/server.js`
3. Create UI section in `ui/src/sections/`
4. Update sidebar in `ui/src/components/Sidebar.jsx`
5. Test both CLI and UI modes

## License

Same as EC2EZ main project
