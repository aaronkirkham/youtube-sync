import { Server } from './server';

let port = null;
if (typeof process.env.PORT !== 'undefined') {
  port = parseInt(process.env.PORT, 10);
}

new Server(port || 8888);
