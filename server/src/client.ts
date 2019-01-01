declare type ClientEventCallback = (data: object) => void;

export class Client {
  private readonly socket: SocketIO.Socket;

  constructor(socket: SocketIO.Socket) {
    this.socket = socket;
  }

  /**
   * Register an event callback to the client
   * @param event Event name
   * @param callback Callback function
   */
  on(event: string, callback: ClientEventCallback): void {
    this.socket.on(`client__${event}`, callback);
  }

  /**
   * Unregister all events registered to the client
   */
  offAll(): void {
    // for (const event in this.socket._events) {
    //   this.socket.removeListener(event, this.socket._events[event]);
    // }

    // TODO: test this works...
    this.socket.eventNames().forEach((name) => {
      this.socket.removeAllListeners(name);
    });
  }

  /**
   * Send packet to the client
   * @param identifier Packet type identifier
   * @param data Data to send to the client
   */
  send(identifier: string, data: object = {}): void {
    this.socket.emit('recv', {
      ...data,
      type: identifier,
    });
  }
}
