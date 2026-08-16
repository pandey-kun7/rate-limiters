import path from "path"

let BUCKET_CURR_SIZE = 5;
const BUCKET_CAPACITY = 5;
const REFRESH_BUCKET_TIME = 10000;

setInterval(() => {
    if(BUCKET_CURR_SIZE < BUCKET_CAPACITY){
        BUCKET_CURR_SIZE++;
        console.log(`Refilling Bucket- Current size : ${BUCKET_CURR_SIZE}`);
    }
}, REFRESH_BUCKET_TIME);

export const checkBucket = (req,res,next)=>{
    if(BUCKET_CURR_SIZE>0){
        BUCKET_CURR_SIZE--;
        console.log(BUCKET_CURR_SIZE);
        next();
    }else{
        res.sendFile(path.resolve('./public/err/rate-limited.html'))
    }
}