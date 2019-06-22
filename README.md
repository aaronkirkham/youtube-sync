# ![](./client/src/assets/logo-with-text.png)
Synchronized YouTube video playback between multiple clients. Create a room, invite your friends and create a playlist of videos to watch together.

### Requirements
- NodeJS v8.6.0 or higher (object spread operator)

### Building the Client
- `npm install`
- `npm run build`

All public facing client files will be output in the `public` folder. By default only Apache server configs are available. If you need configuration for other types of servers, please refer to the [Example Server Configurations](https://router.vuejs.org/guide/essentials/history-mode.html#example-server-configurations) documentation.

For development purposes, you can run a hotreload server using `npm run start`. The server will be running at **localhost:8080**.

If you are running a server which isn't using the default port, you will need to edit `./client/config.json` **serverUrl** value and specify the full path to your server, including the new port number. e.g. `"serverUrl": "http://localhost:YOUR_PORT_HERE"`. ***You must rebuild the client files after changing the config.***

### Running a Server
- `npm install`
- `npm run build`
- `npm run start`

The default server port is 8888. To change this, edit `./server/config.json` and specify your desired port. *Please note, if the `PORT` environment variable is set, the value in the config file will be ignored.*

### License
This repository is licensed under MIT. [View license ›](LICENSE)
