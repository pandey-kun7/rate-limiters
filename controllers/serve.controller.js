import path from "path"

export const serveBasicFile = async (req,res) => {
     console.log(`Request from : ${req.ip}`);
     res.sendFile(path.resolve("./public/images/download.jpg"))
}