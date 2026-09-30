import path from "path"
import fs from "fs"
import {choice} from "../index.js"
import { redisClient } from "../redis/client.js"

const FIXED_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])

local count = redis.call('INCR', key)

if count == 1 then
    redis.call('EXPIRE', key, window_seconds)
end

local ttl = redis.call('TTL', key)

return { count, ttl }
`;

const SLIDING_WINDOW_LOG_LUA_SCRIPT = `
local key = KEYS[1]
local max_req = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]

local window_start = now - window_seconds * 1000

redis.call("ZREMRANGEBYSCORE", key, 0, window_start)

local count = redis.call("ZCARD", key)

if count < max_req then
    redis.call("ZADD", key, now, member)
    redis.call("EXPIRE", key, window_seconds)
    return { count , max_req - count -1 , 0}
end

-- computing retry after logic

local oldest = redis.call("ZRANGE", key, 0 , 0, "WITHSCORES")
local retry_after_ms = window_seconds * 1000
if #oldest>=2 then 
    retry_after_ms = oldest[2] + window_seconds * 1000
end

return { 0, 0, retry_after_ms}

`


const RULES = JSON.parse(fs.readFileSync("./rules/rateLimitRules.json","utf-8"));

let lastReqTimeStamp = performance.now();

const priorityReqQueue = [];
let processingPriorityReqQueue = false;


async function processPriorityReqQueue(){
    const {next,req} = priorityReqQueue.shift();
    if(req){
        processingPriorityReqQueue = true;
        console.log("\x1b[90m[Priority]\x1b[0m \x1b[32mReading a queued priority request...\x1b[0m");
        next();
    }
    processingPriorityReqQueue = false;
}

const tokenBucketRateLimitIndex = 0;
const slidingWindowLogRateLimitIndex = 1;
const leakyBucketRateLimitIndex = 2;
const fixedWindowCounterRateLimitIndex = 3;
const slidingWindowCounterRateLimitIndex = 4;

const BUCKET_SIZE = RULES[tokenBucketRateLimitIndex]["rate-limit"]["requests_per_unit"];
const RATE_FILL = RULES[tokenBucketRateLimitIndex]["rate-limit"]["unit"];
let CURR_BUCKET_SIZE = RULES[tokenBucketRateLimitIndex]["rate-limit"]["requests_per_unit"];

function tokenBucketRateLimit(req,res,next){
    try{
        const now = performance.now();
        const throughput = RATE_FILL/BUCKET_SIZE;
        CURR_BUCKET_SIZE = Math.floor((now - lastReqTimeStamp)/throughput);
        lastReqTimeStamp = now;
        console.log("\x1b[90m[Token Bucket]\x1b[0m \x1b[32mAdded token...\x1b[0m new size : \x1b[1m"+CURR_BUCKET_SIZE+"\x1b[0m");

        if(CURR_BUCKET_SIZE > 0){

            res.setHeader('X-Ratelimit-Remaining', `${CURR_BUCKET_SIZE}`);
            res.setHeader('X-Ratelimit-Limit', `${BUCKET_SIZE}`);
            CURR_BUCKET_SIZE--;

            next();

            console.log(`\x1b[90m[Token Bucket]\x1b[0m Remaining tokens : \x1b[1m\x1b[33m${CURR_BUCKET_SIZE}\x1b[0m\x1b[90m / ${BUCKET_SIZE}\x1b[0m`);
        }else{
            if(req.get("Priority") && req.get("Priority") === "1"){
                console.log("Priority req added in queue")
                priorityReqQueue.push({req,res,next});
                if(!processingPriorityReqQueue){
                    processPriorityReqQueue();
                }
                return;
            }
            res.setHeader('X-Ratelimit-Retry-After', `${RATE_FILL/BUCKET_SIZE}`);
            res.status(429).sendFile(path.resolve("./public/err/rate-limited.html"));
            console.log("\x1b[31m[Token Bucket]\x1b[0m Request rejected, bucket is empty");
        }
    }catch(err){
        console.log(`\x1b[31m[Token Bucket]\x1b[0m Error : ${err}`);
    }
}


const SLIDING_WINDOW_LENGTH = RULES[slidingWindowLogRateLimitIndex]["rate-limit"]["unit"];;
const MAX_REQ_ALLOWED = RULES[slidingWindowLogRateLimitIndex]["rate-limit"]["requests_per_unit"];
let REQUEST_TIME_STAMPS = [];

function clear(timeStamp){
    let staleTimeLimit = timeStamp - SLIDING_WINDOW_LENGTH;
    REQUEST_TIME_STAMPS = REQUEST_TIME_STAMPS.filter((ts)=> (ts > staleTimeLimit));
    console.log(`\x1b[90m[Sliding Window]\x1b[0m \x1b[1m${REQUEST_TIME_STAMPS.length}\x1b[0m request(s) within the current window`);
}

async function slidingWindowLogRateLimit(req,res,next){
    try{
        const now = Date.now();
        const member = `${now}:${Math.random()}`;

        const result = (await redisClient.eval(SLIDING_WINDOW_LOG_LUA_SCRIPT , {
            keys: [`slidingWindowLogRateLimit:${req.ip}:counter`],
            arguments : [
                MAX_REQ_ALLOWED.toString(),
                SLIDING_WINDOW_LENGTH.toString(),
                now.toString(),
                member
            ]
        }))
        // clear(now);

        const count = result[0];
        const REMAINING_REQ = result[1];
        const RETRY_AFTER = result[2];

        if(count < MAX_REQ_ALLOWED && count !== 0){
            // REQUEST_TIME_STAMPS.push(now);
            res.setHeader('X-Ratelimit-Remaining', `${REMAINING_REQ}`);
            res.setHeader('X-Ratelimit-Limit', `${MAX_REQ_ALLOWED}`);
            next();
            console.log(`\x1b[90m[Sliding Window]\x1b[0m Request allowed (\x1b[1m${count}\x1b[0m/\x1b[1m${MAX_REQ_ALLOWED}\x1b[0m)`);
        }else{
            if(req.get("Priority") && req.get("Priority") === "1"){
                priorityReqQueue.push({req,res,next});
                if(!processingPriorityReqQueue){
                    processPriorityReqQueue();
                }
                return;
            }
            res.setHeader('X-Ratelimit-Retry-After', `${RETRY_AFTER}`);
            res.status(429).sendFile(path.resolve("./public/err/rate-limited.html"));
            console.log("\x1b[31m[Sliding Window]\x1b[0m Request rejected, window full");
        }
    }catch(err){
        console.log(`\x1b[31m[Sliding Window]\x1b[0m Error : ${err}`);
    }
}


let BUCKET = [];
const LEAKY_BUCKET_SIZE = RULES[leakyBucketRateLimitIndex]["rate-limit"]['requests_per_unit'];
const REFILL_TIME = RULES[leakyBucketRateLimitIndex]["rate-limit"]['unit']

function leakyBucketRateLimit(req,res,next){
    try{
        console.log(BUCKET.length ," ", LEAKY_BUCKET_SIZE)
        if(BUCKET.length < LEAKY_BUCKET_SIZE){
            BUCKET.push({req,res,next});
            console.log(`\x1b[90m[Leaky Bucket]\x1b[0m Request queued (\x1b[1m${BUCKET.length}\x1b[0m/\x1b[1m${LEAKY_BUCKET_SIZE}\x1b[0m)`);
        }else{
            if(req.get("Priority") && req.get("Priority") === "1"){
                priorityReqQueue.push({req,res,next});
                if(!processingPriorityReqQueue){
                    processPriorityReqQueue();
                }
                return;
            }
            res.setHeader('X-Ratelimit-Retry-After', `${REFILL_TIME/LEAKY_BUCKET_SIZE}`);
            res.status(429).sendFile(path.resolve("./public/err/rate-limited.html"));
            console.log("\x1b[31m[Leaky Bucket]\x1b[0m Request rejected, bucket full");
        }
    }catch(err){
        console.log(`\x1b[31m[Leaky Bucket]\x1b[0m Error : ${err}`);
    }
}


const MAX_REQUEST_ALLOWED = RULES[fixedWindowCounterRateLimitIndex]["rate-limit"]["requests_per_unit"];
const FIXED_WINDOW_TIME_LIMIT = RULES[fixedWindowCounterRateLimitIndex]["rate-limit"]["unit"];
let CURR_REQ_COUNT = 0;

async function fixedWindowCounterRateLimit(req,res,next){
    try{

        const result = (await redisClient.eval(FIXED_WINDOW_LUA_SCRIPT,{
            keys: [`fixedWindowCounterRateLimit:${req.ip}:counter`],
            arguments: [ MAX_REQUEST_ALLOWED.toString() , FIXED_WINDOW_TIME_LIMIT.toString() ]
        }))
        

        CURR_REQ_COUNT = await result[0];

        const RETRY_AFTER = await result[1];

        // const now = performance.now();
        // let isWindowExpired = (now - lastReqTimeStamp) >= FIXED_WINDOW_TIME_LIMIT;
        // if(isWindowExpired) CURR_REQ_COUNT = 0;

        console.log("\x1b[90m[Fixed Window]\x1b[0m \x1b[32mRefreshing window...\x1b[0m counter reset");
        
        // if(CURR_REQ_COUNT === 0){
        //     lastReqTimeStamp = now;
        // }
        
        if(CURR_REQ_COUNT <= MAX_REQUEST_ALLOWED){
            res.setHeader('X-Ratelimit-Remaining', `${MAX_REQUEST_ALLOWED - CURR_REQ_COUNT}`);
            res.setHeader('X-Ratelimit-Limit', `${MAX_REQUEST_ALLOWED}`);
            next();
            console.log(`\x1b[90m[Fixed Window]\x1b[0m Request allowed (\x1b[1m${CURR_REQ_COUNT}\x1b[0m/\x1b[1m${MAX_REQUEST_ALLOWED}\x1b[0m)`);
        }else{
            if(req.get("Priority") && req.get("Priority") === "1"){
                priorityReqQueue.push({req,res,next});
                if(!processingPriorityReqQueue){
                    processPriorityReqQueue();
                }
                return;
            }
            res.setHeader('X-Ratelimit-Retry-After', `${ RETRY_AFTER }`);
            res.status(429).sendFile(path.resolve("./public/err/rate-limited.html"));
            console.log("\x1b[31m[Fixed Window]\x1b[0m Request rejected, counter at limit");
        }

    }catch(err){
        console.log(`\x1b[31m[Fixed Window]\x1b[0m Error : ${err}`);
    }
}


let PREV_WINDOW_REQ_COUNT = 0;
let CURR_WINDOW_REQ_COUNT = 0;
const MAX_WINDOW_REQ_ALLOWED = RULES[slidingWindowCounterRateLimitIndex]["rate-limit"]["requests_per_unit"];
const WINDOW_TIME_LIMIT = RULES[slidingWindowCounterRateLimitIndex]["rate-limit"]["unit"];
let CURR_REQUEST_LIMIT = 0;
let OLD_REQ_TIME_STAMP = 0;
let CURR_REQ_TIME_STAMP = 0;

function slidingWindowCounterRateLimit(req,res,next){
    try{
        const now = Date.now();
        if(CURR_REQ_TIME_STAMP === 0 ){
            CURR_REQ_TIME_STAMP = now;
            res.setHeader('X-Ratelimit-Remaining', `${MAX_WINDOW_REQ_ALLOWED - CURR_WINDOW_REQ_COUNT}`);
            res.setHeader('X-Ratelimit-Limit', `${MAX_WINDOW_REQ_ALLOWED}`);
            CURR_WINDOW_REQ_COUNT++;
            next();
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m \x1b[32mInitializing window stamp\x1b[0m = \x1b[1m\x1b[33m${CURR_REQ_TIME_STAMP}\x1b[0m \x1b[90m(${new Date(CURR_REQ_TIME_STAMP).toLocaleTimeString()})\x1b[0m`);
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m Request allowed — current req count : \x1b[1m\x1b[33m${CURR_WINDOW_REQ_COUNT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m`);
        }else if(CURR_REQ_TIME_STAMP !==0 && now - WINDOW_TIME_LIMIT < CURR_REQ_TIME_STAMP && MAX_WINDOW_REQ_ALLOWED > CURR_WINDOW_REQ_COUNT && OLD_REQ_TIME_STAMP === 0){
            res.setHeader('X-Ratelimit-Remaining', `${MAX_WINDOW_REQ_ALLOWED - CURR_WINDOW_REQ_COUNT}`);
            res.setHeader('X-Ratelimit-Limit', `${MAX_WINDOW_REQ_ALLOWED}`);
            CURR_WINDOW_REQ_COUNT++;
            next();
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m Request allowed — current req count : \x1b[1m\x1b[33m${CURR_WINDOW_REQ_COUNT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m \x1b[90m(window stamp\x1b[0m \x1b[33m${CURR_REQ_TIME_STAMP}\x1b[0m\x1b[90m)\x1b[0m`);
        }else if(now - WINDOW_TIME_LIMIT >= CURR_REQ_TIME_STAMP){
            PREV_WINDOW_REQ_COUNT = CURR_WINDOW_REQ_COUNT;
            CURR_WINDOW_REQ_COUNT = 1;
            OLD_REQ_TIME_STAMP = CURR_REQ_TIME_STAMP;
            CURR_REQ_TIME_STAMP = now;
            res.setHeader('X-Ratelimit-Remaining', `${MAX_WINDOW_REQ_ALLOWED - CURR_WINDOW_REQ_COUNT}`);
            res.setHeader('X-Ratelimit-Limit', `${MAX_WINDOW_REQ_ALLOWED}`);
            next();
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m \x1b[32mRefreshing window stamp...\x1b[0m \x1b[90mold =\x1b[0m \x1b[1m\x1b[33m${OLD_REQ_TIME_STAMP}\x1b[0m \x1b[90m(${new Date(OLD_REQ_TIME_STAMP).toLocaleTimeString()})\x1b[0m \x1b[90m→ new =\x1b[0m \x1b[1m\x1b[33m${CURR_REQ_TIME_STAMP}\x1b[0m \x1b[90m(${new Date(CURR_REQ_TIME_STAMP).toLocaleTimeString()})\x1b[0m`);
            console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m \x1b[90mPrevious window req count : \x1b[0m\x1b[1m\x1b[33m${PREV_WINDOW_REQ_COUNT}\x1b[0m \x1b[90m| current window req count : \x1b[0m\x1b[1m\x1b[33m${CURR_WINDOW_REQ_COUNT}\x1b[0m`);
        }else if(OLD_REQ_TIME_STAMP!==0){
            CURR_REQUEST_LIMIT = CURR_WINDOW_REQ_COUNT + Math.floor((PREV_WINDOW_REQ_COUNT * ( 1 -((now - CURR_REQ_TIME_STAMP) / WINDOW_TIME_LIMIT))));
            if(CURR_REQUEST_LIMIT < MAX_WINDOW_REQ_ALLOWED){
                const before = CURR_WINDOW_REQ_COUNT;
                res.setHeader('X-Ratelimit-Remaining', `${MAX_WINDOW_REQ_ALLOWED - CURR_WINDOW_REQ_COUNT}`);
                res.setHeader('X-Ratelimit-Limit', `${MAX_WINDOW_REQ_ALLOWED}`);
                CURR_WINDOW_REQ_COUNT++;
                next();
                console.log(`\x1b[90m[Sliding Window Counter]\x1b[0m Request allowed — current req limit : \x1b[1m\x1b[33m${CURR_REQUEST_LIMIT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m \x1b[90m(curr \x1b[0m\x1b[33m${before}\x1b[0m\x1b[90m + prev \x1b[0m\x1b[33m${PREV_WINDOW_REQ_COUNT}\x1b[0m\x1b[90m weighted)\x1b[0m`);
            }else {
                if(req.get("Priority") && req.get("Priority") === "1"){
                    priorityReqQueue.push({req,res,next});
                    if(!processingPriorityReqQueue){
                        processPriorityReqQueue();
                    }
                    return;
                }
                res.setHeader('X-Ratelimit-Retry-After', `${WINDOW_TIME_LIMIT/MAX_WINDOW_REQ_ALLOWED}`);
                res.status(429).sendFile(path.resolve("./public/err/rate-limited.html"));
                console.log(`\x1b[31m[Sliding Window Counter]\x1b[0m Request rejected, weighted limit reached — current req limit : \x1b[1m\x1b[33m${CURR_REQUEST_LIMIT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m`);
            }
        }
        else{
            if(req.get("Priority") && req.get("Priority") === "1"){
                priorityReqQueue.push({req,res,next});
                if(!processingPriorityReqQueue){
                    processPriorityReqQueue();
                }
                return;
            }
            res.setHeader('X-Ratelimit-Retry-After', `${WINDOW_TIME_LIMIT/MAX_WINDOW_REQ_ALLOWED}`);
            res.status(429).sendFile(path.resolve("./public/err/rate-limited.html"));
            console.log(`\x1b[31m[Sliding Window Counter]\x1b[0m Request rejected, counter at limit — current req count : \x1b[1m\x1b[33m${CURR_WINDOW_REQ_COUNT}\x1b[0m\x1b[90m/\x1b[0m\x1b[1m\x1b[33m${MAX_WINDOW_REQ_ALLOWED}\x1b[0m`);
        }
    }catch(err){
        console.log(`\x1b[31m[Sliding Window Counter]\x1b[0m Error : ${err}`);
    }
}

setInterval(()=>{
    if(choice === 3 && BUCKET.length > 0){
        const {next, res} = BUCKET.shift();
        res.setHeader('X-Ratelimit-Remaining', `${LEAKY_BUCKET_SIZE - BUCKET.length}`);
        res.setHeader('X-Ratelimit-Limit', `${LEAKY_BUCKET_SIZE}`);
        next();
        console.log("\x1b[90m[Leaky Bucket]\x1b[0m \x1b[32mReading a queued request...\x1b[0m remaining : \x1b[1m"+BUCKET.length+"\x1b[0m");
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