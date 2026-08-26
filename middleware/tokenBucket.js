import path from "path"

let BUCKET = [];
const BUCKET_SIZE = 5;
const OUTFLOW_RATE = 10000;

setInterval(()=>{
    if(BUCKET.length > 0){
        const {next} = BUCKET.shift();
        next();
    }
},OUTFLOW_RATE)

export const checkBucket = (req,res,next)=>{
    if(BUCKET.length < BUCKET_SIZE){
        BUCKET.push({req, res, next});
    }else{
        res.sendFile(path.resolve('./public/err/rate-limited.html'))
    }
}