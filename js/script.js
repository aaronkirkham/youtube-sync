(function () {
    const socket = io('http://localhost:8080');
    const videoTitle = document.getElementById('video-title');
    let player;
    let isHost = true;
    let isPlayerReady = false;
    let loadVideoWhenReady = null;
    let hostTimer = null;
    let lastSyncedTime = 0;

    window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player('player', {
            width: 560,
            height: 315,
            playerVars: {
                autohide: true,
                autoplay: false,
                controls: true,
                iv_load_policy: 3,
                rel: false
            },
            events: {
                'onReady': onYouTubePlayerReady,
                'onStateChange': onYouTubePlayerStateChange,
                'onPlaybackRateChange': onYouTubePlayerPlaybackRateChange
            }
        });
    };

    function onYouTubePlayerReady(event) {
        isPlayerReady = true;

        // start playing the video now if we were waiting for the player to load
        if (loadVideoWhenReady) {
            startPlayingVideo(loadVideoWhenReady);
        }
    }

    function onYouTubePlayerStateChange(event) {
        // if we were waiting for the player to load, force a quick update now
        // to flush any remaining changes to the player
        if (event.data === YT.PlayerState.PLAYING && loadVideoWhenReady) {
            updatePlayingVideo(loadVideoWhenReady);
            loadVideoWhenReady = null;
            return true;
        }

        socket.emit('updatevideo', {
            state: event.data,
            time: player.getCurrentTime()
        });
    }

    function onYouTubePlayerPlaybackRateChange(event) {
        socket.emit('updateplaybackrate', event.data);
    }

    function startPlayingVideo(videoInformation) {
        if (typeof videoInformation === 'undefined')
            return false;

        if (typeof player !== 'undefined' && isPlayerReady) {
            // set the video title
            videoTitle.innerHTML = videoInformation.title;

            // if we're the host, start some timers
            if (isHost && hostTimer !== null) {
                clearInterval(hostTimer);
                hostTimer = null;
            }

            // load the video
            player.loadVideoById(videoInformation.id, videoInformation.time, 'default');
            player.setPlaybackRate(videoInformation.rate);

            // start the host sync timer again
            if (isHost) {
                hostTimer = setInterval(() => {
                    socket.emit('syncvideo', {
                        time: player.getCurrentTime(),
                        ping: Date.now()
                    });
                }, 1500);
            }
        } else {
            loadVideoWhenReady = videoInformation;
        }
    }

    function updatePlayingVideo(information) {
        switch (information.state) {
            case YT.PlayerState.PLAYING: {
                player.seekTo(information.time, true);
                player.playVideo();
                break;
            }

            case YT.PlayerState.PAUSED: {
                player.pauseVideo();
                break;
            }

            case YT.PlayerState.ENDED: {
                player.stopVideo();
                break;
            }

            case YT.PlayerState.BUFFERING: {
                player.seekTo(information.time, true);
                break;
            }
        }
    }

    socket.on('startvideo', startPlayingVideo);
    socket.on('queuevideo', startPlayingVideo);
    socket.on('updatevideo', updatePlayingVideo);
    socket.on('updateplaybackrate', rate => player.setPlaybackRate(rate));
    socket.on('syncvideo', information => {
        console.log(`synced ~${Date.now() - information.pong}ms ago..`);

        // interpolate the player time so we can get as close as possible to the actual syncer
        // depending on their ping
        information.time += (Math.abs(Date.now() - information.pong) / 1000);
        console.log(`interpolated: ${information.time}`);
        console.log(`player diff: ${information.time - player.getCurrentTime()}`);

        if (information.time - player.getCurrentTime() > 0.5) {
            player.seekTo(information.time);
            console.log('synced');
        }
    });

    const form = document.getElementById('queue-video');
    form.addEventListener('submit', e => {
        e.preventDefault();

        const element = document.getElementById('video-url');
        const url = element.value;
        const url_segments = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);

        if (url_segments) {
            // TODO: should be using the youtube api, need keys for it!
            fetch(`https://noembed.com/embed?url=${url}`, {
                method: 'get'
            }).then(response => {
                return response.json();
            }).then(data => {
                // send to the server
                socket.emit('queuevideo', {
                    'id': url_segments[2], // TODO: should probably do some more testing to make sure this is correct!
                    'title': data.title,
                    'url': data.url,
                    'thumbnail': data.thumbnail_url
                });

                // reset the input value
                element.value = '';
            }).catch(error => {
                console.log(error);
            });
        }
    });
}());
