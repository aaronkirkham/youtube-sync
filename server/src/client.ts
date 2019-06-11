declare type ClientEventCallback = (data: object) => void;

export class Client {
  public readonly socket: SocketIO.Socket;

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
    this.socket.removeAllListeners();
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

  /**
   * Helper function to test if both clients match
   * @param other The other client instance to test against
   */
  is(other: Client): boolean {
    return this.socket.id === other.socket.id;
  }
}
