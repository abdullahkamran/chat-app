import mongoose from 'mongoose';

const RoomSchema = mongoose.Schema({
    name: {type: String, required: true},
    owners: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {timestamps: true, collection: 'rooms'})

let RoomModel = mongoose.model('Room', RoomSchema);


RoomModel.getAll = () => {
    return RoomModel.find({});
}

RoomModel.addRoom = room => {
    return room.save();
}

RoomModel.deleteByID = room => {
    return RoomModel.remove({_id: room._id});
}


export default RoomModel;