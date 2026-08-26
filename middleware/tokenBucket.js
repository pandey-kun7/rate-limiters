import path from "path"

const SLIDING_WINDOW_LENGTH = 10000;
const MAX_REQ_ALLOWED = 3;
let REQUEST_TIME_STAMPS = [];

function clear(timeStamp){
    let staleTimeLimit = timeStamp - SLIDING_WINDOW_LENGTH;
    REQUEST_TIME_STAMPS = REQUEST_TIME_STAMPS.filter((ts)=> (ts > staleTimeLimit));
    for(let i = 0 ; i < REQUEST_TIME_STAMPS.length ; i++){
        console.log(`Recorded Time Stamp : ${REQUEST_TIME_STAMPS[i]}  New Time Stamp : ${timeStamp}   Difference : ${timeStamp -REQUEST_TIME_STAMPS[i]}`);
    }
}

export const rateLimiter = (req,res,next)=>{
    try{
        const now = Date.now();
        clear(now);
        if(REQUEST_TIME_STAMPS.length < MAX_REQ_ALLOWED){
            REQUEST_TIME_STAMPS.push(now);
            next();
        }else{
            res.sendFile(path.resolve("./public/err/rate-limited.html"))
        }
    }catch(err){
        console.log(`Error in rateLimiter : ${err}`);
    }
}