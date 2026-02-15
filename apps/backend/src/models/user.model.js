import mongoose from 'mongoose';

const UserSchema = mongoose.Schema({
    name: {type: String, required: true},
    username: {type: String, required: true, unique: true},
    rooms: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room'
    }]
}, {collection: 'users'});

let UserModel = mongoose.model('User', UserSchema);

UserModel.getAll = () => {
    return UserModel.find({});
}

UserModel.addUser = user => {
    return user.save();
}

UserModel.deleteByID = user => {
    return UserModel.remove({_id: user._id});
}

export default UserModel;