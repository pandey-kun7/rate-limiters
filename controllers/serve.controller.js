import path from "path"

export const serveBasicFile = async (req,res) => {
     console.log(`\x1b[90m[Request]\x1b[0m Incoming request from \x1b[1m${req.ip}\x1b[0m`);
     res.sendFile(path.resolve("./public/images/download.jpg"))
}