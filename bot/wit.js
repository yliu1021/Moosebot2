const {witToken} = require("../config.json");
const {Wit} = require("node-wit");

const client = new Wit({
    accessToken: witToken
});

exports.client = client;
