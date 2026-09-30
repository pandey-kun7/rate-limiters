import {createClient} from "redis"
import "dotenv/config" 

export const redisClient = createClient({
    url : process.env.REDIS_URL
});

redisClient.on("error",(err)=>{
    console.log(`Err in redisClient: ${err} `)
});

await redisClient.connect();