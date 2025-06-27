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
        recentSearch : [{type : Object}]
    }, { timestamps: true }
);
const User = mongoose.model('User', userSchema);
// console.log(User);
async function check(){
    const email = 'shrijitsrivastav@gmail.com';
    const chk = await User.findOne({email});
    // console.log(chk);
}
check();

export default User;