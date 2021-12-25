const { TextChannel } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType} = require("@discordjs/voice");
const { OpusEncoder } = require('@discordjs/opus');
const voice = require("./voice");

const guildVoiceConnections = new Map();

const encoder = new OpusEncoder(48000, 2);

function processMessage(message) {
    const channel = message.channel;
    if (!(channel instanceof TextChannel)) {
        console.log("received message is not in a server text channel");
        return;
    }
    if (message.content === "!join") {
        const member = message.member;
        if (!member.voice.channel) {
            channel.send({
                content: `<@${member.id}>: you're not in a voice channel`,
                reply: {
                    messageReference: message,
                    failIfNotExists: false
                }
            });
        } else {
            if (!member.voice.channel.joinable) {
                channel.send({
                    content: `<@${member.id}>: I can't join your voice channel`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                });
            } else {
                joinVoice(member.voice.channel);
            }
        }
    } else if (message.content === "!leave") {
        const voiceConn = guildVoiceConnections.get(message.guildId);
        if (voiceConn) {
            voiceConn.disconnect();
        }
    }
}

function joinVoice(voiceChannel) {
    const voiceConn = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guildId,
        selfDeaf: false,
        selfMute: false,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });
    voiceConn.on("stateChange", (oldState, newState) => {
        if (newState.status === "ready") {
            guildVoiceConnections.set(
                voiceChannel.guildId,
                voiceConn
            );
        } else if (newState.status === "disconnected") {
            guildVoiceConnections.delete(voiceChannel.guildId);
        }
    });
    voiceChannel.members.forEach((member, memberId) => {
        if (member.user.bot) {
            console.log(`Ignoring ${member.user.name} (because it's a bot)`);
            return;
        }
        console.log(`Subscribing to ${memberId}`)
        let opusPackets = [];
        const stream = voiceConn.receiver.subscribe(
            memberId, {
                end: {behavior: EndBehaviorType.Manual}
            });
        let phraseEnd;
        stream.on("data", data => {
            console.log(`${memberId} got data`);
            data = encoder.decode(data);
            opusPackets.push(data);
            clearTimeout(phraseEnd);
            phraseEnd = setTimeout(async () => {
                const phrase = await processPhrase(opusPackets);
                console.log(phrase);
                opusPackets = [];
            }, 1000);
        });
        stream.on("end", () => {
            console.log(`${memberId} stream ended`);
        });
        stream.on("close", () => {
            console.log(`${memberId} stream closed`);
        });
        stream.on("error", err => {
            console.log(`${memberId} stream errored: ${err}`);
        });
    });
}

async function processPhrase(data) {
    data = Buffer.concat(data);
    const duration = data.length / 48000 / 4;
    console.log(`Phrase duration: ${duration} sec`);
    data = convertAudio(data);
    return await voice.transcribe(data);
}

function convertAudio(input) {
    try {
        // stereo to mono channel
        const data = new Int16Array(input)
        const new_data = new Int16Array(data.length/2)
        for (let i = 0, j = 0; i < data.length; i+=4) {
            new_data[j++] = data[i]
            new_data[j++] = data[i+1]
        }
        return Buffer.from(new_data);
    } catch (e) {
        console.log(e)
        console.log('convert_audio: ' + e)
        throw e;
    }
}

exports.processMessage = processMessage;
