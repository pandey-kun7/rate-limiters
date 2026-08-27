import path from "path"
import {choice} from "../index.js"

const BUCKET_SIZE = 3;
const RATE_FILL = 10000;
let CURR_BUCKET_SIZE = 3;

function tokenBucketRateLimit(req,res,next){
    try{
        if(CURR_BUCKET_SIZE > 0){
            next();
            CURR_BUCKET_SIZE--;
            console.log(`\x1b[90m[Token Bucket]\x1b[0m Remaining tokens : \x1b[1m\x1b[33m${CURR_BUCKET_SIZE}\x1b[0m\x1b[90m / ${BUCKET_SIZE}\x1b[0m`);
        }else{
            res.sendFile(path.resolve("./public/err/rate-limited.html"))
            console.log("\x1b[31m[Token Bucket]\x1b[0m Request rejected, bucket is empty");
        }
    }catch(err){
        console.log(`\x1b[31m[Token Bucket]\x1b[0m Error : ${err}`);
    }
}


const SLIDING_WINDOW_LENGTH = 10000;
const MAX_REQ_ALLOWED = 3;
let REQUEST_TIME_STAMPS = [];

function clear(timeStamp){
    let staleTimeLimit = timeStamp - SLIDING_WINDOW_LENGTH;
    REQUEST_TIME_STAMPS = REQUEST_TIME_STAMPS.filter((ts)=> (ts > staleTimeLimit));
    console.log(`\x1b[90m[Sliding Window]\x1b[0m \x1b[1m${REQUEST_TIME_STAMPS.length}\x1b[0m request(s) within the current window`);
}

function slidingWindowLogRateLimit(req,res,next){
    try{
        const now = Date.now();
        clear(now);
        if(REQUEST_TIME_STAMPS.length < MAX_REQ_ALLOWED){
            REQUEST_TIME_STAMPS.push(now);
            next();
            console.log(`\x1b[90m[Sliding Window]\x1b[0m Request allowed (\x1b[1m${REQUEST_TIME_STAMPS.length}\x1b[0m/\x1b[1m${MAX_REQ_ALLOWED}\x1b[0m)`);
        }else{
            res.sendFile(path.resolve("./public/err/rate-limited.html"))
            console.log("\x1b[31m[Sliding Window]\x1b[0m Request rejected, window full");
        }
    }catch(err){
        console.log(`\x1b[31m[Sliding Window]\x1b[0m Error : ${err}`);
    }
}


let BUCKET = [];

function leakyBucketRateLimit(req,res,next){
    try{
        if(BUCKET.length < BUCKET_SIZE){
            BUCKET.push({req,res,next});
            console.log(`\x1b[90m[Leaky Bucket]\x1b[0m Request queued (\x1b[1m${BUCKET.length}\x1b[0m/\x1b[1m${BUCKET_SIZE}\x1b[0m)`);
        }else{
            res.sendFile(path.resolve("./public/err/rate-limited.html"))
            console.log("\x1b[31m[Leaky Bucket]\x1b[0m Request rejected, bucket full");
        }
    }catch(err){
        console.log(`\x1b[31m[Leaky Bucket]\x1b[0m Error : ${err}`);
    }
}


const MAX_REQUEST_ALLOWED = 3;
let CURR_REQ_COUNT = 0;

function fixedWindowCounterRateLimit(req,res,next){
    try{
        if(CURR_REQ_COUNT < MAX_REQUEST_ALLOWED){
            next();
            CURR_REQ_COUNT++;
            console.log(`\x1b[90m[Fixed Window]\x1b[0m Request allowed (\x1b[1m${CURR_REQ_COUNT}\x1b[0m/\x1b[1m${MAX_REQUEST_ALLOWED}\x1b[0m)`);
        }else{
            res.sendFile(path.resolve("./public/err/rate-limited.html"))
            console.log("\x1b[31m[Fixed Window]\x1b[0m Request rejected, counter at limit");
        }
    }catch(err){
        console.log(`\x1b[31m[Fixed Window]\x1b[0m Error : ${err}`);
    }
}


setInterval(()=>{
    if(choice === 1 && CURR_BUCKET_SIZE < BUCKET_SIZE){
        CURR_BUCKET_SIZE++;
        console.log("\x1b[90m[Token Bucket]\x1b[0m \x1b[32mAdding token...\x1b[0m new size : \x1b[1m"+CURR_BUCKET_SIZE+"\x1b[0m");
    }else if(choice === 3 && BUCKET.length > 0){
        const {next} = BUCKET.shift();
        next();
        console.log("\x1b[90m[Leaky Bucket]\x1b[0m \x1b[32mReading a queued request...\x1b[0m remaining : \x1b[1m"+BUCKET.length+"\x1b[0m");
    }else if(choice === 4 && CURR_REQ_COUNT>0){
        CURR_REQ_COUNT = 0;
        console.log("\x1b[90m[Fixed Window]\x1b[0m \x1b[32mRefreshing window...\x1b[0m counter reset");
    }
    
},RATE_FILL)


export const rateLimiter = (req,res,next)=>{
    if(choice === 1){
        tokenBucketRateLimit(req,res,next);
    }else if(choice === 2){
        slidingWindowLogRateLimit(req,res,next);
    }else if(choice === 3){
        leakyBucketRateLimit(req,res,next);
    }else if(choice === 4){
        fixedWindowCounterRateLimit(req,res,next);
    }else{
        next();
    }
}