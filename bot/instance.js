const {
    VoiceConnectionStatus, joinVoiceChannel, getVoiceConnection, EndBehaviorType, VoiceConnectionReadyState
} = require("@discordjs/voice");
const {OpusEncoder} = require("@discordjs/opus");
const voice = require("./voice");
const {Music} = require("./music");
const wit = require("./wit");

const encoder = new OpusEncoder(48_000, 2);

function convertAudio(input) {
    try {
        // stereo to mono channel
        const data = new Int16Array(input)
        const new_data = new Int16Array(data.length / 2)
        for (let i = 0, j = 0; i < data.length; i += 4) {
            new_data[j++] = data[i]
            new_data[j++] = data[i + 1]
        }
        return Buffer.from(new_data);
    } catch (e) {
        console.log(e)
        console.log('convert_audio: ' + e)
        throw e;
    }
}

/**
 * An instance of a bot lives in each server it has access to.
 */
class Instance {
    constructor(client, guild) {
        this.client = client
        this.guild = guild
        if (!this.guild.available) {
            console.warn(`Guild ${this.guild.name} is not available`);
        }
        this.guild.voiceStates.cache.forEach((voiceState, memberId) => {
            if (memberId === "191383271500808192") {
                this.joinVoiceChannel(voiceState.channel)
            }
        });
        console.log(`Created bot instance for guild "${guild.name}"`);
        this.phrases = {};
        this.music = new Music(() => {
            return getVoiceConnection(this.guild.id);
        });
    }

    receiveTextMessage(message) {
        if (message.member.user.bot) { return; }
        wit.client
            .message(message.content)
            .then(data => {
                this.music.receiveCommand(data, message.member);
            })
            .catch(err => console.error);
    }

    receiveVoiceMessage(witResponse, member) {
        this.music.receiveCommand(witResponse, member);
    }

    receivePhrase(packets, member) {
        packets = packets.map((packet) => (encoder.decode(packet)));
        let buffer = Buffer.concat(packets);
        const duration = buffer.length / 48_000 / 4;
        console.log(`Phrase from ${member.user.username}: ${duration} sec`);
        if (duration <= 0.5) {
            console.log("Phrase too short");
        } else if (duration >= 20) {
            console.log("Phrase too long");
        }
        const data = convertAudio(buffer);
        voice.transcribe(data)
            .then(witResponse => {
                if (!witResponse) {
                    return;
                }
                if (witResponse.length === 0) {
                    return;
                }
                console.log(`${member.user.username}: ${JSON.stringify(witResponse)}`);
                this.receiveVoiceMessage(witResponse, member);
            })
            .catch(console.error);
    }

    receiveVoicePacket(data, member) {
        this.phrases[member.id].packets.push(data);
        clearTimeout(this.phrases[member.id].listener);
        this.phrases[member.id].listener = setTimeout(async () => {
            this.receivePhrase(this.phrases[member.id].packets, member);
            this.phrases[member.id].packets = [];
        }, 500);
    }

    voiceStateUpdate(oldState, newState) {
        if (oldState.channelId === newState.channelId) {
            return;
        }
        if (newState.id === this.client.user.id) {
            console.log(`Bot voice channel changed to ${newState.channel}`);
            // bot voice channel changed
            this.voiceChannel = newState.channel;
            if (!this.voiceChannel) {
                return;
            }
            this.voiceChannel.members.forEach(member => {
                if (member.user.bot) {
                    return;
                }
                this.listenToMember(member);
            });
            return;
        }
        const connection = getVoiceConnection(this.guild.id);
        if (!connection || connection.state !== VoiceConnectionReadyState) {
            return;
        }
        // other user channel changes
        if (newState.member.user.bot) {
            return;
        }
        if (!this.voiceChannel) {
            return;
        }
        if (this.voiceChannel === newState.channel) {
            this.listenToMember(newState.member);
        }
    }

    joinVoiceChannel(voiceChannel) {
        console.log(`Joining ${voiceChannel.name}`);
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: this.guild.id,
            selfMute: false,
            selfDeaf: false,
            adapterCreator: this.guild.voiceAdapterCreator
        });
        connection.on(VoiceConnectionStatus.Ready, () => {
            this.voiceChannel = voiceChannel;
            voiceChannel.members.forEach(member => {
                if (member.user.bot) {
                    return;
                }
                this.listenToMember(member);
            })
        });
    }

    leaveVoiceChannel() {
        const connection = getVoiceConnection(this.guild.id);
        if (connection) {
            connection.receiver.subscriptions.forEach((stream, memberId) => {
                stream.destroy();
            });
            this.phrases = {};
            connection.disconnect();
        }
    }

    listenToMember(member) {
        console.log(`Listening to ${member.user.username}`);
        const connection = getVoiceConnection(this.guild.id);
        if (!connection) {
            return;
        }
        const receiver = connection.receiver;
        if (receiver.subscriptions.has(member.id)) {
            return;
        }
        this.phrases[member.id] = {
            packets: [],
            listener: null
        }
        const stream = receiver.subscribe(
            member.id,
            {
                autoDestroy: true,
                emitClose: true,
                end: {
                    behavior: EndBehaviorType.Manual
                }
            }
        );
        stream.on("data", (data) => {
            this.receiveVoicePacket(data, member);
        });
        stream.on("error", (err) => {
            console.log(`Stream for ${member.user.username} errored: ` + err);
        });
    }
}

exports.Instance = Instance;
