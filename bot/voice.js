const {witToken} = require("../config.json");
const https = require("https");

/**
 * Transcribes a raw audio buffer to text
 * @param buffer: Int16Array buffer
 */
async function transcribe(buffer) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: "api.wit.ai",
            path: "/speech",
            method: "POST",
            headers: {
                "Authorization": `Bearer ${witToken}`,
                "Content-Type": "audio/raw;encoding=signed-integer;bits=16;rate=48k;endian=little"
            },
        }, res => {
            let data;
            res.on("data", d => {
                try {
                    data = JSON.parse(d);
                } catch {}
            });
            res.on("end", () => {
                resolve(data["text"]);
            });
            res.on("error", err => {
                reject(err);
            })
        });
        req.write(buffer);
        req.end();
    })
}

exports.transcribe = transcribe
