import mongoose, { Schema, mongo } from "mongoose";

const userSchema = mongoose.Schema(
    {
        fname: {
            type: String,
            required: true,
        },
        lname: {
            type: String,
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true,
        },
        recentSearch: {
            type: [{
                name: String,
                Region: String,
                Country: String,
                description: String,
                IconicPlace: String,
                // itinerary: [
                //     { day: Number, activities: [Array], meals: [Object] },
                // ], 
                // isSaved: Boolean,
                // time : { type: Date, default: Date.now }
            }],        //not sure
            default: [],
        },
    }, { timestamps: true }
);
const User = mongoose.model('User', userSchema);
// console.log(User);
async function check(){
    const email = 'johndoe@example.com';
    const chk = await User.findOne({email});
    console.log(chk);
}
check();

export default User;