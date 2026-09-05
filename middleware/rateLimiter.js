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


let PREV_WINDOW_REQ_COUNT = 0;
let CURR_WINDOW_REQ_COUNT = 0;
const MAX_WINDOW_REQ_ALLOWED = 3;
const WINDOW_TIME_LIMIT = 10000;
let CURR_REQUEST_LIMIT = 0;
let OLD_REQ_TIME_STAMP = 0;
let CURR_REQ_TIME_STAMP = 0;

function slidingWindowCounterRateLimit(req,res,next){
    try{
        const now = Date.now();
        if(CURR_REQ_TIME_STAMP === 0 ){
            CURR_REQ_TIME_STAMP = now;
            CURR_WINDOW_REQ_COUNT++;
            next();
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m \x1b[32mInitializing window stamp\x1b[0m = \x1b[1m\x1b[33m${CURR_REQ_TIME_STAMP}\x1b[0m \x1b[90m(${new Date(CURR_REQ_TIME_STAMP).toLocaleTimeString()})\x1b[0m`);
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m Request allowed — current req count : \x1b[1m\x1b[33m${CURR_WINDOW_REQ_COUNT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m`);
        }else if(CURR_REQ_TIME_STAMP !==0 && now - WINDOW_TIME_LIMIT < CURR_REQ_TIME_STAMP && MAX_WINDOW_REQ_ALLOWED > CURR_WINDOW_REQ_COUNT && OLD_REQ_TIME_STAMP === 0){
            CURR_WINDOW_REQ_COUNT++;
            next();
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m Request allowed — current req count : \x1b[1m\x1b[33m${CURR_WINDOW_REQ_COUNT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m \x1b[90m(window stamp\x1b[0m \x1b[33m${CURR_REQ_TIME_STAMP}\x1b[0m\x1b[90m)\x1b[0m`);
        }else if(now - WINDOW_TIME_LIMIT >= CURR_REQ_TIME_STAMP){
            PREV_WINDOW_REQ_COUNT = CURR_WINDOW_REQ_COUNT;
            CURR_WINDOW_REQ_COUNT = 1;
            OLD_REQ_TIME_STAMP = CURR_REQ_TIME_STAMP;
            CURR_REQ_TIME_STAMP = now;
            next();
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m \x1b[32mRefreshing window stamp...\x1b[0m \x1b[90mold =\x1b[0m \x1b[1m\x1b[33m${OLD_REQ_TIME_STAMP}\x1b[0m \x1b[90m(${new Date(OLD_REQ_TIME_STAMP).toLocaleTimeString()})\x1b[0m \x1b[90m→ new =\x1b[0m \x1b[1m\x1b[33m${CURR_REQ_TIME_STAMP}\x1b[0m \x1b[90m(${new Date(CURR_REQ_TIME_STAMP).toLocaleTimeString()})\x1b[0m`);
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m \x1b[90mPrevious window req count : \x1b[0m\x1b[1m\x1b[33m${PREV_WINDOW_REQ_COUNT}\x1b[0m \x1b[90m| current window req count : \x1b[0m\x1b[1m\x1b[33m${CURR_WINDOW_REQ_COUNT}\x1b[0m`);
        }else if(OLD_REQ_TIME_STAMP!==0){
            CURR_REQUEST_LIMIT = CURR_WINDOW_REQ_COUNT + Math.floor((PREV_WINDOW_REQ_COUNT * ( 1 -((now - CURR_REQ_TIME_STAMP) / WINDOW_TIME_LIMIT))));
            if(CURR_REQUEST_LIMIT < MAX_WINDOW_REQ_ALLOWED){
                const before = CURR_WINDOW_REQ_COUNT;
                CURR_WINDOW_REQ_COUNT++;
                next();
                console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m Request allowed — current req limit : \x1b[1m\x1b[33m${CURR_REQUEST_LIMIT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m \x1b[90m(curr \x1b[0m\x1b[33m${before}\x1b[0m\x1b[90m + prev \x1b[0m\x1b[33m${PREV_WINDOW_REQ_COUNT}\x1b[0m\x1b[90m weighted)\x1b[0m`);
            }else {
                res.sendFile(path.resolve("./public/err/rate-limited.html"))
                console.log(`\x1b[31m[Sliding Window Counter]\x1b[0m Request rejected, weighted limit reached — current req limit : \x1b[1m\x1b[33m${CURR_REQUEST_LIMIT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m`);
            }
        }
        else{
            res.sendFile(path.resolve("./public/err/rate-limited.html"))
            console.log(`\x1b[31m[Sliding Window Counter]\x1b[0m Request rejected, counter at limit — current req count : \x1b[1m\x1b[33m${CURR_WINDOW_REQ_COUNT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m`);
        }
    }catch(err){
        console.log(`\x1b[31m[Sliding Window Counter]\x1b[0m Error : ${err}`);
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
    }else if(choice === 5){
        slidingWindowCounterRateLimit(req,res,next);
    }else{
        next();
    }
}