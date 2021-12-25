require("./util");
const { Client, Intents } = require('discord.js');
const { discordToken } = require('./config.json');
const { Instance } = require("./bot/instance");

const botInstances = new Map()

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_MESSAGE_TYPING,
    ]
});

client.once('ready', () => {
    console.log("Logged in as " + client.user.username);
    client.guilds.cache.forEach((guild, guildId) => {
        botInstances.set(guildId, new Instance(client, guild));
    });
});

client.on("messageCreate", message => {
    console.log("messageCreate");
    const guildId = message.guildId;
    const instance = botInstances.get(guildId);
    if (instance) {
        instance.receiveTextMessage(message);
    }
});

client.on("voiceStateUpdate", (oldState, newState) => {
    console.log("voiceStateUpdate");
    const guildId = newState.guild.id;
    const instance = botInstances.get(guildId);
    if (instance) {
        instance.voiceStateUpdate(oldState, newState);
    }
})

_ = client.login(discordToken);
