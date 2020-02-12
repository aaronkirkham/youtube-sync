# ![](./client/src/assets/logo-with-text.png)
Synchronized YouTube video playback between multiple clients. Create a room, invite your friends and create a playlist of videos to watch together.

## Client

### Building the Client
- `npm install`
- `npm run build`

All public facing files will be output in the `public` folder. By default only Apache server configs are available. If you need configuration for other types of servers, please refer to the [Example Server Configurations](https://router.vuejs.org/guide/essentials/history-mode.html#example-server-configurations) documentation.

For development purposes, you can run a hotreload server using `npm run start`. The server will be running at **localhost:8080**.

If you are running a server which isn't using the default port, you will need to edit `./client/config.json` **serverUrl** value and specify the full path to your server, including the new port number. e.g. `"serverUrl": "http://localhost:YOUR_PORT_HERE"`. ***You must rebuild the client files after changing the config.***

## Server

### Requirements
- NodeJS v10.0.0 or later (es2018)

### Running a Server
- `npm install`
- `npm run build`
- `npm run start`

#### Server Environment Variables
|env|Description|Default|
|:---|---|---|
|`PORT`|Port the server will listen on|`8888`|
|`PING`|Polling rate of the server (in milliseconds), this is the rate at which video information will be sent from the room host to the server, higher numbers will result in lower bandwidth, but may cause higher latency between clients|`2500`|
