import mongoose from "mongoose";

const userSchema = mongoose.Schema(
    {
        // id of the user in the shared auth service (auth.shrijit.tech)
        authId: {
            type: String,
            required: true,
            // sparse: pre-migration documents have no authId and must not
            // collide in the unique index.
            unique: true,
            sparse: true,
        },
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
        },
        recentSearch : [{type : Object}],
        userInterest: {
            type: [String],
            default: []
        },
        userAddress: {
            type: String,
            default: ""
        }
    }, { timestamps: true }
);
const User = mongoose.model('User', userSchema);

export default User;