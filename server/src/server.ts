import express from 'express';
import http from 'http';
import socketIo from 'socket.io';
import { Client } from './client';
import { Room } from './room';
import { getRandomString, getFromConfig, isValidUrl } from './util';

export class Server {
  private readonly app: any;
  private readonly httpServ: http.Server;
  private readonly io: SocketIO.Server;
  private readonly clients: Set<Client> = new Set();
  private rooms: Room[] = [];

  constructor() {
    let port = (parseInt(process.env.PORT, 10) || null);
    if (!port) {
      port = getFromConfig('port', 8888);
    }

    const pingInterval = getFromConfig('pingInterval', 2500);
    const webUrl = getFromConfig('webUrl', null);
    const validUrl = isValidUrl(webUrl);

    this.app = express();
    this.httpServ = http.createServer(this.app);
    this.io = socketIo(this.httpServ, { pingInterval });

    // handle connections to the server
    this.app.get('/', (req: any, res: any) => {
      if (!validUrl) return res.status(500).send();
      return res.redirect(webUrl);
    });

    // register client handlers on new connection
    this.io.on('connection', (socket) => {
      const client = new Client(socket);
      this.clients.add(client);

      // find the target room id
      let id = this.getRoomIdFromHeaders(socket.handshake.headers);

      // if that room doesn't exist, generate a new one
      // NOTE: this is so users can't type very long strings as the room id
      if (id && !this.getRoom(id)) {
        id = null;
      }

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

    this.httpServ.listen(port, () => console.log('Server is listening on port', port));
  }

  /**
   * Handle a client joining a room
   * @param client Client who joined the room
   * @param id Room id which the client joined
   */
  join(client: Client, id: string): void {
    let room = this.getRoom(id);

    // create the room if we need to
    if (!room) {
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
    const id = getRandomString(8);
    const room = this.rooms.find(r => r.id === id);

    if (typeof room !== 'undefined') {
      return this.findNewRoomId();
    }

    return id;
  }

  /**
   * Find a room from a given id
   * @param id ID of the room to find
   */
  getRoom(id: string): Room {
    return this.rooms.find(room => room.id === id);
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
