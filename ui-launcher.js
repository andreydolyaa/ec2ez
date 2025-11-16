import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { setTimeout } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting EC2EZ UI...\n');

// Start the backend server
console.log('📡 Starting backend server on http://localhost:3001...');
const server = spawn('node', ['server.js'], {
  cwd: join(__dirname, 'server'),
  stdio: 'pipe',
  shell: true,
});

server.stdout.on('data', (data) => {
  console.log(`[SERVER] ${data.toString().trim()}`);
});

server.stderr.on('data', (data) => {
  console.error(`[SERVER ERROR] ${data.toString().trim()}`);
});

// Wait for server to start
await setTimeout(2000);

// Start the frontend
console.log('🎨 Starting frontend on http://localhost:3000...');
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: join(__dirname, 'ui'),
  stdio: 'inherit',
  shell: true,
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down EC2EZ UI...');
  server.kill();
  frontend.kill();
  process.exit(0);
});

console.log('\n✨ EC2EZ UI is starting...');
console.log('📝 Backend:  http://localhost:3001');
console.log('🌐 Frontend: http://localhost:3000');
console.log('\n💡 Press Ctrl+C to stop\n');
