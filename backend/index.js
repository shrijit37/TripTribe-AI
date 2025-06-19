import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";



//routes
import test from "./routes/test.js"
import itenaryRoute from "./routes/itenaryRoute.js"
import userRoute from "./routes/userRoute.js"
//database
import connectDb from "./config/db.js";

connectDb()

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.0.198:5173', // Your LAN IP for local frontend access
 // Add your deployed frontend domain if you have one
];

app.use(
  cors({
    origin: allowedOrigins,
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
