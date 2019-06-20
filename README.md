# ![](./client/src/assets/logo-with-text.png)
Synchronized YouTube video playback between multiple clients. Create a room, invite your friends and create a playlist of videos to watch together.

### Requirements
- NodeJS v8.6.0 or higher (object spread operator)

### Building the Client
- `npm install`
- `npm run build`

All public facing client files will be output in the `public` folder. By default only Apache server configs are available. If you need configuration for other types of servers, please refer to the [Example Server Configurations](https://router.vuejs.org/guide/essentials/history-mode.html#example-server-configurations) documentation.

For development purposes, you can run a hotreload server using `npm run start`. The server will be running at **localhost:8080**.

### Running a Server
- `npm install`
- `npm run build`
- `node ./dist/index.js`

The default server port is 8888. To change this, set the **PORT** environment variable before running.
`PORT=1234 node ./dist/index.js`.

#### Notes
If you are running a server which isn't using the default port, you will need to pass a custom URL in the **client** build stage using the **SOCKET_URL** environment variable. `SOCKET_URL=http://localhost:CHANGE_PORT npm run build`

### License
This repository is licensed under MIT. [View license ›](LICENSE)
