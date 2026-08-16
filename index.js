import express from "express"
import cors from "cors"
import path from "path"
import { ServeRouter } from "./routes/serve.route.js";

const app = express();

app.use(express.urlencoded({extended :false}));
app.use(express.json());
app.use(cors({
  origin: "*"
}));
app.use(express.static("public"))

app.use("/",ServeRouter)

app.listen(8000,()=>{
    console.log("Server is running");
})