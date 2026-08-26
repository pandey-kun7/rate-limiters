import path from "path"

const TIME_WINDOW_LENGTH = 10000;
const MAX_REQ_ALLOWED = 3;
let CURRENT_REQ_COUNT = 0;


setInterval(()=>{
    CURRENT_REQ_COUNT = 0;
    console.log("Refreshing Window....")
}, TIME_WINDOW_LENGTH)

export const rateLimiter = (req,res,next)=>{
    try{
        if(CURRENT_REQ_COUNT < MAX_REQ_ALLOWED){
            CURRENT_REQ_COUNT++;
            console.log(`Request Counter : ${CURRENT_REQ_COUNT}`)
            next();
        }else{
            res.sendFile(path.resolve("./public/err/rate-limited.html"))
        }
    }catch(err){
        console.log(`Error in rateLimiter : ${err}`);
    }
}