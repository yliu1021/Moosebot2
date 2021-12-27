const ytdl = require("ytdl-core")
const https = require("https");
const childProcess = require("child_process");
const pathToFFMpeg = require("ffmpeg-static");
const {createAudioPlayer, createAudioResource, StreamType} = require("@discordjs/voice");

class Music {
    constructor(getConnection) {
        this.getConnection = getConnection;
    }

    receiveCommand(command, member) {
        if (member.bot) return;
        const intent = getBestIntent(command);
        console.log("Music best intent: " + JSON.stringify(intent));
        if (!intent) return;
        if (intent["confidence"] < 0.6) return;
        if (intent["name"] === "play_song") {
            if (!command["entities"] || !command["entities"]["song_query:song_query"]) {
                console.log("Got play song intent but no song_query entities were detected");
                return;
            }
            let songQuery = "";
            let confidence = 0;
            for (const query of command["entities"]["song_query:song_query"]) {
                if (query["confidence"] > confidence) {
                    songQuery = query["body"];
                    confidence = query["confidence"];
                }
            }
            if (confidence <= 0.5) {
                console.log("No (confident) song queries were found");
                return;
            }
            this.playSong(songQuery);
        } else if (intent["name"] === "pause") {
            this.pause();
        } else if (intent["name"] === "resume") {
            this.resume();
        } else if (intent["name"] === "stop_playing") {
            this.stop();
        }
    }

    playSong(query) {
        console.log(`Playing "${query}"`);
        this.findVideoId(query)
            .then(videoId => {
                return ytdl.getInfo(videoId);
            })
            .then(videoInfo => {
                let format = ytdl.chooseFormat(
                    videoInfo.formats,
                    {
                        quality: "highestaudio",
                        filter: "audioonly"
                    });
                return format["url"]
            })
            .then(videoURL => {
                const ffmpegProcess = childProcess.spawn(
                    pathToFFMpeg,
                    [
                        "-reconnect", "1",
                        "-reconnect_streamed", "1",
                        "-reconnect_delay_max", "5",
                        "-i", videoURL,
                        "-map_metadata", "-1",
                        "-f", "opus",
                        "-c:a", "libopus",
                        "-ar", "48000",
                        "-ac", "2",
                        "-b:a", "128k",
                        "-loglevel", "warning",
                        "-vn",
                        "pipe:1",
                    ]
                );
                ffmpegProcess.stderr.on("data", err => {
                    console.log("ffmpeg error: " + err);
                });
                return ffmpegProcess.stdout
            })
            .then(stream => {
                const audioResource = createAudioResource(stream, {
                    inputType: StreamType.OggOpus,
                    metadata: {query: query}
                });
                this.audioPlayer = createAudioPlayer();
                this.audioPlayer.on("error", error => {
                    console.log("Audio player error: " + error);
                })
                this.audioPlayer.play(audioResource);
                const connection = this.getConnection();
                connection.subscribe(this.audioPlayer);
            });
    }

    pause() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
        }
    }

    resume() {
        if (this.audioPlayer) {
            this.audioPlayer.unpause();
        }
    }

    stop() {
        if (this.audioPlayer) {
            this.audioPlayer.stop(true);
        }
    }

    findVideoId(query) {
        query = encodeURIComponent(query);
        return new Promise((resolve, reject) => {
            https.get(`https://www.youtube.com/results?search_query=${query}`, res => {
                res.setEncoding("utf8");
                let rawData = "";
                res.on("data", chunk => {
                    rawData += chunk;
                });
                res.on("end", () => {
                    resolve(rawData);
                });
                res.on("error", err => {
                    reject(err);
                });
            });
        }).then(html => {
            const videoIds = html.match(/watch\?v=(\S{11})/);
            return videoIds[1].toString();
        });
    }
}

function getBestIntent(witResponse) {
    let bestIntent = null;
    if (!witResponse["intents"]) return;
    for (const intent of witResponse["intents"]) {
        if (bestIntent === null || intent["confidence"] > bestIntent["confidence"]) {
            bestIntent = intent;
        }
    }
    return bestIntent;
}

exports.Music = Music;
