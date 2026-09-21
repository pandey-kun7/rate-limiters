import path from "path"

export const serveBasicFile = async (req,res) => {
     console.log(`\x1b[90m[Request]\x1b[0m Incoming request from \x1b[1m${req.ip}\x1b[0m`);
     res.status(200).sendFile(path.resolve("./public/html/index.html"))
}

export const serveBasicJSON = async (req,res) => {
     console.log(`\x1b[90m[Request]\x1b[0m Incoming request from \x1b[1m${req.ip}\x1b[0m`);
     res.status(200).json({
          success: true,
          message: "Hi!"
     })
}