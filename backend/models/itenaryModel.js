import { model, Schema, mongoose } from "mongoose";

const itenarySchema = new Schema(
    {
        uuid: {
            type: String,
            required: true,
            unique: true // this reflects the MongoDB index
        },
        city: { type: String, require: true },
        itenary: { type: Object, required: true },
        userEmail: { type: String, required: true }
    }, { timestamps: true }
);

const DataModel = mongoose.model('itenary', itenarySchema);
export default DataModel;

