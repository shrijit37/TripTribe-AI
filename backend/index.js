import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";



//routes
import test from "./routes/test.js"
import itenaryRoute from "./routes/itenaryRoute.js"
import userRoute from "./routes/userRoute.js"
//database
import connectDb from "./config/db.js";
import saveItenary from "./controllers/saveItenary.js";

connectDb()

const app = express()


app.use(
  cors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const port = 8080;


app.listen(port, () => {
    console.log(`Server running on port ${port}`)
  });


app.use("/api/test", test)
app.use("/api/itenary", itenaryRoute)
app.use("/api/signup", userRoute)
