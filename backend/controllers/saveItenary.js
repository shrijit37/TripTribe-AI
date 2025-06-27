import User from "../models/userModel.js";
import { v4 as uuidv4 } from "uuid";
import DataModel from "../models/itenaryModel.js";

const saveItenary = async (itenary, city, email) => {
    try {
        // const itenId = uuidv4();
        console.log(email)
        if (email) {
            const newData = new DataModel(
                {
                    uuid: uuidv4(),
                    city: city,
                    itenary: itenary,
                    userEmail: email
                }
            );
            await newData.save();


            const user = await User.findOne({ email: email });
            if (user) {
                user.recentSearch.push(newData);
                await user.save();
                // console.log("User's recent search updated:", user);
            } else {
                console.log("User not found for email:", email);
            }
            // console.log(newData);

            // const itenId = newData.uuid;
            // try {
            //     const user = await User.findById(id);
            //     user.recentSearch.push(itenId);
            //     await user.save();
            //     console.log(user);
            // } catch (e) {
            //     console.log(e);
            // }

        }

    } catch (e) {
        console.log(e);
    }
}

export default saveItenary;