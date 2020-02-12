import chai from 'chai';
import io from 'socket.io-client';
import { Server } from '../dist/server.js';
import { Client } from '../dist/client.js';

const { expect } = chai;

// host/port of the server to connect to
const SOCKET_ADDR = 'http://localhost:8888';
const SOCKET_OPTS = { forceNew: true };

describe('Server', () => {
  let server = null;
  let host = null;

  // before each test
  before((done) => {
    server = new Server();
    host = new Client(io(SOCKET_ADDR, SOCKET_OPTS));
    host.socket.on('connect', done);
  });

  // after each test
  after((done) => {
    host.socket.disconnect();
    server.io.close(done);
  });

  // unsubscribe to all event listeners after each test
  afterEach(() => host.offAll());

  it('client connected successfully', () => {
    expect(server.io).to.not.be.undefined;
    expect(server.clients).to.have.property('size', 1);
  });

  it('created a room and assigned host', () => {
    expect(server.rooms).to.have.lengthOf(1);
    expect(server.rooms[0].host.socket.id).to.equal(host.socket.id);
  });

  it('queued a video and start playing', () => {
    const video = {
      id: '12345',
      title: 'testing',
      url: '',
      thumbnail: 'thumbnail.jpg',
    };

    const room = server.rooms[0];
    room.queueAdd(host, video);

    expect(room.current, 'Current video is null').to.not.be.null;
    expect(room.queue).to.have.lengthOf(0);
    expect(room.current).to.have.property('videoId', video.id);
    expect(room.current).to.have.property('title', video.title);
    expect(room.current).to.have.property('thumbnail', video.thumbnail);
  });

  it('added multiple videos to the queue', () => {
    const first = { id: '1', title: 'First Video', url: '', thumbnail: '' };
    const second = { id: '2', title: 'Second Video', url: '', thumbnail: '' };
    const third = { id: '3', title: 'Third Video', url: '', thumbnail: '' };

    const room = server.rooms[0];
    room.queueAdd(host, first);
    room.queueAdd(host, second);
    room.queueAdd(host, third);

    expect(room.queue).to.have.lengthOf(3);
    expect(room.queue[0]).to.have.property('title', first.title);
    expect(room.queue[1]).to.have.property('title', second.title);
    expect(room.queue[2]).to.have.property('title', third.title);
  });

  it('reversed video queue order', () => {
    const room = server.rooms[0];

    const items = room.queue.map(video => video.id);
    const firstId = items[0];
    const secondId = items[1];
    const thirdId = items[2];

    room.queueOrder(host, { order: items.reverse() });

    expect(room.queue[0]).to.have.property('id', thirdId);
    expect(room.queue[1]).to.have.property('id', secondId);
    expect(room.queue[2]).to.have.property('id', firstId);
  });

  it('skipped the current playing video and queued the next one', () => {
    const room = server.rooms[0];
    const queueSize = room.queue.length;
    const nextVideoId = room.queue[0].id;

    room.nextVideo(host);
    
    expect(room.current.id).to.equal(nextVideoId);
    expect(room.queue).to.have.lengthOf((queueSize - 1));
  });

  it('removed all videos from the queue', () => {
    const room = server.rooms[0];

    let next = room.queue[Symbol.iterator]().next().value;
    while (next !== undefined) {
      room.queueRemove(host, { id: next.id });
      next = room.queue[Symbol.iterator]().next().value;
    }

    expect(room.queue).to.be.empty;
  });

  describe('Handles new connections', () => {
    let client2 = null;

    before((done) => {
      client2 = new Client(io(SOCKET_ADDR, {
        ...SOCKET_OPTS,
        extraHeaders: {
          'referer': server.rooms[0].id,
        },
      }));

      client2.socket.on('recv', data => {
        if (data.type === 'room--update') {
          expect(data.current).to.be.an('object');
          expect(data.queue).to.be.an('array');
          expect(data.current).to.have.property('videoId', '3');
          done();
        }
      });
    });

    after(() => client2.socket.disconnect());
    afterEach(() => client2.offAll());

    it('client was added to the rooms client list', () => {
      expect(server.clients).to.have.property('size', 2);
      expect(server.rooms[0].clients).to.have.property('size', 2);
    });

    it('queued a video for both clients', (done) => {
      const video = {
        id: '9999',
        title: 'testing-2',
        url: '',
        thumbnail: 'thumbnail-2.jpg',
      };

      let callback_counter = 0;
      const callback = (data) => {
        if (data.type === 'queue--add') {
          expect(data).to.have.property('videoId', video.id);
          if (++callback_counter === 2) {
            done();
          }
        }
      };

      host.socket.on('recv', callback);
      client2.socket.on('recv', callback);

      server.rooms[0].queueAdd(client2, video);
    });
  });
});
