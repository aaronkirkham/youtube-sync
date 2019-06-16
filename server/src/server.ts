import socketIo = require('socket.io');
import { Client } from './client';
import { Room } from './room';

export class Server {
  private readonly io: SocketIO.Server;
  private readonly clients: Set<Client> = new Set();
  private rooms: Room[] = [];

  constructor(port: number = 8888) {
    this.io = socketIo(port, { pingInterval: 2500 });

    // register client handlers on new connection
    this.io.on('connection', (socket) => {
      const client = new Client(socket);
      this.clients.add(client);

      // find the target room id
      let id = this.getRoomIdFromHeaders(socket.handshake.headers);

      // if we don't have a room id in the headers, create a new room
      if (!id) {
        id = this.findNewRoomId();
        client.send('update_url', { id });
      }

      // join the room
      this.join(client, id);

      // handle disconnect
      socket.on('disconnect', () => this.leave(client));
    });

    console.log(`Server is listening on port ${port}...`);
  }

  /**
   * Handle a client joining a room
   * @param client Client who joined the room
   * @param id Room id which the client joined
   */
  join(client: Client, id: string): void {
    let room = this.rooms.find(r => r.id === id);

    // create the room if we need to
    if (typeof room === 'undefined') {
      room = new Room(id);
      this.rooms.push(room);
    }

    room.connect(client);
  }

  /**
   * Handle a client leaving a room
   * @param client Client who left the room
   */
  leave(client: Client): void {
    const room = this.rooms.find(r => r.clients.has(client));

    // disconnect the client from the room
    if (typeof room !== 'undefined') {
      room.disconnect(client);
    }

    // remove client from the clients list
    this.clients.delete(client);

    // cleanup any empty rooms
    this.rooms = this.rooms.filter(r => r.clients.size !== 0);
  }

  /**
   * Find a unique room id
   */
  findNewRoomId(): string {
    const id = Math.random().toString(36).substr(2, 7);
    const room = this.rooms.find(r => r.id === id);

    if (typeof room !== 'undefined') {
      return this.findNewRoomId();
    }

    return id;
  }

  /**
   * Get room id from socket io handshake headers
   * @param param
   */
  getRoomIdFromHeaders({ referer }: any): string {
    if (typeof referer === 'undefined') return null;

    const lastSlashPos = referer.lastIndexOf('/');
    const roomId = referer.substr(lastSlashPos + 1, referer.length);
    return roomId;
  }
}
