import express from "express"
import cors from "cors"
import readline from "readline"
import { ServeRouter } from "./routes/serve.route.js";

const app = express();

app.use(express.urlencoded({extended :false}));
app.use(express.json());
app.use(cors({origin: "*"}));

app.use(express.static("public"))

app.use("/",ServeRouter)

export let choice = 0; 

export let leakyBucketMode = "shaping";

const terminalInput = readline.createInterface({
	input : process.stdin,
	output : process.stdout,
	terminal : false
})


app.listen(8000,()=>{
    console.log("\n\x1b[1m\x1b[36m═══════════════════════════════════════════════\x1b[0m");
    console.log("\x1b[1m\x1b[32m  Server is running\x1b[0m");
    console.log("\x1b[90m  URL       : \x1b[0m\x1b[36mhttp://localhost:8000\x1b[0m");
    console.log("\x1b[1m\x1b[36m═══════════════════════════════════════════════\x1b[0m\n");

	function askChoiceForRateLimit(){
		terminalInput.question("Which type of ratelimiter you wish to use ? \n Press 1 for Token Bucket \n Press 2 for Sliding Window Log \n Press 3 for Leaky Bucket \n Press 4 for Fixed Window Counter \n Press 5 for Sliding Window Counter \n",(input)=>{
		choice = Number(input);

		if(choice === 1){
			console.log("\n\x1b[1m\x1b[33m>> Token Bucket\x1b[0m selected");
			askChoiceForRateLimit();
		}else if(choice === 2){
			console.log("\n\x1b[1m\x1b[33m>> Sliding Window Log\x1b[0m selected");
			askChoiceForRateLimit();
		}else if(choice === 3){
			terminalInput.question("Press 1 for shaping or anything for policing\n", (inp)=>{
				let modeChoice = Number(inp);
				if(modeChoice === 1){
					leakyBucketMode = "shaping";
				}else{
					leakyBucketMode = "policing";
				}
				askChoiceForRateLimit();
			})
			console.log("\n\x1b[1m\x1b[33m>> Leaky Bucket\x1b[0m selected");
		}else if(choice === 4){
			console.log("\n\x1b[1m\x1b[33m>> Fixed Window Counter\x1b[0m selected");
			askChoiceForRateLimit();
		}else if(choice === 5){
			console.log("\n\x1b[1m\x1b[33m>> Sliding Window Counter\x1b[0m selected");
			askChoiceForRateLimit();
		}else{
			askChoiceForRateLimit();
			console.log("\n\x1b[31m[!]\x1b[0m No rate limiter selected, requests will pass through");
			askChoiceForRateLimit();
		}		
	})
	}
	askChoiceForRateLimit();
})