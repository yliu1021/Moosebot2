const ytdl = require("ytdl-core")
const https = require("https");
const {createAudioPlayer, createAudioResource} = require("@discordjs/voice");

class Music {
    constructor(getConnection) {
        this.getConnection = getConnection;
    }

    receiveCommand(command, member) {
        console.log(`Music received ${JSON.stringify(command)}`);
        if (member.bot) return;
        const intent = getBestIntent(command);
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
                const audioResource = createAudioResource(videoURL, {
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
