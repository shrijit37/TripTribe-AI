import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongouri = process.env.MONGO_URI;

const connectDb = async()=>{
    try{
        await mongoose.connect(mongouri);
        console.log("DB connection established");
    }
    catch(e){
        console.log(e);
        process.exit(1);
    }
}


export default connectDb;   