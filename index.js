require("./util");
const { Client, Intents } = require('discord.js');
const { discordToken } = require('./config.json');
const botManager = require("./bot/manager");

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
});

client.on("messageCreate", message => {
    if (message.author === client.user) {
        return;
    }
    console.log(`Received message "${message.content}" in channel "${message.channel.name}"`);
    botManager.processMessage(message);
});

_ = client.login(discordToken);
