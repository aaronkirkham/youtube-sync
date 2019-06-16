# YouTube Sync
Synchronized YouTube video playback between multiple clients. Create a room, invite your friends and create a playlist of videos to watch together.

### Requirements
- NodeJS v8.6.0 or higher (object spread operator)

### Building the Client
- `npm install`
- `npm run build`

The client files will be output in the `public` folder. If you're planning on running the client on a server in a subdirectory, remember to edit the **RewriteBase** value inside `.htaccess`.

Alternatively you can run inside webpack-dev-server by using `npm run start`. The hotreload server will be live at **localhost:8080**.

*If you are running your own server which isn't using the default port, you will need to pass a custom URL in the build stage using the **SOCKET_URL** environment variable. `SOCKET_URL=http://localhost:YOUR_PORT npm run build`*

### Running a Server
- `npm install`
- `npm run build`
- `node ./dist/index.js`

The default server port is 8888. To change this, set the **PORT** environment variable before running.
`PORT=1234 node ./dist/index.js`.

#### License
[MIT](LICENSE)
