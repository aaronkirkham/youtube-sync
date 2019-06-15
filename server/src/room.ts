import { Client } from './client';
import { Video } from './video';
import * as clc from 'cli-color';

export class Room {
  readonly id: string;
  private host: Client = null;
  readonly clients: Set<Client> = new Set();
  private current: Video = null;
  private queue: Video[] = [];

  constructor(id: string) {
    this.id = id;
  }

  /**
   * Client connected to the server
   * @param client Client who sent the request
   */
  connect(client: Client): void {
    // if we don't have any other clients, make this user the host
    if (this.clients.size === 0) {
      this.host = client;
      this.host.send('im_the_host');
    }

    // add the client to the clients list
    this.clients.add(client);

    // register the socket events
    client.on('queue--add', data => this.queueAdd(client, data));
    client.on('queue--remove', data => this.queueRemove(client, data));
    client.on('queue--order', data => this.queueOrder(client, data));
    client.on('video--update', data => this.updateVideo(client, data));
    client.on('video--playbackrate', data => this.updateVideoPlaybackRate(client, data));
    client.on('video--clock', data => this.syncClock(client, data));

    // send the current room state to the client
    if (this.current || this.queue.length > 0) {
      client.send('room--update', {
        current: this.current ? this.current.fullData() : null,
        queue: this.queue.map(video => video.data()),
      });

      // TODO: need to keep track of how long ago the last player time was synced
      // so if a user joins right after the last sync, they won't be 2500ms behind
      // the current player time time += (Math.abs(Date.now() - last_sync_time) / 1000);
    }
  }

  /**
   * Client disconnected from the server
   * @param client Client who sent the request
   */
  disconnect(client: Client): void {
    // remove all the event listeners
    client.offAll();

    // remove the client from the clients list
    this.clients.delete(client);

    // find a new host if we need to
    if (this.host === client && this.clients.size !== 0) {
      this.host = this.clients[Symbol.iterator]().next().value;
      this.host.send('im_the_host');
    }
  }

  /**
   * Add a video to the queue
   * @param client Client who sent the request
   * @param data Object containing video information to queue
   */
  queueAdd(client: Client, data: any): void {
    const video = new Video(data);

    // add the video to the queue if we need to
    if (this.current && !this.current.hasEnded()) {
      this.queue.push(video);
      this.emit('queue--add', video.data());
    } else {
      this.current = video;
      this.emit('video--play', video.data());
    }
  }

  /**
   * Remove a video from the queue
   * @param client Client who sent the request
   * @param data Object containing the video id to queue
   */
  queueRemove(client: Client, data: any): void {
    // TODO: permissions?

    const index = this.queue.findIndex(video => video.id === data.id);
    if (index !== -1) {
      const removed = this.queue.splice(index, 1);
      if (removed.length !== 0) {
        const { id } = removed[0];
        this.emit('queue--remove', { id });
      }
    }
  }

  /**
   * Change the order of the video queue
   * @param client Client who sent the request
   * @param data Object containing information about the new queue order
   */
  queueOrder(client: Client, data: any): void {
    const { order } = data;
    this.queue.sort((a, b) => order.indexOf(a.id) > order.indexOf(b.id) ? 1 : -1);
    this.emit('queue--order', { order }, client);
  }

  /**
   * Update the current video state
   * @param client Client who sent the request
   * @param data Object containing information about the video update
   */
  updateVideo(client: Client, data: any): void {
    if (this.current) {
      this.current.setState(data.state);

      switch (data.state) {
        // YT.PlayerState.ENDED
        case 0: {
          this.current.setTime(0);
          this.current.setPlaybackRate(1);
          this.nextVideo(client);
          break;
        }

        // YT.PlayerState.PLAYING
        case 1: {
          this.setTimeAndSyncClock(client, data.time);
          break;
        }

        // YT.PlayerState.PAUSED
        case 2: {
          this.setTimeAndSyncClock(client, data.time);
          break;
        }

        default: {
          break;
        }
      }

      // update the clients immediately if the video didn't end
      if (data.state !== 0) {
        this.emit('video--state', this.current.stateData(), client);
      }
    }
  }

  /**
   * Update the current video playback rate
   * @param client Client who sent the request
   * @param data Object containing information about the updated playback rate
   */
  updateVideoPlaybackRate(client: Client, data: any): void {
    if (this.current) {
      this.current.setPlaybackRate(data.rate);
      this.emit('video--playbackrate', this.current.rateData(), client);
    }
  }

  /**
   * Set the current video to the next one in the queue
   * @param client Client who sent the request
   */
  nextVideo(client: Client): void {
    // only allow the host to skip the video
    if (!this.host.is(client)) {
      return;
    }

    if (this.queue.length !== 0) {
      // play the next video
      const next = this.queue[Symbol.iterator]().next().value;
      this.current = next;
      this.emit('video--play', next.data());

      // remove the video we queued from the queue list
      this.queueRemove(client, { id: next.id });
    } else {
      this.emit('video--ended');
    }
  }

  /**
   * Sync the video clock with other clients
   * @param client Client who sent the request
   * @param data Object containing information about the current video clock
   */
  syncClock(client: Client, data: any): void {
    // only allow the host to sync the video clock
    if (!this.host.is(client) || !this.current) {
      return;
    }

    if (this.current.id !== data.id) {
      return;
    }

    this.setTimeAndSyncClock(client, data.time);
  }

  /**
   * Set the current video time, and force a clock sync to all clients
   * @param client Client who sent the request
   * @param time Time of the current video to sync
   */
  setTimeAndSyncClock(client: Client, time: number) {
    this.current.setTime(time);
    this.emit('video--clock', this.current.clockData(), client);
  }

  /**
   * Send a packet to all clients in the room
   * @param identifier Packet type identifier
   * @param data Data to send to the clients
   * @param ignore Client not to send the packet to
   */
  emit(identifier: string, data: any = {}, ignore: Client = null): void {
    let clients = this.clients;
    if (ignore !== null) {
      clients = new Set(Array.from(this.clients).filter(c => c !== ignore));
    }

    clients.forEach(client => client.send(identifier, data));
  }
}
